import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cleanResearchText, isResearchPriority, optionalResearchText } from "@/lib/research-plan-domain";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id: researchPlanId } = await context.params;
    const body = await request.json();
    const title = cleanResearchText(body.title, 500);
    if (!title) return NextResponse.json({ error: "체크사항을 입력해 주세요." }, { status: 400 });

    const plan = await prisma.researchPlan.findUnique({ where: { id: researchPlanId } });
    if (!plan) return NextResponse.json({ error: "Research Plan을 찾을 수 없습니다." }, { status: 404 });
    if (plan.status === "CLOSED" || plan.status === "ARCHIVED") return NextResponse.json({ error: "종료되거나 보관된 Plan에는 체크사항을 추가할 수 없습니다." }, { status: 409 });

    let targetId: string | null = null;
    if (typeof body.targetId === "string" && body.targetId.trim()) {
      const target = await prisma.researchTarget.findFirst({ where: { id: body.targetId.trim(), researchPlanId }, select: { id: true } });
      if (!target) return NextResponse.json({ error: "같은 Research Plan의 방문 대상을 선택해 주세요." }, { status: 400 });
      targetId = target.id;
    }

    let researchQuestionId: string | null = null;
    if (typeof body.researchQuestionId === "string" && body.researchQuestionId.trim()) {
      const question = await prisma.researchQuestion.findFirst({ where: { id: body.researchQuestionId.trim(), researchPlanId }, select: { id: true } });
      if (!question) return NextResponse.json({ error: "같은 Research Plan의 조사 질문을 선택해 주세요." }, { status: 400 });
      researchQuestionId = question.id;
    }

    const maxOrder = await prisma.researchCheckpoint.aggregate({ where: { researchPlanId }, _max: { sortOrder: true } });
    const checkpoint = await prisma.researchCheckpoint.create({
      data: {
        researchPlanId,
        targetId,
        researchQuestionId,
        title,
        description: optionalResearchText(body.description, 4000),
        priority: isResearchPriority(body.priority) ? body.priority : "P2",
        evidenceRequirement: optionalResearchText(body.evidenceRequirement, 2000),
        sortOrder: Number.isInteger(body.sortOrder) ? body.sortOrder : (maxOrder._max.sortOrder ?? -1) + 1,
      },
    });

    return NextResponse.json({ checkpoint }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "체크사항을 추가하지 못했습니다." }, { status: 400 });
  }
}
