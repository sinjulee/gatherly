import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cleanResearchText, isResearchPriority, isResearchTargetType, isResearchVisitStatus, optionalResearchText } from "@/lib/research-plan-domain";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = await request.json();
    const target = await prisma.researchTarget.findUnique({ where: { id }, include: { researchPlan: true } });
    if (!target) return NextResponse.json({ error: "방문 대상을 찾을 수 없습니다." }, { status: 404 });
    if (target.researchPlan.status === "CLOSED" || target.researchPlan.status === "ARCHIVED") return NextResponse.json({ error: "종료되거나 보관된 Plan은 수정할 수 없습니다." }, { status: 409 });

    const data: Record<string, unknown> = {};
    if (body.name !== undefined) {
      const name = cleanResearchText(body.name, 180);
      if (!name) return NextResponse.json({ error: "방문 대상 이름을 입력해 주세요." }, { status: 400 });
      data.name = name;
    }
    if (body.type !== undefined) {
      if (!isResearchTargetType(body.type)) return NextResponse.json({ error: "올바른 대상 유형을 선택해 주세요." }, { status: 400 });
      data.type = body.type;
    }
    if (body.priority !== undefined) {
      if (!isResearchPriority(body.priority)) return NextResponse.json({ error: "올바른 우선순위를 선택해 주세요." }, { status: 400 });
      data.priority = body.priority;
    }
    if (body.visitStatus !== undefined) {
      if (!isResearchVisitStatus(body.visitStatus)) return NextResponse.json({ error: "올바른 방문 상태를 선택해 주세요." }, { status: 400 });
      data.visitStatus = body.visitStatus;
      if (body.visitStatus === "VISITING" && !target.startedAt) data.startedAt = new Date();
      if (body.visitStatus === "COMPLETED") data.completedAt = new Date();
    }
    if (body.boothNo !== undefined) data.boothNo = optionalResearchText(body.boothNo, 80);
    if (body.locationHint !== undefined) data.locationHint = optionalResearchText(body.locationHint, 240);
    if (body.description !== undefined) data.description = optionalResearchText(body.description, 4000);
    if (body.visitOrder !== undefined) {
      if (!Number.isInteger(body.visitOrder) || body.visitOrder < 0) return NextResponse.json({ error: "방문 순서는 0 이상의 정수여야 합니다." }, { status: 400 });
      data.visitOrder = body.visitOrder;
    }

    const updated = await prisma.researchTarget.update({ where: { id }, data });
    return NextResponse.json({ target: updated });
  } catch {
    return NextResponse.json({ error: "방문 대상을 수정하지 못했습니다." }, { status: 400 });
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const target = await prisma.researchTarget.findUnique({ where: { id }, include: { researchPlan: true } });
  if (!target) return NextResponse.json({ error: "방문 대상을 찾을 수 없습니다." }, { status: 404 });
  if (target.researchPlan.status === "ACTIVE") return NextResponse.json({ error: "활성 Plan의 방문 대상은 삭제 대신 SKIPPED 상태를 사용해 주세요." }, { status: 409 });
  await prisma.researchTarget.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
