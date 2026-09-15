import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const base = process.env.PHASE5_BROWSER_URL;
const exhibitionId = process.env.PHASE5_EXHIBITION_ID;
const indexId = process.env.PHASE5_INDEX_ID;
const companyId = process.env.PHASE5_COMPANY_ID;
assert(/^http:\/\/127\.0\.0\.1:\d+$/.test(base || "") && exhibitionId && indexId && companyId, "Localhost URL and context IDs are required.");
const profile = path.join(os.tmpdir(), "gatherly-phase5-chrome-" + process.pid);
const chrome = spawn("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", [
  "--headless=new", "--disable-gpu", "--disable-extensions", "--disable-background-networking",
  "--no-first-run", "--no-default-browser-check", "--user-data-dir=" + profile,
  "--remote-debugging-port=0", "about:blank",
], { stdio: ["ignore", "ignore", "pipe"] });
let socket;
try {
  let port;
  chrome.stderr.on("data", (buffer) => {
    const match = buffer.toString().match(/DevTools listening on ws:\/\/127\.0\.0\.1:(\d+)\//);
    if (match) port = Number(match[1]);
  });
  const deadline = Date.now() + 20000;
  while (!port && Date.now() < deadline && chrome.exitCode === null) await new Promise((resolve) => setTimeout(resolve, 100));
  assert(port, "Chrome debugging port did not open.");
  const target = (await (await fetch("http://127.0.0.1:" + port + "/json")).json()).find((item) => item.type === "page");
  assert(target?.webSocketDebuggerUrl);
  socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.addEventListener("open", resolve, { once: true }); socket.addEventListener("error", reject, { once: true }); });
  let counter = 0;
  const pending = new Map();
  socket.addEventListener("message", (event) => {
    const response = JSON.parse(event.data);
    const task = pending.get(response.id);
    if (!task) return;
    pending.delete(response.id);
    clearTimeout(task.timer);
    if (response.error) task.reject(new Error(response.error.message)); else task.resolve(response.result);
  });
  const command = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++counter;
    const timer = setTimeout(() => { pending.delete(id); reject(new Error("Chrome CDP timeout: " + method)); }, 12000);
    pending.set(id, { resolve, reject, timer });
    socket.send(JSON.stringify({ id, method, params }));
  });
  const evaluate = async (expression) => {
    const result = await command("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
    return result.result.value;
  };
  const wait = async (expression, expected = true) => {
    for (let attempt = 0; attempt < 100; attempt++) {
      if ((await evaluate(expression)) === expected) return;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    throw new Error("Browser state timeout: " + expression);
  };
  const cardUrl = base + "/exhibitions/" + exhibitionId + "/indexes/" + indexId + "/companies/" + companyId;
  const navigate = async (url) => {
    const result = await command("Page.navigate", { url });
    assert(!result.errorText, "Navigation failed: " + result.errorText);
    await wait("location.href === " + JSON.stringify(url) + " && !!document.querySelector('.company-action-bar')");
    await wait("document.readyState === 'complete'");
    await new Promise((resolve) => setTimeout(resolve, 500)); // Allow React event handlers to hydrate.
  };
  const attach = async (selector, names, mime, bytes) => {
    const expression = "(async () => { const input=document.querySelector(" + JSON.stringify(selector) + "); if(!input) return false; const transfer=new DataTransfer(); " +
      names.map((name) => "transfer.items.add(new File([new Uint8Array(" + JSON.stringify(bytes) + ")]," + JSON.stringify(name) + ",{type:" + JSON.stringify(mime) + "}));").join("") +
      "input.files=transfer.files; input.dispatchEvent(new Event('change',{bubbles:true})); return true; })()";
    assert.equal(await evaluate(expression), true, "File input not found: " + selector);
  };
  const count = (kind, number) => "Array.from(document.querySelectorAll('section')).some(s => s.querySelector('h2')?.textContent === '현장 자료' && s.textContent.includes(" + JSON.stringify(kind + " " + number) + "))";
  await command("Page.enable");
  await command("Runtime.enable");
  await command("Network.enable");
  await command("Network.setBypassServiceWorker", { bypass: true });
  const output = [];

  for (const width of [375, 430]) {
    await command("Emulation.setDeviceMetricsOverride", { width, height: 812, deviceScaleFactor: 1, mobile: true });
    await navigate(cardUrl);
    const metrics = await evaluate("({ width: innerWidth, documentWidth: document.documentElement.scrollWidth, bodyWidth: document.body.scrollWidth, actionBottom: document.querySelector('.company-action-bar')?.getBoundingClientRect().bottom, navigationTop: document.querySelector('.mobile-main-nav')?.getBoundingClientRect().top })");
    assert.equal(metrics.width, width);
    assert(metrics.documentWidth <= width + 1 && metrics.bodyWidth <= width + 1, "Horizontal overflow: " + JSON.stringify(metrics));
    assert(metrics.actionBottom <= metrics.navigationTop + 1, "Mobile bars overlap: " + JSON.stringify(metrics));
    output.push({ viewport: width, ...metrics });
  }
  await command("Emulation.setDeviceMetricsOverride", { width: 375, height: 812, deviceScaleFactor: 1, mobile: true });
  await navigate(cardUrl);
  await evaluate("document.querySelector('.company-action-bar button:nth-child(3)').click()");
  await wait("!!document.querySelector('#company-memo-draft')");
  await wait("!!document.querySelector('#company-field-day')?.value");
  await evaluate("(() => { const field=document.querySelector('#company-memo-draft'); const setter=Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set; setter.call(field,'Phase5 browser field memo'); field.dispatchEvent(new Event('input',{bubbles:true})); })()");
  await wait("!document.querySelector('[role=dialog] button')?.disabled");
  assert(await evaluate("document.querySelector('#company-memo-draft')?.value === 'Phase5 browser field memo'"));
  await evaluate("Array.from(document.querySelectorAll('[role=dialog] button')).find(b=>b.textContent.includes('기업 메모 저장')).click()");
  await wait(count("메모", 1));
  output.push({ interaction: "memo-save", count: 1 });
  await evaluate("document.querySelector('[aria-label=\"입력 패널 닫기\"]').click()");

  await evaluate("document.querySelector('.company-action-bar button:nth-child(1)').click()");
  await wait("!!document.querySelector('[role=dialog] input[multiple]')");
  await wait("!!document.querySelector('#company-field-day')?.value");
  await attach("[role=dialog] input[multiple]", ["phase5-1.png", "phase5-2.png", "phase5-3.png"], "image/png", [137, 80, 78, 71, 13, 10, 26, 10]);
  await wait(count("사진", 3));
  output.push({ interaction: "three-photos", count: 3 });
  await evaluate("document.querySelector('[aria-label=\"입력 패널 닫기\"]').click()");

  await evaluate("document.querySelector('.company-action-bar button:nth-child(2)').click()");
  await wait("!!document.querySelector('[role=dialog] input[type=file]')");
  await wait("!!document.querySelector('#company-field-day')?.value");
  await attach("[role=dialog] input[type=file]:last-of-type", ["phase5-audio.mp3"], "audio/mpeg", [73, 68, 51, 3]);
  await wait(count("음성", 1));
  output.push({ interaction: "audio-save", count: 1 });
  await evaluate("document.querySelector('[aria-label=\"입력 패널 닫기\"]').click()");

  await evaluate("document.querySelector('.company-action-bar button:nth-child(4)').click()");
  await wait("!!document.querySelector('[role=dialog] input[type=file]')");
  await wait("!!document.querySelector('#company-field-day')?.value");
  await attach("[role=dialog] input[type=file]:last-of-type", ["phase5-video.mp4"], "video/mp4", [0, 0, 0, 1]);
  await wait(count("영상", 1));
  output.push({ interaction: "video-save", count: 1 });
  await evaluate("document.querySelector('[aria-label=\"입력 패널 닫기\"]').click()");

  // Existing v1 IndexedDB rows without context and new rows with optional context both survive a roundtrip.
  const queueContract = await evaluate("(async () => { const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('gatherly-upload-queue',1);r.onupgradeneeded=()=>r.result.createObjectStore('uploads',{keyPath:'clientUploadId'});r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)}); const old={clientUploadId:'phase5-browser-old',fieldDayId:'old-day',type:'IMAGE',file:new File([new Uint8Array([1])],'old.png',{type:'image/png'}),title:'old',state:'PENDING',createdAt:new Date().toISOString()}; const modern={...old,clientUploadId:'phase5-browser-new',companyId:" + JSON.stringify(companyId) + ",sourceIndexId:" + JSON.stringify(indexId) + ",exhibitionId:" + JSON.stringify(exhibitionId) + "}; const tx=db.transaction('uploads','readwrite');tx.objectStore('uploads').put(old);tx.objectStore('uploads').put(modern); await new Promise((resolve,reject)=>{tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error)}); const read=db.transaction('uploads','readonly');const rows=await new Promise((resolve,reject)=>{const r=read.objectStore('uploads').getAll();r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)}); const oldRow=rows.find(r=>r.clientUploadId==='phase5-browser-old');const newRow=rows.find(r=>r.clientUploadId==='phase5-browser-new');const result={version:db.version,keyPath:read.objectStore('uploads').keyPath,oldWithoutContext:!('companyId' in oldRow),newContext:newRow.companyId,hasFile:newRow.file instanceof File};const cleanup=db.transaction('uploads','readwrite');cleanup.objectStore('uploads').delete(old.clientUploadId);cleanup.objectStore('uploads').delete(modern.clientUploadId);await new Promise(resolve=>cleanup.oncomplete=resolve);db.close();return result;})()");
  assert.equal(queueContract.version, 1);
  assert.equal(queueContract.keyPath, "clientUploadId");
  assert.equal(queueContract.oldWithoutContext, true);
  assert.equal(queueContract.newContext, companyId);
  assert.equal(queueContract.hasFile, true);
  output.push({ interaction: "indexeddb-v1-roundtrip", ...queueContract });

  await command("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 1 });
  const nextUrl = await evaluate("Array.from(document.querySelectorAll('a')).find(a=>a.textContent.includes('다음 기업'))?.href");
  assert(nextUrl);
  await command("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: 285, y: 465 }] });
  await command("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: 135, y: 470 }] });
  await command("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await wait("location.href === " + JSON.stringify(nextUrl));
  await wait(count("사진", 0));
  await navigate(cardUrl);
  await wait(count("사진", 3));
  output.push({ interaction: "swipe-context-preserved", nextCompanyHasNoPhotos: true, originalCompanyPhotos: 3 });

  // A failed offline upload remains in IndexedDB, then retries from its original Company after navigation.
  await command("Network.emulateNetworkConditions", { offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0 });
  await evaluate("document.querySelector('.company-action-bar button:nth-child(1)').click()");
  await wait("!!document.querySelector('#company-field-day')?.value");
  await attach("[role=dialog] input[multiple]", ["phase5-offline.png"], "image/png", [137, 80, 78, 71, 13, 10, 26, 10]);
  await wait("document.querySelector('[role=dialog]')?.textContent.includes('FAILED')");
  const frozenOffline = await evaluate("(async()=>{const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('gatherly-upload-queue',1);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});const tx=db.transaction('uploads','readonly');const rows=await new Promise((resolve,reject)=>{const r=tx.objectStore('uploads').getAll();r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});db.close();const row=rows.find(r=>r.file?.name==='phase5-offline.png');return row?{state:row.state,companyId:row.companyId,sourceIndexId:row.sourceIndexId,fieldDayId:row.fieldDayId}:null})()");
  assert.equal(frozenOffline.state, "FAILED");
  assert.equal(frozenOffline.companyId, companyId);
  assert.equal(frozenOffline.sourceIndexId, indexId);
  await command("Network.emulateNetworkConditions", { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
  await evaluate("document.querySelector('[aria-label=\"입력 패널 닫기\"]').click()");
  await navigate(nextUrl);
  await wait(count("사진", 0));
  await navigate(cardUrl);
  await evaluate("document.querySelector('.company-action-bar button:nth-child(1)').click()");
  await wait("document.querySelector('[role=dialog]')?.textContent.includes('phase5-offline.png')");
  await evaluate("Array.from(document.querySelectorAll('[role=dialog] button')).find(b=>b.textContent.includes('최초 context로 재시도')).click()");
  await wait(count("사진", 4));
  output.push({ interaction: "offline-retry-after-company-navigation", frozenOffline, originalCompanyPhotos: 4 });
  console.log(JSON.stringify({ ok: true, base, output }, null, 2));
} finally {
  socket?.close();
  chrome.kill("SIGTERM");
  if (chrome.exitCode === null) await Promise.race([new Promise((resolve) => chrome.once("exit", resolve)), new Promise((resolve) => setTimeout(resolve, 2500))]);
  await rm(profile, { recursive: true, force: true });
}
