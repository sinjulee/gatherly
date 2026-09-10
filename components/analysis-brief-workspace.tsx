"use client";

import { useEffect, useMemo, useState } from "react";
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
  if (brief.targetScope) lines.push("", "## 포함 범위", brief.targetScope);
  if (brief.excludeScope) lines.push("", "## 제외 범위", brief.excludeScope);
  if (brief.additionalInstruction) lines.push("", "## 추가 지시", brief.additionalInstruction);

  lines.push(
    "",
    "## 결과물 요구",
    "Gatherly에서 제공한 현장자료를 우선 근거로 사용하고, 필요한 경우 신뢰할 수 있는 외부 조사를 보완하세요. 사실과 해석을 구분하고, 핵심 주장에는 근거를 연결하세요. 중요한 이미지가 있으면 해당 근거와 함께 적절히 활용하세요.",
  );

  return lines.join("\n");
}

function briefStatusLabel(status: string) {
  const labels: Record<string, string> = {
    READY: "브리프 저장됨",
    SYNCED: "Google Docs 동기화됨",
    IN_ANALYSIS: "NotebookLM 분석 진행중",
  };
  return labels[status] ?? status;
}

function documentUrl(brief: AnalysisBrief) {
  return brief.documentUrl || (brief.driveFileId ? `https://docs.google.com/document/d/${brief.driveFileId}/edit` : "");
}

export function AnalysisBriefWorkspace({ projects }: { projects: Project[] }) {
  const [projectId, setProjectId] = useState(projects[0]?.id ?? "");
  const [briefs, setBriefs] = useState<AnalysisBrief[]>([]);
  const [title, setTitle] = useState("");
  const [goal, setGoal] = useState("");
  const [researchQuestions, setResearchQuestions] = useState("");
  const [decisionContext, setDecisionContext] = useState("");
  const [evaluationCriteria, setEvaluationCriteria] = useState("");
  const [additionalInstruction, setAdditionalInstruction] = useState("");
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [notebookUrl, setNotebookUrl] = useState("");
  const [syncingBriefId, setSyncingBriefId] = useState("");
  const [startingAnalysisId, setStartingAnalysisId] = useState("");

  const projectTitle = useMemo(() => projects.find((project) => project.id === projectId)?.title ?? "", [projects, projectId]);
  const latestBrief = briefs[0];
  const sourceReady = latestBrief?.sourceBundle?.status === "SYNCED";
  const briefReady = Boolean(latestBrief?.driveFileId);
  const notebookReady = Boolean(notebookUrl);
  const analysisReady = Boolean(latestBrief && sourceReady && briefReady && notebookReady);

  useEffect(() => {
    if (!projectId) return;
    const controller = new AbortController();

    void (async () => {
      try {
        const [briefResponse, notebookResponse] = await Promise.all([
          fetch(`/api/research/analysis-briefs?fieldDayId=${encodeURIComponent(projectId)}`, { cache: "no-store", signal: controller.signal }),
          fetch(`/api/research/notebook-link?fieldDayId=${encodeURIComponent(projectId)}`, { cache: "no-store", signal: controller.signal }),
        ]);

        const briefData = await briefResponse.json();
        const notebookData = await notebookResponse.json();
        if (briefResponse.ok) setBriefs(briefData.briefs ?? []);
        if (notebookResponse.ok) setNotebookUrl(notebookData.link?.notebookUrl ?? "");
      } catch {
        if (!controller.signal.aborted) {
          setBriefs([]);
          setNotebookUrl("");
        }
      }
    })();

    return () => controller.abort();
  }, [projectId]);

  async function createBrief() {
    if (!projectId || !goal.trim() || saving) return;
    setSaving(true);
    setNotice("");

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
      setTitle("");
      setGoal("");
      setResearchQuestions("");
      setDecisionContext("");
      setEvaluationCriteria("");
      setAdditionalInstruction("");
      setNotice(data.warning || `Analysis Brief v${data.brief.version}을 저장하고 Google Docs에 동기화했습니다.`);
    } catch (cause) {
      setNotice(cause instanceof Error ? cause.message : "분석 브리프를 저장하지 못했습니다.");
    } finally {
      setSaving(false);
    }
  }

  async function copyBrief(brief: AnalysisBrief) {
    await navigator.clipboard.writeText(buildBriefText(projectTitle, brief));
    setNotice(`Analysis Brief v${brief.version}을 클립보드에 복사했습니다.`);
  }

  async function syncBrief(brief: AnalysisBrief) {
    if (syncingBriefId) return;
    setSyncingBriefId(brief.id);
    setNotice("");
    try {
      const response = await fetch(`/api/research/analysis-briefs/${brief.id}/sync-drive`, { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Google Docs 동기화에 실패했습니다.");
      setBriefs((current) => current.map((item) => item.id === brief.id ? { ...item, ...data.brief } : item));
      setNotice(`Analysis Brief v${brief.version}을 Google Docs에 동기화했습니다.`);
    } catch (cause) {
      setNotice(cause instanceof Error ? cause.message : "Google Docs 동기화에 실패했습니다.");
    } finally {
      setSyncingBriefId("");
    }
  }

  async function startNotebookAnalysis(brief: AnalysisBrief) {
    if (!analysisReady || startingAnalysisId) return;
    setStartingAnalysisId(brief.id);
    setNotice("");

    try {
      const response = await fetch(`/api/research/analysis-briefs/${brief.id}/start-analysis`, { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "NotebookLM 분석을 시작할 준비가 되지 않았습니다.");

      await navigator.clipboard.writeText(data.instruction);
      setBriefs((current) => current.map((item) => item.id === brief.id ? { ...item, status: data.brief.status } : item));
      window.open(data.notebookUrl, "_blank", "noopener,noreferrer");
      setNotice("NotebookLM 분석 지시문을 복사했고 Notebook을 열었습니다. 열린 NotebookLM 채팅창에 붙여넣어 분석을 시작하세요.");
    } catch (cause) {
      setNotice(cause instanceof Error ? cause.message : "NotebookLM 분석 준비에 실패했습니다.");
    } finally {
      setStartingAnalysisId("");
    }
  }

  return (
    <section className="paper-card mt-5 p-5 md:p-6">
      <div className="flex flex-col gap-4 border-b border-ui pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-extrabold text-orange">ANALYSIS DIRECTION</p>
          <h3 className="mt-1 text-xl font-extrabold">분석 방향 설정</h3>
          <p className="mt-1 text-sm text-secondary">같은 현장자료라도 시장성, 마케팅 전략, 경쟁사 분석처럼 목적에 따라 별도의 Analysis Brief를 만듭니다.</p>
        </div>
        <label className="text-sm font-semibold">
          현장 프로젝트
          <select
            className="ml-3 min-h-11 rounded-lg border border-ui bg-surface px-3"
            value={projectId}
            onChange={(event) => {
              setProjectId(event.target.value);
              setBriefs([]);
              setNotebookUrl("");
              setNotice("");
            }}
          >
            <option value="">선택</option>
            {projects.map((project) => <option key={project.id} value={project.id}>{project.title}</option>)}
          </select>
        </label>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="grid gap-3">
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="분석 제목 예: 2026 푸드위크 시장성 분석"
            className="min-h-11 rounded-xl border border-ui bg-surface px-3 text-sm"
          />
          <textarea
            value={goal}
            onChange={(event) => setGoal(event.target.value)}
            placeholder="필수: 이번 자료로 무엇을 판단하고 싶은지 입력하세요. 예) 푸드위크 참가 기업과 현장 트렌드를 바탕으로 2027년 식품시장 사업기회를 평가해줘."
            className="min-h-32 rounded-xl border border-ui bg-surface p-3 text-sm"
          />
          <textarea
            value={researchQuestions}
            onChange={(event) => setResearchQuestions(event.target.value)}
            placeholder="핵심 질문 예: 성장 카테고리는? 고객 니즈 변화는? 진입 기회와 리스크는?"
            className="min-h-24 rounded-xl border border-ui bg-surface p-3 text-sm"
          />
          <div className="grid gap-3 md:grid-cols-2">
            <textarea
              value={decisionContext}
              onChange={(event) => setDecisionContext(event.target.value)}
              placeholder="의사결정 맥락: 이 분석을 어디에 활용할지"
              className="min-h-24 rounded-xl border border-ui bg-surface p-3 text-sm"
            />
            <textarea
              value={evaluationCriteria}
              onChange={(event) => setEvaluationCriteria(event.target.value)}
              placeholder="평가 기준: 시장규모, 성장성, 차별화, 실행난이도 등"
              className="min-h-24 rounded-xl border border-ui bg-surface p-3 text-sm"
            />
          </div>
          <textarea
            value={additionalInstruction}
            onChange={(event) => setAdditionalInstruction(event.target.value)}
            placeholder="추가 지시: 반드시 포함할 관점, 제외할 내용, 원하는 보고서 톤 등"
            className="min-h-24 rounded-xl border border-ui bg-surface p-3 text-sm"
          />
          <button
            disabled={!projectId || !goal.trim() || saving}
            onClick={() => void createBrief()}
            className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-orange px-4 text-sm font-extrabold disabled:opacity-40"
          >
            <Plus size={16} />{saving ? "저장·동기화 중…" : "Analysis Brief 만들기"}
          </button>
        </div>

        <div className="grid gap-4">
          <div className="rounded-xl bg-page p-4">
            <div className="flex items-center gap-2"><FileText size={18} /><strong className="text-sm">최근 Analysis Brief</strong></div>
            {latestBrief ? (
              <div className="mt-4 grid gap-3">
                <div className="rounded-xl bg-surface p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-mint px-2 py-1 text-xs font-extrabold">{briefStatusLabel(latestBrief.status)}</span>
                    <span className="text-xs font-bold text-secondary">v{latestBrief.version}</span>
                  </div>
                  <h4 className="mt-2 font-extrabold">{latestBrief.title}</h4>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-secondary">{latestBrief.goal}</p>
                  {latestBrief.sourceBundle && <p className="mt-3 text-xs font-semibold text-secondary">연결 Source Bundle: v{latestBrief.sourceBundle.version} · {latestBrief.sourceBundle.status}</p>}
                </div>

                {latestBrief.driveFileId ? (
                  <div className="rounded-xl bg-mint/40 p-3">
                    <div className="flex items-center gap-2 text-sm font-extrabold"><Check size={16} />Google Docs 동기화됨</div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <a href={documentUrl(latestBrief)} target="_blank" rel="noreferrer" className="flex min-h-10 items-center gap-2 rounded-lg bg-surface px-3 text-xs font-extrabold">브리프 문서 열기 <ExternalLink size={14} /></a>
                      <button disabled={syncingBriefId === latestBrief.id} onClick={() => void syncBrief(latestBrief)} className="flex min-h-10 items-center gap-2 rounded-lg bg-surface px-3 text-xs font-extrabold disabled:opacity-50"><RefreshCw size={14} />{syncingBriefId === latestBrief.id ? "동기화 중…" : "다시 동기화"}</button>
                    </div>
                  </div>
                ) : (
                  <button disabled={syncingBriefId === latestBrief.id} onClick={() => void syncBrief(latestBrief)} className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-orange px-4 text-sm font-extrabold disabled:opacity-50"><CloudUpload size={16} />{syncingBriefId === latestBrief.id ? "Google Docs 동기화 중…" : "Google Docs에 동기화"}</button>
                )}

                <button onClick={() => void copyBrief(latestBrief)} className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-surface px-4 text-sm font-extrabold"><Clipboard size={16} />브리프 내용 복사</button>
              </div>
            ) : (
              <p className="mt-4 text-sm text-secondary">아직 저장된 분석 방향이 없습니다. 첫 Analysis Brief를 만들어 주세요.</p>
            )}
          </div>

          {latestBrief && (
            <div className="rounded-xl bg-page p-4">
              <p className="text-xs font-extrabold text-orange">NOTEBOOKLM ANALYSIS</p>
              <h4 className="mt-1 font-extrabold">NotebookLM 분석 실행</h4>
              <p className="mt-1 text-xs text-secondary">세 가지 준비가 완료되면 분석 지시문을 자동 복사하고 연결된 NotebookLM을 엽니다.</p>

              <div className="mt-4 grid gap-2">
                <ReadinessRow ready={sourceReady} label="1. Source Bundle Google Drive 동기화" />
                <ReadinessRow ready={briefReady} label="2. Analysis Brief Google Docs 동기화" />
                <ReadinessRow ready={notebookReady} label="3. 프로젝트 NotebookLM 연결" />
              </div>

              <button
                disabled={!analysisReady || startingAnalysisId === latestBrief.id}
                onClick={() => void startNotebookAnalysis(latestBrief)}
                className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-mint px-4 text-sm font-extrabold disabled:opacity-40"
              >
                <PlayCircle size={18} />{startingAnalysisId === latestBrief.id ? "분석 준비 중…" : latestBrief.status === "IN_ANALYSIS" ? "NotebookLM 다시 열기" : "NotebookLM 분석 시작"}
              </button>

              {!analysisReady && (
                <p className="mt-3 text-xs font-semibold text-secondary">
                  {!sourceReady ? "먼저 연결 Source Bundle을 Google Drive에 동기화해 주세요." : !briefReady ? "먼저 브리프를 Google Docs에 동기화해 주세요." : "먼저 이 프로젝트의 NotebookLM 주소를 연결해 주세요."}
                </p>
              )}
              {analysisReady && <p className="mt-3 text-xs font-semibold text-secondary">버튼을 누르면 분석 지시문이 클립보드에 복사됩니다. 열린 NotebookLM 채팅창에 붙여넣으면 됩니다.</p>}
            </div>
          )}
        </div>
      </div>

      {notice && <p className="mt-4 flex items-center gap-2 rounded-xl bg-mint/40 p-3 text-sm font-semibold"><Check size={16} />{notice}</p>}

      {briefs.length > 1 && (
        <div className="mt-5 border-t border-ui pt-4">
          <p className="text-sm font-extrabold">이전 분석 방향</p>
          <div className="mt-3 grid gap-2">
            {briefs.slice(1).map((brief) => (
              <div key={brief.id} className="flex flex-col gap-2 rounded-xl bg-page p-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2"><strong className="text-sm">v{brief.version} · {brief.title}</strong><span className="rounded-full bg-surface px-2 py-1 text-[11px] font-bold text-secondary">{briefStatusLabel(brief.status)}</span></div>
                  <p className="mt-1 line-clamp-2 text-xs text-secondary">{brief.goal}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {brief.driveFileId && <a href={documentUrl(brief)} target="_blank" rel="noreferrer" className="min-h-9 rounded-lg bg-surface px-3 py-2 text-xs font-extrabold">문서 열기</a>}
                  <button disabled={syncingBriefId === brief.id} onClick={() => void syncBrief(brief)} className="min-h-9 rounded-lg bg-surface px-3 text-xs font-extrabold disabled:opacity-50">{brief.driveFileId ? "다시 동기화" : "Drive 동기화"}</button>
                  <button onClick={() => void copyBrief(brief)} className="min-h-9 rounded-lg bg-surface px-3 text-xs font-extrabold">브리프 복사</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function ReadinessRow({ ready, label }: { ready: boolean; label: string }) {
  return <div className="flex items-center justify-between rounded-lg bg-surface px-3 py-2 text-xs font-bold"><span>{label}</span><span className={ready ? "font-extrabold" : "text-secondary"}>{ready ? "완료" : "대기"}</span></div>;
}
