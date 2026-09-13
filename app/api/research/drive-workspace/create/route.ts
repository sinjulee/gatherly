import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSharedDriveWorkspace } from "@/lib/google-drive-workspace";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const fieldDayId = typeof body.fieldDayId === "string" ? body.fieldDayId.trim() : "";
    if (!fieldDayId) return NextResponse.json({ error: "현장을 선택해 주세요." }, { status: 400 });

    const fieldDay = await prisma.fieldDay.findFirst({ where: { id: fieldDayId, deletedAt: null } });
    if (!fieldDay) return NextResponse.json({ error: "현장을 찾을 수 없습니다." }, { status: 404 });

    const folder = await createSharedDriveWorkspace(fieldDay.title);
    const updated = await prisma.fieldDay.update({
      where: { id: fieldDay.id },
      data: {
        driveProjectFolderId: folder.id,
        driveProjectFolderUrl: folder.webViewLink,
        driveWorkspaceLinkedAt: new Date(),
      },
    });

    return NextResponse.json({ workspace: folder, fieldDay: updated }, { status: 201 });
  } catch (error) {
    const code = error instanceof Error ? error.message : "DRIVE_WORKSPACE_CREATE_FAILED";
    if (code === "DRIVE_WORKSPACE_NAME_AMBIGUOUS") {
      return NextResponse.json({ error: "같은 이름의 Drive 폴더가 여러 개 있습니다. 기존 폴더를 직접 선택해 연결해 주세요.", code }, { status: 409 });
    }
    return NextResponse.json({ error: "Google Drive 현장 폴더를 만들지 못했습니다.", code }, { status: 502 });
  }
}
