import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { syncAnalysisBriefToGoogleDrive } from "@/lib/google-workspace-sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;

  const brief = await prisma.analysisBrief.findUnique({
    where: { id },
    include: {
      fieldDay: { select: { id: true, title: true, deletedAt: true } },
      sourceBundle: { select: { id: true, version: true } },
    },
  });

  if (!brief || brief.fieldDay.deletedAt) {
    return NextResponse.json({ error: "분석 브리프를 찾을 수 없습니다." }, { status: 404 });
  }

  const job = await prisma.syncJob.create({
    data: {
      fieldDayId: brief.fieldDayId,
      sourceBundleId: brief.sourceBundleId,
      analysisBriefId: brief.id,
      jobType: "GOOGLE_DRIVE_ANALYSIS_BRIEF_SYNC",
      status: "RUNNING",
      startedAt: new Date(),
      attemptCount: 1,
    },
  });

  try {
    const sync = await syncAnalysisBriefToGoogleDrive({
      projectTitle: brief.fieldDay.title,
      fieldDayId: brief.fieldDayId,
      briefId: brief.id,
      version: brief.version,
      title: brief.title,
      goal: brief.goal,
      researchQuestions: brief.researchQuestions,
      decisionContext: brief.decisionContext,
      evaluationCriteria: brief.evaluationCriteria,
      targetScope: brief.targetScope,
      excludeScope: brief.excludeScope,
      outputType: brief.outputType,
      additionalInstruction: brief.additionalInstruction,
      sourceBundleVersion: brief.sourceBundle?.version ?? null,
      driveFileId: brief.driveFileId,
    });

    const updated = await prisma.analysisBrief.update({
      where: { id: brief.id },
      data: { driveFileId: sync.driveFileId, status: "SYNCED" },
    });

    await prisma.syncJob.update({
      where: { id: job.id },
      data: { status: "SUCCEEDED", completedAt: new Date() },
    });

    return NextResponse.json({
      brief: { ...updated, documentUrl: sync.documentUrl },
      sync,
    });
  } catch (cause) {
    const safeMessage = cause instanceof Error ? cause.message.slice(0, 240) : "GOOGLE_DRIVE_ANALYSIS_BRIEF_SYNC_FAILED";
    await prisma.syncJob.update({
      where: { id: job.id },
      data: { status: "FAILED", errorMessageSafe: safeMessage, completedAt: new Date() },
    });
    console.error("[analysis-briefs] resync failed", cause);
    if (safeMessage.startsWith("MISSING_GATHERLY_GOOGLE_")) {
      return NextResponse.json({ error: "Google Drive 연결 설정이 필요합니다." }, { status: 503 });
    }
    return NextResponse.json({ error: "Analysis Brief Google Docs 동기화에 실패했습니다.", code: safeMessage }, { status: 502 });
  }
}
