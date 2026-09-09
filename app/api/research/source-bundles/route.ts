import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const fieldDayId = searchParams.get("fieldDayId");
  if (!fieldDayId) return NextResponse.json({ error: "현장을 선택해 주세요." }, { status: 400 });

  const bundles = await prisma.sourceBundle.findMany({
    where: { fieldDayId },
    orderBy: { version: "desc" },
    include: {
      _count: { select: { items: true, sourceDocuments: true } },
      items: { include: { material: { select: { id: true, title: true, type: true, reviewStatus: true, isImportant: true } } }, orderBy: { sortOrder: "asc" } },
    },
  });
  return NextResponse.json({ bundles });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const fieldDayId = typeof body.fieldDayId === "string" ? body.fieldDayId : "";
    const title = typeof body.title === "string" ? body.title.trim().slice(0, 160) : "";
    const rawMaterialIds: unknown[] = Array.isArray(body.materialIds) ? body.materialIds : [];
    const materialIds: string[] = Array.from(
      new Set(
        rawMaterialIds
          .filter((id): id is string => typeof id === "string")
          .map((id) => id.trim())
          .filter(Boolean),
      ),
    );

    if (!fieldDayId || !materialIds.length) {
      return NextResponse.json({ error: "현장과 연구에 포함할 자료를 선택해 주세요." }, { status: 400 });
    }

    const project = await prisma.fieldDay.findFirst({ where: { id: fieldDayId, deletedAt: null } });
    if (!project) return NextResponse.json({ error: "현장을 찾을 수 없습니다." }, { status: 404 });

    const materials = await prisma.material.findMany({
      where: { id: { in: materialIds }, fieldDayId, deletedAt: null, uploadStatus: "STORED", reviewStatus: { not: "EXCLUDED" } },
      orderBy: { createdAt: "asc" },
    });
    if (!materials.length) return NextResponse.json({ error: "Source Bundle에 포함할 수 있는 자료가 없습니다." }, { status: 400 });

    const latest = await prisma.sourceBundle.findFirst({ where: { fieldDayId }, orderBy: { version: "desc" }, select: { version: true } });
    const version = (latest?.version ?? 0) + 1;
    const bundle = await prisma.$transaction(async (tx) => {
      const created = await tx.sourceBundle.create({
        data: {
          fieldDayId,
          version,
          title: title || `${project.title} Research Source v${version}`,
          status: "DRAFT",
          manifestJson: JSON.stringify({ fieldDayId, version, materialCount: materials.length, createdAt: new Date().toISOString() }),
        },
      });
      await tx.sourceBundleItem.createMany({
        data: materials.map((material, index) => ({
          sourceBundleId: created.id,
          materialId: material.id,
          sourceType: material.type,
          sortOrder: index,
          included: true,
        })),
      });
      await tx.material.updateMany({ where: { id: { in: materials.map((material) => material.id) } }, data: { reviewStatus: "SYNC_READY" } });
      return created;
    });

    return NextResponse.json({ bundle, materialCount: materials.length }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Source Bundle을 생성하지 못했습니다." }, { status: 400 });
  }
}
