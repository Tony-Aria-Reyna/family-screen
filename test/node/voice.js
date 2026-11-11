const fs=require('fs');
let code=fs.readFileSync('/home/claude/fs-app/notifier/Code.gs','utf8').replace('__PROJECT_ID__','p').replace('__APP_URL__','https://x/').replace('{/*@TZ@*/}','{AKL:["Pacific/Auckland","Auckland"],LAX:["America/Los_Angeles","Los Angeles"],NRT:["Asia/Tokyo","Tokyo"]}');
const now=new Date('2026-11-12T10:00:00+13:00');
const K=d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
const tomorrow=K(new Date(now.getTime()+864e5)), friday=K(new Date(now.getTime()+2*864e5));
const DB={
 'households/h1':{voiceKey:'VOICEKEY123456',people:[{id:'p1',name:'Tony'},{id:'p2',name:'Reyna',traveller:true},{id:'p3',name:'Aria'},{id:'all',name:'Everyone'}],shops:[{id:'super',name:'Supermarket',aisles:true},{id:'butch',name:'Butcher'}],live:{}},
 'households/h1/secrets/ai':{gemini:'GK'},
 'households/h1/events/e1':{id:'e1',title:'Dentist',date:tomorrow,time:'09:00',whos:['p3']},
 'households/h1/events/e2':{id:'e2',title:'Book club',date:tomorrow,time:'19:30',whos:[]},
 'households/h1/events/e3':{id:'e3',title:'Secret thing',date:tomorrow,time:'08:00',whos:['p1'],priv:true},
 'households/h1/todos/t1':{id:'t1',title:'Mow the lawns',who:'p1',done:false},
 'households/h1/todos/t2':{id:'t2',title:'Book the dentist',who:'p2',done:false},
 'households/h1/todos/t3':{id:'t3',title:'Old done job',who:'p1',done:true},
 'households/h1/groceries/g1':{id:'g1',name:'Milk (2 L)',done:false,shop:'super'},
 'households/h1/groceries/g2':{id:'g2',name:'Bread',done:false,shop:'super'},
 'households/h1/flights/f1':{id:'f1',who:'p2',from:'AKL',to:'LAX',start:'2026-11-11T20:00:00.000Z',end:'2026-11-12T08:00:00.000Z'},
 'households/h1/flights/f2':{id:'f2',who:'p2',from:'LAX',to:'AKL',start:'2026-11-14T06:00:00.000Z',end:'2026-11-15T20:00:00.000Z'},
 'households/h1/bills/b1':{id:'b1',status:'due',biller:'Mercury',amount:18240,due:friday,directDebit:true},
 'households/h1/bills/b2':{id:'b2',status:'check',biller:'Watercare',amount:9530},
 'households/h1/renewals/r1':{id:'r1',what:'WOF',item:'Mazda',due:friday},
 'households/h1/meals/m1':{id:'m1',date:K(now),slot:'dinner',rid:'rec1'},
 'households/h1/recipes/rec1':{id:'rec1',name:'Spaghetti bolognese'},
 'households/h1/memory/mm1':{id:'mm1',title:'Aria',text:'Aria is allergic to peanuts'},
};
let geminiPrompt=null;
const mocks=`
function listDocs(p){ const pre=p+'/'; return Object.keys(DB).filter(k=>k.startsWith(pre)&&k.slice(pre.length).indexOf('/')<0).map(k=>Object.assign({},DB[k],{_id:k.split('/').pop()})); }
function patch(p,f){ DB[p]=Object.assign({},DB[p]||{},JSON.parse(JSON.stringify(f))); }
function getDoc(p){ return DB[p]?Object.assign({},DB[p],{_id:p.split('/').pop()}):null; }
function gemini(k,parts){ geminiPrompt(parts[0].text); return JSON.stringify({speech:'You need mince, pasta and parmesan.'}); }
`;
const ContentService={createTextOutput:t=>({t,setMimeType(){return this}}),MimeType:{JSON:1,TEXT:2}};
const f=new Function('DB','ContentService','geminiPrompt',code+mocks+'; return {doPost,voiceDo,voiceContext};')(DB,ContentService,p=>geminiPrompt=p);
const call=(action,extra)=>JSON.parse(f.doPost({postData:{contents:JSON.stringify(Object.assign({key:'VOICEKEY123456',action},extra))}}).t);
const show=(label,r)=>console.log(label.padEnd(16),JSON.stringify(r));
// clock: Date is real; tests that depend on "now" use the real date, so just check structure
show('ping',call('ping'));
show('bad key',JSON.parse(f.doPost({postData:{contents:JSON.stringify({key:'nope',action:'ping'})}}).t));
show('agenda',call('agenda',{date:tomorrow}));
show('agenda empty',call('agenda',{date:'2027-01-01'}));
show('jobs all',call('jobs',{}));
show('jobs Reyna',call('jobs',{person:'reyna'}));
show('jobs unknown',call('jobs',{person:'bob'}));
show('shop list',call('shop_list'));
show('shop add',call('shop_add',{item:'oat milk'}));
show('shop add none',call('shop_add',{item:''}));
show('job add',call('job_add',{task:'take the bins out',person:'Aria'}));
show('job no person',call('job_add',{task:'fix the gate'}));
show('event add',call('event_add',{title:'swimming lesson',date:friday,time:'16:30',person:'Aria'}));
show('event no time',call('event_add',{title:'bin day',date:friday,time:'',person:''}));
show('bills',call('bills'));
show('renewals',call('renewals'));
show('meal',call('meal',{date:K(new Date())}));
show('remember',call('remember',{text:'the bins go out on Tuesday night'}));
show('where',call('where'));
show('ask',call('ask',{q:'what do we need for dinner'}));
console.log('\n--- prompt sent to Gemini ---\n'+String(geminiPrompt).slice(0,1200));
console.log('\nnew docs:',Object.keys(DB).filter(k=>/\/(groceries|todos|events|memory)\/v/.test(k)).map(k=>k.split('/').slice(-2).join('/')+' '+JSON.stringify(DB[k])).join('\n  '));
