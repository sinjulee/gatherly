// Isolated build + fresh temporary Chrome profile. No legacy API or external services.
import { createServer } from "node:http";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
const source = process.env.PHASE1_BUILD_SOURCE;
assert(source?.startsWith("/private/tmp/gatherly-phase1-"), "An isolated temporary build is required");
const base = "http://127.0.0.1:3107";
// Test-only Auth HTTP fixture. Production code has no bypass flag or test session path.
const userA = '00000000-0000-0000-0000-000000000001';
const userB = '00000000-0000-0000-0000-000000000002';
const jwt = id => ['eyJhbGciOiJIUzI1NiJ9', Buffer.from(JSON.stringify({ sub:id, exp:Math.floor(Date.now()/1000)+3600, role:'authenticated' })).toString('base64url'), 'fixture'].join('.');
const tokens = {[userA]:jwt(userA),[userB]:jwt(userB)};
const cookieFor = (id, claimed = id) => 'base64-' + Buffer.from(JSON.stringify({ access_token:tokens[id], refresh_token:'fixture-only', expires_at:Math.floor(Date.now()/1000)+3600, expires_in:3600, token_type:'bearer', user:{id:claimed} })).toString('base64url');
const fixture = createServer((request,response) => {
  response.setHeader('Content-Type','application/json');
  if (request.url === '/auth/v1/user') {
    const token = request.headers.authorization?.replace('Bearer ','');
    const id = token === tokens[userA] ? userA : token === tokens[userB] ? userB : null;
    response.statusCode = id ? 200 : 401;
    response.end(JSON.stringify(id ? {id,aud:'authenticated',role:'authenticated',is_anonymous:false,user_metadata:{is_admin:true}} : {message:'invalid fixture'}));
  } else if (request.url?.startsWith('/rest/v1/')) response.end('[]');
  else {response.statusCode=404;response.end('{}');}
});
await new Promise(resolve => fixture.listen(3108,'127.0.0.1',resolve));
const testEnv = {...process.env, VERCEL:'1', VERCEL_ENV:'preview', GATHERLY_V2_ENVIRONMENT:'preview', GATHERLY_V2_INTEGRATION_ENABLED:'true', GATHERLY_V2_GOOGLE_WRITES_ENABLED:'false', GATHERLY_V2_PREVIEW_ALLOWED_USER_IDS:userA, GATHERLY_V2_PRODUCTION_ALLOWED_USER_IDS:userB, GATHERLY_V2_APP_ORIGIN:base, NEXT_PUBLIC_SUPABASE_URL:'http://127.0.0.1:3108', NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'fixture-only'};
const profile = await mkdtemp(path.join(os.tmpdir(), "gatherly-v2-browser-"));
const server = spawn(process.execPath, [path.resolve("node_modules/next/dist/bin/next"), "start", "--hostname", "127.0.0.1", "--port", "3107"], { cwd: source, env:testEnv, stdio: ["ignore", "pipe", "pipe"] });
let chrome, socket;
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const browserErrors = [];
try {
  let ready = false;
  for (let i = 0; i < 100; i++) { try { if ((await fetch(base + "/phase-one")).ok) { ready = true; break; } } catch {} await pause(100); }
  assert(ready, "Isolated server did not start");
  const deniedPage = await fetch(base + '/phase-one', {redirect:'manual'});
  assert.equal(deniedPage.status,307);
  const cookie = id => `sb-127-auth-token=${cookieFor(id)}`;
  for (const endpoint of ['/api/v2/map','/api/v2/catalog','/api/v2/voice']) {
    assert.equal((await fetch(base+endpoint)).status,401);
    assert.equal((await fetch(base+endpoint,{headers:{Cookie:cookie(userB)}})).status,403);
    assert.equal((await fetch(base+endpoint,{headers:{Cookie:`sb-127-auth-token=${cookieFor(userB,userA)}`}})).status,403);
  }
  assert.equal((await fetch(base+'/phase-one',{headers:{Cookie:cookie(userB)},redirect:'manual'})).status,307);
  for (const target of ['/_next/static/media/ESG_2026_Official_BoothMap_TitleRemoved_Reference.dac3d31f.png','/docs/gatherly-2.0/v0.5_assets/ESG_2026_Official_BoothMap_TitleRemoved_Reference.png','/_next/image?url=%2Fapi%2Fv2%2Fmap&w=1200&q=75']) assert.equal((await fetch(base+target)).status,404);
  const allowedMap = await fetch(base+'/api/v2/map?environment=production',{headers:{Cookie:cookie(userA),'X-Gatherly-Environment':'production'}});
  assert.equal(allowedMap.status,200); assert.equal(allowedMap.headers.get('cache-control'),'private, no-store');
  chrome = spawn("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", ["--headless=new", "--disable-gpu", "--disable-extensions", "--disable-background-networking", "--no-first-run", "--no-default-browser-check", "--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream", `--user-data-dir=${profile}`, "--remote-debugging-port=0", "about:blank"], { stdio: ["ignore", "ignore", "pipe"] });
  let port;
  chrome.stderr.on("data", data => { const match = data.toString().match(/DevTools listening on ws:\/\/127\.0\.0\.1:(\d+)\//); if (match) port = Number(match[1]); });
  for (let i = 0; i < 100 && !port; i++) await pause(100);
  assert(port, "Chrome did not start");
  const target = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find(row => row.type === "page");
  socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.addEventListener("open", resolve, { once: true }); socket.addEventListener("error", reject, { once: true }); });
  let sequence = 0; const pending = new Map();
  const command = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++sequence; const timer = setTimeout(() => { pending.delete(id); reject(new Error(`CDP timeout: ${method}`)); }, method === "Page.captureScreenshot" ? 30000 : 12000);
    pending.set(id, { resolve, reject, timer }); socket.send(JSON.stringify({ id, method, params }));
  });
  socket.addEventListener("message", event => {
    const message = JSON.parse(event.data);
    if (message.method === "Runtime.exceptionThrown") browserErrors.push(message.params.exceptionDetails.text);
    if (message.method === "Fetch.requestPaused") {
      const url = message.params.request.url;
      const local = url.startsWith(base + "/") || url.startsWith("blob:") || url.startsWith("data:");
      void command(local ? "Fetch.continueRequest" : "Fetch.failRequest", local ? { requestId: message.params.requestId } : { requestId: message.params.requestId, errorReason: "BlockedByClient" });
    }
    const task = pending.get(message.id); if (!task) return;
    clearTimeout(task.timer); pending.delete(message.id);
    if (message.error) task.reject(new Error(message.error.message)); else task.resolve(message.result);
  });
  const evaluate = async expression => {
    const value = await command("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
    if (value.exceptionDetails) throw new Error(value.exceptionDetails.exception?.description || value.exceptionDetails.text);
    return value.result.value;
  };
  const wait = async expression => { for (let i = 0; i < 100; i++) { if (await evaluate(expression)) return; await pause(50); } throw new Error("Browser condition failed: " + expression); };
  const click = async selector => { await evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`); await pause(80); };
  const fill = async (selector, value) => {
    await evaluate(`(() => { const el = document.querySelector(${JSON.stringify(selector)}); Object.getOwnPropertyDescriptor(el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype, 'value').set.call(el, ${JSON.stringify(value)}); el.dispatchEvent(new Event('input', { bubbles: true })); })()`); await pause(100);
  };
  const navigate = async () => { await command("Page.navigate", { url: base + "/phase-one" }); await wait("!!document.querySelector('[aria-label=\"메모 기록\"]')"); await pause(200); };
  await command("Runtime.enable"); await command("Page.enable"); await command("Network.enable");
  await command("Network.setBypassServiceWorker", { bypass: true });
  await command("Fetch.enable", { patterns: [{ urlPattern: "*" }] });
  await command('Network.setCookie',{name:'sb-127-auth-token',value:cookieFor(userA),url:base,httpOnly:true,sameSite:'Lax'});
  const checks = ['unauthenticated and unapproved page/image/catalog/voice access blocked; forged cookie identity rejected; authenticated private map delivered'];
  for (const width of [375, 430, 1280]) {
    await command("Emulation.setDeviceMetricsOverride", { width, height: 900, deviceScaleFactor: 1, mobile: width < 1024 }); await navigate();
    const dimensions = await evaluate(`(() => { const map = document.querySelector('[aria-label="양방향 스크롤 부스배치도"]'); const actions = [...document.querySelector('[aria-label="기업 기록 도구"]').children]; return { width: innerWidth, body: document.documentElement.scrollWidth, x: map.scrollWidth > map.clientWidth, y: map.scrollHeight > map.clientHeight, buttons: actions.map(b => ({ label: b.getAttribute('aria-label'), width: b.getBoundingClientRect().width, height: b.getBoundingClientRect().height })) }; })()`);
    assert.equal(dimensions.width, width); assert(dimensions.body <= width + 1, JSON.stringify(dimensions)); assert(dimensions.x && dimensions.y);
    assert(dimensions.buttons.every(b => b.width >= 44 && b.height >= 44));
    assert.deepEqual(dimensions.buttons.map(b => b.label), ["테스트 도슨트 재생 또는 중지", "사진 수집", "녹음 시작", "메모 기록"]);
    await wait("document.readyState === 'complete' && [...document.images].every(image => image.complete)");
    await evaluate("document.fonts.ready.then(() => true)");
    await command("Page.bringToFront");
    const screenshot = await command("Page.captureScreenshot", { format: "png", captureBeyondViewport: false }); await writeFile(path.join(profile, `viewport-${width}.png`), Buffer.from(screenshot.data, "base64"));
    checks.push(`viewport ${width}: no overflow, x/y map, four 44px actions`);
  }
  await command("Emulation.setDeviceMetricsOverride", { width: 375, height: 900, deviceScaleFactor: 1, mobile: true }); await navigate();
  // Keyboard activation and pointer drag must have distinct results.
  await click('[aria-label="테스트 기업 2 · 미검증 선택"]');
  assert.match(await evaluate("document.querySelector('#company-heading').textContent"), /기업 2/);
  await evaluate(`(() => { const b = document.querySelector('[aria-label="테스트 기업 1 · 미검증 선택"]'); b.dispatchEvent(new PointerEvent('pointerdown', { bubbles:true, clientX:10, clientY:10 })); b.dispatchEvent(new PointerEvent('pointermove', { bubbles:true, clientX:60, clientY:10 })); b.dispatchEvent(new MouseEvent('click', { bubbles:true, clientX:60, clientY:10, detail:1 })); })()`);
  assert.match(await evaluate("document.querySelector('#company-heading').textContent"), /기업 2/);
  const corners = await evaluate(`(() => { const map = document.querySelector('[aria-label="양방향 스크롤 부스배치도"]'); const maxX = map.scrollWidth-map.clientWidth, maxY=map.scrollHeight-map.clientHeight; return [[0,0],[maxX,0],[maxX,maxY],[0,maxY]].map(([x,y]) => { map.scrollLeft=x; map.scrollTop=y; return Math.abs(map.scrollLeft-x)<1 && Math.abs(map.scrollTop-y)<1; }); })()`);
  assert(corners.every(Boolean));
  checks.push("hotspot activation, drag guard and four scroll corners");
  await click('[aria-label="메모 기록"]'); await wait("!!document.querySelector('dialog[open] textarea:not(:disabled)')");
  await fill("dialog input", "고정 기업 메모"); await fill("dialog textarea", "첫 번째 저장");
  // Force underlying selection while modal is open; note must still target company 2.
  await click('[aria-label="테스트 기업 1 · 미검증 선택"]');
  await click("dialog button:last-child"); await wait("!document.querySelector('dialog')");
  await click('[aria-label="테스트 기업 2 · 미검증 선택"]'); await wait("document.body.innerText.includes('첫 번째 저장')");
  await click('[aria-label="메모 기록"]'); await wait("document.querySelector('dialog textarea')?.value === '첫 번째 저장'");
  await fill("dialog textarea", "취소할 내용"); await click("dialog button:first-child"); await wait("!document.querySelector('dialog')");
  await click('[aria-label="메모 기록"]'); await wait("document.querySelector('dialog textarea')?.value === '첫 번째 저장'");
  await fill("dialog textarea", "수정 저장"); await click("dialog button:last-child"); await wait("!document.querySelector('dialog')");
  await click('[aria-label="메모 기록"]'); await wait("document.querySelector('dialog textarea')?.value === '수정 저장'");
  await fill("dialog textarea", "새로고침 복원 초안"); await wait("document.querySelector('dialog').innerText.includes('기기에 보관됐습니다')");
  await navigate(); await click('[aria-label="테스트 기업 2 · 미검증 선택"]'); await click('[aria-label="메모 기록"]'); await wait("document.querySelector('dialog textarea')?.value === '새로고침 복원 초안'");
  await click("dialog button:first-child"); checks.push("memo create/edit/cancel, pinned context, draft reload persistence");
  // Real IndexedDB with synthetic files; input context captured by the camera button.
  await evaluate("HTMLInputElement.prototype.click = function() {}; document.querySelector('[aria-label=\"사진 수집\"]').click()");
  await evaluate(`(() => { const input = document.querySelector('input[type=file]'); const dt = new DataTransfer(); for (let i=0;i<5;i++) dt.items.add(new File([Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a3ioAAAAASUVORK5CYII='), c => c.charCodeAt(0))], 'fixture-'+i+'.png', { type:'image/png' })); input.files=dt.files; input.dispatchEvent(new Event('change', {bubbles:true})); })()`);
  await wait("document.querySelectorAll('article img').length === 5"); checks.push("five synthetic photos stored and preview elements created");
  await evaluate("window.confirm = () => true"); await click('[aria-label="녹음 시작"]'); await wait("!!document.querySelector('[aria-label=\"녹음 중지\"]')");
  assert.equal(await evaluate("document.querySelector('[aria-label=\"테스트 도슨트 재생 또는 중지\"]').disabled"), true);
  await pause(1100); await click('[aria-label="녹음 중지"]'); await wait("document.querySelectorAll('article audio').length === 1");
  await navigate(); await click('[aria-label="테스트 기업 2 · 미검증 선택"]'); await wait("document.querySelectorAll('article audio').length === 1 && document.querySelectorAll('article img').length === 5");
  const localRecords = await evaluate(`new Promise((resolve,reject) => { const request=indexedDB.open('gatherly-v2-preview-internal',1); request.onerror=reject; request.onsuccess=()=> { const db=request.result; const tx=db.transaction('records','readonly'); const get=tx.objectStore('records').getAll(); get.onsuccess=()=> { const rows=get.result; resolve({ notes:rows.filter(r=>r.updatedAt && !r.state).map(r=>({id:r.id,revision:r.revision,exhibitorId:r.exhibitorId})), queue:rows.filter(r=>r.state).map(r=>({id:r.id,kind:r.kind})) }); }; tx.oncomplete=()=>db.close(); }; })`);
  assert.equal(localRecords.notes.length, 1); assert.equal(localRecords.notes[0].revision, 2);
  assert.equal(localRecords.notes[0].exhibitorId, "test-exhibitor-2");
  assert.equal(localRecords.queue.filter(r=>r.kind === "NOTE").length, 1);
  assert.equal(localRecords.queue.find(r=>r.kind === "NOTE").id, localRecords.notes[0].id);
  checks.push("fake microphone recording, TTS lockout, media survives reload, stable note UUID/revision");
  const prepared = await fetch(base + "/v2");
  assert.equal(prepared.status, 200);
  assert.match(await prepared.text(), /Google 로그인/);
  for (const route of ["google/connect", "sync", "media"]) {
    const blocked = await fetch(base + "/api/v2/" + route, { method: "POST", headers: { Origin: base } });
    assert.equal(blocked.status, 503);
    assert.equal((await blocked.json()).error, "DISABLED");
  }
  checks.push("V2 login screen and fail-closed external-write routes");
  if (process.env.VERCEL === "1") {
    const root = await fetch(base + "/", { redirect: "manual" });
    assert.equal(root.status, 307); assert.equal(new URL(root.headers.get("location"), base).pathname, "/v2");
    for (const route of ["/api/materials", "/api/reports", "/reports", "/storage/file", "/sw.js"]) {
      const response = await fetch(base + route); assert.equal(response.status, 404);
      assert.equal((await response.json()).error, "LOCAL_LEGACY_ONLY");
    }
    checks.push("Vercel root redirects to V2; legacy DB/API and service worker not exposed");
  }

  assert.deepEqual(browserErrors, []);
  console.log(JSON.stringify({ ok: true, checks, artifacts: profile }, null, 2));
} finally {
  socket?.close(); chrome?.kill("SIGTERM"); server.kill("SIGTERM"); fixture.close();
}
