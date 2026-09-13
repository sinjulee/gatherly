import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cleanResearchText, isResearchPriority, isResearchTargetType, optionalResearchText } from "@/lib/research-plan-domain";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id: researchPlanId } = await context.params;
    const body = await request.json();
    const name = cleanResearchText(body.name, 180);
    if (!name) return NextResponse.json({ error: "방문 대상 이름을 입력해 주세요." }, { status: 400 });

    const plan = await prisma.researchPlan.findUnique({ where: { id: researchPlanId } });
    if (!plan) return NextResponse.json({ error: "Research Plan을 찾을 수 없습니다." }, { status: 404 });
    if (plan.status === "CLOSED" || plan.status === "ARCHIVED") return NextResponse.json({ error: "종료되거나 보관된 Plan에는 대상을 추가할 수 없습니다." }, { status: 409 });

    const type = isResearchTargetType(body.type) ? body.type : "OTHER";
    const priority = isResearchPriority(body.priority) ? body.priority : "P2";
    const maxOrder = await prisma.researchTarget.aggregate({ where: { researchPlanId }, _max: { visitOrder: true } });

    const target = await prisma.researchTarget.create({
      data: {
        researchPlanId,
        name,
        type,
        boothNo: optionalResearchText(body.boothNo, 80),
        locationHint: optionalResearchText(body.locationHint, 240),
        description: optionalResearchText(body.description, 4000),
        priority,
        visitOrder: Number.isInteger(body.visitOrder) ? body.visitOrder : (maxOrder._max.visitOrder ?? -1) + 1,
      },
    });

    return NextResponse.json({ target }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "방문 대상을 추가하지 못했습니다." }, { status: 400 });
  }
}
