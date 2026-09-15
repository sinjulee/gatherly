import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const base = process.env.PHASE4_BROWSER_URL;
if (!base || !/^http:\/\/127\.0\.0\.1:\d+$/.test(base)) throw new Error("PHASE4_BROWSER_URL must be a localhost URL.");
const exhibitionId = process.env.PHASE4_EXHIBITION_ID;
const indexId = process.env.PHASE4_INDEX_ID;
const companyId = process.env.PHASE4_COMPANY_ID;
if (![exhibitionId, indexId, companyId].every(Boolean)) throw new Error("Exhibition, Index, Company IDs are required.");
const chromeBinary = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const profile = path.join(os.tmpdir(), `gatherly-phase4-chrome-${process.pid}`);
const chrome = spawn(chromeBinary, [
  "--headless=new", "--disable-gpu", "--disable-extensions", "--disable-background-networking",
  "--no-first-run", "--no-default-browser-check", `--user-data-dir=${profile}`,
  "--remote-debugging-port=0", "about:blank",
], { stdio: ["ignore", "ignore", "pipe"] });

let webSocket;
let counter = 0;
const pending = new Map();
try {
  const deadline = Date.now() + 20_000;
  let port;
  chrome.stderr.on("data", (buffer) => {
    const match = buffer.toString().match(/DevTools listening on ws:\/\/127\.0\.0\.1:(\d+)\//);
    if (match) port = Number(match[1]);
  });
  while (!port && Date.now() < deadline && chrome.exitCode === null) await new Promise((resolve) => setTimeout(resolve, 100));
  assert(port, "Chrome debugging port did not open.");
  const pages = await fetch(`http://127.0.0.1:${port}/json`);
  const target = (await pages.json()).find((item) => item.type === "page");
  assert(target?.webSocketDebuggerUrl);
  webSocket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    webSocket.addEventListener("open", resolve, { once: true });
    webSocket.addEventListener("error", reject, { once: true });
  });
  webSocket.addEventListener("message", (event) => {
    const response = JSON.parse(event.data);
    if (!response.id || !pending.has(response.id)) return;
    const { resolve, reject } = pending.get(response.id);
    pending.delete(response.id);
    if (response.error) reject(new Error(response.error.message)); else resolve(response.result);
  });
  const command = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++counter;
    const timer = setTimeout(() => { pending.delete(id); reject(new Error(`Chrome CDP timed out: ${method}`)); }, 12_000);
    pending.set(id, {
      resolve: (value) => { clearTimeout(timer); resolve(value); },
      reject: (cause) => { clearTimeout(timer); reject(cause); },
    });
    webSocket.send(JSON.stringify({ id, method, params }));
  });
  const evaluate = async (expression) => {
    const result = await command("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
    return result.result.value;
  };
  const navigate = async (url) => {
    const result = await command("Page.navigate", { url });
    assert(!result.errorText, `Navigation failed: ${result.errorText}`);
    for (let attempt = 0; attempt < 80; attempt += 1) {
      const ready = await evaluate(`document.readyState === 'complete' && location.href === ${JSON.stringify(url)} && !!document.querySelector('main')`);
      if (ready) return;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    throw new Error(`Timed out navigating to ${url}`);
  };
  const screenshot = async (name) => {
    if (process.env.PHASE4_BROWSER_NO_SCREENSHOTS === "1") return "SKIPPED_FOR_INTERACTION_TEST";
    const result = await command("Page.captureScreenshot", { format: "png", fromSurface: true });
    const destination = path.join(os.tmpdir(), name);
    await writeFile(destination, Buffer.from(result.data, "base64"));
    return destination;
  };
  await command("Page.enable");
  await command("Runtime.enable");
  await command("Network.enable");
  await command("Network.setBypassServiceWorker", { bypass: true });
  console.error("Chrome CDP ready; checking card viewports.");
  const cardUrl = `${base}/exhibitions/${exhibitionId}/indexes/${indexId}/companies/${companyId}`;
  const output = [];

  for (const width of [375, 430, 1280]) {
    await command("Emulation.setDeviceMetricsOverride", { width, height: 812, deviceScaleFactor: 1, mobile: width < 1024 });
    await navigate(cardUrl);
    console.error(`Card loaded at ${width}px.`);
    const viewport = await evaluate(`(() => {
      const action = document.querySelector('.company-action-bar')?.getBoundingClientRect();
      const navigation = document.querySelector('.mobile-main-nav')?.getBoundingClientRect();
      const card = document.querySelector('article')?.getBoundingClientRect();
      return { width: innerWidth, documentWidth: document.documentElement.scrollWidth,
        bodyWidth: document.body.scrollWidth, cardWidth: card?.width ?? null,
        actionTop: action?.top ?? null, actionBottom: action?.bottom ?? null,
        navigationTop: navigation?.top ?? null, navigationBottom: navigation?.bottom ?? null,
        company: document.body.innerText.includes('주식회사 파이퀀트'),
        favoriteHeight: Array.from(document.querySelectorAll('button')).find(button => button.textContent.includes('관심기업'))?.getBoundingClientRect().height ?? null,
        todayHeight: Array.from(document.querySelectorAll('button')).find(button => button.textContent.includes('오늘 방문'))?.getBoundingClientRect().height ?? null };
    })()`);
    assert.equal(viewport.width, width);
    assert(viewport.documentWidth <= width + 1 && viewport.bodyWidth <= width + 1, `Horizontal overflow at ${width}px: ${JSON.stringify(viewport)}`);
    assert(viewport.company && viewport.favoriteHeight >= 44 && viewport.todayHeight >= 44);
    if (width < 1024) {
      assert(viewport.company && viewport.actionBottom <= viewport.navigationTop + 1, `Mobile bars overlap at ${width}px: ${JSON.stringify(viewport)}`);
    }
    output.push({ width, ...viewport, screenshot: await screenshot(`gatherly-phase4-${width}.png`) });
    console.error(`Card screenshot captured at ${width}px.`);
  }

  await command("Emulation.setDeviceMetricsOverride", { width: 375, height: 812, deviceScaleFactor: 1, mobile: true });
  await navigate(`${base}/exhibitions/${exhibitionId}`);
  const indexWidth = await evaluate("({ viewport: innerWidth, scrollWidth: document.documentElement.scrollWidth, linkedCompanies: document.querySelectorAll('a[href*=\"/companies/\"]').length })");
  assert.equal(indexWidth.viewport, 375);
  assert(indexWidth.scrollWidth <= 376 && indexWidth.linkedCompanies > 0);
  output.push({ interaction: "file-index", ...indexWidth, screenshot: await screenshot("gatherly-phase4-file-index-375.png") });

  await navigate(cardUrl);
  await evaluate(`Array.from(document.querySelectorAll('button')).find(button => button.textContent.includes('기업 상세정보')).click()`);
  for (let attempt = 0; attempt < 60 && !(await evaluate("document.querySelector('[role=dialog]')?.textContent.includes('RESEARCH DETAIL')")); attempt += 1) await new Promise((resolve) => setTimeout(resolve, 100));
  assert(await evaluate("document.querySelector('[role=dialog]')?.textContent.includes('RESEARCH DETAIL')"));
  output.push({ interaction: "detail", screenshot: await screenshot("gatherly-phase4-detail-375.png") });
  await evaluate("document.querySelector('[aria-label=\"상세정보 닫기\"]').click()");
  await evaluate("document.querySelector('.company-action-bar button:nth-child(3)').click()");
  assert(await evaluate("!!document.querySelector('#company-memo-draft')"));
  assert(await evaluate("document.querySelector('[role=dialog]')?.textContent.includes('기업 메모 저장')"));
  if (process.env.PHASE4_EXPECTED_FIELD_DAY_ID) {
    const expectedFieldDayId = process.env.PHASE4_EXPECTED_FIELD_DAY_ID;
    for (let attempt = 0; attempt < 60 && (await evaluate("document.querySelector('#company-field-day')?.value")) !== expectedFieldDayId; attempt += 1) await new Promise((resolve) => setTimeout(resolve, 100));
    assert.equal(await evaluate("document.querySelector('#company-field-day')?.value"), expectedFieldDayId, "Company Card did not select the exhibition ACTIVE FieldDay by default.");
    output.push({ interaction: "exhibition-field-day-default", fieldDayId: expectedFieldDayId });
  }
  output.push({ interaction: "memo", screenshot: await screenshot("gatherly-phase4-memo-375.png") });
  await evaluate("document.querySelector('[aria-label=\"입력 패널 닫기\"]').click()");
  for (const [position, action] of [[1, "사진 촬영"], [2, "음성 선택"]]) {
    await evaluate(`document.querySelector('.company-action-bar button:nth-child(${position})').click()`);
    assert(await evaluate("!!document.querySelector('[role=dialog] input[type=file]')"));
    assert(await evaluate("document.querySelector('[role=dialog]')?.textContent.includes('자동 연결됩니다')"));
    await evaluate("document.querySelector('[aria-label=\"입력 패널 닫기\"]').click()");
    output.push({ interaction: action === "사진 촬영" ? "photo-entry" : "audio-entry", destination: "company-context-capture" });
  }
  await command("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 1 });
  const nextHref = await evaluate("Array.from(document.querySelectorAll('a')).find(link => link.textContent.includes('다음 기업'))?.href");
  assert(nextHref);
  await command("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: 285, y: 465 }] });
  await command("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: 225, y: 467 }] });
  await command("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: 140, y: 472 }] });
  await command("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  for (let attempt = 0; attempt < 30 && (await evaluate("location.href")) !== nextHref; attempt += 1) await new Promise((resolve) => setTimeout(resolve, 100));
  assert.equal(await evaluate("location.href"), nextHref, "Mobile swipe left did not navigate to the next company.");
  output.push({ interaction: "swipe-next", url: nextHref });
  await command("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: 125, y: 460 }] });
  await command("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: 190, y: 463 }] });
  await command("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: 280, y: 468 }] });
  await command("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  for (let attempt = 0; attempt < 30 && (await evaluate("location.href")) !== cardUrl; attempt += 1) await new Promise((resolve) => setTimeout(resolve, 100));
  assert.equal(await evaluate("location.href"), cardUrl, "Mobile swipe right did not navigate to the previous company.");
  output.push({ interaction: "swipe-previous", url: cardUrl });
  await evaluate("Array.from(document.querySelectorAll('a')).find(link => link.textContent.includes('다음 기업')).click()");
  for (let attempt = 0; attempt < 30 && (await evaluate("location.href")) !== nextHref; attempt += 1) await new Promise((resolve) => setTimeout(resolve, 100));
  assert.equal(await evaluate("location.href"), nextHref, "Button fallback did not navigate to the next company.");
  output.push({ interaction: "button-next", url: nextHref });
  if (process.env.PHASE4_BROWSER_MEMBERSHIP_TEST === "1") {
    await navigate(cardUrl);
    for (const [label, kind] of [["관심기업", "favorite"], ["오늘 방문", "today"]]) {
      const selector = `Array.from(document.querySelectorAll('button')).find(button => button.textContent.includes(${JSON.stringify(label)}))`;
      assert.equal(await evaluate(`${selector}?.getAttribute('aria-pressed')`), "false");
      await evaluate(`${selector}.click()`);
      for (let attempt = 0; attempt < 40 && (await evaluate(`${selector}?.getAttribute('aria-pressed')`)) !== "true"; attempt += 1) await new Promise((resolve) => setTimeout(resolve, 100));
      assert.equal(await evaluate(`${selector}?.getAttribute('aria-pressed')`), "true", `${label} add did not update the UI.`);
      await evaluate(`${selector}.click()`);
      for (let attempt = 0; attempt < 40 && (await evaluate(`${selector}?.getAttribute('aria-pressed')`)) !== "false"; attempt += 1) await new Promise((resolve) => setTimeout(resolve, 100));
      assert.equal(await evaluate(`${selector}?.getAttribute('aria-pressed')`), "false", `${label} remove did not update the UI.`);
      output.push({ interaction: `${kind}-add-remove`, state: "restored" });
    }
  }
  console.log(JSON.stringify({ ok: true, output }, null, 2));
} finally {
  webSocket?.close();
  chrome.kill("SIGTERM");
  if (chrome.exitCode === null) await Promise.race([
    new Promise((resolve) => chrome.once("exit", resolve)),
    new Promise((resolve) => setTimeout(resolve, 2500)),
  ]);
  await rm(profile, { recursive: true, force: true });
}
