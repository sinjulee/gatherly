import { NextResponse } from "next/server";
import { cleanText, isMaterialType } from "@/lib/domain";
import { materialContextMatches, parseMaterialContextValues, validateMaterialContext } from "@/lib/material-context";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const fieldDayId = searchParams.get("fieldDayId");
  const companyId = searchParams.get("companyId");
  const type = searchParams.get("type");
  if (type && !isMaterialType(type)) return NextResponse.json({ error: "올바른 자료 유형이 아닙니다." }, { status: 400 });
  const materials = await prisma.material.findMany({
    where: { deletedAt: null, ...(fieldDayId ? { fieldDayId } : {}), ...(companyId ? { companyId } : {}), ...(type ? { type } : {}) },
    orderBy: { createdAt: "desc" },
    include: { fieldDay: { select: { id: true, title: true, deletedAt: true } } },
  });
  return NextResponse.json({ materials });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const fieldDayId = cleanText(body.fieldDayId, 100);
    const content = cleanText(body.content, 10000);
    const title = cleanText(body.title ?? "", 160);
    const clientUploadId = cleanText(body.clientUploadId, 120);
    const context = parseMaterialContextValues(body);
    if ("status" in context) return NextResponse.json({ error: context.error, contextError: true }, { status: context.status });
    const { companyId, sourceIndexId, exhibitionId } = context;
    if (body.type !== undefined && body.type !== "TEXT") return NextResponse.json({ error: "텍스트 자료 유형을 확인해 주세요." }, { status: 400 });
    if (!fieldDayId || !content || !clientUploadId) return NextResponse.json({ error: "현장과 메모 내용을 확인해 주세요." }, { status: 400 });
    const existing = await prisma.material.findUnique({ where: { clientUploadId } });
    if (existing) {
      if (!materialContextMatches(existing, { fieldDayId, type: "TEXT", companyId, sourceIndexId })) return NextResponse.json({ error: "다른 자료와 같은 업로드 식별자를 사용할 수 없습니다." }, { status: 409 });
      return NextResponse.json({ material: existing, idempotent: true });
    }
    const project = await prisma.fieldDay.findFirst({ where: { id: fieldDayId, deletedAt: null } });
    if (!project) return NextResponse.json({ error: "선택한 현장 프로젝트를 찾을 수 없습니다." }, { status: 404 });
    const contextError = await validateMaterialContext({ companyId, sourceIndexId, exhibitionId }, project);
    if (contextError) return NextResponse.json({ error: contextError.error, contextError: true }, { status: contextError.status });
    const material = await prisma.material.create({ data: { fieldDayId, type: "TEXT", title: title || "텍스트 메모", content, uploadStatus: "STORED", clientUploadId, companyId, sourceIndexId } });
    return NextResponse.json({ material }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "텍스트 자료를 저장하지 못했습니다." }, { status: 400 });
  }
}
