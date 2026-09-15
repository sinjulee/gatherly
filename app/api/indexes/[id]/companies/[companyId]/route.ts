import { NextResponse } from "next/server";
import { optionalIndexText, optionalInteger } from "@/lib/curation-index-domain";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function editableIndex(indexId: string) {
  return prisma.curationIndex.findUnique({ where: { id: indexId }, select: { id: true, exhibitionId: true, indexType: true } });
}

export async function POST(request: Request, context: { params: Promise<{ id: string; companyId: string }> }) {
  try {
    const { id, companyId } = await context.params;
    const index = await editableIndex(id);
    if (!index) return NextResponse.json({ error: "Index를 찾을 수 없습니다." }, { status: 404 });
    if (index.indexType !== "PERSONAL") return NextResponse.json({ error: "System/Dynamic Index membership은 seed 또는 rule로 관리합니다." }, { status: 403 });
    const participation = await prisma.exhibitionCompany.findUnique({
      where: { exhibitionId_companyId: { exhibitionId: index.exhibitionId, companyId } },
      select: { id: true },
    });
    if (!participation) return NextResponse.json({ error: "이 전시회의 참가기업을 찾을 수 없습니다." }, { status: 404 });

    const body = await request.json().catch(() => ({}));
    const reason = optionalIndexText(body.reason, 500);
    const priority = optionalInteger(body.priority, -100_000, 100_000);
    const sortOrder = optionalInteger(body.sortOrder, -100_000, 100_000);
    if (reason === undefined || priority === undefined || sortOrder === undefined) {
      return NextResponse.json({ error: "membership 입력값을 다시 확인해 주세요." }, { status: 400 });
    }
    const existing = await prisma.companyIndex.findUnique({ where: { companyId_indexId: { companyId, indexId: id } } });
    const membership = existing
      ? await prisma.companyIndex.update({ where: { id: existing.id }, data: { reason, priority, sortOrder, source: "USER" } })
      : await prisma.companyIndex.create({ data: { companyId, indexId: id, reason, priority, sortOrder, source: "USER" } });
    return NextResponse.json({ membership }, { status: existing ? 200 : 201 });
  } catch {
    return NextResponse.json({ error: "기업을 Index에 저장하지 못했습니다." }, { status: 400 });
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string; companyId: string }> }) {
  const { id, companyId } = await context.params;
  const index = await editableIndex(id);
  if (!index) return NextResponse.json({ error: "Index를 찾을 수 없습니다." }, { status: 404 });
  if (index.indexType !== "PERSONAL") return NextResponse.json({ error: "System/Dynamic Index membership은 직접 삭제할 수 없습니다." }, { status: 403 });
  const result = await prisma.companyIndex.deleteMany({ where: { indexId: id, companyId } });
  return result.count ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "membership을 찾을 수 없습니다." }, { status: 404 });
}
