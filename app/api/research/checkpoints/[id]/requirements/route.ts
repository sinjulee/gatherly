import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isRequiredEvidenceType, optionalResearchText } from "@/lib/research-plan-domain";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id: checkpointId } = await context.params;
    const body = await request.json();
    const checkpoint = await prisma.researchCheckpoint.findUnique({ where: { id: checkpointId }, include: { researchPlan: true } });
    if (!checkpoint) return NextResponse.json({ error: "체크사항을 찾을 수 없습니다." }, { status: 404 });
    if (checkpoint.researchPlan.status === "CLOSED" || checkpoint.researchPlan.status === "ARCHIVED") return NextResponse.json({ error: "종료되거나 보관된 Plan에는 Evidence 조건을 추가할 수 없습니다." }, { status: 409 });

    const evidenceType = isRequiredEvidenceType(body.evidenceType) ? body.evidenceType : "ANY";
    const minimumCount = Number.isInteger(body.minimumCount) && body.minimumCount > 0 ? body.minimumCount : 1;

    const requirement = await prisma.requiredEvidence.create({
      data: {
        checkpointId,
        evidenceType,
        minimumCount,
        requireText: body.requireText === true,
        requireFile: body.requireFile === true,
        description: optionalResearchText(body.description, 2000),
      },
    });

    return NextResponse.json({ requirement }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Evidence 조건을 추가하지 못했습니다." }, { status: 400 });
  }
}
