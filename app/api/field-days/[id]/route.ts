import { NextResponse } from "next/server";
import { cleanText, isFieldDayStatus, parseOptionalDate } from "@/lib/domain";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = await prisma.fieldDay.findFirst({ where: { id, deletedAt: null }, include: { materials: { where: { deletedAt: null }, orderBy: { createdAt: "desc" } } } });
  return project ? NextResponse.json({ project }) : NextResponse.json({ error: "현장 프로젝트를 찾을 수 없습니다." }, { status: 404 });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const body = await request.json();
    const title = cleanText(body.title, 120);
    const description = cleanText(body.description ?? "", 2000);
    const location = cleanText(body.location ?? "", 240);
    const fieldDate = parseOptionalDate(body.fieldDate);
    if (!title || !fieldDate || !isFieldDayStatus(body.status)) return NextResponse.json({ error: "입력값을 다시 확인해 주세요." }, { status: 400 });
    const result = await prisma.fieldDay.updateMany({ where: { id, deletedAt: null }, data: { title, description: description || null, location: location || null, fieldDate, status: body.status } });
    if (!result.count) return NextResponse.json({ error: "현장 프로젝트를 찾을 수 없습니다." }, { status: 404 });
    const project = await prisma.fieldDay.findUniqueOrThrow({ where: { id } });
    return NextResponse.json({ project });
  } catch {
    return NextResponse.json({ error: "현장 정보를 수정하지 못했습니다." }, { status: 400 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await prisma.fieldDay.updateMany({ where: { id, deletedAt: null }, data: { deletedAt: new Date(), status: "ARCHIVED" } });
  return result.count ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "현장 프로젝트를 찾을 수 없습니다." }, { status: 404 });
}
