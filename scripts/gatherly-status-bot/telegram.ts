import { config } from "./config.js";

type ApiResponse<T> = {
  ok: boolean;
  result?: T;
  description?: string;
  error_code?: number;
  parameters?: { retry_after?: number };
};

export type TelegramUpdate = {
  update_id: number;
  message?: { message_id: number; chat: { id: number }; from?: { id: number }; text?: string };
  callback_query?: { id: string; from: { id: number }; data?: string; message?: { message_id: number; chat: { id: number } } };
};

async function call<T>(method: string, body: Record<string, unknown>) {
  const response = await fetch(`https://api.telegram.org/bot${config.token}/${method}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(35_000) });
  const data = await response.json().catch(() => null) as ApiResponse<T> | null;
  if (!response.ok || !data?.ok) {
    const code = data?.error_code ?? response.status;
    const description = data?.description ?? response.statusText ?? "unknown error";
    throw new Error(`Telegram ${method} failed (${code}): ${description}`);
  }
  return data.result as T;
}

export function getUpdates(offset?: number) { return call<TelegramUpdate[]>("getUpdates", { offset, timeout: 25, allowed_updates: ["message", "callback_query"] }); }
export function sendMessage(chatId: number, text: string, replyMarkup?: object) { return call("sendMessage", { chat_id: chatId, text, reply_markup: replyMarkup, disable_web_page_preview: true }); }
export function editMessage(chatId: number, messageId: number, text: string, replyMarkup?: object) { return call("editMessageText", { chat_id: chatId, message_id: messageId, text, reply_markup: replyMarkup, disable_web_page_preview: true }); }
export function answerCallbackQuery(callbackId: string, text?: string) { return call("answerCallbackQuery", { callback_query_id: callbackId, text, show_alert: false }); }
