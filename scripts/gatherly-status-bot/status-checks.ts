import { DatabaseSync } from "node:sqlite";
import { open, readdir, stat, statfs, unlink } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { config } from "./config.js";
import { maskSensitive } from "./security.js";
import type { DashboardStatus, StatusLevel } from "./types.js";

const execFileAsync = promisify(execFile);
const botStartedAt = Date.now();

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  return Promise.race([promise, new Promise<T>((_, reject) => { timer = setTimeout(() => reject(new Error(`${label} timeout`)), ms); })]).finally(() => { if (timer) clearTimeout(timer); });
}

export function appLevel(responseOk: boolean, responseMs: number): StatusLevel {
  return !responseOk ? "error" : responseMs >= config.healthSlowMs ? "warning" : "ok";
}

export async function checkApp(healthUrl = config.healthUrl): Promise<DashboardStatus["app"]> {
  const started = performance.now();
  try {
    const response = await withTimeout(fetch(healthUrl, { signal: AbortSignal.timeout(config.healthTimeoutMs), cache: "no-store" }), config.healthTimeoutMs + 100, "health");
    const responseMs = Math.round(performance.now() - started);
    if (!response.ok) return { level: "error", summary: "응답 없음", details: { responseMs, httpStatus: response.status } };
    return { level: appLevel(true, responseMs), summary: responseMs >= config.healthSlowMs ? `응답 지연 · ${responseMs}ms` : `실행 중 · ${responseMs}ms`, details: { responseMs, httpStatus: response.status } };
  } catch {
    return { level: "error", summary: "응답 없음" };
  }
}

export async function checkDatabaseAt(databasePath = config.databasePath): Promise<DashboardStatus["database"]> {
  try {
    await stat(databasePath);
    const database = new DatabaseSync(databasePath, { readOnly: true });
    try {
      database.prepare("SELECT 1").get();
      const fieldDays = Number((database.prepare("SELECT count(*) AS count FROM FieldDay WHERE deletedAt IS NULL").get() as { count: number }).count);
      const materials = Number((database.prepare("SELECT count(*) AS count FROM Material WHERE deletedAt IS NULL").get() as { count: number }).count);
      return { level: "ok", summary: `연결 정상 · 현장 ${fieldDays}건 · 자료 ${materials}건`, details: { fieldDays, materials } };
    } finally { database.close(); }
  } catch {
    return { level: "error", summary: "연결할 수 없음" };
  }
}

export const checkDatabase = () => checkDatabaseAt();

async function directoryUsage(root: string) {
  let bytes = 0;
  let files = 0;
  async function visit(directory: string): Promise<void> {
    const entries = await readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      const candidate = path.join(directory, entry.name);
      if (entry.isDirectory()) await visit(candidate);
      else if (entry.isFile()) { const item = await stat(candidate); bytes += item.size; files += 1; }
    }
  }
  await visit(root);
  return { bytes, files };
}

export async function checkStorageAt(storageRoot = config.storageRoot): Promise<DashboardStatus["storage"]> {
  const uploads = path.join(storageRoot, "uploads");
  let temporaryPath = "";
  try {
    if (!(await stat(uploads)).isDirectory()) throw new Error("uploads missing");
    const usage = await withTimeout(directoryUsage(uploads), 8_000, "storage scan");
    temporaryPath = path.join(uploads, `.gatherly-status-${randomUUID()}.tmp`);
    const handle = await open(temporaryPath, "wx", 0o600);
    await handle.writeFile("status check");
    await handle.close();
    return { level: "ok", summary: `쓰기 가능 · ${usage.files}개 · ${formatBytes(usage.bytes)}`, details: usage };
  } catch {
    return { level: "error", summary: "접근 또는 쓰기 불가" };
  } finally {
    if (temporaryPath) await unlink(temporaryPath).catch(() => undefined);
  }
}

export const checkStorage = () => checkStorageAt();

async function macAvailableMemory() {
  if (process.platform !== "darwin") return { total: os.totalmem(), available: os.freemem() };
  try {
    const [{ stdout: pageSizeOutput }, { stdout: vmStatOutput }] = await Promise.all([
      execFileAsync("/usr/sbin/sysctl", ["-n", "hw.memsize"], { timeout: 2_000 }),
      execFileAsync("/usr/bin/vm_stat", [], { timeout: 2_000 }),
    ]);
    const pageSize = Number(vmStatOutput.match(/page size of (\d+) bytes/)?.[1] || 16_384);
    const pages = (name: string) => Number(vmStatOutput.match(new RegExp(`Pages ${name}:\\s+(\\d+)\\.`))?.[1] || 0);
    const availablePages = pages("free") + pages("inactive") + pages("speculative") + pages("purgeable");
    return { total: Number(pageSizeOutput.trim()) || os.totalmem(), available: availablePages * pageSize };
  } catch { return { total: os.totalmem(), available: os.freemem() }; }
}

export function diskLevel(diskUsedPercent: number): StatusLevel {
  return diskUsedPercent >= config.diskCriticalPercent ? "error" : diskUsedPercent >= config.diskWarnPercent ? "warning" : "ok";
}

export async function checkSystem(): Promise<DashboardStatus["system"]> {
  try {
    const [fileSystem, memory] = await Promise.all([statfs(config.storageRoot), macAvailableMemory()]);
    const totalBlocks = Number(fileSystem.blocks);
    const availableBlocks = Number(fileSystem.bavail);
    const totalBytes = totalBlocks * Number(fileSystem.bsize);
    const diskAvailableBytes = availableBlocks * Number(fileSystem.bsize);
    const diskUsedPercent = totalBytes > 0 ? Math.round((1 - diskAvailableBytes / totalBytes) * 100) : 0;
    const level = diskLevel(diskUsedPercent);
    return { level, summary: `디스크 ${formatBytes(diskAvailableBytes)} 여유 · ${diskUsedPercent}% 사용`, details: { diskUsedPercent, diskAvailableBytes, memoryTotalBytes: memory.total, memoryAvailableBytes: memory.available, uptimeSeconds: os.uptime(), loadAverage: os.loadavg() } };
  } catch { return { level: "unknown", summary: "시스템 정보를 확인할 수 없음" }; }
}

export async function checkRecentErrors(): Promise<DashboardStatus["errors"]> {
  if (!config.logPath) return { level: "unknown", summary: "로그 미설정", details: [] };
  try {
    const details = await stat(config.logPath);
    const handle = await open(config.logPath, "r");
    try {
      const readLength = Math.min(Number(details.size), 256 * 1024);
      const output = Buffer.alloc(readLength);
      await handle.read(output, 0, readLength, Math.max(0, Number(details.size) - readLength));
      const rows = output.toString("utf8").split(/\r?\n/).filter((line) => /\b(error|exception|fatal|failed|fail)\b/i.test(line)).slice(-5).map((line) => maskSensitive(line, 180)).filter(Boolean);
      return rows.length ? { level: "warning", summary: `최근 오류 ${rows.length}건`, details: rows } : { level: "ok", summary: "기록된 오류 없음", details: [] };
    } finally { await handle.close(); }
  } catch { return { level: "unknown", summary: "기록된 오류 없음", details: [] }; }
}

export async function collectStatus(): Promise<DashboardStatus> {
  const [app, database, storage, system, errors] = await Promise.all([checkApp(), checkDatabase(), checkStorage(), checkSystem(), checkRecentErrors()]);
  const levels = [app.level, database.level, storage.level, system.level];
  const overall: StatusLevel = levels.includes("error") ? "error" : levels.includes("warning") ? "warning" : levels.includes("unknown") ? "unknown" : "ok";
  return { overall, app, database, storage, system, errors, checkedAt: new Date() };
}

export function formatBytes(bytes = 0) {
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = Math.max(0, bytes); let unit = 0;
  while (value >= 1024 && unit < units.length - 1) { value /= 1024; unit += 1; }
  return `${value >= 10 || unit === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[unit]}`;
}

export function formatDuration(seconds = 0) {
  const total = Math.max(0, Math.floor(seconds));
  const days = Math.floor(total / 86_400); const hours = Math.floor((total % 86_400) / 3_600); const minutes = Math.floor((total % 3_600) / 60);
  return days ? `${days}일 ${hours}시간` : hours ? `${hours}시간 ${minutes}분` : `${minutes}분`;
}

export function statusBotUptime() { return Math.floor((Date.now() - botStartedAt) / 1_000); }
