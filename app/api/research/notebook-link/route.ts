import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function normalizeNotebookUrl(input: string) {
  const trimmed = input.trim();
  const markdownMatch = trimmed.match(/^\[[^\]]*\]\((https:\/\/[^\s)]+)\)$/i);
  return markdownMatch?.[1] ?? trimmed;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const fieldDayId = searchParams.get("fieldDayId");
  if (!fieldDayId) return NextResponse.json({ error: "현장을 선택해 주세요." }, { status: 400 });
  const link = await prisma.notebookLink.findUnique({ where: { fieldDayId } });
  return NextResponse.json({ link });
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const fieldDayId = typeof body.fieldDayId === "string" ? body.fieldDayId.trim() : "";
    const rawNotebookUrl = typeof body.notebookUrl === "string" ? body.notebookUrl : "";
    const notebookUrl = normalizeNotebookUrl(rawNotebookUrl);
    const notebookLabel = typeof body.notebookLabel === "string" ? body.notebookLabel.trim().slice(0, 160) : null;
    if (!fieldDayId || !notebookUrl) return NextResponse.json({ error: "현장과 NotebookLM URL을 입력해 주세요." }, { status: 400 });

    let parsed: URL;
    try { parsed = new URL(notebookUrl); } catch { return NextResponse.json({ error: "올바른 NotebookLM URL이 아닙니다." }, { status: 400 }); }
    const allowedHosts = new Set(["notebook.google.com", "notebooklm.google.com", "gemini.google.com"]);
    if (parsed.protocol !== "https:" || !allowedHosts.has(parsed.hostname)) return NextResponse.json({ error: "NotebookLM 또는 Gemini Notebook URL만 저장할 수 있습니다." }, { status: 400 });

    const project = await prisma.fieldDay.findFirst({ where: { id: fieldDayId, deletedAt: null }, select: { id: true } });
    if (!project) return NextResponse.json({ error: "현장을 찾을 수 없습니다." }, { status: 404 });

    const link = await prisma.notebookLink.upsert({
      where: { fieldDayId },
      create: { fieldDayId, notebookUrl: parsed.toString(), notebookLabel },
      update: { notebookUrl: parsed.toString(), notebookLabel },
    });
    return NextResponse.json({ link });
  } catch {
    return NextResponse.json({ error: "NotebookLM 연결정보를 저장하지 못했습니다." }, { status: 400 });
  }
}
