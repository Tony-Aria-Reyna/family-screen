// Helper v26: "what's on" answers worked out ahead (2.5) and messages by voice (3.2)
const fs=require('fs');
const code=fs.readFileSync('notifier/Code.gs','utf8').replace('__PROJECT_ID__','p').replace('__APP_URL__','https://x/').replace('{/*@TZ@*/}','{}');
const K=d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
const now=new Date(), today=K(now), tomorrow=K(new Date(now.getTime()+864e5));
const DB={
 'households/h1':{voiceKey:'VOICEKEY123456',evAt:111,alexaFrom:'p3',voiceIds:{amzn1:'p1'},members:['tony@x.com','reyna@x.com'],
   people:[{id:'p1',name:'Tony',email:'tony@x.com'},{id:'p2',name:'Reyna',nick:'Mummy',email:'reyna@x.com',traveller:true},{id:'p3',name:'Aria'},{id:'all',name:'Everyone'}],
   devices:{d1:{token:'tokR',email:'reyna@x.com',label:'Reyna phone'},d2:{token:'tokT',email:'tony@x.com',label:'Tony phone'}},live:{}},
 'households/h1/events/e1':{title:'Swimming',date:today,time:'16:30',whos:['p3']},
 'households/h1/events/e2':{title:'Dentist',date:tomorrow,time:'09:00',whos:['p2']},
 'households/h1/msgs/m0':{th:'p2|p3',from:'p2',text:'Love you too',at:now.getTime()-3600e3},
};
const PP={}, SENT=[]; let READS=0;
const mocks=`
function fetchManyLoose(specs){ return fetchMany(specs); }
function fetchMany(specs){ READS++; return specs.map(s=>{ if(s.kind==='doc') return DB[s.path]?Object.assign({},DB[s.path],{_id:s.path.split('/').pop()}):null; return listDocs(s.kind==='list'?s.path:s.parent+'/'+s.col); }); }
function listDocs(p){ const pre=p+'/'; return Object.keys(DB).filter(k=>k.startsWith(pre)&&k.slice(pre.length).indexOf('/')<0).map(k=>Object.assign({},DB[k],{_id:k.split('/').pop()})); }
function runQuery(par,col){ return listDocs(par+'/'+col); }
function patch(p,f){ DB[p]=Object.assign({},DB[p]||{},JSON.parse(JSON.stringify(f))); }
function getDoc(p){ return DB[p]?Object.assign({},DB[p],{_id:p.split('/').pop()}):null; }
function headers(){ return {}; }
const UrlFetchApp={fetch:(u,o)=>{ if(/fcm/.test(u)){ const m=JSON.parse(o.payload).message; SENT.push(m.token+' | '+m.data.title+' | '+m.data.body); } return {getResponseCode:()=>200,getContentText:()=>'{}'}; }};
const PropertiesService={getScriptProperties:()=>({getProperty:k=>PP[k]||null,setProperty:(k,v)=>{PP[k]=String(v);},deleteProperty:k=>{delete PP[k];},getProperties:()=>Object.assign({},PP)})};
const Logger={log(){}};`;
const ContentService={createTextOutput:t=>({t,setMimeType(){return this}}),MimeType:{JSON:1}};
const f=new Function('DB','PP','SENT','ContentService','READS',code+mocks+'; return {doPost,agendaPrep};')(DB,PP,SENT,ContentService,0);
const call=(action,extra)=>JSON.parse(f.doPost({postData:{contents:JSON.stringify(Object.assign({key:'VOICEKEY123456',action,via:'alexa'},extra))}}).t);
let bad=0; const ok=(c,m)=>{ console.log((c?'✓ ':'✗ ')+m); if(!c) bad++; };
const h=()=>Object.assign({},DB['households/h1'],{_id:'h1'});
// 2.5
const at6=new Date(now); at6.setHours(Math.max(now.getHours(),6));
ok(f.agendaPrep(h(),PropertiesService_get(),at6)===true,'1 the answers are worked out on a run');
function PropertiesService_get(){ return {getProperty:k=>PP[k]||null,setProperty:(k,v)=>{PP[k]=String(v);},deleteProperty:k=>{delete PP[k];}}; }
ok(f.agendaPrep(h(),PropertiesService_get(),at6)===false,'2 and not again while nothing has changed');
let r=call('agenda',{date:today}); ok(r.ready&&/Swimming/.test(r.speech),'3 "what\'s on today" answered from them: '+r.speech);
r=call('agenda',{date:'2026-W47'}); ok(r.ready!==undefined||/This week|Nothing/.test(r.speech),'4 "this week": '+String(r.speech).slice(0,60));
DB['households/h1'].evAt=222; DB['households/h1/events/e3']={title:'Parent evening',date:today,time:'18:00',whos:[]};
r=call('agenda',{date:today}); ok(!r.ready&&/Parent evening/.test(r.speech),'5 a calendar change means a fresh answer: '+r.speech);
ok(f.agendaPrep(h(),PropertiesService_get(),at6)===true,'6 and the next run works them out again');
call('event_add',{title:'piano',date:today,time:'17:00'}); ok(!PP['AGENDA|h1'],'7 an entry added by voice clears them');
// 3.2
SENT.length=0; r=call('msg_send',{to:'p2',text:'I love you'});
const m=Object.keys(DB).filter(k=>/msgs\/v/.test(k)).map(k=>DB[k])[0]||{};
ok(m.th==='p2|p3'&&m.from==='p3'&&m.text==='I love you'&&m.via==='alexa','8 message saved in Aria and Mummy\'s thread: '+JSON.stringify(m));
ok(SENT.length===1&&/tokR/.test(SENT[0])&&/Aria/.test(SENT[0]),'9 pushed to Reyna\'s phone at once: '+SENT.join(' ; '));
ok(/Sent to Mummy/.test(r.speech),'10 Alexa says: '+r.speech);
SENT.length=0; r=call('msg_send',{to:'fam',text:'that dinner is ready',person_id:'amzn1'});
const m2=Object.keys(DB).filter(k=>/msgs\/v/.test(k)).map(k=>DB[k]).find(x=>x.th==='fam')||{};
ok(m2.from==='p1'&&m2.text==='Dinner is ready'&&SENT.length===1&&/tokR/.test(SENT[0]),'11 to everyone, from the voice Alexa knows (Tony), "that" dropped: '+JSON.stringify(m2)+' '+SENT.length);
r=call('msg_read',{}); ok(/Mummy said, Love you too/.test(r.speech),'12 "read my messages" for Aria: '+r.speech);
r=call('msg_send',{to:'zz',text:'hi'}); ok(/not sure who/.test(r.speech),'13 unknown person: '+r.speech);
console.log(bad?bad+' FAILED':'all passed');
