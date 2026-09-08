#!/bin/sh
set -eu
cd /Users/sinjulee/Projects/Gatherly
set -a
[ -f .env ] && . ./.env
[ -f /Users/sinjulee/.config/gatherly/status-bot.env ] && . /Users/sinjulee/.config/gatherly/status-bot.env
set +a
exec /opt/homebrew/bin/node node_modules/.bin/tsx scripts/gatherly-status-bot/index.ts
