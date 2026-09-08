# Gatherly Product Requirements Document

## 1. 문서 정보

- 제품명: Gatherly
- 문서 버전: 1.0
- 개발 단계: 1차 개발 완료
- 기준일: 2026-09-09
- 기본 언어: 한국어
- 운영 환경: Mac mini 로컬 서버, Tailscale 내부 접근
- 데이터베이스: Prisma + SQLite
- 운영 포트: 3001

## 2. 제품 개요

Gatherly는 현장 조사 중 수집한 사진, 영상, 음성, 텍스트 자료를 안전하게 모으고, 현장별로 정리해 보고서 작성으로 연결하는 로컬 워크스페이스다.

현장 사용자는 모바일 브라우저에서 자료를 빠르게 남기고, Mac mini에 설치된 Gatherly 서버는 SQLite 메타데이터와 로컬 저장소에 자료를 보관한다. 외부 SaaS 데이터베이스는 사용하지 않는다.

## 3. 문제 정의

- 현장 자료가 여러 기기와 앱에 흩어져 조사 맥락이 끊긴다.
- 업로드 중 네트워크가 끊기면 자료 저장 여부를 확인하기 어렵다.
- 파일 원본과 SQLite 메타데이터를 한 운영 단위로 백업해야 한다.
- 별도 관리자 웹페이지 없이도 Mac mini와 Gatherly 상태를 확인할 필요가 있다.
- 운영 중 앱이 중단됐을 때 앱 프로세스만 안전하게 복구할 수 있어야 한다.

## 4. 목표

### 4.1 1차 목표

1. 현장(Field Day)을 만들고 진행 상태를 관리한다.
2. 사진·영상·음성·텍스트 자료를 현장별로 수집한다.
3. 업로드 파일을 로컬 `storage/uploads`에 안전하게 저장한다.
4. SQLite에 자료 메타데이터를 저장하고 삭제되지 않은 자료를 조회한다.
5. 자료수집함에서 저장 상태와 자료 상세를 확인한다.
6. 아이폰 Telegram에서 Gatherly 앱과 Mac mini 상태를 읽기 전용으로 확인한다.
7. 앱 중단 시 허용된 운영자만 고정 launchd 서비스 복구를 요청할 수 있도록 준비한다.
8. Git 커밋이나 외부 배포 없이 Mac mini에서 직접 운영할 수 있는 문서를 제공한다.

### 4.2 성공 기준

- 현장 하나를 생성하고 상태를 변경할 수 있다.
- 사진·영상·음성·텍스트 자료를 업로드하거나 저장할 수 있다.
- 업로드 완료 자료가 SQLite와 로컬 파일로 함께 확인된다.
- Telegram `/status`가 앱, SQLite, 저장소, 시스템 상태를 한국어로 표시한다.
- 상태 봇이 앱 중단과 상태 봇 자체 중단을 구분해 안내한다.
- 상태 점검 실패가 봇 프로세스 전체 종료로 이어지지 않는다.
- `npm run lint`, `npm run typecheck`, `npm run build`가 통과한다.

## 5. 사용자 및 사용 시나리오

### 5.1 현장 조사자

- 오늘의 현장에서 진행 중인 현장을 확인한다.
- 현장명, 위치, 날짜, 설명을 입력한다.
- 사진·영상·음성·텍스트를 자료수집함에 추가한다.
- 저장 완료·대기·실패 상태를 확인한다.

### 5.2 운영자

- Mac mini에서 Gatherly 서버를 실행한다.
- Telegram 전용 상태 봇에서 `/start`, `/status`, `/help`를 사용한다.
- 앱 health, DB, 저장소, 디스크, 메모리, uptime을 확인한다.
- launchd 등록이 완료된 경우에만 앱 복구 버튼을 사용한다.

## 6. 기능 요구사항

### 6.1 오늘의 현장

- 진행 중인 현장과 최근 현장을 표시한다.
- 현장별 저장 자료 수를 표시한다.
- 저장 자료, 저장 대기·실패 자료, 보고서 수를 요약한다.
- 제목 아래에 별도 자료수집 검정 버튼을 표시하지 않는다.
- 터치 영역은 모바일 현장 사용에 적합한 크기를 유지한다.

### 6.2 현장 관리

- 현장 생성
- 현장 제목, 위치, 날짜, 설명 입력
- 상태: `ACTIVE`, `COMPLETED`, `ARCHIVED`
- 삭제 시 즉시 물리 삭제하지 않고 `deletedAt`을 이용한 soft delete
- 삭제된 현장과 자료는 기본 목록에서 제외

### 6.3 자료수집함

- 자료 유형: 이미지, 영상, 음성, 텍스트
- 현장 선택 및 자료 제목·설명 입력
- 업로드 진행 상태 표시
- 업로드 실패 시 재시도 가능한 상태 제공
- 저장 완료 자료의 파일명, 유형, 현장, 저장 상태 표시
- 업로드 파일은 사용자 원본명을 그대로 경로로 사용하지 않는다.
- 저장 위치는 기본적으로 `storage/uploads/{fieldDayId}/{materialId}/`다.

### 6.4 파일 저장 안정성

- 임시 파일에 먼저 저장한 뒤 완료 시 원본 파일명으로 이동한다.
- 허용된 MIME type과 확장자를 검증한다.
- 파일 크기 제한은 환경변수로 조정한다.
- SHA-256 해시를 저장한다.
- 실패한 임시 파일은 정리한다.
- 사용자 업로드 파일을 상태 점검 때문에 수정하거나 삭제하지 않는다.

### 6.5 Telegram 상태 봇

#### 명령

- `/start`: 사용 안내와 상태 대시보드
- `/status`: 최신 상태 대시보드
- `/help`: 명령, 상태 의미, 전원 한계 안내

#### 상태 항목

- Gatherly 앱 health
- SQLite 연결 및 삭제되지 않은 FieldDay·Material 수
- 자료 저장소 존재·읽기·쓰기 가능 여부, 용량, 파일 수
- 디스크 여유율
- 메모리 사용량
- Mac 가동시간
- load average
- Node.js 버전
- 상태 봇 가동시간
- 설정된 경우 최근 오류 최대 5건

#### 상태 단계

- 🟢 정상
- 🟡 주의
- 🔴 오류
- ⚪ 확인 불가

#### 인라인 UI

- 새로고침
- 앱 상태
- DB 상태
- 저장소 상태
- 시스템 정보
- 최근 오류
- launchd 등록 이후에만 Gatherly 앱 복구
- `GATHERLY_ACCESS_URL`이 유효하게 설정된 경우에만 Gatherly 열기 URL 버튼

#### 동작 원칙

- Telegram webhook과 외부 공개 포트를 사용하지 않는다.
- `getUpdates` long polling을 사용한다.
- 새로고침은 새 메시지를 만들지 않고 기존 메시지를 수정한다.
- callback마다 `answerCallbackQuery`를 호출한다.
- 점검 중에는 “확인 중…”을 표시한다.
- 개별 점검 timeout을 적용한다.
- Telegram API 일시 오류에는 지수 백오프를 적용한다.
- update offset을 저장해 동일 업데이트를 반복 처리하지 않는다.
- 상태 봇 오류가 프로세스 전체 종료로 이어지지 않는다.

### 6.6 앱 복구

- Mac mini OS 재부팅 기능은 제공하지 않는다.
- `com.gatherly.app` 외의 launchd 서비스를 제어하지 않는다.
- 허용된 Telegram 숫자 user ID를 다시 확인한다.
- 현재 health가 정상인 경우 아무 작업도 하지 않는다.
- 앱이 비정상인 경우 확인 화면을 먼저 표시한다.
- 사용자가 “복구 실행”을 다시 눌러야 한다.
- 고정 명령만 사용한다.

```text
launchctl kickstart -k gui/{현재_UID}/com.gatherly.app
```

- shell 문자열 실행이나 사용자 입력 전달을 사용하지 않는다.
- `sudo`, 재부팅, 종료, 잠자기 명령은 사용하지 않는다.
- 복구 요청 사이에 60초 cooldown을 둔다.
- 복구 시도 시간, Telegram user ID, 결과를 감사 로그에 남긴다.
- `com.gatherly.app`이 launchd에 등록되지 않은 경우 복구 버튼을 활성화하지 않고 설정 필요 안내를 표시한다.

## 7. 비기능 요구사항

### 7.1 보안

- Telegram bot token은 코드, Git, README, plist에 넣지 않는다.
- 토큰과 허용 user ID는 권한 제한된 별도 환경 파일에 둔다.
- username이 아닌 숫자 Telegram user ID로 인증한다.
- 허용되지 않은 메시지와 callback은 처리하지 않는다.
- 내부 오류 stack, 절대 경로, DB 경로, 사용자 파일명, 토큰, 쿠키, Authorization 헤더를 Telegram에 표시하지 않는다.
- child process에는 고정 실행 파일과 고정 인수만 전달한다.
- `shell: true`를 사용하지 않는다.

### 7.2 데이터 안전

- Prisma + SQLite만 사용한다.
- DB 마이그레이션과 쓰기 작업은 상태 점검에서 수행하지 않는다.
- 업로드 파일을 상태 점검에서 열거나 수정·삭제하지 않는다.
- 저장소 쓰기 점검은 임시 파일 생성 후 `finally`에서 즉시 정리한다.
- 기존 사용자 데이터와 업로드 파일을 보존한다.

### 7.3 운영

- Gatherly 운영 포트는 3001이다.
- 상태 봇은 Gatherly 앱과 별도 프로세스다.
- 앱과 상태 봇의 launchd label은 각각 `com.gatherly.app`, `com.gatherly.statusbot`이다.
- launchd 등록은 설치 문서의 명시적 절차로만 수행한다.
- 상태 봇 로그와 감사 로그는 프로젝트 `logs/`에 두며 Git에서 제외한다.
- Node 절대 경로는 `/opt/homebrew/bin/node`를 기준으로 한다.

## 8. 환경변수

### 앱·공통

- `DATABASE_URL`: Prisma SQLite URL
- `STORAGE_ROOT`: 로컬 저장소 루트
- `UPLOAD_MAX_IMAGE_BYTES`
- `UPLOAD_MAX_VIDEO_BYTES`
- `UPLOAD_MAX_AUDIO_BYTES`

### 상태 봇

- `GATHERLY_TELEGRAM_BOT_TOKEN`
- `GATHERLY_TELEGRAM_ALLOWED_USER_ID`
- `GATHERLY_APP_HEALTH_URL=http://127.0.0.1:3001/api/health`
- `GATHERLY_ACCESS_URL`
- `GATHERLY_STORAGE_PATH`
- `GATHERLY_LOG_PATH`
- `GATHERLY_DISK_WARN_PERCENT`, 기본 80
- `GATHERLY_DISK_CRITICAL_PERCENT`, 기본 90
- `GATHERLY_HEALTH_TIMEOUT_MS`, 기본 5000
- `GATHERLY_HEALTH_SLOW_MS`, 기본 2000

실제 토큰과 Telegram user ID는 저장소에 기록하지 않는다.

## 9. 기술 구조

```text
iPhone Safari ──Tailscale──> Gatherly Next.js :3001
                                  │
                                  ├─ Prisma Client
                                  ├─ SQLite (prisma/dev.db)
                                  └─ storage/uploads

iPhone Telegram ──Telegram API getUpdates──> Gatherly Status Bot
                                               │
                                               ├─ localhost:3001/api/health
                                               ├─ SQLite read-only checks
                                               ├─ storage/system checks
                                               └─ optional launchctl kickstart
```

주요 코드 영역:

- `app/`: Next.js App Router 화면과 API
- `app/api/health/route.ts`: 민감정보 없는 앱 health endpoint
- `lib/prisma.ts`: Prisma client
- `lib/storage.ts`: 파일 검증·저장·조회
- `scripts/gatherly-status-bot/`: Telegram 상태 봇
- `macmini/`: 실행 스크립트, launchd 템플릿, 운영 문서

## 10. 운영 및 검증 명령

```sh
cd /Users/sinjulee/Projects/Gatherly
npm run db:generate
npm run build
npm start -- -p 3001
```

상태 봇 dry-run:

```sh
npm run bot:status:check
```

품질 검사:

```sh
npm run lint
npm run typecheck
npm run build
```

health 확인:

```sh
curl -i http://127.0.0.1:3001/api/health
```

## 11. 1차 범위 제외

- 외부 공개 배포
- Cloudflare, Supabase, Tailscale 설정 변경
- Telegram webhook
- 관리자 웹페이지
- 다중 운영자 권한 관리
- 앱·Mac mini 재부팅 및 종료
- 임의 shell 명령 실행
- Telegram을 통한 파일 삭제·수정
- 보고서 자동 생성 및 AI 분석
- 사용자 계정·조직·공유 기능
- launchd 실제 등록 자동화

## 12. 알려진 한계

- Mac mini 전원이 꺼지면 상태 봇도 응답할 수 없다.
- 상태 봇까지 응답하지 않으면 전원, 네트워크, 봇 프로세스 문제를 별도로 확인해야 한다.
- launchd 서비스가 등록되지 않은 상태에서는 앱 자동 복구가 동작하지 않는다.
- 현재 SQLite와 업로드 파일은 Mac mini 로컬 디스크에 의존한다.
- Telegram 상태 봇은 허용된 단일 user ID만 지원한다.
- Tailscale 내부 접근은 운영 환경 설정에 따라 달라질 수 있다.

## 13. 2차 개발 후보

- `com.gatherly.app` 및 `com.gatherly.statusbot` launchd 설치 자동화 보조
- 백업 상태와 마지막 백업 시간 표시
- 디스크·메모리 이력과 장애 알림
- 다중 운영자와 역할별 권한
- 안전한 상태 봇 감사 로그 조회
- 보고서 작성·내보내기
- 자료 중복 감지와 검색
- SQLite 백업 무결성 검증

## 14. 완료 기준 체크리스트

- [x] 현장 생성·조회·상태 관리
- [x] 자료수집함과 파일 업로드
- [x] SQLite + 로컬 storage 저장
- [x] 민감정보 없는 `/api/health`
- [x] Telegram long polling 상태 봇
- [x] 숫자 user ID 인증
- [x] 앱·DB·저장소·시스템 상태 점검
- [x] dry-run 및 상태 메시지 미리보기
- [x] 고정 launchd 앱 복구 흐름
- [x] 앱·상태 봇 launchd 템플릿
- [x] Mac mini 운영 문서
- [x] lint, typecheck, build 통과
- [ ] 실제 launchd 등록
- [ ] 외부 공개 배포
