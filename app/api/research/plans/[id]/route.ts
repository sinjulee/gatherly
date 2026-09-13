import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cleanResearchText, isResearchPlanStatus, optionalResearchText } from "@/lib/research-plan-domain";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const plan = await prisma.researchPlan.findUnique({
    where: { id },
    include: {
      fieldDay: { select: { id: true, title: true, status: true, deletedAt: true } },
      targets: { orderBy: [{ visitOrder: "asc" }, { createdAt: "asc" }] },
      questions: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] },
      checkpoints: {
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        include: { requiredEvidence: true },
      },
    },
  });

  if (!plan || plan.fieldDay.deletedAt) return NextResponse.json({ error: "Research Plan을 찾을 수 없습니다." }, { status: 404 });
  return NextResponse.json({ plan });
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = await request.json();
    const existing = await prisma.researchPlan.findUnique({ where: { id }, include: { fieldDay: { select: { deletedAt: true } } } });
    if (!existing || existing.fieldDay.deletedAt) return NextResponse.json({ error: "Research Plan을 찾을 수 없습니다." }, { status: 404 });
    if (existing.status === "CLOSED" || existing.status === "ARCHIVED") {
      return NextResponse.json({ error: "종료되거나 보관된 Research Plan은 수정할 수 없습니다." }, { status: 409 });
    }

    const data: Record<string, unknown> = {};
    if (body.title !== undefined) {
      const title = cleanResearchText(body.title, 180);
      if (!title) return NextResponse.json({ error: "Plan 제목을 입력해 주세요." }, { status: 400 });
      data.title = title;
    }
    if (body.objective !== undefined) {
      const objective = cleanResearchText(body.objective, 4000);
      if (!objective) return NextResponse.json({ error: "조사 목적을 입력해 주세요." }, { status: 400 });
      data.objective = objective;
    }
    if (body.background !== undefined) data.background = optionalResearchText(body.background, 8000);
    if (body.visitPurpose !== undefined) data.visitPurpose = optionalResearchText(body.visitPurpose, 4000);
    if (body.decisionContext !== undefined) data.decisionContext = optionalResearchText(body.decisionContext, 4000);
    if (body.targetScope !== undefined) data.targetScope = optionalResearchText(body.targetScope, 4000);
    if (body.successCriteria !== undefined) data.successCriteria = optionalResearchText(body.successCriteria, 4000);
    if (body.preResearchText !== undefined) data.preResearchText = optionalResearchText(body.preResearchText, 30000);
    if (body.status !== undefined) {
      if (!isResearchPlanStatus(body.status) || body.status === "ACTIVE") {
        return NextResponse.json({ error: "ACTIVE 전환은 활성화 기능을 사용해 주세요." }, { status: 400 });
      }
      data.status = body.status;
      if (body.status === "CLOSED") data.closedAt = new Date();
      if (body.status === "ARCHIVED") data.isActive = false;
    }

    const plan = await prisma.researchPlan.update({ where: { id }, data });
    return NextResponse.json({ plan });
  } catch {
    return NextResponse.json({ error: "Research Plan을 수정하지 못했습니다." }, { status: 400 });
  }
}
