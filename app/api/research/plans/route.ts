import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cleanResearchText, optionalResearchText } from "@/lib/research-plan-domain";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const fieldDayId = searchParams.get("fieldDayId")?.trim();
  if (!fieldDayId) return NextResponse.json({ error: "현장을 선택해 주세요." }, { status: 400 });

  const fieldDay = await prisma.fieldDay.findFirst({ where: { id: fieldDayId, deletedAt: null }, select: { id: true } });
  if (!fieldDay) return NextResponse.json({ error: "현장을 찾을 수 없습니다." }, { status: 404 });

  const plans = await prisma.researchPlan.findMany({
    where: { fieldDayId },
    orderBy: { version: "desc" },
    include: {
      _count: { select: { targets: true, questions: true, checkpoints: true } },
    },
  });

  return NextResponse.json({ plans });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const fieldDayId = cleanResearchText(body.fieldDayId, 120);
    const title = cleanResearchText(body.title, 180);
    const objective = cleanResearchText(body.objective, 4000);

    if (!fieldDayId) return NextResponse.json({ error: "현장을 선택해 주세요." }, { status: 400 });
    if (!objective) return NextResponse.json({ error: "조사 목적을 입력해 주세요." }, { status: 400 });

    const created = await prisma.$transaction(async (tx) => {
      const fieldDay = await tx.fieldDay.findFirst({ where: { id: fieldDayId, deletedAt: null } });
      if (!fieldDay) throw new Error("FIELD_DAY_NOT_FOUND");

      const latest = await tx.researchPlan.findFirst({
        where: { fieldDayId },
        orderBy: { version: "desc" },
        select: { version: true },
      });
      const version = (latest?.version ?? 0) + 1;

      return tx.researchPlan.create({
        data: {
          fieldDayId,
          version,
          title: title || `${fieldDay.title} Research Plan v${version}`,
          objective,
          background: optionalResearchText(body.background, 8000),
          visitPurpose: optionalResearchText(body.visitPurpose, 4000),
          decisionContext: optionalResearchText(body.decisionContext, 4000),
          targetScope: optionalResearchText(body.targetScope, 4000),
          successCriteria: optionalResearchText(body.successCriteria, 4000),
          preResearchText: optionalResearchText(body.preResearchText, 30000),
          generatedByAi: body.generatedByAi === true,
          status: "DRAFT",
          isActive: false,
        },
      });
    });

    return NextResponse.json({ plan: created }, { status: 201 });
  } catch (cause) {
    if (cause instanceof Error && cause.message === "FIELD_DAY_NOT_FOUND") {
      return NextResponse.json({ error: "현장을 찾을 수 없습니다." }, { status: 404 });
    }
    return NextResponse.json({ error: "Research Plan을 생성하지 못했습니다." }, { status: 400 });
  }
}
