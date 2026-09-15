"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Camera, ChevronLeft, FileText, Mic, MoreHorizontal, Pin, Star } from "lucide-react";
import { CompanyCapturePanel, type CaptureMode } from "@/components/company-capture-panel";
import { CompanyMaterials } from "@/components/company-materials";
import { CompanyResearchDetail } from "@/components/company-research-detail";
import { swipeDirection, type SwipePoint } from "@/lib/company-card-navigation";

type IndexLabel = { id: string; name: string; sortOrder: number };
type PersonalIndex = { id: string; name: string };
type Props = {
  exhibitionId: string; indexId: string; indexName: string; companyId: string;
  companyName: string; companyNameEn: string | null; booth: string | null;
  companySummary: string | null; flagshipProduct: string | null;
  whyInteresting: string | null; fieldObservation: string | null; questions: string[];
  indexes: IndexLabel[]; personalIndexes: PersonalIndex[];
  defaultFieldDay: { id: string; title: string } | null;
  position: number; total: number; previousCompanyId: string | null; nextCompanyId: string | null;
};

const captureActions = [["PHOTO", Camera, "사진"], ["AUDIO", Mic, "음성"], ["MEMO", FileText, "메모"], ["MORE", MoreHorizontal, "더보기"]] as const;

function cardPath({ exhibitionId, indexId }: Props, companyId: string) {
  return `/exhibitions/${exhibitionId}/indexes/${indexId}/companies/${companyId}`;
}

export function CompanyFullCard(props: Props) {
  const router = useRouter();
  const start = useRef<{ point: SwipePoint; pointerId: number } | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [captureMode, setCaptureMode] = useState<CaptureMode | null>(null);
  const [memoDraft, setMemoDraft] = useState("");
  const [materialRefreshToken, setMaterialRefreshToken] = useState(0);
  const [membership, setMembership] = useState(() => ({
    favorite: props.indexes.some((index) => index.name === "나의 관심기업"),
    today: props.indexes.some((index) => index.name === "오늘 방문"),
  }));
  const [saving, setSaving] = useState<"favorite" | "today" | null>(null);
  const [notice, setNotice] = useState("");
  const favoriteIndex = props.personalIndexes.find((index) => index.name === "나의 관심기업");
  const todayIndex = props.personalIndexes.find((index) => index.name === "오늘 방문");
  const firstIndexes = props.indexes.slice(0, 4);
  const extraCount = props.indexes.length - firstIndexes.length;

  async function toggle(kind: "favorite" | "today", indexId: string | undefined) {
    if (!indexId || saving) return;
    setSaving(kind);
    setNotice("");
    const included = membership[kind];
    try {
      const response = await fetch(`/api/indexes/${indexId}/companies/${props.companyId}`, {
        method: included ? "DELETE" : "POST",
        headers: included ? undefined : { "Content-Type": "application/json" },
        body: included ? undefined : JSON.stringify({ reason: kind === "favorite" ? "사용자가 관심기업으로 등록" : "사용자가 오늘 방문 대상으로 등록" }),
      });
      const data: { error?: string } = await response.json();
      if (!response.ok) throw new Error(data.error || "Index 저장에 실패했습니다.");
      setMembership((current) => ({ ...current, [kind]: !included }));
      if (included && props.indexId === indexId) router.push(`/exhibitions/${props.exhibitionId}?index=${indexId}`);
      else router.refresh();
    } catch (cause) {
      setNotice(cause instanceof Error ? cause.message : "Index 저장에 실패했습니다.");
    } finally {
      setSaving(null);
    }
  }

  function onPointerDown(event: React.PointerEvent<HTMLElement>) {
    if (event.pointerType !== "touch" || !(event.target instanceof Element) || event.target.closest("a,button,input,textarea,select,[role='dialog']")) return;
    start.current = { point: { x: event.clientX, y: event.clientY }, pointerId: event.pointerId };
  }

  function onPointerUp(event: React.PointerEvent<HTMLElement>) {
    if (!start.current || start.current.pointerId !== event.pointerId) return;
    const direction = swipeDirection(start.current.point, { x: event.clientX, y: event.clientY });
    start.current = null;
    const target = direction === "NEXT" ? props.nextCompanyId : direction === "PREVIOUS" ? props.previousCompanyId : null;
    if (target) router.push(cardPath(props, target));
  }

  const previous = props.previousCompanyId ? cardPath(props, props.previousCompanyId) : null;
  const next = props.nextCompanyId ? cardPath(props, props.nextCompanyId) : null;
  return <div className="company-card-page mx-auto w-full max-w-[1100px] min-w-0 px-4 pb-[calc(212px+env(safe-area-inset-bottom))] pt-3 sm:px-6 md:px-10 md:pt-6 lg:pb-12">
    <header className="sticky top-0 z-20 -mx-4 flex min-h-16 items-center justify-between gap-2 border-b border-ui bg-page/95 px-4 py-2 backdrop-blur-sm sm:-mx-6 sm:px-6 md:-mx-10 md:px-10">
      <Link href={`/exhibitions/${props.exhibitionId}?index=${props.indexId}`} className="flex min-h-11 min-w-0 items-center gap-1 rounded-xl px-2 text-sm font-bold hover:bg-surface"><ChevronLeft size={18} className="shrink-0" /><span className="truncate">{props.indexName}</span></Link>
      <span className="shrink-0 rounded-full bg-surface px-3 py-2 text-xs font-extrabold" aria-label={`전체 ${props.total}개 중 ${props.position}번째 기업`}>{props.position} / {props.total}</span>
    </header>

    <div className="mt-4 grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1fr)_260px] lg:items-start">
      <main className="min-w-0">
        <article onPointerDown={onPointerDown} onPointerUp={onPointerUp} onPointerCancel={() => { start.current = null; }} style={{ touchAction: "pan-y" }} className="paper-card min-w-0 overflow-hidden p-5 sm:p-7 md:p-9">
          <div className="flex flex-wrap items-center gap-2"><span className="rounded-xl bg-orange px-3 py-2 text-sm font-extrabold text-ink">{props.booth || "부스 미정"}</span><span className="text-xs font-bold text-secondary">{props.indexName} · 현장 기업 카드</span></div>
          <h1 className="mt-5 break-keep text-3xl font-extrabold leading-tight sm:text-4xl">{props.companyName}</h1>
          {props.companyNameEn && <p className="mt-2 break-words text-sm text-secondary">{props.companyNameEn}</p>}
          <div className="mt-5 flex flex-wrap gap-2">{firstIndexes.map((index) => <span key={index.id} className="rounded-full bg-mint px-3 py-1.5 text-xs font-extrabold">{index.name}</span>)}{extraCount > 0 && <span className="rounded-full bg-page px-3 py-1.5 text-xs font-bold">+{extraCount}</span>}</div>

          <section className="mt-7 rounded-2xl bg-page p-5"><h2 className="text-xs font-extrabold text-secondary">한 줄 요약</h2><p className="mt-2 break-words text-lg font-extrabold leading-7">{props.companySummary || props.flagshipProduct || "기업 개요를 확인할 정보가 없습니다."}</p></section>
          {props.flagshipProduct && <section className="mt-7 border-b border-ui pb-6"><h2 className="text-sm font-extrabold text-orange">대표 제품</h2><p className="mt-2 break-words text-base leading-7">{props.flagshipProduct}</p></section>}
          {props.whyInteresting && <section className="mt-6 border-b border-ui pb-6"><h2 className="text-sm font-extrabold text-orange">왜 봐야 하는가</h2><p className="mt-2 whitespace-pre-line break-words text-sm leading-7">{props.whyInteresting}</p></section>}
          {props.fieldObservation && <section className="mt-6 border-b border-ui pb-6"><h2 className="text-sm font-extrabold text-orange">현장에서 확인할 것</h2><p className="mt-2 whitespace-pre-line break-words text-sm leading-7">{props.fieldObservation}</p></section>}
          {!!props.questions.length && <section className="mt-6"><h2 className="text-sm font-extrabold text-orange">질문</h2><ol className="mt-3 grid gap-3">{props.questions.map((question, index) => <li key={`${index}-${question}`} className="flex min-w-0 gap-3 text-sm leading-6"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-mint text-xs font-extrabold">Q{index + 1}</span><span className="min-w-0 break-words">{question}</span></li>)}</ol></section>}
          <button type="button" onClick={() => setDetailOpen(true)} className="mt-7 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-ui bg-page px-4 text-sm font-extrabold hover:border-orange"><FileText size={17} />기업 상세정보</button>
        </article>

        <div className="mt-4 grid grid-cols-2 gap-3" aria-label="기업 탐색">
          {previous ? <Link href={previous} className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-ui bg-surface px-3 text-sm font-bold"><ArrowLeft size={17} />이전 기업</Link> : <span className="flex min-h-12 items-center justify-center rounded-xl border border-ui bg-page text-sm text-secondary" aria-disabled="true">첫 기업</span>}
          {next ? <Link href={next} className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-ink px-3 text-sm font-bold text-white">다음 기업<ArrowRight size={17} /></Link> : <span className="flex min-h-12 items-center justify-center rounded-xl border border-ui bg-page text-sm text-secondary" aria-disabled="true">마지막 기업</span>}
        </div>
        <p className="mt-2 text-center text-xs text-secondary lg:hidden">좌우로 밀어 넘기거나 버튼으로 기업을 이동하세요.</p>
      </main>

      <aside className="grid min-w-0 gap-4 lg:sticky lg:top-24">
        <section className="paper-card p-5"><h2 className="text-sm font-extrabold">현장 선택</h2><div className="mt-4 grid gap-2">
          <button type="button" onClick={() => void toggle("favorite", favoriteIndex?.id)} disabled={!favoriteIndex || !!saving} aria-pressed={membership.favorite} className="flex min-h-12 items-center gap-2 rounded-xl border border-ui px-4 text-left text-sm font-bold disabled:opacity-50"><Star size={18} fill={membership.favorite ? "currentColor" : "none"} />{membership.favorite ? "관심기업 ★" : "관심기업 추가 ☆"}</button>
          <button type="button" onClick={() => void toggle("today", todayIndex?.id)} disabled={!todayIndex || !!saving} aria-pressed={membership.today} className="flex min-h-12 items-center gap-2 rounded-xl border border-ui px-4 text-left text-sm font-bold disabled:opacity-50"><Pin size={18} />{membership.today ? "오늘 방문 예정 ✓" : "오늘 방문 추가"}</button>
        </div>{notice && <p role="alert" className="mt-3 text-xs text-orange">{notice}</p>}</section>
        <CompanyMaterials companyId={props.companyId} refreshToken={materialRefreshToken} />
        <section className="paper-card hidden p-5 lg:block"><h2 className="text-sm font-extrabold">현장 입력</h2><div className="mt-3 grid grid-cols-2 gap-2">{captureActions.map(([mode, Icon, label]) => <button key={mode} type="button" onClick={() => setCaptureMode(mode)} className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-ui text-xs font-bold hover:border-orange"><Icon size={17} />{label}</button>)}</div></section>
      </aside>
    </div>

    <nav aria-label="현장 입력" className="company-action-bar fixed inset-x-0 z-30 grid grid-cols-4 gap-1 border-t border-ui bg-surface px-2 py-2 shadow-[0_-4px_16px_rgba(17,17,17,0.06)] lg:hidden">
      {captureActions.map(([mode, Icon, label]) => <button key={mode} type="button" onClick={() => setCaptureMode(mode)} className="flex min-h-12 min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-1 py-1 text-[11px] font-extrabold hover:bg-mint"><Icon size={20} />{label}</button>)}
    </nav>
    {detailOpen && <CompanyResearchDetail exhibitionId={props.exhibitionId} companyId={props.companyId} companyName={props.companyName} onClose={() => setDetailOpen(false)} />}
    {captureMode && <CompanyCapturePanel mode={captureMode} companyName={props.companyName} companyId={props.companyId} indexId={props.indexId} exhibitionId={props.exhibitionId} defaultFieldDay={props.defaultFieldDay} draft={memoDraft} onDraftChange={setMemoDraft} onClose={() => setCaptureMode(null)} onDetail={() => { setCaptureMode(null); setDetailOpen(true); }} onStored={() => setMaterialRefreshToken((current) => current + 1)} />}
  </div>;
}
