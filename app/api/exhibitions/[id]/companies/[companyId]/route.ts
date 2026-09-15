import { NextResponse } from "next/server";
import { parseResearchItems } from "@/lib/company-card-context";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ id: string; companyId: string }> }) {
  const { id: exhibitionId, companyId } = await context.params;
  const participation = await prisma.exhibitionCompany.findUnique({
    where: { exhibitionId_companyId: { exhibitionId, companyId } },
    include: { company: { include: { tags: { include: { tag: true } } } } },
  });
  if (!participation) return NextResponse.json({ error: "이 전시회의 참가기업을 찾을 수 없습니다." }, { status: 404 });

  const { company, ...exhibitionCompany } = participation;
  return NextResponse.json({
    company: {
      ...company,
      mainProducts: parseResearchItems(company.mainProductsJson),
      targetCustomers: parseResearchItems(company.targetCustomerJson),
      customerExamples: parseResearchItems(company.customerExamplesJson),
      competitors: parseResearchItems(company.competitorsJson),
      certifications: parseResearchItems(company.certificationsJson),
      tags: company.tags.map(({ tag }) => ({ name: tag.name, kind: tag.kind })),
    },
    exhibitionCompany: {
      ...exhibitionCompany,
      questions: parseResearchItems(exhibitionCompany.questionsJson),
      rawTags: parseResearchItems(exhibitionCompany.rawTagsJson),
    },
  });
}
