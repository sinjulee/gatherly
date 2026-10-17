// Optional local-fixture UI regression, invoked by auth-gate-http.mjs. Never production credentials.
import { spawn } from 'node:child_process';
import { mkdtemp, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import path from 'node:path';
import os from 'node:os';
export async function checkMobileUI(base, sessionCookie) {
  assert(base === 'http://localhost:3217');
  const profile = await mkdtemp(path.join(os.tmpdir(), 'gatherly-2e11-mobile-'));
  const chrome = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', ['--headless=new','--disable-gpu','--disable-extensions','--disable-background-networking','--no-first-run','--no-default-browser-check',`--user-data-dir=${profile}`,'--remote-debugging-port=0','about:blank'], { stdio: ['ignore','ignore','pipe'] });
  let port, socket; const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
  chrome.stderr.on('data', data => { const match = String(data).match(/DevTools listening on ws:\/\/127\.0\.0\.1:(\d+)\//); if (match) port = Number(match[1]); });
  try {
    for (let i=0;i<100&&!port;i++) await pause(100);
    assert(port, 'Local Chrome unavailable');
    const target = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find(row => row.type === 'page');
    socket = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((resolve,reject) => { socket.addEventListener('open',resolve,{once:true}); socket.addEventListener('error',reject,{once:true}); });
    let sequence=0; const pending=new Map(), errors=[];
    const command = (method,params={}) => new Promise((resolve,reject) => {
      const id=++sequence; const timer=setTimeout(()=>{pending.delete(id);reject(new Error('CDP timeout '+method));},15000);
      pending.set(id,{resolve,reject,timer});socket.send(JSON.stringify({id,method,params}));
    });
    socket.addEventListener('message',event=>{
      const m=JSON.parse(event.data);
      if(m.method==='Runtime.exceptionThrown') errors.push('browser exception');
      if(m.method==='Fetch.requestPaused') {
        const local=m.params.request.url.startsWith(base+'/') || /^(blob:|data:)/.test(m.params.request.url);
        void command(local?'Fetch.continueRequest':'Fetch.failRequest',local?{requestId:m.params.requestId}:{requestId:m.params.requestId,errorReason:'BlockedByClient'});
      }
      const task=pending.get(m.id);if(!task)return;clearTimeout(task.timer);pending.delete(m.id);
      if(m.error)task.reject(new Error(m.error.message));else task.resolve(m.result);
    });
    const evaluate=async expression=>{const r=await command('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});assert(!r.exceptionDetails,'UI evaluation failed');return r.result.value;};
    const wait=async expression=>{for(let i=0;i<100;i++){if(await evaluate(expression))return;await pause(50);}throw new Error('UI condition timed out');};
    await command('Runtime.enable');await command('Page.enable');await command('Network.enable');
    await command('Fetch.enable',{patterns:[{urlPattern:'*'}]});
    await command('Network.setCookie',{name:sessionCookie.slice(0,sessionCookie.indexOf('=')),value:sessionCookie.slice(sessionCookie.indexOf('=')+1),url:base,httpOnly:true,sameSite:'Lax'});
    let safeAreaEmulated=false;
    try {await command('Emulation.setSafeAreaInsetsOverride',{insets:{bottom:34,top:0,left:0,right:0}});safeAreaEmulated=true;}catch{}
    let pages=0;
    for(const width of [320,375,390,430]) {
      await command('Emulation.setDeviceMetricsOverride',{width,height:844,deviceScaleFactor:1,mobile:true});
      for(const route of ['/v2','/v2/auth-complete','/v2/storage-test']) {
        await command('Page.navigate',{url:base+route});
        await wait("document.readyState==='complete' && !!document.querySelector('.v2-mobile')");
        await evaluate('document.fonts.ready.then(()=>true)');await pause(300);
        const metrics=await evaluate(`(() => {
          const root=document.querySelector('.v2-mobile');
          const boxes=[...root.querySelectorAll('a,button')].filter(e=>e.getClientRects().length).map(e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height};});
          let overlaps=0; for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++){const a=boxes[i],b=boxes[j];if(Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x)>1&&Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y)>1)overlaps++;}
          return {width:innerWidth,scroll:document.documentElement.scrollWidth,padding:parseFloat(getComputedStyle(root).paddingBottom),overlaps,small:boxes.filter(b=>b.h<47).length,gaps:[...root.querySelectorAll('.v2-actions')].map(e=>parseFloat(getComputedStyle(e).rowGap)),cover:document.querySelector('meta[name=viewport]').content.includes('viewport-fit=cover')};
        })()`);
        assert.equal(metrics.width,width);assert(metrics.scroll<=width+1);assert.equal(metrics.overlaps,0);assert.equal(metrics.small,0,`${route} ${width}: small buttons`);
        assert(metrics.cover);assert(metrics.padding>=96+(safeAreaEmulated?34:0));assert(metrics.gaps.every(g=>g>=12));
        if(route==='/v2/storage-test') {
          await evaluate("document.querySelector('[aria-label=\"메모 기록\"]').click()");
          await wait("!!document.querySelector('dialog[open] textarea:not(:disabled)')");
          const dialog=await evaluate("(() => {const d=document.querySelector('dialog'); const buttons=[...d.querySelectorAll('button')].map(e=>e.getBoundingClientRect());return {gap:buttons[1].left-buttons[0].right,font:getComputedStyle(d.querySelector('textarea')).fontSize,padding:parseFloat(getComputedStyle(d).paddingBottom)};})()");
          assert(dialog.gap>=12);assert.equal(dialog.font,'16px');assert(dialog.padding>=20+(safeAreaEmulated?34:0));
          await evaluate("document.querySelector('dialog button').click()");await wait("!document.querySelector('dialog')");
        }
        if(width===390){const shot=await command('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});await writeFile(path.join(profile,route.replaceAll('/','_')+'.png'),Buffer.from(shot.data,'base64'));}
        pages++;
      }
    }
    assert.deepEqual(errors,[]);
    console.log(JSON.stringify({mobileUI:'PASS',pages,widths:[320,375,390,430],safeAreaEmulated,engine:'Chrome mobile emulation; not iPhone Safari',artifacts:profile}));
  } finally {socket?.close();chrome.kill('SIGTERM');}
}
