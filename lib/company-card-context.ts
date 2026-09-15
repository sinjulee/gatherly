import { prisma } from "@/lib/prisma";

export const indexCompanyOrder = [{ priority: "desc" }, { sortOrder: "asc" }, { createdAt: "asc" }] as const;

export function companyCardPath(exhibitionId: string, indexId: string, companyId: string) {
  return `/exhibitions/${exhibitionId}/indexes/${indexId}/companies/${companyId}`;
}

export function parseResearchItems(value: string | null) {
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed.filter((item): item is string => typeof item === "string" && !!item.trim()).map((item) => item.trim());
    if (parsed && typeof parsed === "object" && "items" in parsed && Array.isArray(parsed.items)) {
      return parsed.items.filter((item): item is string => typeof item === "string" && !!item.trim()).map((item) => item.trim());
    }
  } catch { /* Treat unstructured legacy text as one item. */ }
  return [value.trim()].filter(Boolean);
}

export async function getCompanyCardContext(exhibitionId: string, indexId: string, companyId: string) {
  const index = await prisma.curationIndex.findUnique({
    where: { id: indexId },
    select: { id: true, exhibitionId: true, name: true, description: true, indexType: true },
  });
  if (!index || index.exhibitionId !== exhibitionId) return null;

  const ordered = await prisma.companyIndex.findMany({
    where: { indexId },
    orderBy: [...indexCompanyOrder],
    select: { companyId: true },
  });
  const position = ordered.findIndex((item) => item.companyId === companyId);
  if (position < 0) return null;

  const [company, participation, indexes, personalIndexes] = await Promise.all([
    prisma.company.findUnique({
      where: { id: companyId },
      select: { id: true, name: true, nameEn: true, companySummary: true, flagshipProduct: true },
    }),
    prisma.exhibitionCompany.findUnique({
      where: { exhibitionId_companyId: { exhibitionId, companyId } },
      select: {
        booth: true, industry: true, category: true, whyInteresting: true,
        fieldObservation: true, questionsJson: true,
      },
    }),
    prisma.companyIndex.findMany({
      where: { companyId, index: { exhibitionId } },
      select: { index: { select: { id: true, name: true, sortOrder: true } } },
      orderBy: { index: { sortOrder: "asc" } },
    }),
    prisma.curationIndex.findMany({
      where: { exhibitionId, name: { in: ["나의 관심기업", "오늘 방문"] }, indexType: "PERSONAL", isSystem: true },
      select: { id: true, name: true },
    }),
  ]);
  if (!company || !participation) return null;

  return {
    index, company, participation,
    indexes: indexes.map((membership) => membership.index),
    personalIndexes,
    position: position + 1,
    total: ordered.length,
    previousCompanyId: ordered[position - 1]?.companyId ?? null,
    nextCompanyId: ordered[position + 1]?.companyId ?? null,
  };
}
