const { JSDOM, VirtualConsole } = require('jsdom');
const fs=require('fs'); const ROOT='/home/user/sonora', BASE='http://localhost:3000';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
try{const impl=require('jsdom/lib/jsdom/living/nodes/HTMLMediaElement-impl.js');const C=impl.implementation||impl.HTMLMediaElementImpl;
if(C&&C.prototype){Object.defineProperty(C.prototype,'currentTime',{get(){return this.__ct||0},set(v){this.__ct=Math.max(0,+v||0)},configurable:true});
Object.defineProperty(C.prototype,'duration',{get(){return this.__du===undefined?210:this.__du},set(v){this.__du=v},configurable:true});
Object.defineProperty(C.prototype,'readyState',{get(){return this.__rs===undefined?4:this.__rs},set(v){this.__rs=v},configurable:true});}}catch(e){}
const R=[];const pass=(n,e)=>R.push({ok:1,n,e});const fail=(n,w)=>R.push({ok:0,n,w:String(w).slice(0,140)});
function mk(o={}){
  const html=fs.readFileSync(ROOT+'/index.html','utf8'),app=fs.readFileSync(ROOT+'/app.js','utf8');
  const errs=[];const vc=new VirtualConsole();vc.on('jsdomError',e=>errs.push(e.message));
  const dom=new JSDOM(html.replace('<script src="app.js"></script>','').replace('<script src="desktop-hooks.js"></script>',''),
    {url:BASE+(o.url||'/'),runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc});
  const {window}=dom,doc=window.document;
  window.HTMLMediaElement.prototype.play=function(){this.paused=false;this.dispatchEvent(new window.Event('play'));return Promise.resolve()};
  window.HTMLMediaElement.prototype.pause=function(){this.paused=true;this.dispatchEvent(new window.Event('pause'))};
  const p=()=>({value:0,setTargetAtTime(){},setValueAtTime(){}});
  const n=()=>({connect(){return n()},disconnect(){},start(){},stop(){},gain:p(),pan:p(),frequency:p(),Q:p(),threshold:p(),ratio:p(),knee:p(),attack:p(),release:p(),type:'',buffer:null,fftSize:256,frequencyBinCount:128,smoothingTimeConstant:0,getByteFrequencyData(){}});
  window.AudioContext=function(){return{state:'running',currentTime:0,sampleRate:44100,destination:n(),resume(){},createMediaElementSource:n,createBiquadFilter:n,createGain:n,createConvolver:n,createDynamicsCompressor:n,createAnalyser:n,createStereoPanner:n,createChannelSplitter:n,createChannelMerger:n,createBufferSource:n,createBuffer:(c,x)=>({getChannelData:()=>new Float32Array(x)})}};
  window.EventSource=function(url){const s=this;s.readyState=1;s.listeners={};
    s.addEventListener=(t,f)=>{(s.listeners[t]=s.listeners[t]||[]).push(f)};
    s.close=()=>{s.readyState=2;clearInterval(s.iv)};
    const code=new URL(url,BASE).searchParams.get('c');
    s.iv=setInterval(async()=>{try{const r=await fetch(BASE+'/api/room/state?c='+code);const d=await r.json();
      (s.listeners.state||[]).forEach(f=>f({data:JSON.stringify(d)}))}catch(e){}},600);
    setTimeout(()=>{if(s.onopen)s.onopen()},40)};
  window.matchMedia=()=>({matches:false,addListener(){},removeListener(){},addEventListener(){},removeEventListener(){}});
  window.HTMLElement.prototype.scrollIntoView=()=>{};window.HTMLElement.prototype.scrollTo=()=>{};window.scrollTo=()=>{};
  window.navigator.vibrate=()=>{};window.requestAnimationFrame=cb=>setTimeout(()=>cb(1),8);window.cancelAnimationFrame=clearTimeout;
  window.HTMLCanvasElement.prototype.getContext=()=>({clearRect(){},fillRect(){},beginPath(){},roundRect(){},rect(){},fill(){},createLinearGradient:()=>({addColorStop(){}})});
  window.fetch=(u,i)=>fetch(String(u).startsWith('http')?String(u):BASE+String(u),i);
  window.localStorage.setItem('sn_agreed',String(Date.now()));
  if(o.name)window.localStorage.setItem('sn_me',JSON.stringify(o.name));
  const sc=doc.createElement('script');sc.textContent=app;doc.body.appendChild(sc);
  return {window,doc,errs,$:s=>doc.querySelector(s),$$:s=>[...doc.querySelectorAll(s)],
    click(s){const e=typeof s==='string'?doc.querySelector(s):s;if(!e)throw new Error('missing '+s);
      e.dispatchEvent(new window.MouseEvent('click',{bubbles:true,cancelable:true}))}};
}
(async()=>{
  const b=mk({name:'Hunter'});await sleep(1800);

  // --- Get the App page ---
  try{const before=b.errs.length;
    b.click('.nav[data-v="get"]');await sleep(2200);
    const cards=b.$$('#view .dlcard').length;
    cards>=4?pass('get-the-app cards',cards):fail('get-the-app cards',cards);
    const live=b.$$('#view .dlcard a.go[href]').length;
    live>=3?pass('download links present',live):fail('download links present',live);
    b.errs.length===before?pass('get page error-free'):fail('get page error-free',b.errs[before]);
  }catch(e){fail('get page error-free',e.message)}

  // --- room: rapid actions, empty states, double-join ---
  try{
    b.click('.nav[data-v="room"]');await sleep(500);
    b.click('#rC');await sleep(2500);
    const before=b.errs.length;
    // spam every room button while the queue is empty
    ['#rShare','#rCopy'].forEach(s=>{try{b.click(s)}catch(e){}});
    if(b.$('#mx'))b.click('#mx');
    b.$$('#view .qtools .sbtn, #view .chips .sbtn').forEach(x=>{try{x.click()}catch(e){}});
    await sleep(800);
    b.doc.querySelectorAll('.mdl.open #mx, .mdl.open .db').forEach(x=>{try{x.click()}catch(e){}});
    await sleep(600);
    b.errs.length===before?pass('room buttons safe with empty queue'):fail('room buttons safe with empty queue',b.errs[before]);
  }catch(e){fail('room buttons safe with empty queue',e.message)}

  // --- room: search then rapid add/play ---
  try{
    const before=b.errs.length;
    b.$('#rFind').value='arijit';b.click('#rFindGo');await sleep(3000);
    const rows=b.$$('#rRes .rrq');
    rows.length?pass('room search results',rows.length):fail('room search results','0');
    for(let i=0;i<Math.min(4,rows.length);i++){
      rows[i].querySelector('[data-a="add"]').dispatchEvent(new b.window.MouseEvent('click',{bubbles:true}));
      await sleep(120);
    }
    await sleep(2500);
    const q=b.$$('#rQList .rqi').length;
    q>=2?pass('rapid adds land in queue',q+' tracks'):fail('rapid adds land in queue',q);
    b.errs.length===before?pass('rapid room adds error-free'):fail('rapid room adds error-free',b.errs[before]);
  }catch(e){fail('rapid room adds error-free',e.message)}

  // --- room: remove every track quickly ---
  try{
    const before=b.errs.length;
    let guard=0;
    while(b.$$('#rQList .rqi').length && guard++<8){
      const x=b.$('#rQList .rqi .qx');
      if(!x)break;
      x.dispatchEvent(new b.window.MouseEvent('click',{bubbles:true}));
      await sleep(500);
    }
    await sleep(1200);
    b.errs.length===before?pass('removing every track is safe'):fail('removing every track is safe',b.errs[before]);
    const empty=b.$('#rQList').textContent;
    /Find music|empty|Loading/i.test(empty)?pass('empty queue shows guidance'):fail('empty queue shows guidance',empty.slice(0,60));
  }catch(e){fail('removing every track is safe',e.message)}

  // --- room: chat spam ---
  try{
    const before=b.errs.length;
    for(let i=0;i<6;i++){b.$('#rMsg').value='msg '+i;b.click('#rSend');await sleep(90)}
    await sleep(2000);
    const c=b.$('#rChat2').textContent;
    c.includes('msg 5')?pass('rapid chat delivers'):fail('rapid chat delivers',c.slice(-60));
    b.errs.length===before?pass('chat spam error-free'):fail('chat spam error-free',b.errs[before]);
  }catch(e){fail('chat spam error-free',e.message)}

  // --- leave then rejoin the same room ---
  try{
    const before=b.errs.length;
    const code=(b.$('.cd2')||{}).textContent||'';
    b.click('#rLeave');await sleep(300);
    if(b.$('#lYes'))b.click('#lYes');
    await sleep(1500);
    const backToLobby=!!b.$('#rC');
    backToLobby?pass('leaving returns to the lobby'):fail('leaving returns to the lobby','still in room');
    if(backToLobby&&code){
      b.$('#rCode').value=code;b.click('#rJ');await sleep(1400);
      if(b.$('#jYes'))b.click('#jYes');
      await sleep(2500);
      b.$('#rQList')?pass('rejoining the same room works'):fail('rejoining the same room works','no queue card');
    }
    b.errs.length===before?pass('leave/rejoin error-free'):fail('leave/rejoin error-free',b.errs[before]);
  }catch(e){fail('leave/rejoin error-free',e.message)}

  // --- navigating away from a room and back ---
  try{
    const before=b.errs.length;
    b.click('.nav[data-v="home"]');await sleep(1500);
    b.click('.nav[data-v="room"]');await sleep(1500);
    const alive=!!b.$('#rQList')||!!b.$('#rC');
    alive?pass('room view survives navigation'):fail('room view survives navigation','blank');
    b.errs.length===before?pass('navigation with an active room is safe'):fail('navigation with an active room is safe',b.errs[before]);
  }catch(e){fail('navigation with an active room is safe',e.message)}

  await sleep(400);
  b.errs.length===0?pass('zero runtime errors overall'):fail('zero runtime errors overall',[...new Set(b.errs)].slice(0,2).join(' | '));

  const ok=R.filter(r=>r.ok).length;
  console.log('\n'+'='.repeat(64));
  R.forEach(r=>console.log(`${r.ok?' PASS':' FAIL'}  ${r.n}${r.e?'  — '+r.e:''}${r.w?'  — '+r.w:''}`));
  console.log('='.repeat(64));console.log(`${ok}/${R.length} passed`);
  if(b.errs.length){console.log('\nerrors:');[...new Set(b.errs)].slice(0,6).forEach(e=>console.log('  '+e))}
  process.exit(0);
})().catch(e=>{console.error('CRASH',e);process.exit(2)});
