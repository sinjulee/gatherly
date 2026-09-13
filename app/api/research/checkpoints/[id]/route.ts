import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cleanResearchText, isResearchCheckpointStatus, isResearchPriority, optionalResearchText } from "@/lib/research-plan-domain";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = await request.json();
    const existing = await prisma.researchCheckpoint.findUnique({ where: { id }, include: { researchPlan: true } });
    if (!existing) return NextResponse.json({ error: "체크사항을 찾을 수 없습니다." }, { status: 404 });
    if (existing.researchPlan.status === "CLOSED" || existing.researchPlan.status === "ARCHIVED") return NextResponse.json({ error: "종료되거나 보관된 Plan은 수정할 수 없습니다." }, { status: 409 });

    const data: Record<string, unknown> = {};
    if (body.title !== undefined) {
      const title = cleanResearchText(body.title, 500);
      if (!title) return NextResponse.json({ error: "체크사항을 입력해 주세요." }, { status: 400 });
      data.title = title;
    }
    if (body.description !== undefined) data.description = optionalResearchText(body.description, 4000);
    if (body.evidenceRequirement !== undefined) data.evidenceRequirement = optionalResearchText(body.evidenceRequirement, 2000);
    if (body.completionNote !== undefined) data.completionNote = optionalResearchText(body.completionNote, 4000);
    if (body.priority !== undefined) {
      if (!isResearchPriority(body.priority)) return NextResponse.json({ error: "올바른 우선순위를 선택해 주세요." }, { status: 400 });
      data.priority = body.priority;
    }
    if (body.status !== undefined) {
      if (!isResearchCheckpointStatus(body.status)) return NextResponse.json({ error: "올바른 체크 상태를 선택해 주세요." }, { status: 400 });
      data.status = body.status;
    }
    if (body.sortOrder !== undefined) {
      if (!Number.isInteger(body.sortOrder) || body.sortOrder < 0) return NextResponse.json({ error: "정렬 순서는 0 이상의 정수여야 합니다." }, { status: 400 });
      data.sortOrder = body.sortOrder;
    }
    if (body.targetId !== undefined) {
      if (body.targetId === null || body.targetId === "") data.targetId = null;
      else {
        const target = await prisma.researchTarget.findFirst({ where: { id: String(body.targetId), researchPlanId: existing.researchPlanId }, select: { id: true } });
        if (!target) return NextResponse.json({ error: "같은 Research Plan의 방문 대상을 선택해 주세요." }, { status: 400 });
        data.targetId = target.id;
      }
    }
    if (body.researchQuestionId !== undefined) {
      if (body.researchQuestionId === null || body.researchQuestionId === "") data.researchQuestionId = null;
      else {
        const question = await prisma.researchQuestion.findFirst({ where: { id: String(body.researchQuestionId), researchPlanId: existing.researchPlanId }, select: { id: true } });
        if (!question) return NextResponse.json({ error: "같은 Research Plan의 조사 질문을 선택해 주세요." }, { status: 400 });
        data.researchQuestionId = question.id;
      }
    }

    const checkpoint = await prisma.researchCheckpoint.update({ where: { id }, data });
    return NextResponse.json({ checkpoint });
  } catch {
    return NextResponse.json({ error: "체크사항을 수정하지 못했습니다." }, { status: 400 });
  }
}
