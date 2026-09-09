import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { syncSourceDocumentsToGoogleDrive } from "@/lib/google-workspace-sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const bundle = await prisma.sourceBundle.findUnique({
    where: { id },
    include: { fieldDay: true, sourceDocuments: true },
  });

  if (!bundle) return NextResponse.json({ error: "Source Bundle을 찾을 수 없습니다." }, { status: 404 });
  if (!bundle.sourceDocuments.length) return NextResponse.json({ error: "먼저 NotebookLM Source 문서를 생성해 주세요." }, { status: 400 });

  const job = await prisma.syncJob.create({
    data: { fieldDayId: bundle.fieldDayId, sourceBundleId: bundle.id, jobType: "GOOGLE_DRIVE_SOURCE_SYNC", status: "RUNNING", startedAt: new Date(), attemptCount: 1 },
  });
  await prisma.sourceBundle.update({ where: { id: bundle.id }, data: { status: "SYNCING" } });

  try {
    const result = await syncSourceDocumentsToGoogleDrive({
      projectTitle: bundle.fieldDay.title,
      fieldDayId: bundle.fieldDayId,
      bundleVersion: bundle.version,
      documents: bundle.sourceDocuments.map((doc) => ({ id: doc.id, documentType: doc.documentType, localPath: doc.localPath, driveFileId: doc.driveFileId })),
    });

    await prisma.$transaction([
      ...result.synced.map((item) => prisma.sourceDocument.update({ where: { id: item.sourceDocumentId }, data: { driveFileId: item.driveFileId, syncStatus: "SYNCED", lastSyncedAt: new Date() } })),
      prisma.sourceBundle.update({ where: { id: bundle.id }, data: { status: "SYNCED" } }),
      prisma.material.updateMany({ where: { sourceBundleItems: { some: { sourceBundleId: bundle.id, included: true } } }, data: { reviewStatus: "SYNCED" } }),
      prisma.syncJob.update({ where: { id: job.id }, data: { status: "SUCCEEDED", completedAt: new Date() } }),
    ]);

    return NextResponse.json({ result });
  } catch (cause) {
    const safeMessage = cause instanceof Error ? cause.message.slice(0, 240) : "GOOGLE_DRIVE_SYNC_FAILED";
    await prisma.$transaction([
      prisma.sourceBundle.update({ where: { id: bundle.id }, data: { status: "BUILT" } }),
      prisma.syncJob.update({ where: { id: job.id }, data: { status: "FAILED", errorMessageSafe: safeMessage, completedAt: new Date() } }),
    ]);
    if (safeMessage.startsWith("MISSING_GATHERLY_GOOGLE_")) {
      return NextResponse.json({ error: "Google Drive 연결 설정이 필요합니다." }, { status: 503 });
    }
    return NextResponse.json({ error: "Google Drive 동기화에 실패했습니다.", code: safeMessage }, { status: 502 });
  }
}
