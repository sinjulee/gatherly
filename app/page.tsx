import { Camera, FileText, Mic, Play } from "lucide-react";
import { FieldDayManager, type FieldDaySummary } from "@/components/field-day-manager";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const iconFor = (type: string) => type === "IMAGE" ? Camera : type === "VIDEO" ? Play : type === "AUDIO" ? Mic : FileText;

export default async function Home() {
  const [projectRows, storedCount, pendingCount, reportCount, recent] = await Promise.all([
    prisma.fieldDay.findMany({ where: { deletedAt: null }, orderBy: [{ status: "asc" }, { fieldDate: "desc" }], include: { _count: { select: { materials: { where: { deletedAt: null, uploadStatus: "STORED" } } } } } }),
    prisma.material.count({ where: { deletedAt: null, uploadStatus: "STORED" } }),
    prisma.material.count({ where: { deletedAt: null, uploadStatus: { not: "STORED" } } }),
    prisma.report.count(),
    prisma.material.findMany({ where: { deletedAt: null }, orderBy: { createdAt: "desc" }, take: 4, include: { fieldDay: { select: { title: true } } } }),
  ]);
  const projects: FieldDaySummary[] = projectRows.map((project) => ({ id: project.id, title: project.title, description: project.description, location: project.location, fieldDate: project.fieldDate.toISOString(), status: project.status, _count: project._count }));
  const activeProject = projects.find((project) => project.status === "ACTIVE");
  const stats = [{ label: "저장된 자료", value: storedCount, unit: "개", tone: "bg-mint", valueTone: "text-orange" }, { label: "저장 대기·실패", value: pendingCount, unit: "개", tone: "bg-orange", valueTone: "text-white" }, { label: "완성한 보고서", value: reportCount, unit: "개", tone: "bg-surface", valueTone: "text-orange" }];
  return <div className="mx-auto max-w-[1320px] px-5 py-7 md:px-10 md:py-10"><header className="border-b border-ui pb-7"><p className="mb-2 text-sm font-extrabold text-orange">FIELD DAY</p><h1 className="text-3xl font-extrabold tracking-tight md:text-5xl">오늘의 현장</h1><p className="mt-2 max-w-xl text-sm text-secondary">{activeProject ? activeProject.title + "에 자료를 안전하게 기록할 수 있습니다." : "진행 중인 현장을 만들고 자료를 남겨 보세요."}</p></header><section className="mt-7 grid gap-4 md:grid-cols-3">{stats.map((stat) => <div key={stat.label} className={"collage-card " + stat.tone + " p-5"}><p className="text-sm font-semibold">{stat.label}</p><div className="mt-3 flex items-end gap-2"><span className={"text-5xl font-extrabold " + stat.valueTone}>{stat.value}</span><span className="mb-1 text-sm font-semibold">{stat.unit}</span></div></div>)}</section><section className="mt-8 grid gap-5 xl:grid-cols-[1.2fr_0.8fr]"><FieldDayManager initialProjects={projects} /><section className="paper-card p-6"><h2 className="text-xl font-extrabold">최근 저장 자료</h2><p className="mt-1 text-sm text-secondary">SQLite에 저장 완료된 자료입니다.</p><div className="mt-5 space-y-4">{recent.length ? recent.map((material) => { const Icon = iconFor(material.type); return <div className="flex items-center gap-3" key={material.id}><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-mint"><Icon size={16} /></span><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{material.title}</p><p className="mt-0.5 text-xs text-secondary">{material.fieldDay?.title || "현장 미지정"} · {material.uploadStatus === "STORED" ? "저장 완료" : material.uploadStatus}</p></div></div>; }) : <p className="rounded-xl bg-page p-4 text-sm text-secondary">아직 저장된 자료가 없습니다.</p>}</div></section></section></div>;
}
