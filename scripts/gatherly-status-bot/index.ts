import { mkdir, open, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { config } from "./config.js";
import { executeRecovery, isAppServiceRegistered, requestRecovery } from "./recovery.js";
import { isAllowedCallback, isAllowedUserId } from "./security.js";
import { collectStatus } from "./status-checks.js";
import { checkingText, dashboardKeyboard, dashboardText, errorDetailText, helpText, recoveryKeyboard, systemDetailText } from "./status-message.js";
import { answerCallbackQuery, editMessage, getUpdates, sendMessage, type TelegramUpdate } from "./telegram.js";

const statePath = path.join(config.projectRoot, "logs", "status-bot-offset.json");
const lockPath = path.join(config.projectRoot, "logs", "status-bot.lock");
let stopping = false;

async function loadOffset() {
  try { const data = JSON.parse(await readFile(statePath, "utf8")); return Number.isSafeInteger(data.offset) ? data.offset : undefined; } catch { return undefined; }
}

async function saveOffset(offset: number) {
  await writeFile(statePath, JSON.stringify({ offset }), { mode: 0o600 });
}

async function claimLock() {
  await mkdir(path.dirname(lockPath), { recursive: true });
  try {
    const handle = await open(lockPath, "wx", 0o600);
    await handle.writeFile(String(process.pid));
    await handle.close();
  } catch {
    const oldPid = Number((await readFile(lockPath, "utf8").catch(() => "0")).trim());
    if (!Number.isSafeInteger(oldPid) || oldPid <= 0) {
      await rm(lockPath, { force: true });
      return claimLock();
    }
    try { process.kill(oldPid, 0); } catch { await rm(lockPath, { force: true }); return claimLock(); }
    throw new Error("Gatherly 상태 봇이 이미 실행 중입니다.");
  }
}

async function editDashboard(chatId: number, messageId: number) {
  await editMessage(chatId, messageId, checkingText(), dashboardKeyboard(false)).catch(() => undefined);
  const status = await collectStatus();
  const recoveryAvailable = await isAppServiceRegistered();
  await editMessage(chatId, messageId, dashboardText(status), dashboardKeyboard(recoveryAvailable)).catch(() => undefined);
  return status;
}

async function handleMessage(update: TelegramUpdate) {
  const message = update.message;
  if (!message || !isAllowedUserId(message.from?.id, config.allowedUserId)) return;
  const command = message.text?.trim().split(/\s+/)[0]?.split("@")[0];
  if (command === "/start" || command === "/status") {
    const status = await collectStatus();
    await sendMessage(message.chat.id, dashboardText(status), dashboardKeyboard(await isAppServiceRegistered()));
  } else if (command === "/help") {
    await sendMessage(message.chat.id, helpText());
  }
}

async function handleCallback(update: TelegramUpdate) {
  const callback = update.callback_query;
  if (!callback || !isAllowedUserId(callback.from.id, config.allowedUserId) || !isAllowedCallback(callback.data)) return;
  // Always clear Telegram's loading spinner for permitted callbacks, even if a later check fails.
  await answerCallbackQuery(callback.id).catch(() => undefined);
  const message = callback.message;
  if (!message) return;
  const { id: chatId } = message.chat;
  const messageId = message.message_id;

  if (callback.data === "recover:check") {
    await editMessage(chatId, messageId, checkingText(), dashboardKeyboard(false)).catch(() => undefined);
    const recovery = await requestRecovery();
    if (recovery.kind === "unavailable") return void editMessage(chatId, messageId, "⚪ 자동 복구 서비스가 아직 설정되지 않았습니다. launchd에 com.gatherly.app을 등록한 뒤 다시 확인해 주세요.", dashboardKeyboard(false)).catch(() => undefined);
    if (recovery.kind === "healthy") return void editMessage(chatId, messageId, "🟢 Gatherly 앱은 이미 정상 실행 중입니다. 복구 작업은 실행하지 않았습니다.", dashboardKeyboard()).catch(() => undefined);
    if (recovery.kind === "running") return void editMessage(chatId, messageId, "🟡 다른 복구 작업이 진행 중입니다.", dashboardKeyboard()).catch(() => undefined);
    if (recovery.kind === "cooldown") return void editMessage(chatId, messageId, `🟡 ${recovery.remainingSeconds}초 후에 다시 복구를 요청할 수 있습니다.`, dashboardKeyboard()).catch(() => undefined);
    return void editMessage(chatId, messageId, "⚠️ Gatherly 앱 응답 이상이 확인되었습니다. 앱 프로세스만 복구할까요?", recoveryKeyboard()).catch(() => undefined);
  }

  if (callback.data === "recover:cancel") {
    await editDashboard(chatId, messageId);
    return;
  }

  if (callback.data === "recover:confirm") {
    await editMessage(chatId, messageId, "🛠 Gatherly 앱 복구를 실행하고 상태를 확인 중입니다…", dashboardKeyboard()).catch(() => undefined);
    const result = await executeRecovery(callback.from.id);
    const refreshed = await collectStatus();
    await editMessage(chatId, messageId, `${result.ok ? "🟢" : "🔴"} ${result.message}\n\n${dashboardText(refreshed)}`, dashboardKeyboard()).catch(() => undefined);
    return;
  }

  if (callback.data === "system" || callback.data === "errors") {
    await editMessage(chatId, messageId, checkingText(), dashboardKeyboard()).catch(() => undefined);
    const status = await collectStatus();
    await editMessage(chatId, messageId, callback.data === "system" ? systemDetailText(status) : errorDetailText(status), dashboardKeyboard()).catch(() => undefined);
    return;
  }
  await editDashboard(chatId, messageId);
}

async function processUpdate(update: TelegramUpdate) {
  try {
    if (update.message) await handleMessage(update);
    if (update.callback_query) await handleCallback(update);
  } catch {
    // Keep long polling alive; never include Telegram data, token, or local paths in logs.
    console.error("[status-bot] update 처리 중 오류가 발생했습니다.");
  }
}

async function main() {
  if (!config.token) throw new Error("GATHERLY_TELEGRAM_BOT_TOKEN이 설정되지 않았습니다. configure-status-bot.sh를 다시 실행해 주세요.");
  if (!/^\d+$/.test(config.allowedUserId)) throw new Error("GATHERLY_TELEGRAM_ALLOWED_USER_ID는 숫자 Telegram user ID여야 합니다.");
  await claimLock();
  let offset = await loadOffset();
  let retryMs = 1_000;
  while (!stopping) {
    try {
      const updates = await getUpdates(offset);
      retryMs = 1_000;
      for (const update of updates) {
        await processUpdate(update);
        offset = update.update_id + 1;
        await saveOffset(offset);
      }
    } catch (error) {
      console.error("[status-bot] 처리 오류. 재시도합니다.", error);
      await new Promise((resolve) => setTimeout(resolve, retryMs));
      retryMs = Math.min(retryMs * 2, 30_000);
    }
  }
}

async function shutdown(signal: string) {
  stopping = true;
  console.info(`[status-bot] ${signal} 수신, 종료합니다.`);
  await rm(lockPath, { force: true }).catch(() => undefined);
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("unhandledRejection", () => console.error("[status-bot] 처리되지 않은 Promise 오류"));
process.on("uncaughtException", () => console.error("[status-bot] 처리되지 않은 예외"));

void main().catch(async (error) => {
  const message = error instanceof Error ? error.message : "알 수 없는 시작 오류";
  // Startup errors are fixed local messages only; do not print environment values or paths.
  console.error(`[status-bot] 시작할 수 없습니다: ${message}`);
  await shutdown("startup failure");
  process.exitCode = 1;
});
