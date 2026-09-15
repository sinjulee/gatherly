import { prisma } from "@/lib/prisma";

export type MaterialContextInput = {
  companyId: string | null;
  sourceIndexId: string | null;
  exhibitionId: string | null;
};

export type MaterialContextError = { error: string; status: 400 | 409 | 422 };

export function parseMaterialContextValues(raw: { companyId?: unknown; sourceIndexId?: unknown; exhibitionId?: unknown }): MaterialContextInput | MaterialContextError {
  const parsed: MaterialContextInput = { companyId: null, sourceIndexId: null, exhibitionId: null };
  for (const key of ["companyId", "sourceIndexId", "exhibitionId"] as const) {
    const value = raw[key];
    if (value === undefined || value === null || value === "") continue;
    if (typeof value !== "string" || !value.trim() || value.trim().length > 100) {
      return { error: "기업·Index·전시회 연결 정보 형식을 확인해 주세요.", status: 400 };
    }
    parsed[key] = value.trim();
  }
  return parsed;
}

export function materialContextMatches(existing: {
  fieldDayId: string | null; type: string; companyId: string | null; sourceIndexId: string | null;
}, input: { fieldDayId: string; type: string; companyId: string | null; sourceIndexId: string | null }) {
  return existing.fieldDayId === input.fieldDayId && existing.type === input.type &&
    existing.companyId === input.companyId && existing.sourceIndexId === input.sourceIndexId;
}

export async function validateMaterialContext(input: MaterialContextInput, fieldDay: { exhibitionId: string | null }): Promise<MaterialContextError | null> {
  const { companyId, sourceIndexId, exhibitionId } = input;
  if (!companyId && !sourceIndexId && !exhibitionId) return null; // Legacy Inbox requests.
  if (!companyId) return { error: "기업 정보 없이 전시회 또는 Index를 연결할 수 없습니다.", status: 400 };

  const company = await prisma.company.findUnique({ where: { id: companyId }, select: { id: true } });
  if (!company) return { error: "입력 당시 기업을 찾을 수 없습니다. 파일은 임시 보관 상태로 유지됩니다.", status: 422 };

  const sourceIndex = sourceIndexId ? await prisma.curationIndex.findUnique({
    where: { id: sourceIndexId }, select: { id: true, exhibitionId: true },
  }) : null;
  if (sourceIndexId && !sourceIndex) return { error: "입력 당시 Index를 찾을 수 없습니다. 파일은 임시 보관 상태로 유지됩니다.", status: 422 };

  const resolvedExhibitionId = exhibitionId || sourceIndex?.exhibitionId || fieldDay.exhibitionId;
  if (!resolvedExhibitionId) return { error: "기업 자료에는 전시회 정보가 필요합니다.", status: 400 };
  if (sourceIndex && sourceIndex.exhibitionId !== resolvedExhibitionId) return { error: "Index와 전시회가 일치하지 않습니다.", status: 409 };
  if (fieldDay.exhibitionId && fieldDay.exhibitionId !== resolvedExhibitionId) return { error: "선택한 현장이 다른 전시회에 연결돼 있습니다.", status: 409 };

  const participation = await prisma.exhibitionCompany.findUnique({
    where: { exhibitionId_companyId: { exhibitionId: resolvedExhibitionId, companyId } }, select: { id: true },
  });
  if (!participation) return { error: "기업이 이 전시회에 참가한 기록이 없습니다.", status: 422 };

  if (sourceIndexId) {
    const membership = await prisma.companyIndex.findUnique({
      where: { companyId_indexId: { companyId, indexId: sourceIndexId } }, select: { id: true },
    });
    if (!membership) return { error: "기업이 입력 당시 Index에 포함돼 있지 않습니다. 파일은 임시 보관 상태로 유지됩니다.", status: 422 };
  }
  return null;
}
