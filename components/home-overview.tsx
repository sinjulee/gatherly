"use client";

import { useMemo, useState } from "react";
import { Camera, FileText, Mic, Play } from "lucide-react";

type Project = { id: string; title: string; status: string };
type MaterialSummary = { id: string; fieldDayId: string | null; type: string; title: string; uploadStatus: string };
type ReportSummary = { id: string; fieldDayId: string | null; status: string };

const iconFor = (type: string) => type === "IMAGE" ? Camera : type === "VIDEO" ? Play : type === "AUDIO" ? Mic : FileText;

export function HomeOverview({
  projects,
  materials,
  reports,
}: {
  projects: Project[];
  materials: MaterialSummary[];
  reports: ReportSummary[];
}) {
  const activeProject = projects.find((project) => project.status === "ACTIVE");
  const [fieldDayId, setFieldDayId] = useState(activeProject?.id ?? projects[0]?.id ?? "ALL");

  const selectedProject = projects.find((project) => project.id === fieldDayId);
  const scopedMaterials = useMemo(
    () => fieldDayId === "ALL" ? materials : materials.filter((item) => item.fieldDayId === fieldDayId),
    [fieldDayId, materials],
  );
  const scopedReports = useMemo(
    () => fieldDayId === "ALL" ? reports : reports.filter((item) => item.fieldDayId === fieldDayId),
    [fieldDayId, reports],
  );

  const storedCount = scopedMaterials.filter((item) => item.uploadStatus === "STORED").length;
  const pendingCount = scopedMaterials.filter((item) => item.uploadStatus !== "STORED").length;
  const completedReportCount = scopedReports.filter((item) => item.status === "COMPLETED" || item.status === "DRAFT").length;
  const recent = scopedMaterials.slice(0, 4);
  const scopeLabel = fieldDayId === "ALL" ? "전체 현장" : selectedProject?.title || "현장";

  const stats = [
    { label: "저장된 자료", value: storedCount, unit: "개", tone: "bg-mint", valueTone: "text-orange" },
    { label: "저장 대기·실패", value: pendingCount, unit: "개", tone: "bg-orange", valueTone: "text-white" },
    { label: "완성한 보고서", value: completedReportCount, unit: "개", tone: "bg-surface", valueTone: "text-orange" },
  ];

  return <>
    <section className="mt-7 paper-card p-4 md:p-5">
      <div className="flex min-w-0 flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-extrabold text-orange">OVERVIEW FILTER</p>
          <h2 className="mt-1 text-lg font-extrabold">현장별 현황 보기</h2>
          <p className="mt-1 text-xs text-secondary">아래 카드와 최근 저장 자료가 선택한 현장을 기준으로 함께 바뀝니다.</p>
        </div>
        <label className="flex w-full min-w-0 flex-col gap-2 text-sm font-bold md:w-auto md:min-w-56">
          현장 선택
          <select value={fieldDayId} onChange={(event) => setFieldDayId(event.target.value)} className="min-h-11 w-full min-w-0 rounded-lg border border-ui bg-surface px-3">
            <option value="ALL">전체 현장</option>
            {projects.map((project) => <option key={project.id} value={project.id}>{project.title}</option>)}
          </select>
        </label>
      </div>
    </section>

    <section className="mt-4 grid gap-4 md:grid-cols-3">
      {stats.map((stat) => <div key={stat.label} className={"collage-card " + stat.tone + " p-5"}>
        <div className="flex items-start justify-between gap-3">
          <p className="text-sm font-semibold">{stat.label}</p>
          <span className="max-w-[55%] truncate rounded-full bg-surface/70 px-2.5 py-1 text-[10px] font-extrabold text-ink">{scopeLabel}</span>
        </div>
        <div className="mt-3 flex items-end gap-2"><span className={"text-5xl font-extrabold " + stat.valueTone}>{stat.value}</span><span className="mb-1 text-sm font-semibold">{stat.unit}</span></div>
      </div>)}
    </section>

    <section className="paper-card mt-5 p-5 md:p-6">
      <div className="flex min-w-0 flex-col gap-1 border-b border-ui pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div><h2 className="text-xl font-extrabold">최근 저장 자료</h2><p className="mt-1 text-sm text-secondary">선택한 현장의 최신 자료입니다.</p></div>
        <span className="mt-2 self-start rounded-full bg-page px-3 py-2 text-xs font-extrabold sm:mt-0">{scopeLabel}</span>
      </div>
      <div className="mt-5 space-y-4">
        {recent.length ? recent.map((material) => { const Icon = iconFor(material.type); return <div className="flex min-w-0 items-center gap-3" key={material.id}><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-mint"><Icon size={16} /></span><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{material.title}</p><p className="mt-0.5 text-xs text-secondary">{material.uploadStatus === "STORED" ? "저장 완료" : material.uploadStatus}</p></div></div>; }) : <p className="rounded-xl bg-page p-4 text-sm text-secondary">선택한 현장에 저장된 자료가 없습니다.</p>}
      </div>
    </section>
  </>;
}
