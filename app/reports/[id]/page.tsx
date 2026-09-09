import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Bot, CircleDashed, FileText } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { ReportAnalysisPlanPanel } from "@/components/report-analysis-plan-panel";

export const dynamic = "force-dynamic";

function parseArray<T>(value: string | null | undefined, fallback: T[] = []) {
  if (!value) return fallback;
  try { const parsed = JSON.parse(value); return Array.isArray(parsed) ? parsed as T[] : fallback; } catch { return fallback; }
}

export default async function ReportDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const report = await prisma.report.findFirst({
    where: { id, deletedAt: null },
    include: {
      fieldDay: true,
      materials: { include: { material: true }, orderBy: { createdAt: "asc" } },
      questions: { orderBy: { order: "asc" } },
      analysisPlan: true,
      jobs: { orderBy: { createdAt: "desc" }, take: 5 },
      versions: { orderBy: { versionNumber: "desc" }, take: 5 },
    },
  });
  if (!report) notFound();

  const planJob = report.jobs.find((job) => job.jobType === "GENERATE_PLAN");
  const reportJob = report.jobs.find((job) => job.jobType === "GENERATE_REPORT");
  const templateLabels: Record<string, string> = {
    MARKET_FEASIBILITY: "시장성 분석",
    MARKETING_STRATEGY: "마케팅 전략",
    COMPETITOR_ANALYSIS: "경쟁사 분석",
    CONSUMER_TREND: "소비자 트렌드",
    BUSINESS_OPPORTUNITY: "사업기회 분석",
    PRODUCT_BENCHMARK: "제품·서비스 벤치마킹",
    BRAND_ANALYSIS: "브랜드 분석",
    INDUSTRY_TREND: "기술·산업 트렌드",
    CUSTOM: "자유 분석",
  };

  const plan = report.analysisPlan ? {
    objective: report.analysisPlan.objective ?? "",
    keyQuestions: parseArray<string>(report.analysisPlan.keyQuestions),
    researchRequirements: parseArray<string>(report.analysisPlan.researchRequirements),
    proposedSections: parseArray<{ title: string; purpose: string }>(report.analysisPlan.proposedSections),
    expectedEvidence: parseArray<string>(report.analysisPlan.expectedEvidence),
    risks: parseArray<string>(report.analysisPlan.risks),
    userApproved: report.analysisPlan.userApproved,
  } : null;

  return <div className="mx-auto max-w-[1180px] px-5 py-7 md:px-10 md:py-10">
    <div className="flex items-start gap-3">
      <Link href="/reports" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-ui bg-surface"><ArrowLeft size={18}/></Link>
      <div className="min-w-0 flex-1"><p className="text-xs font-extrabold text-orange">{templateLabels[report.templateType ?? "CUSTOM"] ?? "AI REPORT"}</p><h1 className="mt-1 break-keep text-3xl font-extrabold tracking-tight md:text-4xl">{report.title}</h1><p className="mt-2 text-sm text-secondary">{report.fieldDay?.title ?? "현장 미지정"} · 자료 {report.materials.length}개</p></div>
      <span className="rounded-full bg-ink px-3 py-2 text-xs font-extrabold text-white">{report.status}</span>
    </div>

    <div className="mt-7 grid gap-5 lg:grid-cols-[1.5fr_.8fr]">
      <div className="space-y-5">
        <section className="paper-card p-5 md:p-7"><p className="text-xs font-extrabold text-orange">ANALYSIS DIRECTION</p><h2 className="mt-1 text-lg font-extrabold">분석 방향</h2><p className="mt-4 whitespace-pre-wrap text-sm leading-7">{report.analysisDirection}</p>{(report.purpose || report.audience) && <div className="mt-5 grid gap-3 border-t border-ui pt-5 sm:grid-cols-2"><div><p className="text-xs font-bold text-secondary">보고서 목적</p><p className="mt-1 text-sm font-semibold">{report.purpose || "미지정"}</p></div><div><p className="text-xs font-bold text-secondary">주요 독자</p><p className="mt-1 text-sm font-semibold">{report.audience || "미지정"}</p></div></div>}</section>
        <section className="paper-card p-5 md:p-7"><p className="text-xs font-extrabold text-orange">KEY QUESTIONS</p><h2 className="mt-1 text-lg font-extrabold">반드시 답할 질문</h2>{report.questions.length === 0 ? <p className="mt-4 text-sm text-secondary">별도로 지정한 핵심 질문이 없습니다.</p> : <ol className="mt-4 space-y-3">{report.questions.map((item, index) => <li key={item.id} className="flex gap-3 text-sm leading-6"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-orange text-xs font-extrabold">{index + 1}</span><span>{item.question}</span></li>)}</ol>}</section>
        <section className="paper-card p-5 md:p-7"><p className="text-xs font-extrabold text-orange">EVIDENCE SET</p><h2 className="mt-1 text-lg font-extrabold">선택된 현장 자료</h2><div className="mt-4 grid gap-3 sm:grid-cols-2">{report.materials.map(({ material }) => <div key={material.id} className="rounded-xl border border-ui bg-surface p-4"><p className="text-[10px] font-extrabold text-orange">{material.type}</p><p className="mt-1 truncate text-sm font-bold">{material.title}</p><p className="mt-1 line-clamp-2 text-xs leading-5 text-secondary">{material.content || material.description || "첨부 자료"}</p></div>)}</div></section>
      </div>

      <aside className="space-y-5">
        <section className="paper-card p-5"><div className="flex items-center gap-2"><Bot size={18} className="text-orange"/><h2 className="font-extrabold">AI 작업 상태</h2></div>{plan ? <div className="mt-4 rounded-xl bg-mint/20 p-4"><p className="text-sm font-extrabold">분석 계획 생성 완료</p><p className="mt-2 text-xs leading-5 text-secondary">아래에서 내용을 검토하고 수정한 뒤 본 분석을 승인할 수 있습니다.</p></div> : <div className="mt-4 rounded-xl bg-page p-4"><div className="flex items-center gap-2 text-sm font-bold"><CircleDashed size={17}/>분석계획 대기 중</div><p className="mt-2 text-xs leading-5 text-secondary">맥미니 Report Worker가 Codex로 분석 계획을 생성합니다.</p>{planJob && <div className="mt-3 border-t border-ui pt-3 text-[11px] text-secondary"><p>Job · {planJob.status}</p><p>Stage · {planJob.stage ?? "ANALYSIS_PLAN"}</p></div>}</div>}{reportJob && <div className="mt-3 rounded-xl border border-ui p-4 text-xs"><p className="font-extrabold">본 분석 Job</p><p className="mt-2 text-secondary">{reportJob.status} · {reportJob.stage ?? "PREPARING_EVIDENCE"}</p></div>}</section>
        <section className="paper-card p-5"><div className="flex items-center gap-2"><FileText size={18}/><h2 className="font-extrabold">생성 원칙</h2></div><ol className="mt-4 space-y-3 text-sm"><li className="flex gap-2"><span className="font-extrabold text-orange">1</span><span>현장 Evidence를 먼저 구조화</span></li><li className="flex gap-2"><span className="font-extrabold text-orange">2</span><span>부족한 정보만 신뢰 가능한 외부 자료로 조사</span></li><li className="flex gap-2"><span className="font-extrabold text-orange">3</span><span>FIELD / EXTERNAL / INFERENCE를 구분해 보고서 작성</span></li></ol></section>
      </aside>
    </div>

    {plan && <div className="mt-5"><ReportAnalysisPlanPanel reportId={report.id} initial={plan}/></div>}
  </div>;
}
