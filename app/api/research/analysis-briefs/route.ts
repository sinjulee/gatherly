import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function cleanText(value: unknown, max = 4000) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
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

  return NextResponse.json({ briefs });
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
      select: { id: true },
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

    return NextResponse.json({ brief }, { status: 201 });
  } catch (cause) {
    console.error("[analysis-briefs] create failed", cause);
    return NextResponse.json({ error: "분석 브리프를 저장하지 못했습니다." }, { status: 500 });
  }
}
