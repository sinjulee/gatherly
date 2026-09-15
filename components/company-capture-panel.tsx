"use client";

import Link from "next/link";
import { type ChangeEvent, useEffect, useRef, useState } from "react";
import { Camera, FileText, Mic, Video, X } from "lucide-react";
import { queueCompanyFiles, queuedUploadForm } from "@/lib/company-capture-queue";
import { createClientUploadId, listQueuedUploads, removeQueuedUpload, requestPersistentStorage, saveQueuedUpload, type QueuedUpload } from "@/lib/upload-queue";

export type CaptureMode = "PHOTO" | "AUDIO" | "MEMO" | "MORE";
type FieldDayOption = { id: string; title: string; exhibitionId: string | null };
type FieldDays = { linked: FieldDayOption[]; manualCandidates: FieldDayOption[]; suggestedId: string | null; error?: string };
type QueueRow = QueuedUpload & { contextError?: boolean };

export function CompanyCapturePanel({ mode, companyName, companyId, indexId, exhibitionId, defaultFieldDay, draft, onDraftChange, onClose, onDetail, onStored }: {
  mode: CaptureMode; companyName: string; companyId: string; indexId: string; exhibitionId: string;
  defaultFieldDay: { id: string; title: string } | null;
  draft: string; onDraftChange: (value: string) => void; onClose: () => void; onDetail: () => void; onStored: () => void;
}) {
  const [days, setDays] = useState<FieldDays | null>(() => defaultFieldDay ? {
    linked: [{ ...defaultFieldDay, exhibitionId }], manualCandidates: [], suggestedId: defaultFieldDay.id,
  } : null);
  const [fieldDayId, setFieldDayId] = useState(defaultFieldDay?.id ?? "");
  const [queue, setQueue] = useState<QueueRow[]>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [memoSaving, setMemoSaving] = useState(false);
  const busy = useRef(false);
  const memoId = useRef<string | null>(null);
  const label = { PHOTO: "사진", AUDIO: "음성", MEMO: "메모", MORE: "더보기" }[mode];
  const hasDefaultFieldDay = defaultFieldDay !== null;

  useEffect(() => {
    let mounted = true;
    void fetch("/api/exhibitions/" + exhibitionId + "/field-days", { cache: "no-store" }).then(async (response) => {
      const data = await response.json() as FieldDays;
      if (!mounted) return;
      if (!response.ok) { setError(data.error || "현장 목록을 불러오지 못했습니다."); return; }
      setDays(data);
      setFieldDayId((current) => current || data.suggestedId || ""); // Never replace a deliberate choice.
    }).catch(() => { if (mounted) setError(hasDefaultFieldDay ? "현장 목록을 새로 확인하지 못했습니다. 현재 카드의 기본 현장을 사용합니다." : "현장 목록을 불러오지 못했습니다."); });
    void listQueuedUploads().then((saved) => {
      if (!mounted) return;
      const own = saved.filter((row) => row.companyId === companyId).map((row) => row.state === "UPLOADING" ? { ...row, state: "PENDING" as const } : row);
      setQueue(own);
      if (own.length) setNotice("저장되지 않은 자료가 남아 있습니다. 최초 입력 context로 재시도할 수 있습니다.");
    }).catch(() => { if (mounted) setNotice("임시 보관소를 읽지 못했습니다. 파일 원본을 유지해 주세요."); });
    void requestPersistentStorage().then((storage) => { if (mounted && !storage.persisted) setNotice("브라우저 임시 보관은 영구 백업이 아닙니다. 저장 완료 전까지 파일 원본을 유지해 주세요."); }).catch(() => undefined);
    return () => { mounted = false; };
  }, [companyId, exhibitionId, hasDefaultFieldDay]);

  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => { if (queue.some((row) => row.state !== "STORED")) { event.preventDefault(); event.returnValue = ""; } };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [queue]);

  function patch(id: string, values: Partial<QueueRow>) {
    setQueue((current) => current.map((row) => row.clientUploadId === id ? { ...row, ...values } : row));
  }

  async function uploadOne(row: QueueRow) {
    // Retry reads only this frozen queue row, never current screen props or selected FieldDay.
    const uploading: QueueRow = { ...row, state: "UPLOADING", error: undefined };
    patch(row.clientUploadId, uploading);
    await saveQueuedUpload(uploading).catch(() => setNotice("임시 보관 상태 갱신에 실패했습니다. 파일 원본을 유지해 주세요."));
    try {
      const response = await fetch("/api/materials/upload", { method: "POST", body: queuedUploadForm(row) });
      const data = await response.json() as { error?: string; contextError?: boolean; material?: { uploadStatus: string } };
      if (!response.ok || data.material?.uploadStatus !== "STORED") {
        const failure = new Error(data.error || "서버 저장 확인을 받지 못했습니다.") as Error & { contextError?: boolean };
        failure.contextError = !!data.contextError;
        throw failure;
      }
      await removeQueuedUpload(row.clientUploadId).catch(() => setNotice("서버 저장은 완료됐지만 큐 삭제가 지연됐습니다. 같은 ID로 재시도해도 중복 생성되지 않습니다."));
      patch(row.clientUploadId, { state: "STORED", error: undefined, contextError: false });
      setNotice(row.file.name + " 저장 완료");
      onStored();
    } catch (cause) {
      const failure = cause as Error & { contextError?: boolean };
      const failed: QueueRow = { ...row, state: "FAILED", error: failure.message || "파일 저장에 실패했습니다.", contextError: !!failure.contextError };
      patch(row.clientUploadId, failed);
      await saveQueuedUpload(failed).catch(() => setNotice("실패 상태를 임시 보관소에 기록하지 못했습니다. 파일 원본을 유지해 주세요."));
    }
  }

  async function runUploads(rows: QueueRow[]) {
    if (busy.current || !rows.length) return;
    busy.current = true;
    const jobs = [...rows];
    try {
      await Promise.all(Array.from({ length: Math.min(2, jobs.length) }, async () => {
        while (jobs.length) { const next = jobs.shift(); if (next) await uploadOne(next); }
      }));
    } finally { busy.current = false; }
  }

  async function addFiles(event: ChangeEvent<HTMLInputElement>, type: QueuedUpload["type"]) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (!files.length) return;
    if (!fieldDayId) { setError("먼저 저장할 현장을 선택해 주세요."); return; }
    const rows = queueCompanyFiles(files, type, { fieldDayId, companyId, sourceIndexId: indexId, exhibitionId });
    const saved: QueueRow[] = [];
    try {
      for (const row of rows) { await saveQueuedUpload(row); saved.push(row); }
    } catch {
      setQueue((current) => [...current, ...saved]);
      setError("일부 파일을 임시 보관하지 못했습니다. 업로드되지 않은 원본 파일을 유지해 주세요.");
      return;
    }
    setQueue((current) => [...current, ...saved]);
    setError("");
    setNotice(saved.length + "개 파일의 기업·Index context를 큐에 고정했습니다.");
    void runUploads(saved);
  }

  async function saveMemo() {
    if (memoSaving) return;
    if (!fieldDayId || !draft.trim()) { setError("현장과 메모 내용을 확인해 주세요."); return; }
    setMemoSaving(true);
    setError("");
    memoId.current ||= createClientUploadId();
    try {
      const response = await fetch("/api/materials", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fieldDayId, type: "TEXT", title: companyName + " 현장 메모", content: draft,
          clientUploadId: memoId.current, companyId, sourceIndexId: indexId, exhibitionId }),
      });
      const data = await response.json() as { error?: string; material?: { id: string } };
      if (!response.ok || !data.material) throw new Error(data.error || "메모 저장 확인을 받지 못했습니다.");
      memoId.current = null;
      onDraftChange("");
      setNotice("기업·Index에 연결된 메모를 저장했습니다.");
      onStored();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "메모 저장에 실패했습니다. 재시도해 주세요."); }
    finally { setMemoSaving(false); }
  }

  const options = [...(days?.linked ?? []), ...(days?.manualCandidates ?? [])];
  const pending = queue.filter((row) => row.state !== "STORED");
  return <div className="fixed inset-0 z-40 flex items-end justify-center bg-ink/55 md:items-center" role="presentation" onClick={onClose}>
    <section role="dialog" aria-modal="true" aria-label={companyName + " " + label + " 입력"} className="max-h-[calc(100dvh-12px)] w-full min-w-0 max-w-lg overflow-y-auto rounded-t-3xl bg-surface p-5 pb-[calc(24px+env(safe-area-inset-bottom))] shadow-2xl md:max-h-[90vh] md:rounded-3xl md:p-7" onClick={(event) => event.stopPropagation()}>
      <header className="flex items-center justify-between gap-3"><div><p className="text-xs font-extrabold text-orange">FIELD ACTION</p><h2 className="mt-1 text-xl font-extrabold">{label} · {companyName}</h2></div><button type="button" aria-label="입력 패널 닫기" onClick={onClose} className="flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-ui"><X size={20} /></button></header>
      <p className="mt-3 rounded-xl bg-mint p-3 text-xs leading-5">자료는 이 기업과 현재 Index에 자동 연결됩니다. 큐에 저장된 연결 정보는 페이지 이동·재시도 후에도 유지됩니다.</p>
      <label htmlFor="company-field-day" className="mt-5 block text-sm font-bold">저장할 현장</label>
      <select id="company-field-day" value={fieldDayId} onChange={(event) => setFieldDayId(event.target.value)} className="mt-2 min-h-12 w-full rounded-xl border border-ui bg-page px-3 text-sm"><option value="">현장을 선택해 주세요</option>{options.map((day) => <option key={day.id} value={day.id}>{day.title}{day.exhibitionId ? " · 이 전시회" : " · 미연결 현장 (직접 선택)"}</option>)}</select>
      {!days?.linked.length && <p className="mt-2 text-xs leading-5 text-orange">이 전시회에 연결된 ACTIVE 현장이 없습니다. 미연결 현장을 쓰려면 직접 확인해 선택해 주세요. 다른 전시회 현장은 자동 선택하지 않습니다.</p>}
      {!options.length && <Link href="/inbox" className="mt-2 inline-flex min-h-11 items-center text-xs font-bold text-orange">자료수집함에서 현장 먼저 만들기 →</Link>}

      {mode === "MEMO" && <div className="mt-5"><label htmlFor="company-memo-draft" className="text-sm font-bold">현장 메모</label><textarea id="company-memo-draft" value={draft} onChange={(event) => { onDraftChange(event.target.value); memoId.current = null; }} placeholder="현장에서 본 내용을 적어 주세요." className="mt-2 min-h-40 w-full rounded-xl border border-ui bg-page p-4 text-sm" /><button type="button" disabled={!draft.trim() || memoSaving || !fieldDayId} onClick={() => void saveMemo()} className="mt-3 flex min-h-12 w-full items-center justify-center rounded-xl bg-ink px-4 text-sm font-bold text-white disabled:opacity-50">{memoSaving ? "저장 중…" : "기업 메모 저장"}</button></div>}
      {mode === "PHOTO" && <div className="mt-5 grid gap-3"><label className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-ink px-4 text-sm font-bold text-white"><Camera size={18} />카메라로 촬영<input type="file" accept="image/*,.heic,.heif" capture="environment" className="sr-only" onChange={(event) => void addFiles(event, "IMAGE")} /></label><label className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-ui px-4 text-sm font-bold"><Camera size={18} />여러 사진 선택<input type="file" accept="image/*,.heic,.heif" multiple className="sr-only" onChange={(event) => void addFiles(event, "IMAGE")} /></label></div>}
      {mode === "AUDIO" && <div className="mt-5 grid gap-3"><label className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-ink px-4 text-sm font-bold text-white"><Mic size={18} />음성 녹음 또는 선택<input type="file" accept="audio/*,.m4a,.mp3,.wav,.webm" capture className="sr-only" onChange={(event) => void addFiles(event, "AUDIO")} /></label><label className="flex min-h-12 items-center justify-center rounded-xl border border-ui px-4 text-sm font-bold">기존 음성 파일 선택<input type="file" accept="audio/*,.m4a,.mp3,.wav,.webm" className="sr-only" onChange={(event) => void addFiles(event, "AUDIO")} /></label></div>}
      {mode === "MORE" && <div className="mt-5 grid gap-3"><label className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-ink px-4 text-sm font-bold text-white"><Video size={18} />영상 촬영 또는 선택<input type="file" accept="video/*,.mp4,.mov,.webm" capture="environment" className="sr-only" onChange={(event) => void addFiles(event, "VIDEO")} /></label><label className="flex min-h-12 items-center justify-center rounded-xl border border-ui px-4 text-sm font-bold">기존 영상 파일 선택<input type="file" accept="video/*,.mp4,.mov,.webm" className="sr-only" onChange={(event) => void addFiles(event, "VIDEO")} /></label><button type="button" onClick={onDetail} className="flex min-h-12 items-center justify-center rounded-xl border border-ui text-sm font-bold"><FileText size={18} className="mr-2" />기업 상세정보 열기</button></div>}

      {pending.length > 0 && <div className="mt-5"><h3 className="text-sm font-extrabold">임시 보관 자료 · {pending.length}</h3><div className="mt-2 grid gap-2">{pending.map((row) => <div key={row.clientUploadId} className="rounded-xl border border-ui bg-page p-3 text-xs"><p className="break-all font-bold">{row.file?.name || row.title} · {row.state}</p>{row.error && <p role="alert" className="mt-1 text-orange">{row.contextError ? "연결 정보 오류: " : "업로드 실패: "}{row.error}</p>}{row.state === "FAILED" || row.state === "PENDING" ? <button type="button" onClick={() => void runUploads([row])} className="mt-2 min-h-11 rounded-lg border border-ui px-3 font-bold">최초 context로 재시도</button> : null}</div>)}</div></div>}
      {error && <p role="alert" className="mt-4 rounded-xl bg-page p-3 text-xs leading-5 text-orange">{error}</p>}
      {notice && <p role="status" className="mt-4 rounded-xl bg-page p-3 text-xs leading-5 text-secondary">{notice}</p>}
    </section>
  </div>;
}
