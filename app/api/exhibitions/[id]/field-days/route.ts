import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const exhibition = await prisma.exhibition.findUnique({ where: { id }, select: { id: true } });
  if (!exhibition) return NextResponse.json({ error: "전시회를 찾을 수 없습니다." }, { status: 404 });
  const fieldDays = await prisma.fieldDay.findMany({
    where: { deletedAt: null, status: "ACTIVE", OR: [{ exhibitionId: id }, { exhibitionId: null }] },
    orderBy: [{ fieldDate: "desc" }, { createdAt: "desc" }],
    select: { id: true, title: true, fieldDate: true, exhibitionId: true },
  });
  const linked = fieldDays.filter((day) => day.exhibitionId === id);
  const manualCandidates = fieldDays.filter((day) => day.exhibitionId === null);
  return NextResponse.json({ linked, manualCandidates, suggestedId: linked[0]?.id ?? null });
}
