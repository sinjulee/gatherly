import Link from "next/link";
import { ArrowRight, Building2 } from "lucide-react";
import { PageHeader } from "@/components/app-shell";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function ExhibitionsPage() {
  const exhibitions = await prisma.exhibition.findMany({
    orderBy: [{ startDate: "desc" }, { createdAt: "desc" }],
    include: { _count: { select: { companies: true, indexes: true, fieldDays: true } } },
  });
  return <div className="mx-auto max-w-[1320px] px-5 py-7 md:px-10 md:py-10">
    <PageHeader eyebrow="EXHIBITION CURATION" title="현장 큐레이션" description="전시회별 File Index를 열고 목적에 맞는 기업부터 빠르게 확인합니다." />
    <section className="mt-7 grid gap-4 md:grid-cols-2">
      {exhibitions.map((exhibition) => <Link key={exhibition.id} href={`/exhibitions/${exhibition.id}`} className="paper-card group flex min-h-44 flex-col justify-between p-5 transition hover:-translate-y-0.5 hover:border-orange md:p-6">
        <div className="flex items-start justify-between gap-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-mint"><Building2 size={22} /></span>
          <span className="rounded-full bg-page px-3 py-2 text-xs font-extrabold text-secondary">{exhibition.status}</span>
        </div>
        <div className="mt-5">
          <p className="text-xl font-extrabold">{exhibition.name}</p>
          <p className="mt-1 text-sm text-secondary">{exhibition.nameEn || exhibition.venue || "전시회"}</p>
          <div className="mt-4 flex flex-wrap items-center gap-2 text-xs font-semibold text-secondary"><span>기업 {exhibition._count.companies}</span><span>·</span><span>Index {exhibition._count.indexes}</span><span>·</span><span>현장 {exhibition._count.fieldDays}</span><ArrowRight size={16} className="ml-auto text-orange transition group-hover:translate-x-1" /></div>
        </div>
      </Link>)}
      {!exhibitions.length && <div className="paper-card p-6 text-sm text-secondary">등록된 전시회가 없습니다.</div>}
    </section>
  </div>;
}
