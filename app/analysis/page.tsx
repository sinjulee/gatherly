import { PageHeader } from "@/components/app-shell";
import { AnalysisWorkspaceShell } from "@/components/analysis-workspace-shell";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function Analysis() {
  const [projects, materials, bundles] = await Promise.all([
    prisma.fieldDay.findMany({
      where: { deletedAt: null },
      orderBy: [{ status: "asc" }, { fieldDate: "desc" }],
      select: { id: true, title: true, location: true, fieldDate: true },
    }),
    prisma.material.findMany({
      where: { deletedAt: null, uploadStatus: "STORED" },
      orderBy: { createdAt: "desc" },
      select: { id: true, fieldDayId: true, type: true, title: true, reviewStatus: true, isImportant: true, createdAt: true },
    }),
    prisma.sourceBundle.findMany({
      orderBy: [{ fieldDayId: "asc" }, { version: "desc" }],
      include: { _count: { select: { items: true, sourceDocuments: true } } },
    }),
  ]);

  return <div className="mx-auto max-w-[1320px] px-5 py-7 md:px-10 md:py-10">
    <PageHeader eyebrow="FIELD AI · RESEARCH" title="정리·분석함" description="현장에서는 Mac mini + Codex로 빠르게 분석하고, 필요할 때 NotebookLM으로 심층 연구를 확장합니다." />
    <AnalysisWorkspaceShell
      projects={projects.map((project) => ({ ...project, fieldDate: project.fieldDate.toISOString() }))}
      initialMaterials={materials.map((material) => ({ ...material, createdAt: material.createdAt.toISOString() }))}
      initialBundles={bundles.map((bundle) => ({ id: bundle.id, fieldDayId: bundle.fieldDayId, version: bundle.version, title: bundle.title, status: bundle.status, createdAt: bundle.createdAt.toISOString(), _count: bundle._count }))}
    />
  </div>;
}
