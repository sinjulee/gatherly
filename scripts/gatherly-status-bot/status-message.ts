import { config } from "./config.js";
import { formatBytes, formatDuration, statusBotUptime } from "./status-checks.js";
import type { DashboardStatus, StatusLevel } from "./types.js";

function icon(level: StatusLevel) {
  return { ok: "🟢", warning: "🟡", error: "🔴", unknown: "⚪" }[level];
}

function overallName(level: StatusLevel) {
  return { ok: "정상", warning: "주의", error: "오류", unknown: "확인 불가" }[level];
}

function kst(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(date);
  const value = (name: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === name)?.value || "00";
  return `${value("year")}-${value("month")}-${value("day")} ${value("hour")}:${value("minute")} KST`;
}

export function dashboardText(status: DashboardStatus) {
  const system = status.system.details;
  const database = status.database.details;
  const storage = status.storage.details;
  const memory = system?.memoryTotalBytes ? `${formatBytes(system.memoryTotalBytes - (system.memoryAvailableBytes || 0))} / ${formatBytes(system.memoryTotalBytes)}` : "확인 불가";
  const disk = system?.diskAvailableBytes !== undefined && system.diskUsedPercent !== undefined ? `${formatBytes(system.diskAvailableBytes)} · ${100 - system.diskUsedPercent}% 여유` : "확인 불가";
  const records = database ? `${(database.fieldDays || 0) + (database.materials || 0)}건` : "확인 불가";
  const stored = storage ? `${storage.files || 0}개 · ${formatBytes(storage.bytes)}` : "확인 불가";
  return [
    "🖥 Gatherly · Mac mini",
    "",
    `전체 상태: ${icon(status.overall)} ${overallName(status.overall)}`,
    "",
    `🌐 Gatherly 앱       ${icon(status.app.level)} ${status.app.summary}`,
    `🗄 SQLite DB         ${icon(status.database.level)} ${status.database.summary}`,
    `📁 자료 저장소       ${icon(status.storage.level)} ${status.storage.summary}`,
    `💾 디스크 여유       ${disk}`,
    `🧠 메모리 사용       ${memory}`,
    `⏱ Mac 가동시간      ${system?.uptimeSeconds !== undefined ? formatDuration(system.uptimeSeconds) : "확인 불가"}`,
    `📦 저장 자료         ${records} · ${stored}`,
    `🕐 마지막 확인       ${kst(status.checkedAt)}`,
  ].join("\n");
}

export function systemDetailText(status: DashboardStatus) {
  const details = status.system.details;
  if (!details) return "💻 시스템 정보\n\n⚪ 확인할 수 없습니다.";
  return ["💻 시스템 정보", "", `💾 디스크: ${formatBytes(details.diskAvailableBytes)} 여유 · ${details.diskUsedPercent}% 사용`, `🧠 메모리: ${formatBytes(details.memoryTotalBytes! - details.memoryAvailableBytes!)} / ${formatBytes(details.memoryTotalBytes)}`, `⏱ Mac 가동시간: ${formatDuration(details.uptimeSeconds)}`, `📈 Load average: ${(details.loadAverage || []).map((value) => value.toFixed(2)).join(" / ") || "확인 불가"}`, `🟩 Node.js: ${process.version}`, `🤖 상태 봇 가동시간: ${formatDuration(statusBotUptime())}`].join("\n");
}

export function errorDetailText(status: DashboardStatus) {
  const entries = status.errors.details || [];
  return entries.length ? `📋 최근 오류\n\n${entries.map((entry, index) => `${index + 1}. ${entry}`).join("\n")}` : `📋 최근 오류\n\n${status.errors.summary}`;
}

export function checkingText() { return "🔄 확인 중…\n\n잠시만 기다려 주세요."; }

export function helpText() {
  return ["Gatherly 상태 봇 도움말", "", "/start · 사용 안내와 상태 대시보드", "/status · 최신 상태 대시보드", "/help · 명령과 상태 의미", "", "상태: 🟢 정상 · 🟡 주의 · 🔴 오류 · ⚪ 확인 불가", "", "Gatherly 앱만 중단된 경우, com.gatherly.app launchd 서비스가 등록되어 있으면 ‘🛠 Gatherly 앱 복구’를 사용할 수 있습니다. 상태 봇까지 응답하지 않으면 맥미니 전원·인터넷·상태 봇 자체 문제일 수 있습니다. 맥미니 전원이 완전히 꺼진 상태에서는 이 봇으로 전원을 켤 수 없습니다."] .join("\n");
}

export function dashboardKeyboard(includeRecovery = true) {
  const rows: Array<Array<{ text: string; callback_data?: string; url?: string }>> = [
    [{ text: "🔄 새로고침", callback_data: "refresh" }, { text: "🌐 앱 상태", callback_data: "app" }],
    [{ text: "🗄 DB 상태", callback_data: "database" }, { text: "📁 저장소 상태", callback_data: "storage" }],
    [{ text: "💻 시스템 정보", callback_data: "system" }, { text: "📋 최근 오류", callback_data: "errors" }],
  ];
  if (includeRecovery) rows.push([{ text: "🛠 Gatherly 앱 복구", callback_data: "recover:check" }]);
  if (config.accessUrl) rows.push([{ text: "Gatherly 열기", url: config.accessUrl }]);
  return { inline_keyboard: rows };
}

export function recoveryKeyboard() {
  return { inline_keyboard: [[{ text: "복구 실행", callback_data: "recover:confirm" }, { text: "취소", callback_data: "recover:cancel" }]] };
}
