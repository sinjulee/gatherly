import Link from "next/link";
import { ArrowRight, FileText, Plus } from "lucide-react";
import { PageHeader } from "@/components/app-shell";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const statusLabel: Record<string, string> = {
  DRAFT: "준비 중",
  PLAN_GENERATING: "분석계획 생성 중",
  PLAN_READY: "계획 확인",
  PREPARING_EVIDENCE: "자료 분석 중",
  RESEARCHING: "외부 조사 중",
  ANALYZING: "분석 중",
  WRITING: "초안 작성 중",
  VERIFYING: "근거 검증 중",
  LAYOUT: "보고서 구성 중",
  DRAFT_READY: "초안 완료",
  USER_REVIEW: "검토 중",
  REVISING: "수정 중",
  FINALIZING: "최종 점검 중",
  COMPLETED: "완료",
  FAILED: "오류",
};

export default async function Reports() {
  const reports = await prisma.report.findMany({
    where: { deletedAt: null },
    orderBy: { updatedAt: "desc" },
    include: {
      fieldDay: { select: { title: true } },
      _count: { select: { materials: true, questions: true, versions: true } },
    },
  });

  return <div className="mx-auto max-w-[1320px] px-5 py-7 md:px-10 md:py-10">
    <PageHeader
      eyebrow={`${reports.length} DOCUMENTS · REPORTS`}
      title="AI 보고서"
      description="현장 자료를 근거로 분석 방향을 정하고, AI 조사와 검증을 더해 보고서를 완성합니다."
      action={<Link href="/reports/new" className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-ink px-4 py-3 text-sm font-semibold text-white"><Plus size={17}/>새 보고서</Link>}
    />

    {reports.length === 0 ? <div className="paper-card mt-7 flex min-h-72 flex-col items-center justify-center px-6 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-orange"><FileText size={25}/></span>
      <h2 className="mt-5 text-xl font-extrabold">아직 작성한 보고서가 없어요</h2>
      <p className="mt-2 max-w-md text-sm leading-6 text-secondary">현장에서 모은 자료를 선택하고 무엇을 분석할지 알려주세요. 첫 번째 AI 보고서 프로젝트를 만들 수 있습니다.</p>
      <Link href="/reports/new" className="mt-5 flex min-h-12 items-center gap-2 rounded-xl bg-ink px-5 text-sm font-bold text-white"><Plus size={16}/>첫 보고서 만들기</Link>
    </div> : <div className="mt-7 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {reports.map((report, index) => <article className="paper-card group overflow-hidden" key={report.id}>
        <div className={`relative flex h-36 items-end p-5 ${index % 3 === 0 ? "bg-orange" : index % 3 === 1 ? "bg-mint" : "bg-page"}`}>
          <FileText size={42} strokeWidth={1.2}/>
          <span className="absolute right-4 top-4 rounded-full bg-surface px-3 py-2 text-[11px] font-extrabold">{statusLabel[report.status] ?? report.status}</span>
        </div>
        <div className="p-5">
          <p className="text-[10px] font-extrabold text-orange">{report.fieldDay?.title ?? "현장 미지정"}</p>
          <h2 className="mt-1 break-keep font-extrabold leading-snug">{report.title}</h2>
          <p className="mt-2 line-clamp-2 text-xs leading-5 text-secondary">{report.analysisDirection || "분석 방향을 준비 중입니다."}</p>
          <div className="mt-3 flex gap-3 text-[11px] text-secondary"><span>자료 {report._count.materials}</span><span>질문 {report._count.questions}</span><span>v{Math.max(report._count.versions, 1)}</span></div>
          <p className="mt-2 text-xs text-secondary">마지막 수정 · {report.updatedAt.toLocaleDateString("ko-KR")}</p>
          <Link href={`/reports/${report.id}`} className="mt-5 flex min-h-12 items-center gap-2 text-sm font-extrabold text-orange">열어보기 <ArrowRight size={16} className="transition group-hover:translate-x-1"/></Link>
        </div>
      </article>)}
    </div>}
  </div>;
}
