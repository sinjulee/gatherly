import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const fieldDayId = searchParams.get("fieldDayId")?.trim();
  if (!fieldDayId) return NextResponse.json({ error: "현장을 선택해 주세요." }, { status: 400 });

  const sources = await prisma.preResearchSource.findMany({
    where: { fieldDayId },
    orderBy: [{ selectedForPlan: "desc" }, { name: "asc" }],
  });
  return NextResponse.json({ sources });
}
