import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { AppShell } from "@/components/app-shell";

const paperlogy = localFont({
  src: [
    { path: "../public/fonts/Paperlogy-4Regular.ttf", weight: "400", style: "normal" },
    { path: "../public/fonts/Paperlogy-5Medium.ttf", weight: "500", style: "normal" },
    { path: "../public/fonts/Paperlogy-6SemiBold.ttf", weight: "600", style: "normal" },
    { path: "../public/fonts/Paperlogy-7Bold.ttf", weight: "700", style: "normal" },
    { path: "../public/fonts/Paperlogy-8ExtraBold.ttf", weight: "800", style: "normal" },
  ],
  display: "swap",
  variable: "--font-paperlogy",
  preload: true,
});

export const metadata: Metadata = {
  title: "Gatherly — 현장조사 워크스페이스",
  description: "현장에서 모으고, 정리하고, 보고하는 개인 워크스페이스",
  applicationName: "Gatherly",
  appleWebApp: { capable: true, title: "Gatherly", statusBarStyle: "black-translucent" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const serviceWorkerScript = process.env.NODE_ENV === "production"
    ? "if('serviceWorker'in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('/sw.js',{updateViaCache:'none'}).then(r=>r.update()).catch(()=>{}))"
    : "if('serviceWorker'in navigator)window.addEventListener('load',async()=>{try{const had=!!navigator.serviceWorker.controller;const rs=await navigator.serviceWorker.getRegistrations();await Promise.all(rs.map(r=>r.unregister()));if('caches'in window){const ks=await caches.keys();await Promise.all(ks.filter(k=>k.startsWith('gatherly-')).map(k=>caches.delete(k)))}const key='gatherly-sw-reset';if(had&&!sessionStorage.getItem(key)){sessionStorage.setItem(key,'1');location.reload()}else if(!had){sessionStorage.removeItem(key)}}catch{}})";
  return <html lang="ko"><body className={paperlogy.variable}><AppShell>{children}</AppShell><script id="service-worker-lifecycle" dangerouslySetInnerHTML={{ __html: serviceWorkerScript }} /></body></html>;
}
