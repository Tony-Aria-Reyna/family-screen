const fs=require('fs'); const src=fs.readFileSync('notifier/Code.gs','utf8');
const grab=n=>{const i=src.indexOf('function '+n+'(');let d=0,j=src.indexOf('{',i);for(let k=j;;k++){if(src[k]=='{')d++;if(src[k]=='}'){d--;if(!d)return src.slice(i,k+1);}}};
const docs={inbox:[],msgs:[]}, patches=[], sent=[], fwd=[]; const PP={};
const h={_id:'H',inboxEmail:'t+family@gmail.com',billEmail:'t+bills@gmail.com',people:[{id:'all',name:'Everyone'},{id:'p1',name:'Tony',email:'tony@x.com'},{id:'p2',name:'Reyna',email:'reyna@x.com',nick:'Mummy'},{id:'p3',name:'Aria'}],
  devices:{d1:{token:'a',email:'tony@x.com'},d2:{token:'b',email:'reyna@x.com'},d3:{token:'c',email:'reyna@x.com'}}};
const mk=(id,subj,body)=>({getId:()=>id,getTo:()=>'t+family@gmail.com',getCc:()=>'',getAttachments:()=>[],getPlainBody:()=>body,getBody:()=>body,getFrom:()=>'Room 5 <r5@school.nz>',getSubject:()=>subj,getDate:()=>new Date(),forward:a=>fwd.push(a)});
const mails=[mk('m1','Week 6 notices','Swimming sports Friday, bring togs. Return the camp slip by Wednesday. '.repeat(3)),mk('m2','Invoice 123','Please pay $50 by Friday for your power account, thank you very much.')];
const ctx=`const HELPER_VERSION=17, normB=x=>String(x||'').toLowerCase().replace(/[^a-z0-9]/g,'');
const pad=n=>(n<10?'0':'')+n; ${grab('keyOf')} ${grab('at')} ${grab('vPeople')} ${grab('vAka')} ${grab('vFind')} ${grab('only')} ${grab('vDist')} ${grab('vSound')}
const vWho=()=>"WHO", aiReady=()=>'k', Logger={log(){}};
const listDocs=p=>docs[p.split('/').pop()]||[]; const runQuery=(par,col,w)=>(docs[col]||[]).filter(d=>d.at>w.fieldFilter.value.integerValue); const fOp=(f,op,v)=>({fieldFilter:{field:{fieldPath:f},op,value:{integerValue:v}}}); const PropertiesService={getScriptProperties:()=>props}; const mailDue=()=>true, mailDone=()=>{}; const patch=(p,f)=>{ patches.push([p,f]); const c=p.split('/'); if(c.length===4){ const L=docs[c[2]]; const ex=L.find(x=>x._id===c[3]); if(ex) Object.assign(ex,f); else L.push(Object.assign({_id:c[3]},f)); } };
const GmailApp={search:()=>[{getMessages:()=>mails,addLabel(){}}],getUserLabelByName:()=>({}),createLabel:()=>({})};
const Utilities={base64Encode:()=>''}; const send=(h,hash,t,b,tag)=>sent.push([hash,t,b,tag]);
const fri=keyOf(new Date(Date.now()+5*864e5));
const aiCall=(h,parts)=>/Invoice/.test(parts[0].text)?'{"kind":"bill","events":[],"todos":[]}':'Sure: '+JSON.stringify({kind:'school',from:'Room 5',summary:'Week 6 notices.',events:[{title:'Swimming sports',date:fri,time:'09:30',end:'12:00',who:'aria',note:'Bring togs'},{title:'Old thing',date:'2020-01-01'},{title:'Camp',date:'soon',who:'Aria'}],todos:[{title:'Return the camp slip',due:fri,who:'Mummy'}]});
${grab('inboxTick')} ${grab('inboxArrivals')} ${grab('msgPush')}
const props={getProperty:k=>PP[k]||null,setProperty:(k,v)=>{PP[k]=v}};
const fresh=inboxTick(h,props,new Date());
console.log('fresh',fresh.length,'| items',JSON.stringify(fresh[0].items.map(i=>[i.type,i.title,i.time||i.due||'',i.who])));
console.log('bill forwarded to',fwd,'| bill doc',docs.inbox.find(d=>d._id==='email-m2').status);
console.log('helper note',JSON.stringify(patches[patches.length-1][1].inboxHelper.error),'added',patches[patches.length-1][1].inboxHelper.added);
console.log('again, nothing new',inboxTick(h,props,new Date()).length,'| forced, nothing new',inboxTick(h,props,new Date(),true).length);
const msgs=[]; inboxArrivals(h,fresh,msgs); console.log('pushes',msgs.length,msgs[0].title,'|',msgs[0].body);
docs.msgs.push({_id:'a',th:'p2|p3',from:'p3',text:'I am home',at:Date.now()},{_id:'b',th:'fam',from:'p3',text:'Hi all',at:Date.now()},{_id:'c',th:'p1|p3',from:'p1',text:'ok',at:Date.now()},{_id:'d',th:'fam',from:'p1',text:'old',at:Date.now()-2*864e5});
console.log('msg pushes',msgPush(h),JSON.stringify(sent.map(s=>s[0]+':'+s[1])),'| second run',msgPush(h));
`; eval(ctx);
