# Gatherly 2.0 v0.5 — 개발 착수 안내

## 적용 경로
`/Users/sinjulee/Projects/Gatherly/docs/gatherly-2.0/`

## 맥미니 적용 명령
```bash
cd /Users/sinjulee/Projects/Gatherly
git status --short
git branch --show-current
unzip -n ~/Downloads/Gatherly_2.0_v0.5_DevPack.zip -d /Users/sinjulee/Projects/Gatherly
ls -la docs/gatherly-2.0
```

> `unzip -n`: 기존 같은 이름의 파일은 덮어쓰지 않습니다. 기존 같은 이름 문서가 있으면 먼저 비교해 주세요.

## 문서 열기 순서
1. Gatherly_2.0_PRD_v0.5.md — 제품 범위
2. Gatherly_2.0_SRS_v0.5.md — 요구·데이터 구조
3. Gatherly_2.0_v0.5_CHANGELOG.md — 변경 이력
4. Gatherly_2.0_Development_Kickoff_v0.5.md — Codex 실행 지시

## Phase 0 시작
코드 변경 전에 Codex에게 `Gatherly_2.0_Development_Kickoff_v0.5.md` 내의 통합 프롬프트를 실행하도록 요청하세요. 첫 단계는 READ-ONLY AUDIT로, 기존 DB 및 코드를 보존해야 합니다.

### 생성 예정 문서 (아직 생성되지 않음)
- docs/gatherly-2.0/PHASE_0_AUDIT.md
- docs/gatherly-2.0/PHASE_1_PLAN.md

### 안전 경계
원본 SQLite 및 FieldDay 자료 삭제 금지. 실 운영 Supabase, Google Drive/Sheets, 배포, Git commit/push 등은 별도 승인 전 실행 금지.
실제 부스배치도는 참고 원본이며, 목업의 가상 기업/부스 표기를 공식 데이터로 사용하지 않습니다.
