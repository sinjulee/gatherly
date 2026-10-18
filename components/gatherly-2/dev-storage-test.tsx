'use client';
import { useEffect, useRef, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { BrowserWorkspace } from '@/lib/gatherly-2/browser-storage';
import type { SyncItem } from '@/lib/gatherly-2/contracts';
import { devUploadReasons } from '@/lib/gatherly-2/dev-ui';
import { checkDevItem, devWorkspaceName, syncDevItem } from '@/lib/gatherly-2/integration/dev-browser';

export function DevStorageTest({ userId, scope, project, enabled }: { userId: string; scope: string; project: string; enabled: boolean }) {
  const [db] = useState(()=>new BrowserWorkspace(devWorkspaceName(scope,project)));
  const [rows,setRows] = useState<SyncItem[]>([]), [note,setNote] = useState('');
  const [connected,setConnected] = useState(false), [busy,setBusy] = useState(false), [locks,setLocks] = useState(false);
  const [notice,setNotice] = useState('개발 전용 자료만 추가해 주세요. 각 자료를 따로 업로드하고 재조회합니다.');
  const [recording,setRecording] = useState(false);
  const recorder = useRef<MediaRecorder|null>(null), stream = useRef<MediaStream|null>(null), working = useRef(false);
  const photo = useRef<HTMLInputElement>(null);
  async function reload() {setRows(await db.list(userId));}
  async function connection() {
    setConnected(false);
    try {const r=await fetch('/api/v2/google/status',{method:'POST',cache:'no-store'});const v=await r.json();setConnected(r.ok&&v.status==='CONNECTED');}
    catch {setConnected(false);}
  }
  useEffect(()=>{
    let alive=true;
    db.list(userId).then(items=>{if(alive){setRows(items);setLocks(!!navigator.locks);}}).catch(()=>{if(alive)setNotice('기기 저장소를 읽지 못했습니다. 원본은 보존됩니다.');});
    const refresh=()=>{void db.list(userId).then(items=>{if(alive)setRows(items);}).catch(()=>{});};
    window.addEventListener('focus',refresh);
    return ()=>{alive=false;window.removeEventListener('focus',refresh);if(recorder.current?.state==='recording')recorder.current.stop();stream.current?.getTracks().forEach(t=>t.stop());};
  },[db,userId]);
  useEffect(()=>{let alive=true;fetch('/api/v2/google/status',{method:'POST',cache:'no-store'}).then(async r=>{const v=await r.json();if(alive)setConnected(r.ok&&v.status==='CONNECTED');}).catch(()=>{});return()=>{alive=false;};},[]);
  async function add(blob?: Blob) {
    if(blob && (!blob.size || blob.size>5*1024*1024)) throw new Error('사진·녹음은 0바이트 초과, 5MiB 이하로 준비해 주세요.');
    if(!blob && !note.trim()) throw new Error('메모를 입력해 주세요.');
    const item:SyncItem={id:crypto.randomUUID(),userId,fieldDayId:'storage-test-event',exhibitorId:'storage-test-company',kind:blob?'MEDIA':'NOTE',title:blob?(blob.type.startsWith('image/')?'개발 사진':'개발 녹음'):'개발 메모',...(blob?{blob}:{text:note.trim()}),revision:1,state:'LOCAL_PENDING',attempts:0,nextAttemptAt:0};
    await db.put(item);if(!blob)setNote('');await reload();setNotice('로컬 저장 완료. 원본은 업로드 후에도 유지됩니다.');
  }
  async function perform(action:()=>Promise<void>) {
    if(working.current)return;working.current=true;setBusy(true);
    try {await action();}catch(e){setNotice(e instanceof Error?e.message:'처리 실패. 원본은 보존됩니다.');}
    finally {working.current=false;setBusy(false);await reload().catch(()=>{});}
  }
  async function startRecording() {
    try {
      const input=await navigator.mediaDevices.getUserMedia({audio:true});stream.current=input;
      const mime=['audio/mp4','audio/webm'].find(v=>MediaRecorder.isTypeSupported(v));
      const r=new MediaRecorder(input,mime?{mimeType:mime}:undefined);recorder.current=r;const parts:Blob[]=[];let size=0;
      r.ondataavailable=e=>{if(e.data.size){parts.push(e.data);size+=e.data.size;if(size>5*1024*1024&&r.state==='recording')r.stop();}};
      r.onstop=()=>{input.getTracks().forEach(t=>t.stop());setRecording(false);void add(new Blob(parts,{type:r.mimeType})).catch(e=>setNotice(e.message));};
      r.start(1000);setRecording(true);
    }catch{stream.current?.getTracks().forEach(t=>t.stop());setNotice('마이크 권한 또는 녹음 지원을 확인해 주세요.');}
  }
  return <section className="v2-shell"><div className="v2-card"><h1 className="text-xl font-bold">개발 자료 저장 테스트</h1><p>개발 전용 Google 폴더·Sheets를 사용합니다. 파일당 5MiB, 최대 100개 기록·100MiB. 실제 행사 자료는 넣지 마세요.</p><p role="status" className="v2-status">{connected?'Google 연결 정보 확인됨':'Google 연결 확인 필요'} · {enabled?'개발 저장 허용':'개발 저장 비활성'}</p><div className="v2-actions"><button className="v2-button" onClick={()=>void connection()}>연결 상태 확인</button><form action="/api/v2/google/connect" method="post"><button className="v2-button">Google Drive·Sheets 연결</button></form></div><p role="status" className="v2-status">{notice}</p></div>
    <div className="v2-card"><h2>자료 추가</h2><input hidden ref={photo} type="file" accept="image/*" onChange={e=>{const file=e.target.files?.[0];e.target.value='';if(file)void perform(()=>add(file));}}/><div className="v2-actions"><button className="v2-button" disabled={busy||recording} onClick={()=>photo.current?.click()}>사진 추가</button><button className="v2-button" disabled={busy} onClick={()=>{if(recording)recorder.current?.stop();else void perform(startRecording);}}>{recording?'녹음 종료 · 로컬 저장':'녹음 추가'}</button></div><label className="grid gap-3">메모<textarea maxLength={500} value={note} onChange={e=>setNote(e.target.value)} className="min-h-24 rounded border p-3"/></label><button className="v2-button" disabled={busy||!note.trim()} onClick={()=>void perform(()=>add())}>메모 추가</button></div>
    <div className="grid gap-4">{rows.map(row=>{const reasons=devUploadReasons(row,connected,enabled,busy||recording,locks);return <article key={row.id} className="v2-card"><div className="flex items-start justify-between gap-4"><h2>{row.title}</h2><button aria-label={`${row.title} 로컬 삭제`} className="v2-button min-h-12 min-w-12" disabled={busy||recording} onClick={()=>{if(window.confirm('이 기기의 원본과 대기 작업을 삭제할까요? 되돌릴 수 없으며 Google 파일·기록은 삭제되지 않습니다. 원격 결과가 미확인이면 Google에 자료가 남아 있을 수 있습니다.'))void perform(async()=>{await db.deletePilotLocal(row,userId);setNotice('로컬 삭제 완료. Google 자료는 유지됩니다.');});}}><Trash2 size={22}/></button></div><p>{row.state} · 전송 시도 {row.attempts}회</p><DevPreview item={row}/>{reasons.map(reason=><p key={reason}>{reason}</p>)}<div className="v2-actions"><button className="v2-button v2-button-primary" disabled={reasons.length>0} onClick={()=>void perform(async()=>{await syncDevItem(db,userId,row);setNotice('Google 저장 및 재조회 성공. 로컬 원본 유지.');})}>{row.attempts?'같은 기록 재시도':'Google 업로드'}</button><button className="v2-button" disabled={!connected||!enabled||busy||recording} onClick={()=>void perform(async()=>{const state=await checkDevItem(userId,row.id);const labels:Record<string,string>={VERIFIED:'원격 재조회 성공',NOT_UPLOADED:'전송 기록 없음',PENDING:'저장 미완료',SHEET_PENDING:'Drive 확인됨 · Sheets 미완료'};setNotice(labels[state]??'조회 상태 확인 필요');})}>업로드 결과 확인</button></div></article>;})}</div></section>;
}
function DevPreview({item}:{item:SyncItem}) {
  const picture=useRef<HTMLImageElement>(null),audio=useRef<HTMLAudioElement>(null);
  useEffect(()=>{if(!item.blob)return;const next=URL.createObjectURL(item.blob),element=picture.current??audio.current;if(element)element.src=next;return()=>{element?.removeAttribute('src');URL.revokeObjectURL(next);};},[item.blob]);
  if(item.kind==='NOTE')return <p className="whitespace-pre-wrap">{item.text}</p>;
  // eslint-disable-next-line @next/next/no-img-element
  return item.blob?.type.startsWith('image/')?<img ref={picture} alt="개발 사진" className="max-h-48 max-w-full object-contain"/>:<audio ref={audio} controls className="max-w-full"/>;
}
