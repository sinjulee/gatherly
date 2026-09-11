"use client";

import { useMemo, useState } from "react";
import { MapPin } from "lucide-react";
import { AnalysisBriefWorkspace } from "@/components/analysis-brief-workspace";
import { QuickAnalysisWorkspace } from "@/components/quick-analysis-workspace";
import { ResearchPipelineWorkspace } from "@/components/research-pipeline-workspace";

type Project = { id: string; title: string; location: string | null; fieldDate: string };
type ResearchMaterial = { id: string; fieldDayId: string | null; type: string; title: string; reviewStatus: string; isImportant: boolean; createdAt: string };
type Bundle = { id: string; fieldDayId: string; version: number; title: string; status: string; createdAt: string; _count: { items: number; sourceDocuments: number } };

export function AnalysisWorkspaceShell({
  projects,
  initialMaterials,
  initialBundles,
}: {
  projects: Project[];
  initialMaterials: ResearchMaterial[];
  initialBundles: Bundle[];
}) {
  const [projectId, setProjectId] = useState(projects[0]?.id ?? "");

  const orderedProjects = useMemo(() => {
    if (!projectId) return projects;
    const selected = projects.find((project) => project.id === projectId);
    if (!selected) return projects;
    return [selected, ...projects.filter((project) => project.id !== projectId)];
  }, [projectId, projects]);

  const projectOptions = orderedProjects.map((project) => ({ id: project.id, title: project.title }));
  const selectedProject = projects.find((project) => project.id === projectId);

  return (
    <div className="analysis-unified-project">
      <section className="paper-card mt-5 p-4 sm:p-5 md:p-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-extrabold text-orange">ACTIVE FIELD PROJECT</p>
            <h2 className="mt-1 text-xl font-extrabold">정리·분석할 현장</h2>
            <p className="mt-1 text-sm text-secondary">여기서 한 번 선택하면 아래 모든 분석 기능에 같은 현장이 적용됩니다.</p>
          </div>
          <label className="flex w-full min-w-0 flex-col gap-2 text-sm font-extrabold md:w-auto md:min-w-[280px]">
            현장 선택
            <select
              value={projectId}
              onChange={(event) => setProjectId(event.target.value)}
              className="min-h-12 w-full min-w-0 rounded-xl border border-ui bg-surface px-3 text-base font-bold"
            >
              <option value="">현장을 선택하세요</option>
              {projects.map((project) => <option key={project.id} value={project.id}>{project.title}</option>)}
            </select>
          </label>
        </div>
        {selectedProject && (
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-semibold text-secondary">
            <MapPin size={14} />
            <span>{selectedProject.location || "장소 미입력"}</span>
            <span>·</span>
            <span>{new Date(selectedProject.fieldDate).toLocaleDateString("ko-KR")}</span>
          </div>
        )}
      </section>

      {projectId ? (
        <div key={projectId} className="analysis-shared-project-content">
          <QuickAnalysisWorkspace projects={projectOptions} />
          <ResearchPipelineWorkspace projects={orderedProjects} initialMaterials={initialMaterials} initialBundles={initialBundles} />
          <AnalysisBriefWorkspace projects={projectOptions} />
        </div>
      ) : (
        <div className="paper-card mt-5 p-8 text-center text-sm text-secondary">상단에서 정리·분석할 현장을 선택해 주세요.</div>
      )}
    </div>
  );
}
