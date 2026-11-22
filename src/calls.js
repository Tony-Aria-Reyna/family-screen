
/* ================= 4.0 Voice and video calls =================
   A call goes straight between the two screens (WebRTC), not through a server. The family's database only carries the
   set-up notes: who is calling whom, and how the two screens can reach each other. 📞 or 🎥 in any chat starts one.
   A call to a person rings that person's phone. A call to Family rings every screen, the fridge included, and the first
   one to answer gets it. The Reminder helper sends the "is calling" alert to phones that don't have the app open.
   The camera can be turned on or off at any time during a call, so a voice call can become a video call. */
const CALL_DEV=(()=>{ try{ let v=sessionStorage.getItem('fs.callDev'); if(!v){ v='d'+Math.random().toString(36).slice(2,10); sessionStorage.setItem('fs.callDev',v); } return v; }catch(e){ return 'd'+Math.random().toString(36).slice(2,10); } })();
const CALL_RING_MS=60e3;   // long enough to notice the alert on a phone, tap it and have the app open
let call=null, callList=[], callRingT=0, callCtx=null; const callGone=new Set();
const callDur=s=>{ s=Math.max(0,Math.round(+s||0)); return s<60?s+' sec':s<3600?Math.round(s/60)+' min':Math.floor(s/3600)+' h '+Math.round(s%3600/60)+' min'; };
const callClock=s=>{ s=Math.max(0,Math.floor(s)); const h=Math.floor(s/3600), m=Math.floor(s%3600/60), x=String(s%60).padStart(2,'0'); return h?h+':'+String(m).padStart(2,'0')+':'+x:m+':'+x; };
// who this screen answers for: a phone rings for its owner; a shared screen for the people picked in Settings (the kids, unless changed)
function callFor(){ const me=mePerson(); if(isPhone()) return me?[me]:[];
  const all=msgFolk().map(p=>p.id), pick=lsGet('fs.callFor',null); return Array.isArray(pick)?pick.filter(id=>all.includes(id)):msgWho(); }
const callFam=()=>isPhone()?!!mePerson():lsGet('fs.callFam','1')==='1';

/* ---- how the two screens find each other: free public address-finders, plus a relay if the helper has one set up ---- */
/* Safety switch: the data that goes through the relay is counted for the whole household each month. Past RELAY_CAP_GB
   the relay is left out (calls still work on the same Wi-Fi), so the relay's free monthly allowance (20 GB) is never passed. */
const RELAY_CAP_GB=18;
const relayMonth=()=>new Date().toISOString().slice(0,7);
const relayUsed=()=>S.relayUse&&S.relayUse.m===relayMonth()?(+S.relayUse.b||0):0;
const relayCapped=()=>relayUsed()>=RELAY_CAP_GB*1e9;
async function callRelayCheck(c){ try{ const st=await c.pc.getStats(); let pair=null; st.forEach(r=>{ if(r.type==='transport'&&r.selectedCandidatePairId) pair=st.get(r.selectedCandidatePairId)||pair; }); if(!pair) st.forEach(r=>{ if(r.type==='candidate-pair'&&r.state==='succeeded'&&(r.nominated||r.selected)) pair=pair||r; });
  if(!pair) return; const l=st.get(pair.localCandidateId), r=st.get(pair.remoteCandidateId); c.relay=!!((l&&l.candidateType==='relay')||(r&&r.candidateType==='relay')); if(c.relay) c.relayB=Math.max(c.relayB||0,(+pair.bytesSent||0)+(+pair.bytesReceived||0)); }catch(e){} }
function callIce(){ const c=lsGet('fs.ice',null), extra=!relayCapped()&&c&&c.until>Date.now()&&Array.isArray(c.ice)?c.ice:[];
  return [{urls:['stun:stun.l.google.com:19302','stun:stun.cloudflare.com:3478']}].concat(extra); }
async function callIceRefresh(){ const c=lsGet('fs.ice',null); if((c&&c.until>Date.now()+3600e3)||!S.voiceUrl||!navigator.onLine||(SYNC.isLimited&&SYNC.isLimited())) return;
  const r=await helperDo('call_ice'), ok=r&&Array.isArray(r.ice);
  lsSet('fs.ice',{ice:ok?r.ice.filter(x=>x&&x.urls&&x.username):[],until:Date.now()+(ok?Math.max(3600,(+r.ttl||43200)-4*3600):3600)*1000}); }
setTimeout(()=>{ callIceRefresh().catch(()=>{}); },40e3);

/* ---- ringing sounds, made on the spot (no sound files) ---- */
function callBeep(notes,vol){ try{ callCtx=callCtx||new (window.AudioContext||window.webkitAudioContext)(); if(callCtx.state==='suspended') callCtx.resume(); const t=callCtx.currentTime+.02;
  notes.forEach(([f,at,len])=>{ const o=callCtx.createOscillator(), g=callCtx.createGain(); o.type='sine'; o.frequency.value=f; o.connect(g); g.connect(callCtx.destination);
    g.gain.setValueAtTime(.0001,t+at); g.gain.exponentialRampToValueAtTime(vol,t+at+.03); g.gain.setValueAtTime(vol,t+at+len-.06); g.gain.exponentialRampToValueAtTime(.0001,t+at+len); o.start(t+at); o.stop(t+at+len+.02); }); }catch(e){} }
function callRingStop(){ clearInterval(callRingT); callRingT=0; try{ navigator.vibrate&&navigator.vibrate(0); }catch(e){} }
function callRing(){ callRingStop(); const h=new Date().getHours(), quiet=!isPhone()&&(h>=21||h<7);   // the shared screen stays silent at night (it still shows the call); phones ring
  const go=()=>{ if(!quiet) callBeep([[784,0,.18],[988,.2,.18],[1175,.4,.18],[1568,.6,.3],[1175,1.0,.18],[1568,1.2,.34]],.22); try{ navigator.vibrate&&navigator.vibrate([350,150,350,150,500]); }catch(e){} };
  go(); callRingT=setInterval(go,2600); }
function callRingback(){ callRingStop(); const go=()=>callBeep([[400,0,.4],[450,0,.4],[400,.6,.4],[450,.6,.4]],.05); go(); callRingT=setInterval(go,3000); }
function callClearNotes(){ try{ navigator.serviceWorker&&navigator.serviceWorker.getRegistration().then(r=>r&&r.getNotifications&&r.getNotifications().then(ns=>ns.forEach(n=>{ if(/^call-/.test(n.tag||'')) n.close(); }))).catch(()=>{}); }catch(e){} }

/* ---- the call screen: built once, then only its labels and buttons change (so the video never restarts) ---- */
function callShow(){ let el=document.getElementById('callUI'); if(el) el.remove(); el=document.createElement('div'); el.id='callUI';
  el.innerHTML=`<video id="cvR" autoplay playsinline></video><div class="cinfo"><span class="cface" id="cFace"></span><div><h2 id="cName"></h2><p id="cSt"></p></div></div><video id="cvL" autoplay playsinline muted></video><button class="cmini" id="cMin" aria-label="Make the call small">⌄</button><div class="cbar" id="cBar"></div>`;
  document.body.appendChild(el);
  el.querySelector('#cMin').onclick=e=>{ e.stopPropagation(); el.classList.add('c-mini'); };
  el.addEventListener('click',()=>{ if(el.classList.contains('c-mini')) el.classList.remove('c-mini'); });
  const c=call;
  try{ navigator.wakeLock&&navigator.wakeLock.request('screen').then(w=>{ if(call===c) c.wake=w; else w.release(); }).catch(()=>{}); }catch(e){}
  c.tick=setInterval(()=>{ hubIdle=Date.now(); if(call===c&&c.st==='live'&&!c.weak){ const s=document.getElementById('cSt'); if(s) s.textContent=callClock((Date.now()-c.startAt)/1000); } },1000);
  if(typeof saverOff==='function') saverOff();
  callDraw(); }
function callDraw(){ const c=call, el=document.getElementById('callUI'); if(!c||!el) return;
  const pf=c.peer==='fam'||!!msgG(c.peer), name=msgName(c.peer)||'Family', v=c.kind==='video';
  el.className=(el.classList.contains('c-mini')?'c-mini ':'')+'cs-'+c.st+(c.st==='live'&&c.peerCam?' c-rv':'')+(c.camOn&&c.local&&c.st!=='ringing'?' c-lv':'')+(c.face==='environment'?' c-back':'');
  const f=el.querySelector('#cFace'); f.textContent=pf?'👪':(name.charAt(0)||'?'); f.style.background=pf?'#ffe9b8':col(c.peer);
  el.querySelector('#cName').textContent=name;
  el.querySelector('#cSt').textContent=c.st==='calling'?(c.sdpSent?'Ringing…':'Calling…'):c.st==='ringing'?(v?'Video call':'Voice call')+(c.to==='fam'?' to Family':''):c.st==='connecting'?'Connecting…':c.weak?'Reconnecting…':callClock((Date.now()-c.startAt)/1000);
  const b=(id,ico,label,cls)=>`<button id="${id}" class="cbtn ${cls||''}" aria-label="${label}"><span>${ico}</span><small>${label}</small></button>`;
  const bar=el.querySelector('#cBar'), key=[c.st==='ringing',c.micOn,c.camOn,c.canFlip,c.kind].join('|');
  if(bar.dataset.k!==key){ bar.dataset.k=key;
    bar.innerHTML=c.st==='ringing'?b('cNo','✕','Decline','red')+(v?b('cYesV','🎥','Answer','green'):'')+b('cYes','📞',v?'Voice only':'Answer','green')
      :b('cMic','🎤',c.micOn?'Mute':'Muted',c.micOn?'':'off')+b('cCam','🎥',c.camOn?'Camera':'Camera off',c.camOn?'':'off')+(c.camOn&&c.canFlip?b('cFlip','🔄','Flip'):'')+b('cEnd','📞','End','red end');
    const on=(id,fn)=>{ const x=bar.querySelector('#'+id); if(x) x.onclick=e=>{ e.stopPropagation(); fn(); }; };
    on('cNo',()=>callFinish('declined',true)); on('cYes',()=>callAnswer(false)); on('cYesV',()=>callAnswer(true));
    on('cMic',callMic); on('cCam',callCam); on('cFlip',callFlip); on('cEnd',()=>callFinish(call&&call.st==='live'?'ended':'cancelled',true)); }
  const R=el.querySelector('#cvR'), L=el.querySelector('#cvL');
  if(c.remote&&R.srcObject!==c.remote){ R.srcObject=c.remote; const p=R.play&&R.play(); if(p&&p.catch) p.catch(()=>{}); }
  if(c.local&&L.srcObject!==c.local){ L.srcObject=c.local; const p=L.play&&L.play(); if(p&&p.catch) p.catch(()=>{}); } }

/* ---- microphone, camera and the connection ---- */
const CALL_MIC={echoCancellation:true,noiseSuppression:true,autoGainControl:true}, callVid=face=>({facingMode:face||'user',width:{ideal:1280},height:{ideal:720}});
async function callMedia(video){
  try{ return await navigator.mediaDevices.getUserMedia({audio:CALL_MIC,video:video?callVid('user'):false}); }
  catch(e){ if(!video) throw e; const s=await navigator.mediaDevices.getUserMedia({audio:CALL_MIC,video:false}); toast('The camera isn’t available, so this is voice only'); return s; } }
const callSender=(c,kind)=>{ const t=c.pc&&c.pc.getTransceivers().find(x=>x.receiver&&x.receiver.track&&x.receiver.track.kind===kind); return t&&t.sender; };
const callGather=pc=>new Promise(ok=>{ if(pc.iceGatheringState==='complete') return ok(); const chk=()=>{ if(pc.iceGatheringState==='complete') done(); }, done=()=>{ clearTimeout(t); pc.removeEventListener('icegatheringstatechange',chk); ok(); }, t=setTimeout(done,2200); pc.addEventListener('icegatheringstatechange',chk); });
function callPC(c){
  const pc=c.pc=new RTCPeerConnection({iceServers:callIce()}); c.remote=new MediaStream(); c.late=[]; c.iceSeen=new Set();
  pc.ontrack=e=>{ if(!c.remote.getTracks().includes(e.track)) c.remote=new MediaStream(c.remote.getTracks().concat(e.track)); callDraw(); };   // a fresh stream each time, so every browser notices the new track
  // addresses found after the offer or answer has been sent are passed on a moment later
  pc.onicecandidate=e=>{ if(!e.candidate||!c.sdpRead) return; c.late.push(JSON.stringify(e.candidate.toJSON?e.candidate.toJSON():e.candidate)); if(c.sdpSent) callLateSend(c); };
  pc.onconnectionstatechange=()=>{ const s=pc.connectionState; if(call!==c) return;
    if(s==='connected'){ c.weak=false; clearTimeout(c.connT); if(c.st!=='live'){ c.st='live'; c.startAt=Date.now(); callRingStop(); callTell(); } setTimeout(()=>{ if(call===c) callRelayCheck(c); },2500); clearInterval(c.relayT); c.relayT=setInterval(()=>{ if(call===c) callRelayCheck(c); else clearInterval(c.relayT); },8000); callDraw(); }
    else if(s==='failed') callFinish(c.startAt?'lost':'failed',true);
    else if(s==='disconnected'){ c.weak=true; callDraw(); setTimeout(()=>{ if(call===c&&pc.connectionState==='disconnected') callFinish('lost',true); },12e3); } };
  return pc; }
function callLateSend(c){ clearTimeout(c.lateT); c.lateT=setTimeout(()=>{ const l=c.late.splice(0); if(l.length&&call===c) SYNC.callAddIce(c.id,c.role==='out'?'ca':'cb.'+CALL_DEV,l).catch(()=>{}); },350); }
function callIceIn(){ const c=call; if(!c||!c.pc||!c.doc||!c.pc.remoteDescription) return;
  const list=c.role==='out'?((c.doc.cb||{})[c.ansDev]||[]):(c.doc.ca||[]);
  list.forEach(j=>{ if(c.iceSeen.has(j)) return; c.iceSeen.add(j); try{ c.pc.addIceCandidate(JSON.parse(j)).catch(()=>{}); }catch(e){} }); }
// a small side-channel between the two screens: "my camera is on/off" and "I hung up" arrive instantly
function callCtl(c){ const dc=c.dc; dc.onopen=()=>callTell(); dc.onmessage=e=>{ if(call!==c) return; let m={}; try{ m=JSON.parse(e.data); }catch(x){} if('cam' in m){ c.peerCam=!!m.cam; if(m.cam) c.wasVideo=true; callDraw(); } if(m.bye) callFinish('ended',false); }; }
function callTell(){ const c=call; try{ if(c&&c.dc&&c.dc.readyState==='open') c.dc.send(JSON.stringify({cam:!!c.camOn,mic:!!c.micOn})); }catch(e){} }
function callMic(){ const c=call; if(!c||!c.local) return; c.micOn=!c.micOn; c.local.getAudioTracks().forEach(t=>{ t.enabled=c.micOn; }); callTell(); callDraw(); }
async function callCamTrack(c,face){ const st=await navigator.mediaDevices.getUserMedia({video:callVid(face)}), tr=st.getVideoTracks()[0]; if(call!==c){ tr.stop(); return null; }
  c.local=new MediaStream(c.local.getTracks().concat(tr)); const s=callSender(c,'video'); if(s) await s.replaceTrack(tr); return tr; }
async function callCam(){ const c=call; if(!c||!c.local||!c.pc||c.camBusy) return; c.camBusy=true;
  try{ if(c.camOn){ c.camOn=false; c.local.getVideoTracks().forEach(t=>t.stop()); c.local=new MediaStream(c.local.getAudioTracks()); const s=callSender(c,'video'); if(s) await s.replaceTrack(null); }
    else { if(await callCamTrack(c,c.face||'user')){ c.camOn=true; c.wasVideo=true; } } }
  catch(e){ toast('The camera is blocked or busy'); }
  c.camBusy=false; callTell(); callDraw(); }
async function callFlip(){ const c=call; if(!c||!c.camOn||c.camBusy) return; c.camBusy=true; const want=c.face==='environment'?'user':'environment';
  try{ c.local.getVideoTracks().forEach(t=>t.stop()); c.local=new MediaStream(c.local.getAudioTracks()); if(await callCamTrack(c,want)) c.face=want; }
  catch(e){ toast('Couldn’t switch camera'); try{ await callCamTrack(c,c.face||'user'); }catch(x){ c.camOn=false; } }
  c.camBusy=false; callTell(); callDraw(); }

/* ---- making a call ---- */
async function callStart(me,th,kind){
  if(call){ toast('You’re already in a call'); return; }
  if(!window.RTCPeerConnection||!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia){ toast('Calls aren’t supported in this browser'); return; }
  if(typeof LOCAL!=='undefined'&&LOCAL){ toast('Calls work once the family is signed in'); return; }
  if(!SYNC.callsReady||!SYNC.callsReady()){ toast('Calls will be ready within about 15 minutes: the database is updating itself'); return; }
  if(msgG(th)&&!msgG(th).ready){ toast('Calls with '+msgG(th).label+' will be ready within about 15 minutes: the database is updating itself'); return; }
  const fam=msgIsFam(th), to=fam?'fam':msgOther(th,me); if(!to) return;
  const c=call={id:SYNC.callNewId(th,uid()),role:'out',kind,from:me,to,th,peer:fam?msgOther(th,me):to,st:'calling',micOn:true,camOn:false,peerCam:false,at:Date.now(),canFlip:matchMedia('(pointer:coarse)').matches};
  callShow();
  try{
    try{ c.local=await callMedia(kind==='video'); }
    catch(e){ if(call===c){ call=null; clearInterval(c.tick); const el=document.getElementById('callUI'); if(el) el.remove(); toast('The microphone is blocked. Allow it for Family Screen in the browser’s site settings, then try again.'); } return; }
    if(call!==c){ c.local.getTracks().forEach(t=>t.stop()); return; }   // hung up while the permission box was open
    c.camOn=!!c.local.getVideoTracks().length; c.wasVideo=c.camOn; callDraw();
    const pc=callPC(c), at=pc.addTransceiver('audio',{direction:'sendrecv'}), vt=pc.addTransceiver('video',{direction:'sendrecv'});
    await at.sender.replaceTrack(c.local.getAudioTracks()[0]); if(c.camOn) await vt.sender.replaceTrack(c.local.getVideoTracks()[0]);
    c.dc=pc.createDataChannel('ctl'); callCtl(c);
    await pc.setLocalDescription(await pc.createOffer()); await callGather(pc); if(call!==c) return;
    const offer={type:'offer',sdp:pc.localDescription.sdp}; c.sdpRead=true;
    await SYNC.callPut(c.id,{from:me,to,th,kind,dev:CALL_DEV,at:c.at,st:'ring',offer});
    c.sdpSent=true; if(call!==c){ SYNC.callDrop(c.id); return; } if(c.late.length) callLateSend(c);
    // rings the phones that don't have the app open (for a chat with a linked family, their helper does it)
    { const h=SYNC.guestHelper(th); if(h) fetch(h.url,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({key:h.key,action:'call_ring',id:SYNC.rawId(c.id)}),redirect:'follow'}).catch(()=>{}); else if(!msgG(th)) helperDo('call_ring',{id:c.id}); }
    callRingback(); c.ringT=setTimeout(()=>{ if(call===c&&c.st==='calling') callFinish('noanswer',true); },CALL_RING_MS);
    callDraw();
  }catch(e){ console.warn('call',e); if(call===c) callFinish('failed',true); }
}
/* ---- answering ---- */
function callIncoming(d){
  const c=call={id:d.id,role:'in',kind:d.kind==='video'?'video':'audio',from:d.from,to:d.to,th:d.th,peer:d.from,st:'ringing',micOn:true,camOn:false,peerCam:false,doc:d,at:d.at,canFlip:matchMedia('(pointer:coarse)').matches};
  callShow(); callRing();
  c.ringT=setTimeout(()=>{ if(call===c&&c.st==='ringing') callFinish('missed',false); },Math.max(6e3,CALL_RING_MS+8e3-(Date.now()-(d.at||Date.now()))));
}
async function callAnswer(video){
  const c=call; if(!c||c.role!=='in'||c.st!=='ringing') return; c.st='connecting'; clearTimeout(c.ringT); callRingStop(); callClearNotes(); callDraw();
  try{
    try{ c.local=await callMedia(video); }
    catch(e){ if(call===c){ toast('The microphone is blocked. Allow it for Family Screen in the browser’s site settings, then call back.'); callFinish('declined',true); } return; }
    if(call!==c){ c.local.getTracks().forEach(t=>t.stop()); return; }
    c.camOn=!!c.local.getVideoTracks().length; c.wasVideo=c.camOn;
    const pc=callPC(c); pc.ondatachannel=e=>{ c.dc=e.channel; callCtl(c); };
    await pc.setRemoteDescription(c.doc.offer);
    for(const t of pc.getTransceivers()){ const k=t.receiver&&t.receiver.track&&t.receiver.track.kind; if(k!=='audio'&&k!=='video') continue; t.direction='sendrecv';
      const tr=k==='audio'?c.local.getAudioTracks()[0]:c.local.getVideoTracks()[0]; if(tr) await t.sender.replaceTrack(tr); }
    await pc.setLocalDescription(await pc.createAnswer()); await callGather(pc); if(call!==c) return;
    const sdp=pc.localDescription.sdp; c.sdpRead=true;
    await SYNC.callPatch(c.id,{['answers.'+CALL_DEV]:{sdp,at:Date.now()}});
    c.sdpSent=true; if(c.late.length) callLateSend(c); callIceIn();
    c.connT=setTimeout(()=>{ if(call===c&&c.st==='connecting') callFinish('failed',true); },25e3);
    callDraw();
  }catch(e){ console.warn('answer',e); if(call===c) callFinish('failed',true); }
}
/* ---- every way a call ends comes through here ---- */
function callFinish(why,mine){ const c=call; if(!c) return; call=null;
  clearTimeout(c.ringT); clearTimeout(c.connT); clearTimeout(c.lateT); clearInterval(c.tick); callRingStop(); callGone.add(c.id); callClearNotes();
  const dur=c.startAt?Math.round((Date.now()-c.startAt)/1000):0;
  clearInterval(c.relayT); if(c.relay&&c.relayB&&c.role==='out'){ S.relayUse={m:relayMonth(),b:relayUsed()+2*c.relayB}; try{ save(); }catch(e){} }   // counted in and out of the relay
  try{ if(mine&&c.dc&&c.dc.readyState==='open') c.dc.send(JSON.stringify({bye:1})); }catch(e){}
  if(c.role==='out'&&c.sdpSent){ if(mine) SYNC.callPatch(c.id,{st:'end',why}).catch(()=>{}); setTimeout(()=>SYNC.callDrop(c.id),mine?5000:800); callLog(c,dur); }
  else if(c.role==='in'&&mine&&!(c.st==='ringing'&&c.to==='fam')) SYNC.callPatch(c.id,{st:'end',why}).catch(()=>{});   // declining a Family call only stops this screen ringing
  try{ c.local&&c.local.getTracks().forEach(t=>t.stop()); }catch(e){} try{ c.pc&&c.pc.close(); }catch(e){} try{ c.wake&&c.wake.release(); }catch(e){}
  const el=document.getElementById('callUI'); if(el) el.remove();
  const who=msgName(c.peer)||'Family';
  const note=why==='failed'?'Couldn’t connect the call. Try again, or try a different Wi-Fi.':why==='lost'?'The call dropped':why==='noanswer'?'No answer':why==='declined'&&!mine?who+' can’t talk right now':why==='elsewhere'?'Answered on another screen'
    :c.role==='in'&&!mine&&!dur?'Missed call from '+who:dur?'Call ended · '+callDur(dur):'';
  if(note) toast(note);
  setTimeout(()=>{ if(msgOpen&&msgOpen.draw&&document.querySelector('#msgBox')) msgOpen.draw(); },250);
}
// the caller's screen writes the one line in the chat ("Video call · 12 min" or "Missed voice call")
function callLog(c,dur){ const v=c.kind==='video'||!!c.wasVideo, ok=dur>0;
  msgSend(c.from,c.th,ok?(v?'🎥 Video call':'📞 Voice call')+' · '+callDur(dur):'📞 Missed '+(v?'video':'voice')+' call',Object.assign({call:{kind:v?'video':'audio',dur,ok}},ok?{seenAll:true,pushed:Date.now()}:{})); }   // a call that happened is nobody's unread message

/* ---- the database tells every screen about each call ---- */
function callSync(){
  const now=Date.now();
  for(const d of callList){ const age=now-(+d.at||0); if((d.st==='ring'&&age>10*60e3)||(d.st==='end'&&age>10*60e3)||age>12*3600e3) SYNC.callDrop(d.id); }   // a record left behind by a screen that closed mid-call
  if(call){ const c=call, d=callList.find(x=>x.id===c.id);
    if(!d){ if(c.docSeen) callFinish(c.role==='in'&&c.st==='ringing'?'missed':'ended',false); return; }
    c.docSeen=true; c.doc=d;
    if(d.st==='end'){ callFinish(d.why==='declined'?'declined':c.role==='in'&&c.st==='ringing'?'missed':d.why==='failed'?'failed':'ended',false); return; }
    if(c.role==='out'){
      if(!c.ansDev&&d.answers){ const k=Object.keys(d.answers).sort((a,b)=>(d.answers[a].at||0)-(d.answers[b].at||0))[0];
        if(k){ c.ansDev=k; clearTimeout(c.ringT); callRingStop(); c.st='connecting'; callDraw();
          c.pc.setRemoteDescription({type:'answer',sdp:d.answers[k].sdp}).then(()=>{ if(call!==c) return; SYNC.callPatch(c.id,{ans:k,st:'live'}).catch(()=>{}); callIceIn(); c.connT=setTimeout(()=>{ if(call===c&&c.st==='connecting') callFinish('failed',true); },25e3); }).catch(()=>{ if(call===c) callFinish('failed',true); }); } }
      else callIceIn(); }
    else { if(d.ans&&d.ans!==CALL_DEV){ callFinish('elsewhere',false); return; } callIceIn(); }
    return; }
  // not in a call: is someone ringing this screen?
  const mine=callFor();
  const d=callList.find(x=>x.st==='ring'&&x.offer&&msgOk(x)&&x.dev!==CALL_DEV&&!x.ans&&!callGone.has(x.id)&&now-(+x.at||0)<100e3&&now-(+x.at||0)>-5*60e3
    &&(x.to==='fam'?callFam()&&!(mine.length===1&&mine[0]===x.from):mine.includes(x.to)));
  if(d) callIncoming(d);
}
if(window.SYNC&&SYNC.onCalls) SYNC.onCalls(list=>{ if(!list) return; callList=list; try{ callSync(); }catch(e){ console.warn('calls',e); } });
document.addEventListener('visibilitychange',()=>{ if(document.visibilityState==='visible'&&!call) setTimeout(()=>{ if(!call) callClearNotes(); },4000); });   // an old "is calling" alert for a call someone else answered
addEventListener('pagehide',()=>{ if(call) callFinish(call.st==='live'?'ended':call.role==='out'?'cancelled':'missed',call.role==='out'||call.st!=='ringing'); });
