import { timingSafeEqual } from "node:crypto";

export const callbackActions = ["refresh", "app", "database", "storage", "system", "errors", "recover:check", "recover:confirm", "recover:cancel"] as const;
export type CallbackAction = (typeof callbackActions)[number];

export function isAllowedUserId(value: unknown, allowedUserId: string) {
  if (!allowedUserId || typeof value !== "number" || !Number.isSafeInteger(value)) return false;
  const candidate = Buffer.from(String(value));
  const expected = Buffer.from(allowedUserId);
  return candidate.length === expected.length && timingSafeEqual(candidate, expected);
}

export function isAllowedCallback(value: unknown): value is CallbackAction {
  return typeof value === "string" && (callbackActions as readonly string[]).includes(value);
}

export function maskSensitive(value: string, maxLength = 180) {
  return value
    .replace(/(bot\d{5,}:[A-Za-z0-9_-]{20,})/gi, "[BOT_TOKEN]")
    .replace(/(authorization\s*[:=]\s*)(bearer\s+)?[^\s,;]+/gi, "$1[REDACTED]")
    .replace(/(cookie\s*[:=]\s*)[^\r\n]+/gi, "$1[REDACTED]")
    .replace(/(api[_-]?key|token|secret|password)\s*[:=]\s*[^\s,;]+/gi, "$1=[REDACTED]")
    .replace(/(?:file:)?\/?(?:Users|private|var|opt)\/[^\s,:"')]+/g, "[PATH]")
    .replace(/(?:[A-Za-z0-9._-]+\/)+[A-Za-z0-9._-]+\.(?:db|sqlite|jpg|jpeg|png|heic|mov|mp4|m4a|mp3|wav|webm)/gi, "[FILE]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}
