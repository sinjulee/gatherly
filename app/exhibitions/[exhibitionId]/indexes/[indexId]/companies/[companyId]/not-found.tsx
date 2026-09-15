import Link from "next/link";

export default function CompanyCardNotFound() {
  return <section className="mx-auto max-w-xl px-5 py-16"><div className="paper-card p-7"><p className="text-sm font-bold text-orange">COMPANY CARD</p><h1 className="mt-2 text-2xl font-extrabold">이 Index에서 기업을 찾지 못했습니다.</h1><p className="mt-3 text-sm leading-6 text-secondary">전시회·Index·기업 연결이 일치하지 않거나 membership이 변경되었을 수 있습니다.</p><Link href="/exhibitions" className="mt-5 inline-flex min-h-12 items-center rounded-xl bg-ink px-5 text-sm font-bold text-white">전시회 목록으로</Link></div></section>;
}
