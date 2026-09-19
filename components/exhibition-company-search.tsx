"use client";

import Link from "next/link";
import { useId, useState } from "react";

type Membership = {
  id: string;
  reason: string | null;
  company: {
    id: string;
    name: string;
    nameEn: string | null;
    flagshipProduct: string | null;
    companySummary: string | null;
    exhibitions: {
      booth: string | null;
      industry: string | null;
      category: string | null;
    }[];
  };
};

export function ExhibitionCompanySearch({
  exhibitionId,
  indexId,
  memberships,
}: {
  exhibitionId: string;
  indexId: string;
  memberships: Membership[];
}) {
  const [query, setQuery] = useState("");
  const searchId = useId();
  const normalizedQuery = query.trim().normalize("NFC").toLowerCase();
  const filteredMemberships = memberships.filter(({ company }) => {
    const participation = company.exhibitions[0];
    return [
      company.name,
      company.nameEn,
      participation?.booth,
      participation?.industry,
      participation?.category,
      company.flagshipProduct,
      company.companySummary,
    ].some((value) => value?.normalize("NFC").toLowerCase().includes(normalizedQuery));
  });

  return <>
    <div className="paper-card mt-4 p-4 md:p-5">
      <label htmlFor={searchId} className="mb-2 block text-sm font-bold">기업 검색</label>
      <div className="flex flex-wrap gap-2">
        <input
          id={searchId}
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="기업명·부스번호·제품명으로 검색"
          className="min-h-12 min-w-0 flex-[1_1_240px] rounded-xl border border-ui bg-page px-3 text-base text-ink outline-none focus-visible:border-ink focus-visible:ring-2 focus-visible:ring-ink"
        />
        {query && <button type="button" onClick={() => setQuery("")} className="min-h-12 rounded-xl bg-ink px-4 text-sm font-bold text-white">초기화</button>}
      </div>
      <p className="mt-2 text-sm text-secondary">기업명, 부스번호, 제품명으로 빠르게 찾을 수 있습니다.</p>
      <p role="status" className="mt-3 text-sm text-secondary">검색 결과 {filteredMemberships.length}개 / 전체 {memberships.length}개</p>
    </div>
        <div className="mt-4 grid gap-3 xl:grid-cols-2">
          {filteredMemberships.map((membership) => {
            const participation = membership.company.exhibitions[0];
            return <Link href={`/exhibitions/${exhibitionId}/indexes/${indexId}/companies/${membership.company.id}`} key={membership.id} className="paper-card flex min-h-52 flex-col p-5 transition hover:border-orange focus-visible:border-orange">
              <div className="flex items-start justify-between gap-3"><div className="min-w-0"><h3 className="text-lg font-extrabold">{membership.company.name}</h3>{membership.company.nameEn && <p className="mt-1 truncate text-xs text-secondary">{membership.company.nameEn}</p>}</div><span className="shrink-0 rounded-full bg-orange px-3 py-1.5 text-xs font-extrabold text-ink">{participation?.booth || "부스 미정"}</span></div>
              <div className="mt-4 flex flex-wrap gap-2 text-xs font-bold"><span className="rounded-full bg-mint px-2.5 py-1.5">{participation?.industry || "산업 미분류"}</span>{participation?.category && <span className="rounded-full bg-page px-2.5 py-1.5 text-secondary">{participation.category}</span>}</div>
              <p className="mt-4 line-clamp-2 text-sm font-semibold">{membership.company.flagshipProduct || membership.company.companySummary || "대표 제품 정보가 없습니다."}</p>
              <div className="mt-auto border-t border-ui pt-4"><p className="line-clamp-2 text-xs leading-5 text-secondary">{membership.reason || "직접 추가한 기업"}</p><span className="mt-2 inline-block text-[11px] font-bold text-orange">기업 카드 보기 →</span></div>
            </Link>;
          })}
          {!filteredMemberships.length && normalizedQuery && <div className="paper-card p-6 xl:col-span-2"><p className="text-sm text-secondary">검색 결과가 없습니다. 다른 기업명이나 부스번호로 검색해 보세요.</p></div>}
          {!memberships.length && !normalizedQuery && <div className="paper-card p-6 xl:col-span-2"><p className="font-extrabold">아직 담긴 기업이 없습니다.</p><p className="mt-2 text-sm text-secondary">Personal Index는 membership API로 기업을 추가할 수 있습니다.</p></div>}
        </div>
  </>;
}
