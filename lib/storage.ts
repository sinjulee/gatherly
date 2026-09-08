import { createHash, randomUUID } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, rename, rm, stat } from "node:fs/promises";
import path from "node:path";
import { Readable, Transform } from "node:stream";
import type { ReadableStream as NodeReadableStream } from "node:stream/web";
import { pipeline } from "node:stream/promises";
import type { MaterialType } from "@/lib/domain";

type FileRule = { mimes: readonly string[]; extensions: readonly string[]; limitEnv: string; fallbackLimit: number };

const fileRules: Record<Exclude<MaterialType, "TEXT">, FileRule> = {
  IMAGE: { mimes: ["image/jpeg", "image/png", "image/heic", "image/heif", "image/webp"], extensions: ["jpg", "jpeg", "png", "heic", "heif", "webp"], limitEnv: "UPLOAD_MAX_IMAGE_BYTES", fallbackLimit: 10 * 1024 * 1024 },
  VIDEO: { mimes: ["video/mp4", "video/quicktime", "video/webm"], extensions: ["mp4", "mov", "webm"], limitEnv: "UPLOAD_MAX_VIDEO_BYTES", fallbackLimit: 250 * 1024 * 1024 },
  AUDIO: { mimes: ["audio/mp4", "audio/x-m4a", "audio/mpeg", "audio/wav", "audio/wave", "audio/webm"], extensions: ["m4a", "mp3", "wav", "webm"], limitEnv: "UPLOAD_MAX_AUDIO_BYTES", fallbackLimit: 100 * 1024 * 1024 },
};

export type ValidatedFile = { extension: string; mimeType: string; sizeBytes: number };

export class UploadValidationError extends Error {}

function configuredLimit(rule: FileRule) {
  const value = Number(process.env[rule.limitEnv]);
  return Number.isSafeInteger(value) && value > 0 ? value : rule.fallbackLimit;
}

export function validateUploadFile(file: File, type: Exclude<MaterialType, "TEXT">): ValidatedFile {
  const rule = fileRules[type];
  const extension = path.extname(file.name).slice(1).toLowerCase();
  const mimeType = file.type.toLowerCase();
  if (!extension || !rule.extensions.includes(extension) || !rule.mimes.includes(mimeType)) throw new UploadValidationError("허용되지 않은 파일 형식입니다.");
  if (!Number.isSafeInteger(file.size) || file.size <= 0 || file.size > configuredLimit(rule)) throw new UploadValidationError("파일 크기가 허용 범위를 초과했습니다.");
  return { extension, mimeType, sizeBytes: file.size };
}

export function getStorageRoot() {
  return path.resolve(process.cwd(), process.env.STORAGE_ROOT || "storage");
}

export function resolveStoredPath(relativePath: string) {
  if (!relativePath || path.isAbsolute(relativePath) || relativePath.split(/[\\\\/]+/).includes("..")) return null;
  const root = getStorageRoot();
  const resolved = path.resolve(root, relativePath);
  return resolved.startsWith(root + path.sep) ? resolved : null;
}

export async function storeUploadedFile(input: { file: File; fieldDayId: string; materialId: string; extension: string }) {
  const relativeDirectory = path.join("uploads", input.fieldDayId, input.materialId);
  const directory = resolveStoredPath(relativeDirectory);
  if (!directory) throw new Error("저장 경로를 만들 수 없습니다.");
  const storedName = "original." + input.extension;
  const relativePath = path.join(relativeDirectory, storedName);
  const destination = resolveStoredPath(relativePath);
  if (!destination) throw new Error("저장 경로를 만들 수 없습니다.");

  await mkdir(directory, { recursive: true });
  const temporaryPath = path.join(directory, "." + randomUUID() + ".part");
  const hash = createHash("sha256");
  const hashTransform = new Transform({ transform(chunk, _encoding, callback) { hash.update(chunk); callback(null, chunk); } });

  try {
    const source = Readable.fromWeb(input.file.stream() as unknown as NodeReadableStream);
    await pipeline(source, hashTransform, createWriteStream(temporaryPath, { flags: "wx" }));
    await rename(temporaryPath, destination);
    return { relativePath, storedName, sha256: hash.digest("hex") };
  } catch (error) {
    await rm(temporaryPath, { force: true }).catch(() => undefined);
    throw error;
  }
}

export async function removeIncompleteMaterial(relativePath?: string | null) {
  if (!relativePath) return;
  const absolutePath = resolveStoredPath(relativePath);
  if (!absolutePath) return;
  await rm(path.dirname(absolutePath), { recursive: true, force: true }).catch(() => undefined);
}

export async function getStoredFile(relativePath: string) {
  const absolutePath = resolveStoredPath(relativePath);
  if (!absolutePath) return null;
  try {
    const fileStat = await stat(absolutePath);
    if (!fileStat.isFile()) return null;
    return { absolutePath, size: fileStat.size, stream: () => createReadStream(absolutePath) };
  } catch {
    return null;
  }
}
