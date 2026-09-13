import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { listSharedDriveWorkspaceCandidates } from "@/lib/google-drive-workspace";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const fieldDayId = searchParams.get("fieldDayId")?.trim();
  if (!fieldDayId) return NextResponse.json({ error: "현장을 선택해 주세요." }, { status: 400 });

  const fieldDay = await prisma.fieldDay.findFirst({
    where: { id: fieldDayId, deletedAt: null },
    select: { id: true, title: true, driveProjectFolderId: true },
  });
  if (!fieldDay) return NextResponse.json({ error: "현장을 찾을 수 없습니다." }, { status: 404 });

  try {
    const candidates = await listSharedDriveWorkspaceCandidates(fieldDay.title, fieldDay.id);
    return NextResponse.json({ candidates, linkedFolderId: fieldDay.driveProjectFolderId });
  } catch {
    return NextResponse.json({ error: "Google Drive 폴더 후보를 찾지 못했습니다." }, { status: 502 });
  }
}
