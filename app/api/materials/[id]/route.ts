import { NextResponse } from "next/server";
import { cleanText } from "@/lib/domain";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const material = await prisma.material.findFirst({ where: { id, deletedAt: null }, include: { fieldDay: { select: { id: true, title: true } } } });
  return material ? NextResponse.json({ material }) : NextResponse.json({ error: "자료를 찾을 수 없습니다." }, { status: 404 });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const body = await request.json();
    const title = cleanText(body.title, 160);
    const content = cleanText(body.content ?? "", 10000);
    if (!title) return NextResponse.json({ error: "자료 제목을 입력해 주세요." }, { status: 400 });
    const result = await prisma.material.updateMany({ where: { id, deletedAt: null }, data: { title, ...(typeof body.content === "string" ? { content: content || null } : {}) } });
    if (!result.count) return NextResponse.json({ error: "자료를 찾을 수 없습니다." }, { status: 404 });
    return NextResponse.json({ material: await prisma.material.findUniqueOrThrow({ where: { id } }) });
  } catch {
    return NextResponse.json({ error: "자료를 수정하지 못했습니다." }, { status: 400 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await prisma.material.updateMany({ where: { id, deletedAt: null }, data: { deletedAt: new Date() } });
  return result.count ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "자료를 찾을 수 없습니다." }, { status: 404 });
}
