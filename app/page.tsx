import { FieldDayManager, type FieldDaySummary } from "@/components/field-day-manager";
import { HomeOverview } from "@/components/home-overview";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [projectRows, materials, reports] = await Promise.all([
    prisma.fieldDay.findMany({
      where: { deletedAt: null },
      orderBy: [{ status: "asc" }, { fieldDate: "desc" }],
      include: { _count: { select: { materials: { where: { deletedAt: null, uploadStatus: "STORED" } } } } },
    }),
    prisma.material.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: "desc" },
      select: { id: true, fieldDayId: true, type: true, title: true, uploadStatus: true },
    }),
    prisma.report.findMany({
      select: { id: true, fieldDayId: true, status: true },
    }),
  ]);

  const projects: FieldDaySummary[] = projectRows.map((project) => ({
    id: project.id,
    title: project.title,
    description: project.description,
    location: project.location,
    fieldDate: project.fieldDate.toISOString(),
    status: project.status,
    _count: project._count,
  }));
  const activeProject = projects.find((project) => project.status === "ACTIVE");

  return <div className="mx-auto max-w-[1320px] px-5 py-7 md:px-10 md:py-10">
    <header className="border-b border-ui pb-7">
      <p className="mb-2 text-sm font-extrabold text-orange">FIELD DAY</p>
      <h1 className="text-3xl font-extrabold tracking-tight md:text-5xl">오늘의 현장</h1>
      <p className="mt-2 max-w-xl text-sm text-secondary">{activeProject ? activeProject.title + "에 자료를 안전하게 기록할 수 있습니다." : "진행 중인 현장을 만들고 자료를 남겨 보세요."}</p>
    </header>

    <HomeOverview
      projects={projects.map((project) => ({ id: project.id, title: project.title, status: project.status }))}
      materials={materials}
      reports={reports}
    />

    <section className="mt-8">
      <FieldDayManager initialProjects={projects} />
    </section>
  </div>;
}
