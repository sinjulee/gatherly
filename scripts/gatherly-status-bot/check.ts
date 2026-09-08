import { config } from "./config.js";
import { recoveryCommandArgs, recoveryGateState, recoveryLaunchdLabel } from "./recovery.js";
import { isAllowedCallback, isAllowedUserId, maskSensitive } from "./security.js";
import { appLevel, checkApp, checkDatabase, checkDatabaseAt, checkStorage, checkStorageAt, checkSystem, collectStatus, diskLevel } from "./status-checks.js";
import { dashboardText } from "./status-message.js";

function assert(condition: unknown, message: string) { if (!condition) throw new Error(message); }

async function main() {
  // Pure local safety checks: no Telegram API method is imported or invoked here.
  assert(isAllowedUserId(1234, "1234"), "허용 사용자 판정 실패");
  assert(!isAllowedUserId(1235, "1234"), "비허용 사용자가 통과했습니다");
  assert(isAllowedCallback("recover:confirm") && !isAllowedCallback("recover:confirm:anything"), "callback allow-list 실패");
  assert(!maskSensitive("Authorization: Bearer abcdefghijklmnopqrstuvwxyz; /Users/demo/prisma/dev.db").includes("abcdefghijklmnopqrstuvwxyz"), "민감정보 마스킹 실패");
  assert(appLevel(true, 1) === "ok" && appLevel(false, 1) === "error", "앱 정상/중단 분류 실패");
  assert(diskLevel(config.diskWarnPercent) === "warning" && diskLevel(config.diskCriticalPercent) === "error", "디스크 경고 기준 분류 실패");
  assert(recoveryGateState(true, 0) === "running" && recoveryGateState(false, Date.now()) === "cooldown", "중복/연속 복구 차단 실패");
  assert(recoveryCommandArgs(501).join(" ") === `kickstart -k gui/501/${recoveryLaunchdLabel}` && recoveryLaunchdLabel === "com.gatherly.app", "고정 launchd label 검증 실패");
  assert((await checkDatabaseAt("/private/tmp/gatherly-status-bot-no-db.sqlite")).level === "error", "SQLite 실패 mock 분류 실패");
  assert((await checkStorageAt("/private/tmp/gatherly-status-bot-no-storage")).level === "error", "저장소 권한/경로 오류 분류 실패");
  const status = await collectStatus();
  assert(dashboardText(status).includes("Gatherly · Mac mini"), "상태 메시지 생성 실패");
  console.log("Gatherly 상태 봇 dry-run (Telegram 전송 없음)");
  console.log(dashboardText(status));
  console.log("\n검증: 허용 사용자 · callback allow-list · 민감정보 마스킹 · 상태 메시지 · 앱 정상/중단 mock · SQLite/저장소 오류 mock · 디스크 기준 · 복구 cooldown/고정 label 통과");
  console.log(`개별 점검: 앱=${(await checkApp()).level}, DB=${(await checkDatabase()).level}, 저장소=${(await checkStorage()).level}, 시스템=${(await checkSystem()).level}`);
  console.log(`설정 기준: 디스크 주의 ${config.diskWarnPercent}% / 위험 ${config.diskCriticalPercent}%, 앱 지연 ${config.healthSlowMs}ms / timeout ${config.healthTimeoutMs}ms`);
  process.exitCode = status.overall === "error" ? 2 : status.overall === "warning" || status.overall === "unknown" ? 1 : 0;
}

void main().catch(() => { console.error("dry-run 검증 실패 (민감정보는 출력하지 않습니다)."); process.exitCode = 2; });
