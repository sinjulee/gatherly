import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const SOURCE_TYPES = new Set(["NOTEBOOK_RESEARCH", "VISIT_PLAN", "CHECKLIST", "INTERNAL_DOC", "OTHER"]);

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = await request.json();
    const data: { selectedForPlan?: boolean; sourceType?: string } = {};

    if (typeof body.selectedForPlan === "boolean") data.selectedForPlan = body.selectedForPlan;
    if (typeof body.sourceType === "string") {
      const sourceType = body.sourceType.trim().toUpperCase();
      if (!SOURCE_TYPES.has(sourceType)) return NextResponse.json({ error: "올바른 사전조사 자료 유형을 선택해 주세요." }, { status: 400 });
      data.sourceType = sourceType;
    }
    if (!Object.keys(data).length) return NextResponse.json({ error: "수정할 항목이 없습니다." }, { status: 400 });

    const existing = await prisma.preResearchSource.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "사전조사 자료를 찾을 수 없습니다." }, { status: 404 });

    const source = await prisma.preResearchSource.update({ where: { id }, data });
    return NextResponse.json({ source });
  } catch {
    return NextResponse.json({ error: "사전조사 자료 설정을 수정하지 못했습니다." }, { status: 400 });
  }
}
