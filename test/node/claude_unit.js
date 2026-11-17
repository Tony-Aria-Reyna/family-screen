const fs=require('fs');
let code=fs.readFileSync('notifier/Code.gs','utf8').replace('__PROJECT_ID__','p').replace('__APP_URL__','x').replace('{/*@TZ@*/}','{}');
const calls=[]; let mode='ok';
const UrlFetchApp={fetch:(u,o)=>{ const b=JSON.parse(o.payload); calls.push({u,b,h:o.headers});
  if(/anthropic/.test(u)){ if(mode==='down') return {getResponseCode:()=>529,getContentText:()=>'{"error":{"message":"overloaded"}}'};
    if(mode==='noeffort'&&b.output_config) return {getResponseCode:()=>400,getContentText:()=>'{"error":{"message":"output_config.effort unsupported"}}'};
    return {getResponseCode:()=>200,getContentText:()=>JSON.stringify({content:[{type:'thinking',thinking:'x'},{type:'text',text:'```json\n{"speech":"From Claude"}\n```'}]})}; }
  return {getResponseCode:()=>200,getContentText:()=>JSON.stringify({candidates:[{content:{parts:[{text:'{"speech":"From Gemini"}'}]}}]})}; }};
const PropertiesService={getScriptProperties:()=>({getProperty:()=>null,setProperty(){}})};
const DB={'households/h1/secrets/ai':{gemini:'GK',claude:'sk-ant-x'}};
const f=new Function('UrlFetchApp','PropertiesService','DB',code+';function getDoc(p){return DB[p]||null}; return {aiCall,aiReady};')(UrlFetchApp,PropertiesService,DB);
const H=o=>Object.assign({_id:'h1'},o);
console.log('1 gemini default :', f.aiCall(H({}),[{text:'hi'}]), calls.at(-1).u.includes('googleapis'));
console.log('2 claude chosen  :', f.aiCall(H({aiProv:'claude',aiClaudeModel:'claude-opus-5-5',aiEffort:'high'}),[{text:'hi'},{inline_data:{mime_type:'application/pdf',data:'AAAA'}},{inline_data:{mime_type:'image/png',data:'BBBB'}}]), calls.at(-1).b.model, JSON.stringify(calls.at(-1).b.output_config), calls.at(-1).b.messages[0].content.map(c=>c.type).join(','), calls.at(-1).h['x-api-key']);
console.log('3 voice (quick)  :', f.aiCall(H({aiProv:'claude',aiClaudeModel:'claude-opus-5-5',aiEffort:'high'}),[{text:'hi'}],true), calls.at(-1).b.model, JSON.stringify(calls.at(-1).b.output_config));
mode='noeffort'; let n=calls.length; console.log('4 effort retry   :', f.aiCall(H({aiProv:'claude'}),[{text:'hi'}]), calls.length-n, calls.at(-1).b.model, 'output_config' in calls.at(-1).b);
mode='down'; console.log('5 claude down    :', f.aiCall(H({aiProv:'claude'}),[{text:'hi'}]));
DB['households/h1/secrets/ai']={claude:'sk-ant-x'}; try{ f.aiCall(H({aiProv:'claude'}),[{text:'hi'}]); }catch(e){ console.log('6 down, no backup:', e.message.slice(0,40)); }
mode='ok'; DB['households/h1/secrets/ai']={gemini:'GK',claude:'sk-ant-x'}; n=calls.length;
console.log('8 voice, both keys: ', f.aiCall(H({aiProv:'claude'}),[{text:'hi'}],true), calls.slice(n).map(c=>/google/.test(c.u)?'gemini':'claude').join(','));
DB['households/h1/secrets/ai']={claude:'sk-ant-x'}; n=calls.length;
console.log('9 voice, claude only:', f.aiCall(H({aiProv:'claude'}),[{text:'hi'}],true), calls.slice(n).map(c=>/google/.test(c.u)?'gemini':'claude').join(','));
console.log('7 ready          :', f.aiReady(H({aiProv:'claude'})), f.aiReady(H({})), );
