import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_request: Request, context: RouteContext) {
  const { id } = await context.params;

  const report = await prisma.report.findUnique({ where: { id } });
  if (!report) return NextResponse.json({ error: "보고서를 찾을 수 없습니다." }, { status: 404 });
  if (!report.content || !report.structuredResult) {
    return NextResponse.json({ error: "본문과 structured_result가 생성된 보고서만 최종 확정할 수 있습니다." }, { status: 409 });
  }
  if (report.status === "FINAL") {
    const version = await prisma.reportVersion.findFirst({
      where: { reportId: report.id, status: "FINAL" },
      orderBy: { reportVersion: "desc" },
    });
    return NextResponse.json({ report, version, idempotent: true });
  }

  const sourceVersion = await prisma.reportVersion.findUnique({
    where: { reportId_reportVersion: { reportId: report.id, reportVersion: report.reportVersion } },
  });
  if (!sourceVersion) {
    return NextResponse.json({ error: "최종 확정할 보고서 스냅샷을 찾을 수 없습니다." }, { status: 409 });
  }

  const nextVersion = report.reportVersion + 1;
  const saved = await prisma.$transaction(async (tx) => {
    const version = await tx.reportVersion.create({
      data: {
        reportId: report.id,
        reportVersion: nextVersion,
        versionType: "FINAL",
        status: "FINAL",
        title: report.title,
        content: sourceVersion.content ?? report.content,
        structuredResult: sourceVersion.structuredResult ?? report.structuredResult,
        structuredSchemaVersion: sourceVersion.structuredSchemaVersion,
        createdBy: "USER",
      },
    });

    const updatedReport = await tx.report.update({
      where: { id: report.id },
      data: {
        reportVersion: nextVersion,
        status: "FINAL",
        content: version.content,
        structuredResult: version.structuredResult,
        structuredSchemaVersion: version.structuredSchemaVersion,
        completedAt: new Date(),
      },
    });

    return { version, report: updatedReport };
  });

  return NextResponse.json({
    report: saved.report,
    report_version_id: saved.version.id,
    report_version: saved.version.reportVersion,
    status: saved.version.status,
  });
}
