import Link from "next/link";
import { ChevronLeft, MapPin } from "lucide-react";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ExhibitionCompanySearch } from "@/components/exhibition-company-search";

export const dynamic = "force-dynamic";

export default async function ExhibitionIndexPage({
  params,
  searchParams,
}: {
  params: Promise<{ exhibitionId: string }>;
  searchParams: Promise<{ index?: string | string[] }>;
}) {
  const { exhibitionId } = await params;
  const selectedParam = (await searchParams).index;
  const selectedId = Array.isArray(selectedParam) ? selectedParam[0] : selectedParam;
  const exhibition = await prisma.exhibition.findUnique({
    where: { id: exhibitionId },
    include: {
      indexes: {
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        include: { _count: { select: { companies: true } } },
      },
      _count: { select: { companies: true } },
    },
  });
  if (!exhibition) notFound();
  const selectedIndex = exhibition.indexes.find((index) => index.id === selectedId) ?? exhibition.indexes[0] ?? null;
  const memberships = selectedIndex ? await prisma.companyIndex.findMany({
    where: { indexId: selectedIndex.id },
    orderBy: [{ priority: "desc" }, { sortOrder: "asc" }, { createdAt: "asc" }],
    include: {
      company: {
        select: {
          id: true,
          name: true,
          nameEn: true,
          flagshipProduct: true,
          companySummary: true,
          exhibitions: {
            where: { exhibitionId },
            take: 1,
            select: { booth: true, industry: true, category: true },
          },
        },
      },
    },
  }) : [];

  return <div className="mx-auto max-w-[1320px] px-5 py-7 md:px-10 md:py-10">
    <Link href="/exhibitions" className="mb-5 inline-flex min-h-11 items-center gap-2 rounded-xl px-2 text-sm font-bold text-secondary hover:bg-surface"><ChevronLeft size={17} />전시회 목록</Link>
    <header className="border-b border-ui pb-7">
      <div className="flex flex-wrap items-center gap-2 text-xs font-extrabold text-orange"><span>FILE INDEX</span><span>·</span><span>{exhibition.status}</span></div>
      <h1 className="mt-2 text-3xl font-extrabold tracking-tight md:text-5xl">{exhibition.nameEn || exhibition.name}</h1>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-secondary"><span>{exhibition.name}</span>{exhibition.venue && <span className="inline-flex items-center gap-1"><MapPin size={15} />{exhibition.venue}</span>}<span>참가기업 {exhibition._count.companies}</span></div>
    </header>

    {!exhibition.indexes.length ? <section className="paper-card mt-7 p-6"><h2 className="text-lg font-extrabold">Index 준비 중</h2><p className="mt-2 text-sm text-secondary">System Index seed를 실행하면 목적별 File Index가 표시됩니다.</p></section> : <div className="mt-7 lg:grid lg:grid-cols-[280px_minmax(0,1fr)] lg:gap-6">
      <nav aria-label="Curation Index" className="-mx-5 flex snap-x gap-2 overflow-x-auto px-5 pb-4 lg:mx-0 lg:block lg:overflow-visible lg:px-0 lg:pb-0">
        {exhibition.indexes.map((index) => {
          const active = index.id === selectedIndex?.id;
          return <Link key={index.id} href={`/exhibitions/${exhibitionId}?index=${index.id}`} aria-current={active ? "page" : undefined} className={`relative min-h-16 min-w-[210px] snap-start rounded-t-2xl border px-4 py-3 transition lg:mb-2 lg:flex lg:min-w-0 lg:items-center lg:gap-3 lg:rounded-l-2xl lg:rounded-r-lg ${active ? "z-10 border-ink bg-ink text-white" : "border-ui bg-surface hover:border-orange"}`}>
            <span aria-hidden className="text-xl">{index.icon || "📁"}</span>
            <span className="mt-1 block min-w-0 flex-1 text-sm font-extrabold lg:mt-0">{index.name}</span>
            <span className={`mt-2 inline-flex rounded-full px-2 py-1 text-xs font-extrabold lg:mt-0 ${active ? "bg-white/15" : "bg-page"}`}>{index._count.companies}</span>
          </Link>;
        })}
      </nav>

      <section className="min-w-0">
        <div className="paper-card p-5 md:p-6">
          <div className="flex items-start gap-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-2xl" style={{ backgroundColor: selectedIndex?.color || "#BDEFD8" }}>{selectedIndex?.icon || "📁"}</span>
            <div className="min-w-0"><p className="text-xs font-extrabold text-orange">{selectedIndex?.indexType} INDEX</p><h2 className="mt-1 text-2xl font-extrabold">{selectedIndex?.name}</h2><p className="mt-2 text-sm text-secondary">{selectedIndex?.description}</p></div>
          </div>
        </div>

        {selectedIndex && <ExhibitionCompanySearch
          key={selectedIndex.id}
          exhibitionId={exhibitionId}
          indexId={selectedIndex.id}
          memberships={memberships.map(({ id, reason, company }) => ({ id, reason, company }))}
        />}
      </section>
    </div>}
  </div>;
}
