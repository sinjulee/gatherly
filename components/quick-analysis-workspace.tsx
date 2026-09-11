"use client";

import { useEffect, useMemo, useState } from "react";
import { Activity, Check, Clock3, RefreshCw, Sparkles, TriangleAlert } from "lucide-react";

type Project = { id: string; title: string };
type BriefRef = { id: string; version: number; title: string } | null;
type QuickJob = {
  id: string;
  fieldDayId: string;
  title: string;
  instruction: string;
  status: string;
  resultMarkdown: string | null;
  errorMessageSafe: string | null;
  queuedAt: string;
  startedAt: string | null;
  completedAt: string | null;
  analysisBrief: BriefRef;
};
type WorkerState = {
  online: boolean;
  ageMs: number | null;
  pid?: number | null;
  updatedAt?: string | null;
  codexVersion?: string | null;
  state?: string | null;
};

const statusLabel: Record<string, string> = {
  QUEUED: "분석 대기",
  RUNNING: "Codex 분석 중",
  COMPLETED: "Quick Report 완료",
  FAILED: "분석 실패",
};

function statusIcon(status: string) {
  if (status === "COMPLETED") return <Check size={15} />;
  if (status === "FAILED") return <TriangleAlert size={15} />;
  if (status === "RUNNING") return <Activity size={15} />;
  return <Clock3 size={15} />;
}

export function QuickAnalysisWorkspace({ projects }: { projects: Project[] }) {
  const [projectId, setProjectId] = useState(projects[0]?.id ?? "");
  const [instruction, setInstruction] = useState("");
  const [jobs, setJobs] = useState<QuickJob[]>([]);
  const [worker, setWorker] = useState<WorkerState>({ online: false, ageMs: null });
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState("");

  const projectTitle = useMemo(() => projects.find((project) => project.id === projectId)?.title ?? "", [projects, projectId]);
  const latestJob = jobs[0];

  useEffect(() => {
    if (!projectId) return;
    let alive = true;

    async function load() {
      try {
        const response = await fetch(`/api/research/quick-analysis?fieldDayId=${encodeURIComponent(projectId)}`, { cache: "no-store" });
        const data = await response.json();
        if (!alive || !response.ok) return;
        setJobs(data.jobs ?? []);
        setWorker(data.worker ?? { online: false, ageMs: null });
      } catch {
        if (alive) setWorker({ online: false, ageMs: null });
      }
    }

    void load();
    const timer = window.setInterval(() => void load(), 3000);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, [projectId]);

  async function requestAnalysis() {
    if (!projectId || !instruction.trim() || submitting) return;
    setSubmitting(true);
    setNotice("");
    try {
      const response = await fetch("/api/research/quick-analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fieldDayId: projectId, instruction: instruction.trim() }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "빠른 분석 요청에 실패했습니다.");
      setJobs((current) => [data.job, ...current.filter((job) => job.id !== data.job.id)]);
      setWorker(data.worker ?? worker);
      if (!data.reused) setInstruction("");
      setNotice(data.reused ? "이미 진행 중인 분석이 있어 해당 작업을 계속 확인합니다." : "Mac mini에 Quick Analysis를 요청했습니다. 이 화면에서 결과가 자동 갱신됩니다.");
    } catch (cause) {
      setNotice(cause instanceof Error ? cause.message : "빠른 분석 요청에 실패했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  function applyPreset(text: string) {
    setInstruction(text);
  }

  return (
    <section className="collage-card mt-5 bg-orange p-5 md:p-6">
      <div className="flex flex-col gap-4 border-b border-ink/15 pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-extrabold">FIELD QUICK ANALYSIS</p>
          <h2 className="mt-1 text-2xl font-extrabold">현장에서 바로 분석하기</h2>
          <p className="mt-1 max-w-3xl text-sm">아이폰에서 요청하면 Mac mini의 Codex CLI가 현재 현장자료와 최신 Analysis Brief를 읽고 Quick Report를 만듭니다. NotebookLM을 열 필요가 없습니다.</p>
        </div>
        <label className="text-sm font-extrabold">
          현장
          <select value={projectId} onChange={(event) => { setProjectId(event.target.value); setJobs([]); setNotice(""); }} className="ml-3 min-h-11 rounded-lg border border-ink/20 bg-surface px-3">
            <option value="">선택</option>
            {projects.map((project) => <option key={project.id} value={project.id}>{project.title}</option>)}
          </select>
        </label>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-xl bg-surface/95 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <strong className="text-sm">{projectTitle || "현장을 선택하세요"}</strong>
            <span className={`flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-extrabold ${worker.online ? "bg-mint" : "bg-page text-secondary"}`}>
              <Activity size={12} />{worker.online ? "Mac mini 분석 엔진 연결됨" : "분석 엔진 확인 필요"}
            </span>
          </div>
          {worker.codexVersion && <p className="mt-2 text-[11px] font-semibold text-secondary">{worker.codexVersion}</p>}
          <textarea value={instruction} onChange={(event) => setInstruction(event.target.value)} placeholder="지금 알고 싶은 것을 바로 입력하세요. 예) 지금까지 본 탄소저감 AI 기술 중 물류 현장에 적용 가능성이 높은 5개를 근거와 함께 우선순위로 정리해줘." className="mt-4 min-h-32 w-full rounded-xl border border-ui bg-page p-3 text-sm" />
          <div className="mt-2 flex flex-wrap gap-2">
            <button type="button" onClick={() => applyPreset("지금까지 수집한 자료의 핵심 발견을 5개 이내로 요약하고, 각 발견의 현장 근거를 연결해줘.")} className="rounded-full bg-page px-3 py-2 text-xs font-bold">핵심 요약</button>
            <button type="button" onClick={() => applyPreset("지금까지 수집한 자료에서 가장 중요한 기회와 리스크를 우선순위로 분석하고, 현장에서 추가로 확인해야 할 사항을 알려줘.")} className="rounded-full bg-page px-3 py-2 text-xs font-bold">기회·리스크</button>
            <button type="button" onClick={() => applyPreset("현재 자료만으로 부족한 정보가 무엇인지 찾아서, 남은 현장 시간 동안 추가로 조사하거나 촬영하거나 질문해야 할 항목을 우선순위로 정리해줘.")} className="rounded-full bg-page px-3 py-2 text-xs font-bold">추가 조사 목록</button>
          </div>
          <button disabled={!projectId || !instruction.trim() || submitting} onClick={() => void requestAnalysis()} className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-ink px-4 text-sm font-extrabold text-white disabled:opacity-40"><Sparkles size={18} />{submitting ? "요청 중…" : "빠른 분석 요청"}</button>
          {!worker.online && <p className="mt-3 text-xs font-semibold text-secondary">웹 서버가 방금 재시작된 경우 잠시 후 자동 연결됩니다. 계속 오프라인이면 Mac mini에서 Gatherly 서버와 Quick Analysis worker 상태를 확인하세요.</p>}
        </div>

        <div className="rounded-xl bg-page p-4">
          <div className="flex items-center justify-between gap-3"><div><p className="text-xs font-extrabold text-secondary">LIVE RESULT</p><h3 className="mt-1 text-lg font-extrabold">Quick Report</h3></div>{latestJob && <span className="flex items-center gap-1 rounded-full bg-surface px-3 py-2 text-xs font-extrabold">{statusIcon(latestJob.status)}{statusLabel[latestJob.status] ?? latestJob.status}</span>}</div>
          {!latestJob && <div className="py-12 text-center text-sm text-secondary">빠른 분석을 요청하면 결과가 이곳에 자동으로 나타납니다.</div>}
          {latestJob && <div className="mt-4"><div className="rounded-xl bg-surface p-3"><p className="text-xs font-bold text-secondary">요청</p><p className="mt-1 whitespace-pre-wrap text-sm font-semibold">{latestJob.instruction}</p>{latestJob.analysisBrief && <p className="mt-2 text-[11px] font-semibold text-secondary">Analysis Brief v{latestJob.analysisBrief.version} 반영 · {latestJob.analysisBrief.title}</p>}</div>{(latestJob.status === "QUEUED" || latestJob.status === "RUNNING") && <div className="mt-3 flex items-center gap-2 rounded-xl bg-mint/45 p-4 text-sm font-bold"><RefreshCw size={17} className="animate-spin" />{latestJob.status === "RUNNING" ? "Mac mini의 Codex가 현장자료를 분석하고 있습니다…" : "Mac mini 분석 대기열에 등록됐습니다…"}</div>}{latestJob.status === "FAILED" && <div className="mt-3 rounded-xl bg-surface p-4"><p className="flex items-center gap-2 text-sm font-extrabold"><TriangleAlert size={17} />분석을 완료하지 못했습니다.</p><p className="mt-2 break-words text-xs text-secondary">{latestJob.errorMessageSafe || "Mac mini의 Codex CLI 상태를 확인해 주세요."}</p></div>}{latestJob.status === "COMPLETED" && latestJob.resultMarkdown && <article className="mt-3 max-h-[70vh] overflow-y-auto rounded-xl bg-surface p-4"><div className="whitespace-pre-wrap break-words text-[13px] leading-6">{latestJob.resultMarkdown}</div></article>}</div>}
        </div>
      </div>

      {notice && <p className="mt-4 rounded-xl bg-surface/80 p-3 text-sm font-semibold">{notice}</p>}
      {jobs.length > 1 && <details className="mt-4 rounded-xl bg-surface/70 p-4"><summary className="cursor-pointer text-sm font-extrabold">이전 Quick Analysis {jobs.length - 1}건</summary><div className="mt-3 grid gap-2">{jobs.slice(1, 6).map((job) => <div key={job.id} className="flex items-center justify-between gap-3 rounded-lg bg-page p-3"><div className="min-w-0"><p className="truncate text-xs font-extrabold">{job.title}</p><p className="mt-1 text-[11px] text-secondary">{new Date(job.queuedAt).toLocaleString("ko-KR")}</p></div><span className="shrink-0 text-xs font-bold">{statusLabel[job.status] ?? job.status}</span></div>)}</div></details>}
    </section>
  );
}
