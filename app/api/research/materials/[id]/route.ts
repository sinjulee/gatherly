import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const reviewStatuses = new Set(["COLLECTED", "REVIEWED", "CURATED", "EXCLUDED", "SYNC_READY", "SYNCED"]);

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = await request.json();
    const reviewStatus = typeof body.reviewStatus === "string" ? body.reviewStatus : undefined;
    const isImportant = typeof body.isImportant === "boolean" ? body.isImportant : undefined;
    const tags = Array.isArray(body.tags) ? body.tags.filter((tag: unknown): tag is string => typeof tag === "string").slice(0, 20) : undefined;

    if (reviewStatus && !reviewStatuses.has(reviewStatus)) {
      return NextResponse.json({ error: "올바른 연구자료 상태가 아닙니다." }, { status: 400 });
    }

    const existing = await prisma.material.findFirst({ where: { id, deletedAt: null } });
    if (!existing) return NextResponse.json({ error: "자료를 찾을 수 없습니다." }, { status: 404 });

    const material = await prisma.material.update({
      where: { id },
      data: {
        ...(reviewStatus ? { reviewStatus } : {}),
        ...(typeof isImportant === "boolean" ? { isImportant } : {}),
        ...(tags ? { tagsJson: JSON.stringify(tags) } : {}),
      },
    });

    return NextResponse.json({ material });
  } catch {
    return NextResponse.json({ error: "연구자료 상태를 변경하지 못했습니다." }, { status: 400 });
  }
}
