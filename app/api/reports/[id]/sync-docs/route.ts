import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { syncFinalReportToGoogleDocs } from "@/lib/final-report-google-sync";

export async function POST(_: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const report = await prisma.report.findUnique({ where: { id }, include: { fieldDay: true } });
  if (!report?.fieldDay || !report.content) return NextResponse.json({ error: "완료된 보고서를 찾을 수 없습니다." }, { status: 404 });
  try {
    const result = await syncFinalReportToGoogleDocs({
      projectTitle: report.fieldDay.title,
      fieldDayId: report.fieldDay.id,
      title: report.title,
      version: report.version,
      content: report.content,
      googleDocId: report.googleDocId,
    });
    const updated = await prisma.report.update({ where: { id }, data: { googleDocId: result.googleDocId } });
    return NextResponse.json({ report: updated, ...result });
  } catch (cause) {
    const error = cause instanceof Error ? cause.message : "GOOGLE_DOC_SYNC_FAILED";
    return NextResponse.json({ error }, { status: 500 });
  }
}
