# Gatherly 개발 메모

- UI는 한국어를 기본으로 하며, 현장 사용을 위해 터치 영역을 넉넉하게 유지한다.
- 본문은 아이보리 배경과 딥그린을 중심으로 단정하게 유지하고, 미니 캘린더에만 키치한 장식을 사용한다.
- 데이터베이스는 Prisma + SQLite만 사용한다. 외부 SaaS 데이터베이스와 Supabase는 사용하지 않는다.
- Paperlogy 폰트 파일은 `public/fonts/`에 추가하고 `app/globals.css`의 `@font-face` 경로를 유지한다.
- 로컬 서버는 맥미니의 Tailscale 인터페이스에서만 접근하도록 운영할 예정이다. 배포 전까지 외부 공개하지 않는다.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
