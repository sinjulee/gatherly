"use client";

import { useState } from "react";
import { CheckCircle2, LoaderCircle, Plus, Save, X } from "lucide-react";
import { useRouter } from "next/navigation";

type Section = { title: string; purpose: string };
type Props = {
  reportId: string;
  initial: {
    objective: string;
    keyQuestions: string[];
    researchRequirements: string[];
    proposedSections: Section[];
    expectedEvidence: string[];
    risks: string[];
    userApproved: boolean;
  };
};

function ListEditor({ label, values, onChange, placeholder }: { label: string; values: string[]; onChange: (next: string[]) => void; placeholder: string }) {
  return <div><p className="text-sm font-extrabold">{label}</p><div className="mt-2 space-y-2">{values.map((value, index) => <div key={index} className="flex gap-2"><input value={value} onChange={(e) => onChange(values.map((item, i) => i === index ? e.target.value : item))} placeholder={placeholder} className="min-h-11 flex-1 rounded-xl border border-ui bg-surface px-3 text-sm"/><button type="button" onClick={() => onChange(values.filter((_, i) => i !== index))} className="flex h-11 w-11 items-center justify-center rounded-xl border border-ui"><X size={15}/></button></div>)}</div><button type="button" onClick={() => onChange([...values, ""])} className="mt-2 flex items-center gap-1 text-xs font-extrabold text-orange"><Plus size={14}/>추가</button></div>;
}

export function ReportAnalysisPlanPanel({ reportId, initial }: Props) {
  const router = useRouter();
  const [objective, setObjective] = useState(initial.objective);
  const [keyQuestions, setKeyQuestions] = useState(initial.keyQuestions.length ? initial.keyQuestions : [""]);
  const [researchRequirements, setResearchRequirements] = useState(initial.researchRequirements.length ? initial.researchRequirements : [""]);
  const [sections, setSections] = useState<Section[]>(initial.proposedSections.length ? initial.proposedSections : [{ title: "", purpose: "" }]);
  const [expectedEvidence, setExpectedEvidence] = useState(initial.expectedEvidence.length ? initial.expectedEvidence : [""]);
  const [risks, setRisks] = useState(initial.risks.length ? initial.risks : [""]);
  const [saving, setSaving] = useState(false);
  const [approving, setApproving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const payload = () => ({
    objective,
    keyQuestions: keyQuestions.filter((item) => item.trim()),
    researchRequirements: researchRequirements.filter((item) => item.trim()),
    proposedSections: sections.filter((item) => item.title.trim()).map((item) => ({ title: item.title.trim(), purpose: item.purpose.trim() })),
    expectedEvidence: expectedEvidence.filter((item) => item.trim()),
    risks: risks.filter((item) => item.trim()),
  });

  async function save() {
    setSaving(true); setError(""); setMessage("");
    try {
      const response = await fetch(`/api/reports/${reportId}/analysis-plan`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload()) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "저장하지 못했습니다.");
      setMessage("분석 계획을 저장했습니다.");
      router.refresh();
    } catch (err) { setError(err instanceof Error ? err.message : "저장하지 못했습니다."); }
    finally { setSaving(false); }
  }

  async function approve() {
    setApproving(true); setError(""); setMessage("");
    try {
      const saveResponse = await fetch(`/api/reports/${reportId}/analysis-plan`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload()) });
      if (!saveResponse.ok) { const data = await saveResponse.json(); throw new Error(data.error || "계획을 저장하지 못했습니다."); }
      const response = await fetch(`/api/reports/${reportId}/analysis-plan/approve`, { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "승인하지 못했습니다.");
      setMessage("분석 계획을 승인했습니다. 본 분석 Job이 생성되었습니다.");
      router.refresh();
    } catch (err) { setError(err instanceof Error ? err.message : "승인하지 못했습니다."); }
    finally { setApproving(false); }
  }

  return <section className="paper-card p-5 md:p-7">
    <div className="flex flex-col gap-4 border-b border-ui pb-5 sm:flex-row sm:items-start sm:justify-between"><div><p className="text-xs font-extrabold text-orange">AI ANALYSIS PLAN</p><h2 className="mt-1 text-xl font-extrabold">분석 계획 검토</h2><p className="mt-1 text-xs leading-5 text-secondary">AI가 제안한 분석 방향을 직접 고친 뒤 승인하세요. 승인 전에는 본 보고서 분석을 시작하지 않습니다.</p></div>{initial.userApproved && <span className="flex items-center gap-1 rounded-full bg-mint px-3 py-2 text-xs font-extrabold"><CheckCircle2 size={15}/>승인됨</span>}</div>

    {error && <div className="mt-4 rounded-xl bg-orange/10 px-4 py-3 text-sm font-semibold">{error}</div>}
    {message && <div className="mt-4 rounded-xl bg-mint/30 px-4 py-3 text-sm font-semibold">{message}</div>}

    <div className="mt-5 space-y-6">
      <div><p className="text-sm font-extrabold">분석 목적</p><textarea value={objective} onChange={(e) => setObjective(e.target.value)} rows={4} className="mt-2 w-full rounded-xl border border-ui bg-surface p-3 text-sm leading-6"/></div>
      <ListEditor label="핵심 분석 질문" values={keyQuestions} onChange={setKeyQuestions} placeholder="분석에서 답해야 할 질문"/>
      <ListEditor label="추가 조사 항목" values={researchRequirements} onChange={setResearchRequirements} placeholder="외부 조사에서 확인할 항목"/>
      <div><p className="text-sm font-extrabold">예상 보고서 구성</p><div className="mt-2 space-y-2">{sections.map((section, index) => <div key={index} className="grid gap-2 rounded-xl border border-ui p-3 sm:grid-cols-[.8fr_1.3fr_auto]"><input value={section.title} onChange={(e) => setSections(sections.map((item, i) => i === index ? { ...item, title: e.target.value } : item))} placeholder="섹션 제목" className="min-h-11 rounded-lg border border-ui bg-surface px-3 text-sm"/><input value={section.purpose} onChange={(e) => setSections(sections.map((item, i) => i === index ? { ...item, purpose: e.target.value } : item))} placeholder="이 섹션에서 다룰 내용" className="min-h-11 rounded-lg border border-ui bg-surface px-3 text-sm"/><button type="button" onClick={() => setSections(sections.filter((_, i) => i !== index))} className="flex h-11 w-11 items-center justify-center rounded-lg border border-ui"><X size={15}/></button></div>)}</div><button type="button" onClick={() => setSections([...sections, { title: "", purpose: "" }])} className="mt-2 flex items-center gap-1 text-xs font-extrabold text-orange"><Plus size={14}/>섹션 추가</button></div>
      <ListEditor label="필요한 Evidence" values={expectedEvidence} onChange={setExpectedEvidence} placeholder="결론을 위해 필요한 현장/외부 근거"/>
      <ListEditor label="분석 시 주의할 리스크" values={risks} onChange={setRisks} placeholder="근거 부족, 편향 등 주의사항"/>
    </div>

    <div className="mt-7 flex flex-col gap-2 border-t border-ui pt-5 sm:flex-row sm:justify-end"><button disabled={saving || approving} onClick={save} className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-ui bg-surface px-5 text-sm font-extrabold"><Save size={16}/>{saving ? "저장 중" : "계획 저장"}</button><button disabled={saving || approving} onClick={approve} className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-ink px-5 text-sm font-extrabold text-white"><>{approving ? <LoaderCircle size={16} className="animate-spin"/> : <CheckCircle2 size={16}/>}</>{approving ? "승인 중" : "이 계획으로 분석 시작"}</button></div>
  </section>;
}
