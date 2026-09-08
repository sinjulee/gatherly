import { NextResponse } from "next/server";
import { isFieldDayStatus, cleanText, parseOptionalDate } from "@/lib/domain";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const projects = await prisma.fieldDay.findMany({
    where: { deletedAt: null },
    orderBy: [{ status: "asc" }, { fieldDate: "desc" }],
    include: { _count: { select: { materials: { where: { deletedAt: null, uploadStatus: "STORED" } } } } },
  });
  return NextResponse.json({ projects });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const title = cleanText(body.title, 120);
    const description = cleanText(body.description ?? "", 2000);
    const location = cleanText(body.location ?? "", 240);
    const fieldDate = parseOptionalDate(body.fieldDate);
    const status = body.status ?? "ACTIVE";
    if (!title) return NextResponse.json({ error: "현장 이름을 입력해 주세요." }, { status: 400 });
    if (!fieldDate) return NextResponse.json({ error: "올바른 현장 날짜를 입력해 주세요." }, { status: 400 });
    if (!isFieldDayStatus(status)) return NextResponse.json({ error: "올바른 상태를 선택해 주세요." }, { status: 400 });
    const project = await prisma.fieldDay.create({ data: { title, description: description || null, location: location || null, fieldDate, status } });
    return NextResponse.json({ project }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "현장을 저장하지 못했습니다." }, { status: 400 });
  }
}
