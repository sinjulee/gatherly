import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Gatherly 현장조사 워크스페이스",
    short_name: "Gatherly",
    description: "현장에서 모으고, 정리하고, 보고하는 개인 워크스페이스",
    start_url: "/",
    display: "standalone",
    background_color: "#f7f4ec",
    theme_color: "#111111",
    orientation: "portrait-primary",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }],
  };
}
