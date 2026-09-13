import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isRequiredEvidenceType, optionalResearchText } from "@/lib/research-plan-domain";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = await request.json();
    const existing = await prisma.requiredEvidence.findUnique({ where: { id }, include: { checkpoint: { include: { researchPlan: true } } } });
    if (!existing) return NextResponse.json({ error: "Evidence 조건을 찾을 수 없습니다." }, { status: 404 });
    if (existing.checkpoint.researchPlan.status === "CLOSED" || existing.checkpoint.researchPlan.status === "ARCHIVED") return NextResponse.json({ error: "종료되거나 보관된 Plan은 수정할 수 없습니다." }, { status: 409 });

    const data: Record<string, unknown> = {};
    if (body.evidenceType !== undefined) {
      if (!isRequiredEvidenceType(body.evidenceType)) return NextResponse.json({ error: "올바른 Evidence 유형을 선택해 주세요." }, { status: 400 });
      data.evidenceType = body.evidenceType;
    }
    if (body.minimumCount !== undefined) {
      if (!Number.isInteger(body.minimumCount) || body.minimumCount < 1) return NextResponse.json({ error: "최소 수량은 1 이상의 정수여야 합니다." }, { status: 400 });
      data.minimumCount = body.minimumCount;
    }
    if (body.requireText !== undefined) data.requireText = body.requireText === true;
    if (body.requireFile !== undefined) data.requireFile = body.requireFile === true;
    if (body.description !== undefined) data.description = optionalResearchText(body.description, 2000);

    const requirement = await prisma.requiredEvidence.update({ where: { id }, data });
    return NextResponse.json({ requirement });
  } catch {
    return NextResponse.json({ error: "Evidence 조건을 수정하지 못했습니다." }, { status: 400 });
  }
}
