# Gatherly 로컬 실행 안내

Gatherly는 맥미니에서 단일 사용자로 실행하는 현장조사 워크스페이스입니다. 데이터는 외부 SaaS가 아니라 로컬 SQLite 파일에 저장합니다.

## 처음 실행

```bash
cd ~/Projects/Gatherly
cp .env.example .env
npm install
npm run db:generate
npm run db:push
npm run dev
```

브라우저에서 `http://localhost:3000`을 열어 확인합니다. 운영용으로는 `npm run build && npm start`를 사용합니다.

## Tailscale 연결 구조 (향후 운영)

1. 맥미니에서 Next.js 서버를 실행하고, 방화벽은 로컬/Tailscale 인터페이스에 필요한 포트만 허용합니다.
2. 아이폰과 맥미니를 같은 Tailscale 네트워크(tailnet)에 연결합니다.
3. 아이폰 Safari에서 맥미니의 Tailscale IP 또는 MagicDNS 호스트명과 포트(예: `http://macmini:3000`)로 접속합니다.
4. Safari의 공유 메뉴에서 홈 화면에 추가하면 PWA처럼 사용할 수 있습니다.

현재 단계에서는 Tailscale 설치·로그인·라우팅 설정을 자동으로 변경하지 않습니다. HTTPS가 필요한 운영 환경에서는 tailnet 내부 HTTPS 구성과 인증 정책을 별도로 검토해야 합니다.

## 폰트

Paperlogy 파일은 `public/fonts/`에 `Paperlogy-4Regular.woff2`, `Paperlogy-7Bold.woff2` 이름으로 넣습니다. 파일이 없으면 시스템 한글 폰트로 자동 fallback합니다.
