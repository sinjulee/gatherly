"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { Camera, FileText, Mic, Video, X } from "lucide-react";

type Material = { id: string; type: string; title: string; content: string | null; uploadStatus: string; createdAt: string };
const labels: Record<string, string> = { IMAGE: "사진", VIDEO: "영상", AUDIO: "음성", TEXT: "메모" };

export function CompanyMaterials({ companyId, refreshToken }: { companyId: string; refreshToken: number }) {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [selected, setSelected] = useState<Material | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    void fetch("/api/materials?companyId=" + encodeURIComponent(companyId), { cache: "no-store" }).then(async (response) => {
      const data = await response.json() as { materials?: Material[]; error?: string };
      if (!active) return;
      if (!response.ok) { setError(data.error || "현장 자료를 불러오지 못했습니다."); return; }
      setMaterials((data.materials ?? []).filter((material) => material.uploadStatus === "STORED"));
      setError("");
    }).catch(() => { if (active) setError("현장 자료를 불러오지 못했습니다."); });
    return () => { active = false; };
  }, [companyId, refreshToken]);

  const counts = { IMAGE: 0, VIDEO: 0, AUDIO: 0, TEXT: 0 };
  for (const material of materials) if (material.type in counts) counts[material.type as keyof typeof counts]++;
  return <section className="paper-card min-w-0 p-5"><h2 className="text-sm font-extrabold">현장 자료</h2>
    <div className="mt-3 grid grid-cols-4 gap-1 text-center text-[11px] font-bold text-secondary"><span>사진 {counts.IMAGE}</span><span>영상 {counts.VIDEO}</span><span>음성 {counts.AUDIO}</span><span>메모 {counts.TEXT}</span></div>
    {error && <p role="alert" className="mt-3 text-xs text-orange">{error}</p>}
    {!materials.length && !error && <p className="mt-3 rounded-xl bg-page p-3 text-xs leading-5 text-secondary">아직 연결된 자료가 없습니다. 사진·음성·메모를 입력하면 이곳에 나타납니다.</p>}
    {!!materials.length && <div className="mt-3 grid gap-2">{materials.slice(0, 5).map((material) => <button type="button" key={material.id} onClick={() => setSelected(material)} className="flex min-h-14 min-w-0 items-center gap-2 rounded-xl border border-ui p-2 text-left text-xs font-bold"><span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-mint">{material.type === "IMAGE" ? <Image src={"/api/materials/" + material.id + "/file"} alt="" width={40} height={40} className="h-10 w-10 object-cover" /> : material.type === "VIDEO" ? <Video size={18} /> : material.type === "AUDIO" ? <Mic size={18} /> : material.type === "TEXT" ? <FileText size={18} /> : <Camera size={18} />}</span><span className="min-w-0 flex-1"><span className="block truncate">{material.title}</span><span className="mt-1 block truncate text-[11px] font-normal text-secondary">{labels[material.type] || material.type}{material.type === "TEXT" && material.content ? " · " + material.content.slice(0, 40) : ""}</span></span></button>)}</div>}
    {selected && <div role="presentation" onClick={() => setSelected(null)} className="fixed inset-0 z-40 flex items-end justify-center bg-ink/60 md:items-center"><section role="dialog" aria-modal="true" aria-label="현장 자료 미리보기" onClick={(event) => event.stopPropagation()} className="max-h-[90dvh] w-full max-w-xl overflow-auto rounded-t-3xl bg-surface p-5 pb-[calc(24px+env(safe-area-inset-bottom))] md:rounded-3xl"><div className="flex items-center justify-between gap-3"><h3 className="min-w-0 break-words text-lg font-extrabold">{selected.title}</h3><button type="button" onClick={() => setSelected(null)} aria-label="미리보기 닫기" className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-xl border border-ui"><X size={18} /></button></div>{selected.type === "IMAGE" ? <Image src={"/api/materials/" + selected.id + "/file"} alt={selected.title} width={720} height={480} className="mt-4 h-auto w-full object-contain" /> : selected.type === "VIDEO" ? <video controls src={"/api/materials/" + selected.id + "/file"} className="mt-4 w-full" /> : selected.type === "AUDIO" ? <audio controls src={"/api/materials/" + selected.id + "/file"} className="mt-4 w-full" /> : <p className="mt-4 whitespace-pre-wrap break-words rounded-xl bg-page p-4 text-sm">{selected.content}</p>}</section></div>}
  </section>;
}
