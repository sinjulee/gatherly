# 사용자 선택 우선 로컬 삭제

2026-10-18 · 로컬 구현 및 검증 완료 · Production 미반영

## 정책과 원인

기존 `deletePilotLocal`은 전송 snapshot이 있거나 attempts>0 또는 LOCAL_PENDING 이외 상태이면 SYNCED를 제외하고 삭제를 거부했다. 사용자가 보고한 FAILED_RETRYABLE 녹음은 이 조건에 해당했다. 터치 문제가 아니라 확인 이후 저장소 정책에 따른 거부였다.

UNKNOWN 삭제 금지, 외부 백업 확인, 파일 SHA-256 일치 확인을 필수로 요구하던 설계를 폐기했다. 기존 휴지통에서 복구 불가 위험을 읽고 최종 확인하면 미전송·전송 실패·원격 결과 미확인 자료를 삭제할 수 있다. REMOTE_UNKNOWN은 별도 SyncState 추가 없이 전송 이력과 미완료 상태로 판정한다. SYNCED도 로컬 삭제만 수행한다.

확인창은 영구 복구 불가 가능성, Google에 파일이 남아 있을 가능성, Google Drive·Sheets 삭제가 아니라는 점, 기존 실증 슬롯 교체 제한을 안내한다. 취소하면 저장소를 변경하지 않는다. 실제 사용자 iPhone 자료를 개발 과정에서 삭제하지 않았다.

## 구현

- `components/gatherly-2/field-prototype.tsx`: 기존 휴지통과 48px 터치 영역 유지. 공통 위험 확인창, 전송 종료 대기 안내, 삭제 후 즉시 목록 제거와 업로드 상태 재계산. 실패는 카드에 표시한다. 삭제 완료 후 목록 재조회만 실패한 경우에는 삭제 실패로 오인하지 않도록 따로 안내한다.
- `lib/gatherly-2/browser-storage.ts`: 삭제 함수 안에서 업로더와 같은 사용자별 Web Lock을 획득한다. 활성 전송과 후처리가 종료될 때까지 기다리고 30초 안에 잠금을 얻지 못하면 원본을 유지한다. 잠금 미지원, 소유자 불일치, revision 변경, 트랜잭션 실패도 삭제하지 않는다. 화면의 uploading 문자열만으로 진행 중 여부를 단정하지 않는다.
- 단일 IndexedDB readwrite 트랜잭션에서 queue, transfer snapshot, 메모 본문 및 초안, 해당 기존 삭제 표식을 정리하고 새 삭제 표식을 기록한다. 중간 실패 시 모두 롤백한다. Google 원격 API 호출은 없다.
- 삭제 표식 키는 로컬 context의 SHA-256 digest다. 미전송 자료는 빈 객체만 저장한다. 전송 이력이 있는 자료는 사용자 digest, 종류, 슬롯 예약 여부만 추가한다. 원본 Blob·텍스트·파일명·원래 operation ID·명시적 UID·Google 파일 ID·토큰·암호문은 저장하지 않는다. 이 digest는 복원 방지를 위한 가명 식별 표식이며 원본 백업이나 파일 검증 조건이 아니다.
- `put`은 삭제 표식을 확인해 늦은 큐 쓰기를 거부한다. `finishTransfer`는 삭제된 queue의 snapshot을 재생성하지 않는다. `transfer`도 삭제된 자료 전송을 거부한다. 상태 복구 함수는 존재하지 않는 queue를 다시 만들지 않는다.
- `lib/gatherly-2/pilot-ui.ts`: 전송 이력 자료를 로컬 삭제해도 원격 1건 슬롯을 초기화하지 않는다. UNKNOWN을 완료로 표시하지 않으며, 해당 실증의 교체·재전송을 차단하는 이유를 안내한다. 아직 전송하지 않은 로컬 자료는 새 자료로 준비할 수 있다. 로컬 삭제 허용과 원격 쓰기 허용은 별개다.
- `lib/gatherly-2/integration/pilot-browser.ts`: 오류 문구의 일률적인 삭제 금지를 제거하고 위험 확인 후 로컬 삭제를 선택할 수 있도록 안내한다. 단일 Production UID·종류별 1건·Google Writes 게이트 코드는 변경하지 않았다.

DB 이름/version 1/records store를 그대로 사용하며 버전 업그레이드나 일괄 마이그레이션이 없다. 기존 SYNCED 삭제 표식은 읽기 호환을 유지한다. 새 삭제 경로만 최소 표식을 생성한다. 전송 이력 원문 보관 기능은 추가하지 않았다. 삭제 후 앱에 남는 표식으로는 녹음 복원이나 기존 operation을 이용한 정밀 원격 대조가 불가능하므로 이를 복구 수단으로 취급하지 않는다.

브라우저 Web Lock 해제는 해당 브라우저의 전송 작업 종료를 뜻하며 Google 저장 성공/부재를 증명하지 않는다. 네트워크 실패 후 서버의 원격 결과가 불명확해도 UNKNOWN을 유지한다. 이번 제품 정책에 따라 위험 확인 후 로컬 삭제는 허용한다.

## 검증 결과

| 항목 | 결과 |
| --- | --- |
| 단위 테스트 | 124/124 PASS, skip 0 |
| HTTP 회귀 | 122/122 PASS (동의 UI off/on 각 56, 쓰기 정책 fixture 10) |
| 모바일 모의 | 12화면 PASS, 320/375/390/430px, 터치·Safe Area |
| 타입 검사 | PASS |
| 린트 | 오류 0, 기존 RefreshCw 미사용 경고 1 |
| 격리 Next.js 빌드 | PASS, 빌드 Google Writes=false |
| git diff --check | PASS |
| 보호 자료 | 기존 manifest 46/46 SHA-256 일치 |

테스트는 fake-indexeddb, 가짜 사용자/토큰, localhost 모의 API, 임시 Chrome 프로필만 사용했다. HTTP 쓰기 허용 분기는 가짜 서버 환경으로 검사하며 실제 Google 쓰기는 0건이다. 격리 빌드는 환경파일·SQLite·개인 자료·원본 지도 없이 수행했다.

검증한 사례:

- FAILED_RETRYABLE 녹음(시도 2회, revision 1) 삭제 및 DB 재개방 후 부재 확인.
- 원격 UNKNOWN 확인창의 복구 불가·원격 잔존·로컬/원격 구분 문구, 취소 시 유지.
- 사진·녹음·메모 삭제, 메모 본문/초안/snapshot 정리, 삭제 후 버튼 상태 갱신.
- 활성 업로드 잠금 동안 원본 유지 → 전송 후처리 완료 → 삭제. 잠금 timeout 시 원본 유지.
- 늦은 성공/실패 callback, 큐 put, transfer에 의한 부활 차단.
- IndexedDB 삭제 트랜잭션 abort 시 원본 유지 및 삭제 표식 롤백.
- 삭제 표식에 원본·명시적 식별자·민감 payload가 없는지 검사.
- 새로고침 후 삭제 결과 및 원격 교체 차단 유지.

모바일 검사의 최초 실패는 새로고침 직후 비동기 안내 로딩을 기다리지 않은 테스트 타이밍 때문이었다. 안내 로딩 완료를 기다리도록 수정 후 통과했다. 실제 iPhone Safari 검증을 대신하지 않는다. 향후 승인된 배포 이후 휴지통 취소/확인, 실패 녹음 삭제, 새로고침, Safari 하단 UI, 전송 대기 안내를 실기기에서 확인해야 한다.

## 변경 범위 및 보존

현재 브랜치 `gatherly-v2-preview`, HEAD `fe02c866` 유지. 기존 미커밋 수정사항 위에 이번 변경을 적용했고 `.gitignore`의 기존 수정은 그대로 보존했다.

이번 관련 파일은 위 제품 코드 4개, `tests/pilot-ui.test.ts`, `scripts/tests/v2-mobile-browser.mjs`, 이 보고서 및 대체 정책을 명시한 `FAILED_RECORD_LOCAL_ARCHIVE_PLAN.md`다. 이전 14F 로컬 상태 진단 코드도 보존했다.

Google Writes 운영 설정 변경 없음(기존 false 정책 유지). 환경변수·Google 원격 파일·SQLite·운영 SQL·Vault·키·master 변경 없음. Commit/Push/Production 배포 없음. 실제 사용자 로컬 자료에는 접근하지 않았다. 배포와 실제 iPhone 삭제는 실행하지 않았으며 별도 사용자 선택/승인이 필요하다.
