import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { syncAnalysisBriefToGoogleDrive } from "@/lib/google-workspace-sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function cleanText(value: unknown, max = 4000) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function documentUrl(driveFileId: string | null) {
  return driveFileId ? `https://docs.google.com/document/d/${driveFileId}/edit` : null;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const fieldDayId = searchParams.get("fieldDayId")?.trim();

  if (!fieldDayId) {
    return NextResponse.json({ error: "현장을 선택해 주세요." }, { status: 400 });
  }

  const briefs = await prisma.analysisBrief.findMany({
    where: { fieldDayId },
    orderBy: { version: "desc" },
    include: {
      sourceBundle: {
        select: { id: true, version: true, title: true, status: true },
      },
    },
  });

  return NextResponse.json({
    briefs: briefs.map((brief) => ({ ...brief, documentUrl: documentUrl(brief.driveFileId) })),
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const fieldDayId = cleanText(body.fieldDayId, 100);
    const goal = cleanText(body.goal, 4000);
    const title = cleanText(body.title, 180) || goal.slice(0, 80) || "분석 브리프";
    const researchQuestions = cleanText(body.researchQuestions, 5000) || null;
    const decisionContext = cleanText(body.decisionContext, 4000) || null;
    const evaluationCriteria = cleanText(body.evaluationCriteria, 4000) || null;
    const targetScope = cleanText(body.targetScope, 3000) || null;
    const excludeScope = cleanText(body.excludeScope, 3000) || null;
    const outputType = cleanText(body.outputType, 120) || "REPORT";
    const additionalInstruction = cleanText(body.additionalInstruction, 5000) || null;
    const requestedBundleId = cleanText(body.sourceBundleId, 100) || null;

    if (!fieldDayId || !goal) {
      return NextResponse.json({ error: "현장과 분석 방향은 필수입니다." }, { status: 400 });
    }

    const project = await prisma.fieldDay.findFirst({
      where: { id: fieldDayId, deletedAt: null },
      select: { id: true, title: true },
    });

    if (!project) {
      return NextResponse.json({ error: "현장을 찾을 수 없습니다." }, { status: 404 });
    }

    const sourceBundle = requestedBundleId
      ? await prisma.sourceBundle.findFirst({
          where: { id: requestedBundleId, fieldDayId },
          select: { id: true, version: true, status: true },
        })
      : await prisma.sourceBundle.findFirst({
          where: { fieldDayId, status: { in: ["SYNCED", "BUILT"] } },
          orderBy: { version: "desc" },
          select: { id: true, version: true, status: true },
        });

    const latest = await prisma.analysisBrief.findFirst({
      where: { fieldDayId },
      orderBy: { version: "desc" },
      select: { version: true },
    });

    const brief = await prisma.analysisBrief.create({
      data: {
        fieldDayId,
        sourceBundleId: sourceBundle?.id ?? null,
        version: (latest?.version ?? 0) + 1,
        title,
        goal,
        researchQuestions,
        decisionContext,
        evaluationCriteria,
        targetScope,
        excludeScope,
        outputType,
        additionalInstruction,
        status: "READY",
      },
      include: {
        sourceBundle: {
          select: { id: true, version: true, title: true, status: true },
        },
      },
    });

    const job = await prisma.syncJob.create({
      data: {
        fieldDayId,
        sourceBundleId: sourceBundle?.id ?? null,
        analysisBriefId: brief.id,
        jobType: "GOOGLE_DRIVE_ANALYSIS_BRIEF_SYNC",
        status: "RUNNING",
        startedAt: new Date(),
        attemptCount: 1,
      },
    });

    try {
      const sync = await syncAnalysisBriefToGoogleDrive({
        projectTitle: project.title,
        fieldDayId,
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

      const syncedBrief = await prisma.analysisBrief.update({
        where: { id: brief.id },
        data: { driveFileId: sync.driveFileId, status: "SYNCED" },
        include: {
          sourceBundle: {
            select: { id: true, version: true, title: true, status: true },
          },
        },
      });

      await prisma.syncJob.update({
        where: { id: job.id },
        data: { status: "SUCCEEDED", completedAt: new Date() },
      });

      return NextResponse.json({ brief: { ...syncedBrief, documentUrl: sync.documentUrl }, sync }, { status: 201 });
    } catch (cause) {
      const safeMessage = cause instanceof Error ? cause.message.slice(0, 240) : "GOOGLE_DRIVE_ANALYSIS_BRIEF_SYNC_FAILED";
      await prisma.syncJob.update({
        where: { id: job.id },
        data: { status: "FAILED", errorMessageSafe: safeMessage, completedAt: new Date() },
      });
      console.error("[analysis-briefs] Google Docs sync failed", cause);
      return NextResponse.json({
        brief: { ...brief, documentUrl: null },
        warning: "분석 브리프는 저장했지만 Google Docs 동기화에는 실패했습니다.",
        syncErrorCode: safeMessage,
      }, { status: 201 });
    }
  } catch (cause) {
    console.error("[analysis-briefs] create failed", cause);
    return NextResponse.json({ error: "분석 브리프를 저장하지 못했습니다." }, { status: 500 });
  }
}
