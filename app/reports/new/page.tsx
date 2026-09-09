"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, FileText, LoaderCircle, Plus, X } from "lucide-react";
import Link from "next/link";

const templates = [
  ["MARKET_FEASIBILITY", "시장성 분석"],
  ["MARKETING_STRATEGY", "마케팅 전략"],
  ["COMPETITOR_ANALYSIS", "경쟁사 분석"],
  ["CONSUMER_TREND", "소비자 트렌드"],
  ["BUSINESS_OPPORTUNITY", "사업기회 분석"],
  ["PRODUCT_BENCHMARK", "제품·서비스 벤치마킹"],
  ["BRAND_ANALYSIS", "브랜드 분석"],
  ["INDUSTRY_TREND", "기술·산업 트렌드"],
  ["CUSTOM", "자유 분석"],
] as const;

type FieldDay = { id: string; title: string; location?: string | null; fieldDate: string; _count?: { materials: number } };
type Material = { id: string; type: string; title: string; content?: string | null; description?: string | null; createdAt: string };

export default function NewReportPage() {
  const router = useRouter();
  const [fieldDays, setFieldDays] = useState<FieldDay[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [fieldDayId, setFieldDayId] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [templateType, setTemplateType] = useState("CUSTOM");
  const [title, setTitle] = useState("");
  const [analysisDirection, setAnalysisDirection] = useState("");
  const [purpose, setPurpose] = useState("");
  const [audience, setAudience] = useState("");
  const [questions, setQuestions] = useState<string[]>([""]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/field-days")
      .then((res) => res.json())
      .then((data) => setFieldDays(data.projects ?? []))
      .catch(() => setError("현장 목록을 불러오지 못했습니다."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!fieldDayId) {
      setMaterials([]);
      setSelected([]);
      return;
    }
    setLoading(true);
    fetch(`/api/materials?fieldDayId=${encodeURIComponent(fieldDayId)}`)
      .then((res) => res.json())
      .then((data) => {
        const available = (data.materials ?? []).filter((item: Material & { uploadStatus?: string }) => !item.uploadStatus || item.uploadStatus === "STORED");
        setMaterials(available);
        setSelected(available.map((item: Material) => item.id));
      })
      .catch(() => setError("현장 자료를 불러오지 못했습니다."))
      .finally(() => setLoading(false));
  }, [fieldDayId]);

  const selectedFieldDay = useMemo(() => fieldDays.find((item) => item.id === fieldDayId), [fieldDays, fieldDayId]);

  function toggleMaterial(id: string) {
    setSelected((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id]);
  }

  function updateQuestion(index: number, value: string) {
    setQuestions((current) => current.map((item, i) => i === index ? value : item));
  }

  async function submit() {
    setError("");
    if (!fieldDayId) return setError("먼저 현장을 선택해 주세요.");
    if (selected.length === 0) return setError("보고서에 사용할 자료를 하나 이상 선택해 주세요.");
    if (analysisDirection.trim().length < 10) return setError("분석 방향을 10자 이상 구체적으로 입력해 주세요.");

    setSaving(true);
    try {
      const response = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fieldDayId,
          materialIds: selected,
          templateType,
          title,
          analysisDirection,
          purpose,
          audience,
          questions: questions.filter((item) => item.trim()),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "보고서를 만들지 못했습니다.");
      router.push(`/reports/${data.report.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "보고서를 만들지 못했습니다.");
    } finally {
      setSaving(false);
    }
  }

  return <div className="mx-auto max-w-[1100px] px-5 py-7 md:px-10 md:py-10">
    <div className="mb-7 flex items-center gap-3">
      <Link href="/reports" className="flex h-11 w-11 items-center justify-center rounded-xl border border-ui bg-surface"><ArrowLeft size={18} /></Link>
      <div><p className="text-sm font-extrabold text-orange">AI REPORT</p><h1 className="text-3xl font-extrabold tracking-tight">새 보고서 만들기</h1></div>
    </div>

    {error && <div className="mb-5 rounded-xl border border-orange bg-orange/10 px-4 py-3 text-sm font-semibold">{error}</div>}

    <div className="space-y-5">
      <section className="paper-card p-5 md:p-7">
        <p className="text-xs font-extrabold text-orange">STEP 1</p><h2 className="mt-1 text-xl font-extrabold">어느 현장을 분석할까요?</h2>
        <select value={fieldDayId} onChange={(e) => setFieldDayId(e.target.value)} className="mt-4 min-h-12 w-full rounded-xl border border-ui bg-surface px-4 text-sm font-semibold">
          <option value="">현장을 선택해 주세요</option>
          {fieldDays.map((item) => <option key={item.id} value={item.id}>{item.title}{item.location ? ` · ${item.location}` : ""}</option>)}
        </select>
        {selectedFieldDay && <p className="mt-3 text-xs text-secondary">{new Date(selectedFieldDay.fieldDate).toLocaleDateString("ko-KR")} · 저장 자료 {materials.length}개</p>}
      </section>

      <section className="paper-card p-5 md:p-7">
        <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-extrabold text-orange">STEP 2</p><h2 className="mt-1 text-xl font-extrabold">보고서 근거 자료를 선택하세요</h2></div>{materials.length > 0 && <button onClick={() => setSelected(selected.length === materials.length ? [] : materials.map((item) => item.id))} className="text-sm font-bold text-orange">{selected.length === materials.length ? "전체 해제" : "전체 선택"}</button>}</div>
        {loading ? <div className="mt-5 flex items-center gap-2 text-sm text-secondary"><LoaderCircle className="animate-spin" size={17}/> 불러오는 중</div> : materials.length === 0 ? <p className="mt-5 text-sm text-secondary">현장을 선택하면 저장된 사진·영상·음성·메모가 여기에 표시됩니다.</p> : <div className="mt-5 grid gap-3 md:grid-cols-2">{materials.map((item) => {
          const active = selected.includes(item.id);
          return <button type="button" key={item.id} onClick={() => toggleMaterial(item.id)} className={`flex min-h-20 items-start gap-3 rounded-xl border p-4 text-left ${active ? "border-orange bg-orange/10" : "border-ui bg-surface"}`}>
            <span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md ${active ? "bg-orange text-ink" : "border border-ui"}`}>{active && <Check size={15}/>}</span>
            <span className="min-w-0"><span className="text-[10px] font-extrabold text-orange">{item.type}</span><span className="block truncate text-sm font-bold">{item.title}</span><span className="mt-1 block line-clamp-2 text-xs text-secondary">{item.content || item.description || "첨부 자료"}</span></span>
          </button>;
        })}</div>}
      </section>

      <section className="paper-card p-5 md:p-7">
        <p className="text-xs font-extrabold text-orange">STEP 3</p><h2 className="mt-1 text-xl font-extrabold">이 자료를 통해 무엇을 분석하고 싶나요?</h2>
        <div className="mt-4 flex flex-wrap gap-2">{templates.map(([value, label]) => <button key={value} type="button" onClick={() => setTemplateType(value)} className={`rounded-full px-3 py-2 text-xs font-bold ${templateType === value ? "bg-ink text-white" : "border border-ui bg-surface"}`}>{label}</button>)}</div>
        <textarea value={analysisDirection} onChange={(e) => setAnalysisDirection(e.target.value)} rows={7} placeholder="예: 이번 전시회에서 조사한 제품들을 기반으로 국내 시장 진입 가능성과 성장 가능성을 분석해줘. 특히 주요 소비자층, 경쟁 강도, 진입 장벽과 우선 검토 제품을 알고 싶어." className="mt-4 w-full rounded-xl border border-ui bg-surface p-4 text-sm leading-6 outline-none focus:border-orange" />
      </section>

      <section className="paper-card p-5 md:p-7">
        <p className="text-xs font-extrabold text-orange">STEP 4 · OPTIONAL</p><h2 className="mt-1 text-xl font-extrabold">보고서 조건을 조금 더 알려주세요</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2"><input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="보고서 제목 (비워두면 자동 생성)" className="min-h-12 rounded-xl border border-ui bg-surface px-4 text-sm"/><input value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder="목적 · 예: 경영진 보고" className="min-h-12 rounded-xl border border-ui bg-surface px-4 text-sm"/><input value={audience} onChange={(e) => setAudience(e.target.value)} placeholder="주요 독자 · 예: 신규사업팀" className="min-h-12 rounded-xl border border-ui bg-surface px-4 text-sm md:col-span-2"/></div>
        <div className="mt-5"><p className="text-sm font-extrabold">반드시 답했으면 하는 질문</p><div className="mt-3 space-y-2">{questions.map((question, index) => <div key={index} className="flex gap-2"><input value={question} onChange={(e) => updateQuestion(index, e.target.value)} placeholder={`핵심 질문 ${index + 1}`} className="min-h-12 flex-1 rounded-xl border border-ui bg-surface px-4 text-sm"/>{questions.length > 1 && <button type="button" onClick={() => setQuestions((current) => current.filter((_, i) => i !== index))} className="flex h-12 w-12 items-center justify-center rounded-xl border border-ui"><X size={17}/></button>}</div>)}</div><button type="button" onClick={() => setQuestions((current) => [...current, ""])} className="mt-3 flex items-center gap-1 text-sm font-bold text-orange"><Plus size={15}/>질문 추가</button></div>
      </section>

      <div className="flex justify-end"><button disabled={saving} onClick={submit} className="flex min-h-14 items-center gap-2 rounded-xl bg-ink px-6 text-sm font-extrabold text-white disabled:opacity-50"><FileText size={18}/>{saving ? "보고서 준비 중..." : "분석 계획 만들기"}</button></div>
    </div>
  </div>;
}
