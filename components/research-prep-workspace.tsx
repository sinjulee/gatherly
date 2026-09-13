"use client";

import { useEffect, useState } from "react";
import { ExternalLink, FolderOpen, RefreshCw } from "lucide-react";

type Project = { id: string; title: string };
type Workspace = { id: string; name: string; webViewLink?: string };
type Candidate = Workspace & { legacy?: boolean };
type Source = { id: string; name: string; mimeType: string | null; webViewLink: string | null; sourceType: string; selectedForPlan: boolean };

export function ResearchPrepWorkspace({ project }: { project: Project }) {
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [sources, setSources] = useState<Source[]>([]);
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");

  async function loadWorkspace() {
    const response = await fetch(`/api/research/drive-workspace?fieldDayId=${encodeURIComponent(project.id)}`, { cache: "no-store" });
    const data = await response.json();
    if (response.ok) {
      setWorkspace(data.workspace || null);
      if (data.warning) setNotice(data.warning);
    }
  }

  async function loadCandidates() {
    const response = await fetch(`/api/research/drive-workspace/candidates?fieldDayId=${encodeURIComponent(project.id)}`, { cache: "no-store" });
    const data = await response.json();
    if (response.ok) setCandidates(data.candidates || []);
  }

  async function loadSources() {
    const response = await fetch(`/api/research/pre-research-sources?fieldDayId=${encodeURIComponent(project.id)}`, { cache: "no-store" });
    const data = await response.json();
    if (response.ok) setSources(data.sources || []);
  }

  useEffect(() => {
    void Promise.all([loadWorkspace(), loadCandidates(), loadSources()]);
  }, [project.id]);

  async function createWorkspace() {
    setBusy("create"); setNotice("");
    try {
      const response = await fetch("/api/research/drive-workspace/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fieldDayId: project.id }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Drive Workspace를 만들지 못했습니다.");
      setWorkspace(data.workspace);
      setNotice("현장 Drive Workspace를 연결했습니다.");
      await loadCandidates();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Drive Workspace를 만들지 못했습니다.");
    } finally { setBusy(""); }
  }

  async function linkWorkspace(folderId: string) {
    setBusy(folderId); setNotice("");
    try {
      const response = await fetch("/api/research/drive-workspace/link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fieldDayId: project.id, folderId }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Drive Workspace를 연결하지 못했습니다.");
      setWorkspace(data.workspace);
      setNotice("기존 Drive 폴더를 현장 Workspace로 연결했습니다.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Drive Workspace를 연결하지 못했습니다.");
    } finally { setBusy(""); }
  }

  async function scanSources() {
    setBusy("scan"); setNotice("");
    try {
      const response = await fetch("/api/research/drive-workspace/scan-pre-research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fieldDayId: project.id }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "사전조사 자료를 스캔하지 못했습니다.");
      await loadSources();
      setNotice(`00_사전조사에서 ${data.sourceCount ?? 0}개 자료를 확인했습니다.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "사전조사 자료를 스캔하지 못했습니다.");
    } finally { setBusy(""); }
  }

  async function toggleSource(source: Source) {
    const response = await fetch(`/api/research/pre-research-sources/${source.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ selectedForPlan: !source.selectedForPlan }),
    });
    const data = await response.json();
    if (!response.ok) { setNotice(data.error || "자료 선택을 변경하지 못했습니다."); return; }
    setSources((current) => current.map((item) => item.id === source.id ? data.source : item));
  }

  return <section className="paper-card mt-5 p-5 md:p-6">
    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
      <div>
        <p className="text-xs font-extrabold text-orange">PRE-RESEARCH · DRIVE WORKSPACE</p>
        <h3 className="mt-1 text-xl font-extrabold">사전조사 · 방문 준비</h3>
        <p className="mt-1 text-sm text-secondary">NotebookLM 사전조사와 Gatherly 현장조사를 같은 프로젝트 폴더로 연결합니다.</p>
      </div>
      {workspace?.webViewLink && <a href={workspace.webViewLink} target="_blank" rel="noreferrer" className="flex min-h-10 items-center gap-2 rounded-xl bg-surface px-3 text-xs font-extrabold">Drive 열기 <ExternalLink size={14} /></a>}
    </div>

    {notice && <p className="mt-4 rounded-xl bg-page p-3 text-sm text-secondary">{notice}</p>}

    <div className="mt-4 rounded-xl bg-page p-4">
      {workspace ? <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div><strong>{workspace.name}</strong><p className="mt-1 text-xs text-secondary">folderId로 연결됨 · 폴더명을 바꿔도 연결은 유지됩니다.</p></div>
        <button disabled={busy === "scan"} onClick={() => void scanSources()} className="flex min-h-10 items-center justify-center gap-2 rounded-xl bg-mint px-4 text-xs font-extrabold disabled:opacity-50"><RefreshCw size={15} />{busy === "scan" ? "스캔 중…" : "00_사전조사 새로고침"}</button>
      </div> : <div>
        <p className="text-sm font-bold">아직 연결된 Drive Workspace가 없습니다.</p>
        <button disabled={Boolean(busy)} onClick={() => void createWorkspace()} className="mt-3 flex min-h-10 items-center gap-2 rounded-xl bg-orange px-4 text-xs font-extrabold disabled:opacity-50"><FolderOpen size={15} />{busy === "create" ? "생성 중…" : `${project.title} Workspace 만들기`}</button>
      </div>}
    </div>

    {!workspace && candidates.length > 0 && <div className="mt-4">
      <p className="text-sm font-extrabold">기존 Drive 폴더 후보</p>
      <div className="mt-2 grid gap-2">{candidates.map((candidate) => <div key={candidate.id} className="flex flex-col gap-2 rounded-xl border border-ui p-3 sm:flex-row sm:items-center sm:justify-between"><div><strong className="text-sm">{candidate.name}</strong><p className="text-xs text-secondary">{candidate.legacy ? "기존 ID 포함 폴더 · 재연결 가능" : "현장명 Workspace"}</p></div><button disabled={Boolean(busy)} onClick={() => void linkWorkspace(candidate.id)} className="min-h-9 rounded-lg bg-surface px-3 text-xs font-extrabold">{busy === candidate.id ? "연결 중…" : "이 폴더 연결"}</button></div>)}</div>
    </div>}

    <div className="mt-5 border-t border-ui pt-4">
      <div className="flex items-center justify-between"><div><h4 className="font-extrabold">00_사전조사 자료</h4><p className="mt-1 text-xs text-secondary">Research Plan 생성에 사용할 자료만 선택합니다. 원본 파일은 수정하지 않습니다.</p></div><span className="rounded-full bg-surface px-3 py-1 text-xs font-bold">선택 {sources.filter((source) => source.selectedForPlan).length} / {sources.length}</span></div>
      <div className="mt-3 grid gap-2">{sources.map((source) => <label key={source.id} className="flex cursor-pointer items-start gap-3 rounded-xl bg-page p-3"><input type="checkbox" className="mt-1 h-5 w-5" checked={source.selectedForPlan} onChange={() => void toggleSource(source)} /><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><strong className="truncate text-sm">{source.name}</strong>{source.webViewLink && <a href={source.webViewLink} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()} className="text-secondary"><ExternalLink size={14} /></a>}</div><p className="mt-1 text-xs text-secondary">{source.sourceType} · {source.mimeType || "파일"}</p></div></label>)}{workspace && !sources.length && <p className="py-5 text-center text-sm text-secondary">아직 스캔된 사전조사 자료가 없습니다. `00_사전조사 새로고침`을 눌러 주세요.</p>}</div>
    </div>
  </section>;
}
