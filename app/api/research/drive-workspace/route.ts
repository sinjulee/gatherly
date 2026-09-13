import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getDriveFolder } from "@/lib/google-drive-workspace";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const fieldDayId = searchParams.get("fieldDayId")?.trim();
  if (!fieldDayId) return NextResponse.json({ error: "현장을 선택해 주세요." }, { status: 400 });

  const fieldDay = await prisma.fieldDay.findFirst({
    where: { id: fieldDayId, deletedAt: null },
    select: {
      id: true,
      title: true,
      driveProjectFolderId: true,
      driveProjectFolderUrl: true,
      driveWorkspaceLinkedAt: true,
      driveWorkspaceLastScannedAt: true,
      _count: { select: { preResearchSources: true } },
    },
  });
  if (!fieldDay) return NextResponse.json({ error: "현장을 찾을 수 없습니다." }, { status: 404 });

  if (!fieldDay.driveProjectFolderId) {
    return NextResponse.json({ workspace: null, fieldDay });
  }

  try {
    const folder = await getDriveFolder(fieldDay.driveProjectFolderId);
    return NextResponse.json({ workspace: folder, fieldDay });
  } catch {
    return NextResponse.json({
      workspace: null,
      fieldDay,
      warning: "연결된 Google Drive 폴더를 확인하지 못했습니다. 다시 연결해 주세요.",
      code: "DRIVE_WORKSPACE_UNAVAILABLE",
    });
  }
}
