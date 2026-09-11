import { PageHeader } from "@/components/app-shell";
import { InboxWorkspace } from "@/components/inbox-workspace";
import { prisma } from "@/lib/prisma";
import type { FieldDaySummary } from "@/components/field-day-manager";

export const dynamic = "force-dynamic";

export default async function Inbox() {
  const rows = await prisma.fieldDay.findMany({ where: { deletedAt: null }, orderBy: [{ status: "asc" }, { fieldDate: "desc" }], include: { _count: { select: { materials: { where: { deletedAt: null, uploadStatus: "STORED" } } } } } });
  const projects: FieldDaySummary[] = rows.map((project) => ({ id: project.id, title: project.title, description: project.description, location: project.location, fieldDate: project.fieldDate.toISOString(), status: project.status, _count: project._count }));
  return <div className="inbox-page mx-auto w-full min-w-0 max-w-[1320px] overflow-x-hidden px-4 py-7 sm:px-5 md:px-10 md:py-10"><PageHeader eyebrow="INBOX · SAFE CAPTURE" title="자료수집함" description="사진·영상·음성·텍스트를 파일별로 저장 확인하며 관리합니다." /><InboxWorkspace projects={projects} /></div>;
}
