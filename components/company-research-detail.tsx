"use client";

import { useEffect, useState } from "react";
import { ExternalLink, X } from "lucide-react";

type ResearchRecord = Record<string, unknown>;
type DetailResponse = { company: ResearchRecord; exhibitionCompany: ResearchRecord };

const groups = [
  { title: "기업", fields: [["companySummary", "기업 개요"], ["country", "국가"], ["location", "위치"], ["founded", "설립"], ["website", "웹사이트"], ["businessType", "사업 유형"], ["companySize", "기업 규모"]] },
  { title: "제품", fields: [["mainProducts", "주요 제품"], ["flagshipProduct", "대표 제품"], ["productSummary", "제품 상세"], ["targetCustomers", "대상 고객"], ["customerExamples", "고객 사례"], ["businessModel", "사업모델"]] },
  { title: "기술", fields: [["coreTechnology", "핵심 기술"], ["aiDigital", "AI / 디지털"], ["competitiveAdvantage", "경쟁우위"], ["certifications", "인증"]] },
  { title: "시장", fields: [["competitors", "경쟁사"], ["domesticMarket", "국내시장"], ["globalMarket", "해외시장"], ["growthSignals", "성장 신호"], ["funding", "투자"], ["revenue", "매출"], ["recentNews", "최근 뉴스"]] },
  { title: "전시회", fields: [["booth", "부스"], ["industry", "산업"], ["category", "분야"], ["exhibitionFocus", "전시 초점"], ["whyInteresting", "관심 이유"], ["benchmarkPoint", "벤치마킹"], ["collaborationOpportunity", "협업 가능성"]] },
  { title: "조사 메모", fields: [["fieldObservation", "현장 확인"], ["questions", "질문"], ["riskOrUnknown", "위험 / 미확인"]] },
] as const;

function websiteLink(value: unknown) {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value.includes("://") ? value : `https://${value}`);
    return ["http:", "https:"].includes(url.protocol) ? url.href : null;
  } catch { return null; }
}

export function CompanyResearchDetail({ exhibitionId, companyId, companyName, onClose }: {
  exhibitionId: string; companyId: string; companyName: string; onClose: () => void;
}) {
  const [detail, setDetail] = useState<DetailResponse | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    void fetch(`/api/exhibitions/${exhibitionId}/companies/${companyId}`, { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("기업의 사전조사를 불러오지 못했습니다.");
        return response.json() as Promise<DetailResponse>;
      })
      .then(setDetail)
      .catch((cause: unknown) => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "사전조사를 불러오지 못했습니다."); });
    return () => controller.abort();
  }, [exhibitionId, companyId]);

  return <div className="fixed inset-0 z-40 flex justify-end bg-ink/55" role="presentation" onClick={onClose}>
    <section role="dialog" aria-modal="true" aria-label={`${companyName} 기업 상세정보`} className="flex h-full w-full min-w-0 max-w-xl flex-col bg-page shadow-2xl" onClick={(event) => event.stopPropagation()}>
      <header className="flex min-h-18 shrink-0 items-center justify-between gap-3 border-b border-ui bg-surface px-5 py-3">
        <div className="min-w-0"><p className="text-xs font-bold text-orange">RESEARCH DETAIL</p><h2 className="truncate text-lg font-extrabold">{companyName}</h2></div>
        <button type="button" onClick={onClose} className="flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-ui" aria-label="상세정보 닫기"><X size={20} /></button>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-8 pt-5">
        {error && <p role="alert" className="rounded-xl bg-surface p-4 text-sm text-orange">{error}</p>}
        {!detail && !error && <p className="text-sm text-secondary">사전조사를 불러오는 중입니다…</p>}
        {detail && groups.map((group) => {
          const fields = group.fields.map(([key, label]) => ({ key, label, value: (group.title === "전시회" || group.title === "조사 메모" ? detail.exhibitionCompany : detail.company)[key] }))
            .filter(({ value }) => value !== null && value !== undefined && value !== "" && (!Array.isArray(value) || value.length > 0));
          if (!fields.length) return null;
          return <section key={group.title} className="paper-card mb-4 p-5"><h3 className="border-b border-ui pb-3 text-lg font-extrabold">{group.title}</h3><dl className="mt-4 grid gap-5">{fields.map(({ key, label, value }) => <div key={key} className="min-w-0"><dt className="text-xs font-extrabold text-secondary">{label}</dt><dd className="mt-1 break-words text-sm leading-6">{Array.isArray(value) ? <ul className="grid gap-1 pl-5">{value.map((item, index) => <li key={index} className="list-disc">{String(item)}</li>)}</ul> : key === "website" && websiteLink(value) ? <a href={websiteLink(value)!} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 break-all text-orange underline">{String(value)}<ExternalLink size={14} /></a> : String(value)}</dd></div>)}</dl></section>;
        })}
      </div>
    </section>
  </div>;
}
