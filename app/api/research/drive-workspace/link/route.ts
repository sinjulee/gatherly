import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureSharedDriveSubfolders, getDriveFolder } from "@/lib/google-drive-workspace";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const fieldDayId = typeof body.fieldDayId === "string" ? body.fieldDayId.trim() : "";
    const folderId = typeof body.folderId === "string" ? body.folderId.trim() : "";
    if (!fieldDayId || !folderId) return NextResponse.json({ error: "현장과 Drive 폴더를 선택해 주세요." }, { status: 400 });

    const fieldDay = await prisma.fieldDay.findFirst({ where: { id: fieldDayId, deletedAt: null } });
    if (!fieldDay) return NextResponse.json({ error: "현장을 찾을 수 없습니다." }, { status: 404 });

    const folder = await getDriveFolder(folderId);
    await ensureSharedDriveSubfolders(folder.id);
    const updated = await prisma.fieldDay.update({
      where: { id: fieldDay.id },
      data: {
        driveProjectFolderId: folder.id,
        driveProjectFolderUrl: folder.webViewLink,
        driveWorkspaceLinkedAt: new Date(),
      },
    });
    return NextResponse.json({ workspace: folder, fieldDay: updated });
  } catch (error) {
    const code = error instanceof Error ? error.message : "DRIVE_WORKSPACE_LINK_FAILED";
    return NextResponse.json({ error: "Google Drive 폴더를 연결하지 못했습니다.", code }, { status: 502 });
  }
}
