import { PageHeader } from "@/components/app-shell";
import { FinalReportWorkspace } from "@/components/final-report-workspace";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function Reports() {
  const projects = await prisma.fieldDay.findMany({
    where: { deletedAt: null },
    orderBy: [{ status: "asc" }, { fieldDate: "desc" }],
    select: { id: true, title: true },
  });

  return <div className="mx-auto max-w-[1320px] px-5 py-7 md:px-10 md:py-10">
    <PageHeader eyebrow="FINAL REPORT · CODEX" title="최종 보고서" description="현장 Evidence와 분석 결과를 근거로 Codex CLI가 보고서 초안을 만들고, 수정·버전관리·Google Docs 출력을 이어갑니다." />
    <FinalReportWorkspace projects={projects} />
  </div>;
}
