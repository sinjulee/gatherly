import { notFound } from "next/navigation";
import { CompanyFullCard } from "@/components/company-full-card";
import { getCompanyCardContext, parseResearchItems } from "@/lib/company-card-context";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function CompanyCardPage({ params }: {
  params: Promise<{ exhibitionId: string; indexId: string; companyId: string }>;
}) {
  const { exhibitionId, indexId, companyId } = await params;
  const context = await getCompanyCardContext(exhibitionId, indexId, companyId);
  if (!context) notFound();
  const defaultFieldDay = await prisma.fieldDay.findFirst({
    where: { exhibitionId, status: "ACTIVE", deletedAt: null },
    orderBy: [{ fieldDate: "desc" }, { createdAt: "desc" }],
    select: { id: true, title: true },
  });
  return <CompanyFullCard key={`${indexId}-${companyId}`} exhibitionId={exhibitionId} indexId={indexId} indexName={context.index.name}
    defaultFieldDay={defaultFieldDay}
    companyId={companyId} companyName={context.company.name} companyNameEn={context.company.nameEn}
    booth={context.participation.booth} companySummary={context.company.companySummary}
    flagshipProduct={context.company.flagshipProduct} whyInteresting={context.participation.whyInteresting}
    fieldObservation={context.participation.fieldObservation} questions={parseResearchItems(context.participation.questionsJson)}
    indexes={context.indexes} personalIndexes={context.personalIndexes} position={context.position}
    total={context.total} previousCompanyId={context.previousCompanyId} nextCompanyId={context.nextCompanyId} />;
}
