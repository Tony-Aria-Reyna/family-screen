const fs=require('fs'), http=require('http');
// 1) the helper, as a little local server (the same Code.gs, mocked Firestore/Gemini)
let code=fs.readFileSync('/home/claude/fs-app/notifier/Code.gs','utf8').replace('__PROJECT_ID__','p').replace('__APP_URL__','x').replace('{/*@TZ@*/}','{AKL:["Pacific/Auckland","Auckland"],LAX:["America/Los_Angeles","Los Angeles"]}');
const K=d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
const now=new Date(), tomorrow=K(new Date(now.getTime()+864e5));
const DB={'households/h1':{voiceKey:'VK1234567890abc',people:[{id:'p1',name:'Tony'},{id:'p2',name:'Reyna',traveller:true},{id:'p3',name:'Aria'}],shops:[{id:'super',name:'Supermarket',aisles:true}],live:{}},
 'households/h1/secrets/ai':{gemini:'GK'},
 'households/h1/events/e1':{id:'e1',title:'Dentist',date:tomorrow,time:'09:00',whos:['p3']},
 'households/h1/todos/t1':{id:'t1',title:'Mow the lawns',who:'p1',done:false},
 'households/h1/todos/t2':{id:'t2',title:'Book the dentist',who:'p2',done:false},
 'households/h1/kids/k1':{id:'k1',kind:'jar',person:'p3',name:'Nintendo Switch',target:45000,log:[{amt:12000},{amt:2500}]},
 'households/h1/kids/k2':{id:'k2',kind:'jar',person:'p1',name:'Paraglider',target:800000,log:[{amt:150000}]}};
const ContentService={createTextOutput:t=>({t,setMimeType(){return this}}),MimeType:{JSON:1}};
const mocks=`
function listDocs(p){ const pre=p+'/'; return Object.keys(DB).filter(k=>k.startsWith(pre)&&k.slice(pre.length).indexOf('/')<0).map(k=>Object.assign({},DB[k],{_id:k.split('/').pop()})); }
function patch(p,f){ DB[p]=Object.assign({},DB[p]||{},JSON.parse(JSON.stringify(f))); }
function getDoc(p){ return DB[p]?Object.assign({},DB[p],{_id:p.split('/').pop()}):null; }
function gemini(k,parts,q){ return JSON.stringify({speech:'Dinner on Thursday is spaghetti; you still need mince.'}); }
`;
const helper=new Function('DB','ContentService',code+mocks+'; return doPost;')(DB,ContentService);
const srv=http.createServer((req,res)=>{ let b=''; req.on('data',c=>b+=c); req.on('end',()=>{
  if(req.method==='POST'){ res.writeHead(302,{Location:'http://127.0.0.1:'+srv.address().port+'/redirected'}); return res.end(); }
  const out=helper({postData:{contents:LAST}}).t; res.writeHead(200,{'Content-Type':'application/json'}); res.end(out); }); });
let LAST='{}';
// 2) the skill code exactly as the app generates it, with https pointed at the local helper
const PORT=18811;
srv.listen(PORT);
let skill=fs.readFileSync('/home/claude/fs-app/src/alexa-skill.js','utf8')
  .replace('__URL__','http://127.0.0.1:'+PORT+'/exec').replace('__KEY__','VK1234567890abc').replace('__PEOPLE__',JSON.stringify(['Tony','Reyna','Aria']))
  .replace("const https = require('https');","const https = require('http');");
fs.writeFileSync('/tmp/alexa/index.js',skill);
const handler=require('/tmp/alexa/index.js').handler;
// capture the POST body on its way through
const realReq=http.request; http.request=function(o,cb){ const r=realReq.call(http,o,cb); const w=r.write.bind(r); r.write=function(d){ LAST=String(d); return w(d); }; return r; };
const env=(type,intent,slots,attrs,person)=>({version:'1.0',session:{new:false,sessionId:'s1',application:{applicationId:'a1'},attributes:attrs||{},user:{userId:'u1'}},
  context:{System:Object.assign({application:{applicationId:'a1'},user:{userId:'u1'}},person?{person:{personId:person}}:{})},
  request:Object.assign({type,requestId:'r'+Math.random(),timestamp:new Date().toISOString(),locale:'en-AU'},
    type==='IntentRequest'?{dialogState:'STARTED',intent:{name:intent,confirmationStatus:'NONE',slots:Object.fromEntries(Object.entries(slots||{}).map(([k,v])=>[k,{name:k,value:v,confirmationStatus:'NONE'}]))}}:{})});
const run=(type,intent,slots,attrs,person)=>new Promise(r=>handler(env(type,intent,slots,attrs,person),{},(e,x)=>r(e?{err:String(e)}:x)));
const speech=r=>r.err||(r.response.outputSpeech&&r.response.outputSpeech.ssml||'').replace(/<[^>]+>/g,'').trim();
const dir=r=>(r.response.directives||[]).map(d=>d.type+(d.slotToElicit?':'+d.slotToElicit:'')).join(',');
(async()=>{
  const T=async(label,...a)=>{ const r=await run(...a); console.log(label.padEnd(22),JSON.stringify(speech(r)),dir(r)?'['+dir(r)+']':'', r.response.shouldEndSession===false?'(stays open)':''); return r; };
  await T('launch','LaunchRequest');
  await T('agenda tomorrow','IntentRequest','AgendaIntent',{when:tomorrow});
  await T('add milk','IntentRequest','AddShopIntent',{item:'milk'});
  await T('add nothing','IntentRequest','AddShopIntent',{});
  await T('shopping list','IntentRequest','ShopListIntent',{});
  await T('job no task','IntentRequest','AddJobIntent',{});
  await T('job no person','IntentRequest','AddJobIntent',{task:'fix the gate'});
  await T('job full','IntentRequest','AddJobIntent',{task:'fix the gate',person:'Reyna'});
  await T('job person asked','IntentRequest','AddJobIntent',{task:'fix the gate'},{asked_person:1});
  await T('event start','IntentRequest','AddEventIntent',{});
  await T('event title only','IntentRequest','AddEventIntent',{title:'swimming'});
  await T('event +day','IntentRequest','AddEventIntent',{title:'swimming',when:tomorrow},{asked_when:1});
  await T('event all asked','IntentRequest','AddEventIntent',{title:'swimming',when:tomorrow},{asked_when:1,asked_time:1,asked_person:1});
  await T('where','IntentRequest','WhereIntent',{});
  await T('bills','IntentRequest','BillsIntent',{});
  await T('meal','IntentRequest','MealIntent',{});
  await T('remember','IntentRequest','RememberIntent',{text:'the bins go out Tuesday'});
  await T('ask','IntentRequest','AskIntent',{q:'what do we need for thursday dinner'});
  await T('help','IntentRequest','AMAZON.HelpIntent',{});
  await T('stop','IntentRequest','AMAZON.StopIntent',{});
  await T('fallback','IntentRequest','AMAZON.FallbackIntent',{});
  console.log('--- voice profiles, confirmation, savings ---');
  await T('my jobs (unknown)','IntentRequest','MyJobsIntent',{});
  await T('my jobs (no voice)','IntentRequest','MyJobsIntent',{person:'Tony'},{asked_person:1});
  await T('i am Tony','IntentRequest','IdentifyIntent',{person:'Tony'},{},'amzn1.person.TONY');
  await T('my jobs (known)','IntentRequest','MyJobsIntent',{},{},'amzn1.person.TONY');
  await T('my jobs (other voice)','IntentRequest','MyJobsIntent',{},{},'amzn1.person.XXX');
  await T('jobs for Reyna','IntentRequest','JobsIntent',{person:'Reyna'});
  await T('job for me','IntentRequest','AddJobIntent',{task:'sharpen the mower'},{asked_person:1},'amzn1.person.TONY');
  await T('my savings','IntentRequest','JarsIntent',{},{},'amzn1.person.TONY');
  await T('Aria savings','IntentRequest','JarsIntent',{person:'Aria'});
  await T('all savings','IntentRequest','JarsIntent',{});
  await T('my savings 2','IntentRequest','MyJarsIntent',{},{},'amzn1.person.TONY');
  const c1=await T('event confirm','IntentRequest','AddEventIntent',{title:'swimming lesson',when:tomorrow,time:'16:30',person:'Aria'},{asked_when:1,asked_time:1,asked_person:1});
  const pend=c1.sessionAttributes;
  await T('→ yes','IntentRequest','AMAZON.YesIntent',{},pend);
  const c2=await T('event confirm 2','IntentRequest','AddEventIntent',{title:'book club',when:tomorrow},{asked_when:1,asked_time:1,asked_person:1});
  await T('→ no','IntentRequest','AMAZON.NoIntent',{},c2.sessionAttributes);
  await T('yes with nothing','IntentRequest','AMAZON.YesIntent',{});
  await T('where is Aria','IntentRequest','WhereIntent',{person:'Aria'});
  console.log('\nwritten:',Object.keys(DB).filter(k=>/\/v[a-z0-9]{10,}/.test(k)).map(k=>k.split('/').slice(-2).join('/')+' → '+JSON.stringify(DB[k])).join('\n   '));
  srv.close();
})();
