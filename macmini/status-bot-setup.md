# Gatherly 전용 Telegram 상태 봇 설치 안내

이 문서는 `com.gatherly.statusbot`과 `com.gatherly.app`을 서로 분리해 설치하는 절차입니다. 아직 이 저장소는 `launchctl` 등록이나 서버 재시작을 수행하지 않습니다. 상태 봇은 webhook이나 공개 포트를 사용하지 않고 Telegram `getUpdates` long polling만 사용합니다.

## 1. Gatherly 전용 BotFather 봇 만들기

Telegram에서 **@BotFather**에게 `/newbot`을 보내고, Contentory 봇과 다른 이름과 username으로 새 봇을 만듭니다. BotFather가 보여 주는 토큰은 한 번만 복사해 아래의 전용 환경 파일에 넣습니다. Contentory 토큰·프로세스·launchd label을 재사용하지 않습니다.

## 2. 비밀 환경 파일과 권한

토큰은 plist, Git, README, `.env.example`에 넣지 않습니다. 맥미니에서 다음 파일만 상태 봇이 읽도록 만듭니다.

```sh
mkdir -p ~/.config/gatherly
chmod 700 ~/.config/gatherly
touch ~/.config/gatherly/status-bot.env
chmod 600 ~/.config/gatherly/status-bot.env
```

가장 안전한 방법은 아래 도우미를 실행해 토큰과 숫자 ID를 터미널에서 직접 입력하는 것입니다. 토큰 입력은 화면에 표시되지 않으며, 스크립트는 값을 다시 출력하지 않습니다.

```sh
cd /Users/sinjulee/Projects/Gatherly
sh macmini/configure-status-bot.sh
```

`~/.config/gatherly/status-bot.env` 예시(필요 시 수동 편집):

```sh
GATHERLY_TELEGRAM_BOT_TOKEN=""
GATHERLY_TELEGRAM_ALLOWED_USER_ID=""
GATHERLY_APP_HEALTH_URL="http://127.0.0.1:3001/api/health"
GATHERLY_ACCESS_URL=""
GATHERLY_STORAGE_PATH=""
GATHERLY_LOG_PATH=""
GATHERLY_DISK_WARN_PERCENT="80"
GATHERLY_DISK_CRITICAL_PERCENT="90"
GATHERLY_HEALTH_TIMEOUT_MS="5000"
GATHERLY_HEALTH_SLOW_MS="2000"
```

공통 `DATABASE_URL`, `STORAGE_ROOT`는 프로젝트 `.env`에 둡니다. 래퍼는 `.env`와 위의 전용 파일을 읽지만, 상태 봇 토큰은 전용 파일에만 둡니다.

## 3. Telegram 숫자 user ID 확인

숫자 ID를 알려 주는 신뢰 가능한 ID 확인 봇에 본인 계정으로 메시지를 보내거나, Bot API의 `getUpdates` 결과에서 `message.from.id`를 확인합니다. username은 인증 수단이 아닙니다. 얻은 숫자 하나만 `GATHERLY_TELEGRAM_ALLOWED_USER_ID`에 넣습니다. 다른 사용자의 메시지와 callback은 응답하거나 점검하지 않습니다.

## 4. 실행 전 준비와 dry-run

```sh
cd /Users/sinjulee/Projects/Gatherly
npm install
npm run db:generate
npm run build
npm run bot:status:check
```

`bot:status:check`는 Telegram API를 호출하거나 메시지를 보내지 않습니다. 실제 앱·DB·저장소를 읽기 전용으로 확인하고, 저장소는 `uploads` 안의 임시 점검 파일을 즉시 삭제합니다. 종료 코드는 `0=정상`, `1=주의 또는 확인 불가`, `2=오류`입니다.

직접 실행은 전용 환경 파일을 준비한 뒤 다음과 같습니다.

```sh
/Users/sinjulee/Projects/Gatherly/macmini/run-status-bot.sh
```

상태 대시보드는 `/start`, `/status`, `/help`와 인라인 버튼을 제공합니다. 새로고침은 기존 메시지를 갱신하며, `GATHERLY_ACCESS_URL`이 비어 있지 않을 때만 **Gatherly 열기** URL 버튼이 보입니다.

## 5. launchd 템플릿 설치 (직접 실행할 때만)

현재 `which node` 결과는 `/opt/homebrew/bin/node`이며 두 템플릿과 래퍼에 반영돼 있습니다. Node 경로가 바뀌면 먼저 템플릿과 래퍼를 함께 수정합니다.

```sh
mkdir -p /Users/sinjulee/Projects/Gatherly/logs
cp macmini/com.gatherly.app.plist.template ~/Library/LaunchAgents/com.gatherly.app.plist
cp macmini/com.gatherly.statusbot.plist.template ~/Library/LaunchAgents/com.gatherly.statusbot.plist
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.gatherly.app.plist
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.gatherly.statusbot.plist
launchctl print gui/$(id -u)/com.gatherly.app
launchctl print gui/$(id -u)/com.gatherly.statusbot
```

상태 봇은 `RunAtLoad`와 `KeepAlive`로 동작합니다. 앱은 `RunAtLoad` 및 비정상 종료(`SuccessfulExit=false`) 때만 `KeepAlive` 재실행되고 `ThrottleInterval=30`을 적용하므로, 정상 종료나 배포 중 종료를 무한 반복하지 않도록 설계했습니다. 앱과 봇은 반드시 별도 service입니다.

정지와 재시작은 다음처럼 각각 수행합니다.

```sh
launchctl bootout gui/$(id -u) ~/Library/LaunchAgents/com.gatherly.statusbot.plist
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.gatherly.statusbot.plist
launchctl bootout gui/$(id -u) ~/Library/LaunchAgents/com.gatherly.app.plist
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.gatherly.app.plist
```

로그는 Git 제외 대상인 프로젝트 `logs/`에 있습니다.

```sh
tail -f logs/status-bot.stdout.log logs/status-bot.stderr.log
tail -f logs/gatherly-app.stdout.log logs/gatherly-app.stderr.log
tail -f logs/status-bot-audit.log
```

복구 버튼은 허용된 user ID, 앱 health 재점검, 두 번째 **복구 실행** 확인, 60초 cooldown을 모두 통과한 경우에만 고정 label `com.gatherly.app`에 `launchctl kickstart -k`를 실행합니다. 재부팅·종료·잠자기·파일 조작이나 다른 서비스 제어는 하지 않습니다. 복구 감사 로그에는 시간, 허용 user ID, 결과만 남고 토큰·절대 경로는 남기지 않습니다.

## 6. 맥미니 권장 전원 설정

상태 봇이 응답하려면 맥미니가 켜져 있고 인터넷에 연결돼 있어야 합니다. 시스템 설정에서 다음을 검토합니다.

- 자동 잠자기 방지
- Wake for network access 활성화
- 정전 뒤 전원 복구 시 자동 시작 활성화
- 위의 launchd로 Gatherly 앱과 상태 봇 자동 시작

아래 명령은 현재 설정을 **읽기 전용**으로 확인합니다. 이 문서는 시스템 설정을 변경하지 않습니다.

```sh
pmset -g custom
systemsetup -getcomputersleep
systemsetup -getharddisksleep
systemsetup -getwakeonnetworkaccess
systemsetup -getrestartpowerfailure
```

맥미니 전원이 완전히 꺼진 경우, Telegram 상태 봇도 실행되지 않으므로 이 봇으로 전원을 켤 수 없습니다. 상태 봇까지 응답하지 않으면 전원, 인터넷 또는 봇 프로세스 문제를 현장에서 확인해야 합니다.
