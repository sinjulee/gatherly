// Optional local-fixture UI regression, invoked by auth-gate-http.mjs. Never production credentials.
import { spawn } from 'node:child_process';
import { mkdtemp, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import path from 'node:path';
import os from 'node:os';
export async function checkMobileUI(base, sessionCookie, pilot = false) {
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
    let sequence=0, uploads=0, failUploadOnce=true, acceptDelete=false; const pending=new Map(), errors=[];
    const command = (method,params={}) => new Promise((resolve,reject) => {
      const id=++sequence; const timer=setTimeout(()=>{pending.delete(id);reject(new Error('CDP timeout '+method));},15000);
      pending.set(id,{resolve,reject,timer});socket.send(JSON.stringify({id,method,params}));
    });
    socket.addEventListener('message',event=>{
      const m=JSON.parse(event.data);
      if(m.method==='Page.javascriptDialogOpening') {
        if(!m.params.message.includes('영구적으로 복구') || !m.params.message.includes('Google에 파일이 남아') || !m.params.message.includes('삭제하지 않습니다')) errors.push('missing deletion warning');
        void command('Page.handleJavaScriptDialog',{accept:acceptDelete});
      }
      if(m.method==='Runtime.exceptionThrown') errors.push('browser exception');
      if(m.method==='Fetch.requestPaused') {
        if(pilot && m.params.request.url===base+'/api/v2/storage-test') {
          uploads++;
          const failed = failUploadOnce; failUploadOnce = false;
          const body = failed ? {error:'RETRY',diagnostic:'DRIVE_CHUNK_TRANSFER_FAILED',requestId:'11111111-1111-4111-8111-111111111111',remote:{file:'UNKNOWN',row:'UNKNOWN'}} : {done:true,offset:0};
          setTimeout(()=>void command('Fetch.fulfillRequest',{requestId:m.params.requestId,responseCode:failed?503:200,responseHeaders:[{name:'Content-Type',value:'application/json'}],body:Buffer.from(JSON.stringify(body)).toString('base64')}),250);
          return;
        }
        const local=m.params.request.url.startsWith(base+'/') || /^(blob:|data:)/.test(m.params.request.url);
        void command(local?'Fetch.continueRequest':'Fetch.failRequest',local?{requestId:m.params.requestId}:{requestId:m.params.requestId,errorReason:'BlockedByClient'});
      }
      const task=pending.get(m.id);if(!task)return;clearTimeout(task.timer);pending.delete(m.id);
      if(m.error)task.reject(new Error(m.error.message));else task.resolve(m.result);
    });
    const evaluate=async expression=>{const r=await command('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});assert(!r.exceptionDetails,'UI evaluation failed');return r.result.value;};
    const wait=async expression=>{for(let i=0;i<100;i++){if(await evaluate(expression))return;await pause(50);}throw new Error('UI condition timed out');};
    const touch = async selector => {
      await wait(`!!document.querySelector(${JSON.stringify(selector)})`);
      const box=await evaluate(`(() => {const e=document.querySelector(${JSON.stringify(selector)});e.scrollIntoView({block:'center'});const r=e.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2,w:r.width,h:r.height,hit:document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)===e || e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))};})()`);
      assert(box.hit,'Touch target covered');assert(box.w>=48&&box.h>=48);
      await command('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:box.x,y:box.y}]});
      await command('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await pause(80);
    };
    await command('Emulation.setTouchEmulationEnabled',{enabled:true});
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
        if(pilot && width===390 && route==='/v2/storage-test') {
          await wait("document.querySelector('#pilot-upload-reasons').textContent.includes('사진 없음')");
          assert(await evaluate("document.querySelector('[data-pilot-upload]').disabled"));
          await touch('[data-pilot-upload]');assert.equal(uploads,0);
          let seedSerial = 0;
          const seed = async kinds => evaluate(`new Promise((resolve,reject)=>{
            const request=indexedDB.open('gatherly-v2-production-storage-test',1);
            request.onsuccess=()=>{const db=request.result,tx=db.transaction('records','readwrite'),store=tx.objectStore('records');
              const ctx={userId:'00000000-0000-0000-0000-000000000001',fieldDayId:'storage-test-event',exhibitorId:'storage-test-company'};
              for(const kind of ${JSON.stringify(kinds)}) {const id='mobile-'+kind+'-'+${++seedSerial};const row={...ctx,id,title:kind,kind:kind==='note'?'NOTE':'MEDIA',text:kind==='note'?'fixture':undefined,blob:kind==='note'?undefined:new Blob(['fixture'],{type:kind==='photo'?'image/png':'audio/mp4'}),state:'LOCAL_PENDING',revision:1,attempts:0,nextAttemptAt:0};store.put(row,'queue:'+JSON.stringify([ctx.userId,ctx.fieldDayId,ctx.exhibitorId,id]));}
              tx.oncomplete=()=>{db.close();window.dispatchEvent(new Event('gatherly-pilot-updated'));resolve(true);};tx.onerror=reject;
            };request.onerror=reject;
          })`);
          await seed(['photo']);await wait("document.querySelectorAll('[data-local-card]').length===1");
          assert(await evaluate("document.querySelector('[data-pilot-upload]').disabled && document.querySelector('#pilot-upload-reasons').textContent.includes('녹음 없음') && document.querySelector('#pilot-upload-reasons').textContent.includes('메모 없음')"));
          await touch('[aria-label="photo 로컬 삭제"]'); // cancel first
          assert.equal(await evaluate("document.querySelectorAll('[data-local-card]').length"),1);
          acceptDelete=true;await touch('[aria-label="photo 로컬 삭제"]');await wait("document.querySelectorAll('[data-local-card]').length===0");
          await seed(['photo','audio','note']);await wait("!document.querySelector('[data-pilot-upload]').disabled");
          acceptDelete=false;await touch('[aria-label="audio 로컬 삭제"]');assert.equal(await evaluate("document.querySelectorAll('[data-local-card]').length"),3);
          acceptDelete=true;await touch('[aria-label="audio 로컬 삭제"]');await wait("document.querySelectorAll('[data-local-card]').length===2");
          await seed(['audio']);await wait("!document.querySelector('[data-pilot-upload]').disabled");
          await touch('[aria-label="note 로컬 삭제"]');await wait("document.querySelector('[data-pilot-upload]').disabled && document.querySelector('#pilot-upload-reasons').textContent.includes('메모 없음')");
          await seed(['note']);await wait("!document.querySelector('[data-pilot-upload]').disabled");
          await touch('[data-pilot-upload]');await wait("document.querySelector('#pilot-upload-reasons').textContent.includes('업로드 또는')");
          await wait("document.body.textContent.includes('DRIVE_CHUNK_TRANSFER_FAILED') && document.body.textContent.includes('11111111-1111-4111-8111-111111111111')");
          assert(await evaluate("document.body.textContent.includes('원격 대조 전') && document.documentElement.scrollWidth <= innerWidth"));
          assert.equal(uploads,1);assert.equal(await evaluate("document.querySelectorAll('[data-local-card]').length"),3);
          await wait("!document.querySelector('[data-pilot-upload]').disabled");
          await touch('[data-pilot-upload]');
          await wait("document.querySelector('#pilot-upload-reasons').textContent.includes('이미 업로드 완료')");
          assert.equal(uploads,4);assert(await evaluate("document.querySelector('[data-pilot-upload]').disabled"));
          await touch('[data-pilot-upload]');assert.equal(uploads,4);
          assert.equal(await evaluate("document.querySelectorAll('[data-local-card]').length"),3);
          assert(await evaluate("[...document.querySelectorAll('[data-local-card]')].every(e=>e.textContent.includes('원격 교체 불가'))"));
          await touch('[aria-label="photo 로컬 삭제"]');await wait("document.querySelectorAll('[data-local-card]').length===2");
          await seed(['photo']);await wait("document.querySelector('#pilot-upload-reasons').textContent.includes('원격 교체')");
          assert(await evaluate("document.querySelector('[data-pilot-upload]').disabled"));assert.equal(uploads,4);
          await evaluate(`new Promise((resolve,reject)=>{const request=indexedDB.open('gatherly-v2-production-storage-test',1);request.onsuccess=()=>{const db=request.result,tx=db.transaction('records','readwrite'),store=tx.objectStore('records');const key=JSON.stringify(['00000000-0000-0000-0000-000000000001','storage-test-event','storage-test-company','mobile-audio-3']);const get=store.get('queue:'+key);get.onsuccess=()=>{const row={...get.result,state:'DRIVE_UPLOADING',attempts:1};store.put(row,'queue:'+key);store.put(row,'transfer:'+key);};tx.oncomplete=()=>{db.close();window.dispatchEvent(new Event('gatherly-pilot-updated'));resolve(true);};tx.onerror=reject;};})`);
          await wait("!!document.querySelector('[data-local-recover]')");
          acceptDelete=false;await touch('[aria-label="audio 로컬 삭제"]');
          assert.equal(await evaluate("document.querySelectorAll('[data-local-card]').length"),3);
          await touch('[data-local-recover]');await wait("[...document.querySelectorAll('[data-local-card]')].some(e=>e.textContent.includes('FAILED_RETRYABLE'))");
          assert(await evaluate("document.querySelector('[data-pilot-upload]').disabled"));assert.equal(uploads,4);
          const retained=await evaluate(`new Promise(resolve=>{const r=indexedDB.open('gatherly-v2-production-storage-test',1);r.onsuccess=()=>{const db=r.result,tx=db.transaction('records'),q=tx.objectStore('records').get('transfer:'+JSON.stringify(['00000000-0000-0000-0000-000000000001','storage-test-event','storage-test-company','mobile-audio-3']));q.onsuccess=()=>resolve({id:q.result.id,revision:q.result.revision,size:q.result.blob.size});tx.oncomplete=()=>db.close();};})`);
          assert.deepEqual(retained,{id:'mobile-audio-3',revision:1,size:7});
          acceptDelete=true;await touch('[aria-label="audio 로컬 삭제"]');await wait("document.querySelectorAll('[data-local-card]').length===2");
          await command('Page.reload');await wait("document.querySelectorAll('[data-local-card]').length===2");
          assert(await evaluate("![...document.querySelectorAll('[data-local-card]')].some(e=>e.textContent.includes('audio'))"));
          await wait("document.querySelector('[data-pilot-upload]').disabled && document.querySelector('#pilot-upload-reasons').textContent.includes('원격 교체')");
          assert.equal(uploads,4);
        }
        if(width===390){const shot=await command('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});await writeFile(path.join(profile,route.replaceAll('/','_')+'.png'),Buffer.from(shot.data,'base64'));}
        pages++;
      }
    }
    assert.deepEqual(errors,[]);
    console.log(JSON.stringify({mobileUI:'PASS',pilotTouch:pilot?'PASS':'NOT_RUN',mockUploads:uploads,pages,widths:[320,375,390,430],safeAreaEmulated,engine:'Chrome mobile emulation; not iPhone Safari',artifacts:profile}));
  } finally {socket?.close();chrome.kill('SIGTERM');}
}
