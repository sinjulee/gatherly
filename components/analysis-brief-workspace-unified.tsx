"use client";

import { useEffect, useState } from "react";
import { Check, Clipboard, CloudUpload, ExternalLink, FileText, PlayCircle, Plus, RefreshCw } from "lucide-react";

type Project = { id: string; title: string };
type BundleRef = { id: string; version: number; title: string; status: string } | null;
type AnalysisBrief = {
  id: string;
  fieldDayId: string;
  version: number;
  title: string;
  goal: string;
  researchQuestions: string | null;
  decisionContext: string | null;
  evaluationCriteria: string | null;
  targetScope: string | null;
  excludeScope: string | null;
  outputType: string | null;
  additionalInstruction: string | null;
  driveFileId: string | null;
  documentUrl?: string | null;
  status: string;
  createdAt: string;
  sourceBundle: BundleRef;
};

const fieldClass = "block w-full min-w-0 rounded-xl border border-ui bg-surface text-sm";

function documentUrl(brief: AnalysisBrief) {
  return brief.documentUrl || (brief.driveFileId ? `https://docs.google.com/document/d/${brief.driveFileId}/edit` : "");
}

function buildBriefText(projectTitle: string, brief: AnalysisBrief) {
  const lines = [
    `# Gatherly Analysis Brief v${brief.version}`,
    `프로젝트: ${projectTitle}`,
    `분석 제목: ${brief.title}`,
    "",
    "## 분석 방향",
    brief.goal,
  ];
  if (brief.researchQuestions) lines.push("", "## 핵심 질문", brief.researchQuestions);
  if (brief.decisionContext) lines.push("", "## 의사결정 맥락", brief.decisionContext);
  if (brief.evaluationCriteria) lines.push("", "## 평가 기준", brief.evaluationCriteria);
  if (brief.additionalInstruction) lines.push("", "## 추가 지시", brief.additionalInstruction);
  return lines.join("\n");
}

export function AnalysisBriefWorkspaceUnified({ project }: { project: Project }) {
  const projectId = project.id;
  const [briefs, setBriefs] = useState<AnalysisBrief[]>([]);
  const [title, setTitle] = useState("");
  const [goal, setGoal] = useState("");
  const [researchQuestions, setResearchQuestions] = useState("");
  const [decisionContext, setDecisionContext] = useState("");
  const [evaluationCriteria, setEvaluationCriteria] = useState("");
  const [additionalInstruction, setAdditionalInstruction] = useState("");
  const [notebookUrl, setNotebookUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [syncingBriefId, setSyncingBriefId] = useState("");
  const [startingAnalysisId, setStartingAnalysisId] = useState("");
  const [notice, setNotice] = useState("");

  const latestBrief = briefs[0];
  const sourceReady = latestBrief?.sourceBundle?.status === "SYNCED";
  const briefReady = Boolean(latestBrief?.driveFileId);
  const notebookReady = Boolean(notebookUrl);
  const analysisReady = Boolean(latestBrief && sourceReady && briefReady && notebookReady);

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        const [briefResponse, notebookResponse] = await Promise.all([
          fetch(`/api/research/analysis-briefs?fieldDayId=${encodeURIComponent(projectId)}`, { cache: "no-store", signal: controller.signal }),
          fetch(`/api/research/notebook-link?fieldDayId=${encodeURIComponent(projectId)}`, { cache: "no-store", signal: controller.signal }),
        ]);
        const [briefData, notebookData] = await Promise.all([briefResponse.json(), notebookResponse.json()]);
        if (controller.signal.aborted) return;
        if (briefResponse.ok) setBriefs(briefData.briefs ?? []);
        if (notebookResponse.ok) setNotebookUrl(notebookData.link?.notebookUrl ?? "");
      } catch {
        if (!controller.signal.aborted) setNotice("분석 방향 정보를 불러오지 못했습니다.");
      }
    })();
    return () => controller.abort();
  }, [projectId]);

  async function createBrief() {
    if (!goal.trim() || saving) return;
    setSaving(true); setNotice("");
    try {
      const response = await fetch("/api/research/analysis-briefs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fieldDayId: projectId,
          title: title.trim(),
          goal: goal.trim(),
          researchQuestions: researchQuestions.trim(),
          decisionContext: decisionContext.trim(),
          evaluationCriteria: evaluationCriteria.trim(),
          additionalInstruction: additionalInstruction.trim(),
          outputType: "REPORT",
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "분석 브리프를 저장하지 못했습니다.");
      setBriefs((current) => [data.brief, ...current]);
      setTitle(""); setGoal(""); setResearchQuestions(""); setDecisionContext(""); setEvaluationCriteria(""); setAdditionalInstruction("");
      setNotice(data.warning || `Analysis Brief v${data.brief.version}을 저장했습니다.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "분석 브리프를 저장하지 못했습니다.");
    } finally { setSaving(false); }
  }

  async function syncBrief(brief: AnalysisBrief) {
    if (syncingBriefId) return;
    setSyncingBriefId(brief.id); setNotice("");
    try {
      const response = await fetch(`/api/research/analysis-briefs/${brief.id}/sync-drive`, { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Google Docs 동기화에 실패했습니다.");
      setBriefs((current) => current.map((item) => item.id === brief.id ? { ...item, ...data.brief } : item));
      setNotice(`Analysis Brief v${brief.version}을 Google Docs에 동기화했습니다.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Google Docs 동기화에 실패했습니다.");
    } finally { setSyncingBriefId(""); }
  }

  async function copyBrief(brief: AnalysisBrief) {
    await navigator.clipboard.writeText(buildBriefText(project.title, brief));
    setNotice(`Analysis Brief v${brief.version}을 클립보드에 복사했습니다.`);
  }

  async function startNotebookAnalysis(brief: AnalysisBrief) {
    if (!analysisReady || startingAnalysisId) return;
    setStartingAnalysisId(brief.id); setNotice("");
    try {
      const response = await fetch(`/api/research/analysis-briefs/${brief.id}/start-analysis`, { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "NotebookLM 분석 준비에 실패했습니다.");
      await navigator.clipboard.writeText(data.instruction);
      setBriefs((current) => current.map((item) => item.id === brief.id ? { ...item, status: data.brief.status } : item));
      window.open(data.notebookUrl, "_blank", "noopener,noreferrer");
      setNotice("NotebookLM 분석 지시문을 복사하고 연결된 Notebook을 열었습니다.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "NotebookLM 분석 준비에 실패했습니다.");
    } finally { setStartingAnalysisId(""); }
  }

  return <section className="paper-card mt-5 w-full min-w-0 overflow-hidden p-4 sm:p-5 md:p-6">
    <div className="border-b border-ui pb-5">
      <p className="text-sm font-extrabold text-orange">ANALYSIS DIRECTION</p>
      <h3 className="mt-1 text-xl font-extrabold">분석 방향 설정</h3>
      <p className="mt-1 text-sm text-secondary">현재 선택된 <strong>{project.title}</strong>의 자료를 어떤 관점으로 분석할지 설정합니다. 현장 선택은 페이지 최상단에서만 변경합니다.</p>
    </div>

    {notice && <p className="mt-4 rounded-xl bg-page p-3 text-sm text-secondary">{notice}</p>}

    <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
      <div className="grid gap-3">
        <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="분석 제목 예: 2026 푸드위크 시장성 분석" className={`${fieldClass} min-h-11 px-3`} />
        <textarea value={goal} onChange={(event) => setGoal(event.target.value)} placeholder="필수: 이번 자료로 무엇을 판단하고 싶은지 입력하세요." className={`${fieldClass} min-h-32 p-3`} />
        <textarea value={researchQuestions} onChange={(event) => setResearchQuestions(event.target.value)} placeholder="핵심 질문 예: 성장 카테고리는? 고객 니즈 변화는? 진입 기회와 리스크는?" className={`${fieldClass} min-h-24 p-3`} />
        <div className="grid gap-3 md:grid-cols-2">
          <textarea value={decisionContext} onChange={(event) => setDecisionContext(event.target.value)} placeholder="의사결정 맥락: 이 분석을 어디에 활용할지" className={`${fieldClass} min-h-24 p-3`} />
          <textarea value={evaluationCriteria} onChange={(event) => setEvaluationCriteria(event.target.value)} placeholder="평가 기준: 시장규모, 성장성, 차별화, 실행난이도 등" className={`${fieldClass} min-h-24 p-3`} />
        </div>
        <textarea value={additionalInstruction} onChange={(event) => setAdditionalInstruction(event.target.value)} placeholder="추가 지시: 반드시 포함할 관점, 제외할 내용, 원하는 보고서 톤 등" className={`${fieldClass} min-h-24 p-3`} />
        <button disabled={!goal.trim() || saving} onClick={() => void createBrief()} className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-orange px-4 text-sm font-extrabold disabled:opacity-40"><Plus size={16} />{saving ? "저장 중…" : "Analysis Brief 만들기"}</button>
      </div>

      <div className="grid gap-4">
        <div className="rounded-xl bg-page p-4">
          <div className="flex items-center gap-2"><FileText size={18} /><strong className="text-sm">최근 Analysis Brief</strong></div>
          {latestBrief ? <div className="mt-4 grid gap-3">
            <div className="rounded-xl bg-surface p-4"><div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-mint px-2 py-1 text-xs font-extrabold">v{latestBrief.version}</span><span className="text-xs font-bold text-secondary">{latestBrief.status}</span></div><h4 className="mt-2 font-extrabold">{latestBrief.title}</h4><p className="mt-2 whitespace-pre-wrap text-sm text-secondary">{latestBrief.goal}</p></div>
            <div className="flex flex-wrap gap-2">
              {latestBrief.driveFileId ? <a href={documentUrl(latestBrief)} target="_blank" rel="noreferrer" className="flex min-h-10 items-center gap-2 rounded-lg bg-surface px-3 text-xs font-extrabold">브리프 문서 열기 <ExternalLink size={14} /></a> : null}
              <button disabled={syncingBriefId === latestBrief.id} onClick={() => void syncBrief(latestBrief)} className="flex min-h-10 items-center gap-2 rounded-lg bg-surface px-3 text-xs font-extrabold disabled:opacity-50"><CloudUpload size={14} />{syncingBriefId === latestBrief.id ? "동기화 중…" : latestBrief.driveFileId ? "다시 동기화" : "Google Docs 동기화"}</button>
              <button onClick={() => void copyBrief(latestBrief)} className="flex min-h-10 items-center gap-2 rounded-lg bg-surface px-3 text-xs font-extrabold"><Clipboard size={14} />내용 복사</button>
            </div>
          </div> : <p className="mt-4 text-sm text-secondary">아직 저장된 분석 방향이 없습니다.</p>}
        </div>

        {latestBrief && <div className="rounded-xl bg-page p-4">
          <h4 className="font-extrabold">NotebookLM 분석 준비</h4>
          <div className="mt-3 grid gap-2">
            <ReadinessRow ready={sourceReady} label="Source Bundle Drive 동기화" />
            <ReadinessRow ready={briefReady} label="Analysis Brief Google Docs 동기화" />
            <ReadinessRow ready={notebookReady} label="NotebookLM 주소 연결" />
          </div>
          <button disabled={!analysisReady || startingAnalysisId === latestBrief.id} onClick={() => void startNotebookAnalysis(latestBrief)} className="mt-4 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-ink px-4 text-sm font-extrabold text-white disabled:opacity-40"><PlayCircle size={17} />{startingAnalysisId === latestBrief.id ? "준비 중…" : "NotebookLM에서 분석 이어가기"}</button>
          {!notebookReady && <p className="mt-2 text-xs text-secondary">NotebookLM 주소는 위의 `사전조사 · 방문 준비` 영역에서 연결합니다.</p>}
        </div>}
      </div>
    </div>
  </section>;
}

function ReadinessRow({ ready, label }: { ready: boolean; label: string }) {
  return <div className="flex items-center gap-2 rounded-lg bg-surface px-3 py-2 text-xs font-bold"><span className={`flex h-5 w-5 items-center justify-center rounded-full ${ready ? "bg-mint" : "bg-page text-secondary"}`}>{ready ? <Check size={12} /> : "·"}</span>{label}</div>;
}
