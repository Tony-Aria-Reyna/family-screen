// 4.0 the helper's "is calling" alert: who gets it, and the relay hand-out (off unless a key is set)
const fs=require('fs'); const src=fs.readFileSync('notifier/Code.gs','utf8');
const grab=n=>{const i=src.indexOf('function '+n+'(');let d=0,j=src.indexOf('{',i);for(let k=j;;k++){if(src[k]=='{')d++;if(src[k]=='}'){d--;if(!d)return src.slice(i,k+1);}}};
const sent=[], calls={}, PP={}; let fetched=null, ok=true;
const h={_id:'H',people:[{id:'all',name:'Everyone'},{id:'p1',name:'Tony',email:'tony@x.com'},{id:'p2',name:'Reyna',email:'reyna@x.com'},{id:'p3',name:'Aria'}],
  devices:{d1:{token:'a',email:'tony@x.com'},d2:{token:'b',email:'reyna@x.com'},d3:{token:'',email:'reyna@x.com'}}};
const check=(n,c)=>{ console.log((c?'✓ ':'✗ ')+n); if(!c) ok=false; };
eval(`const getDoc=p=>calls[p.split('/').pop()]||null; const send=(h,hash,t,b,tag)=>sent.push([hash,t,b,tag]);
const PropertiesService={getScriptProperties:()=>({getProperty:k=>PP[k]||null})};
const UrlFetchApp={fetch:(u,o)=>{ fetched=[u,o]; return {getResponseCode:()=>201,getContentText:()=>JSON.stringify({iceServers:[{urls:['stun:stun.cloudflare.com:3478']},{urls:['turn:turn.cloudflare.com:3478?transport=udp','turn:turn.cloudflare.com:53?transport=udp','turns:turn.cloudflare.com:443?transport=tcp'],username:'u',credential:'c'}]})}; }};
${grab('callRing')} ${grab('callIce')}
calls.c1={st:'ring',from:'p3',to:'p2',th:'p2|p3',kind:'video'};
let r=callRing(h,{id:'c1'}); check('1 Aria video-calls Reyna: only Reyna\\'s phone with alerts on is rung', r.sent===1&&sent.length===1&&sent[0][0]==='d2'&&sent[0][1]==='📞 Aria is calling'&&/Video call/.test(sent[0][2])&&sent[0][3]==='call-p2|p3');
sent.length=0; calls.c2={st:'ring',from:'p2',to:'fam',th:'fam',kind:'audio'};
r=callRing(h,{id:'c2'}); check('2 Reyna calls Family: Tony\\'s phone rings, hers does not', r.sent===1&&sent[0][0]==='d1'&&sent[0][1]==='📞 Reyna is calling the family'&&sent[0][3]==='call-fam');
sent.length=0; calls.c3={st:'end',from:'p1',to:'p2',th:'p1|p2',kind:'audio'};
check('3 a call that has already ended rings nobody', callRing(h,{id:'c3'}).sent===0&&callRing(h,{id:'nope'}).sent===0&&!sent.length&&!!callRing(h,{}).error);
h.people.push({id:'p4',name:'Masako',email:'m@x.com'}); h.devices.d4={token:'m',email:'m@x.com'}; h.limited=['m@x.com'];
sent.length=0; calls.c4={st:'ring',from:'p1',to:'p4',th:'p1|p4',kind:'audio'}; callRing(h,{id:'c4'});
check('3a Tony calls Masako (linked, own household): her phone is rung', sent.length===1&&sent[0][0]==='d4');
sent.length=0; calls.c5={st:'ring',from:'p2',to:'fam',th:'fam',kind:'video'}; callRing(h,{id:'c5'});
check('3b a call to Family rings this household only, not the linked one', sent.map(x=>x[0]).join()==='d1');
let i=callIce(); check('4 no relay key set: nothing handed out, nothing fetched', i.ok&&i.ice.length===0&&fetched===null);
PP.TURN_KEY_ID='kid'; PP.TURN_KEY_TOKEN='tok'; i=callIce();
check('5 with a key: a day pass from Cloudflare, key kept in the header, port 53 left out', i.ok&&i.ttl===86400&&i.ice.length===1&&i.ice[0].username==='u'&&i.ice[0].urls.length===2&&/keys\\/kid\\/credentials\\/generate-ice-servers$/.test(fetched[0])&&fetched[1].headers.Authorization==='Bearer tok'&&fetched[1].method==='post');
`);
console.log(ok?'all good':'FAILED'); process.exit(ok?0:1);
