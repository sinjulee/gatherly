"use client";
import Image from "next/image";
import { Camera, Mic, Volume2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { demoExhibitors, demoHotspots, isTap, overlay, validHotspot } from "@/lib/gatherly-2/map";
import { BrowserWorkspace } from "@/lib/gatherly-2/browser-storage";
import type { Context, SyncItem, Exhibitor, Hotspot } from "@/lib/gatherly-2/contracts";
import { NoteSheet } from "./note-sheet";

const USER = "phase1-local-demo";
const buttonStyle = "flex min-h-12 min-w-12 items-center justify-center rounded-xl border border-[#173e32]/30 px-3 disabled:opacity-40";
function MediaPreview({ item }: { item: SyncItem }) {
  const picture = useRef<HTMLImageElement>(null);
  const audio = useRef<HTMLAudioElement>(null);
  useEffect(() => {
    if (!item.blob) return;
    const value = URL.createObjectURL(item.blob);
    const element = picture.current ?? audio.current;
    if (element) element.src = value;
    return () => { element?.removeAttribute("src"); URL.revokeObjectURL(value); };
  }, [item.blob]);
  // Local blob URLs are attached after mount and cannot use the server image optimizer.
  // eslint-disable-next-line @next/next/no-img-element
  return item.blob?.type.startsWith("image/") ? <img ref={picture} alt={item.title} width={160} height={120} className="h-28 w-40 rounded-lg object-contain" /> : <audio ref={audio} controls className="max-w-full" />;
}
export type ConnectedField = { userId: string; fieldDayId: string; exhibitors: Exhibitor[]; hotspots: Hotspot[]; sync: (workspace: BrowserWorkspace) => Promise<string> };
export function FieldPrototype({ connected, localUserId, namespace }: { connected?: ConnectedField; localUserId?: string; namespace: string }) {
  const exhibitors = connected?.exhibitors ?? demoExhibitors;
  const hotspots = connected?.hotspots ?? demoHotspots;
  const userId = connected?.userId ?? localUserId ?? USER;
  const [selectedId, setSelectedId] = useState(exhibitors[0].id);
  const selected = exhibitors.find(row => row.id === selectedId)!;
  const [query, setQuery] = useState("");
  const [note, setNote] = useState<{ context: Context; name: string } | null>(null);
  const [rows, setRows] = useState<SyncItem[]>([]);
  const [notice, setNotice] = useState(connected ? "먼저 기기에 저장합니다. 개인 Google 파일 접근 동의 후 동기화해 주세요." : "사진·녹음·메모는 이 기기에만 저장됩니다. Google 동기화는 연결되지 않았습니다.");
  const [recording, setRecording] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [unsaved, setUnsaved] = useState<SyncItem | null>(null);
  const [storage] = useState(() => new BrowserWorkspace(`gatherly-v2-${namespace}-${connected ? "connected" : "internal"}`));
  const viewport = useRef<HTMLDivElement>(null);
  const gesture = useRef<{ x: number; y: number; left: number; top: number; moved: boolean } | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const captureContext = useRef<Context | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const alive = useRef(true);
  const context = (): Context => ({ userId, fieldDayId: connected?.fieldDayId ?? "phase1-demo-field-day", exhibitorId: selectedId });
  const refresh = () => storage.list(userId).then(setRows);
  useEffect(() => {
    alive.current = true;
    storage.list(userId).then(setRows).catch(() => setNotice("기기 저장소를 사용할 수 없습니다. 브라우저 권한/용량을 확인해 주세요."));
    const visibility = () => { if (document.hidden && recorder.current?.state === "recording") { recorder.current.stop(); setNotice("화면이 가려져 녹음을 중지하고 기기에 보관합니다."); } };
    document.addEventListener("visibilitychange", visibility);
    return () => { alive.current = false; document.removeEventListener("visibilitychange", visibility); if (recorder.current?.state === "recording") recorder.current.stop(); stream.current?.getTracks().forEach(track => track.stop()); window.speechSynthesis?.cancel(); };
  }, [userId, storage]);
  useEffect(() => {
    if (!recording) return;
    const timer = window.setInterval(() => setElapsed(value => value + 1), 1000);
    return () => clearInterval(timer);
  }, [recording]);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => { if (recording || requesting || unsaved) { event.preventDefault(); } };
    window.addEventListener("beforeunload", warn); return () => window.removeEventListener("beforeunload", warn);
  }, [recording, requesting, unsaved]);
  async function store(item: SyncItem) {
    try { await storage.put(item); if (alive.current) { setUnsaved(null); await refresh(); setNotice("기기에 저장했습니다. 외부 동기화 대기 중입니다."); } }
    catch { if (alive.current) { setUnsaved(item); setNotice("기기 저장 실패. 이 화면을 유지하고 다시 저장하거나 원본을 다운로드해 주세요."); } }
  }
  function mediaItem(target: Context, blob: Blob, title: string): SyncItem { return { ...target, id: crypto.randomUUID(), title, blob, kind: "MEDIA", revision: 1, state: "LOCAL_PENDING", attempts: 0, nextAttemptAt: 0 }; }
  function speak() {
    if (connected) { setNotice("승인된 기업 음성 해설은 준비 중입니다."); return; }
    if (recording || requesting) return;
    if (!("speechSynthesis" in window)) { setNotice("음성 재생을 지원하지 않습니다. 아래 기업 설명을 확인해 주세요."); return; }
    window.speechSynthesis.cancel();
    if (speaking) { setSpeaking(false); return; }
    const speech = new SpeechSynthesisUtterance("테스트 안내입니다. 실제 기업 해설이 아닙니다. " + selected.summary); speech.lang = "ko-KR";
    speech.onend = () => setSpeaking(false); speech.onerror = () => { setSpeaking(false); setNotice("음성 재생 실패. 기업 설명을 읽어 주세요."); };
    setSpeaking(true); window.speechSynthesis.speak(speech);
  }
  async function record() {
    if (recorder.current?.state === "recording") { recorder.current.stop(); return; }
    if (unsaved || requesting) return;
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") { setNotice("현재 환경에서 녹음을 지원하지 않습니다. 안전한 HTTPS 또는 localhost에서 시도해 주세요."); return; }
    if (!window.confirm("대화 참여자의 녹음 동의를 받았나요? 녹음은 이 기기에만 저장됩니다. 화면 잠금·통화 시 중단될 수 있습니다.")) return;
    const target = context(); setRequesting(true); window.speechSynthesis?.cancel(); setSpeaking(false);
    try {
      const audio = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!alive.current || document.hidden) { audio.getTracks().forEach(track => track.stop()); return; }
      stream.current = audio;
      const mimeType = ["audio/webm;codecs=opus", "audio/mp4", "audio/webm"].find(type => MediaRecorder.isTypeSupported(type));
      const instance = new MediaRecorder(audio, mimeType ? { mimeType } : undefined); recorder.current = instance;
      const chunks: Blob[] = [];
      instance.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
      instance.onerror = () => { setNotice("녹음 오류가 발생했습니다. 중지 후 보관 상태를 확인해 주세요."); if (instance.state !== "inactive") instance.stop(); };
      instance.onstop = () => {
        audio.getTracks().forEach(track => track.stop()); setRecording(false);
        const blob = new Blob(chunks, { type: instance.mimeType || "audio/webm" });
        if (blob.size) void store(mediaItem(target, blob, "현장 녹음")); else setNotice("녹음 데이터가 없습니다. 다시 시도해 주세요.");
      };
      instance.start(1000); setElapsed(0); setRecording(true);
    } catch { stream.current?.getTracks().forEach(track => track.stop()); setNotice("마이크 권한 또는 녹음 장치를 확인해 주세요."); }
    finally { setRequesting(false); }
  }
  function select(id: string) { window.speechSynthesis?.cancel(); setSpeaking(false); setSelectedId(id); }
  const filtered = exhibitors.filter(row => row.name.includes(query.trim()));
  return <div className="mx-auto max-w-5xl bg-[#f7f4e9] px-4 py-7 text-[#173e32] sm:px-8">
    <p className="text-sm font-bold">Gatherly 2.0 · 현장 기록</p><h1 className="mt-2 text-3xl font-bold">지도에서 시작하는 현장 기록</h1>
    <p className="my-4 rounded-xl border border-[#173e32]/20 bg-white/60 p-4 text-sm">{connected ? "제공된 실제 지도 참고본입니다. 검증된 좌표만 선택 영역으로 표시합니다. 저장 후 개인 Google 동기화 버튼을 눌러 주세요." : <>실제 배치도 참고 이미지입니다. 강조 영역과 기업은 <strong>테스트·미검증</strong>이며 실제 부스와 연결되지 않았습니다. 공식 도슨트·Google 저장은 아직 연결 전입니다.</>}</p>
    <p id="map-help" className="mb-2 text-sm font-semibold">↔ 좌우 · ↕ 위아래로 움직여 보세요. 선택 영역을 누르면 아래 카드가 바뀝니다.</p>
    <div ref={viewport} tabIndex={0} role="region" aria-label="양방향 스크롤 부스배치도" aria-describedby="map-help" className="h-[360px] overflow-auto rounded-2xl border-2 border-[#173e32]/30 bg-white" style={{ touchAction: "pan-x pan-y" }} onScroll={() => { if (gesture.current) gesture.current.moved = true; }} onPointerDown={event => { gesture.current = { x: event.clientX, y: event.clientY, left: event.currentTarget.scrollLeft, top: event.currentTarget.scrollTop, moved: false }; }} onPointerMove={event => { if (gesture.current && Math.hypot(event.clientX - gesture.current.x, event.clientY - gesture.current.y) > 8) gesture.current.moved = true; }} onPointerCancel={() => { if (gesture.current) gesture.current.moved = true; }}>
      <div className="relative" style={{ width: 1131, height: 669 }}>
        <Image src="/api/v2/map" alt="사용자 제공 ESG 2026 실제 부스배치도 참고본. 선택 영역은 미검증 테스트입니다." width={1131} height={669} unoptimized draggable={false} className="pointer-events-none h-full w-full max-w-none" />
        {hotspots.filter(h => validHotspot(h, exhibitors.find(e => e.id === h.exhibitorId), connected ? h.mapVersion : "reference-v1") && (!connected || h.review === "VERIFIED")).map(h => <button key={h.id} aria-label={`${exhibitors.find(e => e.id === h.exhibitorId)!.name} 선택`} aria-pressed={selectedId === h.exhibitorId} className={`absolute min-h-11 min-w-11 rounded-lg border-2 border-dashed border-[#173e32] text-xs font-bold ${selectedId === h.exhibitorId ? "bg-[#b9e4ca]/80 ring-4 ring-[#173e32]/50" : "bg-white/70"}`} style={overlay(h.geometry)} onClick={event => { const g = gesture.current; const v = viewport.current; if (event.detail === 0 || (g && v && isTap(g, { x: event.clientX, y: event.clientY }, g.moved || g.left !== v.scrollLeft || g.top !== v.scrollTop))) select(h.exhibitorId); }}>{connected ? "부스 선택" : <>테스트<br />미검증</>}</button>)}
      </div>
    </div>
    <section aria-labelledby="company-heading" className="mt-4 rounded-2xl border border-[#173e32]/20 bg-[#fffdf5] p-5">
      <div className="flex flex-wrap items-center justify-between gap-4"><h2 id="company-heading" className="text-xl font-bold">{selected.name}</h2><div className="flex gap-2" aria-label="기업 기록 도구">
        <button className={buttonStyle} aria-label="테스트 도슨트 재생 또는 중지" disabled={recording || requesting} onClick={speak}><Volume2 size={22} /></button>
        <button className={buttonStyle} aria-label="사진 수집" disabled={!!unsaved} onClick={() => { captureContext.current = context(); input.current?.click(); }}><Camera size={22} /></button>
        <button className={buttonStyle + (recording ? " bg-red-100" : "")} aria-label={recording ? "녹음 중지" : "녹음 시작"} disabled={requesting || !!unsaved} onClick={() => void record()}><Mic size={22} /></button>
        <button className={buttonStyle + " text-xl font-bold"} aria-label="메모 기록" onClick={() => setNote({ context: context(), name: selected.name })}>A</button>
      </div></div>
      <p className="mt-3 text-sm leading-6">{selected.summary}</p><p className="mt-2 text-xs">{connected ? `부스 ${selected.booth ?? "미확인"} · 승인된 기업 음성 해설 준비 중` : "부스번호 미확인 · 공식 출처 미등록 · 도슨트는 브라우저 테스트 음성"}</p>
      {(speaking || recording || requesting) && <p role="status" className="mt-3 font-semibold">{recording ? `녹음 중 ${elapsed}초 · 시작한 기업에 저장됩니다` : requesting ? "마이크 권한 확인 중…" : "테스트 안내 재생 중"}</p>}
      <input ref={input} type="file" accept="image/*" multiple className="sr-only" aria-label="사진 파일 선택" onChange={async event => {
        const files = Array.from(event.target.files ?? []); event.target.value = ""; const target = captureContext.current;
        if (!target) return;
        for (const file of files) {
          if (!file.type.startsWith("image/") || file.size > 10 * 1024 * 1024) { setNotice("이미지는 파일당 10 MiB 이하만 보관합니다. 선택 원본은 삭제되지 않습니다."); continue; }
          const item = mediaItem(target, file, file.name);
          try { await storage.put(item); } catch { setUnsaved(item); setNotice("사진 저장 중 중단됐습니다. 실패 파일을 다시 저장한 뒤 나머지 사진을 다시 선택해 주세요."); break; }
        }
        await refresh().catch(() => setNotice("보관 목록을 읽지 못했습니다."));
      }} />
    </section>
    <section className="mt-5"><label htmlFor="demo-search" className="font-semibold">기업 목록 · 지도 미등록 대안</label><input id="demo-search" value={query} onChange={e => setQuery(e.target.value)} placeholder="테스트 기업 검색" className="my-2 min-h-12 w-full rounded-xl border bg-white p-3" /><div className="flex flex-wrap gap-2">{filtered.map(row => <button key={row.id} className={buttonStyle} onClick={() => select(row.id)}>{row.name}{!hotspots.some(h => h.exhibitorId === row.id) && " · 지도 미등록"}</button>)}{!filtered.length && <p>검색 결과가 없습니다.</p>}</div></section>
    <p role="status" className="my-5 rounded-xl bg-white p-4 text-sm">{notice}</p>
    {unsaved && <div className="mb-4 flex gap-3"><button className={buttonStyle} onClick={() => void store(unsaved)}>기기에 다시 저장</button><button className={buttonStyle} onClick={() => { if (!unsaved.blob) return; const url = URL.createObjectURL(unsaved.blob); const link = document.createElement("a"); link.href = url; link.download = unsaved.blob.type.startsWith("audio/mp4") ? "recording.m4a" : unsaved.blob.type.startsWith("audio/") ? "recording.webm" : unsaved.title; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }}>원본 다운로드</button></div>}
    <section><h2 className="text-lg font-bold">이 기업의 기기 보관함</h2><p className="my-2 text-xs">{connected ? "동기화 완료 상태는 개인 Google 저장까지 확인한 기록입니다. 로컬 대기 자료는 브라우저 삭제 시 사라질 수 있습니다." : "외부 저장 0건 · 새로고침 후에도 이 브라우저에 남습니다. 브라우저 데이터 삭제 시 사라질 수 있습니다."}</p><div className="grid gap-3">{rows.filter(row => row.exhibitorId === selectedId).map(row => <article key={row.id} className="rounded-xl border bg-white p-3"><p className="font-semibold">{row.title || "메모"} · {connected ? ({ SYNCED: "동기화 완료", BLOCKED_REAUTH: "Google 재연결 필요", CONFLICT: "충돌 확인 필요", FAILED_FINAL: "수동 재시도 필요" }[row.state as string] ?? "동기화 대기") : "로컬 대기"}</p>{row.kind === "NOTE" ? <p className="mt-2 whitespace-pre-wrap text-sm">{row.text}</p> : <MediaPreview item={row} />}</article>)}</div></section>
    {connected && <button className={buttonStyle} onClick={async () => { setNotice("개인 Google 저장 확인 중…"); try { setNotice(await connected.sync(storage)); await refresh(); } catch { setNotice("동기화 실패. 로컬 자료는 유지됩니다. 연결과 대기 상태를 확인해 주세요."); } }}>개인 Google 동기화 · 재시도</button>}
    {note && <NoteSheet workspace={storage} context={note.context} companyName={note.name} onClose={() => setNote(null)} onSaved={() => { void refresh(); setNotice(connected ? "메모를 기기에 저장했습니다. 개인 Google 동기화 버튼으로 전송해 주세요." : "메모를 기기에 저장했습니다. Sheets 동기화는 연결 전입니다."); }} />}
  </div>;
}
