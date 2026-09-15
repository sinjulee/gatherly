import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function boundedInteger(value: string | null, fallback: number, minimum: number, maximum: number) {
  if (value === null || value === "") return fallback;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= minimum && parsed <= maximum ? parsed : null;
}

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const url = new URL(request.url);
  const limit = boundedInteger(url.searchParams.get("limit"), 180, 1, 200);
  const offset = boundedInteger(url.searchParams.get("offset"), 0, 0, 100_000);
  if (limit === null || offset === null) return NextResponse.json({ error: "페이지 범위를 확인해 주세요." }, { status: 400 });

  const index = await prisma.curationIndex.findUnique({ where: { id }, select: { id: true, name: true, exhibitionId: true } });
  if (!index) return NextResponse.json({ error: "Index를 찾을 수 없습니다." }, { status: 404 });
  const [total, memberships] = await Promise.all([
    prisma.companyIndex.count({ where: { indexId: id } }),
    prisma.companyIndex.findMany({
      where: { indexId: id },
      orderBy: [{ priority: "desc" }, { sortOrder: "asc" }, { createdAt: "asc" }],
      skip: offset,
      take: limit,
      include: {
        company: {
          select: {
            id: true,
            name: true,
            nameEn: true,
            flagshipProduct: true,
            companySummary: true,
            exhibitions: {
              where: { exhibitionId: index.exhibitionId },
              take: 1,
              select: { booth: true, industry: true, category: true, whyInteresting: true },
            },
          },
        },
      },
    }),
  ]);

  const companies = memberships.map((membership) => {
    const participation = membership.company.exhibitions[0] ?? null;
    return {
      companyId: membership.company.id,
      companyName: membership.company.name,
      companyNameEn: membership.company.nameEn,
      booth: participation?.booth ?? null,
      industry: participation?.industry ?? null,
      category: participation?.category ?? null,
      flagshipProduct: membership.company.flagshipProduct,
      companySummary: membership.company.companySummary,
      whyInteresting: participation?.whyInteresting ?? null,
      reason: membership.reason,
      priority: membership.priority,
      sortOrder: membership.sortOrder,
    };
  });
  return NextResponse.json({ index, companies, pagination: { total, limit, offset } });
}
