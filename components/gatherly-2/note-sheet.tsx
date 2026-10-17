"use client";
import { useEffect, useRef, useState } from "react";
import type { Context } from "@/lib/gatherly-2/contracts";
import { BrowserWorkspace, type Draft } from "@/lib/gatherly-2/browser-storage";

export function NoteSheet({ context, companyName, onClose, onSaved, workspace }: { context: Context; companyName: string; onClose: () => void; onSaved: () => void; workspace?: BrowserWorkspace }) {
  // Parent pins this object when opening; selection changes cannot retarget the draft.
  const dialog = useRef<HTMLDialogElement>(null);
  const [draft, setDraft] = useState<Draft>({ ...context, title: "", text: "" });
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const writes = useRef<Promise<unknown>>(Promise.resolve());
  const storage = useRef(workspace ?? new BrowserWorkspace());
  useEffect(() => {
    const element = dialog.current; element?.showModal(); let active = true;
    Promise.all([storage.current.getDraft(context), storage.current.getNote(context)]).then(([savedDraft, savedNote]) => {
      if (!active) return;
      setDraft(savedDraft ?? savedNote ?? { ...context, title: "", text: "" }); setReady(true);
      if (savedDraft) setNotice("기기에 보관한 작성 중 메모를 복원했습니다.");
    }).catch(() => { if (active) setNotice("로컬 저장소를 열 수 없습니다. 메모 창을 닫고 다시 시도해 주세요."); });
    return () => { active = false; element?.close(); };
  }, [context]);
  function edit(patch: Partial<Draft>) {
    const next = { ...draft, ...patch }; setDraft(next);
    writes.current = writes.current.then(() => storage.current.saveDraft(next)).then(() => setNotice("작성 중 내용이 기기에 보관됐습니다.")).catch(() => setNotice("임시 보관 실패. 이 창을 닫지 말고 저장을 다시 시도해 주세요."));
  }
  async function finish(save: boolean) {
    setBusy(true);
    try {
      await writes.current;
      if (save) { await storage.current.saveNote(draft); onSaved(); } else await storage.current.discardDraft(context);
      onClose();
    } catch (error) { setNotice(error instanceof Error ? error.message : "저장 실패"); }
    finally { setBusy(false); }
  }
  return <dialog ref={dialog} onCancel={event => { event.preventDefault(); if (!busy) void finish(false); }} className="fixed inset-x-0 bottom-0 top-auto m-0 max-h-[85dvh] w-full max-w-none overflow-y-auto rounded-t-3xl bg-[#fffdf5] p-5 text-[#173e32] backdrop:bg-black/50 sm:inset-0 sm:m-auto sm:max-w-lg sm:rounded-3xl" aria-labelledby="note-title">
    <h2 id="note-title" className="text-xl font-bold">메모 기록</h2><p className="my-2 text-sm">{companyName}</p>
    <p className="mb-4 text-xs">이 기업에 고정해 저장합니다. 취소하면 이번 편집만 버리고 저장된 메모는 유지합니다.</p>
    <label className="grid gap-2">제목<input autoFocus disabled={!ready || busy} value={draft.title} onChange={e => edit({ title: e.target.value })} maxLength={120} className="min-h-12 rounded-xl border p-3" /></label>
    <label className="mt-4 grid gap-2">내용<textarea disabled={!ready || busy} value={draft.text} onChange={e => edit({ text: e.target.value })} rows={6} maxLength={500} className="rounded-xl border p-3" placeholder="현장에서 확인한 내용을 남겨 주세요." /></label>
    <p className="mt-2 text-right text-xs">{draft.text.length}/500</p><p role="status" className="my-3 text-sm">{notice}</p>
    <div className="sticky bottom-0 flex gap-3 bg-[#fffdf5] pb-[env(safe-area-inset-bottom)] pt-2"><button disabled={busy} onClick={() => void finish(false)} className="min-h-12 flex-1 rounded-xl border">취소</button><button disabled={!ready || busy || !draft.text.trim()} onClick={() => void finish(true)} className="min-h-12 flex-1 rounded-xl bg-[#173e32] text-white disabled:opacity-40">{busy ? "저장 중…" : "기기에 저장"}</button></div>
  </dialog>;
}
