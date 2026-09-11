"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, CloudUpload, FileText, Pencil, RefreshCw, Sparkles, TriangleAlert } from "lucide-react";

type Project = { id: string; title: string };
type Report = {
  id: string; title: string; status: string; content: string | null; instruction: string | null; version: number;
  parentReportId: string | null; googleDocId: string | null; errorMessageSafe: string | null;
  createdAt: string; updatedAt: string; completedAt: string | null;
};

const statusLabel: Record<string,string> = { QUEUED:"생성 대기", RUNNING:"Codex 작성 중", COMPLETED:"초안 완료", FAILED:"생성 실패", DRAFT:"초안" };

export function FinalReportWorkspace({ projects }: { projects: Project[] }) {
  const [projectId,setProjectId]=useState(projects[0]?.id ?? "");
  const [reports,setReports]=useState<Report[]>([]);
  const [title,setTitle]=useState("");
  const [instruction,setInstruction]=useState("");
  const [submitting,setSubmitting]=useState(false);
  const [notice,setNotice]=useState("");
  const [selectedId,setSelectedId]=useState("");
  const [revisionInstruction,setRevisionInstruction]=useState("");
  const [editing,setEditing]=useState(false);
  const [editContent,setEditContent]=useState("");
  const [syncing,setSyncing]=useState(false);

  const selected = useMemo(()=>reports.find(r=>r.id===selectedId) ?? reports[0], [reports,selectedId]);

  useEffect(()=>{
    if(!projectId){setReports([]);return;}
    let alive=true;
    async function load(){
      try{const r=await fetch(`/api/reports?fieldDayId=${encodeURIComponent(projectId)}`,{cache:"no-store"});const d=await r.json();if(!alive||!r.ok)return;setReports(d.reports??[]);setSelectedId(current=>current && (d.reports??[]).some((x:Report)=>x.id===current)?current:(d.reports?.[0]?.id??""));}catch{}
    }
    void load(); const timer=window.setInterval(()=>void load(),3000);
    return()=>{alive=false;window.clearInterval(timer);};
  },[projectId]);

  async function createReport(parentReportId?:string){
    if(!projectId||submitting)return; const isRevision=Boolean(parentReportId); const requestInstruction=isRevision?revisionInstruction.trim():instruction.trim();
    setSubmitting(true);setNotice("");
    try{const r=await fetch("/api/reports",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({fieldDayId:projectId,title:title.trim(),instruction:requestInstruction,parentReportId:parentReportId||null})});const d=await r.json();if(!r.ok)throw new Error(d.error||"보고서 생성을 요청하지 못했습니다.");setReports(c=>[d.report,...c]);setSelectedId(d.report.id);if(isRevision)setRevisionInstruction("");else{setInstruction("");setTitle("");}setNotice(isRevision?`v${d.report.version} 수정본 생성을 시작했습니다.`:"Mac mini Codex에 최종 보고서 생성을 요청했습니다.");}catch(c){setNotice(c instanceof Error?c.message:"보고서 요청에 실패했습니다.");}finally{setSubmitting(false);}
  }

  async function saveManualEdit(){
    if(!selected||!editContent.trim())return; setSubmitting(true);setNotice("");
    try{const r=await fetch("/api/reports",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:selected.id,content:editContent})});const d=await r.json();if(!r.ok)throw new Error(d.error||"수정 내용을 저장하지 못했습니다.");setReports(c=>c.map(x=>x.id===selected.id?{...x,...d.report}:x));setEditing(false);setNotice("직접 수정한 내용을 저장했습니다.");}catch(c){setNotice(c instanceof Error?c.message:"저장에 실패했습니다.");}finally{setSubmitting(false);}
  }

  async function syncDocs(){
    if(!selected?.content||syncing)return;setSyncing(true);setNotice("");
    try{const r=await fetch(`/api/reports/${selected.id}/sync-docs`,{method:"POST"});const d=await r.json();if(!r.ok)throw new Error(d.error||"Google Docs 출력에 실패했습니다.");setReports(c=>c.map(x=>x.id===selected.id?{...x,googleDocId:d.googleDocId}:x));setNotice("Google Docs에 최종 보고서를 출력했습니다.");window.open(d.documentUrl,"_blank","noopener,noreferrer");}catch(c){setNotice(c instanceof Error?c.message:"Google Docs 출력에 실패했습니다.");}finally{setSyncing(false);}
  }

  return <div className="mt-7 grid gap-5">
    <section className="paper-card p-4 md:p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div><p className="text-sm font-extrabold text-orange">FINAL REPORT · CODEX</p><h2 className="mt-1 text-2xl font-extrabold">최종 보고서 생성</h2><p className="mt-1 max-w-3xl text-sm text-secondary">현장 Evidence, 최신 Analysis Brief, Quick Analysis 결과를 합쳐 Mac mini의 Codex CLI가 보고서 초안을 만듭니다.</p></div>
        <label className="flex min-w-0 flex-col gap-2 text-sm font-bold">현장<select value={projectId} onChange={e=>{setProjectId(e.target.value);setSelectedId("");setNotice("");}} className="min-h-11 w-full min-w-0 rounded-lg border border-ui bg-surface px-3 md:w-auto"><option value="">선택</option>{projects.map(p=><option key={p.id} value={p.id}>{p.title}</option>)}</select></label>
      </div>
      <div className="mt-5 grid gap-3 md:grid-cols-[0.7fr_1.3fr]"><input value={title} onChange={e=>setTitle(e.target.value)} placeholder="보고서 제목 (비워두면 현장명으로 자동 생성)" className="min-h-11 w-full min-w-0 rounded-xl border border-ui bg-surface px-3 text-sm"/><textarea value={instruction} onChange={e=>setInstruction(e.target.value)} placeholder="보고서에 특별히 반영할 지시가 있으면 입력하세요. 예) 시장성·실행 가능성 중심으로 경영진 보고용 10페이지 분량으로 작성" className="min-h-24 w-full min-w-0 rounded-xl border border-ui bg-surface p-3 text-sm"/></div>
      <button disabled={!projectId||submitting} onClick={()=>void createReport()} className="mt-3 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-ink px-4 text-sm font-extrabold text-white disabled:opacity-40"><Sparkles size={18}/>{submitting?"요청 중…":"Codex로 최종 보고서 생성"}</button>
      {notice&&<p className="mt-3 rounded-xl bg-mint/40 p-3 text-sm font-semibold">{notice}</p>}
    </section>

    <div className="grid gap-5 xl:grid-cols-[0.34fr_0.66fr]">
      <section className="paper-card p-4 md:p-5"><div className="flex items-center gap-2"><FileText size={18}/><h3 className="font-extrabold">보고서 버전</h3></div><div className="mt-3 grid gap-2">{reports.map(r=><button key={r.id} onClick={()=>{setSelectedId(r.id);setEditing(false);}} className={`min-h-0 rounded-xl p-3 text-left ${selected?.id===r.id?"bg-mint":"bg-page"}`}><div className="flex items-center justify-between gap-2"><strong className="min-w-0 truncate text-sm">v{r.version} · {r.title}</strong><span className="shrink-0 text-[11px] font-bold text-secondary">{statusLabel[r.status]??r.status}</span></div><p className="mt-1 text-[11px] text-secondary">{new Date(r.createdAt).toLocaleString("ko-KR")}</p></button>)}{!reports.length&&<p className="py-8 text-center text-sm text-secondary">아직 생성된 보고서가 없습니다.</p>}</div></section>

      <section className="paper-card min-w-0 p-4 md:p-6">
        {!selected&&<div className="py-16 text-center text-sm text-secondary">보고서를 생성하거나 왼쪽에서 버전을 선택하세요.</div>}
        {selected&&<>
          <div className="flex flex-col gap-3 border-b border-ui pb-4 md:flex-row md:items-center md:justify-between"><div className="min-w-0"><p className="text-xs font-extrabold text-orange">FINAL REPORT v{selected.version}</p><h3 className="mt-1 break-words text-xl font-extrabold">{selected.title}</h3></div><span className="self-start rounded-full bg-page px-3 py-2 text-xs font-extrabold">{statusLabel[selected.status]??selected.status}</span></div>

          {(selected.status==="QUEUED"||selected.status==="RUNNING")&&<div className="mt-5 flex items-center gap-3 rounded-xl bg-orange/15 p-4"><RefreshCw className="animate-spin" size={18}/><div><strong className="text-sm">{selected.status==="RUNNING"?"Mac mini의 Codex가 보고서를 작성하고 있습니다.":"보고서 생성 대기열에 등록되었습니다."}</strong><p className="mt-1 text-xs text-secondary">이 화면은 자동으로 갱신됩니다. 페이지를 계속 열어둘 필요는 없습니다.</p></div></div>}
          {selected.status==="FAILED"&&<div className="mt-5 rounded-xl bg-page p-4"><p className="flex items-center gap-2 text-sm font-extrabold"><TriangleAlert size={17}/>보고서 생성을 완료하지 못했습니다.</p><p className="mt-2 break-words text-xs text-secondary">{selected.errorMessageSafe}</p></div>}

          {selected.content&&<>
            {editing?<div className="mt-5"><textarea value={editContent} onChange={e=>setEditContent(e.target.value)} className="min-h-[55vh] w-full min-w-0 rounded-xl border border-ui bg-page p-4 font-mono text-[13px] leading-6"/><div className="mt-3 flex gap-2"><button onClick={()=>void saveManualEdit()} disabled={submitting} className="min-h-11 flex-1 rounded-xl bg-ink px-4 text-sm font-extrabold text-white">수정 저장</button><button onClick={()=>setEditing(false)} className="min-h-11 rounded-xl bg-page px-4 text-sm font-extrabold">취소</button></div></div>:<article className="mt-5 max-h-[65vh] overflow-y-auto rounded-xl bg-page p-4"><div className="whitespace-pre-wrap break-words text-[13px] leading-6">{selected.content}</div></article>}

            {!editing&&<div className="mt-4 grid gap-2 sm:grid-cols-2"><button onClick={()=>{setEditContent(selected.content||"");setEditing(true);}} className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-page px-4 text-sm font-extrabold"><Pencil size={16}/>직접 수정</button><button onClick={()=>void syncDocs()} disabled={syncing} className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-mint px-4 text-sm font-extrabold disabled:opacity-50"><CloudUpload size={16}/>{syncing?"출력 중…":selected.googleDocId?"Google Docs 다시 출력":"Google Docs로 출력"}</button></div>}

            <div className="mt-5 rounded-xl bg-orange/10 p-4"><p className="text-sm font-extrabold">AI 수정 요청</p><p className="mt-1 text-xs text-secondary">현재 버전을 보존하고 새 버전을 생성합니다.</p><textarea value={revisionInstruction} onChange={e=>setRevisionInstruction(e.target.value)} placeholder="예) Executive Summary를 더 짧게 줄이고, 실행 우선순위를 표 형태로 추가해줘." className="mt-3 min-h-24 w-full min-w-0 rounded-xl border border-ui bg-surface p-3 text-sm"/><button disabled={!revisionInstruction.trim()||submitting} onClick={()=>void createReport(selected.id)} className="mt-2 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-orange px-4 text-sm font-extrabold disabled:opacity-40"><Sparkles size={16}/>수정본 새 버전 생성</button></div>
          </>}
        </>}
      </section>
    </div>
  </div>;
}
