import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { optionalHexColor, optionalIndexText, requiredIndexText } from "@/lib/curation-index-domain";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const exhibition = await prisma.exhibition.findUnique({ where: { id }, select: { id: true } });
  if (!exhibition) return NextResponse.json({ error: "전시회를 찾을 수 없습니다." }, { status: 404 });

  const indexes = await prisma.curationIndex.findMany({
    where: { exhibitionId: id },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    include: { _count: { select: { companies: true } } },
  });
  return NextResponse.json({ indexes });
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = await request.json();
    const name = requiredIndexText(body.name, 80);
    const description = optionalIndexText(body.description, 500);
    const icon = optionalIndexText(body.icon, 20);
    const color = optionalHexColor(body.color);
    if (!name) return NextResponse.json({ error: "Index 이름을 입력해 주세요." }, { status: 400 });
    if (description === undefined || icon === undefined || color === undefined) {
      return NextResponse.json({ error: "Index 입력값을 다시 확인해 주세요." }, { status: 400 });
    }
    const exhibition = await prisma.exhibition.findUnique({ where: { id }, select: { id: true } });
    if (!exhibition) return NextResponse.json({ error: "전시회를 찾을 수 없습니다." }, { status: 404 });

    const latest = await prisma.curationIndex.findFirst({ where: { exhibitionId: id }, orderBy: { sortOrder: "desc" }, select: { sortOrder: true } });
    const index = await prisma.curationIndex.create({
      data: {
        exhibitionId: id,
        name,
        description,
        icon,
        color,
        indexType: "PERSONAL",
        isSystem: false,
        isDynamic: false,
        sortOrder: (latest?.sortOrder ?? 0) + 10,
      },
      include: { _count: { select: { companies: true } } },
    });
    return NextResponse.json({ index }, { status: 201 });
  } catch (cause) {
    if (cause instanceof Prisma.PrismaClientKnownRequestError && cause.code === "P2002") {
      return NextResponse.json({ error: "같은 이름의 Index가 이미 있습니다." }, { status: 409 });
    }
    return NextResponse.json({ error: "개인 Index를 만들지 못했습니다." }, { status: 400 });
  }
}
