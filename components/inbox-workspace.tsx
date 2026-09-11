"use client";

import Image from "next/image";
import { ChangeEvent, FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Camera, FileText, ImageIcon, Mic, RotateCcw, Trash2, Video } from "lucide-react";
import type { FieldDaySummary } from "@/components/field-day-manager";
import { createClientUploadId, discardQueuedUpload, listQueuedUploads, removeQueuedUpload, requestPersistentStorage, saveQueuedUpload, type QueuedUpload } from "@/lib/upload-queue";

type Material = { id: string; type: string; title: string; content: string | null; originalName: string | null; mimeType: string | null; sizeBytes: number | null; uploadStatus: string; uploadError: string | null; createdAt: string; fieldDayId: string | null; fieldDay: { id: string; title: string } | null };
type QueueRecord = QueuedUpload & { localError?: string };

const typeLabel: Record<string, string> = { IMAGE: "사진", VIDEO: "영상", AUDIO: "음성", TEXT: "텍스트" };
const typeIcon = (type: string) => type === "IMAGE" ? ImageIcon : type === "VIDEO" ? Video : type === "AUDIO" ? Mic : FileText;
const formatBytes = (size: number) => size < 1024 * 1024 ? Math.round(size / 1024) + "KB" : (size / (1024 * 1024)).toFixed(1) + "MB";
const queueTimeout = <T,>(operation: Promise<T>, milliseconds = 4000) => Promise.race<T>([
  operation,
  new Promise<T>((_resolve, reject) => window.setTimeout(() => reject(new Error("브라우저 임시 보관 응답이 지연되고 있습니다.")), milliseconds)),
]);

export function InboxWorkspace({ projects }: { projects: FieldDaySummary[] }) {
  const activeProjects = projects.filter((project) => project.status !== "ARCHIVED");
  const [fieldDayId, setFieldDayId] = useState(activeProjects[0]?.id ?? "");
  const [typeFilter, setTypeFilter] = useState("");
  const [projectFilter, setProjectFilter] = useState("");
  const [materials, setMaterials] = useState<Material[]>([]);
  const [queue, setQueue] = useState<QueueRecord[]>([]);
  const [processing, setProcessing] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [textTitle, setTextTitle] = useState("");
  const [textContent, setTextContent] = useState("");
  const [textSaving, setTextSaving] = useState(false);
  const [clientReady, setClientReady] = useState(false);
  const [detail, setDetail] = useState<Material | null>(null);

  const loadMaterials = useCallback(async () => {
    const query = new URLSearchParams();
    if (projectFilter) query.set("fieldDayId", projectFilter);
    if (typeFilter) query.set("type", typeFilter);
    const response = await fetch("/api/materials?" + query.toString(), { cache: "no-store" });
    const data = await response.json();
    if (response.ok) setMaterials(data.materials);
    else setError(data.error || "자료를 불러오지 못했습니다.");
  }, [projectFilter, typeFilter]);

  useEffect(() => {
    const readyTimer = window.setTimeout(() => setClientReady(true), 0);
    const loadTimer = window.setTimeout(() => void loadMaterials(), 0);
    return () => { window.clearTimeout(readyTimer); window.clearTimeout(loadTimer); };
  }, [loadMaterials]);
  useEffect(() => {
    void (async () => {
      try {
        const saved = await listQueuedUploads();
        const pending = saved.map((item) => item.state === "UPLOADING" ? { ...item, state: "PENDING" as const } : item);
        setQueue(pending);
        if (pending.length) setNotice("저장되지 않은 자료가 있습니다. 서버에서 저장 완료를 확인할 때까지 임시 보관됩니다.");
        const storage = await requestPersistentStorage();
        if (!storage.supported) setNotice("이 브라우저는 임시 보관을 지원하지 않습니다. 업로드가 끝날 때까지 이 화면을 유지해 주세요.");
        else if (!storage.persisted) setNotice("브라우저 임시 보관은 영구 백업이 아닙니다. 업로드가 끝날 때까지 이 화면을 유지해 주세요.");
      } catch {
        setNotice("브라우저 임시 보관을 사용할 수 없습니다. 업로드되지 않은 파일이 안전하게 보관되었다고 보장할 수 없습니다.");
      }
    })();
  }, []);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => { if (queue.some((item) => item.state !== "STORED")) { event.preventDefault(); event.returnValue = ""; } };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [queue]);

  async function addFiles(event: ChangeEvent<HTMLInputElement>, type: QueuedUpload["type"]) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (!files.length) return;
    if (!fieldDayId) { setError("먼저 자료를 저장할 진행 중인 현장을 선택해 주세요."); return; }
    void requestPersistentStorage().then((storage) => {
      const total = files.reduce((sum, file) => sum + file.size, 0);
      if (storage.quota && storage.quota - storage.usage < total) setNotice("브라우저 임시 보관 용량이 부족할 수 있습니다. 업로드가 끝날 때까지 파일 원본을 유지해 주세요.");
    }).catch(() => {
      setNotice("브라우저 임시 보관을 확인하지 못했습니다. 업로드가 끝날 때까지 파일 원본을 유지해 주세요.");
    });
    const records: QueueRecord[] = [];
    try {
      for (const file of files) {
        const record: QueueRecord = { clientUploadId: createClientUploadId(), fieldDayId, type, file, title: file.name, capturedAt: file.lastModified ? new Date(file.lastModified).toISOString() : undefined, state: "PENDING", createdAt: new Date().toISOString() };
        try { await queueTimeout(saveQueuedUpload(record)); } catch { record.localError = "임시 보관에 실패했습니다. 이 파일은 화면을 닫으면 사라질 수 있습니다."; setNotice("일부 파일을 브라우저에 임시 보관하지 못했습니다. 서버 저장 완료 전까지 원본 파일을 유지해 주세요."); }
        records.push(record);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "선택한 파일의 저장 준비에 실패했습니다.");
      return;
    }
    setQueue((current) => [...current, ...records]);
    setError("");
    setNotice(`${records.length}개 파일의 서버 저장을 시작합니다.`);
    if (!processing) void runUploads(records);
  }

  function patchQueue(clientUploadId: string, values: Partial<QueueRecord>) {
    setQueue((current) => current.map((item) => item.clientUploadId === clientUploadId ? { ...item, ...values } : item));
  }

  async function uploadOne(record: QueueRecord) {
    if (!record.file) throw new Error("원본 파일을 찾을 수 없습니다.");
    const uploading = { ...record, state: "UPLOADING" as const, error: undefined };
    patchQueue(record.clientUploadId, uploading);
    if (!record.localError) {
      await queueTimeout(saveQueuedUpload(uploading)).catch(() => setNotice("브라우저 임시 보관 갱신이 지연되고 있지만 서버 저장은 계속합니다. 완료 표시 전까지 원본 파일을 유지해 주세요."));
    }
    try {
      const form = new FormData();
      form.set("fieldDayId", record.fieldDayId);
      form.set("clientUploadId", record.clientUploadId);
      form.set("type", record.type);
      form.set("title", record.title);
      if (record.capturedAt) form.set("capturedAt", record.capturedAt);
      form.set("file", record.file);
      const response = await fetch("/api/materials/upload", { method: "POST", body: form });
      const data = await response.json();
      if (!response.ok || data.material?.uploadStatus !== "STORED") throw new Error(data.error || "서버 저장 확인을 받지 못했습니다.");
      await removeQueuedUpload(record.clientUploadId).catch(() => undefined);
      patchQueue(record.clientUploadId, { state: "STORED", error: undefined });
      setNotice(`${record.file.name} 저장을 완료했습니다.`);
      await loadMaterials();
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "파일을 저장하지 못했습니다.";
      const failed = { ...record, state: "FAILED" as const, error: message };
      patchQueue(record.clientUploadId, failed);
      if (!record.localError) await saveQueuedUpload(failed).catch(() => setNotice("실패한 파일의 임시 보관 상태를 갱신하지 못했습니다. 원본 파일을 유지해 주세요."));
    }
  }

  async function runUploads(records = queue.filter((item) => item.state === "PENDING" || item.state === "FAILED")) {
    if (processing || !records.length) return;
    setProcessing(true);
    const jobs = [...records];
    try {
      await Promise.all(Array.from({ length: Math.min(2, jobs.length) }, async () => { while (jobs.length) { const next = jobs.shift(); if (next) await uploadOne(next); } }));
    } finally {
      setProcessing(false);
    }
  }

  async function discard(record: QueueRecord) {
    await discardQueuedUpload(record.clientUploadId).catch(() => undefined);
    setQueue((current) => current.filter((item) => item.clientUploadId !== record.clientUploadId));
  }

  async function saveText(event: FormEvent) {
    event.preventDefault();
    if (textSaving) return;
    if (!fieldDayId) { setError("먼저 자료를 저장할 진행 중인 현장을 선택해 주세요."); return; }
    setTextSaving(true);
    setError("");
    try {
      const response = await fetch("/api/materials", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fieldDayId, title: textTitle, content: textContent, clientUploadId: createClientUploadId() }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "텍스트 자료를 저장하지 못했습니다.");
      setTextTitle(""); setTextContent(""); setError(""); setNotice("텍스트 메모가 저장되었습니다."); await loadMaterials();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "텍스트 자료를 저장하지 못했습니다.");
    } finally {
      setTextSaving(false);
    }
  }

  async function saveDetail(event: FormEvent) {
    event.preventDefault();
    if (!detail) return;
    const response = await fetch("/api/materials/" + detail.id, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: detail.title, content: detail.content }) });
    const data = await response.json();
    if (response.ok) { setDetail(data.material); await loadMaterials(); }
    else setError(data.error || "자료를 수정하지 못했습니다.");
  }

  async function deleteMaterial(material: Material) {
    if (!window.confirm("이 자료를 삭제할까요? 파일은 즉시 물리 삭제되지 않습니다.")) return;
    const response = await fetch("/api/materials/" + material.id, { method: "DELETE" });
    if (response.ok) { setDetail(null); await loadMaterials(); }
    else setError("자료를 삭제하지 못했습니다.");
  }

  const completed = useMemo(() => queue.filter((item) => item.state === "STORED").length, [queue]);
  const failed = useMemo(() => queue.filter((item) => item.state === "FAILED").length, [queue]);

  return (
    <div className="mt-7 grid min-w-0 max-w-full grid-cols-1 gap-5 overflow-hidden">
      <section className="paper-card w-full min-w-0 max-w-full overflow-hidden p-4 md:p-6">
        <div className="flex min-w-0 flex-col gap-4 border-b border-ui pb-5">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-secondary">자료 남기기</p>
            <h2 className="mt-1 text-2xl font-extrabold">자료수집함</h2>
            <p className="mt-1 break-words text-sm text-secondary">파일은 항목별로 저장 여부를 확인한 뒤 완료 처리됩니다.</p>
          </div>
          <label className="flex w-full min-w-0 max-w-full flex-col items-stretch gap-2 text-sm font-semibold md:flex-row md:items-center md:justify-between">
            <span className="shrink-0">저장할 현장</span>
            <select className="min-h-11 w-full min-w-0 max-w-full rounded-lg border border-ui bg-surface px-3 md:max-w-sm" value={fieldDayId} onChange={(event) => setFieldDayId(event.target.value)}>
              <option value="">현장을 선택하세요</option>
              {activeProjects.map((project) => <option key={project.id} value={project.id}>{project.title}</option>)}
            </select>
          </label>
        </div>

        {(notice || error) && <p className={(error ? "text-orange" : "text-secondary") + " mt-4 break-words rounded-lg bg-page p-3 text-sm"}>{error || notice}</p>}
        {!clientReady && <p className="mt-4 break-words rounded-lg bg-orange p-3 text-sm font-semibold text-ink">입력 기능을 연결하고 있습니다. 이 안내가 사라지지 않으면 Safari에서 페이지를 새로고침해 주세요.</p>}

        <div className="mt-5 grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="flex min-h-12 w-full min-w-0 cursor-pointer items-center justify-center gap-2 rounded-xl bg-orange px-4 text-sm font-bold text-ink"><Camera size={18} /> 사진 촬영<input className="sr-only" type="file" accept="image/jpeg,image/png,image/heic,image/heif,image/webp" capture="environment" disabled={!clientReady} onChange={(event) => void addFiles(event, "IMAGE")} /></label>
          <label className="flex min-h-12 w-full min-w-0 cursor-pointer items-center justify-center gap-2 rounded-xl bg-mint px-4 text-sm font-bold text-ink"><ImageIcon size={18} /> 앨범에서 선택<input className="sr-only" type="file" accept="image/jpeg,image/png,image/heic,image/heif,image/webp" multiple disabled={!clientReady} onChange={(event) => void addFiles(event, "IMAGE")} /></label>
          <label className="flex min-h-12 w-full min-w-0 cursor-pointer items-center justify-center gap-2 rounded-xl bg-surface px-4 text-sm font-bold text-ink shadow-sm"><Video size={18} /> 영상 선택<input className="sr-only" type="file" accept="video/mp4,video/quicktime,video/webm" multiple disabled={!clientReady} onChange={(event) => void addFiles(event, "VIDEO")} /></label>
          <label className="flex min-h-12 w-full min-w-0 cursor-pointer items-center justify-center gap-2 rounded-xl bg-surface px-4 text-sm font-bold text-ink shadow-sm"><Mic size={18} /> 음성 선택<input className="sr-only" type="file" accept="audio/mp4,audio/x-m4a,audio/mpeg,audio/wav,audio/wave,audio/webm" multiple disabled={!clientReady} onChange={(event) => void addFiles(event, "AUDIO")} /></label>
        </div>

        {queue.length > 0 && <div className="mt-5 min-w-0 max-w-full overflow-hidden rounded-xl bg-page p-4">
          <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="break-words text-sm font-semibold">업로드 대기열 · 저장 완료 {completed}개 · 실패 {failed}개</p>
            <button type="button" className="min-h-11 w-full rounded-lg bg-ink px-4 text-sm font-semibold text-white disabled:opacity-50 sm:w-auto" disabled={processing || !queue.some((item) => item.state === "PENDING" || item.state === "FAILED")} onClick={() => void runUploads()}>{processing ? "저장 중…" : "저장 시작"}</button>
          </div>
          <div className="mt-3 grid min-w-0 gap-2">
            {queue.filter((item) => item.state !== "STORED").map((item) => {
              const Icon = typeIcon(item.type);
              return <div key={item.clientUploadId} className="flex min-w-0 flex-wrap items-center gap-3 rounded-lg bg-surface p-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-mint"><Icon size={18} /></span>
                <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{item.file?.name || item.title}</p><p className="text-xs text-secondary">{item.file ? formatBytes(item.file.size) : "원본 확인 필요"} · {item.state === "UPLOADING" ? "업로드 중" : item.state === "FAILED" ? "실패" : "대기"}</p>{item.error && <p className="mt-1 break-words text-xs text-orange">{item.error}</p>}</div>
                {item.state === "FAILED" && <button type="button" className="min-h-11 rounded-lg border border-ui px-3 text-sm font-semibold" onClick={() => void runUploads([item])}><RotateCcw size={16} /></button>}
                <button type="button" aria-label="대기 자료 폐기" className="min-h-11 min-w-11 rounded-lg border border-ui px-3 text-sm" onClick={() => void discard(item)}><Trash2 size={16} /></button>
              </div>;
            })}
          </div>
        </div>}
      </section>

      <section className="paper-card w-full min-w-0 max-w-full overflow-hidden p-4 md:p-6">
        <div className="flex min-w-0 flex-col gap-2 border-b border-ui pb-5"><p className="text-sm font-semibold text-secondary">텍스트 기록</p><h2 className="text-xl font-extrabold">텍스트 메모</h2></div>
        <form className="mt-5 grid min-w-0 grid-cols-1 gap-3" onSubmit={(event) => void saveText(event)}>
          <input className="min-h-11 w-full min-w-0 max-w-full rounded-lg border border-ui bg-surface px-3" placeholder="제목 (선택)" value={textTitle} onChange={(event) => setTextTitle(event.target.value)} />
          <textarea className="min-h-32 w-full min-w-0 max-w-full rounded-lg border border-ui bg-surface p-3" placeholder="현장에서 발견한 내용을 기록하세요" value={textContent} onChange={(event) => setTextContent(event.target.value)} required />
          <button type="submit" className="min-h-11 w-full rounded-lg bg-ink px-4 text-sm font-semibold text-white disabled:opacity-60 sm:w-fit" disabled={!clientReady || textSaving}>{textSaving ? "저장 중…" : "메모 저장"}</button>
        </form>
      </section>

      <section className="paper-card w-full min-w-0 max-w-full overflow-hidden p-4 md:p-6">
        <div className="flex min-w-0 flex-col gap-3 border-b border-ui pb-5 md:flex-row md:items-end md:justify-between">
          <div className="min-w-0"><p className="text-sm font-semibold text-secondary">저장 완료 자료</p><h2 className="mt-1 text-xl font-extrabold">자료 목록</h2></div>
          <div className="grid w-full min-w-0 grid-cols-1 gap-2 sm:grid-cols-2 md:w-auto">
            <select className="min-h-11 w-full min-w-0 max-w-full rounded-lg border border-ui bg-surface px-3 text-sm" value={projectFilter} onChange={(event) => setProjectFilter(event.target.value)}><option value="">모든 현장</option>{activeProjects.map((project) => <option key={project.id} value={project.id}>{project.title}</option>)}</select>
            <select className="min-h-11 w-full min-w-0 max-w-full rounded-lg border border-ui bg-surface px-3 text-sm" value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}><option value="">모든 유형</option>{Object.entries(typeLabel).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
          </div>
        </div>
        <div className="mt-5 grid min-w-0 gap-3">{materials.length ? materials.map((material) => { const Icon = typeIcon(material.type); return <button type="button" key={material.id} className="flex min-h-16 w-full min-w-0 max-w-full items-center gap-3 overflow-hidden rounded-xl bg-page p-3 text-left hover:bg-mint" onClick={() => setDetail(material)}><span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-mint">{material.type === "IMAGE" ? <Image src={`/api/materials/${material.id}/file`} alt="" width={40} height={40} className="h-full w-full object-cover" /> : <Icon size={18} />}</span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{material.title}</span><span className="mt-1 block truncate text-xs text-secondary">{typeLabel[material.type] || material.type} · {material.fieldDay?.title || "현장 미지정"}</span></span><span className="shrink-0 text-xs text-secondary">{material.uploadStatus === "STORED" ? "저장 완료" : material.uploadStatus}</span></button>; }) : <p className="rounded-xl bg-page p-4 text-sm text-secondary">저장된 자료가 없습니다.</p>}</div>
      </section>

      {detail && <div className="fixed inset-0 z-40 flex items-end justify-center bg-ink/40 p-3 md:items-center md:p-4"><section className="max-h-[90vh] w-full min-w-0 max-w-xl overflow-auto rounded-2xl bg-surface p-4 md:p-5"><div className="flex min-w-0 items-center justify-between gap-3"><h2 className="min-w-0 text-xl font-extrabold">자료 상세</h2><button type="button" className="shrink-0 min-h-11 rounded-lg border border-ui px-3 text-sm" onClick={() => setDetail(null)}>닫기</button></div><form className="mt-5 grid min-w-0 grid-cols-1 gap-3" onSubmit={(event) => void saveDetail(event)}><input className="min-h-11 w-full min-w-0 max-w-full rounded-lg border border-ui bg-surface px-3" value={detail.title} onChange={(event) => setDetail({ ...detail, title: event.target.value })} /><textarea className="min-h-40 w-full min-w-0 max-w-full rounded-lg border border-ui bg-surface p-3" value={detail.content || ""} onChange={(event) => setDetail({ ...detail, content: event.target.value })} /><div className="grid grid-cols-2 gap-2"><button type="submit" className="min-h-11 rounded-lg bg-ink px-4 text-sm font-semibold text-white">저장</button><button type="button" className="min-h-11 rounded-lg border border-ui px-4 text-sm font-semibold" onClick={() => void deleteMaterial(detail)}>삭제</button></div></form>{detail.type !== "TEXT" && <div className="mt-5 min-w-0">{detail.type === "IMAGE" ? <Image src={`/api/materials/${detail.id}/file`} alt={detail.title} width={720} height={480} className="h-auto w-full max-w-full rounded-xl object-contain" /> : detail.type === "VIDEO" ? <video className="w-full max-w-full rounded-xl" controls src={`/api/materials/${detail.id}/file`} /> : <audio className="w-full max-w-full" controls src={`/api/materials/${detail.id}/file`} />}</div>}</section></div>}
    </div>
  );
}
