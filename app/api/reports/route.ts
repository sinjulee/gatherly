import { NextResponse } from "next/server";
import { cleanText, isReportTemplate } from "@/lib/domain";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const reports = await prisma.report.findMany({
    where: { deletedAt: null },
    orderBy: { updatedAt: "desc" },
    include: {
      fieldDay: { select: { id: true, title: true, fieldDate: true } },
      _count: { select: { materials: true, questions: true, versions: true } },
    },
  });
  return NextResponse.json({ reports });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const fieldDayId = cleanText(body.fieldDayId, 100);
    const title = cleanText(body.title ?? "", 160);
    const analysisDirection = cleanText(body.analysisDirection, 6000);
    const purpose = cleanText(body.purpose ?? "", 500);
    const audience = cleanText(body.audience ?? "", 500);
    const templateType = body.templateType || "CUSTOM";
    const scope = body.scope && typeof body.scope === "object" ? JSON.stringify(body.scope) : null;
    const materialIds = Array.isArray(body.materialIds) ? body.materialIds.filter((value: unknown) => typeof value === "string") : [];
    const questions = Array.isArray(body.questions)
      ? body.questions.map((value: unknown) => cleanText(value, 800)).filter(Boolean)
      : [];

    if (!fieldDayId) return NextResponse.json({ error: "현장을 선택해 주세요." }, { status: 400 });
    if (!analysisDirection || analysisDirection.length < 10) return NextResponse.json({ error: "분석 방향을 10자 이상 입력해 주세요." }, { status: 400 });
    if (!isReportTemplate(templateType)) return NextResponse.json({ error: "올바른 분석 유형을 선택해 주세요." }, { status: 400 });
    if (materialIds.length === 0) return NextResponse.json({ error: "보고서에 사용할 자료를 하나 이상 선택해 주세요." }, { status: 400 });

    const fieldDay = await prisma.fieldDay.findFirst({ where: { id: fieldDayId, deletedAt: null } });
    if (!fieldDay) return NextResponse.json({ error: "선택한 현장을 찾을 수 없습니다." }, { status: 404 });

    const validMaterials = await prisma.material.findMany({
      where: { id: { in: materialIds }, fieldDayId, deletedAt: null, uploadStatus: "STORED" },
      select: { id: true },
    });
    if (validMaterials.length !== materialIds.length) return NextResponse.json({ error: "선택한 자료 중 사용할 수 없는 항목이 있습니다." }, { status: 400 });

    const report = await prisma.$transaction(async (tx) => {
      const created = await tx.report.create({
        data: {
          fieldDayId,
          title: title || `${fieldDay.title} 보고서`,
          templateType,
          analysisDirection,
          purpose: purpose || null,
          audience: audience || null,
          scope,
          status: "DRAFT",
          materials: { create: validMaterials.map(({ id }) => ({ materialId: id, selected: true })) },
          questions: { create: questions.map((question, index) => ({ question: question!, order: index })) },
        },
      });

      await tx.reportJob.create({
        data: {
          reportId: created.id,
          jobType: "GENERATE_PLAN",
          status: "QUEUED",
          stage: "ANALYSIS_PLAN",
          progress: 0,
        },
      });

      return created;
    });

    return NextResponse.json({ report }, { status: 201 });
  } catch (error) {
    console.error("[reports:post]", error);
    return NextResponse.json({ error: "보고서 프로젝트를 만들지 못했습니다." }, { status: 400 });
  }
}
