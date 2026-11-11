/* ================= meals: plan the week, cook step by step, ideas from AI ================= */
const STARTERS=/*@RECIPES@*/[];
const MEAL_SLOTS=[['breakfast','Breakfast','🥣'],['lunch','Lunch','🥪'],['dinner','Dinner','🍽️']];
const eaters=()=>S.people.filter(p=>p.id!=='all');
const recipeById=id=>(S.recipes||[]).find(r=>r.id===id)||STARTERS.find(r=>r.id===id);
const allRecipes=()=>(S.recipes||[]).concat(STARTERS.filter(r=>!(S.recHide||[]).includes(r.id)&&!(S.recipes||[]).some(x=>x.from===r.id)));
const isFav=id=>(S.favs||[]).includes(id);
function setFav(id,on){ S.favs=(S.favs||[]).filter(x=>x!==id); if(on) S.favs.push(id); save(); }
const FR={0.25:'¼',0.5:'½',0.75:'¾',0.33:'⅓',0.67:'⅔'};
function fmtQty(q,u){
  if(!q) return u||'';
  let n=q;
  if(u==='g'||u==='ml'){ n=q>=100?Math.round(q/10)*10:Math.round(q); if(n>=1000){ return (n/1000).toFixed(n%1000?1:0).replace('.0','')+(u==='g'?' kg':' L'); } return n+' '+u; }
  const w=Math.floor(n), f=Math.round((n-w)*100)/100, fk=Object.keys(FR).map(Number).reduce((a,b)=>Math.abs(b-f)<Math.abs(a-f)?b:a,0.25);
  let s; if(f<0.13) s=String(w||(n>0?'':'0')); else if(f>0.87) s=String(w+1); else s=(w?w:'')+FR[fk];
  return s+(u?' '+u:'');
}
const COUNTED=['','can','sachet','clove','head','bunch','jar','bag','sheet','slice','rasher','packet','stalk','sprig'];
// grams and spoons scale smoothly; things you buy whole (cans, onions, limes) round to a whole one
const scaleQ=(q,k,u)=>{ if(!q) return q; const v=q*k; if(u==='g'||u==='ml'||u==='kg'||u==='L') return v; if(COUNTED.includes(u||'')&&q>=1) return Math.max(1,Math.round(v)); return Math.round(v*4)/4||0.25; };
// who is home for dinner on a day: everyone, less the traveller when the roster has them away, less anyone ticked off for that day
function homeOn(key){
  const away=new Set((S.mealAway||{})[key]||[]), tp=traveller();
  if(tp){ const o=S.override; if(key!==dk(new Date())) S.override=null;
    try{ const d=kd(key); d.setHours(18,0,0,0); const r=travellerNow(d); if(r&&(r.air||(r.a&&!HOME.includes(r.code)))) away.add(tp.id); } catch(e){} finally{ S.override=o; } }
  return eaters().filter(p=>!away.has(p.id));
}
let mealWeek=0;
const mealsOn=(key,slot)=>(S.meals||[]).filter(m=>m.date===key&&m.slot===slot);
function closeMeals(){ $('#mealLayer').innerHTML=''; }
function openMeals(){
  if(isPhone()&&document.body.dataset.tab!=='meals'){ setTab('meals'); return; }
  const L=$('#mealLayer'), mon=addDays(new Date(),-((new Date().getDay()+6)%7)+mealWeek*7), today=dk(new Date());
  const days=[...Array(7)].map((_,i)=>dk(addDays(mon,i)));
  const label=mealWeek===0?'This week':mealWeek===1?'Next week':mealWeek===-1?'Last week':fmtD(mon,{day:'numeric',month:'short'});
  const tile=(key,slot,big)=>{ const ms=mealsOn(key,slot), sl=MEAL_SLOTS.find(s=>s[0]===slot);
    if(!ms.length) return `<button class="mtile add ${big?'big':''}" data-pick="${key}|${slot}">＋ ${sl[1]}</button>`;
    return ms.map(m=>{ const r=m.rid&&recipeById(m.rid);
      return `<button class="mtile ${big?'big':''} ${m.shopped?'shopped':''}" data-meal="${m.id}"><span class="me">${r?r.emoji||'🍽️':'📝'}</span><span class="mn">${esc(r?r.name:m.note||'')}</span>${r?`<small>${big?esc(sl[1])+' · ':''}serves ${m.serves||r.serves}${m.shopped?' · 🛒✓':''}</small>`:''}</button>`; }).join(''); };
  const dayHTML=key=>{ const d=kd(key), home=homeOn(key);
    return `<div class="mday ${key===today?'today':''} ${key<today?'past':''}"><div class="mdl"><b>${fmtD(d,{weekday:'short'})}</b> <span>${fmtD(d,{day:'numeric',month:'short'})}</span>
      <button class="mhome" data-home="${key}" title="Who's home">${home.map(p=>`<i style="background:${p.color}"></i>`).join('')}<small>${home.length} home</small></button></div>
      <div class="mslots">${tile(key,'dinner',true)}<div class="msmall">${tile(key,'breakfast')}${tile(key,'lunch')}</div></div></div>`; };
  const toShop=(S.meals||[]).filter(m=>days.includes(m.date)&&m.rid&&!m.shopped).length;
  L.innerHTML=`<div class="meals"><div class="mhead"><h2>🍽️ Meals</h2>
    <div class="mnav"><button data-wk="-1" aria-label="Previous week">‹</button><b>${label}</b><button data-wk="1" aria-label="Next week">›</button></div>
    <div class="macts"><button id="mIdeas">✨ Ideas</button><button id="mBook">📖 Recipes</button><button id="mShop" ${toShop?'':'disabled'}>🛒 Shopping list${toShop?` (${toShop})`:''}</button></div>
    <button class="mclose" id="mClose" aria-label="Close">✕</button></div>
    <div class="mweek">${days.map(dayHTML).join('')}</div></div>`;
  L.querySelectorAll('[data-wk]').forEach(b=>b.onclick=()=>{ mealWeek+=+b.dataset.wk; openMeals(); });
  L.querySelector('#mClose').onclick=()=>{ closeMeals(); if(isPhone()) setTab('cal'); };
  L.querySelector('#mIdeas').onclick=()=>openIdeas();
  L.querySelector('#mBook').onclick=()=>openRecipeBook();
  L.querySelector('#mShop').onclick=()=>shopForMeals(days);
  L.querySelectorAll('[data-pick]').forEach(b=>b.onclick=()=>{ const [k,s]=b.dataset.pick.split('|'); pickMeal(k,s); });
  L.querySelectorAll('[data-meal]').forEach(b=>b.onclick=()=>{ const m=(S.meals||[]).find(x=>x.id===b.dataset.meal); if(!m) return; const r=m.rid&&recipeById(m.rid); if(r) openRecipe(r,{meal:m}); else editNoteMeal(m); });
  L.querySelectorAll('[data-home]').forEach(b=>b.onclick=()=>whoHome(b.dataset.home));
}
function whoHome(key){
  modal((m,close)=>{ const draw=()=>{ const home=homeOn(key).map(p=>p.id);
    m.innerHTML=`<h2>Who's home ${fmtD(kd(key),{weekday:'long'})}?</h2><p class="note">Sets how many each meal serves. Mummy's roster is already counted.</p><div class="opts">${eaters().map(p=>{ const on=home.includes(p.id); return `<button class="opt ${on?'on':''}" data-p="${p.id}"><span class="tick">${on?'✓':''}</span><span class="dot" style="background:${p.color}"></span>${esc(p.name)}</button>`; }).join('')}</div><div class="mact"><button class="save" id="ok">Done</button></div>`;
    m.querySelectorAll('[data-p]').forEach(b=>b.onclick=()=>{ const ma=Object.assign({},S.mealAway||{}), a=new Set(ma[key]||[]), id=b.dataset.p; if(a.has(id)) a.delete(id); else a.add(id); if(a.size) ma[key]=[...a]; else delete ma[key]; S.mealAway=ma;
      const n=homeOn(key).length; (S.meals||[]).filter(x=>x.date===key&&!x.serveSet).forEach(x=>x.serves=Math.max(1,n)); save(); draw(); });
    m.querySelector('#ok').onclick=()=>{ close(); openMeals(); }; }; draw(); });
}
function planMeal(key,slot,r,serves){ S.meals=S.meals||[]; const m={id:uid(),date:key,slot,rid:r.id,serves:serves||Math.max(1,homeOn(key).length)}; S.meals.push(m); save(); return m; }
// choose a meal for a day: favourites first, then everything, or ask for new ideas
function pickMeal(key,slot,tab){
  let q='', t=tab||((S.favs||[]).length?'fav':'all'), only=true;
  const home=homeOn(key).length;
  modal((m,close)=>{ m.classList.add('wide','tvsheet'); const draw=()=>{
    const pool=allRecipes().filter(r=>(!only||r.meal===slot||(slot!=='dinner'&&r.meal!=='dinner'))&&(t!=='fav'||isFav(r.id))), k=q.trim().toLowerCase();
    const list=pool.filter(r=>!k||(r.name+' '+(r.tags||[]).join(' ')).toLowerCase().includes(k)).sort((a,b)=>(isFav(b.id)-isFav(a.id))||a.name.localeCompare(b.name));
    m.innerHTML=`<div class="tvhead"><h2>${MEAL_SLOTS.find(s=>s[0]===slot)[2]} ${fmtD(kd(key),{weekday:'short',day:'numeric',month:'short'})} · ${home} home</h2><button class="cancel" id="x">Close</button></div>
      <div class="opts mtabs"><button class="opt sm ${t==='fav'?'on':''}" data-t="fav">⭐ Our favourites</button><button class="opt sm ${t==='all'?'on':''}" data-t="all">📖 All recipes</button><button class="opt sm" id="ai">✨ New ideas</button><button class="opt sm" id="note">📝 Just a note</button></div>
      <input class="txt" id="q" placeholder="Search, e.g. chicken, Mexican, quick" value="${esc(q)}" autocomplete="off">
      <label class="small" style="display:block;margin:6px 0"><input type="checkbox" id="only" ${only?'checked':''}> Only ${MEAL_SLOTS.find(s=>s[0]===slot)[1].toLowerCase()} recipes</label>
      <div class="tvlist">${list.map(r=>recRow(r)).join('')||`<p class="note">${t==='fav'?'No favourites yet. Open any recipe and tap ⭐ to add it to your favourites.':'Nothing matches.'}</p>`}</div>`;
    m.querySelectorAll('[data-t]').forEach(b=>b.onclick=()=>{ t=b.dataset.t; draw(); });
    const qi=m.querySelector('#q'); qi.oninput=()=>{ q=qi.value; const p=qi.selectionStart; draw(); const n=m.querySelector('#q'); n.focus(); n.setSelectionRange(p,p); };
    m.querySelector('#only').onchange=e=>{ only=e.target.checked; draw(); };
    m.querySelector('#x').onclick=close;
    m.querySelector('#ai').onclick=()=>{ close(); openIdeas({key,slot}); };
    m.querySelector('#note').onclick=()=>{ close(); editNoteMeal({date:key,slot}); };
    m.querySelectorAll('[data-rid]').forEach(b=>b.onclick=()=>{ const r=recipeById(b.dataset.rid); planMeal(key,slot,r,home); close(); openMeals(); toast(`${r.name} for ${fmtD(kd(key),{weekday:'long'})}`); });
  }; draw(); });
}
const recRow=(r,extra)=>`<button class="mrow" data-rid="${esc(r.id)}"><span class="me">${r.emoji||'🍽️'}</span><span class="mrt"><b>${isFav(r.id)?'⭐ ':''}${esc(r.name)}</b><small>${r.mins?r.mins+' min · ':''}${esc((r.tags||[]).slice(0,3).join(' · '))}</small></span>${extra||''}</button>`;
function editNoteMeal(meal){
  modal((m,close)=>{ m.innerHTML=`<h2>📝 ${esc(MEAL_SLOTS.find(s=>s[0]===meal.slot)[1])}, ${fmtD(kd(meal.date),{weekday:'long'})}</h2><input class="txt" id="n" placeholder="e.g. Takeaways, dinner at Nana's, leftovers" value="${esc(meal.note||'')}">
    <div class="mact">${meal.id?'<button class="del" id="d">Remove</button>':''}<button class="cancel" id="c">Cancel</button><button class="save" id="s">Save</button></div>`;
    const n=m.querySelector('#n'); n.focus(); m.querySelector('#c').onclick=close;
    if(meal.id) m.querySelector('#d').onclick=()=>{ S.meals=S.meals.filter(x=>x.id!==meal.id); save(); close(); openMeals(); };
    m.querySelector('#s').onclick=()=>{ const v=n.value.trim(); if(!v){ toast('Type a note'); return; } if(meal.id) meal.note=v; else { S.meals=S.meals||[]; S.meals.push({id:uid(),date:meal.date,slot:meal.slot,note:v}); } save(); close(); openMeals(); }; });
}
function openRecipeBook(){
  let q='', t='all';
  modal((m,close)=>{ m.classList.add('wide','tvsheet'); const draw=()=>{ const k=q.trim().toLowerCase();
    const list=allRecipes().filter(r=>(t==='all'||(t==='fav'?isFav(r.id):r.meal===t))&&(!k||(r.name+' '+(r.tags||[]).join(' ')).toLowerCase().includes(k))).sort((a,b)=>(isFav(b.id)-isFav(a.id))||a.name.localeCompare(b.name));
    m.innerHTML=`<div class="tvhead"><h2>📖 Our recipes</h2><button class="save" id="x">Done</button></div>
      <div class="opts mtabs">${[['all','All'],['fav','⭐ Favourites'],['dinner','Dinners'],['lunch','Lunches'],['breakfast','Breakfasts']].map(([v,l])=>`<button class="opt sm ${t===v?'on':''}" data-t="${v}">${l}</button>`).join('')}<button class="opt sm" id="add">＋ Add a recipe</button></div>
      <input class="txt" id="q" placeholder="Search recipes" value="${esc(q)}" autocomplete="off"><div class="tvlist">${list.map(r=>recRow(r)).join('')||'<p class="note">Nothing here yet.</p>'}</div>`;
    m.querySelectorAll('[data-t]').forEach(b=>b.onclick=()=>{ t=b.dataset.t; draw(); });
    const qi=m.querySelector('#q'); qi.oninput=()=>{ q=qi.value; const p=qi.selectionStart; draw(); const n=m.querySelector('#q'); n.focus(); n.setSelectionRange(p,p); };
    m.querySelector('#x').onclick=()=>{ close(); openMeals(); };
    m.querySelector('#add').onclick=()=>addRecipeMenu();
    m.querySelectorAll('[data-rid]').forEach(b=>b.onclick=()=>openRecipe(recipeById(b.dataset.rid),{back:openRecipeBook}));
  }; draw(); });
}
// one recipe: scaled ingredients, numbered steps, start cooking
function openRecipe(r,opt){
  opt=opt||{}; const meal=opt.meal; let serves=(meal&&meal.serves)||r.serves||4;
  modal((m,close)=>{ m.classList.add('wide'); const draw=()=>{ const k=serves/(r.serves||4), saved=!!recipeById(r.id);
    m.innerHTML=`<div class="rhead"><span class="rem">${r.emoji||'🍽️'}</span><div style="flex:1"><h2>${esc(r.name)}</h2><p class="note" style="margin:2px 0">${esc(r.blurb||'')}</p>
      <div class="rmeta">${r.mins?`⏱ ${r.mins} min`:''}${(r.tags||[]).map(x=>`<span>${esc(x)}</span>`).join('')}</div></div>
      ${saved?`<button class="rfav ${isFav(r.id)?'on':''}" id="fav" title="Favourite">${isFav(r.id)?'⭐':'☆'}</button>`:''}</div>
      ${meal?`<div class="note">📅 ${esc(MEAL_SLOTS.find(s=>s[0]===meal.slot)[1])}, ${fmtD(kd(meal.date),{weekday:'long',day:'numeric',month:'short'})}</div>`:''}
      <div class="rcols"><div><div class="step">Ingredients <span class="serves"><button id="sm">−</button> serves <b>${serves}</b> <button id="sp">＋</button></span></div>
        <ul class="ring">${(r.ing||[]).map(i=>`<li class="${i[3]==='p'?'pantry':''}"><b>${esc(fmtQty(scaleQ(i[0],k,i[1]),i[1]))}</b> ${esc(i[2])}${i[3]==='p'?' <small>(pantry)</small>':''}</li>`).join('')}</ul></div>
      <div><div class="step">Method</div><ol class="rsteps">${(r.steps||[]).map(s=>`<li>${esc(s[0])}${s[1]?` <small>⏱ ${s[1]} min</small>`:''}</li>`).join('')}</ol></div></div>
      <div class="mact" style="flex-wrap:wrap">${meal?'<button class="del" id="rm">Take off the plan</button>':''}${!saved?'<button class="cancel" id="keep">💾 Save to our recipes</button>':`<button class="cancel" id="ed">✏️ Edit</button>`}<button class="cancel" id="shop">🛒 Add to shopping</button>${opt.back||meal?'<button class="cancel" id="bk">Back</button>':'<button class="cancel" id="bk">Close</button>'}<button class="save" id="cook">👩‍🍳 Start cooking</button></div>`;
    const f=m.querySelector('#fav'); if(f) f.onclick=()=>{ setFav(r.id,!isFav(r.id)); draw(); };
    m.querySelector('#sm').onclick=()=>{ if(serves>1){ serves--; if(meal){ meal.serves=serves; meal.serveSet=true; save(); } draw(); } };
    m.querySelector('#sp').onclick=()=>{ serves++; if(meal){ meal.serves=serves; meal.serveSet=true; save(); } draw(); };
    const rm=m.querySelector('#rm'); if(rm) rm.onclick=()=>{ S.meals=S.meals.filter(x=>x.id!==meal.id); save(); close(); openMeals(); };
    const kp=m.querySelector('#keep'); if(kp) kp.onclick=()=>{ saveRecipe(r); toast('Saved to your recipes'); draw(); };
    const ed=m.querySelector('#ed'); if(ed) ed.onclick=()=>{ close(); editRecipe(r); };
    m.querySelector('#shop').onclick=()=>{ close(); addIngredients([{r,serves}],()=>{ if(meal){ meal.shopped=true; save(); } }); };
    m.querySelector('#bk').onclick=()=>{ close(); if(opt.back) opt.back(); else if(meal) openMeals(); };
    m.querySelector('#cook').onclick=()=>{ close(); cookMode(r,serves); };
  }; draw(); });
}
function saveRecipe(r){ S.recipes=S.recipes||[]; if(!(S.recipes||[]).some(x=>x.id===r.id)){ const c=JSON.parse(JSON.stringify(r)); c.id=c.id&&!c.id.startsWith('ai-')?c.id:'r-'+uid(); c.at=Date.now(); S.recipes.push(c); r.id=c.id; } save(); return r; }
// ---- shopping list from meals
function addIngredients(list,after){
  const agg=new Map();
  for(const {r,serves} of list){ const k=serves/(r.serves||4); for(const i of r.ing||[]){ const key=i[2].toLowerCase()+'|'+(i[1]||''); const a=agg.get(key)||{name:i[2],u:i[1]||'',q:0,pantry:i[3]==='p',from:[]}; a.q+=scaleQ(i[0],k,i[1])||0; if(!a.from.includes(r.name)) a.from.push(r.name); agg.set(key,a); } }
  const items=[...agg.values()].sort((a,b)=>a.pantry-b.pantry||a.name.localeCompare(b.name));
  const onList=n=>S.groceries.some(g=>!g.done&&g.name.toLowerCase().startsWith(n.toLowerCase()));
  items.forEach(x=>x.on=!x.pantry&&!onList(x.name));
  modal((m,close)=>{ m.classList.add('wide'); const draw=()=>{
    m.innerHTML=`<h2>🛒 Add to the shopping list</h2><p class="note">Pantry staples and things already on the list are left unticked. Tap to change.</p>
      <div class="tvlist">${items.map((x,i)=>`<button class="mrow ing ${x.on?'on':''}" data-i="${i}"><span class="box">${x.on?'✓':''}</span><span class="mrt"><b>${esc(x.name)}</b><small>${esc(fmtQty(x.q,x.u))}${x.pantry?' · pantry':''}${onList(x.name)?' · already on the list':''}${list.length>1?' · '+esc(x.from.join(', ')):''}</small></span></button>`).join('')}</div>
      <div class="mact"><button class="cancel" id="c">Cancel</button><button class="save" id="s">Add ${items.filter(x=>x.on).length} items</button></div>`;
    m.querySelectorAll('[data-i]').forEach(b=>b.onclick=()=>{ const x=items[+b.dataset.i]; x.on=!x.on; draw(); });
    m.querySelector('#c').onclick=close;
    m.querySelector('#s').onclick=()=>{ const sup=(S.shops.find(s=>s.aisles)||S.shops[0]); let n=0;
      for(const x of items.filter(x=>x.on)){ const base=x.name.toLowerCase(), sid=(S.itemShop[base]&&S.shops.some(s=>s.id===S.itemShop[base]))?S.itemShop[base]:sup.id, q=fmtQty(x.q,x.u);
        S.groceries.push({id:uid(),name:x.name.charAt(0).toUpperCase()+x.name.slice(1)+(q?` (${q})`:''),shop:sid,aisle:shop(sid).aisles?guessAisle(x.name):'',done:false,meal:true}); n++; }
      if(after) after(); save(); close(); renderShop(); if($('#mealLayer').innerHTML) openMeals(); toast(`${n} items added to the shopping list`); };
  }; draw(); });
}
function shopForMeals(days){
  const ms=(S.meals||[]).filter(m=>days.includes(m.date)&&m.rid&&!m.shopped&&recipeById(m.rid));
  if(!ms.length){ toast('Everything this week is already on the list'); return; }
  addIngredients(ms.map(m=>({r:recipeById(m.rid),serves:m.serves||recipeById(m.rid).serves})),()=>ms.forEach(m=>m.shopped=true));
}
// ---- cook mode: one big step at a time, ingredients to tick, timers, screen stays on
let cookWake=null; const cookTimers=[];
function cookMode(r,serves){
  const k=serves/(r.serves||4), steps=r.steps||[], ticks=new Set(); let i=0;
  const el=document.createElement('div'); el.id='cookmode'; document.body.appendChild(el);
  try{ navigator.wakeLock&&navigator.wakeLock.request('screen').then(w=>cookWake=w).catch(()=>{}); }catch(e){}
  const end=()=>{ el.remove(); try{ cookWake&&cookWake.release(); }catch(e){} cookWake=null; };
  const tmHTML=()=>cookTimers.filter(t=>t.el===el).map(t=>{ const left=Math.max(0,Math.round((t.at-Date.now())/1000)); return `<span class="ctm ${left?'':'done'}">⏱ ${esc(t.label)} ${left?Math.floor(left/60)+':'+String(left%60).padStart(2,'0'):'done!'}</span>`; }).join('');
  const draw=()=>{
    const head=`<div class="chead"><b>${r.emoji||'🍽️'} ${esc(r.name)}</b><span class="ctms" id="ctms">${tmHTML()}</span><button class="mclose" id="cx" aria-label="Close">✕</button></div>`;
    let body;
    if(i===0) body=`<div class="cstep"><div class="cnum">Get ready</div><p class="ctext" style="font-size:22px">Get these out (serves ${serves}). Tick them off as you go.</p>
      <div class="cing">${(r.ing||[]).map((x,j)=>`<button class="${ticks.has(j)?'on':''}" data-j="${j}"><span class="box">${ticks.has(j)?'✓':''}</span><b>${esc(fmtQty(scaleQ(x[0],k,x[1]),x[1]))}</b> ${esc(x[2])}</button>`).join('')}</div></div>`;
    else { const s=steps[i-1]; body=`<div class="cstep"><div class="cnum">Step ${i} of ${steps.length}</div><p class="ctext">${esc(s[0])}</p>${s[1]?`<button class="ctimer" id="tm">⏱ Start a ${s[1]} minute timer</button>`:''}</div>`; }
    el.innerHTML=head+body+`<div class="cdots">${[0,...steps.map((_,j)=>j+1)].map(j=>`<i class="${j===i?'on':''}"></i>`).join('')}</div>
      <div class="cnav"><button id="cp" ${i===0?'disabled':''}>‹ Back</button><button id="cn" class="go">${i===steps.length?'✓ Finished':'Next ›'}</button></div>`;
    el.querySelector('#cx').onclick=end;
    el.querySelectorAll('[data-j]').forEach(b=>b.onclick=()=>{ const j=+b.dataset.j; ticks.has(j)?ticks.delete(j):ticks.add(j); draw(); });
    el.querySelector('#cp').onclick=()=>{ if(i>0){ i--; draw(); } };
    el.querySelector('#cn').onclick=()=>{ if(i<steps.length){ i++; draw(); } else { end(); toast('Enjoy! 🍽️'); } };
    const tm=el.querySelector('#tm'); if(tm) tm.onclick=()=>{ const s=steps[i-1]; cookTimers.push({el,at:Date.now()+s[1]*60e3,label:'Step '+i,rung:false}); tm.disabled=true; tm.textContent='⏱ Timer running'; };
  };
  let sx=null; el.addEventListener('pointerdown',e=>{ sx=e.clientX; }); el.addEventListener('pointerup',e=>{ if(sx==null) return; const dx=e.clientX-sx; sx=null; if(Math.abs(dx)>80&&!e.target.closest('button')){ if(dx<0&&i<steps.length) i++; else if(dx>0&&i>0) i--; draw(); } });
  const tick=setInterval(()=>{ if(!el.isConnected){ clearInterval(tick); return; } for(const t of cookTimers) if(t.el===el&&!t.rung&&Date.now()>=t.at){ t.rung=true; ding(); toast('⏱ '+t.label+' timer is done'); } const c=el.querySelector('#ctms'); if(c) c.innerHTML=tmHTML(); },1000);
  draw();
}
function ding(){ try{ navigator.vibrate&&navigator.vibrate([300,150,300,150,300]); const a=new (window.AudioContext||window.webkitAudioContext)(); [0,0.35,0.7].forEach(t=>{ const o=a.createOscillator(), g=a.createGain(); o.frequency.value=880; g.gain.setValueAtTime(0.25,a.currentTime+t); g.gain.exponentialRampToValueAtTime(0.001,a.currentTime+t+0.3); o.connect(g); g.connect(a.destination); o.start(a.currentTime+t); o.stop(a.currentTime+t+0.3); }); }catch(e){} }
// ---- typing a recipe in (or checking one the AI read)
const UNITS=['g','kg','ml','L','cup','cups','tbsp','tsp','can','cans','clove','cloves','bunch','sachet','sheet','sheets','slice','slices','rasher','rashers','handful','pinch','sprig','stalk','head','bag','jar','packet','pkt'];
function parseIng(line){
  let s=line.trim().replace(/^[-•*]\s*/,''); if(!s) return null; let pantry=false; if(/\(pantry\)\s*$/i.test(s)){ pantry=true; s=s.replace(/\(pantry\)\s*$/i,'').trim(); }
  const m=s.match(/^(\d+\s+\d\/\d|\d+\/\d|\d*[.,]?\d+|[¼½¾⅓⅔])\s*(.*)$/); let q=0, rest=s;
  if(m){ const t=m[1].replace(',','.'); const fr={'¼':.25,'½':.5,'¾':.75,'⅓':.33,'⅔':.67}; q=fr[t]||(t.includes('/')?t.split(/\s+/).reduce((a,p)=>a+(p.includes('/')?(+p.split('/')[0])/(+p.split('/')[1]):+p),0):+t); rest=m[2]; }
  let u=''; const um=rest.match(/^([A-Za-z]+)\.?\s+(.*)$/); if(q&&um&&UNITS.includes(um[1].toLowerCase())){ u=um[1].toLowerCase().replace(/s$/,'').replace(/^l$/,'L'); if(['cup','can','clove','sheet','slice','rasher'].includes(u)) u=u; rest=um[2]; } else { const g=rest.match(/^(g|kg|ml|L)\s+(.*)$/i); if(q&&g){ u=g[1]==='l'?'L':g[1].toLowerCase()==='l'?'L':g[1].toLowerCase(); rest=g[2]; } }
  if(u==='kg'){ q*=1000; u='g'; } if(u==='L'&&q<10){ q*=1000; u='ml'; }
  return [q,u,rest.replace(/^of\s+/,''),pantry?'p':undefined].filter((x,i)=>i<3||x);
}
const ingLine=i=>(i[0]?fmtQty(i[0],i[1])+' ':'')+i[2]+(i[3]==='p'?' (pantry)':'');
function editRecipe(r0){
  const r=r0?JSON.parse(JSON.stringify(r0)):{name:'',meal:'dinner',tags:[],mins:30,serves:4,emoji:'🍽️',ing:[],steps:[]};
  modal((m,close)=>{ m.classList.add('wide');
    m.innerHTML=`<h2>${r0&&recipeById(r0.id)?'✏️ Edit recipe':'📝 New recipe'}</h2>
      <div class="rform"><label>Name<input class="txt" id="fn" value="${esc(r.name)}" placeholder="e.g. Nana's lasagne"></label>
      <div class="row"><label>Emoji<input class="txt" id="fe" value="${esc(r.emoji||'🍽️')}" style="width:80px"></label><label>Meal<select id="fm" class="txt">${MEAL_SLOTS.map(s=>`<option value="${s[0]}" ${r.meal===s[0]?'selected':''}>${s[1]}</option>`).join('')}</select></label>
      <label>Minutes<input class="txt" id="ft" type="number" value="${r.mins||''}" style="width:100px"></label><label>Serves<input class="txt" id="fs" type="number" value="${r.serves||4}" style="width:90px"></label></div>
      <label>Tags <small>(comma separated, e.g. Mexican, Quick, Kids love it)</small><input class="txt" id="fg" value="${esc((r.tags||[]).join(', '))}"></label>
      <label>Short description<input class="txt" id="fb" value="${esc(r.blurb||'')}"></label>
      <label>Ingredients <small>(one per line, e.g. “500 g beef mince”. Add “(pantry)” for things you always have)</small><textarea class="txt" id="fi" rows="8">${esc((r.ing||[]).map(ingLine).join('\n'))}</textarea></label>
      <label>Steps <small>(one per line. Add “[10 min]” for a timer)</small><textarea class="txt" id="fst" rows="8">${esc((r.steps||[]).map(s=>s[0]+(s[1]?` [${s[1]} min]`:'')).join('\n'))}</textarea></label></div>
      <div class="mact">${r0&&recipeById(r0.id)?'<button class="del" id="d">Delete</button>':''}<button class="cancel" id="c">Cancel</button><button class="save" id="s">Save recipe</button></div>`;
    m.querySelector('#c').onclick=close;
    const d=m.querySelector('#d'); if(d) d.onclick=()=>{ if(!confirm('Delete this recipe?')) return; if(STARTERS.some(x=>x.id===r0.id)) { S.recHide=[...(S.recHide||[]),r0.id]; } S.recipes=(S.recipes||[]).filter(x=>x.id!==r0.id); setFav(r0.id,false); close(); toast('Recipe deleted'); };
    m.querySelector('#s').onclick=()=>{ const v=id=>m.querySelector(id).value;
      const out={name:v('#fn').trim(),emoji:v('#fe').trim()||'🍽️',meal:v('#fm'),mins:+v('#ft')||0,serves:+v('#fs')||4,tags:v('#fg').split(',').map(x=>x.trim()).filter(Boolean),blurb:v('#fb').trim(),
        ing:v('#fi').split('\n').map(parseIng).filter(Boolean),steps:v('#fst').split('\n').map(x=>x.trim()).filter(Boolean).map(x=>{ const t=x.match(/\[(\d+)\s*min\]/i); return t?[x.replace(t[0],'').trim(),+t[1]]:[x]; })};
      if(!out.name){ toast('Give it a name'); return; } if(!out.ing.length){ toast('Add the ingredients'); return; }
      S.recipes=S.recipes||[];
      const ex=r0&&(S.recipes.find(x=>x.id===r0.id));
      if(ex) Object.assign(ex,out); else if(r0&&STARTERS.some(x=>x.id===r0.id)){ const c=Object.assign({id:'r-'+uid(),from:r0.id,at:Date.now()},out); S.recipes.push(c); if(isFav(r0.id)){ setFav(r0.id,false); setFav(c.id,true); } (S.meals||[]).forEach(x=>{ if(x.rid===r0.id) x.rid=c.id; }); }
      else S.recipes.push(Object.assign({id:'r-'+uid(),at:Date.now()},out));
      save(); close(); toast('Recipe saved'); };
  });
}
function addRecipeMenu(){
  modal((m,close)=>{ m.innerHTML=`<h2>＋ Add a recipe</h2><div class="opts" style="flex-direction:column;align-items:stretch">
    <button class="opt" id="a1">✏️ Type it in</button><button class="opt" id="a2">📷 From a photo, PDF or screenshot</button><button class="opt" id="a3">📋 Paste a recipe or a web link</button></div>
    <p class="note">Photos and links are read by your Gemini helper, then you check it before saving.</p><div class="mact"><button class="cancel" id="c">Close</button></div>`;
    m.querySelector('#c').onclick=close; m.querySelector('#a1').onclick=()=>{ close(); editRecipe(); };
    m.querySelector('#a2').onclick=()=>{ const f=document.createElement('input'); f.type='file'; f.accept='image/*,application/pdf'; f.onchange=async()=>{ const file=f.files[0]; if(!file) return; close(); try{ const data=await fileForAI(file); readRecipe({file:data}); }catch(e){ toast(e.message||'Could not read that file'); } }; f.click(); };
    m.querySelector('#a3').onclick=()=>{ close(); modal((m2,close2)=>{ m2.innerHTML=`<h2>📋 Paste a recipe or link</h2><textarea class="txt" id="t" rows="8" placeholder="Paste the recipe text, or a link to a recipe page"></textarea><div class="mact"><button class="cancel" id="c">Cancel</button><button class="save" id="s">✨ Read it</button></div>`;
      m2.querySelector('#c').onclick=close2; m2.querySelector('#s').onclick=()=>{ const v=m2.querySelector('#t').value.trim(); if(!v) return; close2(); readRecipe(/^https?:\/\/\S+$/.test(v)?{url:v}:{text:v}); }; }); };
  });
}
async function fileForAI(file){
  if(file.type==='application/pdf'){ if(file.size>12e6) throw new Error('That PDF is too big'); const b=await file.arrayBuffer(); let s=''; const u=new Uint8Array(b); for(let i=0;i<u.length;i+=32768) s+=String.fromCharCode.apply(null,u.subarray(i,i+32768)); return {mime:'application/pdf',data:btoa(s)}; }
  const img=await new Promise((ok,no)=>{ const i=new Image(); i.onload=()=>ok(i); i.onerror=()=>no(new Error('Could not open that picture')); i.src=URL.createObjectURL(file); });
  const sc=Math.min(1,1600/Math.max(img.width,img.height)), c=document.createElement('canvas'); c.width=Math.round(img.width*sc); c.height=Math.round(img.height*sc); c.getContext('2d').drawImage(img,0,0,c.width,c.height);
  return {mime:'image/jpeg',data:c.toDataURL('image/jpeg',0.85).split(',')[1]};
}
// ---- AI (Gemini, through the family's own Google helper so the key never sits in the app)
const RECIPE_SHAPE=`{"name":"...","meal":"dinner|lunch|breakfast","emoji":"one food emoji","mins":30,"serves":4,"tags":["Mexican","Quick"],"blurb":"one friendly sentence","ing":[[500,"g","beef mince"],[1,"","brown onion"],[1,"tbsp","oil","p"]],"steps":[["Step text, clear and specific.",8],["Step without a timer."]]}`;
const RECIPE_RULES=`Rules for every recipe: metric units only (g, ml, tsp, tbsp, cup, or "" for counted items); ingredient names as they'd appear on a New Zealand supermarket shelf (Woolworths, New World, PAK'nSAVE), e.g. "kūmara", "capsicum", "courgette"; mark pantry staples (oil, salt, pepper, flour, sugar, soy sauce, butter, spices) with "p" as a 4th item; steps written HelloFresh-style: 4-7 numbered steps, each one or two short sentences, saying the heat and what "done" looks like; add the minutes as the 2nd item of a step only when there's waiting or cooking time.`;
/* ---- talking to Gemini. With the family's key in hand the app calls Gemini itself, word by word (fast); otherwise it
   goes through the Google helper. Thinking is kept low: these are quick jobs. ---- */
const AI_MODEL_DEFAULT='gemini-3.6-flash';
async function aiModel(key,force){
  const saved=lsGet('fs.aiModel',''); if(saved&&!force) return saved;
  try{ const r=await fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=200',{headers:{'x-goog-api-key':key}}); const j=await r.json();
    const ok=(j.models||[]).filter(m=>(m.supportedGenerationMethods||[]).includes('generateContent')&&/gemini-[\d.]+-flash$/.test(m.name)).map(m=>m.name.replace('models/','')).sort((a,b)=>parseFloat(b.split('-')[1])-parseFloat(a.split('-')[1]));
    if(ok.length){ lsSet('fs.aiModel',ok[0]); return ok[0]; } }catch(e){}
  return AI_MODEL_DEFAULT;
}
// one call. payload: {prompt, file:{mime,data}, url, json:true|false}; onText(partial) streams the words as they arrive
async function aiAsk(payload,onText){
  if(LOCAL&&!window.AI_TEST) throw new Error('AI works in the real app once you’re signed in');
  if(S.aiKey) return aiDirect(S.aiKey,payload,onText);
  const h=S.linkHelper; if(!h||!h.url){ requirePin(()=>aiSetup()); throw new Error('quiet'); }
  let t; try{ const r=await fetch(h.url,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify(Object.assign({key:h.key,action:'ai'},payload)),redirect:'follow'}); t=await r.text(); }
  catch(e){ throw new Error('Could not reach your Google helper. Check the internet and try again.'); }
  let j; try{ j=JSON.parse(t); }catch(e){ requirePin(()=>aiSetup(true)); throw new Error('quiet'); }
  if(j.error==='nokey'){ requirePin(()=>aiSetup()); throw new Error('quiet'); }
  if(j.error) throw new Error(/not allowed/.test(j.error)?'The helper key doesn’t match. Copy the helper code again (⚙️ → Connect calendars).':'Gemini said: '+String(j.error).slice(0,160));
  return aiParse(j.text,payload.json!==false);
}
function aiParse(text,json){ const s=String(text||'').replace(/^```(?:json)?\s*|\s*```$/g,'').trim(); if(!json) return s; try{ return JSON.parse(s); }catch(e){ const m=s.match(/\{[\s\S]*\}/); if(m) try{ return JSON.parse(m[0]); }catch(x){} throw new Error('Gemini sent back something I couldn’t read. Try again.'); } }
async function aiDirect(key,payload,onText,tried){
  tried=tried||{};
  const json=payload.json!==false, parts=[{text:String(payload.prompt||'').slice(0,120000)}];
  if(payload.url) parts[0].text+='\n\nWeb page to read: '+payload.url;
  if(payload.file&&payload.file.data) parts.push({inline_data:{mime_type:payload.file.mime||'image/jpeg',data:payload.file.data}});
  const gc={temperature:0.4}; if(json) gc.responseMimeType='application/json'; if(!tried.think) gc.thinkingConfig={thinkingLevel:'low'};
  const body={contents:[{role:'user',parts}],generationConfig:gc}; if(payload.url&&!tried.url) body.tools=[{url_context:{}}];
  const model=await aiModel(key);
  const ctl=new AbortController(); payload.abort=ctl;
  let r; try{ r=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse`,{method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':key},body:JSON.stringify(body),signal:ctl.signal}); }
  catch(e){ if(e.name==='AbortError') throw new Error('quiet'); throw new Error('Could not reach Gemini. Check the internet and try again.'); }
  if(!r.ok){ const t=await r.text().catch(()=>''); 
    if(r.status===404&&!tried.model){ tried.model=true; await aiModel(key,true); return aiDirect(key,payload,onText,tried); }
    if(r.status===400&&/think/i.test(t)&&!tried.think){ tried.think=true; return aiDirect(key,payload,onText,tried); }
    if(r.status===400&&/url_context|tool/i.test(t)&&!tried.url){ tried.url=true; return aiDirect(key,payload,onText,tried); }
    if(r.status===400&&/API key|invalid/i.test(t)) throw new Error('Gemini didn’t accept the key. Check it under ⚙️ → ✨ AI.');
    if(r.status===429) throw new Error('Gemini is busy (the free limit for this minute is used up). Try again in a moment.');
    let msg=''; try{ msg=JSON.parse(t).error.message; }catch(e){} throw new Error('Gemini said: '+(msg||r.status).toString().slice(0,160)); }
  let text='', buf=''; const rd=r.body.getReader(), dec=new TextDecoder();
  while(true){ const {done,value}=await rd.read(); if(done) break; buf+=dec.decode(value,{stream:true});
    let i; while((i=buf.indexOf('\n'))>=0){ const line=buf.slice(0,i).trim(); buf=buf.slice(i+1); if(!line.startsWith('data:')) continue;
      try{ const j=JSON.parse(line.slice(5)); const ps=(((j.candidates||[])[0]||{}).content||{}).parts||[]; const add=ps.map(p=>p.text||'').join(''); if(add){ text+=add; if(onText) onText(text); else aiProgress(text); } }catch(e){} } }
  if(buf.trim().startsWith('data:')) try{ const j=JSON.parse(buf.trim().slice(5)); const add=((((j.candidates||[])[0]||{}).content||{}).parts||[]).map(p=>p.text||'').join(''); if(add){ text+=add; if(onText) onText(text); } }catch(e){}
  if(!text) throw new Error('Gemini sent nothing back. Try again.');
  return aiParse(text,json);
}

/* ---- family memory: notes the family drops in, which every AI feature reads first ---- */
const memNotes=()=>(S.memory||[]).filter(m=>m.text);
// what to tell Gemini: all the notes when they're short, otherwise the ones that share words with the question
function memoryContext(query,budget){
  budget=budget||5000; const notes=memNotes(); if(!notes.length) return '';
  const line=n=>'- '+(n.title?n.title+': ':'')+n.text.replace(/\s+/g,' ').trim();
  let all=notes.map(line).join('\n'); if(all.length<=budget) return all;
  const words=new Set(String(query||'').toLowerCase().split(/[^a-zāēīōū']+/).filter(w=>w.length>3));
  const score=n=>{ const t=(n.title+' '+n.text+' '+(n.tags||[]).join(' ')).toLowerCase(); let k=0; words.forEach(w=>{ if(t.includes(w)) k++; }); return k+(n.pin?3:0); };
  const picked=notes.map(n=>[score(n),n]).sort((a,b)=>b[0]-a[0]||(b[1].at||0)-(a[1].at||0)); let out='', used=0;
  for(const [,n] of picked){ const l=line(n); if(used+l.length>budget) continue; out+=l+'\n'; used+=l.length; }
  return out.trim();
}
const familyIntro=()=>`The family (Auckland, New Zealand): ${eaters().map(p=>p.name+(p.id===(traveller()||{}).id?' (flies for work as cabin crew, often away)':'')).join(', ')}. Today is ${fmtD(new Date(),{weekday:'long',day:'numeric',month:'long',year:'numeric'})}.`;
const withMemory=(prompt,query)=>{ const mc=memoryContext(query||prompt); return familyIntro()+(mc?'\n\nThings the family has told you (use them, they matter):\n'+mc:'')+'\n\n'+prompt; };
function openMemory(){
  let q='';
  modal((m,close)=>{ m.classList.add('wide','tvsheet'); const draw=()=>{ const k=q.trim().toLowerCase();
    const list=memNotes().filter(n=>!k||(n.title+' '+n.text+' '+(n.tags||[]).join(' ')).toLowerCase().includes(k)).sort((a,b)=>(b.pin?1:0)-(a.pin?1:0)||(b.at||0)-(a.at||0));
    m.innerHTML=`<div class="tvhead"><h2>🧠 Family memory</h2><button class="save" id="x">Done</button></div>
      <p class="note">What the family knows. Meal ideas, recipes, bills and Ask all read these first, so the more you put in, the better they get: who likes what, allergies, the car, the house, school, routines, favourite shops, anything.</p>
      <div class="memdrop" id="drop"><b>➕ Drop a file here, or tap</b><small>Notes, PDFs, photos, screenshots, Word files. Gemini reads them into short notes you can edit.</small><input type="file" id="mf" multiple accept="image/*,application/pdf,text/*,.txt,.md,.csv,.docx" hidden></div>
      <form class="addrow" id="mform" style="padding:8px 0"><input id="mtxt" placeholder="…or type a fact: Aria is allergic to peanuts; the Mazda takes 95" autocomplete="off" enterkeyhint="done"><button aria-label="Add">＋</button></form>
      <input class="txt" id="mq" placeholder="Search the notes" value="${esc(q)}" autocomplete="off">
      <div class="tvlist">${list.map(n=>`<button class="mrow mem" data-m="${n.id}"><span class="me">${n.pin?'📌':n.src==='file'?'📄':'📝'}</span><span class="mrt"><b>${esc(n.title||n.text.slice(0,60))}</b><small>${esc(n.text.slice(0,140))}${n.text.length>140?'…':''}</small></span></button>`).join('')||'<p class="note">Nothing yet. Drop in a file or type a fact.</p>'}</div>`;
    m.querySelector('#x').onclick=close;
    const dz=m.querySelector('#drop'), fi=m.querySelector('#mf'); dz.onclick=()=>fi.click();
    ['dragenter','dragover'].forEach(ev=>dz.addEventListener(ev,e=>{ e.preventDefault(); dz.classList.add('over'); })); ['dragleave','drop'].forEach(ev=>dz.addEventListener(ev,e=>{ e.preventDefault(); dz.classList.remove('over'); }));
    dz.addEventListener('drop',e=>memFiles([...e.dataTransfer.files],draw)); fi.onchange=()=>{ memFiles([...fi.files],draw); fi.value=''; };
    m.querySelector('#mform').onsubmit=e=>{ e.preventDefault(); const v=m.querySelector('#mtxt').value.trim(); if(!v) return; addMem({text:v,src:'typed'}); draw(); };
    const qi=m.querySelector('#mq'); qi.oninput=()=>{ q=qi.value; const p=qi.selectionStart; draw(); const n=m.querySelector('#mq'); n.focus(); n.setSelectionRange(p,p); };
    m.querySelectorAll('[data-m]').forEach(b=>b.onclick=()=>{ close(); editMem((S.memory||[]).find(x=>x.id===b.dataset.m)); });
  }; draw(); });
}
function addMem(n){ S.memory=S.memory||[]; const x=Object.assign({id:uid(),title:'',text:'',tags:[],at:Date.now(),by:mePerson()||''},n); x.text=String(x.text).slice(0,4000); x.title=String(x.title||'').slice(0,80); S.memory.unshift(x); save(); return x; }
function editMem(n){
  modal((m,close)=>{ m.classList.add('wide');
    m.innerHTML=`<h2>${n.src==='file'?'📄':'📝'} Memory note</h2><div class="rform"><label>Title<input class="txt" id="t" value="${esc(n.title||'')}" placeholder="e.g. The Mazda, Aria's school, What we like to eat"></label>
      <label>What to remember<textarea class="txt" id="x" rows="9">${esc(n.text)}</textarea></label>
      <label class="small" style="flex-direction:row;align-items:center;gap:8px"><input type="checkbox" id="pin" ${n.pin?'checked':''}> 📌 Always include this (even when there are lots of notes)</label>
      ${n.file?`<p class="note">From ${esc(n.file)}${n.at?' · '+fmtD(new Date(n.at),{day:'numeric',month:'short',year:'numeric'}):''}</p>`:''}</div>
      <div class="mact"><button class="del" id="d">Delete</button><button class="cancel" id="c">Back</button><button class="save" id="s">Save</button></div>`;
    m.querySelector('#c').onclick=()=>{ close(); openMemory(); };
    m.querySelector('#d').onclick=()=>{ S.memory=S.memory.filter(x=>x.id!==n.id); save(); close(); openMemory(); };
    m.querySelector('#s').onclick=()=>{ n.title=m.querySelector('#t').value.trim().slice(0,80); n.text=m.querySelector('#x').value.trim().slice(0,4000); n.pin=m.querySelector('#pin').checked; if(!n.text){ toast('Type something to remember'); return; } save(); close(); openMemory(); };
  });
}
async function memFiles(files,after){
  for(const f of files.slice(0,10)){
    try{
      if(/^text\/|\.(txt|md|csv)$/i.test(f.type+' '+f.name)){ const t=(await f.text()).trim(); if(t) addMem({title:f.name.replace(/\.[^.]+$/,''),text:t.slice(0,4000),src:'file',file:f.name}); continue; }
      if(/\.docx$/i.test(f.name)){ const t=await docxText(f); if(t) addMem({title:f.name.replace(/\.[^.]+$/,''),text:t.slice(0,4000),src:'file',file:f.name}); continue; }
      const done=aiBusy('Reading '+f.name+'…');
      try{ const data=await fileForAI(f);
        const out=await aiAsk({prompt:withMemory(`Read the attached file for a family's memory bank. Return JSON only: {"title":"short title","notes":["one fact per item, short, in plain English, keep names, numbers, dates, amounts and addresses exactly"]}. Keep every fact that could matter to the family later (people, pets, cars, house, school, work, health, money, routines, preferences, contacts, dates, bookings, recipes). Skip boilerplate and legal text. Up to 40 facts.`),file:data,json:true});
        done(); const notes=(out.notes||[]).map(String).filter(Boolean); if(!notes.length) throw new Error('Nothing useful found in '+f.name);
        addMem({title:String(out.title||f.name).slice(0,80),text:notes.map(x=>'• '+x).join('\n'),src:'file',file:f.name}); toast('Read '+f.name+': '+notes.length+' facts'); }
      catch(e){ done(); throw e; }
    }catch(e){ if(e.message!=='quiet') toast(e.message||('Could not read '+f.name)); }
  }
  if(after) after();
}
async function docxText(f){
  try{ const buf=await f.arrayBuffer(), dv=new DataView(buf), u8=new Uint8Array(buf);
    // find the central directory, then word/document.xml
    let eocd=-1; for(let i=u8.length-22;i>=Math.max(0,u8.length-66000);i--) if(dv.getUint32(i,true)===0x06054b50){ eocd=i; break; } if(eocd<0) return '';
    let p=dv.getUint32(eocd+16,true); const n=dv.getUint16(eocd+10,true);
    for(let k=0;k<n;k++){ if(dv.getUint32(p,true)!==0x02014b50) break; const method=dv.getUint16(p+10,true), csz=dv.getUint32(p+20,true), nl=dv.getUint16(p+28,true), el=dv.getUint16(p+30,true), cl=dv.getUint16(p+32,true), off=dv.getUint32(p+42,true);
      const name=new TextDecoder().decode(u8.subarray(p+46,p+46+nl)); p+=46+nl+el+cl;
      if(name!=='word/document.xml') continue;
      const lnl=dv.getUint16(off+26,true), lel=dv.getUint16(off+28,true), start=off+30+lnl+lel, data=u8.subarray(start,start+csz);
      let xml; if(method===0) xml=new TextDecoder().decode(data); else { const ds=new DecompressionStream('deflate-raw'); const w=ds.writable.getWriter(); w.write(data); w.close(); xml=await new Response(ds.readable).text(); }
      return xml.replace(/<\/w:p>/g,'\n').replace(/<w:tab\/>/g,'\t').replace(/<[^>]+>/g,'').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&#(\d+);/g,(_,n)=>String.fromCharCode(+n)).replace(/\n{3,}/g,'\n\n').trim(); }
    return ''; }catch(e){ return ''; }
}

/* ---- Ask: anything about the family, answered from what the app knows ---- */
function askContext(){
  const today=dk(new Date()), days=[...Array(8)].map((_,i)=>dk(addDays(new Date(),i))), out=[];
  const tp=traveller(); if(tp){ const now=new Date(), r=travellerNow(now), fl=(S.flights||[]).filter(f=>f.who===tp.id), nx=fl.filter(f=>fS(f)>now).sort((a,b)=>fS(a)-fS(b))[0], hm2=fl.filter(f=>fS(f)>now&&HOME.includes(f.to)).sort((a,b)=>fS(a)-fS(b))[0];
    const ft=f=>f?`${f.from}→${f.to} leaving ${fmtD(fS(f),{weekday:'short',day:'numeric',month:'short'})} ${fmtTime(fS(f),'Pacific/Auckland')}, landing ${fmtD(fE(f),{weekday:'short',day:'numeric',month:'short'})} ${fmtTime(fE(f),'Pacific/Auckland')} (NZ time)`:'';
    out.push(`${tp.name} right now: ${r?(r.air?'in the air '+r.air.from+'→'+r.air.to:'away in '+(r.a?r.a[0]+', '+r.a[2]:r.code)):'at home'}.${nx?' Next flight: '+ft(nx)+'.':' No more flights loaded.'}${hm2?' Back home: lands '+fmtD(fE(hm2),{weekday:'long',day:'numeric',month:'short'})+' '+fmtTime(fE(hm2),'Pacific/Auckland')+' NZ time.':''}`); }
  for(const key of days){ const items=itemsForDay(key).filter(x=>x.k==='ev'&&x.e).map(x=>(x.e.time?t12(x.e.time)+' ':'')+x.e.title+(x.e.whos&&x.e.whos.length?' ('+x.e.whos.map(nm).join(', ')+')':'')); if(items.length) out.push(`${key===today?'Today':fmtD(kd(key),{weekday:'long',day:'numeric',month:'short'})}: ${items.join('; ')}`); }
  const jobs=(S.todos||[]).filter(t=>!t.done&&vis(t)); if(jobs.length) out.push('Jobs to do: '+jobs.slice(0,40).map(t=>t.title+(person(t.who)?' ('+nm(t.who)+')':'')).join('; '));
  const meals=(S.meals||[]).filter(m=>days.includes(m.date)); if(meals.length) out.push('Meal plan: '+meals.map(m=>{ const r=m.rid&&recipeById(m.rid); return fmtD(kd(m.date),{weekday:'short'})+' '+m.slot+': '+(r?r.name:m.note||''); }).join('; '));
  const shop=(S.groceries||[]).filter(g=>!g.done); if(shop.length) out.push('Shopping list: '+shop.slice(0,60).map(g=>g.name).join(', '));
  const bills=(S.bills||[]).filter(b=>b.status==='due'||b.status==='check'); if(bills.length) out.push('Bills: '+bills.map(b=>(b.biller||'Bill')+' '+$m(b.amount)+(b.due?' due '+b.due:'')+(b.status==='check'?' (to check)':'')+(b.directDebit?' (direct debit)':'')).join('; '));
  const rn=(S.renewals||[]).filter(r=>r.due); if(rn.length) out.push('Renewals: '+rn.map(r=>r.what+(r.item?' '+r.item:'')+' due '+r.due).join('; '));
  return out.join('\n');
}
let askLog=[], askCur=null;
function openAsk(seed){
  modal((m,close)=>{ m.classList.add('wide','tvsheet');
    m.innerHTML=`<div class="tvhead"><h2>💬 Ask</h2><button class="save" id="x">Done</button></div>
      <div class="asklog" id="log"></div>
      <div class="askchips" id="chips"></div>
      <form class="addrow" id="af"><input id="aq" placeholder="e.g. What’s on tomorrow? When is Mummy home? What do we need for Thursday’s dinner?" autocomplete="off" enterkeyhint="send"><button aria-label="Ask">➤</button></form>`;
    const log=m.querySelector('#log'), qi=m.querySelector('#aq');
    const chips=['What’s on this week?','When is Mummy home?','What should I cook tonight?','What bills are due?','What jobs are mine?'];
    const drawLog=()=>{ log.innerHTML=askLog.map(x=>`<div class="ask ${x.who}">${x.who==='you'?esc(x.text):mdLite(x.text)}</div>`).join('')||'<p class="note">Ask anything about the family’s week, meals, bills, jobs or what’s in memory. Answers come from what the app knows, not the internet.</p>'; log.scrollTop=log.scrollHeight;
      m.querySelector('#chips').innerHTML=askLog.length?'':chips.map(c=>`<button type="button" class="opt sm" data-c="${esc(c)}">${esc(c)}</button>`).join(''); m.querySelectorAll('[data-c]').forEach(b=>b.onclick=()=>ask(b.dataset.c)); };
    const ask=async q=>{ if(!q) return; qi.value=''; askLog.push({who:'you',text:q}); const a={who:'ai',text:'…'}; askLog.push(a); drawLog();
      const hist=askLog.slice(-7,-2).map(x=>(x.who==='you'?'Q: ':'A: ')+x.text).join('\n');
      const prompt=withMemory(`You are the family's helper on their fridge screen. Answer the question briefly and warmly in plain English (NZ spelling), using ONLY the facts below and the family notes. If you don't know, say so and suggest where to look in the app. Use short lines or a short list; no headings; no markdown tables.\n\nWhat the app knows:\n${askContext()}\n${hist?'\nEarlier in this chat:\n'+hist+'\n':''}\nQuestion: ${q}`,q);
      const pl={prompt,json:false}; askCur=pl;
      try{ const txt=await aiAsk(pl,t=>{ a.text=t; drawLog(); }); a.text=txt; }catch(e){ a.text=e.message==='quiet'?'(AI isn’t set up yet)':'⚠️ '+e.message; } drawLog(); };
    m.querySelector('#x').onclick=()=>{ if(askCur&&askCur.abort) try{ askCur.abort.abort(); }catch(e){} close(); }; m.querySelector('#af').onsubmit=e=>{ e.preventDefault(); ask(qi.value.trim()); };
    drawLog(); if(seed) ask(seed); else qi.focus();
  });
}
// a little markdown: bold, bullets, line breaks
function mdLite(t){ return esc(t).replace(/\*\*(.+?)\*\*/g,'<b>$1</b>').split('\n').map(l=>/^\s*[-•*]\s+/.test(l)?'<div class="li">• '+l.replace(/^\s*[-•*]\s+/,'')+'</div>':l?'<div>'+l+'</div>':'').join(''); }

const cleanRecipe=x=>({id:'ai-'+uid(),name:String(x.name||'Recipe').slice(0,80),meal:['dinner','lunch','breakfast'].includes(x.meal)?x.meal:'dinner',emoji:x.emoji||'🍽️',mins:+x.mins||0,serves:+x.serves||4,tags:(x.tags||[]).map(String).slice(0,5),blurb:String(x.blurb||''),
  ing:(x.ing||[]).filter(i=>Array.isArray(i)&&i[2]).map(i=>[+i[0]||0,String(i[1]||''),String(i[2])].concat(i[3]==='p'?['p']:[])),steps:(x.steps||[]).map(s=>Array.isArray(s)?[String(s[0]),+s[1]||undefined].filter(v=>v!==undefined):[String(s)])});
function aiBusy(msg){ const el=document.createElement('div'); el.className='aibusy'; el.innerHTML=`<div><div class="spin"></div><p>${esc(msg)}</p><small id="aiProg"></small></div>`; document.body.appendChild(el); return ()=>el.remove(); }
function aiProgress(text){ const p=document.getElementById('aiProg'); if(p) p.textContent=text.length<40?'Thinking…':'Writing… '+text.split(/\s+/).length+' words'; }
async function readRecipe(src){
  const done=aiBusy('Reading the recipe…');
  try{ const out=await aiAsk(Object.assign({json:true,prompt:withMemory(`Read the recipe in the attached ${src.file?'file':src.url?'web page':'text'} and return it as JSON exactly in this shape (one recipe object, no extra text):\n${RECIPE_SHAPE}\n${RECIPE_RULES}\nKeep the original quantities and serves; rewrite the method into clear steps.`+(src.text?'\n\nRECIPE:\n'+src.text.slice(0,20000):''),'recipe')},src.file?{file:src.file}:src.url?{url:src.url}:{}));
    done(); const r=cleanRecipe(out.recipe||out); delete r.id; editRecipe(r); }
  catch(e){ done(); if(e.message!=='quiet') toast(e.message); }
}
const MOODS=['Kiwi classics','Mexican','Asian','Italian','Indian','Middle Eastern','Quick (under 30 min)','Healthy','Kids love it','Vegetarian','Comfort food','One pan','Budget','BBQ'];
function openIdeas(plan){
  const st={meal:(plan&&plan.slot)||'dinner',moods:[],extra:'',n:5,people:plan?Math.max(1,homeOn(plan.key).length):eaters().length};
  modal((m,close)=>{ m.classList.add('wide'); const draw=()=>{
    m.innerHTML=`<h2>✨ What do we feel like?</h2>
      <div class="step">Meal</div><div class="opts">${MEAL_SLOTS.map(s=>`<button class="opt sm ${st.meal===s[0]?'on':''}" data-meal="${s[0]}">${s[2]} ${s[1]}</button>`).join('')}</div>
      <div class="step">Feeling like <span style="font-weight:500">(tap any)</span></div><div class="opts">${MOODS.map(x=>`<button class="opt sm ${st.moods.includes(x)?'on':''}" data-mood="${esc(x)}">${esc(x)}</button>`).join('')}</div>
      <div class="step">Anything else?</div><input class="txt" id="ex" value="${esc(st.extra)}" placeholder="e.g. use up chicken thighs, no mushrooms, something new for Aria">
      <div class="row" style="margin-top:10px;gap:18px"><span class="serves">People <button id="pm">−</button> <b>${st.people}</b> <button id="pp">＋</button></span><span class="serves">Ideas <button id="nm">−</button> <b>${st.n}</b> <button id="np">＋</button></span></div>
      <div class="mact"><button class="cancel" id="c">Cancel</button><button class="save" id="go">✨ Get ideas</button></div>`;
    m.querySelectorAll('[data-meal]').forEach(b=>b.onclick=()=>{ st.meal=b.dataset.meal; draw(); });
    m.querySelectorAll('[data-mood]').forEach(b=>b.onclick=()=>{ const x=b.dataset.mood; st.moods=st.moods.includes(x)?st.moods.filter(y=>y!==x):[...st.moods,x]; draw(); });
    const ex=m.querySelector('#ex'); ex.oninput=()=>st.extra=ex.value;
    m.querySelector('#pm').onclick=()=>{ st.people=Math.max(1,st.people-1); draw(); }; m.querySelector('#pp').onclick=()=>{ st.people++; draw(); };
    m.querySelector('#nm').onclick=()=>{ st.n=Math.max(1,st.n-1); draw(); }; m.querySelector('#np').onclick=()=>{ st.n=Math.min(8,st.n+1); draw(); };
    m.querySelector('#c').onclick=close;
    m.querySelector('#go').onclick=async()=>{ close(); const done=aiBusy('Asking Gemini for ideas…');
      const have=allRecipes().map(r=>r.name).slice(0,80).join('; '), favs=allRecipes().filter(r=>isFav(r.id)).map(r=>r.name).join('; ');
      const prompt=`You are helping a New Zealand family (Auckland) plan ${st.meal}s. Suggest ${st.n} different ${st.meal} recipes for ${st.people} people.
Feeling like: ${st.moods.join(', ')||'anything family-friendly'}. ${st.extra?'Also: '+st.extra+'.':''}
They already have these recipes, so suggest different ones: ${have}.${favs?' Their favourites (a hint to their taste): '+favs+'.':''}
Keep it realistic for a weeknight at home with normal supermarket ingredients unless asked otherwise.
Return JSON only: {"recipes":[ ...${st.n} objects shaped like ${RECIPE_SHAPE} ]} with "serves": ${st.people}.
${RECIPE_RULES}`;
      try{ const out=await aiAsk({prompt:withMemory(prompt,st.moods.join(' ')+' '+st.extra),json:true}); done(); const rs=(out.recipes||[]).map(cleanRecipe).filter(r=>r.ing.length&&r.steps.length); if(!rs.length) throw new Error('No ideas came back. Try again.'); showIdeas(rs,plan); }
      catch(e){ done(); if(e.message!=='quiet') toast(e.message); } };
  }; draw(); });
}
function showIdeas(rs,plan){
  modal((m,close)=>{ m.classList.add('wide','tvsheet'); const draw=()=>{
    m.innerHTML=`<div class="tvhead"><h2>✨ Ideas</h2><button class="save" id="x">Done</button></div><p class="note">Tap one to see the full recipe. Save the ones you like${plan?' or put one straight on '+fmtD(kd(plan.key),{weekday:'long'}):''}.</p>
      <div class="tvlist">${rs.map((r,i)=>{ const saved=!!recipeById(r.id); return `<div class="idea"><button class="mrow" data-i="${i}"><span class="me">${r.emoji}</span><span class="mrt"><b>${esc(r.name)}</b><small>${r.mins?r.mins+' min · ':''}${esc(r.blurb)}</small></span></button>
        <div class="ideab">${saved?`<span class="note">✓ Saved${isFav(r.id)?' ⭐':''}</span>`:`<button class="opt sm" data-sv="${i}">💾 Save</button><button class="opt sm" data-fv="${i}">⭐ Save as favourite</button>`}${plan?`<button class="opt sm" data-pl="${i}">📅 Have it ${fmtD(kd(plan.key),{weekday:'short'})}</button>`:''}</div></div>`; }).join('')}</div>`;
    m.querySelector('#x').onclick=()=>{ close(); if($('#mealLayer').innerHTML) openMeals(); };
    m.querySelectorAll('[data-i]').forEach(b=>b.onclick=()=>openRecipe(rs[+b.dataset.i],{back:()=>showIdeas(rs,plan)}));
    m.querySelectorAll('[data-sv]').forEach(b=>b.onclick=()=>{ saveRecipe(rs[+b.dataset.sv]); draw(); });
    m.querySelectorAll('[data-fv]').forEach(b=>b.onclick=()=>{ const r=saveRecipe(rs[+b.dataset.fv]); setFav(r.id,true); draw(); });
    m.querySelectorAll('[data-pl]').forEach(b=>b.onclick=()=>{ const r=saveRecipe(rs[+b.dataset.pl]); planMeal(plan.key,plan.slot,r); close(); openMeals(); toast(r.name+' is on the plan'); });
  }; draw(); });
}
function aiSetup(update){
  const h=S.linkHelper, tail=S.aiKeyTail;
  modal((m,close)=>{ const draw=(msg)=>{
    m.innerHTML=`<h2>✨ AI: your Gemini key</h2>
    <p class="note">Meal ideas, recipe reading, bills, family memory and Ask use your own Gemini key. Paste it here once. It's kept in the family database where only your family's signed-in Google accounts can reach it (never on GitHub or the website), so each phone and the fridge can talk to Gemini directly: that's what makes answers appear word by word. The Google helper gets a copy too, for reading bills.</p>
    ${tail?`<p style="font-size:18px">✅ A key is saved (ends ••••${esc(tail)}${S.aiKeyAt?', '+fmtD(new Date(S.aiKeyAt),{day:'numeric',month:'short'}):''}). Paste a new one to replace it.</p>`:''}
    <div class="step">Gemini API key <span style="font-weight:500">(from aistudio.google.com → Get API key)</span></div>
    <input class="txt" id="k" type="password" autocomplete="off" placeholder="Paste the key">
    ${msg?`<p class="note" style="color:#b45309;font-weight:700">${esc(msg)}</p>`:''}
    ${!h||!h.url?`<p class="note">Meal ideas also need the calendar helper (⚙️ → 🔗 Connect calendars). Set that up and paste the key here again.</p>`:update?`<p class="note">Your calendar helper is older than this feature. Copy its new code (button below), paste it over the old code at script.google.com, then Deploy → Manage deployments → ✏️ → New version, and save the key again.</p>`:''}
    <div class="mact">${h&&h.url?'<button class="cancel" id="cp">Copy calendar helper code</button>':''}<button class="cancel" id="c">Close</button><button class="save" id="s">Save key</button></div>`;
    m.querySelector('#c').onclick=close;
    const cp=m.querySelector('#cp'); if(cp) cp.onclick=()=>{ try{ navigator.clipboard.writeText(HELPER_CODE(h.key)).then(()=>toast('Helper code copied')); }catch(e){ toast('Copy failed'); } };
    m.querySelector('#s').onclick=async()=>{ const k=m.querySelector('#k').value.trim();
      if(!/^[A-Za-z0-9_.\-]{20,300}$/.test(k)){ draw('That doesn’t look like a Gemini key. It’s a long code with no spaces.'); return; }
      const sb=m.querySelector('#s'); sb.disabled=true; sb.textContent='Saving…'; let helperOk=false, note='';
      if(!LOCAL){ try{ await SYNC.saveSecret({gemini:k,at:Date.now(),by:SYNC.me()}); }catch(e){ note='The database rules need updating before the key can be saved there (the helper does this automatically once it’s on version 8). '; } }
      if(h&&h.url){ let t=''; try{ const r=await fetch(h.url,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({key:h.key,action:'setkey',gemini:k}),redirect:'follow'}); t=await r.text(); const j=JSON.parse(t); if(j.ok) helperOk=true; else note+=(j.error||'')+' '; }
        catch(e){ note+=!t?'The app couldn’t reach the calendar helper at all ('+(e.message||'blocked')+'). ':/doPost/.test(t)?'The calendar helper is still running its OLD version: the new code is saved but not published. In Apps Script: Deploy → Manage deployments → ✏️ → Version: New version → Deploy. ':'The calendar helper answered with a page instead of data: '+t.replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim().slice(0,140)+'. '; } }
      S.aiKeyTail=k.slice(-4); S.aiKeyAt=Date.now(); save();
      if(helperOk||(!h||!h.url)){ close(); toast(helperOk?'✨ Key saved. Meal ideas are ready.':'Key saved'); if(note) setTimeout(()=>toast(note.trim()),2700); }
      else draw('Saved for the family helper, but the calendar helper didn’t take it: '+note.trim()+' Update the calendar helper (copy its code below) and save again.');
    };
  }; draw(); });
}

/* ================= car and house renewals ================= */
const RENEW_KINDS=[['🚗','WOF',12],['🚗','Registration',12],['🚗','Car insurance',12],['🚗','Car service',12],['🏠','House insurance',12],['🏠','Contents insurance',12],['🛡️','Life / health insurance',12],['🛂','Passport',120],['🪪','Driver licence',120],['🔥','Smoke alarm batteries',12],['🏠','Rates',3],['📺','Subscription',12],['🧾','Other',0]];
const daysTo=k=>Math.round((kd(k)-kd(dk(new Date())))/864e5);
const renewTitle=r=>`${r.emoji||'🧾'} ${r.what}${r.item?' · '+r.item:''}`;
const dueTxt=k=>{ const d=daysTo(k); return d<0?`${-d} day${d===-1?'':'s'} overdue`:d===0?'due today':d===1?'due tomorrow':d<=60?`due in ${d} days`:'due '+fmtD(kd(k),{day:'numeric',month:'short',year:'numeric'}); };
const dueCls=k=>{ const d=daysTo(k); return d<0?'over':d<=14?'soon':d<=30?'near':''; };
function renewSect(){
  const due=(S.renewals||[]).filter(r=>r.due&&daysTo(r.due)<=30).sort((a,b)=>a.due.localeCompare(b.due));
  if(!due.length) return '';
  return `<div class="sect warn">📌 Renewals coming up</div>`+due.map(r=>`<button class="rnrow ${dueCls(r.due)}" data-rn="${r.id}"><span>${esc(renewTitle(r))}</span><small>${dueTxt(r.due)}${r.cost?' · $'+esc(String(r.cost)):''}</small></button>`).join('');
}
function openRenewals(){
  modal((m,close)=>{ m.classList.add('wide'); const draw=()=>{ const list=(S.renewals||[]).slice().sort((a,b)=>(a.due||'9').localeCompare(b.due||'9'));
    m.innerHTML=`<div class="tvhead"><h2>📌 Car &amp; house renewals</h2><button class="save" id="x">Done</button></div>
      <p class="note">WOF, rego, insurance, passports… You'll get a reminder a month before, a week before and on the day, and they show on the calendar and the to-do list.</p>
      <div class="tvlist">${list.map(r=>`<button class="rnrow ${dueCls(r.due)}" data-rn="${r.id}"><span>${esc(renewTitle(r))}</span><small>${r.due?dueTxt(r.due):'no date'}${r.every?` · every ${r.every>=12&&r.every%12===0?(r.every/12===1?'year':r.every/12+' years'):r.every+' months'}`:''}${r.cost?' · $'+esc(String(r.cost)):''}</small></button>`).join('')||'<p class="note">Nothing yet. Tap “＋ Add” to start with the car’s WOF and rego.</p>'}</div>
      <div class="mact"><button class="cancel" id="add">＋ Add</button></div>`;
    m.querySelector('#x').onclick=close; m.querySelector('#add').onclick=()=>{ close(); editRenewal(null,openRenewals); };
    m.querySelectorAll('[data-rn]').forEach(b=>b.onclick=()=>{ close(); editRenewal((S.renewals||[]).find(x=>x.id===b.dataset.rn),openRenewals); });
  }; draw(); });
}
function editRenewal(r0,back){
  const r=r0?Object.assign({},r0):{emoji:'🚗',what:'WOF',item:'',due:dk(addDays(new Date(),30)),every:12,cost:'',ref:'',notes:''};
  modal((m,close)=>{ m.classList.add('wide'); const draw=()=>{
    m.innerHTML=`<h2>${r0?'📌 '+esc(renewTitle(r0)):'＋ New renewal'}</h2>
      ${r0?`<p class="note" style="font-size:18px">${dueTxt(r0.due)}${r0.done?` · last done ${fmtD(new Date(r0.done),{day:'numeric',month:'short',year:'numeric'})}`:''}</p>`:''}
      <div class="step">What is it?</div><div class="opts">${RENEW_KINDS.map(([e,w,ev])=>`<button class="opt sm ${r.what===w?'on':''}" data-k="${esc(w)}">${e} ${esc(w)}</button>`).join('')}</div>
      <div class="rform"><div class="row"><label>Name <small>(if “Other”)</small><input class="txt" id="w" value="${esc(r.what)}"></label><label>For <small>(e.g. the Mazda, the house)</small><input class="txt" id="it" value="${esc(r.item||'')}"></label></div>
      <div class="row"><label>Due<input class="txt" type="date" id="du" value="${esc(r.due||'')}"></label><label>Repeats<select class="txt" id="ev">${[[0,'Just once'],[3,'Every 3 months'],[6,'Every 6 months'],[12,'Every year'],[24,'Every 2 years'],[36,'Every 3 years'],[60,'Every 5 years'],[120,'Every 10 years']].map(([v,l])=>`<option value="${v}" ${+r.every===v?'selected':''}>${l}</option>`).join('')}</select></label><label>Cost $<input class="txt" id="co" inputmode="decimal" value="${esc(String(r.cost||''))}" style="width:120px"></label></div>
      <label>Provider / policy or plate number<input class="txt" id="rf" value="${esc(r.ref||'')}"></label><label>Notes<input class="txt" id="no" value="${esc(r.notes||'')}"></label></div>
      <div class="mact" style="flex-wrap:wrap">${r0?'<button class="del" id="d">Delete</button>':''}<button class="cancel" id="c">Back</button>${r0&&r0.every?`<button class="cancel" id="dn">✓ Renewed: next due ${fmtD(addMonths(kd(r0.due),r0.every),{day:'numeric',month:'short',year:'numeric'})}</button>`:''}<button class="save" id="s">Save</button></div>`;
    m.querySelectorAll('[data-k]').forEach(b=>b.onclick=()=>{ const k=RENEW_KINDS.find(x=>x[1]===b.dataset.k); grab(); r.what=k[1]; r.emoji=k[0]; if(!r0) r.every=k[2]; draw(); });
    const grab=()=>{ const v=id=>m.querySelector(id).value; r.what=v('#w').trim()||r.what; r.item=v('#it').trim(); r.due=v('#du'); r.every=+v('#ev'); r.cost=v('#co').trim(); r.ref=v('#rf').trim(); r.notes=v('#no').trim(); };
    m.querySelector('#c').onclick=()=>{ close(); if(back) back(); };
    const d=m.querySelector('#d'); if(d) d.onclick=()=>{ S.renewals=S.renewals.filter(x=>x.id!==r0.id); save(); close(); renderAll(); if(back) back(); };
    const dn=m.querySelector('#dn'); if(dn) dn.onclick=()=>{ r0.done=Date.now(); r0.due=dk(addMonths(kd(r0.due),r0.every)); save(); close(); renderAll(); toast('Next due '+fmtD(kd(r0.due),{day:'numeric',month:'long',year:'numeric'})); if(back) back(); };
    m.querySelector('#s').onclick=()=>{ grab(); if(!r.due){ toast('Pick the due date'); return; } const k=RENEW_KINDS.find(x=>x[1]===r.what); if(k) r.emoji=k[0]; else r.emoji=r.emoji||'🧾';
      S.renewals=S.renewals||[]; if(r0) Object.assign(r0,r); else S.renewals.push(Object.assign({id:uid()},r)); save(); close(); renderAll(); toast('Saved'); if(back) back(); };
  }; draw(); });
}
function addMonths(d,n){ const x=new Date(d); const day=x.getDate(); x.setDate(1); x.setMonth(x.getMonth()+n); x.setDate(Math.min(day,new Date(x.getFullYear(),x.getMonth()+1,0).getDate())); return x; }

/* ================= gift ideas (only the people ticked in Settings can open them) ================= */
const GIFT_ST=[['idea','💡 Idea'],['bought','🛍️ Bought'],['given','🎁 Given']];
function giftAllowed(){ if(LOCAL) return true; const me=SYNC.me(); return (S.giftViewers||[]).includes(me); }
function openGifts(){ requirePin(()=>giftsMain()); }
function giftsMain(){
  if(!LOCAL&&!(S.giftViewers||[]).length){ giftViewers(true); return; }
  if(!giftAllowed()){ modal((m,close)=>{ m.innerHTML=`<h2>🎁 Gift ideas</h2><p style="font-size:18px">Only ${esc((S.giftViewers||[]).join(', '))} can see gift ideas.</p><div class="mact"><button class="save" id="c">OK</button></div>`; m.querySelector('#c').onclick=close; }); return; }
  if(!LOCAL&&!SYNC.canSee('gifts')){ SYNC.retrySoft(); }
  let who=lsGet('fs.giftFor','')||((eaters().find(p=>/aria/i.test(p.name))||eaters()[0]||{}).id);
  modal((m,close)=>{ m.classList.add('wide','tvsheet'); const draw=()=>{ const list=(S.gifts||[]).filter(g=>g.for===who).sort((a,b)=>GIFT_ST.findIndex(s=>s[0]===a.status)-GIFT_ST.findIndex(s=>s[0]===b.status)||(b.at||0)-(a.at||0));
    m.innerHTML=`<div class="tvhead"><h2>🎁 Gift ideas</h2><button class="save" id="x">Done</button></div>
      <div class="opts mtabs">${eaters().map(p=>{ const n=(S.gifts||[]).filter(g=>g.for===p.id&&g.status!=='given').length; return `<button class="opt sm ${who===p.id?'on':''}" data-w="${p.id}"><span class="dot" style="background:${p.color}"></span>${esc(p.name)}${n?` <b>${n}</b>`:''}</button>`; }).join('')}</div>
      <form class="addrow" id="gf" style="padding:6px 0"><input id="gi" placeholder="What did ${esc(nm(who)||'they')} mention?" autocomplete="off" enterkeyhint="done"><button aria-label="Add">＋</button></form>
      <div class="tvlist">${list.map(g=>`<button class="mrow gift ${g.status}" data-g="${g.id}"><span class="me">${(GIFT_ST.find(s=>s[0]===g.status)||GIFT_ST[0])[1].split(' ')[0]}</span><span class="mrt"><b>${esc(g.idea)}</b><small>${[g.price?'$'+g.price:'',g.occ||'',g.notes||'','heard '+fmtD(new Date(g.at||Date.now()),{day:'numeric',month:'short'})].filter(Boolean).map(esc).join(' · ')}</small></span></button>`).join('')||`<p class="note">No ideas for ${esc(nm(who))} yet. When they mention something, pop it in here.</p>`}</div>
      ${LOCAL?'':`<p class="note" style="margin-top:8px">👀 Only ${esc((S.giftViewers||[]).join(', '))} can see these. <a href="#" id="gv">Change</a></p>`}`;
    m.querySelector('#x').onclick=close;
    m.querySelectorAll('[data-w]').forEach(b=>b.onclick=()=>{ who=b.dataset.w; lsSet('fs.giftFor',who); draw(); });
    m.querySelector('#gf').onsubmit=e=>{ e.preventDefault(); const v=m.querySelector('#gi').value.trim(); if(!v) return; S.gifts=S.gifts||[]; S.gifts.unshift({id:uid(),for:who,idea:v.charAt(0).toUpperCase()+v.slice(1),status:'idea',at:Date.now(),by:mePerson()||''}); save(); draw(); m.querySelector('#gi').focus(); };
    m.querySelectorAll('[data-g]').forEach(b=>b.onclick=()=>{ close(); editGift(S.gifts.find(x=>x.id===b.dataset.g)); });
    const gv=m.querySelector('#gv'); if(gv) gv.onclick=e=>{ e.preventDefault(); close(); giftViewers(false); };
  }; draw(); });
}
function editGift(g){
  modal((m,close)=>{ const draw=()=>{
    m.innerHTML=`<h2>🎁 For ${esc(nm(g.for))}</h2><div class="rform"><label>Idea<input class="txt" id="i" value="${esc(g.idea)}"></label>
      <div class="row"><label>Price $<input class="txt" id="p" inputmode="decimal" value="${esc(g.price||'')}" style="width:120px"></label><label>For <small>(birthday, Christmas…)</small><input class="txt" id="o" value="${esc(g.occ||'')}"></label></div>
      <label>Notes or where to buy<input class="txt" id="n" value="${esc(g.notes||'')}"></label></div>
      <div class="step">Status</div><div class="opts">${GIFT_ST.map(([v,l])=>`<button class="opt sm ${g.status===v?'on':''}" data-s="${v}">${l}</button>`).join('')}</div>
      <div class="mact"><button class="del" id="d">Delete</button><button class="cancel" id="c">Back</button><button class="save" id="s">Save</button></div>`;
    const grab=()=>{ g.idea=m.querySelector('#i').value.trim()||g.idea; g.price=m.querySelector('#p').value.trim(); g.occ=m.querySelector('#o').value.trim(); g.notes=m.querySelector('#n').value.trim(); };
    m.querySelectorAll('[data-s]').forEach(b=>b.onclick=()=>{ grab(); g.status=b.dataset.s; draw(); });
    m.querySelector('#d').onclick=()=>{ S.gifts=S.gifts.filter(x=>x.id!==g.id); save(); close(); giftsMain(); };
    m.querySelector('#c').onclick=()=>{ close(); giftsMain(); };
    m.querySelector('#s').onclick=()=>{ grab(); save(); close(); giftsMain(); };
  }; draw(); });
}
function giftViewers(first){
  const members=(SYNC.getMembers&&SYNC.getMembers())||[], me=SYNC.me(), sel=new Set((S.giftViewers||[]).length?S.giftViewers:[me]);
  modal((m,close)=>{ const draw=()=>{
    m.innerHTML=`<h2>👀 Who can see gift ideas?</h2><p class="note">${first?'Set this once. ':''}Only the Google accounts you tick can open gift ideas. Everyone else (and the fridge, if it's signed in as someone else) can't, even with the PIN.</p>
      <div class="opts" style="flex-direction:column;align-items:stretch">${members.map(e=>{ const p=S.people.find(q=>q.email===e); return `<button class="opt ${sel.has(e)?'on':''}" data-e="${esc(e)}"><span class="tick">${sel.has(e)?'✓':''}</span>${p?esc(p.name)+' · ':''}${esc(e)}</button>`; }).join('')}</div>
      <div class="mact"><button class="cancel" id="c">Cancel</button><button class="save" id="s">Save</button></div>`;
    m.querySelectorAll('[data-e]').forEach(b=>b.onclick=()=>{ const e=b.dataset.e; if(e===me&&sel.has(e)){ toast('Keep yourself ticked, or you’ll lock yourself out'); return; } sel.has(e)?sel.delete(e):sel.add(e); draw(); });
    m.querySelector('#c').onclick=close;
    m.querySelector('#s').onclick=()=>{ S.giftViewers=[...sel]; save(); close(); toast('Saved'); setTimeout(()=>{ SYNC.retrySoft(); setTimeout(giftsMain,900); },1500); };
  }; draw(); });
}

/* ================= bills (read from the bills email by the family's Google helper) ================= */
const BILL_CATS=['Power','Gas','Internet','Phone','Water','Rates','Insurance','Car','Mortgage','Rent','Subscriptions','Medical','School','Childcare','Credit card','Other'];
const BILL_ICON={Power:'⚡',Gas:'🔥',Internet:'🌐',Phone:'📱',Water:'💧',Rates:'🏛️',Insurance:'🛡️',Car:'🚗',Mortgage:'🏠',Rent:'🏠',Subscriptions:'📺',Medical:'🩺',School:'🎒',Childcare:'🧸','Credit card':'💳',Other:'🧾'};
const PAY_HOW=['Bank transfer','Direct debit','Credit card','Cash','Other'];
const $m=c=>'$'+(Number(c||0)/100).toLocaleString('en-NZ',{minimumFractionDigits:2,maximumFractionDigits:2});
const liveBills=()=>(S.bills||[]).filter(b=>['check','due','paid'].includes(b.status));
const billDue=b=>b.due?dueTxt(b.due):'no due date';
const billIcon=b=>b.directDebit?'💳':BILL_ICON[b.category]||'🧾';
const normF=x=>String(x||'').toLowerCase().replace(/[^a-z0-9]/g,'');
// where a bill should be filed: the folder you used last time for this biller, or Category/Biller/Year
function suggestFolder(b){
  const yr=(b.due||b.date||dk(new Date())).slice(0,4);
  const last=(S.bills||[]).filter(x=>x!==b&&x.fileTo&&normF(x.biller)===normF(b.biller)).sort((a,c)=>(c.at||0)-(a.at||0))[0];
  if(last){ const p=last.fileTo.replace(/\/(19|20)\d\d$/,''); return /\/(19|20)\d\d$/.test(last.fileTo)?p+'/'+yr:last.fileTo; }
  const ex=(S.billFolders||[]).find(f=>!f.startsWith('/')&&normF(f.split('/').pop())===normF(b.biller));
  if(ex) return ex+'/'+yr;
  return (b.category||'Other')+'/'+String(b.biller||'Bill').replace(/[\/\\]/g,' ').trim()+'/'+yr;
}
function newFolders(path){ const parts=path.split('/').filter(Boolean), abs=path.startsWith('/'), have=new Set(S.billFolders||[]), out=[]; let cur=abs?'/':'';
  parts.forEach((p,i)=>{ cur=(i===0?(abs?'/':''):cur+'/')+p; if(!have.has(cur)) out.push(cur); }); return out; }
const pathTxt=p=>(p.startsWith('/')?'My Drive › ':(S.billsRootName||S.billsRoot||'Household Bills')+' › ')+p.replace(/^\//,'').split('/').join(' › ');
function billsSect(){
  const chk=(S.bills||[]).filter(b=>b.status==='check'), soon=(S.bills||[]).filter(b=>b.status==='due'&&b.due&&daysTo(b.due)<=7).sort((a,b)=>a.due.localeCompare(b.due));
  if(!chk.length&&!soon.length) return '';
  return `<div class="sect warn">🧾 Bills</div>`+(chk.length?`<button class="rnrow soon" data-bills="check"><span>🔎 ${chk.length} new bill${chk.length>1?'s':''} to check</span><small>tap to check</small></button>`:'')+
    soon.map(b=>`<button class="rnrow ${dueCls(b.due)}" data-bill="${b.id}"><span>${billIcon(b)} ${esc(b.biller)} ${$m(b.amount)}</span><small>${b.directDebit?'direct debit '+(daysTo(b.due)===0?'today':fmtD(kd(b.due),{weekday:'short'})):billDue(b)}</small></button>`).join('');
}
let billTab='check';
function openBills(tab){
  if(tab) billTab=tab;
  const all=S.bills||[];
  modal((m,close)=>{ m.classList.add('wide','tvsheet'); const draw=()=>{
    const chk=all.filter(b=>b.status==='check').sort((a,b)=>(b.at||0)-(a.at||0)), due=all.filter(b=>b.status==='due').sort((a,b)=>(a.due||'9').localeCompare(b.due||'9')), paid=all.filter(b=>b.status==='paid').sort((a,b)=>(b.paidAt||0)-(a.paidAt||0));
    const row=b=>`<button class="mrow bill" data-bill="${b.id}"><span class="me">${billIcon(b)}</span><span class="mrt"><b>${esc(b.biller)} · ${$m(b.amount)}</b><small>${b.status==='paid'?'paid '+fmtD(new Date(b.paidAt||Date.now()),{day:'numeric',month:'short'})+(b.paidHow?' · '+esc(b.paidHow):''):billDue(b)}${b.directDebit&&b.status!=='paid'?' · direct debit':''}${b.period?' · '+esc(b.period):''}</small></span>${b.status==='due'&&b.due?`<span class="bdot ${dueCls(b.due)}"></span>`:''}</button>`;
    let body='';
    if(billTab==='check') body=chk.length?`<p class="note">New bills read from the bills email. Check each one, choose where its PDF is filed, and confirm.</p>`+chk.map(row).join(''):'<p class="note">Nothing to check. New bills sent to the bills email appear here within about 10 minutes.</p>';
    if(billTab==='due') body=(due.length?due.map(row).join(''):'<p class="note">No bills waiting to be paid.</p>')+`<div class="mact"><button class="cancel" id="hand">＋ Add a paper bill</button></div>`;
    if(billTab==='paid') body=paid.length?paid.slice(0,80).map(row).join(''):'<p class="note">No paid bills yet.</p>';
    if(billTab==='report') body=billReport();
    if(billTab==='setup') body=billSetupHTML();
    m.innerHTML=`<div class="tvhead"><h2>🧾 Bills</h2><button class="save" id="x">Done</button></div>
      <div class="opts mtabs">${[['check','🔎 To check',chk.length],['due','📅 To pay',due.length],['paid','✅ Paid',0],['report','📊 Report',0],['setup','⚙️ Setup',0]].map(([v,l,n])=>`<button class="opt sm ${billTab===v?'on':''}" data-bt="${v}">${l}${n?` <b>${n}</b>`:''}</button>`).join('')}</div>
      <div class="tvlist">${body}</div>`;
    m.querySelector('#x').onclick=close;
    m.querySelectorAll('[data-bt]').forEach(b=>b.onclick=()=>{ billTab=b.dataset.bt; draw(); });
    m.querySelectorAll('[data-bill]').forEach(b=>b.onclick=()=>{ close(); openBill(all.find(x=>x.id===b.dataset.bill)); });
    const hd=m.querySelector('#hand'); if(hd) hd.onclick=()=>{ close(); openBill(null); };
    if(billTab==='report'){ const ys=m.querySelector('#by'); if(ys) ys.onchange=()=>{ billYear=+ys.value; draw(); }; }
    if(billTab==='setup') wireBillSetup(m,draw);
  }; draw(); });
}
let billYear=new Date().getFullYear();
function billReport(){
  const bs=liveBills().filter(b=>b.status!=='check'&&(b.due||b.date||'').startsWith(String(billYear)));
  const years=[...new Set(liveBills().map(b=>(b.due||b.date||'').slice(0,4)).filter(Boolean).concat([String(new Date().getFullYear())]))].sort().reverse();
  const byM=Array(12).fill(0), byC={}; let tot=0;
  bs.forEach(b=>{ const mth=+((b.due||b.date).slice(5,7))-1; byM[mth]+=b.amount||0; byC[b.category||'Other']=(byC[b.category||'Other']||0)+(b.amount||0); tot+=b.amount||0; });
  const mx=Math.max(1,...byM), cats=Object.entries(byC).sort((a,b)=>b[1]-a[1]);
  const unpaid=(S.bills||[]).filter(b=>b.status==='due').reduce((t,b)=>t+(b.amount||0),0);
  return `<div class="row" style="align-items:center;gap:10px;margin-bottom:8px"><select class="txt" id="by" style="width:auto">${years.map(y=>`<option ${+y===billYear?'selected':''}>${y}</option>`).join('')}</select>
      <b style="font-size:20px">${$m(tot)}</b><span class="note">in ${billYear} (by due date) · ${$m(unpaid)} still to pay</span>
      ${S.billSheet?`<a class="xbtn" href="${esc(S.billSheet)}" target="_blank" rel="noopener" style="margin-left:auto">📊 Open the Google Sheet register</a>`:''}</div>
    <div class="step">Each month</div><div class="bchart">${byM.map((v,i)=>`<div><i style="height:${Math.round(v/mx*100)}%"></i><b>${v?'$'+Math.round(v/100):''}</b><span>${['J','F','M','A','M','J','J','A','S','O','N','D'][i]}</span></div>`).join('')}</div>
    <div class="step">By type</div>${cats.map(([c,v])=>`<div class="bcat"><span>${BILL_ICON[c]||'🧾'} ${esc(c)}</span><i style="width:${Math.round(v/(cats[0][1]||1)*100)}%"></i><b>${$m(v)}</b></div>`).join('')||'<p class="note">No bills this year yet.</p>'}
    <div class="step">Every bill in ${billYear}</div><table class="btab"><tr><th>Due</th><th>Biller</th><th>Amount</th><th>Status</th><th></th></tr>${bs.sort((a,b)=>(b.due||b.date).localeCompare(a.due||a.date)).map(b=>`<tr><td>${b.due?fmtD(kd(b.due),{day:'numeric',month:'short'}):''}</td><td>${billIcon(b)} ${esc(b.biller)}</td><td>${$m(b.amount)}</td><td>${b.status==='paid'?'✅ Paid':b.directDebit?'💳 Debit':'To pay'}</td><td>${b.pdf&&b.pdf.link?`<a href="${esc(b.pdf.link)}" target="_blank" rel="noopener">📄</a>`:''}</td></tr>`).join('')}</table>`;
}
function billSetupHTML(){
  const hp=S.billsHelper, ok=hp&&hp.lastRun&&Date.now()-hp.lastRun<30*60e3;
  return `<div class="rform"><label>Bills email address <small>(a “+bills” version of the Gmail that runs your reminder helper, e.g. yourname+bills@gmail.com. Send or forward bills here.)</small><input class="txt" id="be" type="email" value="${esc(S.billEmail||'')}" placeholder="yourname+bills@gmail.com"></label>
    <label>Google Drive folder for bills <small>(made for you if it doesn't exist)</small><input class="txt" id="br" value="${esc(S.billsRoot||'Household Bills')}"></label>
    <div><button class="save" id="bs" style="border-radius:14px;padding:12px 20px;font-weight:800">Save</button></div></div>
    <div class="srccard" style="margin-top:12px"><h4>🤖 Bills helper ${ok?`<span class="pill-ok">✓ checked ${fmtTime(new Date(hp.lastRun),'Pacific/Auckland')}</span>`:'<span class="pill-wait">waiting</span>'}</h4>
      ${hp&&hp.error?`<p class="note" style="color:var(--danger)">⚠️ ${esc(hp.error)}</p>`:''}
      <p class="note">Bills are read by your reminder helper (version 9 or newer) in your Google account. ⚙️ → 🧰 Helpers has the code and the one-off steps.${S.aiKeyTail?'':' It also needs your Gemini key (⚙️ → ✨ AI).'}</p>
      <button class="xbtn" id="bh">🧰 Open Helpers</button></div>`;
}
function wireBillSetup(m,draw){
  m.querySelector('#bs').onclick=()=>{ const e=m.querySelector('#be').value.trim().toLowerCase(), r=m.querySelector('#br').value.trim()||'Household Bills';
    if(e&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)){ toast('That email address doesn’t look right'); return; }
    if(e&&!/\+/.test(e)&&!confirm('This address has no “+” part, so the helper will read every email sent to it as a possible bill. Use it anyway?')) return;
    S.billEmail=e; S.billsRoot=r; save(); toast('Saved. The helper checks every 10 minutes.'); draw(); };
  m.querySelector('#bh').onclick=()=>{ closeModal(); openHelpers(); };
}
// one bill: check it (and choose its folder), mark it paid, or fix the details
function openBill(b0){
  const isNew=!b0, b=b0?JSON.parse(JSON.stringify(b0)):{status:'due',by:'hand',biller:'',category:'Other',amount:0,due:dk(addDays(new Date(),14)),directDebit:false,period:'',reference:''};
  let folder=b.fileTo||(b.pdf&&b.pdf.driveId?suggestFolder(b):''), pickF=false, fq='';
  modal((m,close)=>{ m.classList.add('wide'); const draw=()=>{
    const chk=b.status==='check', nf=folder?newFolders(folder):[];
    const fl=(S.billFolders||[]).filter(f=>!fq||f.toLowerCase().includes(fq.toLowerCase())).slice(0,60);
    m.innerHTML=`<div class="rhead"><span class="rem">${billIcon(b)}</span><div style="flex:1"><h2>${isNew?'＋ A bill':esc(b.biller||'Bill')}</h2>
      <p class="note" style="margin:2px 0">${chk?'🔎 Read from email: check it and confirm':b.status==='paid'?'✅ Paid '+fmtD(new Date(b.paidAt||Date.now()),{day:'numeric',month:'short',year:'numeric'})+(b.paidHow?' · '+esc(b.paidHow):''):b.status==='due'?(b.directDebit?'💳 Direct debit · ':'')+billDue(b):''}</p>
      ${b.summary?`<p class="note" style="margin:0">${esc(b.summary)}</p>`:''}</div></div>
      ${b.fromEmail||b.pdf?`<div class="row" style="gap:8px;margin:6px 0">${b.pdf&&b.pdf.link?`<a class="xbtn" href="${esc(b.pdf.link)}" target="_blank" rel="noopener">📄 Open the bill</a>`:''}${b.fromEmail&&b.fromEmail.link?`<a class="xbtn" href="${esc(b.fromEmail.link)}" target="_blank" rel="noopener">✉️ Open the email</a>`:''}</div>`:''}
      <div class="rform"><div class="row"><label>Biller<input class="txt" id="bb" value="${esc(b.biller||'')}"></label><label>Amount $<input class="txt" id="ba" inputmode="decimal" value="${b.amount?(b.amount/100).toFixed(2):''}" style="width:140px"></label><label>Due<input class="txt" id="bd" type="date" value="${esc(b.due||'')}"></label></div>
      <div class="row"><label>Type<select class="txt" id="bc">${BILL_CATS.map(c=>`<option ${b.category===c?'selected':''}>${c}</option>`).join('')}</select></label><label>Period<input class="txt" id="bp" value="${esc(b.period||'')}" placeholder="e.g. October"></label><label>Account<input class="txt" id="bref" value="${esc(b.reference||'')}" placeholder="•••• 1234" style="width:150px"></label></div>
      <label class="small" style="flex-direction:row;align-items:center;gap:8px;font-weight:600"><input type="checkbox" id="bdd" ${b.directDebit?'checked':''}> 💳 Paid automatically by direct debit (it goes on the calendar on the day it comes out)</label></div>
      ${b.pdf&&b.pdf.driveId?`<div class="step">📁 File the PDF in</div>
        <div class="bfold"><b>${esc(pathTxt(folder))}</b>${b.pdf.folder&&b.pdf.folder===folder?' <span class="pill-ok">✓ filed</span>':b.fileTo===folder?' <span class="pill-wait">filing…</span>':''}
        ${nf.length&&b.pdf.folder!==folder?`<div class="note" style="color:#b45309">🆕 New folder${nf.length>1?'s':''} will be made: ${nf.map(x=>esc(x.split('/').filter(Boolean).pop())).join(' › ')}</div>`:''}
        <div class="row" style="gap:6px;margin-top:6px"><button class="xbtn" id="fs">↺ Use the suggestion</button><button class="xbtn" id="fp">📂 Choose another folder</button></div>
        ${pickF?`<input class="txt" id="fq" placeholder="Search folders, or type a new path like Car/Insurance/2026" value="${esc(fq)}" style="margin-top:8px">
          <div class="flist">${fq&&!fl.includes(fq)?`<button class="mrow" data-f="${esc(fq.replace(/^\s+|\s+$/g,''))}"><span class="me">🆕</span><span class="mrt"><b>${esc(pathTxt(fq))}</b><small>make this new folder</small></span></button>`:''}${fl.map(f=>`<button class="mrow" data-f="${esc(f)}"><span class="me">📁</span><span class="mrt"><b>${esc(pathTxt(f))}</b></span></button>`).join('')||(!fq?'<p class="note">No folders found yet. Type a path to make one.</p>':'')}</div>`:''}</div>`:''}
      <div class="mact" style="flex-wrap:wrap">${!isNew?'<button class="del" id="bx">'+(chk?'🚫 Not a bill':'Delete')+'</button>':''}<button class="cancel" id="bk">Back</button>
        ${chk?'<button class="save" id="bok">✅ Confirm</button>':b.status==='due'?'<button class="cancel" id="bsv">Save</button><button class="save" id="bpd">✅ Paid</button>':b.status==='paid'?'<button class="cancel" id="bun">↩ Not paid</button><button class="save" id="bsv">Save</button>':'<button class="save" id="bsv">Save</button>'}</div>`;
    const grab=()=>{ const v=id=>m.querySelector(id).value; b.biller=v('#bb').trim(); b.amount=Math.round(parseFloat(v('#ba').replace(/[$,\s]/g,''))*100)||0; b.due=v('#bd'); b.category=v('#bc'); b.period=v('#bp').trim(); b.reference=v('#bref').trim(); b.directDebit=m.querySelector('#bdd').checked; };
    const keep=()=>{ grab(); if(!b.biller){ toast('Who is the bill from?'); return false; } if(!b.amount){ toast('Type the amount'); return false; } if(!b.due){ toast('Pick the due date'); return false; }
      if(b.pdf&&b.pdf.driveId&&folder) b.fileTo=folder.replace(/\/+$/,'');
      S.bills=S.bills||[]; if(isNew) S.bills.push(Object.assign({id:'hand-'+uid(),at:Date.now(),date:dk(new Date())},b)); else Object.assign(b0,b); save(); renderAll(); return true; };
    m.querySelector('#bk').onclick=()=>{ close(); openBills(); };
    const fs=m.querySelector('#fs'); if(fs) fs.onclick=()=>{ grab(); folder=suggestFolder(b); pickF=false; draw(); };
    const fp=m.querySelector('#fp'); if(fp) fp.onclick=()=>{ grab(); pickF=!pickF; draw(); };
    const fqi=m.querySelector('#fq'); if(fqi){ fqi.oninput=()=>{ fq=fqi.value; const p=fqi.selectionStart; grab(); draw(); const n=m.querySelector('#fq'); n.focus(); n.setSelectionRange(p,p); }; }
    m.querySelectorAll('[data-f]').forEach(x=>x.onclick=()=>{ grab(); folder=x.dataset.f.replace(/\s*\/\s*/g,'/').replace(/\/+$/,''); pickF=false; fq=''; draw(); });
    const bx=m.querySelector('#bx'); if(bx) bx.onclick=()=>{ if(chk){ b0.status='ignored'; save(); close(); toast('Marked as not a bill'); openBills(); } else if(confirm('Delete this bill?')){ S.bills=S.bills.filter(x=>x!==b0); save(); close(); renderAll(); openBills(); } };
    const ok=m.querySelector('#bok'); if(ok) ok.onclick=()=>{ b.status='due'; if(!keep()) { b.status='check'; return; } close(); toast(b.directDebit?'Confirmed: the direct debit is on the calendar':'Confirmed: it’s on the calendar and you’ll get reminders'); openBills('check'); };
    const sv=m.querySelector('#bsv'); if(sv) sv.onclick=()=>{ if(keep()){ close(); toast('Saved'); if(isNew) openBills('due'); } };
    const un=m.querySelector('#bun'); if(un) un.onclick=()=>{ b0.status='due'; delete b0.paidAt; delete b0.paidHow; delete b0.paidBy; save(); close(); renderAll(); openBills('due'); };
    const pd=m.querySelector('#bpd'); if(pd) pd.onclick=()=>{ if(!keep()) return; close(); modal((m2,c2)=>{ m2.innerHTML=`<h2>✅ ${esc(b0.biller)} ${$m(b0.amount)} paid</h2><div class="step">How?</div><div class="opts">${PAY_HOW.map(h=>`<button class="opt" data-h="${h}">${h}</button>`).join('')}</div><div class="mact"><button class="cancel" id="c">Cancel</button></div>`;
      m2.querySelector('#c').onclick=c2; m2.querySelectorAll('[data-h]').forEach(x=>x.onclick=()=>{ b0.status='paid'; b0.paidAt=Date.now(); b0.paidHow=x.dataset.h; b0.paidBy=mePerson()||SYNC.me&&SYNC.me()||''; save(); c2(); renderAll(); toast('Marked paid'); openBills('due'); }); }); };
  }; draw(); });
}

/* ================= Aria's corner: savings jars and explorer quizzes (any child, any person really) ================= */
const kidDocs=()=>(S.kids||[]);
const jarsOf=pid=>kidDocs().filter(k=>k.kind==='jar'&&k.person===pid);
const jarTotal=j=>(j.log||[]).reduce((t,x)=>t+(x.amt||0),0);
const stampsOf=pid=>kidDocs().filter(k=>k.kind==='stamp'&&k.person===pid);
const kidProfile=pid=>kidDocs().find(k=>k.kind==='profile'&&k.person===pid)||{};
function kidWho(){ const w=lsGet('fs.kidWho',''); if(w&&person(w)) return w; const a=eaters().find(p=>/aria/i.test(p.name)); return a?a.id:(eaters()[2]||eaters()[0]||{}).id; }
function openKids(){
  const pid=kidWho(); if(!pid){ toast('Add the family in Settings first'); return; }
  const prof=kidProfile(pid), jars=jarsOf(pid), stamps=stampsOf(pid), stars=stamps.reduce((t,s)=>t+(s.score||0),0), saved=jars.reduce((t,j)=>t+jarTotal(j),0);
  modal((m,close)=>{ m.classList.add('wide','tvsheet','kids');
    m.innerHTML=`<div class="tvhead"><h2>🌟 ${esc(nm(pid))}’s corner</h2><div class="row" style="gap:6px"><button class="xbtn" id="kw">👤</button><button class="save" id="x">Done</button></div></div>
      <div class="kstats"><div><b>${$m(saved)}</b><small>saved</small></div><div><b>⭐ ${stars}</b><small>stars</small></div><div><b>${stamps.filter(s=>(s.score||0)>=4).length}</b><small>passport stamps</small></div></div>
      <div class="step">💰 Savings jars</div>
      <div class="jars">${jars.map(j=>{ const t=jarTotal(j), pc=j.target?Math.min(100,Math.round(t/j.target*100)):0; return `<button class="jar" data-jar="${j.id}"><span class="je">${esc(j.emoji||'🏺')}</span><b>${esc(j.name)}</b><div class="jbar"><i style="width:${pc}%"></i></div><small>${$m(t)}${j.target?' of '+$m(j.target)+' · '+pc+'%':''}</small></button>`; }).join('')}<button class="jar add" id="jadd"><span class="je">➕</span><b>New jar</b><small>a goal to save for</small></button></div>
      <div class="step">🌍 Explorer quiz <span style="font-weight:500">· learn about the places we've been and want to go</span></div>
      <div class="row" style="gap:8px;flex-wrap:wrap"><button class="kbig" id="kq">🧭 Quiz me on a country</button>${stamps.length?`<button class="xbtn" id="kp">🛂 My passport</button>`:''}</div>
      <p class="note" style="margin-top:12px">Age ${prof.age||'?'} · questions are pitched for this age. <a href="#" id="kage">Change</a></p>`;
    m.querySelector('#x').onclick=close;
    m.querySelector('#kw').onclick=()=>{ close(); modal((m2,c2)=>{ m2.innerHTML=`<h2>Whose corner?</h2><div class="opts">${eaters().map(p=>`<button class="opt ${p.id===pid?'on':''}" data-p="${p.id}"><span class="dot" style="background:${p.color}"></span>${esc(p.name)}</button>`).join('')}</div><div class="mact"><button class="cancel" id="c">Cancel</button></div>`; m2.querySelector('#c').onclick=()=>{ c2(); openKids(); }; m2.querySelectorAll('[data-p]').forEach(b=>b.onclick=()=>{ lsSet('fs.kidWho',b.dataset.p); c2(); openKids(); }); }); };
    m.querySelector('#kage').onclick=e=>{ e.preventDefault(); close(); modal((m2,c2)=>{ m2.innerHTML=`<h2>How old is ${esc(nm(pid))}?</h2><input class="txt" id="a" type="number" inputmode="numeric" value="${prof.age||''}" style="width:120px"><div class="mact"><button class="cancel" id="c">Cancel</button><button class="save" id="s">Save</button></div>`;
      m2.querySelector('#c').onclick=()=>{ c2(); openKids(); }; m2.querySelector('#s').onclick=()=>{ const n=parseInt(m2.querySelector('#a').value,10); if(!(n>0&&n<120)){ toast('Type the age'); return; } let pr=kidDocs().find(k=>k.kind==='profile'&&k.person===pid); if(!pr){ pr={id:uid(),kind:'profile',person:pid}; S.kids.push(pr); } pr.age=n; save(); c2(); openKids(); }; }); };
    m.querySelector('#jadd').onclick=()=>{ close(); editJar(null,pid); };
    m.querySelectorAll('[data-jar]').forEach(b=>b.onclick=()=>{ close(); openJar(kidDocs().find(j=>j.id===b.dataset.jar)); });
    m.querySelector('#kq').onclick=()=>{ close(); pickQuizCountry(pid); };
    const kp=m.querySelector('#kp'); if(kp) kp.onclick=()=>{ close(); openPassport(pid); };
  });
}
function editJar(j0,pid){
  const j=j0?Object.assign({},j0):{kind:'jar',person:pid,name:'',emoji:'🏺',target:0};
  modal((m,close)=>{ m.innerHTML=`<h2>${j0?'✏️ '+esc(j0.name):'➕ New savings jar'}</h2><div class="rform"><div class="row"><label>Emoji<input class="txt" id="e" value="${esc(j.emoji)}" style="width:80px"></label><label style="flex:1">What is it for?<input class="txt" id="n" value="${esc(j.name)}" placeholder="e.g. Nintendo Switch, Japan trip, bike"></label></div>
    <label>Goal $ <small>(leave empty for a jar with no goal)</small><input class="txt" id="t" inputmode="decimal" value="${j.target?(j.target/100).toFixed(2):''}" style="width:160px"></label></div>
    <div class="mact">${j0?'<button class="del" id="d">Delete</button>':''}<button class="cancel" id="c">Cancel</button><button class="save" id="s">Save</button></div>`;
    m.querySelector('#c').onclick=()=>{ close(); j0?openJar(j0):openKids(); };
    const d=m.querySelector('#d'); if(d) d.onclick=()=>{ if(!confirm('Delete this jar and its history?')) return; S.kids=S.kids.filter(x=>x.id!==j0.id); save(); close(); openKids(); };
    m.querySelector('#s').onclick=()=>{ const n=m.querySelector('#n').value.trim(); if(!n){ toast('What is the jar for?'); return; } const t=Math.round(parseFloat(m.querySelector('#t').value.replace(/[$,]/g,''))*100)||0;
      if(j0){ Object.assign(j0,{name:n,emoji:m.querySelector('#e').value.trim()||'🏺',target:t}); } else S.kids.push(Object.assign({id:uid(),log:[],at:Date.now()},j,{name:n,emoji:m.querySelector('#e').value.trim()||'🏺',target:t}));
      save(); close(); openKids(); };
  });
}
function openJar(j){
  const t=jarTotal(j), pc=j.target?Math.min(100,Math.round(t/j.target*100)):0, log=(j.log||[]).slice().sort((a,b)=>(b.at||0)-(a.at||0));
  const weekly=(()=>{ const ins=(j.log||[]).filter(x=>x.amt>0&&x.at>Date.now()-56*864e5); if(ins.length<2) return 0; return ins.reduce((s,x)=>s+x.amt,0)/8; })();
  const left=j.target-t, weeks=weekly>0&&left>0?Math.ceil(left/weekly):0;
  modal((m,close)=>{ m.classList.add('wide');
    m.innerHTML=`<div class="rhead"><span class="rem">${esc(j.emoji||'🏺')}</span><div style="flex:1"><h2>${esc(j.name)}</h2><p class="note" style="margin:2px 0">${$m(t)} saved${j.target?' of '+$m(j.target)+(left>0?' · '+$m(left)+' to go':' · 🎉 goal reached!'):''}${weeks?' · about '+weeks+' week'+(weeks>1?'s':'')+' at this rate':''}</p></div></div>
      ${j.target?`<div class="jbar big"><i style="width:${pc}%"></i><span>${pc}%</span></div>`:''}
      <div class="row" style="gap:8px;margin:12px 0;flex-wrap:wrap"><button class="kbig" id="in">💵 Add money</button><button class="xbtn" id="out">🛍️ Take money out</button><button class="xbtn" id="ed">✏️</button></div>
      <div class="step">History</div><div class="tvlist">${log.map(x=>`<div class="jlog"><span>${x.amt>0?'➕':'➖'} ${esc(x.note||(x.amt>0?'Added':'Taken out'))}</span><small>${fmtD(new Date(x.at),{day:'numeric',month:'short'})}${x.by&&person(x.by)?' · '+esc(nm(x.by)):''}</small><b class="${x.amt>0?'pos':'neg'}">${x.amt>0?'+':'−'}${$m(Math.abs(x.amt))}</b></div>`).join('')||'<p class="note">Nothing in the jar yet.</p>'}</div>
      <div class="mact"><button class="cancel" id="bk">Back</button></div>`;
    m.querySelector('#bk').onclick=()=>{ close(); openKids(); };
    m.querySelector('#ed').onclick=()=>{ close(); editJar(j,j.person); };
    const money=sign=>{ close(); requirePin(()=>modal((m2,c2)=>{ m2.innerHTML=`<h2>${sign>0?'💵 Add money to':'🛍️ Take money out of'} ${esc(j.name)}</h2><div class="rform"><label>Amount $<input class="txt" id="a" inputmode="decimal" placeholder="5.00" style="width:160px"></label>
        <div class="opts">${['Pocket money','Birthday','Chores','Gift','Found it!'].concat(sign<0?['Bought it','Spent']:[]).map(x=>`<button class="opt sm" data-n="${x}">${x}</button>`).join('')}</div><label>Note<input class="txt" id="n" placeholder="what for?"></label></div>
        <div class="mact"><button class="cancel" id="c">Cancel</button><button class="save" id="s">${sign>0?'Add':'Take out'}</button></div>`;
      m2.querySelector('#c').onclick=()=>{ c2(); openJar(j); }; m2.querySelectorAll('[data-n]').forEach(b=>b.onclick=()=>{ m2.querySelector('#n').value=b.dataset.n; }); m2.querySelector('#a').focus();
      m2.querySelector('#s').onclick=()=>{ const a=Math.round(parseFloat(m2.querySelector('#a').value.replace(/[$,]/g,''))*100); if(!(a>0)){ toast('Type the amount'); return; } j.log=j.log||[]; j.log.push({at:Date.now(),amt:sign*a,note:m2.querySelector('#n').value.trim(),by:mePerson()||''}); save(); c2(); const nt=jarTotal(j); if(j.target&&nt>=j.target&&nt-sign*a<j.target) toast('🎉 '+nm(j.person)+' reached the goal!'); openJar(j); }; })); };
    m.querySelector('#in').onclick=()=>money(1); m.querySelector('#out').onclick=()=>money(-1);
  });
}
function pickQuizCountry(pid){
  const been=Object.keys(S.visited||{}).filter(k=>visitedBy(k).length), dream=S.wish||[], done=new Set(stampsOf(pid).map(s=>s.country));
  const name=k=>{ const p=(PLACES||[]).find(x=>x.key===k); return p?p.name:(PLACE_NAMES[k]||k); };
  const pool=[...new Set(been.concat(dream))];
  modal((m,close)=>{ m.innerHTML=`<h2>🧭 Which country?</h2>${pool.length?`<div class="step">Places we've been or want to go</div><div class="opts">${pool.map(k=>`<button class="opt sm" data-k="${esc(k)}">${done.has(k)?'🛂 ':''}${esc(name(k))}</button>`).join('')}</div>`:'<p class="note">Pin some countries on the globe (📍 Our travels) and they appear here.</p>'}
    <div class="step">Or type one</div><form id="f" class="addrow" style="padding:0"><input id="c" placeholder="e.g. Japan, Peru, Egypt"><button aria-label="Go">➤</button></form><div class="mact"><button class="cancel" id="x">Cancel</button></div>`;
    m.querySelector('#x').onclick=()=>{ close(); openKids(); };
    m.querySelectorAll('[data-k]').forEach(b=>b.onclick=()=>{ close(); runQuiz(pid,name(b.dataset.k),b.dataset.k); });
    m.querySelector('#f').onsubmit=e=>{ e.preventDefault(); const v=m.querySelector('#c').value.trim(); if(!v) return; close(); runQuiz(pid,v,v); };
  });
}
async function runQuiz(pid,country,key){
  const age=kidProfile(pid).age||9, done=aiBusy('Making a quiz about '+country+'…');
  let quiz;
  try{ quiz=await aiAsk({json:true,prompt:withMemory(`Make a fun 5-question multiple-choice quiz about ${country} for ${nm(pid)}, who is ${age} years old. Mix geography, animals, food, famous places, language and culture; one question can be about New Zealand's connection to it. Keep questions short and clear for that age, one correct answer each, 4 options. Return JSON only: {"intro":"one friendly sentence to start","questions":[{"q":"...","options":["a","b","c","d"],"answer":0,"fun":"a one-line fun fact shown after answering"}]}`,country)}); }
  catch(e){ done(); if(e.message!=='quiet') toast(e.message); openKids(); return; }
  done(); const qs=(quiz.questions||[]).filter(q=>q.q&&Array.isArray(q.options)&&q.options.length>=2).slice(0,5).map(q=>{ q.answer=Math.min(q.options.length-1,Math.max(0,parseInt(q.answer,10)||0)); return q; }); if(!qs.length){ toast('The quiz didn’t come through. Try again.'); openKids(); return; }
  let i=0, score=0, picked=null;
  modal((m,close)=>{ m.classList.add('wide','kids'); const draw=()=>{
    if(i>=qs.length){ const stamp={id:uid(),kind:'stamp',person:pid,country:key,name:country,score,at:Date.now()}; S.kids.push(stamp); save();
      m.innerHTML=`<div class="qdone"><div class="qbig">${score>=4?'🏆':score>=3?'🌟':'💪'}</div><h2>${score} out of ${qs.length}</h2><p style="font-size:19px">${score>=4?'Brilliant! That’s a passport stamp for '+esc(country)+'. 🛂':score>=3?'Nice work! One more right next time for a stamp.':'Good try! Have another go soon.'}</p><p class="note">⭐ ${score} star${score===1?'':'s'} added</p></div><div class="mact"><button class="cancel" id="again">🔁 Another country</button><button class="save" id="x">Done</button></div>`;
      m.querySelector('#x').onclick=()=>{ close(); openKids(); }; m.querySelector('#again').onclick=()=>{ close(); pickQuizCountry(pid); }; return; }
    const q=qs[i];
    m.innerHTML=`<div class="tvhead"><h2>🧭 ${esc(country)}</h2><span class="note">${i+1} / ${qs.length} · ⭐ ${score}</span></div>${i===0&&picked===null&&quiz.intro?`<p class="note">${esc(quiz.intro)}</p>`:''}
      <p class="qq">${esc(q.q)}</p><div class="qopts">${q.options.map((o,k)=>`<button class="qopt ${picked===null?'':k===q.answer?'qright':k===picked?'qwrong':'qdim'}" data-o="${k}" ${picked!==null?'disabled':''}>${esc(o)}</button>`).join('')}</div>
      ${picked!==null?`<p class="qfun">${picked===q.answer?'✅ Yes!':'❌ Not quite, it’s '+esc(q.options[q.answer])+'.'} ${esc(q.fun||'')}</p><div class="mact"><button class="save" id="n">${i+1<qs.length?'Next ›':'Finish'}</button></div>`:''}`;
    m.querySelectorAll('[data-o]').forEach(b=>b.onclick=()=>{ picked=+b.dataset.o; if(picked===q.answer) score++; draw(); });
    const n=m.querySelector('#n'); if(n) n.onclick=()=>{ i++; picked=null; draw(); };
  }; draw(); });
}
function openPassport(pid){
  const st=stampsOf(pid).sort((a,b)=>(b.at||0)-(a.at||0));
  modal((m,close)=>{ m.classList.add('wide'); m.innerHTML=`<div class="tvhead"><h2>🛂 ${esc(nm(pid))}’s passport</h2><button class="save" id="x">Done</button></div><div class="stamps">${st.map(s=>`<div class="stamp ${(s.score||0)>=4?'ok':''}"><b>${esc(s.name||s.country)}</b><small>${s.score}/5 · ${fmtD(new Date(s.at),{day:'numeric',month:'short',year:'numeric'})}</small></div>`).join('')}</div>`; m.querySelector('#x').onclick=()=>{ close(); openKids(); }; });
}
