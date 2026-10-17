# Gatherly 2.0 — 시스템 요구사항 명세서 (SRS v0.5)

- **개정일:** 2026-10-16
- **기준 PRD:** `Gatherly_2.0_PRD_v0.4.md`
- **상태:** 설계 규격 / 구현 전 기존 저장소 감사 필요
- **대상:** 범용 현장조사 PWA + 공식 참가기업 카탈로그 + 개인 Google 데이터 + 체험권 기반 프리미엄 AI 보고서
- **실증 일정:** 2026-10-23 코엑스 현장 (기술 검증 결과에 따라 P0 범위 조정 가능)

## 1. 목적·범위·우선 원칙

본 명세서는 기존 Gatherly Next.js App Router/TypeScript/Prisma/SQLite 기반 구현을 **무단 삭제 없이 단계 확장**한다. 제품 범위는 탄소중립 사업에 제한되지 않는다. 2026 ESG 친환경대전은 첫 실증용 데이터셋/화면이다.

**충돌 시 적용 규칙:** v0.4 문서와 충돌하면 본 v0.5의 `공식 Supabase + 개인 Google Sheets/Drive + 지도/Importer` 규칙을 우선 적용. 단, 기존 자료수집함·FieldDay CRUD·AI 보고서의 기능 범위는 삭제하지 않는다.

**완료 정의:** 본 문서의 요구사항은 구현했다고 주장하는 내용이 아니다. 실서비스 Google OAuth, 수집 허용, 실제 기업정보·부스 좌표·API 연결과 사용자 디바이스 검증은 별도로 완료해야 한다.

## 2. 개념 아키텍처

```text
            ┌───────────────────────────────────────┐
            │ iPhone Safari/PWA / Android / Desktop │
            │ ├─ 2D 스크롤 부스배치도 + 투명 핫스팟   │
            │ ├─ 기업 카드: 스피커/카메라/마이크/A     │
            │ ├─ 기업 검색/개인 자료수집함/보고서      │
            │ └─ IndexedDB local asset + sync ledger│
            └─────────────────┬─────────────────────┘
                              │ HTTPS
                              ▼
               Next.js BFF / Auth-aware API
              ├─ Supabase Auth + Google OIDC
              ├─ Supabase PostgreSQL (공식 공개 데이터)
              │   ├─ 행사/기업/출전사/출처
              │   ├─ 부스 이미지/핫스팟/매핑
              │   └─ 관리자 승인 AI 가이드
              ├─ Directory Importer (관리자 배치)
              │   └─ source → staging → validation → approval
              ├─ Google OAuth 별도 동의(최소 범위)
              ├─ Google Drive API → 사용자 소유 원본·보고서
              ├─ Google Sheets API → 사용자 개인 구조화 기록
              └─ Gemini API → 사전 도슨트 TTS/선택적 STT/보고서
```

- Mac mini는 개발 장비이되 공개 서비스의 런타임 필수 서버가 아님.
- Prisma ORM은 기존 코드 감사 후 필요한 공개 DB 부분에서 재사용 가능. 운영 PostgreSQL로 마이그레이션하되 원본 SQLite는 검증 완료 전 유지.
- Supabase DB에는 개인 메모·전사·사진 내용·개인 보고서 본문을 저장하지 않는다. 사용자와 연결된 Google 시트/폴더 ID 등 최소 운영 메타데이터는 민감정보로 취급.

## 3. 데이터 소유권과 권한 경계

| 종류 | 저장소 | 공개 범위 |
|---|---|---|
| 행사/공식 참가기업/부스번호/카테고리 | Supabase PostgreSQL | 운영자 검증 후 공개 |
| 공식 배치도 원본 URL·사용 허가·핫스팟/좌표 | Supabase 메타데이터 + 권한 확인된 이미지 정적 자산/스토리지 | 승인된 행사 정보만 공개 |
| 원천 수집 staging·오류·승인 이력 | Supabase 관리자 전용 | 관리자만 |
| AI 공식 기업요약·도슨트 대본·TTS 캐시 | Supabase 메타데이터 + 안전한 오디오 저장소 | 승인된 내용만 공개 |
| 개인 방문기록·사진 참조·전사·메모·개인 인사이트 | 사용자 본인 Google Sheets | 해당 사용자만 |
| 사진/녹음/영상 원본·분석 스냅샷 | 사용자 본인 Google Drive | 해당 사용자만 |
| 보고서 본문/Google Docs 결과 | 사용자 본인 Google Drive/Docs | 해당 사용자만 |
| 로컬 임시 기록/업로드 큐 | 해당 기기 IndexedDB | 해당 사용자·기기 |
| 사용자 계정/연결 식별자/피드백/사용량 | Supabase Auth/운영 스키마 | 소유자 또는 관리자 정책에 따름 |

**권한:** 로그인(Supabase Auth)과 Drive/Sheets 작업 승인은 별개. 앱 접근 토큰은 브라우저에 노출하지 않고, OAuth 리프레시 토큰은 암호화된 서버 전용 보관 위치 사용. Google `drive.file`과 Docs/Sheets 사용 방식은 최소 스코프/Google 검증 조건에 맞춰 확정. 사용자가 만든 개인 기록이 공용 AI 학습/분석 콘텐츠로 자동 승격되지 않음.

## 4. 기능 요구사항: 인증·행사·카탈로그

| ID | 세부 명세 | 검증 |
|---|---|---|
| AUTH-01 | Google 로그인·로그아웃, Supabase Auth 쿠키 기반 사용자 확인. | 유효/만료/미로그인 처리 |
| AUTH-02 | 개인 Sheets/Drive가 필요한 시점에 별도 동의, 연동 상태·재동의·해제 UI. | 최초 접속·거부·철회 |
| AUTH-03 | 서버 모든 읽기/변경 API에서 사용자 소유권/운영자 역할/행사 공개 상태 검사. | IDOR 차단 |
| AUTH-04 | Supabase `service_role` 키, Gemini 키, 리프레시 토큰을 클라이언트에 노출하지 않음. | 번들/로그/환경변수 점검 |
| CAT-01 | `exhibitions`/`companies`/`exhibitors` 분리, 행사별 복수 부스/공동 참가 모델링. | 같은 기업 다중 행사 |
| CAT-02 | 공개 기업 검색: 기업명 국영문, 브랜드, 부스번호, 카테고리, 출품 항목. | 오타/한글/영문/부스 |
| CAT-03 | 공식 데이터에 `source_url`, `retrieved_at`, `review_status`, `reviewed_by`, `published_at` 보존. | 출처/변경 이력 |
| CAT-04 | 미승인 기업/AI 콘텐츠/이미지는 공개 API 결과에 노출하지 않음. | 익명·로그인 사용자 검사 |
| CAT-05 | 기존 사용자 정의 FieldDay/현장 CRUD와 신규 공개 전시회·참가기업 카탈로그를 혼동하지 않도록 모델/화면 분리. | 기존 3개 FieldDay 회귀 |
| CAT-06 | 카탈로그에 없는 부스/업체는 사용자가 임시 기록 가능, 개인 기록은 공식 데이터로 자동 공개하지 않음. | 매핑 없는 부스·비등록 회사 |

## 5. 기능 요구사항: 인터랙티브 부스배치도 (신규)

### 5.1 맵 에셋 규격
- **MAP-01:** 운영자는 행사당 1개 이상 배치도 `booth_map_asset`을 등록한다. 원본 파일은 사용 권한 확인 후 등록한다.
- **MAP-02:** 표시 이미지에서 원래 페이지의 `부스배치도` 제목과 외부 흰 여백을 제거하고 **지도 본체만 표시**한다. 전시회 회사명/부스번호/도형은 임의로 지우거나 AI 이미지로 재구성하지 않는다.
- **MAP-03:** 원본 가로/세로 픽셀 크기 `natural_width`, `natural_height`, 이미지 버전/해시, 소스 URL, 허가 상태 및 `crop_rect`를 기록한다.
- **MAP-04:** 샘플은 `v0.5_assets/ESG_2026_Official_BoothMap_TitleRemoved_Reference.png` (754×446 px)이며 **해상도 향상된 승인 원본으로 교체 가능**. 새 이미지 비율·크롭이 달라지면 좌표 전체 검증을 다시 수행한다.
- **MAP-05:** 과거 생성한 UI 이미지(가상 회사명/부스 표시)는 디자인 **참고**이며 실제 지도 데이터 또는 업체 좌표의 근거로 사용 금지.

### 5.2 반응형 탐색과 선택
- **MAP-06:** 모바일 지도는 **양방향 스크롤 가능한 viewport** 내에 원본 비율을 유지해 제공. 화면 폭에 원본 지도를 무조건 100% 축소하지 않는다.
- **MAP-07:** 한 손 터치 드래그로 x/y 팬을 지원하고, 데스크톱은 마우스/트랙패드/키보드 접근을 제공. 지도 축소/확대는 P1로 구분하거나 P0에서는 고정 readable scale을 사용.
- **MAP-08:** 사용자가 이동 가능 범위를 이해하도록 양축 스크롤 힌트, 방향/끝 표시를 제공한다. iOS 기본 스크롤바는 자동 숨김 가능하므로 CSS/시각적 폴백 테스트 필수.
- **MAP-09:** 사용자 탭이 **드래그·스크롤로 판정되면 부스 선택이 발생하지 않아야 함**(탭/팬 임계값 적용).
- **MAP-10:** 위치가 연결된 부스를 탭하면 `booth_hotspot`의 `exhibitor_id`를 선택하고, 부스 영역 강조·선택된 기업 카드가 **지도 바로 아래** 표시된다. 가능하면 지도 스크롤 위치를 유지하고 카드 갱신.
- **MAP-11:** 지도 내 정확한 영역 오버레이는 원본 좌표계에 정규화한 x/y/w/h(0..1) 또는 다각형 점 좌표를 저장하여 스케일·스크롤 변화에 따라 동기 변환한다.
- **MAP-12:** 겹치는 핫스팟, 공유 부스, 대표관/단체관은 하나의 기업으로 추측하지 않고 선택 후보를 보여준다.
- **MAP-13:** 지도에 없는 기업은 목록/검색으로 접근. 검색 결과에서 `지도에서 보기`를 선택할 경우 매핑된 위치로 스크롤/강조. 좌표 미설정이면 지도 탐색은 비활성·설명 표시.
- **MAP-14:** 연결 안 된 영역은 임의 회사를 열지 않는다. `기업정보 확인 중` 안내 또는 `부스/기업 찾기` 폴백.
- **MAP-15:** 모바일 웹 접근성: 터치 대상 44×44 CSS px 이상(작은 부스 면적일 경우 접근 가능한 확대/리스트 대안), 스크린리더 이름·선택 상태, 키보드 탐색/텍스트 검색 대안 제공.
- **MAP-16:** 이벤트 선택이 바뀌면 현재 지도·지도 핫스팟·선택 카드는 해당 이벤트로 갱신하고 이전 이벤트의 잘못된 기업을 표시하지 않는다.

### 5.3 지도 좌표 설정 관리자 기능
- **MAP-17:** 관리자는 정해진 지도를 보며 부스 영역(사각형 우선, 필요 시 다각형)을 생성·수정·삭제·복제한다.
- **MAP-18:** 각 영역에 `booth_code` 및 동일 전시회 `exhibitor_id`를 연결한다. 수동 검수 후 `verified`로 표시할 때만 공개 선택 허용.
- **MAP-19:** 지도 버전, 좌표 매핑 상태 `unmapped/draft/verified/retired`, 생성자/검수자/검수 일시 보관.
- **MAP-20:** 다중 핫스팟 및 잘못된 중첩/이미지 범위 밖 좌표/다른 행사 참가기업 연결을 검증·차단.
- **MAP-21:** 행사별 `지도 매핑률 = 검증된 고유 부스 / DB 기준 유효 부스`, 수집 기업수/승인 기업수와 별도 표시. 239개가 지도 연결 완료라는 의미는 아님.

## 6. 기능 요구사항: 기업 카드 + 4개 아이콘 (신규)

**공통 규칙:** 지도 바로 아래 기업명(굵게, 충분한 크기), 부스번호/분류, 전시품목/기업 요약, 승인된 AI 한 줄 요약, 출처 링크. **기업명 오른쪽 `스피커 → 카메라 → 마이크 → A` 순서** 유지. 폭이 좁으면 아래 줄로 분리하되 순서 유지. 실행 시 기업/행사 컨텍스트 명확히 보여줌.

| ID | UI·기능 요구 | 결과 |
|---|---|---|
| CARD-01 | 4 버튼은 각각 독립 클릭, 최소 44×44px, 텍스트 또는 접근성 레이블. | 조작·접근성 확인 |
| CARD-02 | 스피커 버튼: 승인된 한국어 도슨트 재생/일시정지/다시듣기. | 재생 상태·대본 폴백 |
| CARD-03 | 카메라 버튼: 촬영 또는 갤러리 선택, 다중 사진 지원. | 현재 업체에 연결, 로컬 저장 |
| CARD-04 | 마이크 버튼: 녹음 동의/마이크 권한 확인 → 녹음/중지/타이머/저장 상태. | 음성 파일 로컬 영속화 |
| CARD-05 | **A 문자 버튼:** 메모 기록 모달/바텀시트 열기. | 빈/기존 메모 창 열기 |
| CARD-06 | 메모 UI: 제목 `메모 기록`, 멀티라인 입력, placeholder, 취소·저장, 닫기 및 입력 글자수(초기 500자 권장; 정책 변경 가능). | 입력·검증·닫기·취소 |
| CARD-07 | 저장 시 메모 `record_id`, `field_day_id`, `exhibitor_id`, 작성/수정시간 기록. 개인 Sheets `notes`에 동기화. | 오프라인 로컬 큐와 원격 반영 |
| CARD-08 | 기존 메모 보기/수정/삭제 가능, 명시 저장 이전에는 이전 원본을 덮어쓰지 않음. | 버전/충돌 처리 |
| CARD-09 | 기업 카드 전환 중 열린 메모 편집이 다른 기업에 잘못 저장되지 않게 draft에 대상 ID 고정 및 이탈 경고. | 교차 연결 방지 |
| CARD-10 | iOS 키보드 등장 시 모달 입력칸·저장 버튼 노출. Escape/뒤로가기/화면 reader 처리. | 모바일 E2E |
| CARD-11 | 음성 녹음 중 도슨트 TTS는 재생하지 않음. 재생 중 녹음 시작 시 재생 정지. | 오디오 충돌 방지 |
| CARD-12 | 버튼 작업 실패 시 사용자에게 대기/재시도/권한 재설정 상태 표시; 자료 내용 손실 금지. | 실패 후 복구 |

## 7. 기능 요구사항: 공식 참가기업 Directory Importer (신규)

### 7.1 공식 원천과 접근 특성
- **DIR-01:** 행사마다 공식 참가기업 디렉토리 시작 URL을 `directory_sources`에 등록. 첫 PoC 예시: `https://www.k-eco.or.kr/home/v4.php?s=34`.
- **DIR-02:** 개별 상세 예시 `https://www.k-eco.or.kr/home/v4_view.php?idx=44&s=34`; 관측된 페이징은 `startPage=N` 형태. 정렬/필터 쿼리의 변동 값을 고정값으로 가정하지 않고 실제 링크를 파싱.
- **DIR-03:** 2026-10-16 사이트 표시 `239개사 / 6페이지`는 `source_reported_count` 스냅샷으로 저장하며 성공/승인/지도매핑 건수와 분리. 사이트 변경 감지에 활용.
- **DIR-04:** 관리자 UI에서 Import 작업 URL/행사/출처/권한/실행 모드(PoC, preview, full)를 입력하고 권한 있는 사용자만 실행.
- **DIR-05:** 첫 실행은 **5개 개별 기업 상세**로 PoC: 목록 URL 탐색, 실제 상세 링크 수집, 필드 누락/한영문 혼재/로고 파일/부스번호 확인; 성공 기준 만족 전 대량 수집 금지.

### 7.2 콘텐츠 추출·품질/권리
- **DIR-06:** 가급적 요청 기반 HTML 파싱(우선), JS 렌더링 필수 시 허용 범위 내에서만 브라우저 자동화(폴백). 상세 ID/링크를 **목록에서 실제 발견한 값**만 사용; 연속 숫자 대입으로 URL 추측 금지.
- **DIR-07:** 필드 매핑: `source_exhibitor_id`, 이름 한/영, 브랜드 한/영, 부스번호, 참가 카테고리/하위분류, 전시품목, 기업소개 한/영, 주소, 홈페이지, SNS, 이벤트/체험, 로고 URL, 원본 페이지 URL, 수집 시각.
- **DIR-08:** HTML 인코딩/줄바꿈/공백/특수문자 정규화하되 원본 보존. 기업별 누락 필드는 `null` + 누락 경고, AI 임의 채움 금지.
- **DIR-09:** URL 방문은 사용자에게 공개된 정상 경로·약관·robots 정책·서버 제한 내에서만 실행. 로그인 우회·CAPTCHA 회피·요청 과부하 금지. `robots.txt`의 404나 미확인을 재사용 허가로 판단하지 않음.
- **DIR-10:** Gatherly의 **공개 사이트 재게시**를 위해 전시 주최측 공식 CSV/Excel 제공 및 텍스트·로고·배치도 사용 허가를 우선 요청. 권한 불명확 시 원문 전체/로고는 공개하지 않고, 출처 링크·확인된 사실 필드 중심으로 운영 또는 발행 보류.
- **DIR-11:** 원본 페이지 내용과 AI 생성 요약을 다른 필드/테이블에 보관하고, AI 요약 `draft`는 승인 전 외부 조회 금지.
- **DIR-12:** 적정 요청 속도, 동시성 제한, Timeout, 429/5xx 지수 백오프, 거부/차단 신호 시 즉시 중단·관리자 경고, 페이지별 상태 로그.

### 7.3 Staging → Approval → Publish
- **DIR-13:** 원본 모든 신규/갱신 결과는 `staging_exhibitors`에 저장. 목록 원천 ID와 정규화 기업명/상세 URL로 중복 후보 탐지.
- **DIR-14:** `source_key = (source_id, source_exhibitor_id)` 또는 정규화된 canonical 상세 URL로 멱등 upsert; `회사명만`으로 확정 병합 금지.
- **DIR-15:** 기존 운영 DB에서 같은 기업을 여러 행사에 재사용하도록 `companies`와 `exhibitors`를 분리. 업체 식별과 전시 참가(부스) 정보를 구별.
- **DIR-16:** 검증 항목: 수집 성공·실패, 상세 URL 유무, 한/영 필드, 부스번호 충돌, 중복 이름/ID, 동일 회사 행사 중복, 이미지 사용권, 분류 정합성, 기록 변경 diff.
- **DIR-17:** 관리자 검토 목록에서 추가·변경·충돌·보류·실패 필터와 미리보기, 건별/선택 승인, 재수집, 보류, 이전 버전 롤백.
- **DIR-18:** 승인 트랜잭션에는 `approved_by`, `approved_at`, 출처/원본 해시, 원본 → 정규화 → 발행 버전 연결 기록. 공개 API는 `published`만 조회.
- **DIR-19:** Importer 상태/집계: `source_reported_count`, `discovered`, `detail_fetched`, `parsed`, `staged`, `approved`, `published`, `failed`, `unmapped_booths`를 각각 표시. **확인되지 않은 성공 표시 금지**.
- **DIR-20:** 정기 갱신은 공개 데이터 자동 덮어쓰기보다 새 staging revision 생성 → 변경 검수 → 게시 순서 우선.
- **DIR-21:** 특정 전시회 수집기 플러그인 경계를 정의하여 이후 ENTECH·푸드위크 등 다른 도메인으로 확장 가능. 신규 사이트는 매번 접근/권리/파서 규칙 확인.

## 8. 도슨트 스크립트·음성 요구사항

- **VOICE-01:** 공식 원천/승인 기업 정보만을 근거로 한국어 20~40초 소개를 작성하며 회사·주요 출품품·기술 특징·현장 확인 포인트를 포함.
- **VOICE-02:** 스크립트마다 `exhibitor_id`, 근거 `source_url`, `source_hash`, 모델/프롬프트 버전, `review_status`, 승인자/승인일, 생성일을 기록.
- **VOICE-03:** Gemini TTS 요청은 서버에서만 실행. 사전 생성된 음성은 접근권한·라이선스·캐시 정책을 준수해 저장 및 재생.
- **VOICE-04:** 스피커 버튼 상태: `NOT_AVAILABLE/DRAFT/READY/PLAYING/PAUSED/ENDED/ERROR` 중 사용자에게 적절히 표시.
- **VOICE-05:** 네트워크 불량 또는 TTS 장애 시 승인된 스크립트 텍스트 폴백. 녹음·사진·메모 동작은 Gemini와 독립.
- **VOICE-06:** 같은 기업에 대해 캐시된 대본/오디오 버전이 바뀌면 이전 오디오와 혼용되지 않도록 cache key 관리.
- **VOICE-07:** 개인 미공개 전사/메모를 공식 AI 안내 작성에 자동 제공 금지. 향후 공유 승인 기능이 있을 경우 별도 opt-in 처리.

## 9. 미디어 캡처·개인 Sheets/Drive 동기화

### 9.1 수집
- **CAP-01:** MediaRecorder 지원 여부 및 브라우저 MIME 타입을 런타임 검사. 기기 권한 거부/통화/백그라운드/화면 잠금 시 중단 경고·폴백 안내.
- **CAP-02:** 녹음 전 참여자 동의 고지, 시작/중지/경과시간/저장 상태 및 로컬 미리듣기.
- **CAP-03:** 사진 다중 촬영/선택, 원본 MIME/크기/시각 보존, 필요 시 리사이즈는 별도 사본만.
- **CAP-04:** 음성/사진/메모를 대상 `field_day_id`와 `exhibitor_id`/임시 기업 ID에 연결. 오분류 수정·미분류함 지원.

### 9.2 개인 저장소
- **SHEET-01:** Google Drive에 `Gatherly/행사별 하위폴더/Photos·Recordings·Reports` 및 행사별 Spreadsheet 생성/재사용. 폴더/시트 파일 ID를 사용자 연결 메타데이터에 보존.
- **SHEET-02:** 개인 시트 탭은 내부 식별자 `visits`, `notes`, `assets`, `transcripts`, `insights`, `reports`를 기본으로 하며 화면 표시명은 한국어 가능. 각 데이터는 `record_id`, `schema_version`, `sync_revision`, `updated_at`, `deleted_at`를 포함.
- **SHEET-03:** 사용자가 시트에서 직접 행 순서를 바꾸거나 내용을 수정해도 `record_id` 기준으로 연동. 행 번호를 레코드 정체성으로 사용하지 않음.
- **SHEET-04:** 앱/시트 동시 수정이 감지되면 `CONFLICT` 상태와 선택/복구 UI를 제공하고 자동 덮어쓰기 금지.
- **SHEET-05:** 사용자 시트/Drive 파일 삭제·이동·권한 회수 시 사용자에게 상태를 알리고 재연결/새 파일 선택 및 기존 로컬 원본을 보존.

### 9.3 동기화 절차
- **SYNC-01:** 신규 수집 내용은 IndexedDB에 먼저 고유 클라이언트 ID와 함께 저장 후 업로드 시작.
- **SYNC-02:** 원본 파일을 사용자 Google Drive로 업로드(용량/요청 제한을 고려해 resumable 방식 우선). Drive 성공 시 `drive_file_id`를 로컬 ledger에 확정.
- **SYNC-03:** Drive 성공 후 개인 Sheets `assets`에 파일 참조 및 기업/행사 연결 메타데이터 반영. Drive 업로드만 성공 시 `DRIVE_UPLOADED_SHEET_PENDING`로 후속 재시도.
- **SYNC-04:** **메모는 별도 Drive 원본 없이** 로컬 → 개인 Sheets `notes`에 적재하고 동기화 상태 추적.
- **SYNC-05:** `client_asset_id` + `mutation_id` 사용, 재요청 시 Drive 파일/Sheets 행 중복 생성 방지. 완전한 원자적 분산 트랜잭션은 가정하지 않음.
- **SYNC-06:** 성공 확정 전 로컬 사본은 삭제 대상 아님. 저장 용량 부족 시 원본 손실 위험을 명시.
- **SYNC-07:** 오류 상태, 복구 상태, 업로드 진행률, 재시도, 인증 갱신 안내를 기업 카드와 수집함에서 노출.
- **SYNC-08:** 429/5xx/네트워크 오류는 무한 재시도 금지, 지수 백오프 + 사용자 수동 재시도 지원.

### 9.4 상태 모델
```text
미디어: LOCAL_PENDING → DRIVE_UPLOADING → DRIVE_UPLOADED_SHEET_PENDING
      → SHEET_SYNCING → SYNCED
메모:   LOCAL_PENDING → SHEET_SYNCING → SYNCED
오류:   FAILED_RETRYABLE / BLOCKED_REAUTH / CONFLICT / FAILED_FINAL
녹음:   IDLE → REQUESTING_PERMISSION → RECORDING → STOPPING → LOCAL_SAVED
```

## 10. AI 보고서 생성·수정·Google Docs — 기존 핵심 요구 보존

| ID | 요구사항 |
|---|---|
| RPT-01 | 사용자가 분석 목적·관점(시장성/마케팅/기술/경쟁/조달 등)을 **자유 텍스트로 입력**하고 대상 행사/기업/원본 선택. |
| RPT-02 | 동일 자료를 사용해 서로 다른 관점의 보고서를 복수 생성. |
| RPT-03 | 선택된 개인 Sheets·Drive와 승인된 공식 데이터만 권한 확인 후 읽고 **사용자 Drive에 분석 입력 스냅샷** 보관. |
| RPT-04 | 보고서 근거에 파일 ID/메모 ID/전사 ID/공식 URL/외부 출처/확인 시각을 연결. |
| RPT-05 | 신뢰 가능한 외부 조사를 보강할 수 있으나 **원본 사실·외부 사실·AI 해석·확인 불가 항목**을 구별. |
| RPT-06 | 핵심 요약, 구조화된 본문, 표, 필요 이미지, 출처표기를 지원. |
| RPT-07 | **AI 초안 생성 후 사용자 자유 텍스트 수정 요청** 및 새 버전 생성. 이전 버전 보존. |
| RPT-08 | **사용자 직접 텍스트 편집**과 자동/명시 저장·충돌 대응. |
| RPT-09 | **사용자 본인의 Google Docs 생성·내보내기** 및 편집 가능한 상태로 제공. |
| RPT-10 | 생성·수정 과정 실패 시 이전 버전 보존하고 사용자에게 진행·실패·재시도 안내. |
| RPT-11 | 개인 보고서 본문/원본·개인 분석을 공용 Supabase 카탈로그로 자동 복사하지 않음. |
| RPT-12 | 신규 AI 보고서 생성 전 서버에서 이용권·운영 모드·남은 생성 횟수·전역 비용/속도 제한을 확인하고 원자적으로 실행권을 예약. |
| RPT-13 | AI 수정은 같은 보고서 ID/버전 내에서 처리, 관리자 지정 수정 예산을 검사하고 신규 보고서 차감을 피함. |
| RPT-14 | 생성 실패·중복 요청 시 이용권 예약 복구 및 사용자에게 확인 가능한 실행 상태 반환. |
| RPT-15 | 유효 체험권 종료 후에도 과거 Docs 링크 조회, 직접 편집 및 원본 열람 허용. 신규 AI 생성·AI 수정은 현재 권한에 따라 판정. |

기존 코드에서 Report가 현재 미구현이면 API/기획 계약만 보존하고 실제 구현 여부를 명확히 기록한다. 보고서 출시는 Field MVP와 별도 게이트지만 기능 자체는 범위에서 삭제하지 않는다. **새 AI 생성·AI 수정 요청에 한하여 서버 프리미엄/체험 이용권 검증을 적용한다. 이미 생성된 Google Docs 열람·직접 편집은 권한 만료와 무관하게 유지한다.**

## 11. 사용자 유형·체험권·프리미엄 접근제어 (신규 핵심 계약)

### 11.1 사용자 상태 도출 및 접근 경계
| ID | 요구사항 | 검증 포인트 |
|---|---|---|
| ACC-01 | 서비스 화면에 표시하는 사용자 유형은 **일반 무료 사용자 / 무료 체험 사용자 / 프리미엄 사용자 / 관리자** 정확히 4종. | API·UI 역할 값 4종만 표시 |
| ACC-02 | 신규 가입 시 기본은 일반 무료 사용자. 권한 없을 때 지도/기업 검색·개인 기록·기존 자료 조회 가능. | 체험권 없이 지도·메모 이용 |
| ACC-03 | 서버 관리자 식별은 별도 보호 권한 테이블 또는 변경 불가능한 `app_metadata`에 근거; 사용자가 편집하는 `user_metadata` 사용 금지. | 임의 계정의 관리자 위조 실패 |
| ACC-04 | 무료 체험은 독립적인 영구 DB 역할이 아니라 **현재 유효한 기간형/1회형 entitlement**에서 도출. 만료/소진은 자동 일반 무료로 반영. | 만료 시각/소진 경계 테스트 |
| ACC-05 | 활성 프리미엄은 활성 체험보다 UI 표시 우선. 관리자는 관리자 타입 표시; 관리자라도 보고서 생성 우회는 명시된 서버 운영 정책에 따라 감사. | 우선순위·예외 감사 |
| ACC-06 | 관리자는 공식 카탈로그·쿠폰·정책을 관리하되 사용자의 개인 Google 저장 파일 열람 권한은 자동 획득하지 않는다. | 개인 파일 ID 탈취 시 403 |
| ACC-07 | 단순 화면 숨김을 권한 검증으로 간주하지 않는다. 보고서 시작·AI 수정·쿠폰 발급/회수·관리자 정책 API에서 각 서버 검증 필수. | 직접 API 호출 401/403 |

**표시 상태 계산 우선순위:** `ADMIN > PREMIUM(active) > TRIAL(active and usable) > FREE`. 공용 `user_type` 열 하나에 영구 상태를 고정하지 않는다. 관리자 식별과 유료/체험 상품 상태는 별개이며 서버에서 계산한다.

### 11.2 체험권 구성 및 생명주기
| ID | 요구사항 | 정책 |
|---|---|---|
| ENT-01 | `PERIOD` 기간형: `starts_at` + `expires_at` 또는 `duration_days`, 별도 선택적/기본 보고서 생성 횟수 상한. | 유효 기한/횟수 중 빠른 종료 |
| ENT-02 | `ONE_TIME` 1회형: 성공한 **새 보고서 1개**를 생성할 권리, 지급·활성화·등록/사용 마감 시각을 정책으로 설정. | 생성 성공에만 차감 확정 |
| ENT-03 | 각 체험권은 계정 귀속. 캠페인별 코드 지급·사용 한도·중복 허용 정책을 서버에서 검사. | 타 계정 쿠폰 복제 방지 |
| ENT-04 | 사용 상태는 `GRANTED → ACTIVE → EXHAUSTED / EXPIRED / REVOKED`, 전이 감사 가능; 개별 생성 예약은 `RESERVED → COMMITTED / RELEASED / EXPIRED_RESERVATION`. | 원자적 상태 전이 |
| ENT-05 | 보고서 1건에 대한 AI 재수정은 새 보고서 생성량을 차감하지 않고, 보고서별 수정 횟수·기간·비용 별도 제한. | 1회형으로 한 문서 생성 및 제한된 수정 |
| ENT-06 | 체험권 만료 후 신규 생성 불가. 과거 보고서 Google Docs 접근/직접 편집·다운로드는 사용자 소유 저장소 권한을 존중해 계속 허용. | 만료 후 기존 Docs 열람 |
| ENT-07 | 프리미엄 플랜 권한은 동일한 이용권/사용량 판정 서비스로 통일. 실제 카드 결제·정기 구독 PG는 별도 릴리스. | 결제 미연결 상태에서 수동 프리미엄 그랜트 가능 |
| ENT-08 | 일반 사용자에게 개인 자료 저장·녹음·사진·메모 업로드를 AI 보고서 이용권과 연결해서 차단하지 않는다. | 별도 게이트 독립성 |

기간형 예시 7일/3건, 1회형 예시 등록 후 30일은 **초기 운영안일 뿐 고정값이 아니다**. 수정 횟수/수정 가능 창은 관리자가 정책으로 결정해야 하며 기본값 확정 전에는 '미확정'을 명시한다.

### 11.3 서비스 운영 모드와 전환
- `PREOPEN_LIMITED`: 별도 선정 대상이나 지정된 무료 체험권을 허용. 전 사용자에게 무제한 API 권한 부여 금지.
- `COUPON_ONLY`: 쿠폰으로 활성화된 체험권 또는 프리미엄 이용권 보유 사용자만 신규 생성.
- `PREMIUM_ONLY`: 프리미엄만 신규 체험권을 받도록 제한. **기존 발급 체험권의 잔여 권리 유예/종료 정책은 운영자가 명시적으로 결정**해야 하며, 이미 약속된 권리의 임의 강제 취소를 기본값으로 두지 않는다.
- 모드 변경은 관리자 서버 API로 수행, 활성 작업은 기존 reservation에 따라 정상 종료 가능, 운영 감사 로그 보존.
- 모든 모드에서 계정별 생성·수정 제한, 비용 예산, 전역 일/월 한도, 비정상 호출 탐지·정지가 가능해야 한다.

### 11.4 쿠폰 등록·중복 방지·데이터보호
- `coupon_code`는 추측하기 어렵게 생성, 비교 가능한 **서버측 단방향 해시/검증 방식**으로 저장, 발급처리 외 원문 조회 제한; 입력은 정규화 및 서버 rate-limit.
- 등록은 원자적 트랜잭션: 활성 캠페인/코드·중복·만료·전체 발급량·사용자 한도 검증 → redemption 생성 → entitlement 생성. 중복 요청 재시도는 동일 결과(idempotency) 반환.
- 선착순 이벤트에서 동시 요청이 와도 재고/총 등록 수량이 초과되지 않도록 UNIQUE 제약과 row-level locking 또는 동등한 DB 원자적 연산을 적용.
- 발급·등록·회수·수동 지급 및 실패 사유를 감사 기록. 운영 로그에 쿠폰 원문·개인 보고서 본문·Google 액세스 토큰 저장 금지.
- 쿠폰 재판매·타 계정 이전은 기본적으로 제한. 이벤트 필요 시 발급 정책으로 별도 설계.

### 11.5 AI 작업별 과금/횟수 차감 계약
1. 사용자는 보고서 목적/근거를 지정한다. 생성 버튼을 누르면 앱이 `clientRequestId`(idempotency key)를 서버에 전송한다.
2. 서버는 로그인/소유권/운영 모드/체험·프리미엄 이용권/잔여 횟수/AI 요금 한도를 확인하고 **사용량 예약(reservation)**. 분산/동시 요청에서도 1개의 잔여 권리를 여러 작업에 중복 예약할 수 없어야 한다.
3. AI 생성은 운영자가 정한 큐/시간 한도 내 수행하며, 성공 시 해당 보고서 ID·사용량으로 `COMMITTED`, 오류 시 `RELEASED` 또는 만료된 예약 자동 정리. 예약 만료 중 불확실한 완료 상태는 결과 조회/정합성 검사 후 재처리.
4. **최종 성공으로 정의한 정상 초안 생성·개인 Docs/Drive 저장 정책**이 충족되어야 신규 보고서 생성권을 확정 차감한다. 저장 실패 시 기존 성공 응답과 다르므로 중복 비용/차감 정책을 테스트로 명확히 지정.
5. 동일 보고서 AI 수정은 별도 `revision_budget`과 사용 가능 시점을 확인한다. 사용자 직접 Docs 편집/기존 보고서 조회는 신규 생성권을 차감하지 않는다.
6. 사용 완료·만료·실패 복구·잔여 권리를 `내 이용권`에 제공한다. 운영자 감사와 사용자 화면의 횟수가 일치해야 한다.

### 11.6 Supabase 논리 스키마 확장(개인 보고서 본문 미보관)
| 테이블 | 필수 필드(개념) | 제약/정책 |
|---|---|---|
| `user_access_roles` | `user_id`, `role`(`ADMIN`/`MEMBER`), `granted_by`, `updated_at` | 관리자 권한은 서버 전용; 본인 수정 불가 |
| `report_access_policy` | `id`, `mode`, `daily_budget`, `monthly_budget`, `revision_limit`, `updated_by`, `updated_at` | 관리자만 변경, 버전/감사 |
| `trial_campaigns` | `id`, `title`, `grant_type`(`PERIOD`/`ONE_TIME`), `duration_days`, `redemption_expires_at`, `max_reports`, `max_redemptions`, `per_user_limit`, `status` | 기간형/1회형 정책 분리 |
| `trial_coupon_codes` | `id`, `campaign_id`, `code_hash`, `status`, `issued_at`, `expires_at` | 해시 유니크, 관리자/서버만 |
| `trial_redemptions` | `id`, `campaign_id`, `coupon_id`, `user_id`, `redeemed_at`, `idempotency_key` | UNIQUE(쿠폰/사용자 정책), 같은 요청 중복 방지 |
| `report_entitlements` | `id`, `user_id`, `source_type`, `campaign_id`, `starts_at`, `expires_at`, `total_reports`, `committed_reports`, `status` | 본인은 자기 상태만 조회, 변경은 서버 전용 |
| `report_usage_reservations` | `id`, `user_id`, `entitlement_id`, `request_key`, `report_id`, `operation`(`CREATE`/`REVISE`), `status`, `reserved_at`, `completed_at`, `usage_cost` | UNIQUE(user_id,request_key), 원자 예약/확정/복구 |
| `premium_grants` | `id`, `user_id`, `plan_code`, `starts_at`, `expires_at`, `status`, `grant_source` | 프리미엄 권한 상태; 결제 연동은 후속 |
| `access_audit_events` | `id`, `actor_id`, `subject_id`, `action`, `result`, `created_at`, `safe_details_json` | 관리자만, 민감한 본문/토큰 제외 |

- 최종 물리 스키마/컬럼 이름은 기존 Prisma/DB 감사 후 확정. 정합성을 위해 쿠폰/잔여횟수 관리 트랜잭션은 **PostgreSQL 원자 연산**으로 처리하며 브라우저/Google Sheets의 현재 표시값으로 권한을 판정하지 않는다.
- `user_id`를 기준으로 개인 운영 메타데이터에 RLS를 적용하되 **발급·등록·예약·차감/권한 승격은 서버 전용 경로**에서만 수행한다. 일반 클라이언트가 쿠폰 총량/발급자 목록/타 사용자의 권한을 조회하지 못하도록 한다.
- `user_storage_links`의 Google 연결 정보, 개인 Sheets/Drive/Docs 원본, 개인 보고서의 내용과 분석 프롬프트는 외부 공유 데이터로 승격하지 않는다.

### 11.7 API 초안 (실제 라우트 충돌 확인 후 확정)
```text
GET  /api/me/access                  # type, trial, premium, canCreate, expiresAt, remainingReports
POST /api/me/coupons/redeem         # couponCode, clientRequestId
GET  /api/me/report-usage           # 본인 생성/수정 사용량
POST /api/reports                   # entitlement + idempotency + usage reserve 필수
POST /api/reports/:id/revise        # 동일 보고서 수정 예산·권한 확인
GET  /api/admin/trial-campaigns
POST /api/admin/trial-campaigns
POST /api/admin/trial-campaigns/:id/coupons
POST /api/admin/report-grants       # 체험/프리미엄 수동 지급
POST /api/admin/report-grants/:id/revoke
PATCH /api/admin/report-access-policy
GET  /api/admin/report-usage        # 비용/실패/차감/감사 집계
```
- `GET /api/reports/:id`, 개인 Docs 열람·직접 편집 및 기존 파일 다운로드는 **보고서 소유권 검사**만으로 허용. 신규 생성·AI 재수정과 혼동해 과도하게 막지 않는다.
- 쿠폰 등록과 보고서 예약/확정은 클라이언트가 보낸 사용자 유형/남은 횟수를 믿지 않는다.

### 11.8 수락 테스트 (반드시 작성·실행)
- **AT-ACC-01:** 신규 가입자는 무료 유형; 지도·4아이콘·기록 저장 가능, 보고서 신규 생성 API는 거부.
- **AT-ACC-02:** 기간형 체험 활성화 → 기한/횟수 내 생성 허용 → 제한 도달 시 자동 무료 복귀, 기존 Docs 조회 가능.
- **AT-ACC-03:** 1회형 체험 등록 → 단 하나의 신규 보고서만 성공, 두 번째는 차단.
- **AT-ACC-04:** 동일 `clientRequestId` 재전송/동시 생성으로 1회권이 중복 차감·중복 생성되지 않음.
- **AT-ACC-05:** 생성 실패/Docs 저장 실패/타임아웃 시 예약 정리·재시도, 잔여횟수와 작업 결과 일치.
- **AT-ACC-06:** 한 사용자에 쿠폰 중복 등록, 두 계정에서 동일 코드 선착순 경쟁, 만료 코드, 총 발급량 한도를 모두 서버에서 방지.
- **AT-ACC-07:** 체험 기간 종료 후 기존 Docs/원본/수정한 텍스트 조회 가능. 신규 AI 수정은 현재 자격과 수정 정책에 따라 결정.
- **AT-ACC-08:** PREOPEN_LIMITED/COUPON_ONLY/PREMIUM_ONLY 운영 모드 변경에 대한 접근 결과·기존 권리 처리·감사 기록 확인.
- **AT-ACC-09:** 일반/체험/프리미엄 계정이 관리자 API나 타 사용자의 entitlement 조작 시도 시 403.
- **AT-ACC-10:** 프리미엄 수동 부여·만료 후 4유형 표시 전환, 사용자 Google 파일 격리 유지.

## 12. 공개 베타와 피드백
- **BETA-01:** Google 가입/로그인 및 Drive 접근 **별도 승인**이 신규 사용자에게 동작.
- **BETA-02:** 사용자 A·B의 Drive·Sheets ID 및 콘텐츠가 앱 API/URL 변경으로 서로 보이지 않음.
- **BETA-03:** 공개 랜딩페이지, 개인정보처리방침/이용약관, Google OAuth 동의 화면 및 필요 검증/승인 확인.
- **BETA-04:** 사용자별 AI 호출량·요금 한도, rate limit, 운영 장애 알림, 사용자 삭제/연결 해제 처리. **유료화 이전에도 보고서 쿠폰·체험 예산·서버 접근제어 통과 필수**.
- **BETA-05:** 인앱 피드백: 분류, 내용, 선택적 화면 정보, 연락 동의, 관리자 상태 변경/응답 기록.
- **BETA-06:** 실제 외부 홍보 시작은 사용자 정보 보호/권한 검증/AI 비용 검증이 통과한 후.

## 13. DB 논리 모델 / 인덱스 / RLS

### 13.1 공개·관리자 DB 최소 모델 (제안안, 실제 스키마 감사 전)

| 논리 테이블 | 필수 열(요약) | 핵심 제약/접근 정책 |
|---|---|---|
| `exhibitions` | `id`, `name`, `start_at`, `end_at`, `location`, `status` | 공개된 행사만 조회 |
| `companies` | `id`, `display_name_ko/en`, `website`, `normalized_name` | 기업 고유 정체성, 이름 자동 병합 금지 |
| `exhibitors` | `id`, `exhibition_id`, `company_id`, `booth_code`, `brand_name`, `category`, `exhibit_items`, `source_ref_id`, `status` | 행사별 참가 유니크 키, 부스 공유 허용 모델 |
| `directory_sources` | `id`, `exhibition_id`, `base_url`, `source_type`, `usage_permission_status`, `source_reported_count` | 관리자 작성, 승인 없이 공개 콘텐츠 발행 금지 |
| `import_runs` | `id`, `source_id`, `mode`, `started_at`, `finished_at`, `counts_json`, `status`, `error_summary` | 관리자만, 재실행 이력 |
| `staging_exhibitors` | `id`, `run_id`, `external_id`, `detail_url`, `raw_fields_json`, `normalized_fields_json`, `content_hash`, `validation_status` | 외부 조회 불가, 중복 후보 검토 |
| `import_approvals` | `id`, `staging_id`, `decision`, `reviewer_id`, `reviewed_at`, `notes` | 관리자만, 감사 흔적 |
| `booth_map_assets` | `id`, `exhibition_id`, `asset_url`, `source_url`, `width`, `height`, `crop_rect`, `version`, `usage_permission_status` | 공개 전 지도 이미지 이용 조건 확인 |
| `booth_hotspots` | `id`, `map_id`, `booth_code`, `exhibitor_id`, `shape_type`, `geometry_norm_json`, `review_status`, `reviewed_by` | 0~1 좌표, 같은 전시회 검사, verified만 공개 |
| `ai_company_briefings` | `id`, `exhibitor_id`, `script_ko`, `audio_cache_ref`, `source_hash`, `model`, `review_status`, `approved_at` | draft 비공개, 승인된 공식 대본만 공개 |
| `ai_evidence` | `id`, `briefing_id`, `source_url`, `retrieved_at`, `source_excerpt_hash` | 검토 근거 |
| `user_storage_links` | `user_id`, `drive_folder_id`, `spreadsheet_id`, `connection_status`, `updated_at` | 사용자 본인만 또는 서버 전용; 토큰 평문 보관 금지 |
| `user_feedback` | `id`, `user_id`, `category`, `content`, `status`, `created_at` | 작성자+관리자 정책 |

**v0.5 추가 운영 테이블:** 11.6절의 `user_access_roles`, `report_access_policy`, `trial_campaigns`, `trial_coupon_codes`, `trial_redemptions`, `report_entitlements`, `report_usage_reservations`, `premium_grants`, `access_audit_events`. 개인 수집 내용은 공용 DB에 넣지 않는다.

- RLS는 모든 노출 스키마 테이블에 적용한다. `published` 데이터만 `anon`/`authenticated`의 읽기가 허용되도록 정책을 분리한다.
- 스테이징/관리자 승인/Import 실행은 외부 노출 없는 스키마 또는 서버 전용 API로 우선 설계한다. 관리자 식별에 사용자가 수정 가능한 `user_metadata` 사용 금지; 서버 소유 권한 테이블 또는 `app_metadata` 적용.
- 서비스 역할 키는 클라이언트에 유출 금지. API별 소유권 검증 및 `SELECT/UPDATE` 정책 둘 다 확인.
- 유사 기업명 중복을 위한 검색 인덱스와 `(source_id, external_id)` 인덱스 등은 PoC 데이터 검증 후 구체화. 공유 부스 때문에 `booth_code` 전역 단일 UNIQUE로 고정하지 않는다.

### 13.2 개인 Google Sheets 컬럼 기본 구조
```text
visits      : record_id, schema_version, field_day_id, exhibitor_id, visited_at, interest, notes_ref, updated_at, sync_revision, deleted_at
notes       : record_id, schema_version, field_day_id, exhibitor_id, text, created_at, updated_at, sync_revision, deleted_at
assets      : record_id, client_asset_id, field_day_id, exhibitor_id, media_type, drive_file_id, mime_type, size, created_at, sync_revision, deleted_at
transcripts : record_id, asset_record_id, language, text, model, edited_at, sync_revision
insights    : record_id, field_day_id, exhibitor_id, prompt, content, references, created_at, sync_revision
reports     : record_id, field_day_id, analysis_goal, google_doc_id, snapshot_file_id, current_revision, status, created_at
```

- `notes.text`는 개인 Google Sheets의 **사용자 데이터**이며 운영 Supabase DB의 기업/승인 AI 분석 테이블에 들어가지 않는다.
- 사용자 직접 시트 수정 지원을 위해 고유 `record_id`를 기준으로 충돌 검사/삭제 tombstone 처리.

## 14. API 초안 (현행 API와 경로 충돌 여부 조사 후 확정)

### 14.1 공개 조회 API
```text
GET /api/exhibitions
GET /api/exhibitions/:id/exhibitors?q=&category=&booth=
GET /api/exhibitions/:id/booth-map
GET /api/exhibitions/:id/booth-hotspots
GET /api/exhibitors/:id
GET /api/exhibitors/:id/voice-guide
```
- `booth-hotspots`: `mapVersion`, `naturalSize`, `[id, boothCode, exhibitorId, geometry, status]`를 반환하되 미승인 좌표 포함 금지.
- `exhibitors` 검색 결과는 실제 출전사 ID, 해당 전시회의 부스, 공식 원본 URL을 사용.

### 14.2 사용자 전용 API
```text
GET /api/me/storage/status
POST /api/me/storage/connect
POST /api/me/storage/disconnect
POST /api/me/notes            # fieldDayId, exhibitorId, text, clientMutationId
PATCH /api/me/notes/:id
GET /api/me/notes?fieldDayId=&exhibitorId=
POST /api/me/assets/init
POST /api/me/assets/:id/commit
GET /api/me/assets?fieldDayId=&exhibitorId=&status=
POST /api/me/assets/:id/retry
POST /api/reports             # analysisGoal + source selection + entitlement check + idempotency
GET /api/reports/:id
POST /api/reports/:id/revise
PATCH /api/reports/:id
POST /api/reports/:id/export/google-docs
POST /api/feedback
```

### 14.3 관리자 API
```text
POST /api/admin/directory-sources
POST /api/admin/import-runs     # preview/poc/full (permission gate)
GET /api/admin/import-runs/:id
GET /api/admin/import-runs/:id/staging
POST /api/admin/import-staging/:id/approve
POST /api/admin/import-staging/:id/reject
POST /api/admin/exhibitions/:id/booth-maps
POST /api/admin/booth-hotspots
PATCH /api/admin/booth-hotspots/:id
POST /api/admin/booth-hotspots/:id/verify
POST /api/admin/briefings/:id/approve
GET /api/admin/feedback
```

- 변경 API는 CSRF 및 권한/소유권 검증, 입력 유효성 검사, 요금/속도 제한. 관리자 작업은 감사 로그 필수.
- `11.7`의 쿠폰/이용권/프리미엄 API도 동일 경계를 적용하며, 동시 쿠폰 사용·AI 작업 횟수는 DB 트랜잭션으로 보호한다.
- 외부 URL 입력은 SSRF 방지: 승인 도메인 목록, 사설 IP 차단, 리다이렉트 검사, 제한 용량/시간/콘텐츠 타입.
- Vercel/서버리스 실행 제한 고려: 전량 수집은 짧은 배치/작업 큐로 분할, 긴 HTTP 요청에 종속되지 않도록 설계. 장애 시 진행 중 배치 재시작 가능.

## 15. 비기능 요구사항

| ID | 요건 |
|---|---|
| NFR-01 | 모바일 한손 조작, 주요 버튼 44px 이상, 접근성 레이블, 한국어 기본 UI |
| NFR-02 | iPhone Safari/PWA에서 양축 스크롤 지도, 좌표/선택 일치, 메모 키보드 동작 검증 |
| NFR-03 | 캐시된 기업/선택 카드 1초 내 전환 목표, 캐시된 음성 재생 2초 내 시작 목표(실기기 계측) |
| NFR-04 | 내 기기 저장 대기/오류 건수 표시, 인터넷 장애 때 자료 수집 지속 |
| NFR-05 | 배치도 이미지 좌표 기반 선택의 실제 정확도 검사; 작은 글자/화질은 고해상도 원본 필요 시 알림 |
| NFR-06 | 개인정보·API 토큰·녹음 원문을 운영 로그에 남기지 않음 |
| NFR-07 | 사용자별 격리, 관리자/공개 조회 분리, 공개 미승인 데이터 누출 방지 |
| NFR-08 | 외부 사이트 로봇/약관/속도/저작권 준수, 사용 권리 별도 확인 |
| NFR-09 | AI는 공식 원본/승인 여부를 구분하고 개인정보를 공개 지식화하지 않음 |
| NFR-10 | 업로드 실패/중단 시 중복 파일 생성 방지 및 원본 복구, 저장소 한계는 명확히 고지 |
| NFR-11 | 공개 베타 사용자별 비용/요청 제한, 운영/오류 모니터링, 탈퇴/연결 해제 정책 |
| NFR-12 | 기존 푸드위크·기후산업국제박람회·ENTECH 2026 데이터와 현장 분류·보고서 관련 코드 회귀 보호 |
| NFR-13 | 쿠폰/체험/프리미엄 권한 검증은 서버 강제, 원자적 차감·중복 요청 억제·실패 복구 테스트 |
| NFR-14 | 기간 만료/횟수 소진/운영 모드 변경으로 본인 기존 Google 보고서 읽기·직접 편집·현장 자료 수집 차단 금지 |

## 16. 인수 테스트 매트릭스

### 16.1 지도/기업 카드
- **AT-MAP-01:** 원본 파일은 제목 없이 지도만 렌더되며 비율 유지. 모바일에서 지도 전체가 작게 축소되어 판독 불가 상태가 되지 않음.
- **AT-MAP-02:** iPhone Safari에서 좌우·상하 스크롤하여 지도 모서리 4곳 이동. 시각적 스크롤 가능 안내 확인.
- **AT-MAP-03:** 스크롤 중 기업 카드가 우발 선택되지 않고 정상 탭 시 올바른 기업 카드가 **지도 아래** 바뀜.
- **AT-MAP-04:** 확대/축소·회전·가로 모드·다른 기기 너비에서도 핫스팟이 실제 부스와 정렬(지원 모드별).
- **AT-MAP-05:** 검색 `N-101` 등 DB 출처 확인된 실제 부스 선택/위치이동, 지도 매핑 미완료 시 검색·목록 폴백.
- **AT-MAP-06:** 겹치는 복수 기업/미매핑/다른 전시회 부스에 잘못된 기업 정보가 표시되지 않음.

### 16.2 아이콘/메모/미디어
- **AT-CARD-01:** 스피커→카메라→마이크→A 아이콘이 기업명 옆에 순서대로 표시되고 44px 이상 터치 가능.
- **AT-CARD-02:** 스피커 TTS 작동·일시정지·텍스트 폴백 및 녹음 시작 시 재생 자동 중지.
- **AT-CARD-03:** 카메라 다중 사진 5장 수집 후 미리보기·개인 Drive 파일/Sheets 참조 연결.
- **AT-CARD-04:** 마이크 녹음 동의 안내·3분 녹음·중지·로컬 저장·Drive·Sheets 연결.
- **AT-CARD-05:** A 탭으로 `메모 기록` 시트 열기/닫기, 저장/취소, 글자수, 입력 중 화면 키보드와 버튼 사용 가능.
- **AT-CARD-06:** 메모 후 기기 네트워크 끊김/복귀 시 본인 Sheets `notes` 반영. 다른 부스 선택 중 오연결 없음.
- **AT-CARD-07:** 기존 메모 수정/삭제, Sheets 행 정렬·직접 수정 후 업데이트 충돌 처리.

### 16.3 Importer/DB/권한
- **AT-DIR-01:** 공식 URL 등록→실제 상세 5개 추출→필드별 원본 대조/URL/부스번호 검증. 승인 이전 공개 검색 결과 없음.
- **AT-DIR-02:** 페이징으로 탐색한 실링크만 상세 방문, 사이트 표시 건수와 discovered/fetched/approved/published 수치를 각각 보고.
- **AT-DIR-03:** 중복 수집·실패 재시도 후 같은 원천 기업에 중복 레코드 없음, 실패 기업 목록 유지.
- **AT-DIR-04:** 빈 소개/잘못된 부스/로고 권리 미확인 기록은 검토/보류 상태이며 허위 AI 설명 생성 불가.
- **AT-DIR-05:** 관리자 승인 후에만 카탈로그·도슨트 공개, 이전 버전과 출처/승인 이력 보존.
- **AT-DIR-06:** 본인이 아닌 사용자가 staging/import-run/approval API에 접근 거절.
- **AT-DIR-07:** 지도 영역 다른 행사·다른 회사 매핑 차단, 검증 좌표만 공개.

### 16.4 데이터/보고서/회귀
- **AT-DATA-01:** 사용자 A/B의 Sheets·Drive 파일 격리, 서로 파일 ID를 교체해 API 호출해도 거부.
- **AT-DATA-02:** Google 로그인과 Sheets/Drive 별도 동의, 거부/철회/재연결 후 로컬 대기 유지.
- **AT-DATA-03:** Drive 업로드 성공 후 Sheets 실패를 강제하고 중복 미디어 없이 재시도해 SYNCED 확인.
- **AT-DATA-04:** 업로드 도중 새로고침/앱 재시작/오프라인 전환 후 로컬 큐 손실 없음(환경 한계 별도 기록).
- **AT-RPT-01:** 동일 자료로 2개 다른 분석 목표 보고서 생성, 원본/외부/AI 추론 출처 구분.
- **AT-RPT-02:** AI 수정 요청 후 새 버전 생성→직접 편집→이전 버전 복구.
- **AT-RPT-03:** Google Docs 내보내기 성공, 사용자 본인 계정에서 편집 가능한지 확인.
- **AT-RPT-04:** 일반 무료 이용자는 새 AI 보고서 생성 거부, 기간형/1회형/프리미엄 이용자는 서버 한도 내 성공.
- **AT-RPT-05:** 동일 요청 중복·실패·리트라이로 사용권이 중복 차감되지 않음, 체험 만료 후 기존 Docs 유지.
- **AT-REG-01:** 기존 수집함 사진/음성/메모·FieldDay 3종 자료 분류·기업 CRUD·미리보기/필터 동작 유지.
- **AT-BETA-01:** 별도 외부 가입 사용자·피드백·운영 관리자 제한·사용량 한도.

## 17. 상태 관리 / 전제 / 남은 승인 항목

### 17.1 단계별 상태
- Phase 0: 실제 저장소/테스트/기존 DB 감사, 백업 경로 확인. 실데이터 변경 금지.
- Phase 1: Supabase 공용 카탈로그·Auth 계약, 타입/스키마/RLS 설계·테스트.
- Phase 2: Directory Importer 5건 PoC·원본/권리 검증·승인 스테이징과 공식 행사 카탈로그.
- Phase 3: 실제 크롭 지도·핫스팟·4버튼/메모 UI와 iPhone 스크롤 테스트.
- Phase 4: 개인 Drive/Sheets 연결·IndexedDB 큐·녹음/사진/메모 동기화.
- Phase 5: Gemini 도슨트 사전 생성/캐시·실기기 리허설. 10/23 실증 목표.
- Phase 6: 4유형 사용자 표시/운영 정책·기간형/1회형 체험권 서버 게이트/보고서 기능 통합/독립 회귀게이트, OAuth/데이터격리/비용/피드백 준비 후 공개 베타.
- Phase 7(출시 고도화): PREMIUM_ONLY 모드, 가격·결제 PG·정기구독은 별도 명세/승인 후. 기존 체험권의 잔여 권리 처리 정책 먼저 확정.

### 17.2 미확정·사용자 승인 필요
1. 주최 측 참가기업 목록 CSV/Excel 제공 및 텍스트/로고/배치도 **Gatherly 재게시 범위**.
2. 부스배치도 고해상도 원본 확보, 좌표 검수 담당자와 10/23 전 우선 매핑할 부스 목록.
3. 실제 Git 저장소/Prisma 스키마/SQLite 데이터 이관·백업·브랜치 상태.
4. 운영 Supabase 프로젝트/Google OAuth 게시 및 비밀키 설정.
5. 녹음 길이/파일 크기/저장 공간 사용 한도, 서버 요금 및 Gemini API 예산.
6. 기간형/1회형 체험권 **시작 시각·기본 기한·생성/수정 한도**, 이벤트 쿠폰의 사용자당 등록 제한, 기존 체험권을 PREMIUM_ONLY 전환 시 어떻게 처리할지 확정.
7. 프리미엄 정식 상품의 가격·결제수단·과금 단위는 추후 별도 결정. 지금 PG 연결은 진행하지 않는다.
8. **실제 외부 시스템에 데이터를 쓰는 작업, 스키마 변경, 배포, commit/push**는 Phase 0/설계 검토 이후 별도 승인.

## 부록 A. 공식 참가기업 상세 샘플의 필드 대조 (수집 검증 예시)
- 공식 URL: `https://www.k-eco.or.kr/home/v4_view.php?idx=44&s=34`
- 회사명: 자원순환보증금관리센터
- 영문명: The Container Deposit System Management Organization
- 브랜드: 자원순환보증금제도 / The Container Deposit System
- 부스: `N-101`
- 참가 분야: 순환자원 > 순환소재 > 플라스틱 재활용
- 전시품목: 자원순환보증금제도
- 기타 상세: 주소, 회사 소개 국/영문, 홈페이지·SNS, 행사 프로그램, 로고 URL은 사이트 필드별 존재 여부 확인.
- 위 기업의 `N-101`은 **공식 상세에 표시된 부스 코드 예시**이며, 지도 좌표가 검증됐다는 뜻이 아니다. 과거 목업에 등장한 다른 가상의 부스·기업 조합은 DB 근거로 사용하지 않는다.

## 부록 B. 참조 자산
- `v0.5_assets/ESG_2026_Official_BoothMap_TitleRemoved_Reference.png`: 사용자 제공, 제목 없는 배치도 원본 참고.
- `v0.5_assets/Gatherly_Mobile_BoothMap_Notes_UI_Concept.png`: 모바일 스크롤 지도/4개 기능 아이콘/메모 바텀시트 시각 참조. **실제 지도·기업 데이터 금지**.
