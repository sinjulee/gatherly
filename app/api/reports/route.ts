import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const fieldDayId = request.nextUrl.searchParams.get("fieldDayId")?.trim();
  const reports = await prisma.report.findMany({
    where: fieldDayId ? { fieldDayId } : undefined,
    orderBy: { createdAt: "desc" },
    take: 30,
    include: { fieldDay: { select: { id: true, title: true } } },
  });
  return NextResponse.json({ reports });
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const fieldDayId = String(body.fieldDayId || "").trim();
  const title = String(body.title || "").trim();
  const instruction = String(body.instruction || "").trim();
  const parentReportId = body.parentReportId ? String(body.parentReportId) : null;
  if (!fieldDayId) return NextResponse.json({ error: "현장을 선택해 주세요." }, { status: 400 });

  const fieldDay = await prisma.fieldDay.findFirst({ where: { id: fieldDayId, deletedAt: null }, select: { id: true, title: true } });
  if (!fieldDay) return NextResponse.json({ error: "현장을 찾을 수 없습니다." }, { status: 404 });

  let version = 1;
  let parent = null;
  if (parentReportId) {
    parent = await prisma.report.findUnique({ where: { id: parentReportId } });
    if (!parent || parent.fieldDayId !== fieldDayId || !parent.content) return NextResponse.json({ error: "수정할 기존 보고서를 찾을 수 없습니다." }, { status: 404 });
    version = parent.reportVersion + 1;
  } else {
    const latest = await prisma.report.findFirst({ where: { fieldDayId }, orderBy: { reportVersion: "desc" }, select: { reportVersion: true } });
    if (latest) version = latest.reportVersion + 1;
  }

  const report = await prisma.report.create({
    data: {
      fieldDayId,
      parentReportId,
      reportVersion: version,
      title: title || `${fieldDay.title} 최종 보고서`,
      instruction: instruction || (parent ? "기존 보고서를 더 명확하고 완성도 높은 최종본으로 수정해 주세요." : "수집된 근거를 바탕으로 의사결정에 사용할 수 있는 완성도 높은 최종 보고서를 작성해 주세요."),
      status: "QUEUED",
    },
  });
  return NextResponse.json({ report }, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const id = String(body.id || "").trim();
  const content = typeof body.content === "string" ? body.content : null;
  const title = typeof body.title === "string" ? body.title.trim() : undefined;
  if (!id || content === null) return NextResponse.json({ error: "보고서와 수정 내용을 확인해 주세요." }, { status: 400 });

  const existing = await prisma.report.findUnique({ where: { id }, select: { status: true } });
  if (!existing) return NextResponse.json({ error: "보고서를 찾을 수 없습니다." }, { status: 404 });
  if (existing.status === "FINAL") return NextResponse.json({ error: "FINAL 보고서는 직접 덮어쓸 수 없습니다. 새 수정 버전을 생성해 주세요." }, { status: 409 });

  const report = await prisma.report.update({
    where: { id },
    data: {
      content,
      ...(title ? { title } : {}),
      status: "COMPLETED",
      structuredResult: null,
      completedAt: new Date(),
    },
  });
  return NextResponse.json({ report });
}
