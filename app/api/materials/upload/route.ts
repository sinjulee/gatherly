import { NextResponse } from "next/server";
import { cleanText, isMaterialType, parseOptionalDate } from "@/lib/domain";
import { prisma } from "@/lib/prisma";
import { removeIncompleteMaterial, storeUploadedFile, UploadValidationError, validateUploadFile } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let materialId: string | null = null;
  let relativePath: string | null = null;
  try {
    const form = await request.formData();
    const fieldDayId = cleanText(form.get("fieldDayId"), 100);
    const clientUploadId = cleanText(form.get("clientUploadId"), 120);
    const claimedType = form.get("type");
    const file = form.get("file");
    const title = cleanText(form.get("title") ?? "", 160);
    const capturedAt = parseOptionalDate(form.get("capturedAt"));
    if (!fieldDayId || !clientUploadId || !isMaterialType(claimedType) || claimedType === "TEXT" || !(file instanceof File)) {
      return NextResponse.json({ error: "업로드 정보를 다시 확인해 주세요." }, { status: 400 });
    }
    const fileMeta = validateUploadFile(file, claimedType);
    const project = await prisma.fieldDay.findFirst({ where: { id: fieldDayId, deletedAt: null } });
    if (!project) return NextResponse.json({ error: "선택한 현장 프로젝트를 찾을 수 없습니다." }, { status: 404 });

    const existing = await prisma.material.findUnique({ where: { clientUploadId } });
    if (existing?.uploadStatus === "STORED") return NextResponse.json({ material: existing, idempotent: true });
    if (existing?.uploadStatus === "UPLOADING") return NextResponse.json({ error: "이미 저장 중인 자료입니다." }, { status: 409 });
    if (existing && (existing.fieldDayId !== fieldDayId || existing.type !== claimedType)) return NextResponse.json({ error: "다른 자료와 같은 업로드 식별자를 사용할 수 없습니다." }, { status: 409 });

    const material = existing ?? await prisma.material.create({
      data: { fieldDayId, type: claimedType, title: title || file.name, originalName: file.name, mimeType: fileMeta.mimeType, sizeBytes: fileMeta.sizeBytes, capturedAt, clientUploadId, uploadStatus: "PENDING" },
    });
    materialId = material.id;
    await prisma.material.update({ where: { id: material.id }, data: { uploadStatus: "UPLOADING", uploadError: null, title: title || file.name, originalName: file.name, mimeType: fileMeta.mimeType, sizeBytes: fileMeta.sizeBytes, capturedAt } });

    const stored = await storeUploadedFile({ file, fieldDayId, materialId: material.id, extension: fileMeta.extension });
    relativePath = stored.relativePath;
    const completed = await prisma.material.update({
      where: { id: material.id },
      data: { storedName: stored.storedName, relativePath: stored.relativePath, sha256: stored.sha256, uploadStatus: "STORED", uploadError: null },
    });
    return NextResponse.json({ material: completed }, { status: 201 });
  } catch (error) {
    if (relativePath) await removeIncompleteMaterial(relativePath);
    if (materialId) await prisma.material.update({ where: { id: materialId }, data: { uploadStatus: "FAILED", uploadError: error instanceof UploadValidationError ? error.message : "파일을 저장하지 못했습니다." } }).catch(() => undefined);
    if (error instanceof UploadValidationError) return NextResponse.json({ error: error.message }, { status: 400 });
    console.error("material upload failed", { materialId, reason: error instanceof Error ? error.message : "unknown" });
    return NextResponse.json({ error: "파일을 저장하지 못했습니다. 다시 시도해 주세요." }, { status: 500 });
  }
}
