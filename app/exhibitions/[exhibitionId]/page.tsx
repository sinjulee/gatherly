import Link from "next/link";
import { ChevronLeft, MapPin } from "lucide-react";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";

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

        <div className="mt-4 grid gap-3 xl:grid-cols-2">
          {memberships.map((membership) => {
            const participation = membership.company.exhibitions[0];
            return <Link href={`/exhibitions/${exhibitionId}/indexes/${selectedIndex.id}/companies/${membership.company.id}`} key={membership.id} className="paper-card flex min-h-52 flex-col p-5 transition hover:border-orange focus-visible:border-orange">
              <div className="flex items-start justify-between gap-3"><div className="min-w-0"><h3 className="text-lg font-extrabold">{membership.company.name}</h3>{membership.company.nameEn && <p className="mt-1 truncate text-xs text-secondary">{membership.company.nameEn}</p>}</div><span className="shrink-0 rounded-full bg-orange px-3 py-1.5 text-xs font-extrabold text-ink">{participation?.booth || "부스 미정"}</span></div>
              <div className="mt-4 flex flex-wrap gap-2 text-xs font-bold"><span className="rounded-full bg-mint px-2.5 py-1.5">{participation?.industry || "산업 미분류"}</span>{participation?.category && <span className="rounded-full bg-page px-2.5 py-1.5 text-secondary">{participation.category}</span>}</div>
              <p className="mt-4 line-clamp-2 text-sm font-semibold">{membership.company.flagshipProduct || membership.company.companySummary || "대표 제품 정보가 없습니다."}</p>
              <div className="mt-auto border-t border-ui pt-4"><p className="line-clamp-2 text-xs leading-5 text-secondary">{membership.reason || "직접 추가한 기업"}</p><span className="mt-2 inline-block text-[11px] font-bold text-orange">기업 카드 보기 →</span></div>
            </Link>;
          })}
          {!memberships.length && <div className="paper-card p-6 xl:col-span-2"><p className="font-extrabold">아직 담긴 기업이 없습니다.</p><p className="mt-2 text-sm text-secondary">Personal Index는 membership API로 기업을 추가할 수 있습니다.</p></div>}
        </div>
      </section>
    </div>}
  </div>;
}
