import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const plan = await prisma.reportAnalysisPlan.findUnique({ where: { reportId: id } });
    if (!plan) return NextResponse.json({ error: "분석 계획을 찾을 수 없습니다." }, { status: 404 });

    const result = await prisma.$transaction(async (tx) => {
      const approved = await tx.reportAnalysisPlan.update({
        where: { reportId: id },
        data: { userApproved: true, approvedAt: new Date() },
      });
      await tx.report.update({ where: { id }, data: { status: "PREPARING_EVIDENCE" } });
      const job = await tx.reportJob.create({
        data: { reportId: id, jobType: "GENERATE_REPORT", status: "QUEUED", stage: "PREPARING_EVIDENCE", progress: 0 },
      });
      return { approved, job };
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("[analysis-plan:approve]", error);
    return NextResponse.json({ error: "분석 계획을 승인하지 못했습니다." }, { status: 400 });
  }
}
