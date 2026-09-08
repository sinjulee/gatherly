#!/bin/sh
set -eu
cd /Users/sinjulee/Projects/Gatherly
set -a
[ -f .env ] && . ./.env
set +a
exec /opt/homebrew/bin/node node_modules/next/dist/bin/next start -H 127.0.0.1 -p 3001
