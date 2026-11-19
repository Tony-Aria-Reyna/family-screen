// Wake-up verses are written ahead by the 5-minute run and played at once; a used one is replaced on the next run.
const fs=require('fs');
const code=fs.readFileSync('notifier/Code.gs','utf8').replace('__PROJECT_ID__','p').replace('__APP_URL__','x').replace('{/*@TZ@*/}','{}');
const DB={'households/H':{voiceKey:'VK1234567890abc',billEmail:'',inboxEmail:'',members:[],live:{},wakeStyle:'funny',
  people:[{id:'all',name:'Everyone'},{id:'p1',name:'Tony'},{id:'p3',name:'Aria'}],devices:{}},'households/H/secrets/ai':{gemini:'GK'}};
const PP={}; const G={gcalls:0,fail:false}; let now=new Date(2026,10,18,5,0,0);
const mocks=`
 function listDocs(p){ const pre=p+'/'; return Object.keys(DB).filter(k=>k.startsWith(pre)&&k.slice(pre.length).indexOf('/')<0).map(k=>Object.assign({},DB[k],{_id:k.split('/').pop()})); }
 function runQuery(par,col,w){ return listDocs(par+'/'+col); }
 function fetchManyLoose(specs){ return fetchMany(specs); } function fetchMany(specs){ return specs.map(s=>s.kind==='doc'?(DB[s.path]||null):listDocs(s.kind==='list'?s.path:s.parent+'/'+s.col)); }
 function recentFlights(hp){ return listDocs(hp+'/flights'); } function getDoc(p){ return DB[p]||null; } function patch(p,f){ DB[p]=Object.assign({},DB[p]||{},f); }
 function send(){} function syncRules(){return {ok:true};} function selfUpdate(){return null;} function trackFlights(){} function wakeWeather(){ return 'sunny, a high of 22 degrees'; }
 function gemini(k,parts){ G.gcalls++; if(G.fail) throw new Error('Gemini 503'); return JSON.stringify({lines:['Aria, Aria, kiwi '+G.gcalls+',','up you hop, the sun is high!','Pancakes wait with Machan near,','jump out, the day is here!']}); }
 const PropertiesService={getScriptProperties:()=>({getProperty:k=>PP[k]||null,setProperty:(k,v)=>{PP[k]=String(v);},deleteProperty:k=>{delete PP[k];},getProperties:()=>Object.assign({},PP)})};
 const Logger={log(){}}; const ContentService={createTextOutput:t=>({t,setMimeType(){return this}}),MimeType:{JSON:1}};`;
DB['households/H/events/e1']={id:'e1',title:'Japanese School',date:'2026-11-18',time:'16:00',whos:['p3']};
const api=new Function('DB','PP','G','Date',code+mocks+';return {tick, voiceDo, listDocs, keyOf};')(DB,PP,G,class extends Date{constructor(...a){ a.length?super(...a):super(now.getTime()); } static now(){ return now.getTime(); }});
const h=()=>Object.assign({},DB['households/H'],{_id:'H'});
let bad=0; const ok=(c,m)=>{ console.log((c?'✓ ':'✗ ')+m); if(!c) bad++; };
now=new Date(2026,10,18,3,0,0); api.tick(); ok(G.gcalls===0,'3am: nothing written yet');
now=new Date(2026,10,18,5,0,0); api.tick(); ok(G.gcalls===2&&PP['WAKEV|H|p1']&&PP['WAKEV|H|p3'],'5am: a verse is written for each person ('+G.gcalls+' AI calls)');
api.tick(); ok(G.gcalls===2,'next run: nothing new to write');
const before=G.gcalls; let r=api.voiceDo(h(),'wake',{person:'Aria'}); ok(G.gcalls===before&&/kiwi 2|kiwi 1/.test(r.speech)&&/rooster/.test(r.ssml),'wake: played from the stored verse, no AI call');
r=api.voiceDo(h(),'wake',{person:'Aria'}); ok(G.gcalls===before+1,'asked again at once: written on the spot');
api.tick(); const used=JSON.parse(PP['WAKEV|H|p3']); ok(!used.used&&used.song,'next run: a fresh verse is stored again');
r=api.voiceDo(h(),'wake',{person:'Aria'}); ok(/kiwi/.test(r.speech),'third ask: instant again');
G.fail=true; api.voiceDo(h(),'wake',{person:'Tony'}); const t0=G.gcalls; api.tick(); ok(JSON.parse(PP['WAKEV|H|p3']).used===true&&G.gcalls>t0,'AI down: tick tries, a built-in rhyme is never stored');
ok(!/built-in/.test(PP['WAKEV|H|p3']||''),'nothing stored for a failed write');
now=new Date(2026,10,19,5,0,0); G.fail=false; r=api.voiceDo(h(),'wake',{person:'Aria'}); ok(/kiwi/.test(r.speech)&&G.gcalls>t0,'next day: yesterday\'s verse is not reused');
console.log(bad?bad+' FAILED':'all good'); process.exit(bad?1:0);
