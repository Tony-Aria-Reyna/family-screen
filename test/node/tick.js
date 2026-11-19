// The 5-minute run, old (v19, reads everything) against new (v20, filtered reads): same notifications, far fewer reads.
const fs=require('fs');
const prep=c=>c.replace('__PROJECT_ID__','p').replace('__APP_URL__','x').replace('{/*@TZ@*/}','{AKL:["Pacific/Auckland","Auckland"]}');
const NEW=prep(fs.readFileSync('notifier/Code.gs','utf8')), OLD=prep(fs.readFileSync(process.argv[2]||'/tmp/Code19.gs','utf8'));
const pad=n=>(n<10?'0':'')+n, K=d=>d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());
const base=new Date(2026,10,16,0,0,0), day=n=>K(new Date(base.getTime()+n*864e5+12*3600e3)), iso=(n,h)=>new Date(base.getTime()+n*864e5+h*3600e3).toISOString();
function makeDB(){
  const DB={'households/H':{members:['tony@x.com','reyna@x.com'],billEmail:'t+bills@x.com',inboxEmail:'t+family@x.com',live:{},
    people:[{id:'all',name:'Everyone'},{id:'p1',name:'Tony',email:'tony@x.com'},{id:'p2',name:'Reyna',email:'reyna@x.com'},{id:'p3',name:'Aria'}],
    devices:{d1:{token:'a',email:'tony@x.com'},d2:{token:'b',email:'reyna@x.com'}}}};
  const put=(c,o,priv)=>DB['households/H/'+(priv?'private/'+encodeURIComponent(priv)+'/':'')+c+'/'+o.id]=o;
  for(let i=0;i<90;i++) put('events',{id:'old'+i,title:'Past '+i,date:day(-200+i),time:'09:00',whos:['p1']});      // history
  for(let i=0;i<6;i++) put('events',{id:'fut'+i,title:'Later '+i,date:day(5+i),time:'09:00',whos:['p1']});
  put('events',{id:'soon',title:'Dentist',date:day(0),time:'10:20',whos:['p3']});
  put('events',{id:'tom',title:'Early swim',date:day(1),time:'00:20',whos:['p3']});
  put('events',{id:'allday',title:'Mufti day',date:day(0),time:'',whos:['p3']});
  put('events',{id:'rw',title:'Swimming',date:day(-70),time:'10:15',whos:['p3'],rpt:{f:'W',n:1}});                   // same weekday, weekly
  put('events',{id:'rd',title:'Feed the cat',date:day(-300),time:'10:25',whos:['all'],rpt:{f:'D',n:1}});
  for(let i=0;i<6;i++) put('events',{id:'rm'+i,title:'Monthly '+i,date:day(-40-i),time:'10:10',whos:['p1'],rpt:{f:'M',n:1}});
  put('events',{id:'job',title:'Book car service',date:day(-1),time:'10:00',whos:['p1'],todoId:'tj'});
  put('events',{id:'pe',title:'Secret present',date:day(0),time:'10:15',whos:['p1'],priv:true},'tony@x.com');
  put('events',{id:'pj',title:'Private job',date:day(-1),time:'09:00',whos:['p1'],todoId:'ptj'},'tony@x.com');
  put('todos',{id:'ptj',title:'Private job',who:'p1',done:false,eventId:'pj'},'tony@x.com');
  put('todos',{id:'tj',title:'Book car service',who:'p1',done:false,eventId:'job'});
  for(let i=0;i<19;i++) put('todos',{id:'t'+i,title:'Job '+i,who:'p1',done:i%2===0,eventId:i<8?'old'+i:undefined});
  for(let i=0;i<13;i++) put('flights',{id:'fo'+i,who:'p2',flight:'NZ'+i,from:'AKL',to:'LAX',start:iso(-60+i,1),end:iso(-60+i,13)});
  put('flights',{id:'f1',who:'p2',flight:'NZ6',from:'AKL',to:'LAX',start:iso(0,8),end:iso(0,20)});
  put('flights',{id:'f2',who:'p2',flight:'NZ5',from:'LAX',to:'AKL',start:iso(-1,20),end:iso(0,9)});
  put('renewals',{id:'r1',what:'WOF',emoji:'🚗',due:day(7)}); put('renewals',{id:'r2',what:'Rego',due:day(90)});
  put('bills',{id:'b1',status:'due',biller:'Mercury',amount:12345,due:day(2)}); put('bills',{id:'b2',status:'paid',biller:'Watercare',amount:500,due:day(2)});
  for(let i=0;i<10;i++) put('bills',{id:'bo'+i,status:'paid',biller:'Old',amount:100,due:day(-30*i-10)});
  for(let i=0;i<30;i++) put('msgs',{id:'m'+i,th:'fam',from:'p3',text:'old '+i,at:base.getTime()-(i+2)*864e5,pushed:1});
  put('inbox',{id:'i1',status:'done',items:[]});
  return DB;
}
function run(code,when,opt){
  opt=opt||{}; const DB=opt.DB||makeDB(), PP=opt.PP||{}, sent=[], reads={n:0};
  const T=when.getTime(); class FD extends Date{ constructor(...a){ if(a.length) super(...a); else super(T); } static now(){ return T; } }
  const get=(o,p)=>p.split('.').reduce((x,k)=>x==null?undefined:x[k],o);
  const cmp={EQUAL:(a,b)=>a===b,GREATER_THAN:(a,b)=>a>b,GREATER_THAN_OR_EQUAL:(a,b)=>a>=b,LESS_THAN_OR_EQUAL:(a,b)=>a<=b};
  const match=(d,w,dec)=>{ if(w.compositeFilter) return w.compositeFilter.filters.every(f=>match(d,f,dec));
    const f=w.fieldFilter, v=get(d,f.field.fieldPath), x=dec(f.value); if(v===undefined) return false;
    if(f.op==='IN') return x.indexOf(v)>=0; return typeof v===typeof x&&cmp[f.op](v,x); };
  const mocks=`
  function listDocs(p){ const pre=p+'/'; const out=Object.keys(DB).filter(k=>k.startsWith(pre)&&k.slice(pre.length).indexOf('/')<0).map(k=>Object.assign({},DB[k],{_id:k.split('/').pop()})); reads.n+=Math.max(1,out.length); return out; }
  function runQuery(parent,col,where){ const out=listDocsQuiet(parent+'/'+col).filter(d=>match(d,where,dec)); reads.n+=Math.max(1,out.length); return out; }
  function listDocsQuiet(p){ const pre=p+'/'; return Object.keys(DB).filter(k=>k.startsWith(pre)&&k.slice(pre.length).indexOf('/')<0).map(k=>Object.assign({},DB[k],{_id:k.split('/').pop()})); }
  function fetchMany(specs){ return specs.map(s=>{ reads.n++; if(s.kind==='doc') return DB[s.path]||null; return s.kind==='list'?listDocsQuiet(s.path):runQuery(s.parent,s.col,s.where); }); }
  function fetchManyLoose(specs){ return fetchMany(specs); }
  function readsToday(){ return {n:12345,day:'2026-11-16'}; }
  const GmailApp={sendEmail:(to,subj,body)=>{ (opt.mail2=opt.mail2||[]).push(to+' | '+subj); }}; const Session={getEffectiveUser:()=>({getEmail:()=>'owner@x.com'})};
  const Utilities={formatDate:(d,tz,f)=>f==='EEE'?['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d.getDay()]:d.toDateString()};
  function getDoc(p){ reads.n++; return DB[p]?Object.assign({},DB[p],{_id:p.split('/').pop()}):null; }
  function patch(p,f){ DB[p]=Object.assign({},DB[p]||{},JSON.parse(JSON.stringify(f))); }
  function send(h,hash,title,body,tag){ sent.push(hash+' | '+title+' | '+String(body).split('\\n').join(' / ')); }
  function syncRules(){ return {ok:true}; } function selfUpdate(){ return null; } function trackFlights(h,fl){ if(opt.onFlights) opt.onFlights(fl); }
  function billsTick(h,props,now,force){ opt.mail=(opt.mail||0)+1; if(typeof mailDone==='function') mailDone(props,'BILL',h,now,''); return listDocs('households/'+h._id+'/bills'); }
  function inboxTick(h,props,now,force){ opt.mail=(opt.mail||0)+1; if(typeof mailDone==='function') mailDone(props,'INBOX',h,now,''); listDocs('households/'+h._id+'/inbox'); return []; }
  const PropertiesService={getScriptProperties:()=>({getProperty:k=>PP[k]||null,setProperty:(k,v)=>{PP[k]=String(v);},deleteProperty:k=>{delete PP[k];},getProperties:()=>Object.assign({},PP)})};
  const Logger={log:x=>{ if(opt.log) console.log('   log:',x); }};
  `;
  new Function('DB','reads','sent','opt','match','PP','Date','module',code+mocks+'; tick();')(DB,reads,sent,opt,match,PP,FD,undefined);
  return {sent:sent.sort(),reads:reads.n,DB,PP,mail:opt.mail||0};
}
const at=(h,m)=>new Date(2026,10,16,h,m,0); let bad=0;
const same=(label,when,pp)=>{ const o=run(OLD,when,{PP:Object.assign({},pp)}), n=run(NEW,when,{PP:Object.assign({},pp)});
  const ok=JSON.stringify(o.sent)===JSON.stringify(n.sent); if(!ok) bad++;
  console.log((ok?'✓ ':'✗ ')+label.padEnd(34),'sends',String(n.sent.length).padStart(2),'| reads old',String(o.reads).padStart(4),'→ new',String(n.reads).padStart(3));
  if(!ok){ console.log('  old only:',o.sent.filter(x=>n.sent.indexOf(x)<0)); console.log('  new only:',n.sent.filter(x=>o.sent.indexOf(x)<0)); } return n; };
const done={BILL_DAY_H:K(base),INBOX_DAY_H:K(base)};          // today's email read has already happened
const a=same('10:00 reminders (incl. repeats)',at(10,0),done); console.log('   ',a.sent.map(s=>s.split(' | ')[1]).join(' · '));
same('00:00 tomorrow-early reminder',new Date(2026,10,16,23,55,0),done);
const j=same('11:05 job follow-up',at(11,5),done); console.log('   ',j.sent.map(s=>s.split(' | ').slice(1).join(': ')).join(' · ').slice(0,200));
same('07:05 morning summary',at(7,5),done);
same('09:05 renewals and bills',at(9,5),done);
same('03:00 quiet night',at(3,0),done);
// emails: once a day from 6am, then not again
let st=run(NEW,at(5,55),{}); console.log((st.mail===0?'✓':(bad++,'✗')),'05:55 no email read yet        mail runs',st.mail);
st=run(NEW,at(6,0),{PP:st.PP,DB:st.DB}); console.log((st.mail===2?'✓':(bad++,'✗')),'06:00 bills + inbox read once   mail runs',st.mail,'reads',st.reads);
const st2=run(NEW,at(6,5),{PP:st.PP,DB:st.DB}); console.log((st2.mail===0?'✓':(bad++,'✗')),'06:05 not again                 mail runs',st2.mail,'reads',st2.reads);
// a failed read is tried again the next hour
const PPf={BILL_DAY_H:K(base)+'|6',INBOX_DAY_H:K(base)}; const f1=run(NEW,at(6,30),{PP:Object.assign({},PPf)}), f2=run(NEW,at(7,20),{PP:Object.assign({},PPf)});
console.log((f1.mail===0&&f2.mail===1?'✓':(bad++,'✗')),'failed at 6 → retried after 7   ',f1.mail,f2.mail);
// flights: only the recent ones reach the tracker
let got=null; run(NEW,at(10,0),{PP:Object.assign({AERODATABOX_KEY:'k'},done),onFlights:fl=>got=fl}); console.log((got&&got.length===2?'✓':(bad++,'✗')),'flight tracker gets recent only ',got&&got.map(f=>f.id).join(','));
// a whole day
let tot={o:0,n:0}, PPo={}, PPn={}, DBo=makeDB(), DBn=makeDB();
for(let i=0;i<288;i++){ const w=new Date(base.getTime()+i*5*60e3); tot.o+=run(OLD,w,{PP:PPo,DB:DBo}).reads; tot.n+=run(NEW,w,{PP:PPn,DB:DBn}).reads; }
console.log('whole day (288 runs): old',tot.o,'reads → new',tot.n,'('+Math.round(100-100*tot.n/tot.o)+'% fewer)');
console.log(bad?bad+' FAILED':'all good'); process.exit(bad?1:0);
