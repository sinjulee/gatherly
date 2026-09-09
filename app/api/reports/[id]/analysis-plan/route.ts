import { NextResponse } from "next/server";
import { cleanText } from "@/lib/domain";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const objective = cleanText(body.objective ?? "", 6000);
    const keyQuestions = Array.isArray(body.keyQuestions) ? body.keyQuestions.filter((v: unknown) => typeof v === "string" && v.trim()).slice(0, 30) : [];
    const researchRequirements = Array.isArray(body.researchRequirements) ? body.researchRequirements.filter((v: unknown) => typeof v === "string" && v.trim()).slice(0, 50) : [];
    const proposedSections = Array.isArray(body.proposedSections) ? body.proposedSections.filter((v: unknown) => v && typeof v === "object").slice(0, 40) : [];
    const expectedEvidence = Array.isArray(body.expectedEvidence) ? body.expectedEvidence.filter((v: unknown) => typeof v === "string" && v.trim()).slice(0, 50) : [];
    const risks = Array.isArray(body.risks) ? body.risks.filter((v: unknown) => typeof v === "string" && v.trim()).slice(0, 50) : [];

    const plan = await prisma.reportAnalysisPlan.findUnique({ where: { reportId: id } });
    if (!plan) return NextResponse.json({ error: "분석 계획을 찾을 수 없습니다." }, { status: 404 });

    const updated = await prisma.reportAnalysisPlan.update({
      where: { reportId: id },
      data: {
        objective: objective || null,
        keyQuestions: JSON.stringify(keyQuestions),
        researchRequirements: JSON.stringify(researchRequirements),
        proposedSections: JSON.stringify(proposedSections),
        expectedEvidence: JSON.stringify(expectedEvidence),
        risks: JSON.stringify(risks),
        userApproved: false,
        approvedAt: null,
      },
    });
    return NextResponse.json({ plan: updated });
  } catch (error) {
    console.error("[analysis-plan:patch]", error);
    return NextResponse.json({ error: "분석 계획을 저장하지 못했습니다." }, { status: 400 });
  }
}
