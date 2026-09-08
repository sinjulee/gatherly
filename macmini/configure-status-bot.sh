#!/bin/sh
# Gatherly 전용 상태 봇 비밀값 설정 도우미. 입력값은 화면에 다시 출력하지 않습니다.
set -eu

CONFIG_DIR="/Users/sinjulee/.config/gatherly"
ENV_FILE="$CONFIG_DIR/status-bot.env"

printf '%s\n' "Gatherly 전용 Telegram 상태 봇 설정"
printf '%s' "BotFather 토큰을 입력하세요 (입력 내용 숨김): "
stty -echo
trap 'stty echo' EXIT HUP INT TERM
IFS= read -r BOT_TOKEN
stty echo
trap - EXIT HUP INT TERM
printf '\n%s' "Telegram 숫자 user ID를 입력하세요: "
IFS= read -r ALLOWED_USER_ID

if [ -z "$BOT_TOKEN" ]; then
  printf '%s\n' "토큰은 비워 둘 수 없습니다." >&2
  exit 1
fi
if ! printf '%s' "$BOT_TOKEN" | grep -Eq '^[0-9]+:[A-Za-z0-9_-]+$'; then
  printf '%s\n' "BotFather 토큰 형식이 올바르지 않습니다." >&2
  exit 1
fi
if ! printf '%s' "$ALLOWED_USER_ID" | grep -Eq '^[0-9]+$'; then
  printf '%s\n' "user ID는 숫자만 입력해야 합니다." >&2
  exit 1
fi

umask 077
mkdir -p "$CONFIG_DIR"
TEMP_FILE=$(mktemp "$CONFIG_DIR/status-bot.env.XXXXXX")
trap 'rm -f "$TEMP_FILE"' EXIT HUP INT TERM
printf '%s\n' \
  "GATHERLY_TELEGRAM_BOT_TOKEN=\"$BOT_TOKEN\"" \
  "GATHERLY_TELEGRAM_ALLOWED_USER_ID=\"$ALLOWED_USER_ID\"" \
  "GATHERLY_APP_HEALTH_URL=\"http://127.0.0.1:3001/api/health\"" \
  "GATHERLY_ACCESS_URL=\"\"" \
  "GATHERLY_STORAGE_PATH=\"\"" \
  "GATHERLY_LOG_PATH=\"\"" \
  "GATHERLY_DISK_WARN_PERCENT=\"80\"" \
  "GATHERLY_DISK_CRITICAL_PERCENT=\"90\"" \
  "GATHERLY_HEALTH_TIMEOUT_MS=\"5000\"" \
  "GATHERLY_HEALTH_SLOW_MS=\"2000\"" > "$TEMP_FILE"
chmod 600 "$TEMP_FILE"
mv "$TEMP_FILE" "$ENV_FILE"
trap - EXIT HUP INT TERM
printf '%s\n' "저장했습니다: ~/.config/gatherly/status-bot.env (권한 600)"
printf '%s\n' "다음으로 npm run bot:status:check 를 실행해 Telegram 전송 없이 점검하세요."
