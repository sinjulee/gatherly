"use client";

import { useMemo, useState } from "react";
import { Check, Database, ExternalLink, FileStack, Star } from "lucide-react";

type Project = { id: string; title: string; location: string | null; fieldDate: string };
type ResearchMaterial = { id: string; fieldDayId: string | null; type: string; title: string; reviewStatus: string; isImportant: boolean; createdAt: string };
type Bundle = { id: string; fieldDayId: string; version: number; title: string; status: string; createdAt: string; _count: { items: number; sourceDocuments: number } };

const statusLabel: Record<string, string> = {
  COLLECTED: "수집됨",
  REVIEWED: "검토됨",
  CURATED: "연구선정",
  EXCLUDED: "제외",
  SYNC_READY: "NotebookLM 준비",
  SYNCED: "동기화됨",
};

export function ResearchPipelineWorkspace({ projects, initialMaterials, initialBundles }: { projects: Project[]; initialMaterials: ResearchMaterial[]; initialBundles: Bundle[] }) {
  const [projectId, setProjectId] = useState(projects[0]?.id ?? "");
  const [materials, setMaterials] = useState(initialMaterials);
  const [bundles, setBundles] = useState(initialBundles);
  const [selected, setSelected] = useState<string[]>([]);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  const projectMaterials = useMemo(() => materials.filter((item) => item.fieldDayId === projectId), [materials, projectId]);
  const projectBundles = useMemo(() => bundles.filter((item) => item.fieldDayId === projectId), [bundles, projectId]);
  const curatedCount = projectMaterials.filter((item) => ["CURATED", "SYNC_READY", "SYNCED"].includes(item.reviewStatus)).length;

  async function updateMaterial(id: string, values: { reviewStatus?: string; isImportant?: boolean }) {
    const response = await fetch(`/api/research/materials/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(values) });
    const data = await response.json();
    if (!response.ok) { setNotice(data.error || "자료 상태를 변경하지 못했습니다."); return; }
    setMaterials((current) => current.map((item) => item.id === id ? { ...item, reviewStatus: data.material.reviewStatus, isImportant: data.material.isImportant } : item));
  }

  async function createBundle() {
    if (!projectId || !selected.length || busy) return;
    setBusy(true); setNotice("");
    try {
      const response = await fetch("/api/research/source-bundles", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fieldDayId: projectId, materialIds: selected }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Source Bundle을 생성하지 못했습니다.");
      const listResponse = await fetch(`/api/research/source-bundles?fieldDayId=${encodeURIComponent(projectId)}`, { cache: "no-store" });
      const listData = await listResponse.json();
      if (listResponse.ok) setBundles((current) => [...current.filter((item) => item.fieldDayId !== projectId), ...listData.bundles]);
      setMaterials((current) => current.map((item) => selected.includes(item.id) ? { ...item, reviewStatus: "SYNC_READY" } : item));
      setSelected([]);
      setNotice(`${data.materialCount}개 자료로 NotebookLM Source Bundle v${data.bundle.version}을 만들었습니다.`);
    } catch (cause) {
      setNotice(cause instanceof Error ? cause.message : "Source Bundle을 생성하지 못했습니다.");
    } finally { setBusy(false); }
  }

  return <div className="mt-7 grid gap-5">
    <section className="paper-card p-5 md:p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div><p className="text-sm font-semibold text-secondary">RESEARCH PIPELINE</p><h2 className="mt-1 text-2xl font-extrabold">NotebookLM 연구 준비</h2><p className="mt-1 text-sm text-secondary">현장자료를 검토하고 연구에 사용할 Evidence만 Source Bundle로 묶습니다.</p></div>
        <label className="text-sm font-semibold">현장 프로젝트<select className="ml-3 min-h-11 rounded-lg border border-ui bg-surface px-3" value={projectId} onChange={(event) => { setProjectId(event.target.value); setSelected([]); }}><option value="">선택</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.title}</option>)}</select></label>
      </div>
      {notice && <p className="mt-4 rounded-lg bg-page p-3 text-sm text-secondary">{notice}</p>}
      <div className="mt-5 grid gap-3 sm:grid-cols-3"><Metric label="전체 Evidence" value={projectMaterials.length} icon={<Database size={18} />} /><Metric label="연구선정" value={curatedCount} icon={<Check size={18} />} /><Metric label="Source Bundle" value={projectBundles.length} icon={<FileStack size={18} />} /></div>
    </section>

    <section className="paper-card p-5 md:p-6">
      <div className="flex flex-col gap-3 border-b border-ui pb-4 md:flex-row md:items-center md:justify-between"><div><h3 className="text-xl font-extrabold">Evidence 검토</h3><p className="mt-1 text-sm text-secondary">NotebookLM에 넘길 자료만 체크하세요. 제외된 자료는 Bundle에 들어가지 않습니다.</p></div><button disabled={!selected.length || busy} onClick={() => void createBundle()} className="min-h-11 rounded-xl bg-orange px-4 text-sm font-extrabold text-ink disabled:opacity-40">{busy ? "생성 중…" : `선택 ${selected.length}개로 Source Bundle 만들기`}</button></div>
      <div className="mt-4 grid gap-3">{projectMaterials.map((material) => <article key={material.id} className="flex flex-col gap-3 rounded-xl bg-page p-4 md:flex-row md:items-center md:justify-between"><div className="flex min-w-0 items-start gap-3"><input type="checkbox" className="mt-1 h-5 w-5" disabled={material.reviewStatus === "EXCLUDED"} checked={selected.includes(material.id)} onChange={(event) => setSelected((current) => event.target.checked ? [...current, material.id] : current.filter((id) => id !== material.id))} /><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><strong className="truncate text-sm">{material.title}</strong><span className="rounded-full bg-surface px-2 py-1 text-xs font-semibold">{material.type}</span>{material.isImportant && <Star size={15} fill="currentColor" />}</div><p className="mt-1 text-xs text-secondary">{statusLabel[material.reviewStatus] ?? material.reviewStatus}</p></div></div><div className="flex flex-wrap gap-2"><button onClick={() => void updateMaterial(material.id, { isImportant: !material.isImportant })} className="min-h-9 rounded-lg bg-surface px-3 text-xs font-bold">{material.isImportant ? "중요 해제" : "중요"}</button><button onClick={() => void updateMaterial(material.id, { reviewStatus: "CURATED" })} className="min-h-9 rounded-lg bg-mint px-3 text-xs font-bold">연구선정</button><button onClick={() => void updateMaterial(material.id, { reviewStatus: "EXCLUDED" })} className="min-h-9 rounded-lg bg-surface px-3 text-xs font-bold text-secondary">제외</button></div></article>)}{!projectMaterials.length && <p className="py-8 text-center text-sm text-secondary">이 현장에 저장된 자료가 없습니다.</p>}</div>
    </section>

    <section className="paper-card p-5 md:p-6"><div className="flex items-center justify-between"><div><h3 className="text-xl font-extrabold">Source Bundle</h3><p className="mt-1 text-sm text-secondary">다음 단계에서 이 묶음을 Google Drive 문서로 변환해 NotebookLM Source로 사용합니다.</p></div><ExternalLink size={20} /></div><div className="mt-4 grid gap-3">{projectBundles.map((bundle) => <div key={bundle.id} className="flex items-center justify-between rounded-xl bg-page p-4"><div><strong className="text-sm">{bundle.title}</strong><p className="mt-1 text-xs text-secondary">v{bundle.version} · Evidence {bundle._count.items}개 · {bundle.status}</p></div><span className="rounded-full bg-orange px-3 py-2 text-xs font-extrabold">NotebookLM 준비</span></div>)}{!projectBundles.length && <p className="py-6 text-center text-sm text-secondary">아직 생성된 Source Bundle이 없습니다.</p>}</div></section>
  </div>;
}

function Metric({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) { return <div className="rounded-xl bg-page p-4"><div className="flex items-center gap-2 text-secondary">{icon}<span className="text-xs font-bold">{label}</span></div><p className="mt-2 text-3xl font-extrabold">{value}</p></div>; }
