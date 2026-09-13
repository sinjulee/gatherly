import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { scanPreResearchSources } from "@/lib/google-drive-workspace";

export const runtime = "nodejs";

function inferSourceType(name: string) {
  const normalized = name.toLowerCase();
  if (normalized.includes("방문") || normalized.includes("visit")) return "VISIT_PLAN";
  if (normalized.includes("체크") || normalized.includes("checklist")) return "CHECKLIST";
  if (normalized.includes("시장") || normalized.includes("트렌드") || normalized.includes("research") || normalized.includes("조사")) return "NOTEBOOK_RESEARCH";
  return "OTHER";
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const fieldDayId = typeof body.fieldDayId === "string" ? body.fieldDayId.trim() : "";
    if (!fieldDayId) return NextResponse.json({ error: "현장을 선택해 주세요." }, { status: 400 });

    const fieldDay = await prisma.fieldDay.findFirst({ where: { id: fieldDayId, deletedAt: null } });
    if (!fieldDay) return NextResponse.json({ error: "현장을 찾을 수 없습니다." }, { status: 404 });
    if (!fieldDay.driveProjectFolderId) return NextResponse.json({ error: "먼저 Google Drive 현장 폴더를 연결해 주세요." }, { status: 409 });

    const scanned = await scanPreResearchSources(fieldDay.driveProjectFolderId);
    const now = new Date();

    await prisma.$transaction(async (tx) => {
      for (const file of scanned.files) {
        const modifiedTime = file.modifiedTime ? new Date(file.modifiedTime) : null;
        const contentHash = file.md5Checksum || null;
        await tx.preResearchSource.upsert({
          where: { fieldDayId_driveFileId: { fieldDayId, driveFileId: file.id } },
          create: {
            fieldDayId,
            driveFileId: file.id,
            name: file.name,
            mimeType: file.mimeType || null,
            webViewLink: file.webViewLink || null,
            modifiedTime,
            sourceType: inferSourceType(file.name),
            contentHash,
            lastScannedAt: now,
          },
          update: {
            name: file.name,
            mimeType: file.mimeType || null,
            webViewLink: file.webViewLink || null,
            modifiedTime,
            contentHash,
            lastScannedAt: now,
          },
        });
      }
      await tx.fieldDay.update({ where: { id: fieldDayId }, data: { driveWorkspaceLastScannedAt: now } });
    });

    const sources = await prisma.preResearchSource.findMany({
      where: { fieldDayId },
      orderBy: [{ selectedForPlan: "desc" }, { name: "asc" }],
    });

    return NextResponse.json({ folderId: scanned.folderId, scannedCount: scanned.files.length, sources });
  } catch (error) {
    const code = error instanceof Error ? error.message : "DRIVE_PRE_RESEARCH_SCAN_FAILED";
    return NextResponse.json({ error: "사전조사 자료를 불러오지 못했습니다.", code }, { status: 502 });
  }
}
