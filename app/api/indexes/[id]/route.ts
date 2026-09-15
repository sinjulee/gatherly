import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { optionalHexColor, optionalIndexText, optionalInteger, requiredIndexText } from "@/lib/curation-index-domain";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const index = await prisma.curationIndex.findUnique({
    where: { id },
    include: {
      exhibition: { select: { id: true, name: true, nameEn: true } },
      _count: { select: { companies: true } },
    },
  });
  return index ? NextResponse.json({ index }) : NextResponse.json({ error: "Index를 찾을 수 없습니다." }, { status: 404 });
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const existing = await prisma.curationIndex.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "Index를 찾을 수 없습니다." }, { status: 404 });
    if (existing.isSystem) return NextResponse.json({ error: "System Index는 수정할 수 없습니다." }, { status: 403 });

    const body = await request.json();
    if (["exhibitionId", "indexType", "isSystem", "isDynamic", "ruleJson"].some((field) => field in body)) {
      return NextResponse.json({ error: "Index의 시스템 속성은 변경할 수 없습니다." }, { status: 400 });
    }
    const data: Prisma.CurationIndexUpdateInput = {};
    if (body.name !== undefined) {
      const name = requiredIndexText(body.name, 80);
      if (!name) return NextResponse.json({ error: "Index 이름을 입력해 주세요." }, { status: 400 });
      data.name = name;
    }
    for (const [field, maxLength] of [["description", 500], ["icon", 20]] as const) {
      if (body[field] !== undefined) {
        const value = optionalIndexText(body[field], maxLength);
        if (value === undefined) return NextResponse.json({ error: "Index 입력값을 다시 확인해 주세요." }, { status: 400 });
        data[field] = value;
      }
    }
    if (body.color !== undefined) {
      const color = optionalHexColor(body.color);
      if (color === undefined) return NextResponse.json({ error: "색상은 #RRGGBB 형식으로 입력해 주세요." }, { status: 400 });
      data.color = color;
    }
    if (body.sortOrder !== undefined) {
      const sortOrder = optionalInteger(body.sortOrder, 0, 100_000);
      if (sortOrder === undefined || sortOrder === null) return NextResponse.json({ error: "정렬 순서를 확인해 주세요." }, { status: 400 });
      data.sortOrder = sortOrder;
    }

    const index = await prisma.curationIndex.update({ where: { id }, data, include: { _count: { select: { companies: true } } } });
    return NextResponse.json({ index });
  } catch (cause) {
    if (cause instanceof Prisma.PrismaClientKnownRequestError && cause.code === "P2002") {
      return NextResponse.json({ error: "같은 이름의 Index가 이미 있습니다." }, { status: 409 });
    }
    return NextResponse.json({ error: "Index를 수정하지 못했습니다." }, { status: 400 });
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const existing = await prisma.curationIndex.findUnique({ where: { id }, select: { id: true, isSystem: true } });
  if (!existing) return NextResponse.json({ error: "Index를 찾을 수 없습니다." }, { status: 404 });
  if (existing.isSystem) return NextResponse.json({ error: "System Index는 삭제할 수 없습니다." }, { status: 403 });
  await prisma.curationIndex.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
