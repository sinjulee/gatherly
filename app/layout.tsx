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
  return <html lang="ko"><body className={paperlogy.variable}><AppShell>{children}</AppShell>{process.env.NODE_ENV === "production" && <script id="production-service-worker" dangerouslySetInnerHTML={{ __html: "if ('serviceWorker' in navigator) window.addEventListener('load',()=>navigator.serviceWorker.register('/sw.js'))" }} />}</body></html>;
}
