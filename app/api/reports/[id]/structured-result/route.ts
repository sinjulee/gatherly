import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { GATHERLY_REPORT_SCHEMA_VERSION, parseStructuredResult } from "@/lib/report-structured-result";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const report = await prisma.report.findUnique({
    where: { id },
    include: { versions: { orderBy: { reportVersion: "desc" } } },
  });
  if (!report) return NextResponse.json({ error: "보고서를 찾을 수 없습니다." }, { status: 404 });

  return NextResponse.json({
    report_id: report.id,
    report_version: report.reportVersion,
    schema_version: report.structuredSchemaVersion,
    structured_result: report.structuredResult ? JSON.parse(report.structuredResult) : null,
    versions: report.versions.map((version) => ({
      id: version.id,
      report_version: version.reportVersion,
      version_type: version.versionType,
      status: version.status,
      schema_version: version.structuredSchemaVersion,
      created_by: version.createdBy,
      created_at: version.createdAt,
    })),
  });
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = await request.json();
    const structuredResult = parseStructuredResult(body.structured_result);
    const content = typeof body.content === "string" ? body.content : null;
    const versionType = typeof body.version_type === "string" ? body.version_type : "AI_DRAFT";
    const status = body.status === "FINAL" ? "FINAL" : "DRAFT";
    const createdBy = typeof body.created_by === "string" ? body.created_by : "AI";

    const report = await prisma.report.findUnique({ where: { id } });
    if (!report) return NextResponse.json({ error: "보고서를 찾을 수 없습니다." }, { status: 404 });

    const nextVersion = report.reportVersion + 1;
    const serialized = JSON.stringify(structuredResult);

    const saved = await prisma.$transaction(async (tx) => {
      const version = await tx.reportVersion.create({
        data: {
          reportId: report.id,
          reportVersion: nextVersion,
          versionType,
          status,
          content,
          structuredResult: serialized,
          structuredSchemaVersion: GATHERLY_REPORT_SCHEMA_VERSION,
          createdBy,
        },
      });

      const updatedReport = await tx.report.update({
        where: { id: report.id },
        data: {
          reportVersion: nextVersion,
          structuredResult: serialized,
          structuredSchemaVersion: GATHERLY_REPORT_SCHEMA_VERSION,
          content: content ?? report.content,
          status: status === "FINAL" ? "FINAL" : report.status,
        },
      });

      return { version, updatedReport };
    });

    return NextResponse.json({
      report_id: saved.updatedReport.id,
      report_version: saved.version.reportVersion,
      report_version_id: saved.version.id,
      schema_version: saved.version.structuredSchemaVersion,
      status: saved.version.status,
      structured_result: structuredResult,
    }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "구조화 결과를 저장하지 못했습니다.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
