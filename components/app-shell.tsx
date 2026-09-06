"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, CalendarDays, FileText, Home, Inbox, MapPin, Plus, Settings2 } from "lucide-react";

const navItems = [
  { href: "/", label: "오늘의 현장", icon: Home },
  { href: "/inbox", label: "자료수집함", icon: Inbox },
  { href: "/analysis", label: "정리·분석함", icon: BarChart3 },
  { href: "/reports", label: "최종 보고서", icon: FileText },
] as const;

function MiniCalendar({ mobile = false }: { mobile?: boolean }) {
  const days = ["일", "월", "화", "수", "목", "금", "토"];
  const dates = [30, 31, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 1, 2, 3];
  const materialDates = new Set([2, 5, 12, 18]);
  const calendar = <div className={`calendar-card relative p-4 ${mobile ? "w-full" : "w-[224px]"}`}>
    <div className="relative flex items-start justify-between"><div><p className="text-xs font-semibold uppercase tracking-[0.14em] text-mint">September</p><p className="mt-1 text-2xl font-extrabold">2026</p></div><CalendarDays size={22} className="text-orange" /></div>
    <div className="relative mt-4 grid grid-cols-7 gap-y-2 text-center text-[11px] font-semibold"><span className="text-orange">일</span>{days.slice(1).map((day) => <span key={day} className="text-white/65">{day}</span>)}{dates.map((date, i) => {
      const isCurrentMonth = i >= 2 && i <= 31;
      const isToday = date === 6 && i === 7;
      const isSelected = date === 5 && i === 6;
      const hasMaterial = isCurrentMonth && materialDates.has(date);
      return <span key={`${date}-${i}`} className={`relative mx-auto flex h-7 w-7 items-center justify-center rounded-full ${!isCurrentMonth ? "text-white/35" : ""} ${isSelected ? "bg-orange text-ink" : ""} ${isToday ? "ring-2 ring-orange ring-offset-1 ring-offset-black" : ""}`}><span>{date}</span>{hasMaterial && <i aria-label="자료 있음" className="absolute bottom-0.5 h-1 w-1 rounded-full bg-mint" />}</span>;
    })}</div>
    <div className="relative mt-4 flex items-center gap-2 border-t border-white/20 pt-3 text-xs font-semibold"><MapPin size={14} className="text-orange" /> 성수동 골목 조사</div>
    <div className="relative mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-white/70"><span><b className="mr-1 inline-block h-2 w-2 rounded-full bg-orange" />오늘·선택</span><span><b className="mr-1 inline-block h-2 w-2 rounded-full bg-mint" />자료 있음</span></div>
  </div>;
  if (mobile) return <details className="mb-5 lg:hidden"><summary className="flex min-h-12 cursor-pointer list-none items-center justify-between rounded-xl bg-ink px-4 py-3 text-sm font-semibold text-white"><span>9월 현장 캘린더 · 자료 4일</span><CalendarDays size={19} className="text-orange" /></summary><div className="mt-3">{calendar}</div></details>;
  return calendar;
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return <div className="min-h-screen bg-page lg:flex">
    <aside className="hidden w-[274px] shrink-0 flex-col bg-ink px-6 py-7 text-white lg:flex">
      <Link href="/" className="mb-10 flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange text-lg font-extrabold text-ink">G</span><span className="text-xl font-extrabold tracking-tight">gatherly<span className="text-orange">.</span></span></Link>
      <nav className="space-y-2" aria-label="주 메뉴">{navItems.map(({ href, label, icon: Icon }) => { const active = pathname === href; return <Link key={href} href={href} aria-current={active ? "page" : undefined} className={`relative z-0 flex min-h-12 items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold transition focus-visible:z-10 ${active ? "bg-orange text-ink opacity-100" : "bg-transparent text-white hover:border hover:border-orange hover:bg-white/5"}`}><Icon size={18} strokeWidth={active ? 2.5 : 2} className="relative z-10 shrink-0" /><span className="relative z-10 min-w-0 break-keep">{label}</span></Link>; })}</nav>
      <div className="mt-auto"><MiniCalendar /><div className="mt-5 flex items-center justify-between border-t border-white/20 pt-5 text-white/70"><button aria-label="설정" className="rounded-lg p-2 hover:bg-white/10"><Settings2 size={17} /></button><span className="text-xs">혼자 쓰는 작업실</span></div></div>
    </aside>
    <main className="mobile-bottom-space min-w-0 flex-1"><div className="mx-auto max-w-[1320px] px-5 pt-5 md:px-10 lg:hidden"><MiniCalendar mobile /></div>{children}</main>
    <nav className="fixed inset-x-0 bottom-0 z-20 flex border-t border-ui bg-surface px-3 py-2 lg:hidden" aria-label="모바일 주 메뉴">{navItems.map(({ href, label, icon: Icon }) => { const active = pathname === href; return <Link key={href} href={href} aria-current={active ? "page" : undefined} className={`flex min-h-12 flex-1 flex-col items-center justify-center gap-1 rounded-xl py-2 text-[11px] font-semibold ${active ? "bg-orange text-ink" : "text-secondary hover:bg-page"}`}><Icon size={20} strokeWidth={active ? 2.5 : 2} /><span>{label}</span></Link>; })}</nav>
  </div>;
}

export function PageHeader({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: React.ReactNode }) {
  return <header className="flex flex-col gap-5 border-b border-ui pb-7 xl:flex-row xl:items-end xl:justify-between"><div><p className="mb-2 text-sm font-extrabold text-orange">{eyebrow}</p><h1 className="text-3xl font-extrabold tracking-tight md:text-5xl">{title}</h1><p className="mt-2 max-w-xl text-sm text-secondary">{description}</p></div>{action}</header>;
}

export function AddButton({ children = "새 자료" }: { children?: React.ReactNode }) { return <button className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-ink px-4 py-3 text-sm font-semibold text-white transition hover:bg-orange hover:text-ink"><Plus size={17} />{children}</button>; }
