// Helper v24: health alerts to Tony, the Sunday week-ahead note, and how often the status is written.
const fs=require('fs');
const code=fs.readFileSync('notifier/Code.gs','utf8').replace('__PROJECT_ID__','p').replace('__APP_URL__','https://x/app/').replace('{/*@TZ@*/}','{}');
const pad=n=>(n<10?'0':'')+n, K=d=>d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());
function setup(){
  const DB={'households/H':{owner:'tony@x.com',members:['tony@x.com','reyna@x.com'],billEmail:'',inboxEmail:'',live:{},
    people:[{id:'all',name:'Everyone'},{id:'p1',name:'Tony',email:'tony@x.com'},{id:'p2',name:'Reyna',email:'reyna@x.com',traveller:true},{id:'p3',name:'Aria'},{id:'p4',name:'Masako',role:'Machan'}],
    devices:{d1:{token:'a',email:'tony@x.com',label:'Tony phone'},d2:{token:'b',email:'reyna@x.com',label:'Reyna phone'}}}};
  return {DB, PP:{}, G:{sent:[],mail:[],patches:[],fail:'',reads:1000,removed:[]}};
}
function load(env, when){
  const {DB,PP,G}=env; const T=when.getTime();
  class FD extends Date{ constructor(...a){ if(a.length) super(...a); else super(T); } static now(){ return T; } }
  const mocks=`
  function listDocs(p){ if(G.fail) throw new Error(G.fail); const pre=p+'/'; return Object.keys(DB).filter(k=>k.startsWith(pre)&&k.slice(pre.length).indexOf('/')<0).map(k=>Object.assign({},DB[k],{_id:k.split('/').pop()})); }
  function fetchMany(specs){ if(G.fail) throw new Error(G.fail); return specs.map(s=>s.kind==='doc'?(DB[s.path]?Object.assign({},DB[s.path],{_id:s.path.split('/').pop()}):null):listDocs(s.kind==='list'?s.path:s.parent+'/'+s.col)); }
  function fetchManyLoose(specs){ return fetchMany(specs); }
  function runQuery(par,col){ return listDocs(par+'/'+col); }
  function getDoc(p){ return DB[p]||null; }
  function patch(p,f){ G.patches.push(p); DB[p]=Object.assign({},DB[p]||{},JSON.parse(JSON.stringify(f))); }
  function readsToday(){ return {n:G.reads,day:'d'}; } function headers(){ return {}; }
  function syncRules(){ return {ok:true}; } function selfUpdate(){ return null; } function trackFlights(){} function wakePrep(){} function billsTick(){ return []; } function inboxTick(){ return []; }
  const UrlFetchApp={fetch:(u,o)=>{ if(/fcm/.test(u)){ const tok=JSON.parse(o.payload).message.token; G.sent.push(tok+' | '+JSON.parse(o.payload).message.data.title); return {getResponseCode:()=>tok==='dead'?404:200,getContentText:()=>'{}'}; }
    if(/updateMask/.test(u)){ G.removed.push(decodeURIComponent(u.split('fieldPaths=')[1])); const h=DB['households/H']; Object.keys(h.devices).forEach(k=>{ if(h.devices[k].token==='dead') delete h.devices[k]; }); return {getResponseCode:()=>200,getContentText:()=>'{}'}; }
    return {getResponseCode:()=>200,getContentText:()=>'{}'}; }};
  const GmailApp={sendEmail:(to,subj,body)=>G.mail.push(to+' | '+subj)}; const Session={getEffectiveUser:()=>({getEmail:()=>'tony@x.com'})};
  const Utilities={formatDate:(d,tz,f)=>f==='EEE'?['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d.getDay()]:f==='XXX'?'-08:00':d.toDateString()};
  const CacheService={getScriptCache:()=>({get:()=>null,put:()=>{}})};
  const PropertiesService={getScriptProperties:()=>({getProperty:k=>PP[k]||null,setProperty:(k,v)=>{PP[k]=String(v);},deleteProperty:k=>{delete PP[k];},getProperties:()=>Object.assign({},PP)})};
  const Logger={log(){}};`;
  return new Function('DB','PP','G','Date',code+mocks+';return {tick, noteVoice, healthAfterRun, hRead, vAka, weekAhead};')(DB,PP,G,FD);
}
let bad=0; const ok=(c,m)=>{ console.log((c?'✓ ':'✗ ')+m); if(!c) bad++; };
const at=(d,h,m)=>new Date(2026,10,d,h,m||0,0);
// 1. three failed runs in a row → one alert (push to Tony's phone + email), not before, not repeated within 6 hours
{ const env=setup(); let api=load(env,at(16,10,0)); api.tick();
  env.DB['households/H'].x=1;
  const failRun=(t)=>{ const api=load(env,t); const orig=api; env.G.failNext=true; return api; };
  // make the household reads fail but not the family list: fail inside runReads by removing access
  const realFail=(t)=>{ const a=load(env,t); env.G.fail=''; const DBh=env.DB['households/H']; DBh.members=['tony@x.com','reyna@x.com']; return a; };
  let n0=env.G.mail.length;
  for(let i=1;i<=4;i++){ const a=load(env,at(16,10,5*i)); env.G.fail=''; /* simulate a per-household failure */ const hk=env.PP; a.healthAfterRun(Object.assign({},env.DB['households/H'],{_id:'H'}),{getProperty:k=>hk[k]||null,setProperty:(k,v)=>{hk[k]=String(v);},deleteProperty:k=>{delete hk[k];}},at(16,10,5*i),'Reading events: 500 boom',{}); }
  ok(env.G.mail.length-n0===1 && env.G.sent.filter(s=>/failing/.test(s)).length===1, '1 three failed runs → one alert by push and email ('+(env.G.mail.length-n0)+')');
}
// 2. the database's daily limit → alert at once
{ const env=setup(); const a=load(env,at(16,12)); const P=env.PP, pr={getProperty:k=>P[k]||null,setProperty:(k,v)=>{P[k]=String(v);},deleteProperty:k=>{delete P[k];}};
  a.healthAfterRun(Object.assign({},env.DB['households/H'],{_id:'H'}),pr,at(16,12),'Reading households: 429 RESOURCE_EXHAUSTED',{});
  ok(env.G.mail.some(m=>/daily limit/.test(m)), '2 daily limit → alert on the first failure'); }
// 3. reads over 30,000 → one alert a day
{ const env=setup(); env.G.reads=35000; let a=load(env,at(16,13)); a.tick(); a=load(env,at(16,14,5)); a.tick();
  ok(env.G.mail.filter(m=>/reads are high/.test(m)).length===1, '3 reads at 35,000 → one alert ('+env.G.mail.filter(m=>/reads/.test(m)).length+')');
  ok(env.DB['households/H'].notifier.health.reads===35000, '3b the app sees today\'s reads in the status'); }
// 4. slow Alexa answers: two over 7 s → alert; the app's own requests don't count
{ const env=setup(); const a=load(env,at(16,8)); const h=Object.assign({},env.DB['households/H'],{_id:'H'});
  a.noteVoice(h,{action:'ask'},9000,false); a.noteVoice(h,{action:'ask',via:'alexa'},3000,false); a.noteVoice(h,{action:'ask',via:'alexa'},8200,false);
  load(env,at(16,8,5)).tick(); const one=env.G.mail.filter(m=>/slow/.test(m)).length;
  a.noteVoice(h,{action:'wake',via:'alexa'},0,true); load(env,at(16,8,10)).tick();
  ok(one===0 && env.G.mail.filter(m=>/slow/.test(m)).length===1, '4 slow Alexa answers: alert after the second one only ('+one+')'); }
// 5. a calendar feed that stopped updating (checked at 7am)
{ const env=setup(); env.DB['households/H/sources/s1']={id:'s1',type:'school',label:'Oratia School',url:'https://x/ics',at:at(10,9).getTime()};
  env.DB['households/H/sources/s2']={id:'s2',type:'roster',label:'roster.pdf',at:at(1,9).getTime()};
  load(env,at(16,6,55)).tick(); const before=env.G.mail.filter(m=>/stopped updating/.test(m)).length; load(env,at(16,7,0)).tick();
  ok(before===0 && env.G.mail.filter(m=>/stopped updating/.test(m)).length===1 && env.DB['households/H'].notifier.health.stale.join()==='Oratia School', '5 stale school feed → alert at 7am, roster PDFs ignored'); }
// 6. a phone Google dropped: forgotten, Tony told, its owner emailed
{ const env=setup(); env.DB['households/H'].devices.d2.token='dead'; env.DB['households/H/msgs/m1']={id:'m1',from:'p1',th:'p1|p2',text:'hi',at:at(16,9).getTime()};
  load(env,at(16,9,1)).tick(); load(env,at(16,9,6)).tick();
  ok(env.G.removed.length===1 && env.G.mail.some(m=>/^tony@x.com \| .*stopped getting alerts/.test(m)) && env.G.mail.some(m=>/^reyna@x.com \| .*alerts stopped/.test(m)), '6 dropped phone: removed, Tony alerted, Reyna emailed'); }
// 7. Sunday 6pm: the week ahead, once, to Tony and Reyna
{ const env=setup(); env.DB['households/H/events/e1']={id:'e1',title:'Swimming',date:'2026-11-24',time:'16:00',whos:['p3']};
  env.DB['households/H/todos/t1']={id:'t1',title:'Fix the gate',done:false}; env.DB['households/H/todos/t2']={id:'t2',title:'Book WOF',done:false,who:'p1'};
  env.DB['households/H/flights/f1']={id:'f1',who:'p2',flight:'NZ81',from:'AKL',to:'HKG',start:new Date(2026,10,27,10,10).toISOString(),end:new Date(2026,10,27,22,0).toISOString()};
  load(env,at(22,17,55)).tick(); const early=env.G.sent.filter(s=>/week ahead/.test(s)).length;
  load(env,at(22,18,0)).tick(); load(env,at(22,18,5)).tick();
  const pushes=env.G.sent.filter(s=>/week ahead/.test(s)), mails=env.G.mail.filter(m=>/week ahead/.test(m));
  ok(early===0 && pushes.length===2 && mails.length===2 && mails.some(m=>/^reyna/.test(m)), '7 week ahead: Sunday 6pm, once, push + email to Tony and Reyna ('+pushes.length+','+mails.length+')');
  const wa=load(env,at(29,18,0)).weekAhead(Object.assign({},env.DB['households/H'],{_id:'H'}),{getProperty:k=>env.PP[k]||null,setProperty:(k,v)=>{env.PP[k]=String(v);},deleteProperty:k=>{delete env.PP[k];}},at(29,18,0),{});
  ok(!!wa && /Jobs nobody owns yet \(1\): Fix the gate/.test(wa.body), '7b the note lists the job nobody owns'); }
// 8. the status is written every 10 minutes, not every run (each write makes every open screen read again)
{ const env=setup(); for(let i=0;i<6;i++) load(env,at(16,15,5*i)).tick(); const w=env.G.patches.filter(p=>p==='households/H').length;
  ok(w===3, '8 status written 3 times in 30 minutes instead of 6 ('+w+')'); }
// 9. names: the "who they are" box counts when it is a name
{ const a=load(setup(),at(16,9)); ok(a.vAka({name:'Masako',role:'Machan',aka:'Obachan, Grandma'}).join()==='Masako,Machan,Obachan,Grandma' && a.vAka({name:'Masako',role:"Mum's mother, lives with us"}).join()==='Masako', '9 Machan from the "who they are" box; a sentence there is ignored'); }
console.log(bad?bad+' FAILED':'all good'); process.exit(bad?1:0);
