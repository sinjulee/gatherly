"use client";

import { FormEvent, useState } from "react";
import { MapPin, Pencil, Plus, Trash2 } from "lucide-react";

export type FieldDaySummary = { id: string; title: string; description: string | null; location: string | null; fieldDate: string; status: string; _count?: { materials: number } };

const today = () => new Date().toISOString().slice(0, 10);

function emptyForm() {
  return { title: "", description: "", location: "", fieldDate: today(), status: "ACTIVE" };
}

export function FieldDayManager({ initialProjects }: { initialProjects: FieldDaySummary[] }) {
  const [projects, setProjects] = useState(initialProjects);
  const [form, setForm] = useState(emptyForm());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const updateForm = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }));

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const response = await fetch(editingId ? "/api/field-days/" + editingId : "/api/field-days", { method: editingId ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, fieldDate: new Date(form.fieldDate).toISOString() }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "현장을 저장하지 못했습니다.");
      const project = { ...data.project, _count: data.project._count ?? { materials: 0 } } as FieldDaySummary;
      setProjects((current) => editingId ? current.map((item) => item.id === editingId ? project : item) : [project, ...current]);
      setOpen(false);
      setEditingId(null);
      setForm(emptyForm());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "현장을 저장하지 못했습니다.");
    } finally {
      setSaving(false);
    }
  }

  function startEdit(project: FieldDaySummary) {
    setEditingId(project.id);
    setForm({ title: project.title, description: project.description ?? "", location: project.location ?? "", fieldDate: project.fieldDate.slice(0, 10), status: project.status });
    setOpen(true);
    setError("");
  }

  async function remove(project: FieldDaySummary) {
    if (!window.confirm("'" + project.title + "' 현장을 삭제할까요? 연결된 자료 파일은 즉시 삭제되지 않습니다.")) return;
    const response = await fetch("/api/field-days/" + project.id, { method: "DELETE" });
    if (response.ok) setProjects((current) => current.filter((item) => item.id !== project.id));
    else setError("현장을 삭제하지 못했습니다.");
  }

  return <section className="paper-card p-6"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-extrabold">현장 프로젝트</h2><p className="mt-1 text-sm text-secondary">자료를 남길 현장을 선택하고 관리합니다.</p></div><button onClick={() => { setOpen(true); setEditingId(null); setForm(emptyForm()); }} className="flex min-h-12 items-center gap-2 rounded-xl bg-ink px-4 text-sm font-semibold text-white"><Plus size={17} />새 현장</button></div>{error && <p role="alert" className="mt-4 rounded-lg bg-orange px-3 py-2 text-sm text-ink">{error}</p>}{open && <form onSubmit={submit} className="mt-5 grid gap-3 rounded-xl bg-page p-4 md:grid-cols-2"><label className="grid gap-1 text-sm font-semibold md:col-span-2">현장 이름<input required value={form.title} onChange={(event) => updateForm("title", event.target.value)} className="min-h-12 rounded-lg border border-ui bg-surface px-3 font-normal" /></label><label className="grid gap-1 text-sm font-semibold">장소<input value={form.location} onChange={(event) => updateForm("location", event.target.value)} className="min-h-12 rounded-lg border border-ui bg-surface px-3 font-normal" /></label><label className="grid gap-1 text-sm font-semibold">현장 날짜<input required type="date" value={form.fieldDate} onChange={(event) => updateForm("fieldDate", event.target.value)} className="min-h-12 rounded-lg border border-ui bg-surface px-3 font-normal" /></label><label className="grid gap-1 text-sm font-semibold">상태<select value={form.status} onChange={(event) => updateForm("status", event.target.value)} className="min-h-12 rounded-lg border border-ui bg-surface px-3 font-normal"><option value="ACTIVE">진행 중</option><option value="COMPLETED">완료</option><option value="ARCHIVED">보관</option></select></label><label className="grid gap-1 text-sm font-semibold md:col-span-2">설명<textarea value={form.description} onChange={(event) => updateForm("description", event.target.value)} className="min-h-24 rounded-lg border border-ui bg-surface p-3 font-normal" /></label><div className="flex gap-2 md:col-span-2"><button disabled={saving} className="min-h-12 rounded-xl bg-orange px-4 text-sm font-semibold text-ink">{saving ? "저장 중" : editingId ? "수정 저장" : "현장 만들기"}</button><button type="button" onClick={() => setOpen(false)} className="min-h-12 rounded-xl border border-ui bg-surface px-4 text-sm font-semibold">취소</button></div></form>}<div className="mt-5 grid gap-3">{projects.length ? projects.map((project) => <article key={project.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-ui bg-surface p-4"><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="font-extrabold">{project.title}</h3><span className="rounded-full bg-mint px-2 py-1 text-xs font-semibold">{project.status === "ACTIVE" ? "진행 중" : project.status === "COMPLETED" ? "완료" : "보관"}</span></div><p className="mt-1 flex items-center gap-1 text-xs text-secondary"><MapPin size={13} />{project.location || "장소 미입력"} · 자료 {project._count?.materials ?? 0}개</p></div><button aria-label={project.title + " 수정"} onClick={() => startEdit(project)} className="rounded-lg p-3 text-ink hover:bg-page"><Pencil size={17} /></button><button aria-label={project.title + " 삭제"} onClick={() => remove(project)} className="rounded-lg p-3 text-orange hover:bg-page"><Trash2 size={17} /></button></article>) : <p className="rounded-xl bg-page p-5 text-sm text-secondary">진행 중인 현장이 없습니다. 새 현장을 시작해 주세요.</p>}</div></section>;
}
