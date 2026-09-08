import { appendFile, mkdir } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { config } from "./config.js";
import { checkApp } from "./status-checks.js";

const execFileAsync = promisify(execFile);
const cooldownMs = 60_000;
export const recoveryLaunchdLabel = "com.gatherly.app";
let running = false;
let lastRecoveryAt = 0;

export function recoveryGateState(isRunning: boolean, previousRecoveryAt: number, now = Date.now()) {
  if (isRunning) return "running" as const;
  if (now - previousRecoveryAt < cooldownMs) return "cooldown" as const;
  return "ready" as const;
}

export function recoveryCommandArgs(uid: number) {
  if (!Number.isInteger(uid) || uid < 0) throw new Error("invalid uid");
  return ["kickstart", "-k", `gui/${uid}/${recoveryLaunchdLabel}`] as const;
}

export async function isAppServiceRegistered() {
  const uid = process.getuid?.();
  if (uid === undefined || !Number.isInteger(uid)) return false;
  try {
    await execFileAsync("/bin/launchctl", ["print", `gui/${uid}/${recoveryLaunchdLabel}`], { timeout: 3_000, windowsHide: true });
    return true;
  } catch { return false; }
}

async function audit(userId: number, result: string) {
  await mkdir("logs", { recursive: true });
  await appendFile(config.auditLogPath, `${new Date().toISOString()} user=${userId} recovery=${result}\n`, { mode: 0o600 });
}

export async function requestRecovery() {
  if (!(await isAppServiceRegistered())) return { kind: "unavailable" as const };
  const current = await checkApp();
  if (current.details?.httpStatus && current.details.httpStatus >= 200 && current.details.httpStatus < 300) return { kind: "healthy" as const };
  const gate = recoveryGateState(running, lastRecoveryAt);
  if (gate === "running") return { kind: "running" as const };
  if (gate === "cooldown") return { kind: "cooldown" as const, remainingSeconds: Math.ceil((cooldownMs - (Date.now() - lastRecoveryAt)) / 1_000) };
  return { kind: "confirm" as const };
}

export async function executeRecovery(userId: number) {
  const gate = recoveryGateState(running, lastRecoveryAt);
  if (gate === "running") return { ok: false, message: "이미 복구를 확인 중입니다." };
  if (gate === "cooldown") return { ok: false, message: "복구 요청 cooldown 중입니다." };
  const current = await checkApp();
  if (current.details?.httpStatus && current.details.httpStatus >= 200 && current.details.httpStatus < 300) return { ok: true, message: "이미 정상 실행 중입니다." };
  running = true;
  lastRecoveryAt = Date.now();
  try {
    const uid = process.getuid?.();
    if (uid === undefined || !Number.isInteger(uid)) throw new Error("unsupported platform");
    // Fixed executable, fixed command, and fixed service label. No Telegram input reaches this call.
    await execFileAsync("/bin/launchctl", recoveryCommandArgs(uid), { timeout: 10_000, windowsHide: true });
    let last = await checkApp();
    for (let attempt = 0; attempt < 5 && !(last.details?.httpStatus && last.details.httpStatus < 300); attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 3_000));
      last = await checkApp();
    }
    const success = Boolean(last.details?.httpStatus && last.details.httpStatus < 300);
    await audit(userId, success ? "success" : "health_failed");
    return { ok: success, message: success ? `복구 완료 · ${last.details?.responseMs ?? "?"}ms` : "복구 후에도 앱 상태를 확인하지 못했습니다." };
  } catch {
    await audit(userId, "kickstart_failed").catch(() => undefined);
    return { ok: false, message: "복구를 시작하지 못했습니다. 로컬 launchd 설정을 확인해 주세요." };
  } finally { running = false; }
}
