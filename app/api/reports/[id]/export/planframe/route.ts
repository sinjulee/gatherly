import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { makePlanFrameIdempotencyKey } from "@/lib/report-structured-result";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const endpoint = process.env.PLANFRAME_GATHERLY_ENDPOINT?.trim();
  if (!endpoint) return NextResponse.json({ error: "PLANFRAME_GATHERLY_ENDPOINT가 설정되지 않았습니다." }, { status: 503 });

  try {
    const body = await request.json().catch(() => ({}));
    const requestedVersion = Number.isInteger(body.report_version) ? Number(body.report_version) : null;

    const report = await prisma.report.findUnique({
      where: { id },
      include: { fieldDay: true },
    });
    if (!report) return NextResponse.json({ error: "보고서를 찾을 수 없습니다." }, { status: 404 });

    const version = await prisma.reportVersion.findFirst({
      where: { reportId: id, ...(requestedVersion ? { reportVersion: requestedVersion } : {}) },
      orderBy: { reportVersion: "desc" },
    });
    if (!version) return NextResponse.json({ error: "전송할 보고서 버전을 찾을 수 없습니다." }, { status: 404 });
    if (version.status !== "FINAL") return NextResponse.json({ error: "FINAL 버전만 PlanFrame으로 전송할 수 있습니다." }, { status: 409 });
    if (!version.structuredResult) return NextResponse.json({ error: "structured_result가 없는 버전은 전송할 수 없습니다." }, { status: 409 });

    const idempotencyKey = makePlanFrameIdempotencyKey(report.id, version.reportVersion);
    const existing = await prisma.reportIntegrationDelivery.findUnique({ where: { idempotencyKey } });
    if (existing?.status === "SUCCESS") {
      return NextResponse.json({ delivery: existing, idempotent: true });
    }

    const payload = {
      source_system: "gatherly",
      schema_version: version.structuredSchemaVersion,
      report_id: report.id,
      report_version: version.reportVersion,
      report_version_id: version.id,
      title: report.title,
      status: version.status,
      field_day: report.fieldDay ? {
        id: report.fieldDay.id,
        title: report.fieldDay.title,
        location: report.fieldDay.location,
        field_date: report.fieldDay.fieldDate.toISOString(),
      } : null,
      structured_result: JSON.parse(version.structuredResult),
    };

    const payloadText = JSON.stringify(payload);
    const payloadHash = crypto.createHash("sha256").update(payloadText).digest("hex");

    const delivery = existing
      ? await prisma.reportIntegrationDelivery.update({
          where: { id: existing.id },
          data: { status: "SENDING", attempt: { increment: 1 }, payloadHash, errorCode: null, errorMessage: null },
        })
      : await prisma.reportIntegrationDelivery.create({
          data: {
            reportId: report.id,
            reportVersionId: version.id,
            destination: "PLANFRAME",
            idempotencyKey,
            status: "SENDING",
            attempt: 1,
            payloadHash,
          },
        });

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-idempotency-key": idempotencyKey,
        ...(process.env.PLANFRAME_GATHERLY_TOKEN ? { authorization: `Bearer ${process.env.PLANFRAME_GATHERLY_TOKEN}` } : {}),
      },
      body: payloadText,
      signal: AbortSignal.timeout(15000),
    });

    const responseBody = await response.json().catch(() => ({}));
    if (!response.ok) {
      const failed = await prisma.reportIntegrationDelivery.update({
        where: { id: delivery.id },
        data: {
          status: "FAILED",
          httpStatus: response.status,
          errorCode: typeof responseBody?.code === "string" ? responseBody.code : "PLANFRAME_HTTP_ERROR",
          errorMessage: typeof responseBody?.error === "string" ? responseBody.error : `PlanFrame 응답 오류 (${response.status})`,
        },
      });
      return NextResponse.json({ error: failed.errorMessage, delivery: failed }, { status: 502 });
    }

    const success = await prisma.reportIntegrationDelivery.update({
      where: { id: delivery.id },
      data: {
        status: "SUCCESS",
        httpStatus: response.status,
        externalReportId: typeof responseBody?.report_id === "string" ? responseBody.report_id : null,
        sentAt: new Date(),
      },
    });

    return NextResponse.json({ delivery: success, planframe: responseBody });
  } catch (error) {
    const message = error instanceof Error ? error.message : "PlanFrame 전송에 실패했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
