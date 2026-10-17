# Phase 2E-12 — 원격 저장 테스트 게이트

작성일: 2026-10-18. 기준: PHASE_2E_11_GOOGLE_WRITE_GATE_AND_MOBILE_UI.md.

**전용 3건 저장·원격 재조회·실패 복구 기능을 로컬 구현하고 검증했다. 운영 쓰기는 false로 유지했다. 실제 Google API 활성화 확인 및 운영 적용 승인이 남아 있다.**

## 1. Google API와 활성화 조건

- 기존 파일 동의 scope `https://www.googleapis.com/auth/drive.file` 유지. 앱이 생성/접근 허용받은 Drive 파일과 Sheets에 필요한 최소 범위다. 전체 drive/spreadsheets scope를 추가하지 않았다. [Sheets 공식 scope 문서](https://developers.google.com/workspace/sheets/api/scopes)
- 파일 접근 동의 OAuth Client가 속한 Google Cloud 프로젝트에서 **Drive API / Sheets API 활성화 여부는 미확인**이다. 현재 도구에 해당 Cloud 관리 연결이 없으며, 사용자에게 두 API의 사용 설정 여부 확인을 요청했다. 답변/관리 설정 근거 없이 활성화됐다고 판정하지 않는다.
- 연결 상태 CONNECTED는 토큰 저장 존재이고 실제 Google API 가용성 보장은 아니다. 실제 API 검증은 별도 승인 후 진행한다. 이번에는 운영 토큰을 읽거나 refresh하지 않았다.
- 코드의 GoogleApi는 access token 만료/401 시 refresh하고 Vault에 새 토큰을 암호화 저장한다. 별도 파일 동의와 파일 쓰기 게이트는 계속 분리된다. 실제 쓰기 활성화 승인에는 이 정상적인 Vault 토큰/테스트 manifest 저장도 포함되어야 한다.

## 2. 권한 경계

새 **POST `/api/v2/storage-test`**:

1. Origin + APP_ORIGIN 확인.
2. 전역 쓰기/통합 스위치 확인. 현재 false이므로 DISABLED.
3. Supabase verified session + 기존 환경별 승인 목록.
4. `requireWriteUser()`로 Production 단일 `GATHERLY_V2_PRODUCTION_WRITE_USER_ID` 검사. 값 미설정/다중/잘못된 형식은 차단.
5. `expectedUserId`와 서버 인증 UID 비교. 요청 환경값/권한 metadata를 사용하지 않음.
6. 실제 수신 body를 최대 1152KiB로 제한. Content-Length를 신뢰하지 않는다.
7. 서버가 결정한 production:UID Vault lease 안에서만 예약·Google 요청 실행.

다른 승인 사용자, 미승인 사용자, 다른 환경, UID 위조 모두 기존 경계에서 거부한다. 테스트 전용 경로는 공식 Supabase 카탈로그를 읽거나 게시하지 않는다.

**일반 쓰기와 분리:** `AUTH_ONLY=true`인 현재 내부 실증 모드에서는 기존 `/api/v2/sync`, `/api/v2/media` 및 일반 withGoogle 경로를 requireCatalogWrites()로 차단한다. 전용 쓰기 허용이 일반 행사 저장까지 열지 않도록 했다. 로그인·동의·Google 연결 상태 조회는 그대로 유지한다. 활성화 때도 AUTH_ONLY=true를 유지해야 한다.

## 3. 데이터 모델·저장 위치

`VaultData.pilot`이라는 선택적 암호문 내부 필드를 추가했다. 기존 outer resources/records와 분리된 resources/records/slots/요청 카운터를 사용한다. **운영 SQL, 실제 Vault 행, 키는 변경하지 않았다.** 기존 Vault 암호화 AAD/lease/revision 계약을 재사용한다.

서버에서 관리하는 리소스:

- 루트: `Gatherly 제한 실증 테스트`
- 하위 폴더: `사진·녹음·메모 3건 테스트`
- Sheets: `Gatherly 테스트 기록 (실제 행사 아님)`
- 미디어 하위 폴더: Photos / Recordings
- Sheets notes: 메모. assets: 사진·녹음 파일 참조.

owner + `:storage-test-v1` marker로 실제 행사 리소스와 분리한다. Google ID는 서버 Vault에서만 관리하고 응답에 토큰/암호문/업로드 세션 URL/파일 ID를 반환하지 않는다. private 공유 권한을 추가하지 않는다.

클라이언트의 기존 임시 컨텍스트 `storage-test-event` / `storage-test-company`만 받아 서버 고정 private test 컨텍스트로 매핑한다. 실제 행사 UUID를 제출해 우회할 수 없다. 이 컨텍스트는 공식 Supabase 카탈로그에 INSERT하지 않는다. 기존 로컬 자료 ID는 보존한다.

## 4. 수량·크기·요청 상한

| 항목 | 구현된 제한 |
|---|---|
| 슬롯 | note / photo / audio 각각 최대 1개 |
| 자료 고정 | 최초 record ID, revision, 제목/본문, 미디어 hash/size/MIME를 슬롯에 고정 |
| 변경/재사용 | 같은 요청은 허용, 다른 ID·payload·revision으로 교체 또는 종류 간 ID 재사용은 CONFLICT |
| 파일 크기 | 사진·녹음 각각 최대 5MiB |
| 메모 | 본문 500자, 제목 120자 |
| chunk | 최대 1MiB, 기존 256KiB 정렬/원격 offset 검사 유지 |
| 전용 저장 요청 | 전체 30회 (chunk 준비/진행/재시도 포함) |
| Google 요청 | 전체 240회 (refresh/재시도/GET/PUT/POST 포함), 호출 전에 카운터 저장 |
| 상태 재조회 | 명시적 전체 재조회 최대 10회 |
| 브라우저 전송 루프 | 한 기록당 한 실행 최대 12회. 서버 전체 한도가 추가 적용 |

Phase 2E-11의 Google 120회 제안은 5MiB 두 파일의 chunk 처리, 소유권 검사, Sheets 확인 및 재조회까지 고려해 **240회로 조정**했다. 무제한 재시도는 없다. 한도는 Vault 내 영속 카운터로 재로그인/인스턴스 교체로 초기화되지 않는다. 한도 도달 시 LIMIT로 중단하며 자동 초기화 기능은 없다.

예약 및 요청량 저장을 기다린 뒤 외부 요청을 시작한다. 저장 실패 시 Google 호출하지 않는다. 거부된 미인증 요청에 대한 전체 서비스 DDoS rate limit은 이 카운터의 범위가 아니다.

## 5. 저장·재조회·복구

- 기존 GoogleStorage / CloudMediaStorage를 재사용한다. 메모 RAW 행 PUT, 미디어 사전 Drive ID 예약, resumable 업로드와 고정 행 예약으로 중복 생성을 방지한다.
- Drive 원본의 소유권, trashed, 크기, SHA-256, payload marker를 확인한다. Sheets는 서버가 보관한 행에서 ID/컨텍스트/본문 또는 파일 참조/revision/mutation/hash를 다시 읽어 일치해야 성공이다.
- 업로드 응답은 `{done, offset}`만 반환한다. done=true 전 Google에서 다시 확인한다.
- `action=status`는 서버 슬롯을 기준으로 원격 GET을 수행한다. 로컬 SYNCED만 보고 성공을 반환하지 않으며 새 폴더/시트를 생성하지 않는다. 단, lease·조회 카운터·필요 refresh는 Vault 저장을 포함한다. 현재 정책상 쓰기 플래그/단일 UID 검사를 공유하므로 writes=false에서는 원격 재조회 버튼도 비활성이다.
- `VERIFIED`, `NOT_UPLOADED`, `PENDING`, `SHEET_PENDING` 상태를 사용한다. 단일 슬롯 확인 중 권한/변조/Google 오류가 나면 성공으로 축소하지 않고 오류를 반환한다.
- Drive 파일 확인 후 Sheets 실패는 `SHEET_PENDING`으로 반환한다. 동일 자료 재시도 시 같은 Drive ID와 예약 행을 사용한다. Google 권한/만료 오류는 REAUTH, 내용 충돌은 CONFLICT, 요청 한도는 LIMIT로 구분한다.
- resource 생성 응답 소실 시 기존 pending marker를 대조하며 새 생성부터 반복하지 않는다. 임대 만료/중단 작업은 기존 fail-closed 정책을 유지하고 자동 lease 강탈/키 교체/Vault 초기화를 하지 않는다.
- IndexedDB의 immutable transfer snapshot을 재사용하고 실패·성공 모두 로컬 원본을 보존한다. 실패 중 편집한 최신 로컬 메모도 오래된 응답으로 덮어쓰지 않는다. 최초 전송 자료 교체는 서버가 거부하므로 이미 예약한 자료를 수정했을 때는 원본/스냅샷 대조가 필요하다.
- 원격 결과 재조회는 **상태·정합성 확인**이다. 원격 바이너리를 새 기기에 다운로드하여 복원하는 기능까지 포함하지 않는다. 파일 내용은 사용자 본인의 Drive/Sheets에서 별도로 열어 검증할 수 있다.
- Sheets 수동 편집의 GET→PUT 경쟁은 원자적 CAS가 아니다. 실증 중 테스트 행을 수동 편집하지 않으며 변조/충돌은 중단 후 대조한다.

## 6. UI

`/v2/storage-test`에 전용 PilotActions를 추가했다.

- 서버에서 계산한 활성화 상태가 있어야 업로드/재시도·원격 재조회 버튼 사용 가능. 단일 사용자 제한은 서버 API에서 다시 검사한다.
- 업로드 중 중복 클릭 차단, 진행/실패/재연결/한도/Drive 성공·Sheets 미완료 문구 표시.
- 성공 후 로컬 보관함을 새로 읽고 원격 저장 확인 상태를 표시. 재방문하면 버튼으로 실제 원격 상태 재확인 가능.
- 로컬에 같은 종류가 여러 건이면 전송 전에 거부하고 원본을 삭제하지 않는다. 자료를 임의 선택하거나 첫 항목만 조용히 전송하지 않는다.
- 쓰기 false에서는 새 버튼도 비활성. 사진·녹음·메모 로컬 기능은 계속 동작.
- Phase 2E-11의 48px 버튼·12~16px 간격·safe area/하단 여백 유지.

## 7. 검증 결과

- 기존 79개 + 신규 8개 = **87/87 단위 테스트 PASS**, skip 0.
- 기존 HTTP 106건 + writes=false 전용 경로 6건 = **112건 PASS**.
- 쓰기 true인 **로컬 fixture만** 사용한 별도 단일 사용자 API/페이지 검사 **10건 PASS**: 비로그인/다른 승인/위조 사용자 차단, 올바른 사용자 빈 원격 상태 응답, owner 위조/Origin 거부, 일반 저장 API 차단, 대상/비대상 UI 구분.
- 총 HTTP **122건 PASS**, 실제 Google 파일 쓰기 0.
- 모바일 모의 **12건 PASS**(320/375/390/430px × 3페이지). 34px safe area 적용, 버튼 겹침/가로 넘침 없음, 48px 이상 및 메모 dialog 회귀.
- Mock 검증: 3종 자료 저장/재조회, 일반 저장소와 격리, 추가 슬롯/변경 payload 거부, Drive 응답 소실+Sheets 실패 복구 후 바이너리 1개/행 1개, 실제 원격 행·파일 변조 거부, 무효 chunk의 리소스 생성 전 차단, 토큰 refresh/invalid_grant, 카운터 저장 실패 시 외부 호출 0, 요청/재조회 한도.
- 브라우저 큐: 재인증 실패 시 원본 유지, 같은 ID 재시도, 완료 기록 중복 전송 없음, 다중 사진 거부 시 원본 유지.
- 타입 검사 PASS, lint 오류 0·기존 RefreshCw 경고 1, 격리 build:vercel PASS.
- 보호 대상 46개 해시 일치. HEAD `9b705f0e7da22e4a698574eef34819c80ed2b968` 유지, Git 스테이징 없음. 이전 Phase 2E-11 변경과 기존 미추적 파일 보존.

실제 Google API/운영 계정/운영 Vault 호출은 하지 않았다. Chrome 모바일 모의 검사는 실제 iPhone Safari 권한·코덱·하단바 검증을 대체하지 않는다. 새 UI 운영 미배포.

## 8. 변경 범위

이번 신규 파일:

- `app/api/v2/storage-test/route.ts`
- `lib/gatherly-2/integration/pilot-storage.ts`
- `lib/gatherly-2/integration/pilot-browser.ts`
- `components/gatherly-2/pilot-actions.tsx`
- `tests/pilot-storage.test.ts`, `tests/pilot-browser.test.ts`, `tests/helpers/pilot-google.ts`
- `scripts/tests/pilot-gate-http.mjs`

기존 파일 추가 변경: runtime의 일반 쓰기 게이트, sync/media 라우트, config 오류 enum, Vault의 선택적 pilot 필드/Drive 확인 플래그, cloud-media의 Drive 확인 저장, storage-test 페이지, field-prototype 보관 목록 갱신/상태 안내, mobile.css 비활성 버튼 표현, HTTP 회귀 스크립트. Phase 2E-11 모바일/단일 UID 코드가 선행 의존성이다.

## 9. 실제 활성화 전 조건과 승인 범위

1. 파일 동의 OAuth Client의 Google Cloud 프로젝트에서 Drive/Sheets API 사용 설정 확인. 최소 scope 유지. 미확인 상태에서 활성화하지 않음.
2. Phase 2E-11+12 코드 검토, 지정 커밋/격리 Production 배포 승인. 이번에는 Commit/Push/배포하지 않음.
3. 서버 단일 GATHERLY_V2_PRODUCTION_WRITE_USER_ID에 본인 UID를 등록하는 승인. 기존 승인 목록과 교집합 유지. 실제 UUID/키는 문서에 기록하지 않음.
4. All Deployments, AUTH_ONLY=true, production namespace, Vault backend/키, 기존 Google OAuth 설정 유지. global writes=true의 빌드·실행 적용은 별도 승인. 빈 승인 목록 override 금지.
5. 실제 작업 승인 범위: 비민감 사진 1장·3~5초 녹음 1건·메모 1건, 최대 4개 폴더·Sheets 1개·바이너리 2개·notes 1행/assets 2행, 정상 토큰 갱신 및 암호화 Vault 테스트 manifest 저장. 공유/삭제/공식 카탈로그 게시 없음.
6. iPhone에서 로컬 3건 준비 → 업로드 → VERIFIED → 새로고침/재방문 후 Google 재조회 → Drive/Sheets 직접 열기로 내용 확인. 같은 요청 재시도 시 파일/행 수 불변 확인. 원본은 삭제하지 않음.
7. 실패/한도/lease 문제는 쓰기 중지 후 기존 ID·해시·행 대조. 서버 카운터나 Vault를 초기화하지 않음. 키 변경/새 자료로 우회 금지. 실증 종료 후 writes=false 복귀도 승인 범위에 포함.

판정: LOCAL_REMOTE_GATE=PASS, GOOGLE_API_ENABLEMENT=UNVERIFIED, PRODUCTION_WRITES=false 유지, ACTUAL_WRITE_APPROVAL=REQUIRED. 실제 쓰기 활성화는 아직 하지 않는다.
