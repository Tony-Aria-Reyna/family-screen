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
  const L=$('#mealLayer'), mon=addDays(new Date(),mealWeek*8), today=dk(new Date());   // today and the next 7, then the 8 after that
  const days=[...Array(8)].map((_,i)=>dk(addDays(mon,i)));
  const label=mealWeek===0?'Today + 7 days':fmtD(mon,{day:'numeric',month:'short'})+' – '+fmtD(addDays(mon,7),{day:'numeric',month:'short'});
  const tile=(key,slot,big)=>{ const ms=mealsOn(key,slot), sl=MEAL_SLOTS.find(s=>s[0]===slot);
    if(!ms.length) return `<button class="mtile add ${big?'big':''}" data-pick="${key}|${slot}">＋ ${sl[1]}</button>`;
    return ms.map(m=>{ const r=m.rid&&recipeById(m.rid);
      return `<button class="mtile ${big?'big':''} ${m.shopped?'shopped':''} ${mealJust&&mealJust.id===m.id?'just':''}" data-meal="${m.id}"><span class="me">${r?r.emoji||'🍽️':'📝'}</span><span class="mn">${esc(r?r.name:m.note||'')}</span>${r?`<small>${big?esc(sl[1])+' · ':''}serves ${m.serves||r.serves}${m.shopped?' · 🛒✓':''}</small>`:''}</button>`; }).join(''); };
  const dayHTML=key=>{ const d=kd(key), home=homeOn(key);
    return `<div class="mday ${key===today?'today':''} ${key<today?'past':''}"><div class="mdl"><b>${fmtD(d,{weekday:'short'})}</b> <span>${fmtD(d,{day:'numeric',month:'short'})}</span>
      <button class="mhome" data-home="${key}" title="Who's home">${home.map(p=>`<i style="background:${p.color}"></i>`).join('')}<small>${home.length} home</small></button></div>
      <div class="mslots">${tile(key,'dinner',true)}<div class="msmall">${tile(key,'breakfast')}${tile(key,'lunch')}</div></div></div>`; };
  const toShop=(S.meals||[]).filter(m=>days.includes(m.date)&&m.rid&&!m.shopped).length;
  L.innerHTML=`<div class="meals"><div class="mhead"><h2>🍽️ Meals</h2>
    <div class="mnav"><button data-wk="-1" aria-label="Previous week">‹</button><b>${label}</b><button data-wk="1" aria-label="Next week">›</button></div>
    <div class="macts"><button id="mPlan" class="mbig">🗓️ Plan the next 8 days</button>${(S.ideaBoard||[]).length?`<button id="mBoard">💡 Our ideas (${(S.ideaBoard||[]).length})</button>`:''}<button id="mCook">📸 What can we make?</button><button id="mStock">🧊 Kitchen stock</button><button id="mIdeas">✨ Ideas</button><button id="mBook">📖 Recipes</button><button id="mShop" ${toShop?'':'disabled'}>🛒 Shopping list${toShop?` (${toShop})`:''}</button></div>
    <button class="mclose" id="mClose" aria-label="Close">✕</button></div>
    <div class="mweek">${days.map(dayHTML).join('')}</div></div>`;
  L.querySelectorAll('[data-wk]').forEach(b=>b.onclick=()=>{ mealWeek+=+b.dataset.wk; openMeals(); });
  L.querySelector('#mClose').onclick=()=>{ closeMeals(); if(isPhone()) setTab('cal'); };
  L.querySelector('#mIdeas').onclick=()=>openIdeas(); L.querySelector('#mCook').onclick=()=>openCook(); L.querySelector('#mStock').onclick=()=>openStock();
  L.querySelector('#mBook').onclick=()=>openRecipeBook();
  L.querySelector('#mPlan').onclick=()=>openPlanWeek(); { const bb=L.querySelector('#mBoard'); if(bb) bb.onclick=()=>openBoard(); }
  L.querySelector('#mShop').onclick=()=>shopForMeals(days);
  L.querySelectorAll('[data-pick]').forEach(b=>b.onclick=()=>{ const [k,s]=b.dataset.pick.split('|'); pickMeal(k,s); });
  L.querySelectorAll('[data-meal]').forEach(b=>b.onclick=()=>{ const m=(S.meals||[]).find(x=>x.id===b.dataset.meal); if(!m) return; const r=m.rid&&recipeById(m.rid); if(r) openRecipe(r,{meal:m}); else editNoteMeal(m); });
  L.querySelectorAll('[data-home]').forEach(b=>b.onclick=()=>whoHome(b.dataset.home));
  if(mealJust&&Date.now()-mealJust.at<8000){ const t=L.querySelector('.mtile.just'); if(t) setTimeout(()=>{ try{ t.scrollIntoView({block:'center',behavior:'smooth'}); }catch(e){} },120); }
}
function whoHome(key){
  modal((m,close)=>{ const draw=()=>{ const home=homeOn(key).map(p=>p.id);
    m.innerHTML=`<h2>Who's home ${fmtD(kd(key),{weekday:'long'})}?</h2><p class="note">Sets how many each meal serves. Mummy's roster is already counted.</p><div class="opts">${eaters().map(p=>{ const on=home.includes(p.id); return `<button class="opt ${on?'on':''}" data-p="${p.id}"><span class="tick">${on?'✓':''}</span><span class="dot" style="background:${p.color}"></span>${esc(p.name)}</button>`; }).join('')}</div><div class="mact"><button class="save" id="ok">Done</button></div>`;
    m.querySelectorAll('[data-p]').forEach(b=>b.onclick=()=>{ const ma=Object.assign({},S.mealAway||{}), a=new Set(ma[key]||[]), id=b.dataset.p; if(a.has(id)) a.delete(id); else a.add(id); if(a.size) ma[key]=[...a]; else delete ma[key]; S.mealAway=ma;
      const n=homeOn(key).length; (S.meals||[]).filter(x=>x.date===key&&!x.serveSet).forEach(x=>x.serves=Math.max(1,n)); save(); draw(); });
    m.querySelector('#ok').onclick=()=>{ close(); openMeals(); }; }; draw(); });
}
let mealJust=null;
function planMeal(key,slot,r,serves){ S.meals=S.meals||[]; mealJust={key,at:Date.now()}; { const t=new Date(); t.setHours(0,0,0,0); mealWeek=Math.floor(Math.round((kd(key)-t)/864e5)/8); } if(slot==='dinner'&&r&&r.name&&typeof foodNote==='function') foodNote('pick',r.name); const m={id:uid(),date:key,slot,rid:r.id,serves:serves||Math.max(1,homeOn(key).length)}; S.meals.push(m); mealJust.id=m.id; save(); return m; }
// choose a meal for a day: favourites first, then everything, or ask for new ideas
function pickMeal(key,slot,tab){
  let q='', t=tab||((S.favs||[]).length?'fav':'all'), only=true; const key0=key;
  modal((m,close)=>{ m.classList.add('wide','tvsheet'); const draw=()=>{
    const pool=allRecipes().filter(r=>(!only||r.meal===slot||(slot!=='dinner'&&r.meal!=='dinner'))&&(t!=='fav'||isFav(r.id))), k=q.trim().toLowerCase();
    const list=recSearch(pool,k);
    const home=homeOn(key).length;
    m.innerHTML=`<div class="tvhead"><h2>${MEAL_SLOTS.find(s=>s[0]===slot)[2]} ${fmtD(kd(key),{weekday:'short',day:'numeric',month:'short'})} · ${home} home</h2><button class="cancel" id="x">Close</button></div>
      <div class="daychips">${dayChips(key,slot,key0)}</div>
      <div class="opts mtabs"><button class="opt sm ${t==='fav'?'on':''}" data-t="fav">⭐ Our favourites</button><button class="opt sm ${t==='all'?'on':''}" data-t="all">📖 All recipes</button><button class="opt sm" id="ai">✨ New ideas</button><button class="opt sm" id="note">📝 Just a note</button></div>
      <input class="txt" id="q" placeholder="Search, e.g. chicken, Mexican, quick" value="${esc(q)}" autocomplete="off">
      <label class="small" style="display:block;margin:6px 0"><input type="checkbox" id="only" ${only?'checked':''}> Only ${MEAL_SLOTS.find(s=>s[0]===slot)[1].toLowerCase()} recipes</label>
      <div class="tvlist">${list.map(r=>recRow(r)).join('')||`<p class="note">${t==='fav'?'No favourites yet. Open any recipe and tap ⭐ to add it to your favourites.':'Nothing matches.'}</p>`}</div>`;
    m.querySelectorAll('[data-t]').forEach(b=>b.onclick=()=>{ t=b.dataset.t; draw(); });
    m.querySelectorAll('[data-dk]').forEach(b=>b.onclick=()=>{ key=b.dataset.dk; draw(); });
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
// recipe search: every word must appear in the name, tags, description, meal or ingredients; "pork" finds "pork scotch", "chops" finds "chop"
function recSearch(list,k){ const stem=w=>w.replace(/(ies)$/,'y').replace(/(es|s)$/,''); const words=(k||'').toLowerCase().split(/[\s,]+/).filter(Boolean).map(stem);
  const by=(a,b)=>(isFav(b.id)-isFav(a.id))||a.name.localeCompare(b.name); if(!words.length) return list.slice().sort(by);
  const out=[]; for(const r of list){ const name=(r.name||'').toLowerCase(), rest=[(r.tags||[]).join(' '),r.blurb||'',r.meal||'',(r.ing||[]).map(i=>Array.isArray(i)?i[2]:i).join(' ')].join(' ').toLowerCase();
    let sc=0, ok=true; for(const w of words){ if(name.includes(w)) sc+=3; else if(rest.includes(w)) sc+=1; else { ok=false; break; } } if(ok) out.push([sc,r]); }
  return out.sort((a,b)=>(b[0]-a[0])||by(a[1],b[1])).map(x=>x[1]); }
function openRecipeBook(){
  let q='', t='all';
  modal((m,close)=>{ m.classList.add('wide','tvsheet'); const draw=()=>{ const k=q.trim().toLowerCase();
    const list=allRecipes().filter(r=>(t==='all'||(t==='fav'?isFav(r.id):r.meal===t)));
    const list2=recSearch(list,k);
    m.innerHTML=`<div class="tvhead"><h2>📖 Our recipes</h2><button class="save" id="x">Done</button></div>
      <div class="opts mtabs">${[['all','All'],['fav','⭐ Favourites'],['dinner','Dinners'],['lunch','Lunches'],['breakfast','Breakfasts']].map(([v,l])=>`<button class="opt sm ${t===v?'on':''}" data-t="${v}">${l}</button>`).join('')}<button class="opt sm" id="add">＋ Add a recipe</button></div>
      <input class="txt" id="q" placeholder="Search recipes" value="${esc(q)}" autocomplete="off"><div class="tvlist">${list2.map(r=>recRow(r)).join('')||'<p class="note">Nothing here yet.</p>'}</div>`;
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
// what's in the kitchen, for the AI: oldest first so things get used up
function stockLine(){ const st=stockNow().slice().sort((a,b)=>(a.at||0)-(b.at||0)).slice(0,60), sa=sauceShelf(); if(!st.length&&!sa.length) return '';
  return (st.length?'In their fridge, freezer and pantry now (oldest first): '+st.map(x=>x.name+(x.qty?' ('+x.qty+(x.unit?' '+x.unit:'')+')':'')).join(', ')+'. Build most of the recipes around these, the oldest first, so little extra needs buying. ':'')+(sa.length?'Sauces and staples on hand: '+sa.map(x=>x.name).join(', ')+'. ':'')+'\n'; }
// is this ingredient already in the kitchen? (whole-word match either way: "chicken thighs" covers "chicken thigh", not "chicken stock")
function inStock(name){ const w=t=>String(t).toLowerCase().replace(/[^a-z ]/g,' ').split(' ').filter(x=>x.length>2).map(x=>x.replace(/(es|s)$/,'')), a=w(name); if(!a.length) return null;
  return (S.stock||[]).filter(x=>!x.used&&!x.out).find(x=>{ const b=w(x.name); return b.length&&(b.every(t=>a.includes(t))||a.every(t=>b.includes(t))); })||null; }
// ---- shopping list from meals
function addIngredients(list,after){
  const agg=new Map();
  for(const {r,serves} of list){ const k=serves/(r.serves||4); for(const i of r.ing||[]){ const key=i[2].toLowerCase()+'|'+(i[1]||''); const a=agg.get(key)||{name:i[2],u:i[1]||'',q:0,pantry:i[3]==='p',from:[]}; a.q+=scaleQ(i[0],k,i[1])||0; if(!a.from.includes(r.name)) a.from.push(r.name); agg.set(key,a); } }
  const items=[...agg.values()].sort((a,b)=>a.pantry-b.pantry||a.name.localeCompare(b.name));
  const onList=n=>S.groceries.some(g=>!g.done&&g.name.toLowerCase().startsWith(n.toLowerCase()));
  items.forEach(x=>{ x.have=inStock(x.name); x.on=!x.pantry&&!onList(x.name)&&!x.have; });
  modal((m,close)=>{ m.classList.add('wide'); const draw=()=>{
    m.innerHTML=`<h2>🛒 Add to the shopping list</h2><p class="note">Things in your Kitchen stock, pantry staples and things already on the list are left unticked. Check the amounts and tap to change.</p>
      <div class="tvlist">${items.map((x,i)=>`<button class="mrow ing ${x.on?'on':''}" data-i="${i}"><span class="box">${x.on?'✓':''}</span><span class="mrt"><b>${esc(x.name)}</b><small>${esc(fmtQty(x.q,x.u))}${x.have?' · 🧊 have: '+esc(x.have.name+(x.have.qty?' ('+x.have.qty+(x.have.unit?' '+x.have.unit:'')+')':'')):''}${x.pantry?' · pantry':''}${onList(x.name)?' · already on the list':''}${list.length>1?' · '+esc(x.from.join(', ')):''}</small></span></button>`).join('')}</div>
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
      // keep the ideas board copy (and the screen that opened it) in step with the edit
      const sid=ex?ex.id:S.recipes[S.recipes.length-1].id;
      (S.ideaBoard||[]).forEach(x=>{ if(x&&x.r&&r0&&(x.r===r0||x.r.id===r0.id)){ Object.assign(x.r,out); x.r.id=sid; } });
      if(r0) { Object.assign(r0,out); r0.id=sid; }
      save(); renderAll(); close(); toast('✅ Recipe saved: '+out.name); };
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
// models that hung recently are skipped for 12 hours (the newest one is sometimes overloaded on the free tier)
function aiBad(){ const b=lsGet('fs.aiBad',{})||{}, now=Date.now(); Object.keys(b).forEach(k=>{ if(now-b[k]>12*3600e3) delete b[k]; }); return b; }
async function aiModel(key,force){
  const bad=aiBad(), saved=lsGet('fs.aiModel',''); if(saved&&!force&&!bad[saved]) return saved;
  try{ const c=new AbortController(), tm=setTimeout(()=>c.abort(),8000); const r=await fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=200',{headers:{'x-goog-api-key':key},signal:c.signal}); const j=await r.json(); clearTimeout(tm);
    const ok=(j.models||[]).filter(m=>(m.supportedGenerationMethods||[]).includes('generateContent')&&/gemini-[\d.]+-flash$/.test(m.name)).map(m=>m.name.replace('models/','')).sort((a,b)=>parseFloat(b.split('-')[1])-parseFloat(a.split('-')[1])).filter(m=>!bad[m]);
    if(ok.length){ lsSet('fs.aiModel',ok[0]); return ok[0]; } }catch(e){}
  return AI_MODEL_DEFAULT;
}
// one call. payload: {prompt, file:{mime,data}, url, json:true|false}; onText(partial) streams the words as they arrive
async function aiAsk(payload,onText){
  if(LOCAL&&!window.AI_TEST) throw new Error('AI works in the real app once you’re signed in');
  // Claude when the family has chosen it. Web links are still read by Gemini (it can open pages itself).
  if(aiUsing()==='claude'&&!(payload.url&&S.aiKey)){
    try{ return await aiClaude(S.claudeKey,payload,onText); }
    catch(e){ if(e.message==='quiet'||!S.aiKey||!e.fallback) throw e; toast('Claude: '+e.message+' Using Gemini this time.'); }
  }
  if(S.aiKey) return aiDirect(S.aiKey,payload,onText);
  const h=S.linkHelper; if(!h||!h.url){ requirePin(()=>aiSetup()); throw new Error('quiet'); }
  let t; try{ const r=await fetch(h.url,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify(Object.assign({key:h.key,action:'ai'},payload)),redirect:'follow'}); t=await r.text(); }
  catch(e){ throw new Error('Could not reach your Google helper. Check the internet and try again.'); }
  let j; try{ j=JSON.parse(t); }catch(e){ requirePin(()=>aiSetup(true)); throw new Error('quiet'); }
  if(j.error==='nokey'){ requirePin(()=>aiSetup()); throw new Error('quiet'); }
  if(j.error) throw new Error(/not allowed/.test(j.error)?'The helper key doesn’t match. Copy the helper code again (⚙️ → Connect calendars).':'Gemini said: '+String(j.error).slice(0,160));
  return aiParse(j.text,payload.json!==false);
}
function aiParse(text,json){ const s=String(text||'').replace(/^```(?:json)?\s*|\s*```$/g,'').trim(); if(!json) return s; try{ return JSON.parse(s); }catch(e){ const m=s.match(/\{[\s\S]*\}/); if(m) try{ return JSON.parse(m[0]); }catch(x){} throw new Error('The AI sent back something I couldn’t read. Try again.'); } }
async function aiDirect(key,payload,onText,tried){
  tried=tried||{};
  const json=payload.json!==false, parts=[{text:String(payload.prompt||'').slice(0,120000)}];
  if(payload.url) parts[0].text+='\n\nWeb page to read: '+payload.url;
  (payload.files||(payload.file?[payload.file]:[])).filter(f=>f&&f.data).forEach(f=>parts.push({inline_data:{mime_type:f.mime||'image/jpeg',data:f.data}}));
  const gc={temperature:0.4}; if(json) gc.responseMimeType='application/json'; if(!tried.think) gc.thinkingConfig={thinkingLevel:'low'};
  const body={contents:[{role:'user',parts}],generationConfig:gc}; if(payload.url&&!tried.url) body.tools=[{url_context:{}}];
  const model=await aiModel(key);
  const ctl=new AbortController(); payload.abort=ctl;
  // never wait for ever: if this model has not started answering in 15 seconds, set it aside and try the next one down (twice at most); give up if it goes quiet for 30
  let slow=false, timer=setTimeout(()=>{ slow=true; ctl.abort(); },15000); const kick=()=>{ clearTimeout(timer); timer=setTimeout(()=>{ slow=true; ctl.abort(); },30000); };
  const tooSlow='Gemini took too long to answer. Try again, or switch to Claude in ✨ AI.';
  let r; try{ r=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse`,{method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':key},body:JSON.stringify(body),signal:ctl.signal}); }
  catch(e){ clearTimeout(timer);
    if(slow&&(tried.slow||0)<3){ tried.slow=(tried.slow||0)+1; const b=aiBad(); b[model]=Date.now(); lsSet('fs.aiBad',b); await aiModel(key,true); return aiDirect(key,payload,onText,tried); }
    if(slow) throw new Error(tooSlow); if(e.name==='AbortError') throw new Error('quiet'); throw new Error('Could not reach Gemini. Check the internet and try again.'); }
  kick();
  if(!r.ok){ clearTimeout(timer); const t=await r.text().catch(()=>''); 
    // overloaded ("high demand"): set this model aside for an hour and use the next one down
    if((r.status===503||r.status===500||r.status===529)&&(tried.slow||0)<3){ tried.slow=(tried.slow||0)+1; const b=aiBad(); b[model]=Date.now()-11*3600e3; lsSet('fs.aiBad',b); await aiModel(key,true); return aiDirect(key,payload,onText,tried); }
    if(r.status===404&&!tried.model){ tried.model=true; await aiModel(key,true); return aiDirect(key,payload,onText,tried); }
    if(r.status===400&&/think/i.test(t)&&!tried.think){ tried.think=true; return aiDirect(key,payload,onText,tried); }
    if(r.status===400&&/url_context|tool/i.test(t)&&!tried.url){ tried.url=true; return aiDirect(key,payload,onText,tried); }
    if(r.status===400&&/API key|invalid/i.test(t)) throw new Error('Gemini didn’t accept the key. Check it under ⚙️ → ✨ AI.');
    if(r.status===429) throw new Error('Gemini is busy (the free limit for this minute is used up). Try again in a moment.');
    let msg=''; try{ msg=JSON.parse(t).error.message; }catch(e){} throw new Error('Gemini said: '+(msg||r.status).toString().slice(0,160)); }
  let text='', buf=''; const rd=r.body.getReader(), dec=new TextDecoder();
  while(true){ let ch; try{ ch=await rd.read(); }catch(e){ clearTimeout(timer); if(slow) throw new Error(tooSlow); throw new Error(e.name==='AbortError'?'quiet':'Gemini stopped part-way. Try again.'); } const {done,value}=ch; if(done) break; kick(); buf+=dec.decode(value,{stream:true});
    let i; while((i=buf.indexOf('\n'))>=0){ const line=buf.slice(0,i).trim(); buf=buf.slice(i+1); if(!line.startsWith('data:')) continue;
      try{ const j=JSON.parse(line.slice(5)); const ps=(((j.candidates||[])[0]||{}).content||{}).parts||[]; const add=ps.map(p=>p.text||'').join(''); if(add){ text+=add; if(onText) onText(text); else aiProgress(text); } }catch(e){} } }
  if(buf.trim().startsWith('data:')) try{ const j=JSON.parse(buf.trim().slice(5)); const add=((((j.candidates||[])[0]||{}).content||{}).parts||[]).map(p=>p.text||'').join(''); if(add){ text+=add; if(onText) onText(text); } }catch(e){}
  clearTimeout(timer);
  if(!text) throw new Error('Gemini sent nothing back. Try again.');
  return aiParse(text,json);
}

/* ---- Claude (Anthropic). Same payload as Gemini; the family picks the model and how hard it thinks. ---- */
const CLAUDE_MODELS=[['claude-haiku-5-5','Haiku 5.5','fastest, costs least'],['claude-sonnet-5-5','Sonnet 5.5','quick and clever'],['claude-opus-5-5','Opus 5.5','smartest for hard jobs'],['claude-fable-5-2','Fable 5.2','deepest, slowest, costs most']];
const AI_EFFORTS=[['low','Low','quickest'],['medium','Medium','balanced'],['high','High','most careful']];
const claudeModel=()=>CLAUDE_MODELS.some(m=>m[0]===S.aiClaudeModel)?S.aiClaudeModel:'claude-sonnet-5-5';
const aiEffort=()=>AI_EFFORTS.some(e=>e[0]===S.aiEffort)?S.aiEffort:'low';
const aiUsing=()=>S.aiProv==='claude'&&S.claudeKey?'claude':'gemini';
const aiLabel=()=>aiUsing()==='claude'?'Claude · '+CLAUDE_MODELS.find(m=>m[0]===claudeModel())[1]+' · '+aiEffort():(S.aiKey||(S.linkHelper&&S.linkHelper.url)?'Gemini':'not set up');
async function aiClaude(key,payload,onText,tried){
  tried=tried||{};
  const json=payload.json!==false, content=[];
  (payload.files||(payload.file?[payload.file]:[])).filter(f=>f&&f.data).forEach(f=>{ const mime=f.mime||'image/jpeg';
    content.push(mime==='application/pdf'?{type:'document',source:{type:'base64',media_type:mime,data:f.data}}:{type:'image',source:{type:'base64',media_type:mime,data:f.data}}); });
  content.push({type:'text',text:String(payload.prompt||'').slice(0,120000)+(payload.url?'\n\nWeb page (you cannot open it; say so if you need its contents): '+payload.url:'')+(json?'\n\nReply with the JSON only: no other words, no code fence.':'')});
  const body={model:claudeModel(),max_tokens:16000,stream:true,messages:[{role:'user',content}]}; if(!tried.effort) body.output_config={effort:aiEffort()};
  const fail=(msg,fb)=>{ const e=new Error(msg); e.fallback=fb!==false; return e; };
  const ctl=new AbortController(); payload.abort=ctl;
  let r; try{ r=await fetch('https://api.anthropic.com/v1/messages',{method:'POST',headers:{'content-type':'application/json','x-api-key':key,'anthropic-version':'2023-06-01','anthropic-dangerous-direct-browser-access':'true'},body:JSON.stringify(body),signal:ctl.signal}); }
  catch(e){ if(e.name==='AbortError') throw new Error('quiet'); throw fail('Could not reach Claude. Check the internet and try again.'); }
  if(!r.ok){ const t=await r.text().catch(()=>''); let msg=''; try{ msg=JSON.parse(t).error.message; }catch(e){}
    if(r.status===400&&/effort|output_config/i.test(msg)&&!tried.effort){ tried.effort=true; return aiClaude(key,payload,onText,tried); }
    if(r.status===401) throw fail('Claude didn’t accept the key. Check it under ⚙️ → ✨ AI.');
    if(/credit balance/i.test(msg)) throw fail('This month’s Claude credits are used up.');
    if(r.status===404) throw fail('That Claude model isn’t available on this key. Pick another under ⚙️ → ✨ AI.');
    if(r.status===429||r.status===529) throw fail('Claude is busy right now.');
    throw fail('Claude said: '+String(msg||r.status).slice(0,160)); }
  let text='', buf=''; const rd=r.body.getReader(), dec=new TextDecoder();
  const take=line=>{ if(!line.startsWith('data:')) return; let j; try{ j=JSON.parse(line.slice(5)); }catch(e){ return; }
    if(j.type==='content_block_delta'&&j.delta&&j.delta.type==='text_delta'){ text+=j.delta.text; if(onText) onText(text); else aiProgress(text); }
    if(j.type==='error') throw fail('Claude said: '+String((j.error||{}).message||'something went wrong').slice(0,160)); };
  while(true){ const {done,value}=await rd.read(); if(done) break; buf+=dec.decode(value,{stream:true});
    let i; while((i=buf.indexOf('\n'))>=0){ const line=buf.slice(0,i).trim(); buf=buf.slice(i+1); take(line); } }
  if(buf.trim()) take(buf.trim());
  if(!text) throw fail('Claude sent nothing back. Try again.');
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
const akaOf=p=>[p.nick].concat(String(p.aka||'').split(',')).map(x=>String(x||'').trim()).filter(Boolean);
// for Alexa: also the "who they are" box when it is a name of a word or two (Machan, Daddy), not a sentence
const voiceAka=p=>{ const r=String(p.role||'').trim(), ok=r&&r.split(/\s+/).length<=2&&!/[,·(]/.test(r); return [...new Set((ok?[r]:[]).concat(akaOf(p)))]; };
const whoLines=()=>eaters().map(p=>'- '+p.name+(p.role?': '+p.role:'')+(p.id===(traveller()||{}).id?' (flies for work as cabin crew, often away)':'')+(akaOf(p).length?'. Also called: '+akaOf(p).join(', '):'')).join('\n');
const familyIntro=()=>`The family (Auckland, New Zealand). Who's who (a nickname in a calendar entry or a note means that person; "at X's" means at their place):\n${whoLines()}${S.famNote?'\n'+S.famNote:''}\nToday is ${fmtD(new Date(),{weekday:'long',day:'numeric',month:'long',year:'numeric'})}.`;
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
    m.innerHTML=`<div class="tvhead"><h2>💬 Ask</h2><button class="xbtn" id="aiw" style="margin-left:auto;margin-right:8px;font-size:13px">✨ ${esc(aiLabel())}</button><button class="save" id="x">Done</button></div>
      <div class="asklog" id="log"></div>
      <div class="askchips" id="chips"></div>
      <form class="addrow" id="af"><input id="aq" placeholder="e.g. What’s on tomorrow? When is Mummy home? What do we need for Thursday’s dinner?" autocomplete="off" enterkeyhint="send"><button aria-label="Ask">➤</button></form>`;
    const log=m.querySelector('#log'), qi=m.querySelector('#aq');
    m.querySelector('#aiw').onclick=()=>{ close(); requirePin(()=>aiSetup()); };
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
Feeling like: ${st.moods.join(', ')||'anything family-friendly'}. Their tastes: ${foodPrefs()} ${foodHistory()} ${st.extra?'Also: '+st.extra+'.':''}
They already have these recipes, so suggest different ones: ${have}.${favs?' Their favourites (a hint to their taste): '+favs+'.':''}
${stockLine()}${kitchenKnowledge()}
Keep it realistic for a weeknight at home with normal supermarket ingredients unless asked otherwise.
Return JSON only: {"recipes":[ ...${st.n} objects shaped like ${RECIPE_SHAPE} ]} with "serves": ${st.people}.
${RECIPE_RULES}`;
      try{ const out=await aiAsk({prompt:withMemory(prompt,st.moods.join(' ')+' '+st.extra),json:true}); done(); const rs=(out.recipes||[]).map(cleanRecipe).filter(r=>r.ing.length&&r.steps.length); if(!rs.length) throw new Error('No ideas came back. Try again.'); showIdeas(rs,plan); }
      catch(e){ done(); if(e.message!=='quiet') toast(e.message); } };
  }; draw(); });
}
function showIdeas(rs,plan){ const ids=boardAdd(rs,(plan&&plan.slot)||rs[0]&&rs[0].meal||'dinner','ideas'); openBoard({fresh:ids,day:plan&&plan.key}); }
function aiSetup(update){
  const h=S.linkHelper;
  modal((m,close)=>{ m.classList.add('wide','tvsheet'); let msg='', test='';
    const draw=()=>{ const using=aiUsing(), want=S.aiProv==='claude'?'claude':'gemini';
    m.innerHTML=`<div class="tvhead"><h2>✨ AI</h2><button class="save" id="c">Done</button></div>
    <p class="note">Meal ideas, recipe reading, bills, family memory, Ask, Alexa and the wake-up song all use the AI you pick here. Switch any time: it changes for the whole family straight away.</p>
    <div class="step">Which AI</div>
    <div class="opts"><button class="opt ${want==='gemini'?'on':''}" data-prov="gemini">🔷 Gemini</button><button class="opt ${want==='claude'?'on':''}" data-prov="claude">🟠 Claude</button></div>
    ${want==='claude'&&!S.claudeKey?'<p class="note" style="color:#b45309;font-weight:700">Claude needs its key (below). Until then the app keeps using Gemini.</p>':''}
    ${want==='claude'?`<div class="step">Claude model</div>
    <div class="opts">${CLAUDE_MODELS.map(([id,n,d])=>`<button class="opt ${claudeModel()===id?'on':''}" data-cm="${id}" style="flex-direction:column;align-items:flex-start"><b>${n}</b><small>${d}</small></button>`).join('')}</div>
    <div class="step">Effort <span style="font-weight:500">(how hard it thinks before answering)</span></div>
    <div class="opts">${AI_EFFORTS.map(([id,n,d])=>`<button class="opt ${aiEffort()===id?'on':''}" data-ef="${id}" style="flex-direction:column;align-items:flex-start"><b>${n}</b><small>${d}</small></button>`).join('')}</div>
    <p class="note">Alexa and the wake-up song always use Haiku on low effort, so she answers inside her 8 seconds. Web links to recipes are still read by Gemini.</p>`:''}
    <div class="row" style="margin-top:10px;gap:8px;align-items:center"><button class="xbtn" id="tst">▶️ Test it</button><span class="note" id="tout">${test?esc(test):'Now using: <b>'+esc(aiLabel())+'</b>'}</span></div>
    <div class="srccard" style="margin-top:12px"><h4>🟠 Claude key ${S.claudeKey?`<span class="pill-ok">saved ••••${esc(S.claudeKeyTail||S.claudeKey.slice(-4))}</span>`:'<span class="pill-wait">not set</span>'}</h4>
      <p class="note">From platform.claude.com → API keys → Create key. It starts with <b>sk-ant-</b>.</p>
      <div class="row" style="gap:8px"><input class="txt" id="ck" type="password" autocomplete="off" placeholder="Paste the Claude key" style="flex:1"><button class="xbtn" id="cs">Save</button></div></div>
    <div class="srccard" style="margin-top:10px"><h4>🔷 Gemini key ${S.aiKeyTail?`<span class="pill-ok">saved ••••${esc(S.aiKeyTail)}</span>`:'<span class="pill-wait">not set</span>'}</h4>
      <p class="note">From aistudio.google.com → Get API key. Keep it saved even when using Claude: it is the backup, and it reads web links.</p>
      <div class="row" style="gap:8px"><input class="txt" id="k" type="password" autocomplete="off" placeholder="Paste the Gemini key" style="flex:1"><button class="xbtn" id="s">Save</button></div>
      ${!h||!h.url?`<p class="note">Meal ideas also need the calendar helper (⚙️ → 🔗 Connect calendars).</p>`:update?`<p class="note">Your calendar helper is older than this feature. Copy its new code, paste it over the old code at script.google.com, then Deploy → Manage deployments → ✏️ → New version, and save the key again.</p>`:''}
      ${h&&h.url?'<button class="xbtn" id="cp" style="margin-top:6px">Copy calendar helper code</button>':''}</div>
    ${msg?`<p class="note" style="color:#b45309;font-weight:700">${esc(msg)}</p>`:''}
    <p class="note" style="margin-top:10px">Both keys are kept in the family database where only your family's signed-in Google accounts can reach them, never on GitHub or the website. Alexa and bills need the Reminder helper on version 16 to use Claude.</p>`;
    m.querySelector('#c').onclick=close;
    m.querySelectorAll('[data-prov]').forEach(b=>b.onclick=()=>{ S.aiProv=b.dataset.prov==='claude'?'claude':''; save(); test=''; draw(); });
    m.querySelectorAll('[data-cm]').forEach(b=>b.onclick=()=>{ S.aiClaudeModel=b.dataset.cm; save(); test=''; draw(); });
    m.querySelectorAll('[data-ef]').forEach(b=>b.onclick=()=>{ S.aiEffort=b.dataset.ef; save(); test=''; draw(); });
    m.querySelector('#tst').onclick=async()=>{ const out=m.querySelector('#tout'), t0=Date.now(); out.textContent='Asking '+aiLabel()+'…';
      try{ const a=await Promise.race([aiAsk({prompt:'Say good morning to a New Zealand family in one short, cheerful sentence.',json:false},()=>{}), new Promise((_,no)=>setTimeout(()=>no(new Error(aiLabel()+' didn’t answer within a minute. Check the key, or try the other AI.')),60000))]); test='✅ '+aiLabel()+' answered in '+((Date.now()-t0)/1000).toFixed(1)+'s: “'+String(a).trim().slice(0,120)+'”'; }
      catch(e){ test=e.message==='quiet'?'':'⚠️ '+e.message; } const o=m.querySelector('#tout'); if(o) o.textContent=test; };
    const cp=m.querySelector('#cp'); if(cp) cp.onclick=()=>{ try{ navigator.clipboard.writeText(HELPER_CODE(h.key)).then(()=>toast('Helper code copied')); }catch(e){ toast('Copy failed'); } };
    m.querySelector('#cs').onclick=async()=>{ const k=m.querySelector('#ck').value.trim();
      if(!/^sk-ant-[A-Za-z0-9_\-]{20,300}$/.test(k)){ msg='That doesn’t look like a Claude key. It starts with sk-ant- and has no spaces.'; draw(); return; }
      msg=''; if(!LOCAL){ try{ await SYNC.saveSecret({claude:k,claudeAt:Date.now(),by:SYNC.me()}); }catch(e){ msg='Couldn’t save the key to the family database. Check the internet and try again.'; draw(); return; } } else S.claudeKey=k;
      S.claudeKeyTail=k.slice(-4); S.aiProv='claude'; save(); toast('🟠 Claude key saved. Claude is on.'); draw(); };
    m.querySelector('#s').onclick=async()=>{ const k=m.querySelector('#k').value.trim();
      if(!/^[A-Za-z0-9_.\-]{20,300}$/.test(k)){ msg='That doesn’t look like a Gemini key. It’s a long code with no spaces.'; draw(); return; }
      const sb=m.querySelector('#s'); sb.disabled=true; sb.textContent='Saving…'; let helperOk=false, note='';
      if(!LOCAL){ try{ await SYNC.saveSecret({gemini:k,at:Date.now(),by:SYNC.me()}); }catch(e){ note='The database rules need updating before the key can be saved there (the helper does this automatically once it’s on version 8). '; } }
      if(h&&h.url){ let t=''; try{ const r=await fetch(h.url,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({key:h.key,action:'setkey',gemini:k}),redirect:'follow'}); t=await r.text(); const j=JSON.parse(t); if(j.ok) helperOk=true; else note+=(j.error||'')+' '; }
        catch(e){ note+=!t?'The app couldn’t reach the calendar helper at all ('+(e.message||'blocked')+'). ':/doPost/.test(t)?'The calendar helper is still running its OLD version: the new code is saved but not published. In Apps Script: Deploy → Manage deployments → ✏️ → Version: New version → Deploy. ':'The calendar helper answered with a page instead of data: '+t.replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim().slice(0,140)+'. '; } }
      S.aiKeyTail=k.slice(-4); S.aiKeyAt=Date.now(); save();
      msg=helperOk||(!h||!h.url)?note.trim():'Saved for the family, but the calendar helper didn’t take it: '+note.trim()+' Update the calendar helper (copy its code) and save again.';
      toast(helperOk?'✨ Gemini key saved':'Key saved'); draw();
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
    const chk=all.filter(b=>b.status==='check').sort((a,b)=>(b.at||0)-(a.at||0)), due=all.filter(b=>b.status==='due').sort((a,b)=>(a.due||'9').localeCompare(b.due||'9')), paid=all.filter(b=>b.status==='paid'||b.status==='rolled').sort((a,b)=>(b.paidAt||0)-(a.paidAt||0));
    const row=b=>`<button class="mrow bill" data-bill="${b.id}"><span class="me">${billIcon(b)}</span><span class="mrt"><b>${esc(b.biller)} · ${$m(b.amount)}</b><small>${b.dishonoured?'⚠️ payment bounced: carried into the next bill':''}${b.status==='rolled'?'':b.status==='paid'?'paid '+fmtD(new Date(b.paidAt||Date.now()),{day:'numeric',month:'short'})+(b.paidHow?' · '+esc(b.paidHow):''):billDue(b)}${b.directDebit&&b.status!=='paid'?' · direct debit':''}${b.period?' · '+esc(b.period):''}</small></span>${b.status==='due'&&b.due?`<span class="bdot ${dueCls(b.due)}"></span>`:''}</button>`;
    let body='';
    if(billTab==='check') body=chk.length?`<p class="note">New bills read from the bills email. Check each one, choose where its PDF is filed, and confirm.</p>`+chk.map(row).join(''):'<p class="note">Nothing to check. New bills sent to the bills email appear here within about 10 minutes.</p>';
    if(billTab==='due') body=(due.length?due.map(row).join(''):'<p class="note">No bills waiting to be paid.</p>')+`<div class="mact"><button class="cancel" id="hand">＋ Add a paper bill</button></div>`;
    if(billTab==='paid') body=paid.length?paid.slice(0,80).map(row).join(''):'<p class="note">No paid bills yet.</p>';
    if(billTab==='report') body=billReport();
    if(billTab==='setup') body=billSetupHTML();
    m.innerHTML=`<div class="tvhead"><h2>🧾 Bills</h2><button class="save" id="x">Done</button></div>
      <div class="row" style="gap:8px;flex-wrap:wrap;margin:0 0 8px"><button class="save" id="bScan" style="border-radius:14px;padding:12px 16px;font-weight:800">📷 Scan a bill</button><button class="cancel" id="bPick" style="border-radius:14px;padding:12px 16px">🖼️ Photo or PDF</button><button class="cancel" id="hand2" style="border-radius:14px;padding:12px 16px">✏️ Type one in</button></div>
      <input type="file" id="bfC" accept="image/*" capture="environment" hidden><input type="file" id="bfP" accept="image/*,application/pdf" hidden>
      <div class="opts mtabs">${[['check','🔎 To check',chk.length],['due','📅 To pay',due.length],['paid','✅ Paid',0],['report','📊 Report',0],['setup','⚙️ Setup',0]].map(([v,l,n])=>`<button class="opt sm ${billTab===v?'on':''}" data-bt="${v}">${l}${n?` <b>${n}</b>`:''}</button>`).join('')}</div>
      <div class="tvlist">${body}</div>`;
    m.querySelector('#x').onclick=close;
    m.querySelectorAll('[data-bt]').forEach(b=>b.onclick=()=>{ billTab=b.dataset.bt; draw(); });
    m.querySelectorAll('[data-bill]').forEach(b=>b.onclick=()=>{ close(); openBill(all.find(x=>x.id===b.dataset.bill)); });
    const hd=m.querySelector('#hand'); if(hd) hd.onclick=()=>{ close(); openBill(null); };
    m.querySelector('#hand2').onclick=()=>{ close(); openBill(null); };
    const bfC=m.querySelector('#bfC'), bfP=m.querySelector('#bfP');
    m.querySelector('#bScan').onclick=()=>{ if(!aiOK()){ toast('Reading a bill needs AI: ⚙️ Settings → Connections → ✨ AI'); return; } bfC.click(); };
    m.querySelector('#bPick').onclick=()=>{ if(!aiOK()){ toast('Reading a bill needs AI: ⚙️ Settings → Connections → ✨ AI'); return; } bfP.click(); };
    bfC.onchange=bfP.onchange=async e=>{ const f=e.target.files&&e.target.files[0]; e.target.value=''; if(!f) return; close(); let data; try{ data=await fileForAI(f); }catch(x){ toast(x.message); return; }
      const r=await billFromFile(data); if(r&&r.bill) openBill(r.bill); else openBills(); };
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
/* ask the Reminder helper to do one thing now; null if it didn't answer */
async function helperDo(action,extra){ if(!(S.voiceUrl&&S.voiceKey)) return null;
  try{ const r=await fetch(S.voiceUrl,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify(Object.assign({key:S.voiceKey,action},extra||{})),redirect:'follow'}); return await r.json(); }catch(e){ return null; } }
let billsNudgeT=0;
function billsNudge(){ clearTimeout(billsNudgeT); billsNudgeT=setTimeout(()=>{ helperDo('bills_tidy'); },4000); }
function billSetupHTML(){
  const hp=S.billsHelper, ok=hp&&hp.lastRun&&Date.now()-hp.lastRun<26*3600e3;
  return `<div class="rform"><label>Bills email address <small>(a “+bills” version of the Gmail that runs your reminder helper, e.g. yourname+bills@gmail.com. Send or forward bills here.)</small><input class="txt" id="be" type="email" value="${esc(S.billEmail||'')}" placeholder="yourname+bills@gmail.com"></label>
    <label>Google Drive folder for bills <small>(made for you if it doesn't exist)</small><input class="txt" id="br" value="${esc(S.billsRoot||'Household Bills')}"></label>
    <div><button class="save" id="bs" style="border-radius:14px;padding:12px 20px;font-weight:800">Save</button></div></div>
    <div class="srccard" style="margin-top:12px"><h4>🤖 Bills helper ${ok?`<span class="pill-ok">✓ checked ${new Date(hp.lastRun).toLocaleString('en-NZ',{weekday:'short',hour:'numeric',minute:'2-digit'})}</span>`:'<span class="pill-wait">waiting</span>'}</h4>
      ${hp&&hp.error?`<p class="note" style="color:var(--danger)">⚠️ ${esc(hp.error)}</p>`:''}
      <p class="note">Bills are read by your reminder helper (version 9 or newer) in your Google account. ⚙️ → 🧰 Helpers has the code and the one-off steps.${S.aiKeyTail?'':' It also needs your Gemini key (⚙️ → ✨ AI).'}</p>
      <p class="note">New bills are read once a day, at about 6am. Sent one just now? Tap the button.</p>
      ${S.voiceUrl&&S.voiceKey&&S.billEmail?'<button class="xbtn" id="bck">🔄 Check for new bills now</button> ':''}<button class="xbtn" id="bh">🧰 Open Helpers</button></div>`;
}
function wireBillSetup(m,draw){
  m.querySelector('#bs').onclick=()=>{ const e=m.querySelector('#be').value.trim().toLowerCase(), r=m.querySelector('#br').value.trim()||'Household Bills';
    if(e&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)){ toast('That email address doesn’t look right'); return; }
    if(e&&!/\+/.test(e)&&!confirm('This address has no “+” part, so the helper will read every email sent to it as a possible bill. Use it anyway?')) return;
    S.billEmail=e; S.billsRoot=r; save(); toast('Saved. The helper reads new bills once a day, or when you tap Check now.'); draw(); };
  { const ck=m.querySelector('#bck'); if(ck) ck.onclick=async()=>{ ck.disabled=true; ck.textContent='🔄 Checking…'; const j=await helperDo('bills_check'); toast(j?(j.speech||j.error||'Done'):'The helper didn’t answer. Try again in a minute.'); draw(); }; }
  m.querySelector('#bh').onclick=()=>{ closeModal(); openHelpers(); };
}
// one bill: check it (and choose its folder), mark it paid, or fix the details
/* Read a bill from a photo or PDF: who, how much, when, direct debit or not, and anything carried over from before.
   It goes into Bills to pay (or is recognised as one already there). A payment that bounced is caught: the earlier bill
   that was marked paid is put right. If it isn't a direct debit, a job to pay it goes on the To do list too. */
async function billFromFile(data){
  const done=aiBusy('Reading the bill…');
  try{
    const mine=(S.bills||[]).slice(-40).map(b=>({id:b.id,biller:b.biller,amount:(b.amount||0)/100,due:b.due,status:b.status,paid:b.paidAt?dk(new Date(b.paidAt)):''}));
    const j=await aiAsk({json:true,file:data,prompt:`Read this New Zealand household bill or statement. Return JSON only:
{"isBill":true,"biller":"short name, e.g. Watercare","amount":"total to pay now, number","due":"YYYY-MM-DD","directDebit":true if it says it will be paid by direct debit or automatic payment,"account":"account number","period":"e.g. November","category":"one of ${BILL_CATS.join('|')}","summary":"one plain sentence on what this bill is made of",
"carried":{"amount":number or 0,"why":"paid|unpaid|dishonoured|none"},"overdue":true or false}
"carried" is the previous balance still owing on this bill: "dishonoured" if a payment was made but returned (bounced), "unpaid" if just not paid, "none" if nothing is carried over.
Their bills already in the app: ${JSON.stringify(mine)}.`});
    done();
    if(!j||j.isBill===false||!j.biller) return {msg:'That doesn’t look like a bill'};
    const amt=Math.round(parseFloat(String(j.amount).replace(/[$,\s]/g,''))*100)||0, due=/^\d{4}-\d\d-\d\d$/.test(j.due||'')?j.due:'';
    const same=b=>String(b.biller||'').toLowerCase().replace(/\W/g,'')===String(j.biller).toLowerCase().replace(/\W/g,'');
    let ex=(S.bills||[]).find(b=>same(b)&&b.due===due&&Math.abs((b.amount||0)-amt)<2), note='';
    // a payment that bounced: the earlier bill isn't paid after all, and its amount is part of this one
    const c=j.carried||{}, cAmt=Math.round((+c.amount||0)*100);
    if(cAmt&&c.why==='dishonoured'){ const prev=(S.bills||[]).filter(b=>same(b)&&b!==ex&&Math.abs((b.amount||0)-cAmt)<2).sort((a,b)=>(b.paidAt||0)-(a.paidAt||0))[0];
      if(prev){ prev.status='rolled'; prev.dishonoured=true; prev.summary='⚠️ The payment of '+$m(cAmt)+' was dishonoured (returned by the bank). It is carried into the '+j.biller+' bill due '+(due?fmtD(kd(due),{day:'numeric',month:'short'}):'next')+'.'; }
      note='⚠️ '+$m(cAmt)+' from the last bill is included: that payment was dishonoured (bounced). '; }
    else if(cAmt&&c.why==='unpaid') note='⚠️ Includes '+$m(cAmt)+' still owing from the last bill. ';
    const b=ex||{id:'scan-'+uid(),at:Date.now(),date:dk(new Date())};
    Object.assign(b,{biller:String(j.biller).slice(0,60),amount:amt,due,status:b.status==='paid'?'paid':'due',directDebit:!!j.directDebit,period:String(j.period||'').slice(0,40),category:BILL_CATS.includes(j.category)?j.category:'Other',summary:(note+String(j.summary||'')).slice(0,400)});
    if(j.account) b.reference=String(j.account).slice(-4);
    if(!ex){ S.bills=S.bills||[]; S.bills.push(b); }
    let job='';
    if(!b.directDebit&&b.status==='due'&&!S.todos.some(t=>!t.done&&t.billId===b.id)){ S.todos.push({id:uid(),title:'Pay '+b.biller+' '+$m(amt),done:false,due:due||undefined,billId:b.id}); job=' A job to pay it is on the To do list.'; }
    save(); renderAll();
    return {bill:b,msg:(ex?'Already in Bills: ':'Added to Bills: ')+b.biller+' '+$m(amt)+(due?' due '+fmtD(kd(due),{weekday:'short',day:'numeric',month:'short'}):'')+(b.directDebit?' (direct debit, nothing to do)':'')+'.'+(note?' '+note:'')+job};
  }catch(e){ done(); if(e.message!=='quiet') toast('Couldn’t read the bill: '+e.message); return null; }
}
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
      S.bills=S.bills||[]; if(isNew) S.bills.push(Object.assign({id:'hand-'+uid(),at:Date.now(),date:dk(new Date())},b)); else Object.assign(b0,b); save(); renderAll(); billsNudge(); return true; };
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
      m2.querySelector('#c').onclick=c2; m2.querySelectorAll('[data-h]').forEach(x=>x.onclick=()=>{ b0.status='paid'; b0.paidAt=Date.now(); b0.paidHow=x.dataset.h; b0.paidBy=mePerson()||SYNC.me&&SYNC.me()||''; save(); billsNudge(); c2(); renderAll(); toast('Marked paid'); openBills('due'); }); }); };
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
      <div class="row" style="gap:8px;flex-wrap:wrap"><button class="kbig" id="kq">🧭 Quiz me on a country</button><button class="xbtn" id="kwake">🎵 Wake-up song</button>${stamps.length?`<button class="xbtn" id="kp">🛂 My passport</button>`:''}</div>
      <p class="note" style="margin-top:12px">Age ${prof.age||'?'} · questions are pitched for this age. <a href="#" id="kage">Change</a></p>`;
    m.querySelector('#x').onclick=close;
    m.querySelector('#kwake').onclick=()=>{ close(); openWake(pid); };
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

/* ================= Alexa: the family's own private voice skill ================= */
const ALEXA_SKILL=/*@ALEXA@*/'';
function alexaNames(){ const out=[]; eaters().forEach(p=>{ const n=String(p.name).replace(/[^A-Za-z0-9 '-]/g,'').replace(/\s+/g,' ').trim(); if(n&&!out.some(x=>x.toLowerCase()===n.toLowerCase())) out.push(n); }); return out; }
// what the family calls the skill: "Alexa, ask <name> ..."
const voiceName=()=>(S.voiceName||'family screen');
const voiceSay=()=>voiceName()==='family screen'?'Family Screen':voiceName();
function cleanVoiceName(v){ return String(v||'').toLowerCase().replace(/[^a-z' ]/g,' ').replace(/\s+/g,' ').trim(); }
function voiceNameProblem(n){ const w=n.split(' ');
  if(w.length<2) return 'Amazon needs at least two words.';
  if(w.some(x=>['alexa','amazon','echo','computer','skill','app'].includes(x))) return 'It can’t include Alexa, Amazon, Echo, computer, skill or app.';
  if(w.some(x=>['ask','tell','open','launch','start','load','begin','enable','use','run','play','resume','to','from','by','if','and','whether','in','using','with','about','for','that','on'].includes(x))) return 'Leave out words like ask, tell, open, to, for and and. Alexa uses those herself.';
  if(w.length===2&&w.some(x=>['the','a','an','of','up','at','off'].includes(x))) return 'A two-word name can’t use the, a, an or of.';
  return ''; }
/* 3.2 "Alexa, ask big sis to tell Mummy I love you": Alexa's free-text slot can't sit beside a name slot, so each person
   gets an intent of their own, answering to every name they go by (a name two people share is left out). */
// who a voice message is from when Alexa can't tell: the family's choice, else the first person without their own account (usually a child)
const alexaFrom=()=>S.people.some(p=>p.id===S.alexaFrom)?S.alexaFrom:((eaters().find(p=>!p.email)||eaters()[0]||{}).id||'');
function tellTargets(){
  const clean=a=>String(a||'').replace(/[^A-Za-z '-]/g,'').replace(/\s+/g,' ').trim().toLowerCase(), used={};
  const list=eaters().map(p=>({id:p.id,say:String(p.nick||p.name||''),aka:[...new Set([p.name].concat(voiceAka(p)).map(clean).filter(a=>a&&a.length>1))]}));
  list.forEach(t=>t.aka.forEach(a=>used[a]=(used[a]||0)+1));
  return list.map((t,i)=>Object.assign(t,{intent:'Tell'+String.fromCharCode(65+i)+'Intent',aka:t.aka.filter(a=>used[a]===1&&!['me','everyone','the family'].includes(a))})).filter(t=>t.aka.length).slice(0,20);
}
function alexaCode(){
  const tell={}; tellTargets().forEach(t=>tell[t.intent]={id:t.id,say:t.say}); tell.TellFamilyIntent={id:'fam',say:'the family'};
  return ALEXA_SKILL.replace('__URL__',(S.voiceUrl||'PASTE_YOUR_HELPER_WEB_APP_URL')).replace('__KEY__',(S.voiceKey||'')).replace('__PEOPLE__',JSON.stringify(alexaNames())).replace('__TELL__',JSON.stringify(tell));
}
function alexaModel(){
  const people=alexaNames(), syn=n=>{ const p=eaters().find(q=>alexaNames().includes(n)&&String(q.name).replace(/[^A-Za-z0-9 '-]/g,'').replace(/\s+/g,' ').trim().toLowerCase()===n.toLowerCase()); return p?voiceAka(p).map(a=>a.replace(/[^A-Za-z0-9 '-]/g,'').trim()).filter(Boolean):[]; }, P={name:'PERSON',values:people.concat(['everyone']).map(n=>{ const sy=syn(n); return {name:sy.length?{value:n,synonyms:sy}:{value:n}}; })};
  const I=(name,slots,samples)=>({name,slots:slots||[],samples:samples||[]});
  const s=(n,t)=>({name:n,type:t});
  return JSON.stringify({interactionModel:{languageModel:{invocationName:voiceName(),types:people.length?[P]:[],intents:[
    I('AMAZON.StopIntent'),I('AMAZON.CancelIntent'),I('AMAZON.HelpIntent'),I('AMAZON.NavigateHomeIntent'),I('AMAZON.FallbackIntent'),I('AMAZON.YesIntent'),I('AMAZON.NoIntent'),
    I('AddShopIntent',[s('item','AMAZON.SearchQuery')],['add {item} to the shopping list','add {item} to the list','put {item} on the shopping list','put {item} on the list','we need {item}','we are out of {item}','we have run out of {item}','buy {item}','get {item}','add {item}']),
    I('ShopListIntent',[],["what's on the shopping list",'what is on the shopping list','read the shopping list','read out the shopping list','what do we need','what do we need from the shops','shopping list']),
    I('AddJobIntent',[s('task','AMAZON.SearchQuery'),s('person','PERSON')],['add a job','add a task','add a to do','put a job on the list','add a job for {person}','add a task for {person}','give {person} a job','new job for {person}']),
    I('JobsIntent',[s('person','PERSON')],['what jobs are there','what jobs do we have','what is on the jobs list','read the jobs','what jobs does {person} have','what has {person} got to do','what jobs are left']),
    I('MyJobsIntent',[s('person','PERSON')],['what are my jobs','what do i have to do','what jobs do i have','what is on my list','what have i got to do','what are my tasks']),
    I('IdentifyIntent',[s('person','PERSON')],['i am {person}','this is {person}','it is {person}','my name is {person}','remember my voice as {person}','it is me {person}']),
    I('JarsIntent',[s('person','PERSON')],['how much has {person} saved','what is in the savings jars','how are the savings going','how much is saved up','how are the jars going']),
    I('MyJarsIntent',[s('person','PERSON')],['how much have i saved','how are my savings going','what is in my savings jar','how much is in my jar','how much have i got saved']),
    I('AddEventIntent',[s('title','AMAZON.SearchQuery'),s('when','AMAZON.DATE'),s('time','AMAZON.TIME'),s('person','PERSON')],['add something to the calendar','put something in the calendar','add an event','add a calendar entry','new calendar entry','add something to the calendar for {person}','put something in the calendar on {when}']),
    I('AgendaIntent',[s('when','AMAZON.DATE')],['what is on','what is on {when}',"what's on {when}",'what is happening {when}','what have we got on {when}','what is in the calendar {when}','read the calendar','what is on this week']),
    I('WhereIntent',[s('person','PERSON')],['where is {person}','where is everyone','when is {person} home','when is {person} back','is {person} home','where is she','when is she home','when is she back']),
    I('BillsIntent',[],['what bills are due','any bills','what do we owe','what bills do we have','are there any bills','bills']),
    I('RenewalsIntent',[],['what is coming up','what renewals are due','what needs renewing','when is the warrant due','when is the rego due']),
    I('MealIntent',[s('when','AMAZON.DATE')],['what is for dinner','what is for dinner {when}','what are we eating {when}','what is for tea','what is the meal plan','what is for dinner tonight']),
    I('WakeIntent',[s('person','PERSON')],['wake up {person}','wake {person} up','wake {person}','wake up','wake up now','wake me up','get {person} up','get up {person}','sing to {person}','sing {person} awake','sing the wake up song','sing the wake up song for {person}','sing {person} the wake up song','sing a wake up song for {person}','good morning song','good morning song for {person}','morning song for {person}','time to get up {person}','time for {person} to get up','get {person} out of bed','do the wake up song']),
    I('RememberIntent',[s('text','AMAZON.SearchQuery')],['remember {text}','remember that {text}','make a note {text}','note that {text}','do not forget {text}']),
    ...tellTargets().map(t=>I(t.intent,[s('msg','AMAZON.SearchQuery')],t.aka.flatMap(a=>['tell '+a+' {msg}','tell '+a+' that {msg}','message '+a+' {msg}','send '+a+' a message {msg}','send a message to '+a+' {msg}']))),
    I('TellFamilyIntent',[s('msg','AMAZON.SearchQuery')],['tell everyone {msg}','tell everyone that {msg}','tell the family {msg}','tell the family that {msg}','message everyone {msg}','message the family {msg}']),
    I('ReadMsgsIntent',[s('person','PERSON')],['read my messages','read the messages','any messages','any new messages','do i have any messages','have i got any messages','what are my messages','read {person} messages','has anyone messaged me']),
    I('AskIntent',[s('q','AMAZON.SearchQuery')],['tell me {q}','ask {q}','answer {q}','find out {q}','i want to know {q}','do you know {q}','question {q}','help me with {q}','what about {q}'])
  ]}}},null,2);
}
function openAlexa(){
  if(!S.voiceKey){ S.voiceKey=(uid()+uid()+uid()).replace(/[^a-z0-9]/gi,'').slice(0,28); save(); }
  let test='';
  modal((m,close)=>{ m.classList.add('wide','tvsheet'); const draw=()=>{
    const url=S.voiceUrl||'';
    m.innerHTML=`<div class="tvhead"><h2>🔊 Alexa</h2><button class="save" id="x">Done</button></div>
      <p class="note">Ask your Echo about the family, and add things to the lists by voice. It talks only to your own Google helper, using a key just for this. Nothing is published to Amazon's skill store: it stays private to the Echoes signed in to the Amazon account you build it with.</p>
      <div class="srccard"><h4>Step 1 · Open the reminder helper as a web address</h4>
        <p class="dirn">📋 Everything here is copied <b>from this app</b> and pasted <b>into Google and Amazon</b>. Do it all on a computer.</p>
        <ol class="note" style="margin:6px 0 8px 18px;padding:0;font-size:15px;line-height:1.6">
          <li>⚙️ → 🧰 Helpers → <b>Reminder helper</b>: it must say <b>running v13</b>. If it doesn't, do that card's steps first (copy the helper code and the settings file into Apps Script).</li>
          <li>In script.google.com open the <b>Family Screen Helper</b> project — the reminder one, <b>not</b> the calendar helper. Press <b>Deploy</b> → <b>New deployment</b> → gear icon → <b>Web app</b>.</li>
          <li>Execute as: <b>Me</b>. Who has access: <b>Anyone</b>. Press <b>Deploy</b>, approve, then <b>copy the web app URL</b> (it ends in <code>/exec</code>).</li>
        </ol>
        <label class="small" style="font-weight:700">Paste that web app URL here<input class="txt" id="vu" value="${esc(url)}" placeholder="https://script.google.com/macros/s/..../exec"></label>
        <div class="row" style="gap:8px;margin-top:8px"><button class="xbtn" id="vs">Save</button><button class="xbtn" id="vt" ${url?'':'disabled'}>🧪 Test it</button><span class="note" id="vr">${esc(test)}</span></div></div>
      <div class="srccard" style="margin-top:12px"><h4>Step 2 · Make the skill</h4>
        <ol class="note" style="margin:6px 0 8px 18px;padding:0;font-size:15px;line-height:1.6">
          <li>On a computer go to <b>developer.amazon.com/alexa/console/ask</b> and sign in with <b>the same Amazon account the Echo uses</b> — not a different one. A skill you build yourself only works on that account's Echoes, and it needs no approval from Amazon.</li>
          <li><b>Create Skill</b> → name it <b>Family Screen</b> → primary locale <b>English (AU)</b> → <b>Custom</b> model → <b>Alexa-hosted (Node.js)</b> → Create. Pick <b>Start from scratch</b> if it asks.</li>
          <li>Press <b>📋 Copy the voice model</b> below. In Amazon: <b>Build</b> tab → <b>JSON Editor</b> → click in the text → <b>Ctrl + A</b>, <b>Ctrl + V</b> → <b>Save</b> → <b>Build model</b> (takes a minute).</li>
          <li>Press <b>📋 Copy the skill code</b> below. In Amazon: <b>Code</b> tab → click in <b>index.js</b> → <b>Ctrl + A</b>, <b>Ctrl + V</b> → <b>Save</b> → <b>Deploy</b>.</li>
          <li>That's it. The skill is live on your own Echoes straight away; it never needs Amazon's approval.</li>
        </ol>
        <div class="row" style="gap:8px"><button class="xbtn" id="cm" style="background:#ffe5a8;font-weight:800">📋 Copy the voice model</button><button class="xbtn" id="cc" style="background:#ffe5a8;font-weight:800">📋 Copy the skill code</button></div>
        <p class="note" style="margin-top:8px">The skill code holds your web address and voice key, so don't paste it anywhere public. If it ever gets out, press <b>New key</b> below and paste the code in again.</p>
        <button class="xbtn" id="nk">🔑 New key</button></div>
      <div class="srccard" style="margin-top:12px"><h4>🗣️ What you call her</h4>
        <p class="note">You say <b>“Alexa, ask ${esc(voiceSay())}…”</b>. Change the name to anything you like, two words or more.</p>
        <div class="row" style="gap:8px"><input class="txt" id="vn" value="${esc(voiceName())}" style="flex:1" maxlength="40"><button class="xbtn" id="vns">Save name</button></div>
        <p class="note" style="margin-top:6px">After changing it: <b>📋 Copy the voice model</b> again → Amazon <b>Build</b> tab → <b>JSON Editor</b> → paste over the lot → <b>Save</b> → <b>Build skill</b>. The skill code doesn't change.</p></div>
      <div class="srccard" style="margin-top:12px"><h4>Step 3 · Say</h4>
        <div class="vsay">${[['What’s on today?','the calendar, any day'],['What’s on this week?',''],['Where is everyone?','who’s away, who’s flying, when she’s home'],['What’s for dinner?','tonight or any night'],['What bills are due?',''],['What’s coming up?','WOF, rego, insurance'],['What are my jobs?','your own, if it knows your voice'],['How much have I saved?','the savings jars'],['Add milk to the shopping list.','saves straight away'],['What’s on the shopping list?',''],['Add a job.','it asks what, and who for'],['Put something in the calendar.','asks what, when, what time, who for — then reads it back before saving'],['Remember that the bins go out Tuesday.','goes into family memory'],['Tell me what we need for Thursday’s dinner.','anything at all']].map(([a,b])=>`<div><b>“Alexa, ask ${esc(voiceSay())} ${esc(a)}”</b>${b?`<small>${esc(b)}</small>`:''}</div>`).join('')}</div>
        <p class="note">You can also say “Alexa, open ${esc(voiceSay())}” and then just talk, without saying the name again.</p></div>
      <div class="srccard" style="margin-top:12px"><h4>💬 Messages by voice</h4>
        <p class="note">Say <b>“Alexa, ask ${esc(voiceSay())} to tell ${esc((tellTargets()[0]||{}).aka?.[0]||'Mummy')} I love you”</b> or <b>“… to tell everyone dinner is ready”</b>. It goes to their phone like any message, and they reply in ✉️ Messages. <b>“Alexa, ask ${esc(voiceSay())} to read my messages”</b> reads the replies.</p>
        <label class="small">When Alexa doesn’t know the voice, the message is from <select id="vFrom">${eaters().map(p=>`<option value="${p.id}" ${alexaFrom()===p.id?'selected':''}>${esc(p.name)}</option>`).join('')}</select></label>
        <p class="note">After changing names, copy the skill code and the voice model into the Alexa console again (Step 2).</p></div>
      <div class="srccard" style="margin-top:12px"><h4>🗣️ So it knows who's talking</h4>
        <p class="note">“What are my jobs?” and “how much have I saved?” need Alexa to recognise the voice. In the <b>Alexa app</b> → <b>More</b> → <b>Settings</b> → <b>Your Profile &amp; Family</b> → <b>Voice ID</b>, each of you sets up a voice profile (a minute each). Then say <b>“Alexa, ask ${esc(voiceSay())} I am ${esc((eaters()[0]||{}).name||'Tony')}”</b> once and it remembers which profile is which person.</p>
        <p class="note">Without voice profiles it just asks “who are you?” first — nothing breaks.</p>
        <p class="note">🔒 Private entries and gift ideas are never read out, whoever is in the room. Bill amounts and savings totals are.</p></div>`;
    m.querySelector('#x').onclick=close;
    { const vf=m.querySelector('#vFrom'); if(vf) vf.onchange=()=>{ S.alexaFrom=vf.value; save(); toast('Voice messages are from '+nm(vf.value)+' unless Alexa knows the voice'); }; }
    const vu=m.querySelector('#vu');
    m.querySelector('#vs').onclick=()=>{ const v=vu.value.trim(); if(v&&!/^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(v)){ toast('That should be the web app URL ending in /exec'); return; } S.voiceUrl=v; save(); test=''; draw(); toast('Saved'); };
    m.querySelector('#vns').onclick=()=>{ const n=cleanVoiceName(m.querySelector('#vn').value); const bad=voiceNameProblem(n); if(bad){ toast(bad); return; } S.voiceName=n==='family screen'?'':n; save(); draw(); toast('Saved. Now copy the voice model into Amazon again.'); };
    m.querySelector('#cm').onclick=()=>{ try{ navigator.clipboard.writeText(alexaModel()).then(()=>toast('Voice model copied')); }catch(e){ toast('Copy didn’t work here. Use a computer.'); } };
    m.querySelector('#cc').onclick=()=>{ if(!S.voiceUrl){ toast('Paste the web app URL first'); return; } try{ navigator.clipboard.writeText(alexaCode()).then(()=>toast('Skill code copied')); }catch(e){ toast('Copy didn’t work here. Use a computer.'); } };
    m.querySelector('#nk').onclick=()=>{ if(!confirm('Make a new voice key? You’ll need to paste the skill code into Amazon again.')) return; S.voiceKey=(uid()+uid()+uid()).replace(/[^a-z0-9]/gi,'').slice(0,28); save(); toast('New key made'); draw(); };
    const vt=m.querySelector('#vt'); if(vt) vt.onclick=async()=>{ test='checking…'; draw();
      try{ const r=await fetch(S.voiceUrl,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({key:S.voiceKey,action:'ping'}),redirect:'follow'}); const t=await r.text(); let j={}; try{ j=JSON.parse(t); }catch(e){ j={}; }
        test = (j.helper===2||/helper key ends/.test(j.error||''))
            ? '⚠️ That’s the Calendar & AI helper. You need the web app address of the OTHER project — Family Screen Helper (the reminder one).'
          : j.ok&&j.version>=16 ? '✅ Reminder helper answered (version '+j.version+')'
          : j.ok ? '⚠️ That helper is on version '+(j.version||'?')+'. Update the Reminder helper to version 16 first, then deploy a new version.'
          : /not allowed/.test(j.error||'') ? '⚠️ It answered, but didn’t accept this key. Paste the helper code again (it must be version 16), then Deploy → New version.'
          : /doPost|not found|Script function/i.test(t) ? '⚠️ That project has no voice endpoint yet: it’s the wrong project, or still on an older version.'
          : '⚠️ '+(j.error||'Unexpected answer. Check you pasted the /exec address.'); }
      catch(e){ test='⚠️ Couldn’t reach it. Check the address and that access is set to Anyone.'; } draw(); };
  }; draw(); });
}

/* ================= Who's who: relationships and nicknames, so the AI and Alexa know who is who ================= */
function openWhosWho(){
  modal((m,close)=>{ m.classList.add('wide','tvsheet'); const draw=()=>{
    m.innerHTML=`<div class="tvhead"><h2>👪 Who's who</h2><button class="save" id="x">Done</button></div>
      <p class="note">Tell the app who everyone is and what you call each other. Alexa, the wake-up song and 💬 Ask all use this, so “sleepover at Nana's” is understood as that person's place, and “wake up Nana” works too.</p>
      ${eaters().map(p=>`<div class="srccard" style="margin-top:10px"><h4><span class="dot" style="background:${p.color};display:inline-block;margin-right:6px"></span>${esc(p.name)}</h4>
        <label class="small" style="font-weight:700">Who they are<input class="txt" data-role="${p.id}" value="${esc(p.role||'')}" placeholder="e.g. Dad · Mum · daughter, age 7 · Mum's mother, lives with us" maxlength="120"></label>
        <label class="small" style="font-weight:700;margin-top:6px;display:block">Also called <span style="font-weight:500">(commas between)</span><input class="txt" data-aka="${p.id}" value="${esc([p.nick,p.aka].filter(Boolean).join(', '))}" placeholder="e.g. Mummy, Mum · Nana, Grandma" maxlength="120"></label></div>`).join('')}
      <div class="srccard" style="margin-top:10px"><h4>🏡 Anyone or anything else</h4>
        <label class="small">Friends, relatives, pets and places that turn up in the calendar<textarea class="txt" id="fn" rows="3" maxlength="600" placeholder="e.g. Grandad Pete lives in Tauranga. Mia is Aria's best friend from school. Biscuit is the cat.">${esc(S.famNote||'')}</textarea></label></div>
      <p class="note" style="margin-top:10px">After adding or changing an “also called” name, copy the <b>voice model</b> into Amazon again (More → 🔊 Alexa) so Alexa learns to hear it.</p>`;
    m.querySelector('#x').onclick=close;
    m.querySelectorAll('[data-role]').forEach(i=>i.onchange=()=>{ person(i.dataset.role).role=i.value.trim(); save(); });
    m.querySelectorAll('[data-aka]').forEach(i=>i.onchange=()=>{ const p=person(i.dataset.aka), list=i.value.split(',').map(x=>x.trim()).filter(Boolean); if(p.traveller){ p.nick=list[0]||''; p.aka=list.slice(1).join(', '); } else { p.nick=''; p.aka=list.join(', '); } save(); renderAll(); });
    m.querySelector('#fn').onchange=e=>{ S.famNote=e.target.value.trim(); save(); };
  }; draw(); });
}

/* ================= Wake-up song: a fresh rhyme about someone's day, played on this screen ================= */
const WAKE_STYLES=[['funny','😜 Silly'],['pirate','🏴‍☠️ Pirate'],['trailer','🎬 Movie trailer'],['gentle','🌤️ Gentle']];
let wakeCtx=null;
function wakeJingle(){ try{ wakeCtx=wakeCtx||new (window.AudioContext||window.webkitAudioContext)(); const c=wakeCtx, t0=c.currentTime+0.05;
    [[523,0],[659,.16],[784,.32],[1047,.48],[784,.72],[1047,.88]].forEach(([f,at])=>{ const o=c.createOscillator(), g=c.createGain(); o.type='triangle'; o.frequency.value=f; g.gain.setValueAtTime(0.0001,t0+at); g.gain.exponentialRampToValueAtTime(0.25,t0+at+0.02); g.gain.exponentialRampToValueAtTime(0.0001,t0+at+(at>.8?.5:.2)); o.connect(g).connect(c.destination); o.start(t0+at); o.stop(t0+at+.6); });
    return 1500; }catch(e){ return 0; } }
function wakeSpeak(lines,then,onLine,onEnd){
  if(!('speechSynthesis' in window)){ onEnd&&onEnd(); return; }
  speechSynthesis.cancel();
  const vs=speechSynthesis.getVoices(), v=vs.find(x=>/en[-_]NZ/i.test(x.lang))||vs.find(x=>/en[-_]AU/i.test(x.lang))||vs.find(x=>/en[-_]GB/i.test(x.lang))||vs.find(x=>/^en/i.test(x.lang));
  const say=(t,i,sing)=>{ const u=new SpeechSynthesisUtterance(t); if(v) u.voice=v; u.rate=sing?0.92:1; u.pitch=sing?1.35:1; u.onstart=()=>onLine&&onLine(i); return u; };
  lines.forEach((l,i)=>speechSynthesis.speak(say(l,i,true)));
  const last=say(then,lines.length,false); last.onend=()=>onEnd&&onEnd(); speechSynthesis.speak(last);
}
function openWake(pid){
  const kids=eaters(); let who=pid||(typeof kidWho==='function'&&kidWho())||(kids[0]||{}).id, song=null, busy=false, err='', at=-1;
  modal((m,close)=>{ m.classList.add('wide','wake'); const stop=()=>{ try{ speechSynthesis.cancel(); }catch(e){} };
    const play=()=>{ if(!song) return; at=-1; stop(); const wait=S.wakeSfx!==false?wakeJingle():0; setTimeout(()=>wakeSpeak(song.verse,song.then,i=>{ at=i; m.querySelectorAll('.wline').forEach((el,k)=>el.classList.toggle('on',k===i)); },()=>{ at=-1; m.querySelectorAll('.wline').forEach(el=>el.classList.remove('on')); }),wait); };
    const fetchSong=async()=>{ if(busy) return; if(!S.voiceUrl){ err='Set up 🔊 Alexa first (More → Alexa, Step 1). The song comes from the same helper.'; draw(); return; }
      busy=true; err=''; song=null; draw();
      try{ const r=await fetch(S.voiceUrl,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({key:S.voiceKey,action:'wake',person:nm(who),style:S.wakeStyle||'funny'}),redirect:'follow'}); const j=await r.json();
        if(j&&j.verse&&j.verse.length){ song=j; } else err=/not allowed/.test(j.error||'')?'The helper didn’t accept the voice key. Open More → Alexa → Test it.':(j.ask?'The helper doesn’t know '+nm(who)+' yet.':'The Reminder helper needs updating to version 13 (⚙️ → 🧰 Helpers), then Deploy → Manage deployments → New version.'); }
      catch(e){ err='Couldn’t reach the helper. Check the internet and try again.'; }
      busy=false; draw(); if(song) play(); };
    const draw=()=>{ m.innerHTML=`<div class="tvhead"><h2>🎵 Wake-up song</h2><button class="save" id="x">Done</button></div>
      <div class="opts" style="margin-bottom:8px">${kids.map(p=>`<button class="opt ${p.id===who?'on':''}" data-ww="${p.id}"><span class="dot" style="background:${p.color}"></span>${esc(p.name)}</button>`).join('')}</div>
      <div class="opts wstyles">${WAKE_STYLES.map(([k,l])=>`<button class="opt ${(S.wakeStyle||'funny')===k?'on':''}" data-ws="${k}">${l}</button>`).join('')}</div>
      <div class="wsong">${busy?'<div class="wwait">🎼 Writing today’s song…</div>':song?song.verse.map((l,i)=>`<div class="wline ${at===i?'on':''}">${esc(l)}</div>`).join('')+`<div class="wline wthen">${esc(song.then)}</div>`+(song.aiNote?`<p class="note">⚠️ ${esc(song.aiNote)}</p>`:''):err?`<p class="note">⚠️ ${esc(err)}</p>`:`<div class="wwait">A brand new rhyme about ${esc(nm(who))}’s day, every time.</div>`}</div>
      <div class="row" style="gap:8px;flex-wrap:wrap"><button class="kbig" id="wgo" ${busy?'disabled':''}>${song?'🎲 New song':'▶️ Wake up '+esc(nm(who))}</button>${song?'<button class="xbtn" id="wag">🔁 Again</button>':''}
        <label class="note" style="display:flex;align-items:center;gap:6px;margin-left:auto"><input type="checkbox" id="wfx" ${S.wakeSfx!==false?'checked':''}> Sound effects</label></div>
      <p class="note" style="margin-top:10px">On the Echo, say <b>“Alexa, ask ${esc(voiceSay())} to wake up ${esc(nm(who))}”</b>. The style and sound-effects choice here is what Alexa uses too.</p>`;
      m.querySelector('#x').onclick=()=>{ stop(); close(); };
      m.querySelectorAll('[data-ww]').forEach(b=>b.onclick=()=>{ who=b.dataset.ww; song=null; err=''; stop(); draw(); });
      m.querySelectorAll('[data-ws]').forEach(b=>b.onclick=()=>{ S.wakeStyle=b.dataset.ws; save(); song=null; stop(); draw(); });
      m.querySelector('#wgo').onclick=fetchSong; const ag=m.querySelector('#wag'); if(ag) ag.onclick=play;
      m.querySelector('#wfx').onchange=e=>{ S.wakeSfx=e.target.checked; save(); };
    }; draw(); });
}

/* ================= Help: what you can say to Alexa ================= */
function helpGroups(){
  const tp=traveller(), her=tp?tp.name:'Mummy', kid=(eaters().find(p=>/aria/i.test(p.name))||eaters()[2]||eaters()[0]||{}).name||'Aria', me=(mePerson()&&nm(mePerson()))||(eaters()[0]||{}).name||'Tony';
  return [
    ['📅','The day',[['What’s on today?','everything in the calendar'],['What’s on tomorrow?',''],['What’s on this week?',''],['What’s on this Friday?','any day you like']]],
    ['✈️','Where’s '+her+'?',[['Where is everyone?','in the air, which city, or home'],['When is '+her+' home?','when she lands, in our time']]],
    ['🍽️','Food',[['What’s for dinner?','tonight'],['What’s for dinner on Saturday?',''],['What’s on the shopping list?','reads it out'],['Add milk to the shopping list.','goes straight on the list'],['We’re out of bread.','same thing']]],
    ['✅','Jobs',[['What are my jobs?','just yours'],['What jobs does '+kid+' have?',''],['What jobs are there?','everyone’s'],['Add a job.','it asks what, and who for']]],
    ['🗓️','Putting things in',[['Put something in the calendar.','asks what, when, what time, who for — then reads it back'],['Remember that the bins go out Tuesday.','saved into family memory']]],
    ['💰','Money',[['How much have I saved?','your savings jars'],['How much has '+kid+' saved?',''],['What bills are due?',''],['What’s coming up?','WOF, rego, insurance']]],
    ['🎵','Wake-up song',[['Wake up '+kid+'.','a brand new silly rhyme about the day, every time'],['Sing the wake up song for '+me+'.','works for anyone']]],
    ['💬','Anything else',[['Tell me what we need for Thursday’s dinner.',''],['Tell me how long until '+her+' is home.',''],['Tell me what I’ve forgotten today.','it answers from everything the app knows']]],
    ['🗣️','If it doesn’t know your voice',[['I am '+me+'.','say it once and it remembers you']]],
  ];
}
function openHelp(){
  modal((m,close)=>{ m.classList.add('wide','tvsheet');
    m.innerHTML=`<div class="tvhead"><h2>❓ What can I say?</h2><button class="save" id="x">Done</button></div>
      <p class="helplead">Start with <b>“Alexa, ask ${esc(voiceSay())}…”</b> and then say one of these.<br><small>Or say <b>“Alexa, open ${esc(voiceSay())}”</b> first, and then just talk.</small></p>
      <div class="tvlist">${helpGroups().map(([e,title,rows])=>`<div class="hgrp"><h4>${e} ${esc(title)}</h4>${rows.map(([a,b])=>`<div class="hrow"><b>“${esc(a)}”</b>${b?`<small>${esc(b)}</small>`:''}</div>`).join('')}</div>`).join('')}
      <p class="note">🔒 Private entries and gift ideas are never read out loud.</p></div>`;
    m.querySelector('#x').onclick=close;
  });
}

/* ================= Family messages: a thread for each person, plus the family group ================= */
const MSG_QUICK=['I’m home 🏠','Can you call me? 📞','I’m hungry 😋','Love you ❤️','Goodnight 🌙','👍'];
let msgAs='', msgOpen=null, msgSeenAt=Date.now(), msgCtx=null;
const msgFolk=()=>S.people.filter(p=>p.id!=='all');
// who can write from this device: on a phone it is you; on the shared screen it is the people with no sign-in of their own (the kids)
function msgWho(){ const me=mePerson(); if(isPhone()&&me) return [me];
  const kids=msgFolk().filter(p=>!p.email).map(p=>p.id); if(!isPhone()&&kids.length) return kids;
  return me?[me]:msgFolk().map(p=>p.id); }
const msgThread=(a,b)=>b==='fam'?'fam':[a,b].sort().join('|');
// 4.1 chats with a linked family (Masako ↔ Tony's family) are kept in that family's records; here they are threads "g~…"
const msgG=th=>typeof th==='string'&&th.indexOf('g~')===0&&SYNC.guestTh?SYNC.guestTh(th):null;
const msgIsFam=th=>th==='fam'||!!(msgG(th)&&msgG(th).fam);
const msgOther=(th,me)=>{ const G=msgG(th); return G?(G.fam?th:G.other):th==='fam'?'fam':String(th).split('|').find(x=>x!==me)||me; };
const msgName=o=>o==='fam'?'Family':msgG(o)?msgG(o).label:nm(o);
const msgMine=(m,me)=>m.g?me===mePerson():(m.th==='fam'||String(m.th).split('|').includes(me));
const msgLinkedIn=()=>SYNC.chatEm?SYNC.chatEm('fam').map(e=>{ const p=S.people.find(q=>q.email===e); return p?p.name:''; }).filter(Boolean):[];
// a record written by a linked account (it carries that account's address) only counts if it speaks as that person, in a chat that person is in
const msgOk=m=>!m.byE||((person(m.from)||{}).email===m.byE&&(m.g||m.th==='fam'||String(m.th).split('|').includes(m.from)));
const msgAll=()=>(S.msgs||[]).filter(msgOk);
const msgIn=th=>msgAll().filter(m=>m.th===th).sort((a,b)=>a.at-b.at);
const msgUnread=(me,th)=>msgAll().filter(m=>(th?m.th===th:msgMine(m,me))&&m.from!==me&&!(m.seen||[]).includes(me)).length;
const msgUnreadAll=()=>msgWho().reduce((n,id)=>n+msgUnread(id),0);
function msgChime(){ try{ msgCtx=msgCtx||new (window.AudioContext||window.webkitAudioContext)(); const t=msgCtx.currentTime; [660,880].forEach((f,i)=>{ const o=msgCtx.createOscillator(), g=msgCtx.createGain(); o.frequency.value=f; o.connect(g); g.connect(msgCtx.destination); g.gain.setValueAtTime(.0001,t+i*.13); g.gain.exponentialRampToValueAtTime(.12,t+i*.13+.02); g.gain.exponentialRampToValueAtTime(.0001,t+i*.13+.3); o.start(t+i*.13); o.stop(t+i*.13+.32); }); }catch(e){} }
function msgSend(me,th,text,extra){ text=String(text||'').trim().slice(0,600); if(!text) return;
  const G=msgG(th), everyone=!!(extra&&extra.seenAll); if(everyone){ extra=Object.assign({},extra); delete extra.seenAll; }
  if(G){   // a chat with the linked family: saved in their records, and their helper sends the alert
    SYNC.guestMsgAdd(th,Object.assign({id:uid(),text,at:Date.now()},extra||{}),everyone).then(()=>{ const h=SYNC.guestHelper(th); if(h) setTimeout(()=>{ fetch(h.url,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({key:h.key,action:'msg_push'}),redirect:'follow'}).catch(()=>{}); },1500); })
      .catch(e=>toast(e&&e.code==='permission-denied'?'Messages with '+G.label+' will be ready within about 15 minutes: the database is updating itself':'Couldn’t send that. Try again.'));
    return; }
  const em=SYNC.chatEm?SYNC.chatEm(th):[];   // linked accounts (Masako) that should see this message
  S.msgs=S.msgs||[]; S.msgs.push(Object.assign({id:uid(),th,from:me,text,at:Date.now(),seen:everyone?msgFolk().map(p=>p.id):[me]},em.length?{em}:{},extra||{}));
  if(S.msgs.length>600){ const all=S.msgs.sort((a,b)=>a.at-b.at); all.slice(0,-500).forEach(x=>{ if(x.pic&&x.pic.id){ try{ SYNC.picDrop(x.pic.id); }catch(e){} } }); S.msgs=all.slice(-500); }
  save();
  // ask the helper to send the phone notification straight away (the 5-minute check is the backstop)
  if(S.voiceUrl&&S.voiceKey) setTimeout(()=>{ fetch(S.voiceUrl,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({key:S.voiceKey,action:'msg_push'}),redirect:'follow'}).catch(()=>{}); },1500); }
function msgMarkSeen(me,th){ let ch=false; (S.msgs||[]).forEach(m=>{ if(m.th===th&&m.from!==me&&!(m.seen||[]).includes(me)){ m.seen=(m.seen||[]).concat(me); if(m.g) SYNC.guestMsgSeen(m.id); else ch=true; } }); if(ch) save(); }
const msgTime=t=>{ const d=new Date(t), today=dk(d)===dk(new Date()); return (today?'':fmtD(d,{weekday:'short',day:'numeric',month:'short'})+' ')+t12(String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0')); };
const msgFace=id=>id==='fam'||msgG(id)?`<span class="mface" style="background:#ffe9b8">👪</span>`:`<span class="mface" style="background:${col(id)}">${esc((nm(id)||'?').charAt(0))}</span>`;
/* ---- photos in Messages: made a sensible size on the device, kept one per record in the family's database, and saved
   on each screen the first time a chat shows it. The message itself carries only a tiny blurred preview. ---- */
const picUrls={};
async function picPrep(file){
  const img=await new Promise((ok,no)=>{ const i=new Image(); i.onload=()=>ok(i); i.onerror=()=>no(new Error('Could not open that picture')); i.src=URL.createObjectURL(file); });
  const make=(max,q)=>{ const sc=Math.min(1,max/Math.max(img.width,img.height)), c=document.createElement('canvas'); c.width=Math.max(1,Math.round(img.width*sc)); c.height=Math.max(1,Math.round(img.height*sc)); c.getContext('2d').drawImage(img,0,0,c.width,c.height); return {w:c.width,h:c.height,url:c.toDataURL('image/jpeg',q)}; };
  let full=make(1280,.8); if(full.url.length>780e3) full=make(1280,.6); if(full.url.length>780e3) full=make(900,.6);
  const tiny=make(24,.5); try{ URL.revokeObjectURL(img.src); }catch(e){}
  return {data:full.url.split(',')[1],w:full.w,h:full.h,t:tiny.url};
}
const picBlob=b64=>new Blob([Uint8Array.from(atob(b64),ch=>ch.charCodeAt(0))],{type:'image/jpeg'});
async function picKeep(id,blob){ picUrls[id]=URL.createObjectURL(blob); try{ const c=await caches.open('fs-keep'); await c.put('mp/'+id,new Response(blob,{headers:{'Content-Type':'image/jpeg'}})); }catch(e){} return picUrls[id]; }
async function picUrl(id,g){
  if(picUrls[id]) return picUrls[id];
  try{ const c=await caches.open('fs-keep'), r=await c.match('mp/'+id); if(r){ picUrls[id]=URL.createObjectURL(await r.blob()); return picUrls[id]; } }catch(e){}
  const d=await SYNC.picGet(id,g); if(!d||!d.d) throw new Error('gone');
  return picKeep(id,picBlob(d.d));
}
async function msgSendPics(me,th,files){
  const list=[...files].filter(f=>/^image\//.test(f.type)).slice(0,10); if(!list.length){ toast('Those aren’t photos'); return 0; }
  toast(list.length>1?`Sending ${list.length} photos…`:'Sending photo…'); let ok=0;
  for(const f of list){ try{ const p=await picPrep(f), id=uid(); await SYNC.picPut(id,{d:p.data,at:Date.now(),by:SYNC.me()||me},th); await picKeep(id,picBlob(p.data));
      msgSend(me,th,'📷 Photo',{pic:{id,w:p.w,h:p.h,t:p.t}}); ok++; if(msgOpen&&msgOpen.draw) msgOpen.draw(); }
    catch(e){ toast(e&&e.code==='permission-denied'?'Photos in messages will be ready within about 15 minutes: the database is updating itself':'Couldn’t send that photo. Try again.'); break; } }
  return ok;
}
function picView(id){ const u=picUrls[id]; if(!u) return; const v=document.createElement('div'); v.className='alview';
  v.innerHTML=`<img src="${u}" alt=""><div class="row" style="gap:10px;justify-content:center;flex-wrap:wrap"><button class="save bigback" id="vb">‹ Back</button><a class="cancel" id="vs" href="${u}" download="Family Screen photo.jpg" style="text-decoration:none;display:inline-flex;align-items:center">⬇️ Save</a><button class="cancel" id="va">📸 Add to family album</button></div>`;
  document.body.appendChild(v); v.querySelector('#vb').onclick=()=>v.remove();
  v.querySelector('#va').onclick=async e=>{ const b=e.currentTarget; b.disabled=true; b.textContent='Adding…'; try{ const bl=await (await fetch(u)).blob(); await albumAdd([new File([bl],'From messages.jpg',{type:'image/jpeg'})]); }catch(x){ toast('Couldn’t add it to the album'); } v.remove(); }; }
const picTiny=t=>/^data:image\/jpeg;base64,[A-Za-z0-9+\/=]+$/.test(t||'')?t:'';
function openMsgs(th){
  const who=msgWho(); if(!msgAs||!who.includes(msgAs)) msgAs=who.length===1?who[0]:'';
  msgOpen={th:th||null};
  modal((m,close)=>{ m.classList.add('msgm'); m.id='msgBox';
    const shut=()=>{ msgOpen=null; close(); renderAll(); };
    const draw=()=>{
      if(!msgAs){ m.innerHTML=`<div class="tvhead"><h2>✉️ Messages</h2><button class="cancel" id="x">Close</button></div><p class="note">Who’s writing?</p><div class="mlist">${who.map(id=>`<button class="mrow" data-as="${id}">${msgFace(id)}<b>${esc(nm(id))}</b>${msgUnread(id)?`<i class="mdot">${msgUnread(id)}</i>`:''}</button>`).join('')}</div>`;
        m.querySelector('#x').onclick=shut; m.querySelectorAll('[data-as]').forEach(b=>b.onclick=()=>{ msgAs=b.dataset.as; draw(); }); return; }
      const me=msgAs;
      if(!msgOpen.th){
        const own=msgFolk().filter(p=>p.id!==me).map(p=>p.id), gc=me===mePerson()&&SYNC.guestChats?SYNC.guestChats():[];
        const list=(own.length||!gc.length?[{o:'fam',t:'fam'}]:[]).concat(own.map(o=>({o,t:msgThread(me,o)})));   // someone on their own with a linked family sees that family's chats, not an empty "Family"
        gc.forEach(c=>{ if(c.fam) list.push({o:c.fam,t:c.fam}); c.people.forEach(p=>list.push({o:p.id,t:p.th})); });
        const rows=list.map(({o,t})=>{ const ms=msgIn(t), last=ms[ms.length-1], n=msgUnread(me,t); return {o,t,last,n}; })
          .sort((a,b)=>(b.last?b.last.at:0)-(a.last?a.last.at:0));
        m.innerHTML=`<div class="tvhead"><h2>✉️ Messages${who.length>1?` <small class="mas" id="sw">${esc(nm(me))} ▾</small>`:''}</h2><button class="cancel" id="x">Close</button></div>
          <div class="mlist">${rows.map(r=>`<button class="mrow ${r.n?'unread':''}" data-th="${r.t}">${msgFace(r.o)}<span class="mmid"><b>${esc(msgName(r.o))}</b><small>${r.last?esc((r.last.from===me?'You: ':msgIsFam(r.t)?nm(r.last.from)+': ':'')+r.last.text):'Say hello 👋'}</small></span><span class="mend">${r.last?`<small>${msgTime(r.last.at)}</small>`:''}${r.n?`<i class="mdot">${r.n}</i>`:''}</span></button>`).join('')}</div>`;
        m.querySelector('#x').onclick=shut; const sw=m.querySelector('#sw'); if(sw) sw.onclick=()=>{ msgAs=''; draw(); };
        m.querySelectorAll('[data-th]').forEach(b=>b.onclick=()=>{ msgOpen.th=b.dataset.th; draw(); }); return; }
      const t=msgOpen.th, fam=msgIsFam(t), other=msgOther(t,me), ms=msgIn(t), also=t==='fam'?msgLinkedIn():[]; msgMarkSeen(me,t);
      const SR=window.SpeechRecognition||window.webkitSpeechRecognition; let lastDay='';
      m.innerHTML=`<div class="tvhead mhead"><button class="cancel" id="bk" aria-label="Back">‹</button>${msgFace(other)}<h2>${esc(msgName(other))}</h2>${other!==me?`<button class="cancel mcallb" id="cA" aria-label="Voice call">📞</button><button class="cancel mcallb" id="cV" aria-label="Video call">🎥</button>`:''}<button class="cancel" id="x">Close</button></div>
        <div class="mbubs" id="mb">${also.length?`<div class="mday">👥 Everyone at home, and ${esc(also.join(', '))}</div>`:''}${ms.length?ms.map(x=>{ const d=dk(new Date(x.at)), sep=d!==lastDay?`<div class="mday">${d===dk(new Date())?'Today':fmtD(new Date(x.at),{weekday:'long',day:'numeric',month:'short'})}</div>`:''; lastDay=d; const mine=x.from===me;
          if(x.call) return sep+`<div class="mcall ${x.call.ok?'':'miss'}">${x.call.kind==='video'?'🎥':'📞'} ${esc(x.call.ok?(x.call.kind==='video'?'Video call':'Voice call')+' · '+callDur(x.call.dur):mine?'No answer':'Missed '+(x.call.kind==='video'?'video':'voice')+' call')} <small>${msgTime(x.at).replace(/^.* /,'')}</small>${x.call.ok?'':`<button class="cancel" data-cb="${x.call.kind==='video'?'video':'audio'}">${mine?'Call again':'Call back'}</button>`}</div>`;
          const pic=x.pic&&/^[\w-]+$/.test(x.pic.id||'')?`<span class="mpic" data-pic="${x.pic.id}" data-pg="${/^[\w-]+$/.test(x.g||'')?x.g:''}" style="aspect-ratio:${Math.max(1,+x.pic.w||4)}/${Math.max(1,+x.pic.h||3)};${picTiny(x.pic.t)?`background-image:url(${picTiny(x.pic.t)})`:''}">${picUrls[x.pic.id]?`<img src="${picUrls[x.pic.id]}" alt="Photo">`:''}</span>`:'';
          return sep+`<div class="mb ${mine?'me':''}">${!mine&&fam?`<small class="mfrom" style="color:${col(x.from)};filter:brightness(.6)">${esc(nm(x.from))}</small>`:''}${pic}${pic&&x.text==='📷 Photo'?'':`<span class="mtxt" ${mine?'':`style="background:${col(x.from)}"`}>${esc(x.text)}</span>`}<small class="mat">${msgTime(x.at).replace(/^.* /,'')}${mine&&!fam&&(x.seen||[]).includes(other)?' · Seen':''}</small></div>`; }).join(''):'<p class="note" style="text-align:center;margin-top:30px">No messages yet. Say hello 👋</p>'}</div>
        <div class="mquick">${MSG_QUICK.map((q,i)=>`<button class="cancel" data-q="${i}">${esc(q)}</button>`).join('')}</div>
        <form class="msend" id="mf"><button type="button" class="cancel" id="mpB" aria-label="Send a photo">📷</button><input type="file" id="mpC" accept="image/*" capture="environment" hidden><input type="file" id="mpP" accept="image/*" multiple hidden><input id="mi" placeholder="Message" autocomplete="off" maxlength="600">${SR?'<button type="button" class="cancel" id="mic" aria-label="Speak">🎤</button>':''}<button class="save" id="ms" aria-label="Send">➤</button></form>`;
      const box=m.querySelector('#mb'); box.scrollTop=box.scrollHeight;
      m.querySelector('#x').onclick=shut; m.querySelector('#bk').onclick=()=>{ msgOpen.th=null; draw(); };
      const inp=m.querySelector('#mi'), go=txt=>{ msgSend(me,t,txt); draw(); };
      m.querySelector('#mf').onsubmit=e=>{ e.preventDefault(); if(inp.value.trim()) go(inp.value); };
      m.querySelectorAll('[data-q]').forEach(b=>b.onclick=()=>go(MSG_QUICK[+b.dataset.q]));
      { const C=m.querySelector('#mpC'), P=m.querySelector('#mpP'); m.querySelector('#mpB').onclick=()=>matchMedia('(pointer:coarse)').matches?photoChoice(C,P):P.click();
        C.onchange=P.onchange=e=>{ const fs=[...(e.target.files||[])]; e.target.value=''; if(fs.length) msgSendPics(me,t,fs); };
        inp.onpaste=e=>{ const fs=[...((e.clipboardData&&e.clipboardData.files)||[])].filter(f=>/^image\//.test(f.type)); if(fs.length){ e.preventDefault(); msgSendPics(me,t,fs); } };
        m.querySelectorAll('[data-pic]').forEach(el=>{ const id=el.dataset.pic; el.onclick=()=>picView(id);
          if(!el.firstChild) picUrl(id,el.dataset.pg||'').then(u=>{ if(el.isConnected&&!el.firstChild){ const i=new Image(); i.alt='Photo'; i.src=u; el.appendChild(i); } }).catch(()=>{ el.classList.add('gone'); }); });
        const cA=m.querySelector('#cA'), cV=m.querySelector('#cV'); if(cA) cA.onclick=()=>callStart(me,t,'audio'); if(cV) cV.onclick=()=>callStart(me,t,'video');
        m.querySelectorAll('[data-cb]').forEach(b=>b.onclick=()=>callStart(me,t,b.dataset.cb)); }
      const mic=m.querySelector('#mic'); if(mic) mic.onclick=()=>{ try{ const r=new SR(); r.lang='en-NZ'; r.interimResults=false; mic.textContent='👂'; r.onresult=e=>{ inp.value=(inp.value+' '+e.results[0][0].transcript).trim(); }; r.onend=()=>{ mic.textContent='🎤'; inp.focus(); }; r.onerror=()=>{ mic.textContent='🎤'; toast('Couldn’t hear that. Try again, or type it.'); }; r.start(); }catch(e){ toast('Voice typing isn’t available on this device'); } };
    };
    m.addEventListener('dragover',e=>{ if(msgOpen&&msgOpen.th&&msgAs&&e.dataTransfer&&[...e.dataTransfer.types].includes('Files')) e.preventDefault(); });
    m.addEventListener('drop',e=>{ if(!(msgOpen&&msgOpen.th&&msgAs)) return; const fs=[...((e.dataTransfer&&e.dataTransfer.files)||[])].filter(f=>/^image\//.test(f.type)); if(!fs.length) return; e.preventDefault(); msgSendPics(msgAs,msgOpen.th,fs); });
    msgOpen.draw=draw; draw();
  });
}
// called whenever anything syncs: keeps an open chat fresh, updates the badges and announces a new message
function msgRefresh(){
  if(msgOpen&&!document.querySelector('#msgBox')) msgOpen=null;
  const who=msgWho(), fresh=msgAll().filter(m=>m.at>msgSeenAt&&!who.includes(m.from)&&who.some(id=>msgMine(m,id))&&!who.every(id=>(m.seen||[]).includes(id))).sort((a,b)=>a.at-b.at);
  if(fresh.length){ const last=fresh[fresh.length-1]; msgSeenAt=last.at;
    if(!(msgOpen&&msgOpen.th===last.th)){ const h=new Date().getHours(); if(isPhone()||(h>=7&&h<21)) msgChime(); toast('💬 '+nm(last.from)+': '+last.text.slice(0,80)); if(typeof saverOff==='function') saverOff(); } }
  if(msgOpen&&msgOpen.draw){ const i=document.querySelector('#msgBox #mi'), v=i?i.value:'', f=i&&document.activeElement===i; msgOpen.draw(); const j=document.querySelector('#msgBox #mi'); if(j&&v){ j.value=v; } if(j&&f) j.focus(); }
  const n=msgUnreadAll(), b=document.querySelector('#msgBadge'); if(b){ b.textContent=n||''; b.style.display=n?'':'none'; }
}

/* ================= Family inbox: forwarded emails become suggested events and to-dos ================= */
const inboxNew=()=>(S.inbox||[]).filter(d=>d.status==='new').reduce((n,d)=>n+(d.items||[]).filter(i=>i.state==='new').length,0);
function inboxAdd(d,it){
  const who=it.who&&person(it.who)?it.who:'', note=it.note&&it.note.length<=40?' ('+it.note+')':'';
  if(it.type==='event'){ let dur=0; if(it.time){ dur=60; if(it.end){ const mins=x=>(+x.slice(0,2))*60+(+x.slice(3)), g=mins(it.end)-mins(it.time); if(g>0) dur=g; } }
    S.events.push({id:uid(),whos:[who||(person('all')?'all':S.people[0].id)],title:(it.title+note).slice(0,110),addr:'',date:it.date,time:it.time||'',dur,from:'inbox'}); }
  else { const by=it.due?' (by '+fmtD(kd(it.due),{weekday:'short',day:'numeric',month:'short'})+')':''; S.todos.unshift({id:uid(),title:(it.title+by+note).slice(0,130),who,done:false,at:Date.now(),from:'inbox'}); }
  it.state='added'; if(!(d.items||[]).some(i=>i.state==='new')) d.status='done';
}
/* 2.4 Something shared from another Android app (an email, a photo, a screenshot, a web page): the AI reads it and it
   lands in the family inbox, where each entry or job waits for someone to tap Add, the same as a forwarded email. */
async function takeShare(){
  let c, meta; try{ c=await caches.open('fs-share'); const r=await c.match('share-meta'); if(!r) return; meta=await r.json(); }catch(e){ return; }
  const files=[]; for(const f of meta.files||[]){ try{ const r=await c.match(f.k); if(r) files.push(new File([await r.blob()],f.name||'shared',{type:f.type||''})); }catch(e){} }
  try{ await Promise.all(['share-meta'].concat((meta.files||[]).map(f=>f.k)).map(k=>c.delete(k))); }catch(e){}
  let text=[meta.title,meta.text].filter(Boolean).join('\n'); const link=meta.url||((text.match(/https?:\/\/\S+/)||[])[0])||'';
  const tf=files.find(f=>/^text\/|\.(ics|eml|txt)$/i.test(f.type+' '+f.name)); if(tf) try{ text+='\n'+(await tf.text()).slice(0,12000); }catch(e){}
  const pic=files.find(f=>/^image\/|application\/pdf/.test(f.type));
  if(files.length&&files.every(f=>/^image\//.test(f.type))&&!text.replace(link,'').trim()){
    const choice=await new Promise(res=>modal((m,close)=>{ m.innerHTML=`<h2>Where should ${files.length>1?'these photos':'this photo'} go?</h2><div class="opts" style="flex-direction:column;align-items:stretch;gap:10px"><button class="opt big" id="a1">📸 Family album</button><button class="opt big" id="a2">📥 Family inbox (a letter, notice or bill)</button></div>`;
      m.querySelector('#a1').onclick=()=>{ close(); res('album'); }; m.querySelector('#a2').onclick=()=>{ close(); res('inbox'); }; }));
    if(choice==='album'){ await albumAdd(files); openAlbum(); return; } }
  const me=mePerson(), d={id:uid(),status:'new',at:Date.now(),sender:'Shared by '+(me?nm(me):'the family'),summary:'',items:[],shared:true,
    fromEmail:{from:'Shared',subject:String(meta.title||(pic?pic.name:'')||link||text.split('\n')[0]||'Shared').slice(0,120),link}};
  if(aiOK()){ const done=aiBusy('Reading what you shared…');
    try{ const out=await aiAsk({json:true,file:pic?await fileForAI(pic):undefined,url:link&&!text.replace(link,'').trim()&&!pic?link:undefined,
        prompt:withMemory(`A family member shared this to the family inbox${pic?' (the attached file)':''}${link?' (link: '+link+')':''}.${text.trim()?' Text: +text.slice(0,12000)+':''}
Find what the family needs to do or go to. Return JSON only: {"summary":"one short sentence about what it is","items":[{"type":"event|todo","title":"short","date":"YYYY-MM-DD or empty","time":"HH:MM or empty","end":"HH:MM or empty","due":"YYYY-MM-DD or empty","note":"a few words, e.g. what to bring, or empty","who":"person id or empty"}]}
People (id = names): ${S.people.filter(p=>p.id!=='all').map(p=>p.id+' = '+[p.name,p.nick,p.role].filter(Boolean).join(' / ')).join('; ')}. Leave out anything already past. No items is fine.`,text)});
      d.summary=String(out.summary||'').slice(0,300); d.items=(out.items||[]).filter(x=>x&&x.title).slice(0,12).map(x=>({id:uid(),type:x.type==='event'&&/^\d{4}-\d\d-\d\d$/.test(x.date||'')?'event':'todo',title:String(x.title).slice(0,110),date:x.date||'',time:/^\d\d:\d\d$/.test(x.time||'')?x.time:'',end:/^\d\d:\d\d$/.test(x.end||'')?x.end:'',due:/^\d{4}-\d\d-\d\d$/.test(x.due||'')?x.due:'',note:String(x.note||'').slice(0,80),who:S.people.some(p=>p.id===x.who)?x.who:'',state:'new'}));
      if(!d.items.length) d.status='none'; }
    catch(e){ d.summary=e.message==='quiet'?'':'The AI couldn’t read it: '+e.message; }
    done(); }
  else d.summary='Saved here. Turn on AI (⚙️ Settings → Connections → ✨ AI) and shared things are sorted into entries and jobs for you.';
  if(!d.summary&&text) d.summary=text.slice(0,200);
  S.inbox=S.inbox||[]; S.inbox.unshift(d); save(); openInbox();
  toast(d.items.length?d.items.length+(d.items.length===1?' thing':' things')+' to check in the inbox':'Saved to the inbox');
}
// the family inbox address, as Settings → Email addresses shows it (2.1)
function inboxSetupHTML(){ const ih=S.inboxHelper;
  return `<div class="rform"><label>Family inbox address <small>(a “+” version of the Gmail that runs your Reminder helper, e.g. yourname+family@gmail.com. Bills sent here are passed on to Bills.)</small><input class="txt" id="ia" type="email" value="${esc(S.inboxEmail||'')}" placeholder="yourname+family@gmail.com"></label>
    <div><button class="save" id="isv" style="border-radius:14px;padding:12px 20px;font-weight:800">Save</button></div></div>
    <p class="note">Read once a day at about 6am, or straight away with Check now. Nothing goes on the calendar until someone taps Add in 📥 Inbox.${ih&&ih.lastRun?' Last checked '+new Date(ih.lastRun).toLocaleString('en-NZ',{weekday:'short',hour:'numeric',minute:'2-digit'})+'.':''}</p>
    ${S.voiceUrl&&S.voiceKey&&S.inboxEmail?'<button class="xbtn" id="ick">🔄 Check for new emails now</button>':''}`; }
function wireInboxSetup(m,draw){
  const sv=m.querySelector('#isv'); if(sv) sv.onclick=()=>{ const e=m.querySelector('#ia').value.trim().toLowerCase(); if(e&&!/^[^\s@]+\+[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)){ toast('Use a “+” address, like yourname+family@gmail.com'); return; } if(e&&e===String(S.billEmail||'').toLowerCase()){ toast('Use a different address from the bills one'); return; } S.inboxEmail=e; save(); toast(e?'Saved. Forward an email, then tap Check now.':'Inbox turned off'); draw(); };
  const ck=m.querySelector('#ick'); if(ck) ck.onclick=async()=>{ ck.disabled=true; ck.textContent='🔄 Checking…'; const j=await helperDo('inbox_check'); toast(j?(j.speech||j.error||'Done'):'The helper didn’t answer. Try again in a minute.'); draw(); };
}
function openInbox(){
  const cut=Date.now()-45*864e5; if((S.inbox||[]).some(d=>d.at<cut)){ S.inbox=S.inbox.filter(d=>d.at>=cut); save(); }
  let setup=!S.inboxEmail;
  modal((m,close)=>{ m.classList.add('wide');
    const draw=()=>{
      const docs=(S.inbox||[]).filter(d=>d.status==='new'||d.status==='done'||d.status==='none').sort((a,b)=>(a.status==='new'?0:1)-(b.status==='new'?0:1)||b.at-a.at).slice(0,25), ih=S.inboxHelper;
      const when=it=>it.type==='event'?fmtD(kd(it.date),{weekday:'short',day:'numeric',month:'short'})+(it.time?' · '+t12(it.time):''):it.due?'by '+fmtD(kd(it.due),{weekday:'short',day:'numeric',month:'short'}):'';
      m.innerHTML=`<div class="tvhead"><h2>📥 Family inbox</h2><span><button class="cancel" id="st">⚙️ Setup</button> <button class="cancel" id="x">Close</button></span></div>
        ${setup?`<div class="rform ibset"><label>Family inbox address <small>(a “+” version of the Gmail that runs your Reminder helper, e.g. yourname+family@gmail.com. Forward anything here: the teacher’s weekly note, invitations, club newsletters, appointments. Bills sent here are passed on to Bills.)</small><input id="ia" type="email" value="${esc(S.inboxEmail||'')}" placeholder="yourname+family@gmail.com"></label><div class="row"><button class="save" id="isv">Save</button></div>
          <p class="note">The helper reads new emails once a day, at about 6am, or straight away when you tap Check now. Nothing goes on the calendar until someone taps Add. ${ih&&ih.lastRun?'Last checked '+new Date(ih.lastRun).toLocaleString()+'.':'Needs the Reminder helper on version 17 or later.'}</p></div>`:''}
        ${ih&&ih.error?`<p class="note" style="color:var(--danger)">📥 ${esc(ih.error)}</p>`:''}
        ${S.voiceUrl&&S.voiceKey&&S.inboxEmail?'<div class="row" style="margin:10px 0"><button class="cancel" id="ick">🔄 Check for new emails now</button></div>':''}
        ${docs.length?docs.map(d=>{ const its=d.items||[], open=its.filter(i=>i.state==='new');
          return `<div class="ibcard ${d.status==='new'?'':'old'}"><div class="ibtop"><b>${esc(d.sender||d.fromEmail&&d.fromEmail.from||'Email')}</b><small>${esc(d.fromEmail&&d.fromEmail.subject||'')} · ${fmtD(new Date(d.at),{day:'numeric',month:'short'})}</small></div>
            <p class="note">${esc(d.summary||'')}</p>
            ${its.map(it=>`<div class="ibit ${it.state}"><span class="ibic">${it.type==='event'?'📅':'✅'}</span><span class="ibmid"><b>${esc(it.title)}</b><small>${esc([when(it),it.note].filter(Boolean).join(' · '))}</small></span>
              ${it.state==='new'?`<select data-who="${d.id}|${it.id}" aria-label="Who">${it.type==='event'?'':'<option value="">Anyone</option>'}${S.people.filter(p=>it.type==='event'||p.id!=='all').map(p=>`<option value="${p.id}" ${p.id===(it.who||(it.type==='event'?'all':''))?'selected':''}>${esc(p.name)}</option>`).join('')}</select><button class="save" data-add="${d.id}|${it.id}">Add</button><button class="cancel" data-skip="${d.id}|${it.id}" aria-label="Skip">✕</button>`:`<small class="ibst">${it.state==='added'?'Added ✓':'Skipped'}</small>`}</div>`).join('')}
            <div class="row ibact">${open.length>1?`<button class="save" data-all="${d.id}">Add all ${open.length}</button>`:''}${d.fromEmail&&d.fromEmail.link?`<a class="cancel alink" href="${esc(d.fromEmail.link)}" target="_blank" rel="noopener">Open the email</a>`:''}${d.status==='new'?`<button class="cancel" data-done="${d.id}">Done with this one</button>`:''}</div></div>`; }).join('')
          :`<p class="note" style="margin-top:14px">${S.inboxEmail?'Nothing yet. Forward an email to <b>'+esc(S.inboxEmail)+'</b> and tap Check now. Otherwise it shows up after the 6am read.':'Set the address above to get started.'}</p>`}`;
      m.querySelector('#x').onclick=close; m.querySelector('#st').onclick=()=>{ setup=!setup; draw(); };
      const sv=m.querySelector('#isv'); if(sv) sv.onclick=()=>{ const e=m.querySelector('#ia').value.trim().toLowerCase(); if(e&&!/^[^\s@]+\+[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)){ toast('Use a “+” address, like yourname+family@gmail.com'); return; } if(e&&e===String(S.billEmail||'').toLowerCase()){ toast('Use a different address from the bills one'); return; } S.inboxEmail=e; save(); toast(e?'Saved. Forward an email, then tap Check now.':'Inbox turned off'); setup=!e; draw(); };
      const ck=m.querySelector('#ick'); if(ck) ck.onclick=async()=>{ ck.disabled=true; ck.textContent='🔄 Checking…'; const j=await helperDo('inbox_check'); toast(j?(j.speech||j.error||'Done'):'The helper didn’t answer. Try again in a minute.'); setup=false; draw(); };
      const find=k=>{ const [di,ii]=k.split('|'), d=(S.inbox||[]).find(x=>x.id===di); return [d,d&&(d.items||[]).find(i=>i.id===ii)]; };
      m.querySelectorAll('[data-who]').forEach(s=>s.onchange=()=>{ const [d,it]=find(s.dataset.who); if(it){ it.who=s.value==='all'?'':s.value; save(); } });
      m.querySelectorAll('[data-add]').forEach(b=>b.onclick=()=>{ const [d,it]=find(b.dataset.add); if(!it) return; inboxAdd(d,it); save(); renderAll(); draw(); toast(it.type==='event'?'On the calendar ✓':'On the to-do list ✓'); });
      m.querySelectorAll('[data-skip]').forEach(b=>b.onclick=()=>{ const [d,it]=find(b.dataset.skip); if(!it) return; it.state='skipped'; if(!d.items.some(i=>i.state==='new')) d.status='done'; save(); draw(); });
      m.querySelectorAll('[data-all]').forEach(b=>b.onclick=()=>{ const d=(S.inbox||[]).find(x=>x.id===b.dataset.all); if(!d) return; const n=d.items.filter(i=>i.state==='new'); n.forEach(it=>inboxAdd(d,it)); save(); renderAll(); draw(); toast(n.length+' added ✓'); });
      m.querySelectorAll('[data-done]').forEach(b=>b.onclick=()=>{ const d=(S.inbox||[]).find(x=>x.id===b.dataset.done); if(d){ d.status='done'; save(); draw(); } });
    };
    draw();
  });
}

/* ================= words in the screen's own language (3.1) =================
   English unless this screen is set to Japanese (⚙️ Settings → This device → Language). JA holds the Japanese for each
   English phrase; anything missing stays in English. */
const appLang=()=>lsGet('fs.lang','')==='ja'?'ja':'en';
const JA={};
function tr(s){ return appLang()==='ja'&&JA[s]!=null?JA[s]:s; }
Object.assign(JA,{'＋ Add anything: milk, dentist Tue 3pm…':'＋ なんでも追加：牛乳、火曜3時 歯医者…','Add anything':'なんでも追加','Say it':'押しながら話す','Photo of a list':'メモの写真','From my photos':'写真から選ぶ','Add':'追加','Undo':'元に戻す',
  'Taken off again':'取り消しました','Reading the photo…':'写真を読んでいます…','Sorting it…':'仕分けています…','Nothing to add was found.':'追加するものが見つかりませんでした。',
  'I didn’t catch that. Try again or type it.':'聞き取れませんでした。もう一度話すか、入力してください。','Voice isn’t available here. Type it instead.':'ここでは音声入力が使えません。入力してください。',
  'Reading a photo needs AI: ⚙️ Settings → Connections → ✨ AI.':'写真を読むにはAIの設定が必要です：⚙️ 設定 → 接続 → ✨ AI','That photo couldn’t be read.':'その写真は読めませんでした。',
  '＋ Add anything':'＋ なんでも追加','Close':'閉じる','by':'期限','Calendar entry form':'予定の入力画面',
  'Shopping, jobs and calendar entries, in your own words. Several at once is fine, one per line. 📷 reads a photo of a paper list.':'買い物、やること、予定を、ふだんの言葉で。1行に1つずつなら、いくつでも。📷 で紙のメモの写真を読み取ります。'});

/* ================= 2.3 one add-anything box =================
   Type it, say it, or take a photo of a paper list: "milk, eggs and bread", "Dentist Tuesday 3pm for Aria",
   "Tony: fix the gate by Friday", or a note in Japanese. The AI sorts it into calendar entries, jobs and shopping;
   without AI, simple rules do. Everything added can be undone from the same box. */
const AA_SR=window.SpeechRecognition||window.webkitSpeechRecognition;
const aiOK=()=>!LOCAL&&(!!S.aiKey||(S.aiProv==='claude'&&!!S.claudeKey)||!!(S.linkHelper&&S.linkHelper.url))||!!window.AI_TEST;
function aaPerson(name){ const k=String(name||'').trim().toLowerCase(); if(!k) return null;
  return S.people.find(p=>p.id!=='all'&&[p.name,p.nick,p.role].concat(String(p.aka||'').split(',')).some(x=>String(x||'').trim().toLowerCase()===k))||null; }
function addAnyHTML(id,big){
  return `<div class="addany${big?' big':''}" id="${id}"><div class="aarow"><input type="text" class="aain" placeholder="${esc(tr('＋ Add anything: milk, dentist Tue 3pm…'))}" enterkeyhint="done" autocomplete="off" aria-label="${esc(tr('Add anything'))}">
    ${AA_SR?`<button class="aaic aamic" aria-label="${esc(tr('Say it'))}">🎤</button>`:''}<button class="aaic aacam" aria-label="${esc(tr('Photo of a list'))}">📷</button><button class="save aago">${esc(tr('Add'))}</button></div>
    <input type="file" accept="image/*" class="aafile" hidden><input type="file" accept="image/*" capture="environment" class="aafilec" hidden><div class="aares"></div></div>`; }
function wireAddAny(box,after){
  if(!box) return; const inp=box.querySelector('.aain'), go=box.querySelector('.aago'), res=box.querySelector('.aares'), file=box.querySelector('.aafile');
  let busy=false;
  const show=(added,note)=>{ clearTimeout(box._t);
    res.innerHTML=added.length?`<div class="aadone"><span>${added.map(a=>esc(a.label)).join('<br>')}</span><button class="cancel aaundo">${esc(tr('Undo'))}</button></div>`:note?`<div class="aanote">${esc(note)}</div>`:'';
    const u=res.querySelector('.aaundo'); if(u) u.onclick=()=>{ undoAdds(added); res.innerHTML=`<div class="aanote">${esc(tr('Taken off again'))}</div>`; box._t=setTimeout(()=>res.innerHTML='',4000); if(after) after(); };
    box._t=setTimeout(()=>{ res.innerHTML=''; },added.length?20000:8000); };
  const run=async(text,photo)=>{ if(busy) return; text=String(text||'').trim(); if(!text&&!photo) { inp.focus(); return; }
    busy=true; go.disabled=true; go.textContent='…'; res.innerHTML=`<div class="aanote">${esc(photo?tr('Reading the photo…'):tr('Sorting it…'))}</div>`;
    try{ const items=await sortAdds(text,photo); const added=applyAdds(items); inp.value=''; show(added,added.length?'':tr('Nothing to add was found.')); if(after) after(); }
    catch(e){ if(e.bill){ inp.value=''; res.innerHTML=`<div class="aadone"><span>🧾 ${esc(e.message)}</span><button class="cancel" id="aaBill">Open it</button></div>`; const ob=res.querySelector('#aaBill'); if(ob) ob.onclick=()=>openBill(e.bill); if(after) after(); } else show([],e.message==='quiet'?'':e.message); }
    busy=false; go.disabled=false; go.textContent=tr('Add'); };
  go.onclick=()=>run(inp.value);
  inp.onkeydown=e=>{ if(e.key==='Enter'){ e.preventDefault(); run(inp.value); } };
  holdMic(box.querySelector('.aamic'),inp);
  const filec=box.querySelector('.aafilec'), needAI=()=>{ if(!aiOK()){ show([],tr('Reading a photo needs AI: ⚙️ Settings → Connections → ✨ AI.')); return true; } return false; };
  box.querySelector('.aacam').onclick=()=>{ if(!needAI()) photoChoice(filec,file); };
  file.onchange=filec.onchange=async e=>{ const inp=e.target, f=inp.files&&inp.files[0]; inp.value=''; if(!f) return; let data; try{ data=await fileForAI(f); }catch(x){ show([],tr('That photo couldn’t be read.')); return; } run(box.querySelector('.aain').value,data); };
}
function openAddAny(){ modal((m,close)=>{ m.innerHTML=`<div class="tvhead"><h2>${esc(tr('＋ Add anything'))}</h2><button class="cancel" id="x">${esc(tr('Close'))}</button></div>${addAnyHTML('mAdd',true)}
    <p class="note">${esc(tr('Shopping, jobs and calendar entries, in your own words. Several at once is fine, one per line. 📷 reads a photo of a paper list.'))}</p>
    <div class="row"><button class="cancel" id="aaForm">📅 ${esc(tr('Calendar entry form'))}</button></div>`;
  m.querySelector('#x').onclick=close; m.querySelector('#aaForm').onclick=()=>{ close(); openAdd(null); }; wireAddAny(m.querySelector('#mAdd'),()=>renderAll()); setTimeout(()=>{ const i=m.querySelector('.aain'); if(i) i.focus(); },80); }); }
async function sortAdds(text,photo){
  if(!aiOK()) { if(photo) throw new Error(tr('Reading a photo needs AI: ⚙️ Settings → Connections → ✨ AI.')); return addRules(text); }
  const ppl=S.people.filter(p=>p.id!=='all').map(p=>`${p.id} = ${[p.name,p.nick,p.role,p.aka].filter(Boolean).join(' / ')}`).join('; ');
  const shops=S.shops.map(s=>`${s.id} = ${s.name}`).join('; ');
  const prompt=`Sort what a family member ${photo?'wrote on the attached photo of a paper note or list'+(text?' (and typed: """'+text+'""")':''):'typed: """'+text+'"""'} into calendar entries, jobs and shopping.
People (id = names): ${ppl}. Shops (id = name): ${shops}. Today is ${dk(new Date())} (${fmtD(new Date(),{weekday:'long'})}), New Zealand.
Return JSON only: {"bill":true or false,"items":[{"type":"event|todo|shop","title":"short, in the language it was written in, without the date or time words","date":"YYYY-MM-DD or empty","time":"HH:MM (24 hour) or empty","mins":minutes or 0,"who":["person ids, or empty"],"shop":"shop id or empty"}]}
"bill" is true when the photo or text is an invoice, statement or bill to pay (power, water, rates, phone, insurance and so on); then items can be empty.
Rules: each thing to buy is its own shop item ("milk and eggs" is two). Something happening at a day and time is an event. A thing to do is a todo (date = when it is due, if said). "for Aria", "Aria's" or "Aria:" sets who. One thing for several people is ONE item with all of them in who ("Tony and Aria to Nora's at 2pm" is one event, who = both): never repeat it per person. Never translate. Leave out anything crossed out.`;
  const out=await aiAsk({prompt:withMemory(prompt,text),json:true,file:photo||undefined});
  if(out&&out.bill&&photo){ const r=await billFromFile(photo); if(r){ const e=new Error(r.msg); e.bill=r.bill; throw e; } }
  const items=Array.isArray(out)?out:(out&&out.items)||[]; return items.filter(x=>x&&x.title);
}
// without AI: today/tomorrow/weekday and "3pm" make an entry, "buy …" or a list of food makes shopping, the rest are jobs
function addRules(text){
  const out=[], WD=['sun','mon','tue','wed','thu','fri','sat'], now=new Date();
  String(text||'').split(/\n|;/).map(x=>x.trim()).filter(Boolean).forEach(line=>{
    let who=''; const a=line.match(/^([^:]{2,24}):\s*(.+)$/); if(a&&aaPerson(a[1])){ who=aaPerson(a[1]).id; line=a[2]; }
    const b=line.match(/\s+for\s+([^\s,]+)\s*$/i); if(b&&aaPerson(b[1])){ who=aaPerson(b[1]).id; line=line.slice(0,b.index); }
    const low=line.toLowerCase(); let date='', time='';
    if(/\btoday\b/.test(low)) date=dk(now); else if(/\btomorrow\b/.test(low)) date=dk(addDays(now,1));
    else { const m=low.match(/\b(sun|mon|tue|wed|thu|fri|sat)[a-z]*\b/); if(m){ let n=(WD.indexOf(m[1])-now.getDay()+7)%7; if(!n) n=7; date=dk(addDays(now,n)); } }
    const t=low.match(/\b(\d{1,2})(?:[:.](\d\d))?\s*(am|pm)\b/); if(t){ let h=+t[1]%12; if(t[3]==='pm') h+=12; time=String(h).padStart(2,'0')+':'+(t[2]||'00'); if(!date) date=dk(now); }
    const clean=line.replace(/\b(by\s+|on\s+|at\s+)?(today|tomorrow|(sun|mon|tues?|wed(nes)?|thu(rs)?|fri|sat(ur)?)(day)?)\b/ig,'').replace(/\b(at\s+)?\d{1,2}([:.]\d\d)?\s*(am|pm)\b/ig,'').replace(/\s{2,}/g,' ').replace(/[\s,.-]+$/,'').trim()||line;
    const parts=line.replace(/^(buy|get|need|pick up)\s+/i,'').split(/,|\band\b|、|と/).map(x=>x.trim()).filter(Boolean);
    if(date&&time) out.push({type:'event',title:clean,date,time,who});
    else if(!date&&(/^(buy|get|need|pick up)\s+/i.test(line)||parts.every(x=>x.length<30&&guessAisle(x)!=='Other'))) parts.forEach(x=>out.push({type:'shop',title:x}));
    else out.push({type:'todo',title:clean,date,who});
  });
  return out;
}
function applyAdds(items){
  const added=[], ok=d=>/^\d{4}-\d\d-\d\d$/.test(d||'');
  for(const it of items||[]){
    const title=String(it.title||'').trim().slice(0,110); if(!title) continue;
    const whos=[...new Set([].concat(it.who||[]).filter(w=>S.people.some(p=>p.id===w&&p.id!=='all')))], who=whos[0]||'';
    if(it.type==='shop'){ const sid=S.shops.some(s=>s.id===it.shop)?it.shop:suggestShop(title);
      const ex=S.groceries.find(x=>x.shop===sid&&x.name.toLowerCase()===title.toLowerCase());
      if(ex){ if(ex.done){ ex.done=false; added.push({k:'groceries',id:ex.id,undone:true,label:'🛒 '+ex.name+' ('+shop(sid).name+')'}); } continue; }
      const g={id:uid(),name:title.charAt(0).toUpperCase()+title.slice(1),shop:sid,aisle:shop(sid).aisles?guessAisle(title):'',done:false}; S.groceries.push(g); S.itemShop[title.toLowerCase()]=sid;
      added.push({k:'groceries',id:g.id,label:'🛒 '+g.name+' ('+shop(sid).name+')'}); }
    else if(it.type==='event'&&ok(it.date)){ const time=/^\d\d:\d\d$/.test(it.time||'')?it.time:'';
      // the same thing split per person: add them to the entry already made in this batch
      const twin=added.map(a=>a.k==='events'&&S.events.find(e=>e.id===a.id)).find(e=>e&&e.date===it.date&&(e.time||'')===time&&e.title.toLowerCase()===title.toLowerCase());
      if(twin){ for(const w of whos) if(!twin.whos.includes(w)) twin.whos=twin.whos.filter(x=>x!=='all').concat(w);
        const a=added.find(x=>x.id===twin.id); a.label=a.base+' · '+twin.whos.map(nm).join(' + '); continue; }
      const ev={id:uid(),whos:whos.length?whos:[person('all')?'all':S.people[0].id],title,addr:'',date:it.date,time,dur:time?Math.max(15,Math.min(720,+it.mins||60)):0}; S.events.push(ev);
      const base='📅 '+title+' · '+fmtD(kd(it.date),{weekday:'short',day:'numeric',month:'short'})+(time?' '+t12(time):''); added.push({k:'events',id:ev.id,base,label:base+(whos.length?' · '+whos.map(nm).join(' + '):'')}); }
    else { const t={id:uid(),title,done:false,who}; if(ok(it.date)) t.due=it.date; S.todos.push(t);
      added.push({k:'todos',id:t.id,label:'✅ '+title+(who?' · '+nm(who):'')+(t.due?' · '+tr('by')+' '+fmtD(kd(t.due),{weekday:'short',day:'numeric',month:'short'}):'')}); }
  }
  if(added.length){ save(); renderAll(); }
  return added;
}
function undoAdds(added){
  added.forEach(a=>{ const l=S[a.k]||[], i=l.findIndex(x=>x.id===a.id); if(i<0) return; if(a.undone) l[i].done=true; else l.splice(i,1); });
  save(); renderAll();
}

/* ================= 3.1 a view for each person =================
   Reyna's phone: while she is away, what's happening at home. Tony's phone: bills due and his jobs.
   Masako: a big-text, simple screen (on her phone and, with one tap, on the fridge) in Japanese or English. */
function personalCard(){
  const me=mePerson(); if(!me) return '';
  const tp=traveller(), now=new Date(), out=[];
  if(tp&&tp.id===me){ const r=travellerNow(now), away=r&&(r.air||r.a);
    const soon=S.flights.filter(f=>f.who===me&&fS(f)>now&&fS(f)-now<3*864e5).sort((a,b)=>fS(a)-fS(b))[0];
    if(away||soon){ const lines=[]; for(let i=0;i<3;i++){ const k=dk(addDays(now,i)), l=dayLines(k).filter(x=>x.k!=='away'&&x.k!=='fl').map(x=>x.k==='arr'||x.k==='taxi'?Object.assign({},x,{t:x.t.replace(/^(🛬|🚕) \D+/,'$1 ')}):x).slice(0,2); if(l.length) lines.push(`<b>${i?fmtD(addDays(now,i),{weekday:'short'}):'Today'}</b> ${l.map(x=>esc(x.t)).join(' · ')}`); }
      const jobs=S.todos.filter(t=>!t.done&&vis(t)&&t.who&&t.who!==me).length, un=typeof msgUnreadAll==='function'?msgUnreadAll():0;
      out.push(`<button class="hcard hpers" id="hPers"><div class="hhd">✈️ ${away?'While you’re away':'Before you fly'}</div>${lines.length?lines.map(x=>`<div class="hln">${x}</div>`).join(''):'<div class="hln">Nothing on at home for 3 days</div>'}<div class="hln">✅ ${jobs} job${jobs===1?'':'s'} with the others${un?' · 💬 '+un+' new message'+(un>1?'s':''):''}</div></button>`); } }
  const bills=(S.bills||[]).filter(b=>b.status==='due'&&b.due&&daysTo(b.due)<=14&&daysTo(b.due)>=-3);
  const p=person(me); if(bills.length&&p&&p.email){ const tot=bills.reduce((a,b)=>a+(+b.amount||0),0);
    out.push(`<button class="hcard hpers" id="hBills"><div class="hhd">🧾 Bills in the next 2 weeks</div>${bills.sort((a,b)=>a.due.localeCompare(b.due)).slice(0,3).map(b=>`<div class="hln">${esc(b.biller||'Bill')} · $${((+b.amount||0)/100).toFixed(2)} · ${fmtD(kd(b.due),{weekday:'short',day:'numeric',month:'short'})}${b.directDebit?' · direct debit':''}</div>`).join('')}<div class="hln"><b>$${(tot/100).toFixed(2)}</b> in all</div></button>`); }
  return out.join('');
}
function wirePersonal(){ const a=$('#hPers'); if(a) a.onclick=()=>{ const n=typeof msgUnreadAll==='function'?msgUnreadAll():0; if(n) openMsgs(); else goDay(dk(new Date())); }; const b=$('#hBills'); if(b) b.onclick=()=>openBills(); }

// the big, simple screen. fs.view = 'simple' on this device; fs.who = whose jobs it shows
Object.assign(JA,{'Settings':'設定','Calendar only':'カレンダーのみ','Alerts':'お知らせ','Turn on alerts':'お知らせをオンにする','Alerts are blocked in this phone’s settings.':'この電話の設定でお知らせが止められています。','Add Family Screen to the home screen first (Share → Add to Home Screen).':'まずホーム画面に追加してください（共有 → ホーム画面に追加）。','Alerts are on':'お知らせはオンです','Sign out':'サインアウト','Today':'今日','Tomorrow':'明日','Jobs':'やること','Shopping':'買い物','Messages':'メッセージ','Normal screen':'ふつうの画面','Nothing on':'予定はありません','Nothing to do':'やることはありません',
  'Nothing to buy':'買うものはありません','All day':'終日','Everyone':'みんな','new':'件 新着','Tap to tick it off':'タップで完了','Big and simple screen':'大きな文字のかんたん画面','Language':'言語',
  'Whose screen is this?':'だれの画面ですか？','English':'English','Ticked off':'完了しました','Undo':'元に戻す'});
const simpleOn=()=>lsGet('fs.view','')==='simple';
function setView(v,who,lang){ lsSet('fs.view',v||''); if(who!=null) lsSet('fs.who',who); if(lang) setLang(lang); renderSimple(); renderAll(); }
function setLang(l){ lsSet('fs.lang',l==='ja'?'ja':''); const h=typeof myPush==='function'&&myPush(); if(h&&SYNC.setDeviceLang) SYNC.setDeviceLang(h,l==='ja'?'ja':'').catch(()=>{}); document.documentElement.lang=l==='ja'?'ja':'en'; }
function jaDate(d){ return appLang()==='ja'?(d.getMonth()+1)+'月'+d.getDate()+'日（'+'日月火水木金土'[d.getDay()]+'）':fmtD(d,{weekday:'long',day:'numeric',month:'long'}); }
function jaTime(t){ if(!t) return tr('All day'); if(appLang()!=='ja') return t12(t); const [h,m]=t.split(':').map(Number); return (h<12?'午前':'午後')+((h%12)||12)+'時'+(m?m+'分':''); }
function renderSimple(){
  let el=document.getElementById('simple');
  if(!simpleOn()||!S.people.length){ if(el) el.remove(); document.body.classList.remove('simple'); return; }
  if(!el){ el=document.createElement('div'); el.id='simple'; document.body.appendChild(el); }
  document.body.classList.add('simple');
  const typing=el.querySelector('#sAdd'); if(typing) typing.remove();
  const now=new Date(), who=lsGet('fs.who','')||mePerson();
  const day=(d)=>{ const its=itemsForDay(dk(d)).filter(it=>it.k==='ev').sort((a,b)=>String(a.sort||'').localeCompare(String(b.sort||'')));
    return its.length?its.slice(0,8).map(it=>{ const e=it.e, ws=(e.whos||[]).filter(w=>w!=='all').map(nm).join('・'); return `<div class="sline" style="border-left-color:${col((e.whos||[])[0])}"><span class="stime">${esc(jaTime(e.time))}</span> ${esc(e.title||'')}${ws?`<small> ${esc(ws)}</small>`:''}</div>`; }).join(''):`<div class="snone">${esc(tr('Nothing on'))}</div>`; };
  const jobs=S.todos.filter(t=>!t.done&&vis(t)&&(!who||!t.who||t.who===who)).slice(0,10);
  const buy=S.groceries.filter(x=>!x.done).slice(0,14), un=typeof msgUnreadAll==='function'?msgUnreadAll():0;
  el.innerHTML=`<div class="shead"><div><div class="sdate">${esc(jaDate(now))}</div>${who?`<div class="swho">${esc(nm(who))}</div>`:''}</div>
      <div class="sbtns"><button class="sbtn" id="sLang">${appLang()==='ja'?'English':'日本語'}</button><button class="sbtn" id="sMsg">✉️ ${esc(tr('Messages'))}${un?` <b class="sbadge">${un}</b>`:''}</button><button class="sbtn" id="sNormal">${esc(tr('Normal screen'))}</button></div></div>
    <div id="sAddSlot"></div>
    <div class="sgrid"><section><h3>${esc(tr('Today'))}</h3>${day(now)}<h3>${esc(tr('Tomorrow'))}</h3>${day(addDays(now,1))}</section>
    <section class="sjobs"><h3>${esc(tr('Jobs'))}</h3>${jobs.length?jobs.map(t=>`<button class="stick" data-st="todos:${t.id}"><span class="sbox"></span>${esc(t.title)}${t.due?`<small> ${esc(appLang()==='ja'?(kd(t.due).getMonth()+1)+'/'+kd(t.due).getDate():fmtD(kd(t.due),{day:'numeric',month:'short'}))}</small>`:''}</button>`).join(''):`<div class="snone">${esc(tr('Nothing to do'))}</div>`}
      <h3 class="sshop">${esc(tr('Shopping'))}</h3><div class="sshop">${buy.length?buy.map(g=>`<button class="stick" data-st="groceries:${g.id}"><span class="sbox"></span>${esc(g.name)}<small> ${esc(shop(g.shop)?shop(g.shop).name:'')}</small></button>`).join(''):`<div class="snone">${esc(tr('Nothing to buy'))}</div>`}</div></section></div>`;
  const slot=el.querySelector('#sAddSlot'); if(typing) slot.replaceWith(typing); else { slot.outerHTML=addAnyHTML('sAdd',true); wireAddAny(el.querySelector('#sAdd')); }
  el.querySelector('#sLang').onclick=()=>{ setLang(appLang()==='ja'?'en':'ja'); const b=el.querySelector('#sAdd'); if(b) b.remove(); renderSimple(); };
  el.querySelector('#sNormal').onclick=()=>setView('');
  el.querySelector('#sMsg').onclick=()=>openMsgs();
  el.querySelectorAll('[data-st]').forEach(b=>b.onclick=()=>{ const [k,id]=b.dataset.st.split(':'), x=(S[k]||[]).find(y=>y.id===id); if(!x) return; x.done=true; save(); renderAll(); renderSimple();
    toastUndo(tr('Ticked off')+': '+(x.title||x.name),()=>{ x.done=false; save(); renderAll(); renderSimple(); }); });
}
function toastUndo(text,undo){ let t=document.getElementById('sToast'); if(!t){ t=document.createElement('div'); t.id='sToast'; document.body.appendChild(t); }
  t.innerHTML=`<span>${esc(text)}</span><button>${esc(tr('Undo'))}</button>`; t.className='on'; t.querySelector('button').onclick=()=>{ undo(); t.className=''; }; clearTimeout(t._t); t._t=setTimeout(()=>t.className='',6000); }

// choosing the big and simple screen: whose it is, and the language (Masako: 日本語)
function openSimplePick(){ modal((m,close)=>{ let lang=appLang(), who=lsGet('fs.who','')||mePerson();
  const draw=()=>{ m.innerHTML=`<h2>👵 ${esc(tr('Big and simple screen'))}</h2><p class="note">Today, tomorrow, jobs and shopping in big writing, with the add-anything box. On the fridge, “Normal screen” at the top goes back.</p>
    <div class="step">${esc(tr('Whose screen is this?'))}</div><div class="opts">${eaters().map(p=>`<button class="opt ${who===p.id?'on':''}" data-w="${p.id}">${esc(p.name)}</button>`).join('')}</div>
    <div class="step">${esc(tr('Language'))}</div><div class="opts"><button class="opt ${lang==='ja'?'on':''}" data-l="ja">日本語</button><button class="opt ${lang!=='ja'?'on':''}" data-l="en">English</button></div>
    <div class="mact"><button class="cancel" id="x">Cancel</button><button class="save" id="ok">Show it</button></div>`;
    m.querySelectorAll('[data-w]').forEach(b=>b.onclick=()=>{ who=b.dataset.w; const p=person(who); if(p&&/machan|obachan|masako/i.test([p.name,p.role,p.aka].join(' '))) lang='ja'; draw(); });
    m.querySelectorAll('[data-l]').forEach(b=>b.onclick=()=>{ lang=b.dataset.l; draw(); });
    m.querySelector('#x').onclick=close; m.querySelector('#ok').onclick=()=>{ close(); setView('simple',who,lang); }; };
  draw(); }); }

/* ================= 3.4 the fridge as the family hub =================
   On the fridge (not phones): the screen stays on; after 3 minutes untouched it closes what was open and goes back to
   Today; from 9pm to 6am, after 5 minutes untouched, a photo frame with the clock and what's next. A touch wakes it.
   Photos come from a Google Drive folder through the Reminder helper (⚙️ Settings → This device), kept on the screen. */
let hubIdle=Date.now(), hubLock=null, hubHome=true;
const hubOn=()=>!isPhone()&&!LOCAL&&S.people.length&&lsGet('fs.hub','1')==='1';
let saverSwallow=0;
// fridge: hide the tablet's top bar by going full screen (Android only allows it on a touch, so the first touch does it)
const hubFull=()=>lsGet('fs.hubFull','1')==='1';
addEventListener('click',()=>{ try{ if(hubOn()&&hubFull()&&!document.fullscreenElement&&document.documentElement.requestFullscreen) document.documentElement.requestFullscreen({navigationUI:'hide'}).catch(()=>{}); }catch(e){} },true);
function themeDark(on){ const m=document.querySelector('meta[name=theme-color]'); if(!m) return; if(!m.dataset.day) m.dataset.day=m.content; m.content=on?'#000000':m.dataset.day; }
addEventListener('click',e=>{ if(Date.now()<saverSwallow){ e.preventDefault(); e.stopPropagation(); } },true);
function hubTouch(e){ hubIdle=Date.now(); hubHome=false; if(document.getElementById('saver')){ saverOff(); saverSwallow=Date.now()+700; try{ if(document.querySelector('.scrim')) closeModal(); const t=document.getElementById('todayBtn'); if(t) t.click(); }catch(x){} } }
['pointerdown','keydown','wheel','touchstart'].forEach(e=>addEventListener(e,hubTouch,{passive:true,capture:true}));
async function hubWake(){ if(!hubOn()||!('wakeLock' in navigator)||document.visibilityState!=='visible') return; try{ if(!hubLock||hubLock.released) hubLock=await navigator.wakeLock.request('screen'); }catch(e){} }
document.addEventListener('visibilitychange',()=>{ if(document.visibilityState==='visible') hubWake(); });
function hubTick(){
  if(!hubOn()) return; hubWake(); const idle=Date.now()-hubIdle, h=new Date().getHours();
  if(idle>3*60e3&&!hubHome){ hubHome=true; try{ if(document.querySelector('.scrim')&&!document.querySelector('.aibusy')) closeModal(); const t=document.getElementById('todayBtn'); if(t) t.click(); }catch(e){} }
  if(idle>saverIdle()*60e3&&!document.getElementById('saver')) saverOn();
}
// this screen's photo-frame times (kept on the device): photos between From and To, a dim clock the rest of the time
const saverIdle=()=>Math.max(1,+lsGet('fs.svIdle','5')||5), saverFrom=()=>lsGet('fs.svFrom','06:00')||'06:00', saverTo=()=>lsGet('fs.svTo','21:00')||'21:00';
function saverPhotosNow(d){ const t=String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0'), f=saverFrom(), u=saverTo();
  return f<=u?(t>=f&&t<u):(t>=f||t<u); }
setInterval(hubTick,30e3);
// someone added photos on another device: fetch them within a couple of minutes (fridge and computers; phones when the album opens)
let photoPullAt=0;
async function photoPull(){ if(!S.voiceUrl||!navigator.onLine||isPhone()) return; const rev=+S.photoRev||0, have=+lsGet('fs.photosAt',0)||0;
  const empty=(S.photoFolder||rev)&&!(await saverPhotos()).length;   // this screen lost its copy (or never had one): get them again
  if((rev>have||empty)&&Date.now()-photoPullAt>(empty?600e3:120e3)){ photoPullAt=Date.now(); saverFetch(); } }
setTimeout(photoPull,15e3);
setInterval(photoPull,60e3);
let saverT=null, saverI=0;
async function saverPhotos(){ try{ const c=await caches.open('fs-photos'), r=await c.match('list'); return r?await r.json():[]; }catch(e){ return []; } }
async function saverOn(){ themeDark(true);
  const el=document.createElement('div'); el.id='saver'; document.body.appendChild(el);
  const pics=await saverPhotos(); let urls=[];
  try{ const c=await caches.open('fs-photos'); for(const k of pics.slice(0,150)){ const r=await c.match('p/'+k); if(r) urls.push(URL.createObjectURL(await r.blob())); } }catch(e){}
  const draw=()=>{ if(!document.getElementById('saver')) return; const now=new Date(), t=now.toLocaleTimeString('en-NZ',{hour:'numeric',minute:'2-digit'});
    const tk=dk(now), hh=String(now.getHours()).padStart(2,'0')+':'+String(now.getMinutes()).padStart(2,'0');
    const nxIt=[tk,dk(addDays(now,1))].flatMap(k=>itemsForDay(k).filter(it=>it.k==='ev').map(it=>({e:it.e,day:k,t:it.e.time||''})).sort((a,b)=>a.t.localeCompare(b.t)))
      .filter(x=>x.day!==tk||(x.t&&x.t>hh))[0], nx=nxIt&&Object.assign({},nxIt.e,{date:nxIt.day});
    const tp=typeof traveller==='function'&&traveller(), r=tp&&typeof travellerNow==='function'?travellerNow(now):null;
    let away=''; if(r&&r.air) away=`✈️ ${tName(tp)} flying to ${r.a?r.a[0]:''} · lands ${relTime(fE(r.air),now)}`;
      else if(r&&r.a){ const lt=hm(now,r.a[1]); away=`${r.a[3]||'📍'} ${tName(tp)} in ${r.a[0]} · ${lt.txt}${lt.ap||''} there`; }
    if(!saverPhotosNow(now)){ el.className='night'; el.innerHTML=`<div class="sv-clock" style="transform:translate(${Math.round(Math.random()*60-30)}px,${Math.round(Math.random()*60-30)}px)"><div>${esc(t)}${away?`<div class="sv-away">${esc(away)}</div>`:''}</div></div>`; return; }
    el.className=''; const u=urls.length?urls[saverI++%urls.length]:'';
    el.innerHTML=`${u?`<img src="${u}" alt="">`:''}<div class="sv-info"><div class="sv-time">${esc(t)}</div><div class="sv-date">${esc(jaDate(now))}</div>${away?`<div class="sv-next">${esc(away)}</div>`:''}${nx?`<div class="sv-next">${esc((nx.date===dk(now)?tr('Today'):tr('Tomorrow'))+' · '+(nx.time?jaTime(nx.time)+' ':'')+(nx.title||''))}</div>`:''}</div>`; };
  draw(); clearInterval(saverT); saverT=setInterval(draw,20e3);
  if(navigator.onLine&&S.voiceUrl&&Date.now()-(+lsGet('fs.photosAt',0)||0)>20*3600e3) saverFetch();
}
function saverOff(){ themeDark(false); clearInterval(saverT); const el=document.getElementById('saver'); if(el){ el.querySelectorAll('img').forEach(i=>{ try{ URL.revokeObjectURL(i.src); }catch(e){} }); el.remove(); } }
// the photo frame's pictures: up to 150 from the family's Drive folder, fetched through the helper and kept on this screen
async function saverFetch(force){
  if(!S.voiceUrl) return 0; lsSet('fs.photosAt',String(Date.now()));
  const c=await caches.open('fs-photos'), keys=[]; let n=0;
  for(let page=0;page<15;page++){ const j=await helperDo('photos',{folder:S.photoFolder,page}); if(!j||!j.photos) break;
    for(const p of j.photos){ try{ if(!(await c.match('p/'+p.id))){ const bin=Uint8Array.from(atob(p.data),ch=>ch.charCodeAt(0)); await c.put('p/'+p.id,new Response(new Blob([bin],{type:p.mime||'image/jpeg'}))); } keys.push(p.id); n++; }catch(e){} }
    if(!j.more) break; }
  if(keys.length){ const old=await saverPhotos(); for(const k of old) if(!keys.includes(k)) try{ await c.delete('p/'+k); }catch(e){}
    await c.put('list',new Response(JSON.stringify(keys),{headers:{'Content-Type':'application/json'}})); }
  if(force) toast(n?n+' photos ready for the night-time photo frame':'No photos found in that folder');
  return n;
}

/* ================= 3.5 documents vault (insurance first) =================
   Photograph or upload a policy: the AI pulls out who it's with, what it covers, the excess, when it renews and who to
   call. The file itself goes to a "Family Screen documents" folder in the helper's Google Drive; the summary lives here.
   "Who do we call?" lists every claims line; "Check for overlaps" asks the AI where cover doubles up or is missing. */
const DOC_KINDS=[['🚗','Car'],['🏠','House'],['🛋️','Contents'],['❤️','Health'],['✈️','Travel'],['🛡️','Life'],['🐾','Pet'],['📄','Other']];
function openVault(){ modal((m,close)=>{ m.classList.add('wide'); let busy=false;
  const draw=()=>{ const ds=(S.docs||[]).slice().sort((a,b)=>String(a.kind).localeCompare(String(b.kind))||String(a.title).localeCompare(String(b.title)));
    m.innerHTML=`<div class="tvhead"><h2>📁 Documents</h2><button class="cancel" id="x">Close</button></div>
    <div class="row" style="gap:8px;flex-wrap:wrap"><button class="save" id="vAdd" style="border-radius:14px;padding:12px 18px">＋ Add a policy or document</button><button class="xbtn" id="vCall">📞 Who do we call?</button>${ds.length>1?'<button class="xbtn" id="vOver">🔍 Check for overlaps and gaps</button>':''}</div>
    <input type="file" id="vFile" accept="image/*,application/pdf" hidden><div id="vOut"></div>
    ${ds.length?ds.map(d=>{ const k=DOC_KINDS.find(x=>x[1]===d.kind)||DOC_KINDS[7]; return `<div class="srccard" style="margin:10px 0"><h4>${k[0]} ${esc(d.title||d.kind)}${d.insurer?' · '+esc(d.insurer):''}</h4>
      ${d.summary?`<p class="note">${esc(d.summary)}</p>`:''}
      <div class="note">${[d.covers?'<b>Covers:</b> '+esc(d.covers):'',d.excess?'<b>Excess:</b> '+esc(d.excess):'',d.premium?'<b>Costs:</b> '+esc(d.premium):'',d.renews?'<b>Renews:</b> '+fmtD(kd(d.renews),{day:'numeric',month:'long',year:'numeric'}):'',d.policyNo?'<b>Policy number:</b> '+esc(d.policyNo):''].filter(Boolean).join('<br>')}</div>
      <div class="row" style="gap:8px;margin-top:6px">${d.claimsPhone?`<a class="xbtn" href="tel:${esc(String(d.claimsPhone).replace(/[^+\d]/g,''))}">📞 Claims ${esc(d.claimsPhone)}</a>`:''}${d.link?`<a class="xbtn" href="${esc(d.link)}" target="_blank" rel="noopener">📄 Open the document</a>`:''}<button class="cancel" data-vdel="${d.id}">Delete</button></div></div>`; }).join(''):'<p class="note" style="margin-top:12px">Nothing here yet. Start with the insurance policies: car, house, contents, health, travel.</p>'}`;
    m.querySelector('#x').onclick=close;
    const f=m.querySelector('#vFile'); m.querySelector('#vAdd').onclick=()=>{ if(!aiOK()){ toast('Reading documents needs AI: ⚙️ Settings → Connections → ✨ AI'); return; } f.click(); };
    f.onchange=async()=>{ const file=f.files&&f.files[0]; f.value=''; if(!file||busy) return; busy=true; await vaultAdd(file); busy=false; draw(); };
    m.querySelector('#vCall').onclick=()=>{ const ds2=(S.docs||[]).filter(d=>d.claimsPhone||d.emergencyPhone);
      m.querySelector('#vOut').innerHTML=`<div class="hlth" style="margin-top:10px"><h4>📞 Who do we call?</h4>${ds2.length?ds2.map(d=>`<div class="hlrow"><span class="hlmid"><b>${esc((DOC_KINDS.find(x=>x[1]===d.kind)||DOC_KINDS[7])[0]+' '+(d.title||d.kind))}</b><small>${esc(d.insurer||'')}${d.policyNo?' · policy '+esc(d.policyNo):''}${d.when?' · '+esc(d.when):''}</small></span>${[d.claimsPhone,d.emergencyPhone].filter(Boolean).map(ph=>`<a class="xbtn" href="tel:${esc(String(ph).replace(/[^+\d]/g,''))}">${esc(ph)}</a>`).join('')}</div>`).join(''):'<p class="note">No phone numbers found in the documents yet.</p>'}<p class="note">Emergency: 111.</p></div>`; };
    const ov=m.querySelector('#vOver'); if(ov) ov.onclick=async()=>{ ov.disabled=true; const out=m.querySelector('#vOut'); out.innerHTML='<p class="note">Comparing the policies…</p>';
      try{ const j=await aiAsk({json:true,prompt:withMemory(`These are a New Zealand family's insurance policies (summaries). Find cover that doubles up (paying twice for the same thing), important gaps, and anything worth checking at renewal. Plain words, short. Return JSON only: {"overlaps":["…"],"gaps":["…"],"check":["…"]}
${JSON.stringify((S.docs||[]).map(d=>({kind:d.kind,title:d.title,insurer:d.insurer,covers:d.covers,excess:d.excess,premium:d.premium,renews:d.renews,summary:d.summary})))}`)});
        const li=(t,a)=>a&&a.length?`<h4 style="margin:8px 0 2px">${t}</h4><ul class="note" style="margin:0 0 0 18px">${a.map(x=>'<li>'+esc(x)+'</li>').join('')}</ul>`:'';
        out.innerHTML=`<div class="hlth warn" style="margin-top:10px">${li('Doubling up',j.overlaps)}${li('Gaps',j.gaps)}${li('Worth checking',j.check)||''}${!(j.overlaps||[]).length&&!(j.gaps||[]).length?'<p class="note">No overlaps or gaps found.</p>':''}<p class="note">A starting point, not advice: check with the insurer before changing cover.</p></div>`; }
      catch(e){ out.innerHTML=e.message==='quiet'?'':`<p class="note">${esc(e.message)}</p>`; } ov.disabled=false; };
    m.querySelectorAll('[data-vdel]').forEach(b=>b.onclick=()=>{ const d=(S.docs||[]).find(x=>x.id===b.dataset.vdel); if(!d) return; S.docs=S.docs.filter(x=>x.id!==d.id); save(); draw(); toastUndo('Deleted '+(d.title||'document'),()=>{ S.docs.push(d); save(); draw(); }); });
  }; draw(); }); }
async function vaultAdd(file){
  const done=aiBusy('Reading the document…'); let d=null;
  try{ const data=await fileForAI(file);
    const j=await aiAsk({json:true,file:data,prompt:`Read this New Zealand family document (usually an insurance policy or schedule). Return JSON only:
{"kind":"${DOC_KINDS.map(k=>k[1]).join('|')}","title":"short, e.g. Mazda car insurance","insurer":"","policyNo":"","covers":"one or two short sentences","excess":"","premium":"e.g. $84.20 a month","renews":"YYYY-MM-DD or empty","claimsPhone":"","emergencyPhone":"","when":"when to call, a few words","summary":"two sentences in plain words"}`});
    d={id:uid(),kind:DOC_KINDS.some(k=>k[1]===j.kind)?j.kind:'Other',at:Date.now(),fileName:file.name};
    ['title','insurer','policyNo','covers','excess','premium','claimsPhone','emergencyPhone','when','summary'].forEach(k=>{ if(j[k]) d[k]=String(j[k]).slice(0,400); });
    if(/^\d{4}-\d\d-\d\d$/.test(j.renews||'')) d.renews=j.renews;
    if(file.size<9e6&&S.voiceUrl){ const r=await helperDo('doc_save',{name:(d.title||file.name)+' '+dk(new Date()),mime:file.type||'application/pdf',data:await new Promise(res=>{ const fr=new FileReader(); fr.onload=()=>res(String(fr.result).split(',')[1]); fr.readAsDataURL(file); })}); if(r&&r.url) d.link=r.url; }
    S.docs=S.docs||[]; S.docs.push(d);
    if(d.renews&&!(S.renewals||[]).some(r=>r.due===d.renews&&r.item===d.title)){ S.renewals=S.renewals||[]; S.renewals.push({id:uid(),what:'Insurance',emoji:'🛡️',item:d.title||d.kind,due:d.renews,every:12,cost:d.premium||'',ref:d.policyNo||'',notes:d.insurer||''}); }
    save(); renderAll(); toast('Saved: '+(d.title||'document')+(d.renews?' (renewal added to 📌 Renewals)':''));
  }catch(e){ if(e.message!=='quiet') toast('Couldn’t read that: '+e.message); }
  done(); return d;
}

/* ================= Kitchen stock and "What can we make?" =================
   The hard part of dinner is knowing what's in the deep freezer and fridge. Two ways in:
   - On the fly: a couple of photos of the fridge and freezer → the AI writes dinners from what it sees and lists the gaps.
   - Kitchen stock: a kept list (deep freezer, fridge, pantry) plus a sauce shelf of staples; dinners use the oldest first.
   A planned dinner's ingredients are assumed used once it has been cooked (8pm that day), with "put back" for mistakes. */
const FOOD_DEFAULT='We like Japanese, Mexican and Kiwi food. Paleo-style: meat, fish, eggs, vegetables; minimal gluten (tamari instead of soy sauce, corn tortillas). About once a month a homemade sourdough or fresh pizza night is welcome.';
const foodPrefs=()=>String(S.food||FOOD_DEFAULT);
/* What the family has picked and turned down, kept with the family (last 40) and given to the AI with every dinner
   question, so ideas drift towards what you actually cook. The AI itself isn't retrained: this is its notebook. */
function foodNote(kind,name){ S.foodLog=(S.foodLog||[]).filter(x=>!(x.n===name&&x.k===kind)).concat([{k:kind,n:String(name).slice(0,60),at:Date.now()}]).slice(-40); save(); }
function foodHistory(){ const l=S.foodLog||[], p=l.filter(x=>x.k==='pick').map(x=>x.n), n=l.filter(x=>x.k==='no').map(x=>x.n);
  return (p.length?'Dinners they chose recently (cook more like these): '+p.slice(-20).join('; ')+'. ':'')+(n.length?'Dinners they turned down (avoid these and anything like them): '+n.slice(-20).join('; ')+'.':''); }
const STOCK_PLACES=[['freezer','🧊','Deep freezer'],['fridge','🥬','Fridge'],['pantry','🥫','Pantry']];
const SAUCES=[['Japanese',['Tamari or coconut aminos','Mirin','Rice vinegar','Toasted sesame oil','Miso paste','Dashi powder','Fresh ginger','Kewpie mayo']],
  ['Mexican',['Chipotle in adobo','Ground cumin','Smoked paprika','Dried oregano','Limes','Tinned tomatoes','Salsa verde','Corn tortillas']],
  ['Kiwi',['Dijon mustard','Wholegrain mustard','Tomato paste','Stock','Balsamic vinegar','Honey','Worcestershire sauce (gluten-free)']],
  ['Everyday',['Garlic','Fish sauce','Coconut milk','Olive oil','Avocado oil']]];
const stockNow=()=>(S.stock||[]).filter(x=>x.where!=='sauce'&&!x.used);
const sauceShelf=()=>(S.stock||[]).filter(x=>x.where==='sauce');
const stockAge=x=>{ const d=Math.floor((Date.now()-(x.at||Date.now()))/864e5); return d<7?'':d<60?Math.floor(d/7)+' wk':Math.floor(d/30)+' mth'; };
function stockAdd(items,where){ let n=0; S.stock=S.stock||[];
  for(const it of items||[]){ const name=String(it.name||'').trim().slice(0,60); if(!name) continue; const w=STOCK_PLACES.some(p=>p[0]===it.where)?it.where:(where||'fridge');
    const ex=S.stock.find(x=>!x.used&&x.where===w&&x.name.toLowerCase()===name.toLowerCase());
    if(ex){ if(it.qty) ex.qty=String(it.qty).slice(0,30); continue; }
    S.stock.push({id:uid(),name:name.charAt(0).toUpperCase()+name.slice(1),qty:String(it.qty||'').slice(0,30),where:w,at:Date.now()}); n++; }
  if(n) save(); return n; }
// dinners that have been cooked use up what they were planned from; week-old "used" lines are forgotten
function stockSettle(){ const today=dk(new Date()), late=new Date().getHours()>=20; let ch=false;
  (S.meals||[]).forEach(m=>{ if(m.uses&&m.uses.length&&!m.settled&&(m.date<today||(m.date===today&&late))){ m.settled=true; ch=true; (S.stock||[]).forEach(x=>{ if(m.uses.includes(x.id)&&!x.used) x.used=Date.now(); }); } });
  const n=(S.stock||[]).length; S.stock=(S.stock||[]).filter(x=>!x.used||Date.now()-x.used<7*864e5); if(S.stock.length!==n) ch=true;
  if(ch) save(); }
setInterval(()=>{ try{ if(S.people.length) stockSettle(); }catch(e){} },30*60e3);
function buyAdd(names){ let n=0; for(const raw of names||[]){ const name=String(raw||'').trim(); if(!name) continue;
    if(S.groceries.some(g=>!g.done&&g.name.toLowerCase().startsWith(name.toLowerCase()))) continue; const sid=suggestShop(name);
    S.groceries.push({id:uid(),name:name.charAt(0).toUpperCase()+name.slice(1),shop:sid,aisle:shop(sid).aisles?guessAisle(name):'',done:false,meal:true}); n++; }
  if(n) save(); return n; }
// reading photos or a typed list into stock items
async function stockRead(files,text,where){
  if(!aiOK()){ if(files&&files.length) throw new Error('Reading a photo needs AI: ⚙️ Settings → Connections → ✨ AI.'); return String(text||'').split(/\n|,|;|、/).map(x=>({name:x.trim(),where})).filter(x=>x.name); }
  const j=await aiAsk({json:true,files,file:files&&files[0],prompt:`List the food a New Zealand family has, from ${files&&files.length?'the attached photo(s) of their freezer, fridge, pantry or a handwritten list':'this typed list'}${text?': """'+String(text).slice(0,4000)+'"""':''}.
Return JSON only: {"items":[{"name":"short everyday name, e.g. chicken thighs","qty":"number then unit, e.g. 2 pack, 500 g, 1.5 kg, 6 each; empty if not said","where":"freezer|fridge|pantry"}]}
Only what you can actually see or read; no guesses about what is hidden. ${where?'Unless it is obvious otherwise, these are in the '+where+'.':''} Skip condiments and drinks unless they matter for cooking.`});
  return (j.items||[]).filter(x=>x&&x.name);
}
async function dinnerIdeas(o){ const M=o.meal||'dinner';
  const stock=o.useStock?stockNow().slice().sort((a,b)=>(a.at||0)-(b.at||0)):[], sh=sauceShelf(), people=o.people||Math.max(1,homeOn(dk(new Date())).length);
  const prompt=`You are helping a New Zealand family (Auckland) decide ${M} from what they ALREADY have, so nothing in the freezer or fridge is wasted.
Their tastes: ${foodPrefs()}
${foodHistory()}
${kitchenKnowledge()}
${o.files&&o.files.length?'Attached: '+o.files.length+' photo(s) of their fridge, freezer or pantry, taken just now. Work from what you can actually see.':''}
${stock.length?'Their kitchen stock list (oldest first; use the oldest and the frozen things first): '+stock.map(x=>x.name+(x.qty?' ('+x.qty+')':'')+' ['+x.where+(stockAge(x)?', '+stockAge(x)+' old':'')+']').join('; ')+'.':''}
${sh.length?'Sauces and staples in the house: '+sh.filter(x=>!x.out).map(x=>x.name).join(', ')+'.'+(sh.some(x=>x.out)?' Run out of: '+sh.filter(x=>x.out).map(x=>x.name).join(', ')+'.':''):''}
${o.text?'They also said: """'+String(o.text).slice(0,600)+'""".':''}
${(()=>{ const mine=(S.recipes||[]).filter(r=>(r.meal||'dinner')===(o.meal||'dinner')).sort((a,b)=>isFav(b.id)-isFav(a.id)).slice(0,40);
  return mine.length?'Their own saved recipes (⭐ = favourite), with main ingredients: '+mine.map(r=>(isFav(r.id)?'⭐ ':'')+r.name+' ['+(r.ing||[]).filter(i=>i[3]!=='p').slice(0,6).map(i=>i[2]).join(', ')+']').join('; ')+'. If any of their own recipes can be made mostly from what they have, make it one of the three (favourites first), using its exact name and "saved":true; the others are new ideas.':''; })()}
Suggest 3 different ${M==='lunch'?'lunches':M+'s'} for ${people} people.${o.meal==='lunch'?' Lunch: quick (under 20 minutes), light, good for home or a lunchbox.':o.meal==='breakfast'?' Breakfast: quick and simple.':''} Each must be built mainly from what they have, need at most 2 things from the supermarket (none is best), and fit their tastes. Salt, pepper and cooking oil can be assumed; nothing else can.
Return JSON only: {"seen":[{"name":"...","qty":"","where":"freezer|fridge|pantry"}],"recipes":[ 3 objects shaped like ${RECIPE_SHAPE} plus "uses":["the things they have that it uses, named exactly as in the stock list or as seen"],"buy":["each thing they would need to buy, or empty list"],"thaw":"what to take out of the freezer and when, or empty" ]} with "serves": ${people}.
"seen" lists what you could see in the photos (empty list when there are no photos). ${RECIPE_RULES}`;
  const out=await aiAsk({prompt:withMemory(prompt,o.text||M),json:true,files:o.files,file:o.files&&o.files[0]});
  const own=n=>(S.recipes||[]).find(r=>r.name.trim().toLowerCase()===String(n||'').trim().toLowerCase());
  const rs=(out.recipes||[]).map(raw=>{ const sv=raw.saved&&own(raw.name), r=sv?Object.assign(JSON.parse(JSON.stringify(sv)),{serves:sv.serves||people,yours:true}):cleanRecipe(raw); r.uses=(raw.uses||[]).map(String).slice(0,20); r.buy=(raw.buy||[]).map(String).filter(Boolean).slice(0,6); r.thaw=String(raw.thaw||'').slice(0,140); return r; }).filter(r=>r.ing.length&&r.steps.length);
  if(!rs.length) throw new Error('No ideas came back. Try again.');
  return {recipes:rs,seen:(out.seen||[]).filter(x=>x&&x.name).slice(0,60)};
}
/* ================= 4.2 Meal planning knowledge, the ideas board and planning 8 days at a time =================
   Knowledge the AI is given with every meal question:
   - "How we like to eat" (typed by the family) and the kitchen profile (written by the AI from the stock list, the saved
     recipes and what has been picked, then editable), so it knows what this family actually cooks with;
   - what's in season in New Zealand this month, and thawing rules for the freezer.
   Every idea the AI comes up with goes on the ideas board, which is kept (with the family) until it's used or cleared.
   Each idea can be put on any of the next 8 days, as breakfast, lunch or dinner, without leaving the board. */
const NZ_SEASON=['stone fruit, berries, sweetcorn, tomatoes, courgettes, beans, lettuce, new potatoes','plums, nectarines, sweetcorn, tomatoes, capsicum, eggplant, courgettes, beans','apples, pears, feijoas (late), pumpkin, kūmara, capsicum, tomatoes, corn','feijoas, apples, pears, kiwifruit, pumpkin, kūmara, cauliflower, broccoli, mushrooms','kiwifruit, mandarins, feijoas, pumpkin, kūmara, cabbage, cauliflower, leeks, silverbeet','citrus, kiwifruit, cabbage, leeks, cauliflower, broccoli, parsnips, kūmara','citrus, kiwifruit, cabbage, leeks, parsnips, swede, silverbeet, kale','citrus, kiwifruit, leeks, cabbage, broccoli, spinach, kale, parsnips','asparagus, spinach, citrus, broccoli, silverbeet, spring onions, kale','asparagus, strawberries, new potatoes, spinach, lettuce, broad beans, peas','strawberries, cherries (late), new potatoes, asparagus, lettuce, peas, courgettes, beans','cherries, berries, stone fruit, new potatoes, sweetcorn, tomatoes, courgettes, beans, lettuce'];
function kitchenKnowledge(){ const mo=new Date().getMonth();
  return `In season in New Zealand this month (cheapest and best): ${NZ_SEASON[mo]}.
Reading the stock list: it was built from photos and voice, so expect duplicates (chicken thigh and chicken thighs, mince and beef mince), odd amounts (a kilo-plus of minced garlic or almond flour is probably a misread) and typos. Treat near-duplicates as one item and never plan a meal around an amount that looks wrong. Ignore snacks, lollies, protein balls, supplements, powders, drinks and desserts when planning meals. Curry roux blocks, seasoning mixes, slow cooker mixes and pasta sauces are ready-made cooking bases: great for an easy weeknight, but don't use more than one or two a week. Aim to use the freezer proteins first (mutton and lamb chops, ribs, brisket, salmon, whole chickens, mince), and use fridge vegetables before they turn. They keep soy sauce but eat minimal gluten, so write tamari where a recipe says soy sauce, and say when something needs buying.
Freezer rules: meat and fish are thawed overnight in the fridge (mince and thin fillets can go from frozen, or a quick thaw in cold water); a big roast needs a day and a half. Say what to take out and when.
${S.foodKb?'What this family actually cooks with (their kitchen profile): '+S.foodKb:''}`; }
// everything about the kitchen as text: for sharing, and for the AI to write the kitchen profile from
function kitchenText(){ const now=stockNow(), sh=sauceShelf(), recs=(S.recipes||[]), l=S.foodLog||[], past=(S.meals||[]).filter(m=>m.rid&&m.date>=dk(addDays(new Date(),-60))&&m.date<=dk(new Date()));
  return `KITCHEN STOCK (${fmtD(new Date(),{day:'numeric',month:'short',year:'numeric'})})
${STOCK_PLACES.map(p=>{ const x=now.filter(i=>i.where===p[0]).sort((a,b)=>(a.at||0)-(b.at||0)); return x.length?p[2]+' ('+x.length+'):\n'+x.map(i=>'- '+i.name+(i.qty?' — '+i.qty:'')+(stockAge(i)?' ('+stockAge(i)+' old)':'')).join('\n'):''; }).filter(Boolean).join('\n\n')}
${sh.length?'\nSauce shelf:\n'+sh.map(i=>'- '+i.name+(i.out?' (run out)':'')).join('\n'):''}
\nHOW WE LIKE TO EAT\n${foodPrefs()}
${S.foodKb?'\nKITCHEN PROFILE\n'+S.foodKb:''}
${recs.length?'\nOUR RECIPES ('+recs.length+')\n'+recs.map(r=>'- '+(isFav(r.id)?'⭐ ':'')+r.name+' ['+(r.meal||'dinner')+']').join('\n'):''}
${past.length?'\nCOOKED IN THE LAST 60 DAYS\n'+past.map(m=>'- '+m.date+' '+m.slot+': '+(recipeById(m.rid)||{}).name).join('\n'):''}
${l.length?'\nPICKED: '+l.filter(x=>x.k==='pick').map(x=>x.n).join('; ')+'\nTURNED DOWN: '+l.filter(x=>x.k==='no').map(x=>x.n).join('; '):''}`.replace(/\n{3,}/g,'\n\n').trim(); }
function stockCsv(){ const q=v=>'"'+String(v==null?'':v).replace(/"/g,'""')+'"';
  return ['Where,Item,Amount,Added,Status'].concat((S.stock||[]).map(x=>[x.where==='sauce'?'Sauce shelf':(STOCK_PLACES.find(p=>p[0]===x.where)||[,,x.where])[2],x.name,x.qty||'',x.at?new Date(x.at).toISOString().slice(0,10):'',x.where==='sauce'?(x.out?'run out':'have'):(x.used?'used':'have')].map(q).join(','))).join('\r\n'); }
function openKitchenExport(){ const txt=kitchenText();
  modal((m,close)=>{ m.classList.add('wide','tvsheet');
    m.innerHTML=`<div class="tvhead"><h2>⬇️ Export our kitchen</h2><button class="save" id="x">Done</button></div>
      <p class="note">Everything in Kitchen stock, the sauce shelf, how you like to eat, your recipes and what you've cooked lately. Copy it into a chat with Claude, or save it.</p>
      <div class="row" style="gap:8px;flex-wrap:wrap;margin:6px 0 10px"><button class="save" id="cp">📋 Copy as text</button><button class="cancel" id="sh">📤 Share</button><button class="cancel" id="csv">⬇️ Spreadsheet (.csv)</button><button class="cancel" id="tx">⬇️ Text file</button></div>
      <textarea class="txt" readonly style="width:100%;min-height:46vh;font:14px/1.4 ui-monospace,monospace">${esc(txt)}</textarea>`;
    const dl=(name,body,type)=>{ const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([body],{type})); a.download=name; document.body.appendChild(a); a.click(); setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); },500); };
    const d=dk(new Date());
    m.querySelector('#x').onclick=close;
    m.querySelector('#cp').onclick=async()=>{ try{ await navigator.clipboard.writeText(txt); toast('Copied. Paste it into Claude.'); }catch(e){ m.querySelector('textarea').select(); toast('Select all and copy'); } };
    const shb=m.querySelector('#sh'); if(!navigator.share) shb.remove(); else shb.onclick=()=>navigator.share({title:'Our kitchen',text:txt}).catch(()=>{});
    m.querySelector('#csv').onclick=()=>dl('Kitchen stock '+d+'.csv','﻿'+stockCsv(),'text/csv');
    m.querySelector('#tx').onclick=()=>dl('Our kitchen '+d+'.txt',txt,'text/plain');
  }); }
async function buildKitchenProfile(){
  const prompt=`Here is everything about a New Zealand family's kitchen: what's in their freezer, fridge and pantry, their sauces, how they like to eat, their recipes and what they've cooked and picked.
${kitchenText().slice(0,14000)}
Write their KITCHEN PROFILE for a meal-planning assistant: 8 to 12 short lines, plain text, no headings. Cover: the proteins they keep and in roughly what amounts; their go-to vegetables, carbs and dairy; the cuisines and flavours their staples point to; typical weeknight style (time, one-pan, batch cooking); what they bake; what's missing or rarely stocked; anything to use up soon. Only what the lists show; no guesses. Return JSON only: {"profile":"the lines, separated by \\n"}`;
  const out=await aiAsk({prompt,json:true}); const t=String(out&&out.profile||'').trim().slice(0,1500); if(!t) throw new Error('Nothing came back. Try again.'); S.foodKb=t; save(); return t; }
// ---- the ideas board
// Firestore can't store an array inside an array; the AI sometimes sends ingredients as [name, amount] pairs
function noNest(v,inArr){ if(Array.isArray(v)) return inArr?v.map(x=>typeof x==='object'&&x?JSON.stringify(x):String(x)).join(' '):v.map(x=>noNest(x,true)); if(v&&typeof v==='object'){ const o={}; for(const k in v) o[k]=noNest(v[k],false); return o; } return v; }
function boardAdd(rs,slot,src){ S.ideaBoard=(S.ideaBoard||[]).filter(x=>Date.now()-(x.at||0)<21*864e5); const ids=[];
  for(const r of (rs||[]).slice().reverse()){ const c=JSON.parse(JSON.stringify(r)); const id='i-'+uid(); S.ideaBoard.unshift({id,r:c,slot:c.meal&&MEAL_SLOTS.some(x=>x[0]===c.meal)?c.meal:slot,src,at:Date.now(),day:c.day||''}); ids.unshift(id); }
  S.ideaBoard=S.ideaBoard.slice(0,40); save(); return ids; }
const next8=()=>[...Array(8)].map((_,i)=>dk(addDays(new Date(),i)));
function dayChips(sel,slot,mark){ return next8().map((k,i)=>{ const has=mealsOn(k,slot).length; return `<button class="dchip ${k===sel?'on':''} ${has?'has':''}" data-dk="${k}" title="${has?'Already has a '+slot:''}">${i===0?'Today':i===1?'Tmrw':fmtD(kd(k),{weekday:'short'})}<small>${fmtD(kd(k),{day:'numeric'})}${has?' •':''}</small>${mark&&k===mark?'<i>this day</i>':''}</button>`; }).join(''); }
function stockUses(r){ const low=(r.uses||[]).map(x=>String(x).toLowerCase()); return stockNow().filter(x=>low.some(u=>u===x.name.toLowerCase()||u.includes(x.name.toLowerCase())||x.name.toLowerCase().includes(u))).map(x=>x.id); }
// putting an idea on the plan: its few missing things go straight on the shopping list (taken off again on Undo)
function boardPlan(it,key,slot){ const r=saveRecipe(it.r); it.r.id=r.id; foodNote('pick',r.name); const m=planMeal(key,slot,r); m.uses=stockUses(it.r);
  const before=new Set(S.groceries.map(g=>g.id)); const n=buyAdd((it.r.buy||[]).filter(x=>!inStock(x))); const got=S.groceries.filter(g=>!before.has(g.id)).map(g=>g.id);
  it.planned={key,slot,mid:m.id,buy:got}; save(); renderAll(); return n; }
function boardUnplan(it){ if(!it.planned) return; S.meals=(S.meals||[]).filter(m=>m.id!==it.planned.mid); const b=it.planned.buy||[]; if(b.length) S.groceries=S.groceries.filter(g=>!(b.includes(g.id)&&!g.done)); delete it.planned; save(); renderAll(); }
// what the planned meals of the next 8 days still need from the shops (not in stock, not already on the list)
function toBuyNext8(){ const days=next8(), ms=(S.meals||[]).filter(m=>days.includes(m.date)&&m.rid&&!m.shopped&&recipeById(m.rid)), onList=n=>S.groceries.some(g=>!g.done&&g.name.toLowerCase().startsWith(n.toLowerCase())), seen=new Set(), out=[];
  for(const m of ms) for(const i of recipeById(m.rid).ing||[]){ const n=String(i[2]||'').toLowerCase(); if(!n||i[3]==='p'||seen.has(n)) continue; seen.add(n); if(!inStock(n)&&!onList(n)) out.push(i[2]); }
  return {days,meals:ms.length,items:out}; }
function openBoard(o){ o=o||{}; let slot0=null, seen=o.seen||[], seenSaved=false; const fresh=new Set(o.fresh||[]), picking={};
  // ideas saved by the 21 Nov build had their ingredient and step lists squashed into text: rebuild them
  (S.ideaBoard||[]).forEach(x=>{ const r=x&&x.r; if(!r) return; if((r.ing||[]).some(i=>typeof i==='string')) r.ing=r.ing.map(i=>typeof i==='string'?parseIng(i.replace(/ p$/,' (pantry)')):i).filter(Boolean); if((r.steps||[]).some(t=>typeof t==='string')) r.steps=r.steps.map(t=>{ if(typeof t!=='string') return t; const n=t.match(/^(.*\S) (\d+)$/); return n?[n[1],+n[2]]:[t]; }); });
  modal((m,close)=>{ m.classList.add('wide','tvsheet'); const draw=()=>{ const all=(S.ideaBoard||[]).filter(x=>x&&x.r), tb=toBuyNext8();
    const sug=all.filter(x=>fresh.has(x.id)&&x.day&&!x.planned&&next8().includes(x.day));
    m.innerHTML=`<div class="tvhead"><h2>💡 Our ideas</h2><button class="save" id="x">Done</button></div>
      ${seen.length?`<p class="note">I could see: ${esc(seen.slice(0,14).map(x=>x.name).join(', '))}${seen.length>14?' and '+(seen.length-14)+' more':''}. ${seenSaved?'✓ Saved to Kitchen stock.':`<button class="xbtn" id="sv">💾 Keep these in Kitchen stock</button>`}</p>`:''}
      ${sug.length?`<button class="save" id="all" style="width:100%;margin:4px 0 8px;border-radius:14px;padding:12px">✅ Put ${sug.length>1?'all '+sug.length:'it'} on ${sug.length>1?'their':'its'} suggested day${sug.length>1?'s':''}</button>`:''}
      <div class="wkgrid"><span></span>${next8().map((k,i)=>`<b class="${i===0?'tod':''}">${i===0?'Today':fmtD(kd(k),{weekday:'short'})}<small>${kd(k).getDate()}</small></b>`).join('')}
        ${MEAL_SLOTS.slice().reverse().map(s=>{ const n=next8().filter(k=>mealsOn(k,s[0]).length).length; return `<span class="wkl">${s[2]}<small>${n}/8</small></span>`+next8().map(k=>{ const ms=mealsOn(k,s[0]); const nm=ms.map(mm=>{ const r=mm.rid&&recipeById(mm.rid); return r?r.name:(mm.note||mm.text||'Planned'); }).join(', '); return ms.length?`<button class="wkc ok" data-wk="${esc(nm)}" title="${esc(nm)}">✓</button>`:`<span class="wkc"></span>`; }).join(''); }).join('')}</div>
      <p class="note" style="margin:2px 0 6px">${(()=>{ const e=next8().filter(k=>!mealsOn(k,'dinner').length); return e.length?'<b>Dinners still to fill:</b> '+e.map(k=>k===dk(new Date())?'today':fmtD(kd(k),{weekday:'short',day:'numeric'})).join(', ')+'.':'✅ Every dinner for the 8 days is planned.'; })()} Tap ✓ to see what's on.</p>
      <div class="tvlist">${all.map(x=>{ const r=x.r, pl=x.planned&&(S.meals||[]).some(mm=>mm.id===x.planned.mid)?x.planned:null, sl=x.slot||'dinner', open=picking[x.id];
        return `<div class="idea ${fresh.has(x.id)?'fresh':''} ${pl?'done':''}"><button class="mrow" data-open="${x.id}"><span class="me">${r.emoji||'🍽️'}</span><span class="mrt"><b>${r.yours?(isFav(r.id)?'⭐ ':'📖 ')+'Your '+esc(r.name):esc(r.name)}</b><small>${r.mins?r.mins+' min · ':''}${esc(r.blurb||'')}</small>
          ${(r.uses||[]).length?`<small class="ckok">🧊 Uses: ${esc(r.uses.slice(0,6).join(', '))}</small>`:''}${r.buy?`<small class="${r.buy.length?'ckgap':'ckok'}">${r.buy.length?'🛒 To pick up: '+esc(r.buy.join(', ')):'✅ Everything is in the house'}</small>`:''}${r.thaw?`<small>🧊 ${esc(r.thaw)}</small>`:''}</span></button>
          ${pl?`<div class="ideab"><span class="pill-ok">✓ ${esc(MEAL_SLOTS.find(s=>s[0]===pl.slot)[1])} ${pl.key===dk(new Date())?'today':fmtD(kd(pl.key),{weekday:'short',day:'numeric'})}</span><button class="opt sm" data-mv="${x.id}">↔️ Change day</button><button class="opt sm" data-un="${x.id}">Undo</button></div>`
          :`<div class="ideab"><span class="slotsw">${MEAL_SLOTS.map(s=>`<button class="opt sm ${sl===s[0]?'on':''}" data-sl="${x.id}|${s[0]}" title="${s[1]}">${s[2]}</button>`).join('')}</span>${x.day&&next8().includes(x.day)&&!open?`<button class="opt sm on" data-pl="${x.id}|${x.day}">📅 ${x.day===dk(new Date())?'Today':fmtD(kd(x.day),{weekday:'short',day:'numeric'})}</button>`:''}${o.day&&!open&&o.day!==x.day?`<button class="opt sm on" data-pl="${x.id}|${o.day}">📅 ${fmtD(kd(o.day),{weekday:'short',day:'numeric'})}</button>`:''}<button class="opt sm" data-pk="${x.id}">${open?'Hide days':'📅 Pick a day'}</button><button class="opt sm" data-fv="${x.id}">${r.id&&isFav(r.id)?'⭐':'☆'}</button><button class="opt sm" data-no="${x.id}" title="Not for us">👎</button><button class="opt sm" data-rm="${x.id}" title="Remove">🗑</button></div>
          ${open?`<div class="daychips">${dayChips('',sl,o.day).replace(/data-dk="/g,'data-pl="'+x.id+'|')}</div>`:''}`}</div>`; }).join('')||'<p class="note">No ideas yet. Tap 🗓️ Plan the next 8 days or ✨ Ideas.</p>'}</div>
      <div class="boardfoot"><span>${tb.meals?`${tb.meals} meal${tb.meals===1?'':'s'} planned · ${tb.items.length?`🛒 <b>${tb.items.length}</b> more thing${tb.items.length===1?'':'s'} not yet on the list`:'🛒 shopping list is up to date'}`:'Nothing planned for the next 8 days yet'}</span>${tb.items.length?'<button class="save" id="shop">Check & add…</button>':''}<button class="cancel" id="more">✨ More ideas</button>${all.length?'<button class="cancel" id="clr">Clear used</button>':''}</div>`;
    const find=id=>(S.ideaBoard||[]).find(x=>x.id===id);
    m.querySelector('#x').onclick=()=>{ close(); if($('#mealLayer').innerHTML||isPhone()) openMeals(); };
    const sv=m.querySelector('#sv'); if(sv) sv.onclick=()=>{ const n=stockAdd(seen); seenSaved=true; toast(n+' things kept in Kitchen stock'); draw(); };
    const al=m.querySelector('#all'); if(al) al.onclick=()=>{ let nb=0; sug.forEach(x=>{ nb+=boardPlan(x,x.day,x.slot||'dinner'); }); toast(sug.length+' meals on the plan'+(nb?' · 🛒 '+nb+' added to shopping':'')); draw(); };
    m.querySelectorAll('[data-open]').forEach(b=>b.onclick=()=>{ const x=find(b.dataset.open); if(x) openRecipe(x.r,{back:()=>openBoard(o)}); });
    m.querySelectorAll('[data-sl]').forEach(b=>b.onclick=()=>{ const [id,sl]=b.dataset.sl.split('|'), x=find(id); if(x){ x.slot=sl; save(); draw(); } });
    m.querySelectorAll('[data-pk]').forEach(b=>b.onclick=()=>{ picking[b.dataset.pk]=!picking[b.dataset.pk]; draw(); });
    m.querySelectorAll('[data-pl]').forEach(b=>b.onclick=()=>{ const [id,k]=b.dataset.pl.split('|'), x=find(id); if(!x) return; const sl=x.slot||'dinner', had=mealsOn(k,sl).length;
      if(seen.length&&!seenSaved){ stockAdd(seen); seenSaved=true; } const nb=boardPlan(x,k,sl); delete picking[id]; toast((nb?'🛒 +'+nb+' to shopping · ':'')+x.r.name+' · '+MEAL_SLOTS.find(s=>s[0]===sl)[1]+' '+(k===dk(new Date())?'today':fmtD(kd(k),{weekday:'long'}))+(had?' (as well as what was there)':'')+(x.r.thaw?'. 🧊 '+x.r.thaw:'')); draw(); });
    m.querySelectorAll('[data-un]').forEach(b=>b.onclick=()=>{ const x=find(b.dataset.un); if(x){ boardUnplan(x); draw(); } });
    m.querySelectorAll('[data-mv]').forEach(b=>b.onclick=()=>{ const x=find(b.dataset.mv); if(x){ boardUnplan(x); picking[x.id]=true; draw(); } });
    m.querySelectorAll('[data-fv]').forEach(b=>b.onclick=()=>{ const x=find(b.dataset.fv); if(!x) return; const r=saveRecipe(x.r); x.r.id=r.id; setFav(r.id,!isFav(r.id)); save(); draw(); });
    m.querySelectorAll('[data-no]').forEach(b=>b.onclick=()=>{ const x=find(b.dataset.no); if(!x) return; foodNote('no',x.r.name); S.ideaBoard=S.ideaBoard.filter(y=>y!==x); save(); toast('Noted. Ideas like '+x.r.name+' won’t come up again.'); draw(); });
    m.querySelectorAll('[data-wk]').forEach(c=>c.onclick=()=>toast(c.dataset.wk));
    m.querySelectorAll('[data-rm]').forEach(b=>b.onclick=()=>{ S.ideaBoard=(S.ideaBoard||[]).filter(y=>y.id!==b.dataset.rm); save(); draw(); });
    const sh=m.querySelector('#shop'); if(sh) sh.onclick=()=>shopForMeals(tb.days);
    m.querySelector('#more').onclick=()=>{ close(); openPlanWeek(); };
    const cl=m.querySelector('#clr'); if(cl) cl.onclick=()=>{ const n=(S.ideaBoard||[]).length; S.ideaBoard=(S.ideaBoard||[]).filter(x=>!(x.planned&&(S.meals||[]).some(mm=>mm.id===x.planned.mid))); toast((n-S.ideaBoard.length)+' planned ideas cleared'); save(); draw(); };
  }; draw(); });
}
// ---- plan the next 8 days, starting from what's in the house
function openPlanWeek(){ stockSettle();
  const free=next8().filter(k=>!mealsOn(k,'dinner').length);
  const st={slot:'dinner',days:free.length?free:next8().slice(0,5),moods:[],extra:'',spare:2,useStock:stockNow().length>0};
  modal((m,close)=>{ m.classList.add('wide'); const draw=()=>{
    m.innerHTML=`<h2>🗓️ Plan the next 8 days</h2><p class="note">Meals built from what's already in the house (oldest first), sharing ingredients so the shopping list stays short. They go on your ideas board, each with a suggested day.</p>
      <div class="step">Which meal</div><div class="opts">${MEAL_SLOTS.map(s=>`<button class="opt sm ${st.slot===s[0]?'on':''}" data-meal="${s[0]}">${s[2]} ${s[1]}</button>`).join('')}</div>
      <div class="step">Which days <span style="font-weight:500">(• already planned)</span></div><div class="daychips">${next8().map((k,i)=>{ const has=mealsOn(k,st.slot).length; return `<button class="dchip ${st.days.includes(k)?'on':''} ${has?'has':''}" data-d="${k}">${i===0?'Today':i===1?'Tmrw':fmtD(kd(k),{weekday:'short'})}<small>${fmtD(kd(k),{day:'numeric'})}${has?' •':''} · ${homeOn(k).length}👤</small></button>`; }).join('')}</div>
      <div class="step">Feeling like <span style="font-weight:500">(optional)</span></div><div class="opts">${MOODS.map(x=>`<button class="opt sm ${st.moods.includes(x)?'on':''}" data-mood="${esc(x)}">${esc(x)}</button>`).join('')}</div>
      <div class="step">Anything else?</div><input class="txt" id="ex" value="${esc(st.extra)}" placeholder="e.g. pizza night Friday, Aria's friend over Tuesday, use the lamb">
      <div class="row" style="margin-top:10px;gap:18px;flex-wrap:wrap"><span class="serves">Spare ideas <button id="sm">−</button> <b>${st.spare}</b> <button id="sp">＋</button></span>${stockNow().length?`<label class="small"><input type="checkbox" id="us" ${st.useStock?'checked':''}> Start from Kitchen stock (${stockNow().length})</label>`:'<span class="note">Kitchen stock is empty: list the freezer first for better plans.</span>'}</div>
      <div class="mact"><button class="cancel" id="c">Cancel</button><button class="save" id="go" ${st.days.length?'':'disabled'}>✨ Plan ${st.days.length} day${st.days.length===1?'':'s'}</button></div>`;
    m.querySelectorAll('[data-meal]').forEach(b=>b.onclick=()=>{ st.slot=b.dataset.meal; draw(); });
    m.querySelectorAll('[data-d]').forEach(b=>b.onclick=()=>{ const k=b.dataset.d; st.days=st.days.includes(k)?st.days.filter(x=>x!==k):st.days.concat(k).sort(); b.classList.toggle('on',st.days.includes(k)); const g=m.querySelector('#go'); if(g){ g.disabled=!st.days.length; g.textContent='✨ Plan '+st.days.length+' day'+(st.days.length===1?'':'s'); } });
    m.querySelectorAll('[data-mood]').forEach(b=>b.onclick=()=>{ const x=b.dataset.mood; st.moods=st.moods.includes(x)?st.moods.filter(y=>y!==x):[...st.moods,x]; draw(); });
    const ex=m.querySelector('#ex'); ex.oninput=()=>st.extra=ex.value;
    m.querySelector('#sm').onclick=()=>{ st.spare=Math.max(0,st.spare-1); draw(); }; m.querySelector('#sp').onclick=()=>{ st.spare=Math.min(4,st.spare+1); draw(); };
    const us=m.querySelector('#us'); if(us) us.onchange=()=>st.useStock=us.checked;
    m.querySelector('#c').onclick=close;
    m.querySelector('#go').onclick=async()=>{ if(!aiOK()){ toast('This needs AI: ⚙️ Settings → Connections → ✨ AI'); return; }
      close(); const done=aiBusy('Planning '+st.days.length+' '+(st.slot==='lunch'?'lunches':st.slot+'s')+' from what you have…');
      try{ const rs=await planWeekIdeas(st); done(); const ids=boardAdd(rs,st.slot,'plan'); openBoard({fresh:ids}); }catch(e){ done(); if(e.message!=='quiet') toast(e.message); } };
  }; draw(); });
}
async function planWeekIdeas(st){
  const stock=st.useStock?stockNow().slice().sort((a,b)=>(a.at||0)-(b.at||0)):[], sh=sauceShelf(), n=st.days.length+st.spare, M=st.slot==='lunch'?'lunches':st.slot+'s';
  const already=next8().map(k=>{ const ms=mealsOn(k,st.slot).map(x=>x.rid&&recipeById(x.rid)).filter(Boolean); return ms.length?fmtD(kd(k),{weekday:'short'})+': '+ms.map(r=>r.name).join(', '):''; }).filter(Boolean);
  const mine=(S.recipes||[]).filter(r=>(r.meal||'dinner')===st.slot).sort((a,b)=>isFav(b.id)-isFav(a.id)).slice(0,40);
  const prompt=`You are planning ${M} for a New Zealand family (Auckland) for these days: ${st.days.map(k=>k+' ('+fmtD(kd(k),{weekday:'long'})+', '+homeOn(k).length+' people)').join('; ')}.
Their tastes: ${foodPrefs()}
${foodHistory()}
${kitchenKnowledge()}
${stock.length?'What they have now (oldest first; build the plan around these, oldest and frozen first): '+stock.map(x=>x.name+(x.qty?' ('+x.qty+')':'')+' ['+x.where+(stockAge(x)?', '+stockAge(x)+' old':'')+']').join('; ')+'.':''}
${sh.length?'Sauces and staples in the house: '+sh.filter(x=>!x.out).map(x=>x.name).join(', ')+'.':''}
${already.length?'Already planned (don\'t repeat these): '+already.join('; ')+'.':''}
${mine.length?'Their own recipes (⭐ = favourite): '+mine.map(r=>(isFav(r.id)?'⭐ ':'')+r.name).join('; ')+'. Include one or two of these when they fit what is in the house (exact name, "saved":true).':''}
${st.moods.length?'Feeling like: '+st.moods.join(', ')+'.':''} ${st.extra?'They said: +String(st.extra).slice(0,500)+.':''}
Plan ${n} ${M}: one for each day listed (in "day", as YYYY-MM-DD) and ${st.spare} spare (empty "day"). Vary cuisines and proteins across the days; put the meals that use fresh things early and freezer things later (with thaw times); share ingredients between meals so the shopping list is short; weeknights quick, a bigger cook at the weekend.
Return JSON only: {"recipes":[ ${n} objects shaped like ${RECIPE_SHAPE} plus "day":"YYYY-MM-DD or empty","uses":["things they have that it uses, named exactly as in their list"],"buy":["each thing to buy"],"thaw":"what to take out of the freezer and when, or empty" ]}, "serves" = the people that day.
${RECIPE_RULES}`;
  const out=await aiAsk({prompt:withMemory(prompt,st.extra||M),json:true});
  const own=x=>(S.recipes||[]).find(r=>r.name.trim().toLowerCase()===String(x||'').trim().toLowerCase());
  const rs=(out.recipes||[]).map(raw=>{ const sv=raw.saved&&own(raw.name), r=sv?Object.assign(JSON.parse(JSON.stringify(sv)),{yours:true}):cleanRecipe(raw);
    r.uses=(raw.uses||[]).map(String).slice(0,20); r.buy=(raw.buy||[]).map(String).filter(Boolean).slice(0,8); r.thaw=String(raw.thaw||'').slice(0,160); r.day=st.days.includes(String(raw.day||''))?String(raw.day):''; return r; }).filter(r=>r.ing&&r.ing.length&&r.steps&&r.steps.length);
  if(!rs.length) throw new Error('No plan came back. Try again.');
  return rs; }
// on the fly: photos in, dinners and gaps out
function openCook(){ stockSettle();
  const h=new Date().getHours(), st={meal:h<10?'breakfast':h<15?'lunch':'dinner',files:[],text:'',people:Math.max(1,homeOn(dk(new Date())).length),useStock:stockNow().length>0};
  modal((m,close)=>{ m.classList.add('wide'); const draw=()=>{
    m.innerHTML=`<h2>📸 What can we make?</h2><p class="note">Take a couple of photos of the fridge and the freezer. You get three ${st.meal==='lunch'?'lunches':st.meal+'s'} made from what's there, and what (if anything) to pick up.</p>
      <div class="row" style="gap:8px;flex-wrap:wrap;align-items:center"><button class="save" id="phc" style="border-radius:14px;padding:14px 18px;font-weight:800">📷 ${st.files.length?'Another photo':'Take a photo'}</button><button class="cancel" id="ph" style="border-radius:14px;padding:14px 16px">🖼️ From my photos</button>${st.files.map((f,i)=>`<span class="ckph"><img src="data:${f.mime};base64,${f.data}" alt=""><button data-rm="${i}" aria-label="Remove">✕</button></span>`).join('')}</div>
      <input type="file" id="pf" accept="image/*" multiple hidden><input type="file" id="pfc" accept="image/*" capture="environment" hidden>
      <div class="opts" style="margin:4px 0 10px">${['breakfast','lunch','dinner'].map(k=>`<button class="opt sm ${st.meal===k?'on':''}" data-ml="${k}">${k==='breakfast'?'🥣 Breakfast':k==='lunch'?'🥪 Lunch':'🍽️ Dinner'}</button>`).join('')}</div><div class="step">Anything else? <span style="font-weight:500">(optional)</span></div><input class="txt" id="tx" value="${esc(st.text)}" placeholder="e.g. feeling like Mexican, quick tonight, there's mince in the deep freezer">
      <div class="row" style="margin-top:10px;gap:18px;flex-wrap:wrap"><span class="serves">People <button id="pm">−</button> <b>${st.people}</b> <button id="pp">＋</button></span>
        ${stockNow().length?`<label class="small"><input type="checkbox" id="us" ${st.useStock?'checked':''}> Also use the Kitchen stock list (${stockNow().length})</label>`:''}</div>
      <div class="mact"><button class="cancel" id="c">Cancel</button><button class="save" id="go">🍽️ Find ${st.meal==='lunch'?'lunches':st.meal+'s'}</button></div>`;
    const pf=m.querySelector('#pf'), pfc=m.querySelector('#pfc'), tx=m.querySelector('#tx'); tx.oninput=()=>st.text=tx.value;
    m.querySelector('#ph').onclick=()=>{ if(st.files.length>=4){ toast('Four photos is plenty'); return; } pf.click(); };
    m.querySelector('#phc').onclick=()=>{ if(st.files.length>=4){ toast('Four photos is plenty'); return; } pfc.click(); };
    pf.onchange=pfc.onchange=async e=>{ const inp=e.target; for(const f of [...inp.files].slice(0,4-st.files.length)){ try{ st.files.push(await fileForAI(f)); }catch(x){ toast(x.message); } } inp.value=''; draw(); };
    m.querySelectorAll('[data-rm]').forEach(b=>b.onclick=()=>{ st.files.splice(+b.dataset.rm,1); draw(); });
    m.querySelectorAll('[data-ml]').forEach(b=>b.onclick=()=>{ st.text=m.querySelector('#tx').value; st.meal=b.dataset.ml; draw(); }); m.querySelector('#pm').onclick=()=>{ st.people=Math.max(1,st.people-1); draw(); }; m.querySelector('#pp').onclick=()=>{ st.people++; draw(); };
    const us=m.querySelector('#us'); if(us) us.onchange=()=>st.useStock=us.checked;
    m.querySelector('#c').onclick=close;
    m.querySelector('#go').onclick=async()=>{ if(!st.files.length&&!st.text.trim()&&!(st.useStock&&stockNow().length)){ toast('Add a photo, or say what you have'); return; }
      if(!aiOK()){ toast('This needs AI: ⚙️ Settings → Connections → ✨ AI'); return; }
      close(); const done=aiBusy(st.files.length?'Looking in the fridge and freezer…':'Working out '+st.meal+'…');
      try{ const out=await dinnerIdeas(st); out.meal=st.meal; done(); showCook(out); }catch(e){ done(); if(e.message!=='quiet') toast(e.message); } };
  }; draw(); });
}
function showCook(out){ const ids=boardAdd(out.recipes,out.meal||'dinner','cook'); openBoard({fresh:ids,seen:out.seen}); }
/* one 📷 button: asks camera or photos */
function photoChoice(cam,gal){ modal((m,close)=>{ m.classList.add('pchoose');
  m.innerHTML=`<h2>📷 Add a photo</h2><div class="opts" style="flex-direction:column;align-items:stretch;gap:10px"><button class="opt big" id="pc1">📷 Take a photo</button><button class="opt big" id="pc2">🖼️ Choose from my photos</button></div><div class="mact"><button class="cancel" id="pc0">Cancel</button></div>`;
  m.querySelector('#pc1').onclick=()=>{ close(); cam.click(); }; m.querySelector('#pc2').onclick=()=>{ close(); gal.click(); }; m.querySelector('#pc0').onclick=close; }); }
/* 🎤 hold to talk: listens while held, writes what it heard into the box on release (nothing is sent anywhere until the
   person taps the box's button). A quick tap shows how to use it. */
function holdMic(btn,inp,lang){
  if(!btn||!AA_SR) return; let r=null, base='', t0=0;
  const stop=()=>{ if(!r) return; try{ r.stop(); }catch(x){} };
  btn.onpointerdown=e=>{ e.preventDefault(); t0=Date.now(); base=inp.value.trim()?inp.value.trim()+', ':''; try{ r=new AA_SR(); r.lang=lang||(appLang()==='ja'?'ja-JP':'en-NZ'); r.interimResults=true; r.continuous=true;
      r.onresult=ev=>{ inp.value=base+[...ev.results].map(x=>x[0].transcript).join(' '); };
      r.onend=()=>{ btn.classList.remove('on'); r=null; inp.focus(); }; r.onerror=()=>{ btn.classList.remove('on'); r=null; };
      r.start(); btn.classList.add('on'); try{ navigator.vibrate&&navigator.vibrate(20); }catch(x){} }catch(x){ toast('Voice isn’t available here. Type it instead.'); } };
  btn.onpointerup=btn.onpointerleave=btn.onpointercancel=()=>{ if(!r) return; if(Date.now()-t0<400){ stop(); toast('Hold 🎤 down while you talk, then let go'); return; } stop(); };
  btn.oncontextmenu=e=>e.preventDefault(); btn.onclick=e=>e.preventDefault();
}
const SUNITS=['','g','kg','ml','L','each','pack','bag','tray','tin','jar','bottle','box','loaf','bunch','dozen'];
function splitQty(q){ const m=String(q||'').trim().match(/^([\d.,\/½¼¾]+)\s*(.*)$/); if(!m) return {n:'',u:String(q||'').trim()};
  let u=m[2].trim().toLowerCase().replace(/^(grams?|gm)$/,'g').replace(/^(kilos?|kgs?|kilograms?)$/,'kg').replace(/^(litres?|liters?|l)$/,'L').replace(/^(mls?|millilitres?)$/,'ml').replace(/^(packs?|packets?)$/,'pack').replace(/^bags$/,'bag').replace(/^trays$/,'tray').replace(/^(tins?|cans?)$/,'tin').replace(/^jars$/,'jar').replace(/^bottles$/,'bottle').replace(/^boxes$/,'box').replace(/^loaves$/,'loaf').replace(/^bunches$/,'bunch').replace(/^(x|pieces?|items?)$/,'each');
  return {n:m[1],u}; }
/* Check what the AI heard before it goes on the list: tick or cross each, fix the name or amount, move it between
   freezer, fridge and pantry, then add them all at once. */
function stockReview(items,where,back){
  const rows=items.map(x=>Object.assign(splitQty(x.qty),{name:String(x.name||'').trim(),where:STOCK_PLACES.some(p=>p[0]===x.where)?x.where:(where||'fridge'),on:true})).filter(x=>x.name);
  modal((m,close)=>{ m.classList.add('wide','tvsheet'); const draw=()=>{ const n=rows.filter(r=>r.on).length;
    m.innerHTML=`<div class="tvhead"><h2>✅ Check the list</h2><button class="cancel" id="bk">‹ Back</button></div>
      <p class="note">Go down the list: untick anything wrong, fix the name, how many and the unit, and tap 🧊/🥬/🥫 to move it.</p>
      <div class="srv">${rows.map((r,i)=>`<div class="srow ${r.on?'':'off'}"><button class="sbx" data-t="${i}">${r.on?'✓':''}</button>
        <input class="txt sn" data-n="${i}" value="${esc(r.name)}"><input class="txt sq" data-q="${i}" value="${esc(r.n)}" inputmode="decimal" placeholder="how many"><select class="txt su" data-u="${i}">${(SUNITS.includes(r.u)?SUNITS:SUNITS.concat([r.u])).map(u=>`<option value="${esc(u)}" ${u===r.u?'selected':''}>${u?esc(u):'—'}</option>`).join('')}</select>
        <button class="swh" data-w="${i}" title="${esc(STOCK_PLACES.find(p=>p[0]===r.where)[2])}">${STOCK_PLACES.find(p=>p[0]===r.where)[1]}</button></div>`).join('')}</div>
      <div class="mact"><button class="cancel" id="none">${n?'Untick all':'Tick all'}</button><button class="save" id="ok" ${n?'':'disabled'}>Add ${n} to the list</button></div>`;
    m.querySelector('#bk').onclick=()=>{ close(); if(back) back(); };
    m.querySelectorAll('[data-t]').forEach(b=>b.onclick=()=>{ rows[+b.dataset.t].on=!rows[+b.dataset.t].on; draw(); });
    m.querySelectorAll('[data-n]').forEach(x=>x.oninput=()=>rows[+x.dataset.n].name=x.value);
    m.querySelectorAll('[data-q]').forEach(x=>x.oninput=()=>rows[+x.dataset.q].n=x.value);
    m.querySelectorAll('[data-u]').forEach(x=>x.onchange=()=>rows[+x.dataset.u].u=x.value);
    m.querySelectorAll('[data-w]').forEach(b=>b.onclick=()=>{ const r=rows[+b.dataset.w], k=STOCK_PLACES.findIndex(p=>p[0]===r.where); r.where=STOCK_PLACES[(k+1)%3][0]; draw(); });
    m.querySelector('#none').onclick=()=>{ const on=!rows.some(r=>r.on); rows.forEach(r=>r.on=on); draw(); };
    m.querySelector('#ok').onclick=()=>{ const n=stockAdd(rows.filter(r=>r.on&&r.name.trim()).map(r=>({name:r.name,where:r.where,qty:[r.n,r.u].filter(Boolean).join(' ')}))); close(); toast(n+' thing'+(n===1?'':'s')+' added to Kitchen stock'); if(back) back(); };
  }; draw(); });
}
function openStock(w0){ stockSettle(); let where=w0||'freezer';
  modal((m,close)=>{ m.classList.add('wide','tvsheet'); let busy=false;
    const draw=()=>{ const now=stockNow(), used=(S.stock||[]).filter(x=>x.used), sh=sauceShelf();
    m.innerHTML=`<div class="tvhead"><h2>🧊 Kitchen stock</h2><button class="save" id="x">Done</button></div>
      <div class="row" style="gap:8px;flex-wrap:wrap"><button class="save" id="din" style="border-radius:14px;padding:12px 16px;font-weight:800">🍽️ What's for dinner?</button><button class="xbtn" id="cook">📸 From photos of the fridge</button><button class="xbtn" id="exp0">⬇️ Export our kitchen</button></div>
      <div class="step">Add what's in the house</div>
      <div class="opts">${STOCK_PLACES.map(p=>`<button class="opt sm ${where===p[0]?'on':''}" data-w="${p[0]}">${p[1]} ${p[2]}</button>`).join('')}</div>
      <div class="addany" style="margin-top:8px"><div class="aarow"><input type="text" class="aain" id="sin" placeholder="e.g. 2 kg chicken thighs, lamb chops, mince" autocomplete="off">${AA_SR?'<button class="aaic aamic" id="smic" aria-label="Hold to talk">🎤</button>':''}<button class="aaic" id="scam" aria-label="Photo">📷</button><button class="save aago" id="sgo">✨ List it</button></div><input type="file" id="sf" accept="image/*" multiple hidden><input type="file" id="sfc" accept="image/*" capture="environment" hidden></div>
      <p class="note">Hold 🎤 and say everything, let go, then tap ✨ List it. Or type a list, or 📷 a shelf or a handwritten list. A chest freezer photo only shows the top layer, so a list is more accurate for that one.</p>
      ${STOCK_PLACES.map(p=>{ const l=now.filter(x=>x.where===p[0]).sort((a,b)=>(a.at||0)-(b.at||0)); return l.length?`<div class="step">${p[1]} ${p[2]} <span style="font-weight:500">(${l.length})</span></div><div class="stk">${l.map(x=>`<span class="stki">${esc(x.name)}${x.qty?` <small>${esc(x.qty)}</small>`:''}${stockAge(x)?` <small class="old">${stockAge(x)}</small>`:''}<button data-used="${x.id}" aria-label="Used">✕</button></span>`).join('')}</div>`:''; }).join('')}
      ${now.length?'':'<p class="note"><b>Nothing listed yet.</b> Start with the deep freezer.</p>'}
      ${used.length?`<div class="step">Used lately <span style="font-weight:500">(tap to put back)</span></div><div class="stk">${used.map(x=>`<button class="stki gone" data-back="${x.id}">${esc(x.name)}</button>`).join('')}</div>`:''}
      <div class="step">🥫 Sauce shelf <span style="font-weight:500">(tap when one runs out: it goes on the shopping list)</span></div>
      ${sh.length?SAUCES.map(g=>g[0]).concat(['Ours']).map(g=>{ const l=sh.filter(x=>(x.grp||'Ours')===g); return l.length?`<div class="note" style="margin:6px 0 2px"><b>${g}</b></div><div class="stk">${l.map(x=>`<button class="stki sauce ${x.out?'out':''}" data-sc="${x.id}">${x.out?'🛒 ':'✓ '}${esc(x.name)}</button>`).join('')}</div>`:''; }).join('')+`<div class="row" style="margin-top:8px;gap:8px"><input class="txt" id="snew" placeholder="Add a sauce or staple" style="flex:1"><button class="xbtn" id="sadd">Add</button></div>`
        :`<p class="note">Key sauces and staples for Japanese, Mexican and Kiwi cooking, gluten-light. Dinners assume these are in the house.</p><button class="xbtn" id="seed">＋ Start with the suggested list (${SAUCES.reduce((a,g)=>a+g[1].length,0)})</button>`}
      ${(S.foodLog||[]).length?`<div class="step">What the AI has learnt from your picks</div><div class="stk">${(S.foodLog||[]).slice().reverse().slice(0,16).map(x=>`<span class="stki">${x.k==='pick'?'👍':'👎'} ${esc(x.n)}<button data-fl="${esc(x.n)}|${x.k}" aria-label="Forget">✕</button></span>`).join('')}</div>`:''}
      <div class="step">🧠 Our kitchen profile</div><p class="note" style="margin:0 0 6px">What you actually cook with, worked out from this list, your recipes and your picks. Every meal idea uses it. Rebuild it after a big shop, or edit it.</p>
      <textarea class="txt" id="kb" rows="5" placeholder="Not built yet" style="font:inherit;font-size:16px;line-height:1.4;min-height:120px;resize:vertical">${esc(S.foodKb||'')}</textarea>
      <div class="row" style="margin-top:6px;gap:8px;flex-wrap:wrap"><button class="xbtn" id="kbb">✨ ${S.foodKb?'Rebuild':'Build'} it</button><button class="xbtn" id="kbs">Save</button><button class="xbtn" id="exp">⬇️ Export our kitchen</button></div>
      <div class="step">How we like to eat</div><p class="note" style="margin:0 0 6px">Tells the AI how your family eats. Every dinner idea follows it.</p><textarea class="txt" id="food" rows="5" style="font:inherit;font-size:17px;line-height:1.4;min-height:130px;resize:vertical">${esc(foodPrefs())}</textarea><div class="row" style="margin-top:6px"><button class="xbtn" id="fsave">Save</button></div>`;
    m.querySelector('#x').onclick=close;
    m.querySelector('#din').onclick=async()=>{ if(!stockNow().length){ toast('Add what’s in the house first, or use photos'); return; } if(!aiOK()){ toast('This needs AI: ⚙️ Settings → Connections → ✨ AI'); return; }
      close(); const done=aiBusy('Working out dinner…'); try{ const out=await dinnerIdeas({useStock:true}); done(); showCook(out); }catch(e){ done(); if(e.message!=='quiet') toast(e.message); } };
    m.querySelector('#cook').onclick=()=>{ close(); openCook(); };
    m.querySelectorAll('[data-w]').forEach(b=>b.onclick=()=>{ where=b.dataset.w; const v=m.querySelector('#sin').value; draw(); m.querySelector('#sin').value=v; });
    const add=async(files)=>{ const inp=m.querySelector('#sin'), text=inp.value.trim(); if(busy||(!text&&!(files&&files.length))) return; busy=true; const done=aiOK()?aiBusy(files&&files.length?'Reading the photo…':'Sorting the list…'):()=>{};
      try{ const items=await stockRead(files,text,where); done(); busy=false;
        if(!items.length){ toast('Nothing found in that. Try again, a bit slower.'); return; }
        inp.value=''; close(); stockReview(items,where,()=>openStock(where)); return; }
      catch(e){ done(); if(e.message!=='quiet') toast(e.message); }
      busy=false; if(m.isConnected) draw(); };
    holdMic(m.querySelector('#smic'),m.querySelector('#sin'),'en-NZ');
    m.querySelector('#sgo').onclick=()=>add(); m.querySelector('#sin').onkeydown=e=>{ if(e.key==='Enter'){ e.preventDefault(); add(); } };
    const sf=m.querySelector('#sf'), sfc=m.querySelector('#sfc'); m.querySelector('#scam').onclick=()=>photoChoice(sfc,sf);
    sf.onchange=sfc.onchange=async e=>{ const inp=e.target, fs=[]; for(const f of [...inp.files].slice(0,4)){ try{ fs.push(await fileForAI(f)); }catch(x){} } inp.value=''; if(fs.length) add(fs); };
    m.querySelectorAll('[data-used]').forEach(b=>b.onclick=()=>{ const x=S.stock.find(y=>y.id===b.dataset.used); if(x){ x.used=Date.now(); save(); draw(); } });
    m.querySelectorAll('[data-back]').forEach(b=>b.onclick=()=>{ const x=S.stock.find(y=>y.id===b.dataset.back); if(x){ delete x.used; save(); draw(); } });
    m.querySelectorAll('[data-sc]').forEach(b=>b.onclick=()=>{ const x=S.stock.find(y=>y.id===b.dataset.sc); if(!x) return; x.out=!x.out; if(x.out){ const n=buyAdd([x.name]); toast(x.name+(n?' added to the shopping list':' is already on the shopping list')); } save(); draw(); });
    const seed=m.querySelector('#seed'); if(seed) seed.onclick=()=>{ SAUCES.forEach(g=>g[1].forEach(n=>S.stock.push({id:uid(),name:n,where:'sauce',grp:g[0],out:false,at:Date.now()}))); save(); draw(); toast('Tap any you don’t have and it goes on the shopping list'); };
    const sa=m.querySelector('#sadd'); if(sa) sa.onclick=()=>{ const v=m.querySelector('#snew').value.trim(); if(!v) return; S.stock.push({id:uid(),name:v.slice(0,50),where:'sauce',grp:'Ours',out:false,at:Date.now()}); save(); draw(); };
    m.querySelectorAll('[data-fl]').forEach(b=>b.onclick=()=>{ const [n,k]=b.dataset.fl.split('|'); S.foodLog=(S.foodLog||[]).filter(x=>!(x.n===n&&x.k===k)); save(); draw(); });
    m.querySelector('#exp').onclick=()=>openKitchenExport();
    m.querySelector('#exp0').onclick=()=>openKitchenExport();
    m.querySelector('#kbs').onclick=()=>{ S.foodKb=m.querySelector('#kb').value.trim().slice(0,1500); save(); toast('Saved'); };
    m.querySelector('#kbb').onclick=async()=>{ if(!aiOK()){ toast('This needs AI: ⚙️ Settings → Connections → ✨ AI'); return; } if(!stockNow().length&&!(S.recipes||[]).length){ toast('List some stock first'); return; }
      const done=aiBusy('Reading your kitchen…'); try{ await buildKitchenProfile(); done(); draw(); toast('Kitchen profile built. Have a read and fix anything.'); }catch(e){ done(); if(e.message!=='quiet') toast(e.message); } };
    m.querySelector('#fsave').onclick=()=>{ S.food=m.querySelector('#food').value.trim().slice(0,600); save(); toast('Saved. Every dinner idea follows this.'); };
  }; draw(); });
}

/* ================= 📸 Family album =================
   Anyone adds photos: from their phone (camera or photos, several at once), by dragging them onto the fridge or a
   computer, or with Android's Share → Family Screen. They are made a sensible size and saved by the Reminder helper
   into "Family Screen photos" in the family's Google Drive; the fridge's night-time photo frame shows them. */
async function albumAdd(files,status,quiet){
  const list=[...files].filter(f=>/^image\//.test(f.type)).slice(0,150); if(!list.length){ toast('Those aren’t photos'); return 0; }
  if(!S.voiceUrl){ toast('The album needs the Reminder helper: ⚙️ Settings → Connections → 🧰 Helpers'); return 0; }
  let ok=0, err='';
  for(let i=0;i<list.length;i++){ if(status) status(`Saving ${i+1} of ${list.length}…`);
    try{ const d=await fileForAI(list[i]); const r=await helperDo('photo_add',{data:d.data,mime:d.mime,name:(list[i].name||'Photo').replace(/\.[a-z]+$/i,'')+'.jpg',by:(mePerson()&&nm(mePerson()))||''});
      if(r&&r.error) err=r.error;
      if(r&&r.ok){ ok++; if(r.folder&&S.photoFolder!==r.folder) S.photoFolder=r.folder;
        try{ const c=await caches.open('fs-photos'), bin=Uint8Array.from(atob(d.data),ch=>ch.charCodeAt(0)); await c.put('p/'+r.id,new Response(new Blob([bin],{type:d.mime})));
          const l=await saverPhotos(); l.unshift(r.id); await c.put('list',new Response(JSON.stringify(l.slice(0,150)),{headers:{'Content-Type':'application/json'}})); }catch(e){} } }
    catch(e){} }
  if(ok){ S.photoRev=Date.now(); lsSet('fs.photosAt',String(Date.now())); save(); }   // tells the fridge and the other phones there are new photos
  if(!quiet) toast(ok?`${ok} photo${ok>1?'s':''} added to the family album`:/unknown|action/i.test(err)?'The Reminder helper needs updating first: ⚙️ Settings → 🧰 Helpers':'Couldn’t save the photos'+(err?': '+err:'. Try again.'));
  return ok;
}
/* ---- Pick from Google Photos (Google's own picker: search a face, tick photos, they come into the album) ---- */
const PHOTOS_CLIENT='573480703676-5osef2ulg9opju4a8ik0vgg5jmq0v950.apps.googleusercontent.com', PICK_API='https://photospicker.googleapis.com/v1/';
let gisP=null;
function gisLoad(){ if(window.google&&google.accounts&&google.accounts.oauth2) return Promise.resolve(); if(gisP) return gisP;
  gisP=new Promise((ok,no)=>{ const s=document.createElement('script'); s.src='https://accounts.google.com/gsi/client'; s.async=true; s.onload=ok; s.onerror=()=>{ gisP=null; no(new Error('Couldn’t reach Google')); }; document.head.appendChild(s); }); return gisP; }
function photosToken(){ return new Promise((ok,no)=>{ try{
  const c=google.accounts.oauth2.initTokenClient({client_id:PHOTOS_CLIENT,scope:'https://www.googleapis.com/auth/photospicker.mediaitems.readonly',
    callback:r=>r&&r.access_token?ok(r.access_token):no(new Error(r&&r.error||'Google said no')), error_callback:e=>no(new Error(e&&e.type==='popup_closed'?'closed':'Google sign-in didn’t open'))});
  c.requestAccessToken({prompt:'',hint:SYNC.me&&SYNC.me()||undefined}); }catch(e){ no(e); } }); }
async function pickApi(tok,path,opt){ const r=await fetch(PICK_API+path,Object.assign({headers:{Authorization:'Bearer '+tok,'Content-Type':'application/json'}},opt||{})); if(!r.ok) throw new Error('Google Photos '+r.status); return r.status===204?{}:r.json(); }
// step 1 (needs a tap): sign in to Google and start a picking session; step 2 (another tap) opens Google Photos
async function pickStart(){ await gisLoad(); const tok=await photosToken(); const ses=await pickApi(tok,'sessions',{method:'POST',body:'{}'}); return {tok,ses}; }
async function pickFinish(p,status){
  const {tok,ses}=p, until=Date.now()+15*60e3; let s=ses;
  while(!s.mediaItemsSet){ if(Date.now()>until) throw new Error('Took too long. Try again.'); await new Promise(r=>setTimeout(r,4000)); s=await pickApi(tok,'sessions/'+ses.id); }
  let items=[], pt=''; do{ const j=await pickApi(tok,'mediaItems?sessionId='+ses.id+'&pageSize=100'+(pt?'&pageToken='+pt:'')); items=items.concat(j.mediaItems||[]); pt=j.nextPageToken||''; }while(pt&&items.length<500);
  items=items.filter(x=>x.type!=='VIDEO'&&x.mediaFile&&x.mediaFile.baseUrl).slice(0,150);
  let ok=0;
  for(let i=0;i<items.length;i++){ status&&status(`Bringing in ${i+1} of ${items.length}…`); const mf=items[i].mediaFile, url=mf.baseUrl+'=w1600-h1600';
    let done=false;
    try{ const r=await fetch(url,{headers:{Authorization:'Bearer '+tok}}); if(r.ok){ const b=await r.blob(); done=(await albumAdd([new File([b],mf.filename||'Photo.jpg',{type:b.type||'image/jpeg'})],null,true))>0; } }catch(e){}
    if(!done){ const r=await helperDo('photo_fetch',{url,token:tok,name:(mf.filename||'Photo').replace(/\.[a-z]+$/i,'')+'.jpg',by:(mePerson()&&nm(mePerson()))||''}); done=!!(r&&r.ok); }
    if(done) ok++; }
  try{ await pickApi(tok,'sessions/'+ses.id,{method:'DELETE'}); }catch(e){}
  if(ok){ S.photoRev=Date.now(); save(); await saverFetch(); }
  return {ok,of:items.length};
}
async function photoDel(id){
  const r=await helperDo('photo_del',{id,folder:S.photoFolder}); if(!(r&&r.ok)){ toast(r&&r.error?r.error:/unknown|action/i.test(String(r&&r.error))?'The Reminder helper needs updating first':'Couldn’t delete it. Try again.'); return false; }
  try{ const c=await caches.open('fs-photos'); await c.delete('p/'+id); const l=(await saverPhotos()).filter(k=>k!==id); await c.put('list',new Response(JSON.stringify(l),{headers:{'Content-Type':'application/json'}})); }catch(e){}
  S.photoRev=Date.now(); lsSet('fs.photosAt',String(Date.now())); save(); return true; }
function openAlbum(){ gisLoad().catch(()=>{}); modal((m,close)=>{ m.classList.add('wide','tvsheet'); let urls=[];
  let pids=[];
  const draw=async()=>{ urls.forEach(u=>{ try{ URL.revokeObjectURL(u); }catch(e){} }); urls=[]; pids=[];
    const ids=await saverPhotos(); try{ const c=await caches.open('fs-photos'); for(const id of ids.slice(0,150)){ const r=await c.match('p/'+id); if(r){ urls.push(URL.createObjectURL(await r.blob())); pids.push(id); } } }catch(e){}
    if(!m.isConnected) return;
    m.innerHTML=`<div class="tvhead"><h2>📸 Family album</h2><button class="save" id="x">Done</button></div>
      <div class="aldrop" id="drop"><b>＋ Add photos</b><small>${isPhone()?'Take one, or choose several from your phone':'Drag photos here, or tap to choose'}</small></div>
      <div class="row" style="gap:8px;flex-wrap:wrap;margin:8px 0"><button class="cancel" id="gp">🖼️ Pick from Google Photos</button><button class="cancel" id="sync">🔄 Get the latest</button>${!isPhone()?'<button class="cancel" id="try">🌙 Show the photo frame</button>':''}</div>
      <input type="file" id="alC" accept="image/*" capture="environment" hidden><input type="file" id="alP" accept="image/*" multiple hidden>
      <p class="note" id="alS">${urls.length?urls.length+' photos on this screen. Everyone’s photos are kept in “Family Screen photos” in Google Drive.':'No photos yet. Add some from your phone and they appear here and in the fridge’s photo frame.'}</p>
      <div class="algrid">${urls.map((u,i)=>`<img src="${u}" alt="" loading="lazy" data-pi="${i}">`).join('')}</div>${urls.length?'<p class="note">Tap a photo to see it big or delete it.</p>':''}`;
    m.querySelectorAll('[data-pi]').forEach(im=>im.onclick=()=>photoView(+im.dataset.pi));
    const st=t=>{ const e=m.querySelector('#alS'); if(e) e.textContent=t; }, go=async fs=>{ await albumAdd(fs,st); draw(); };
    const C=m.querySelector('#alC'), P=m.querySelector('#alP'), dz=m.querySelector('#drop');
    dz.onclick=()=>isPhone()?photoChoice(C,P):P.click();
    C.onchange=P.onchange=e=>{ const fs=e.target.files; if(fs&&fs.length) go([...fs]); e.target.value=''; };
    dz.ondragover=e=>{ e.preventDefault(); dz.classList.add('on'); }; dz.ondragleave=()=>dz.classList.remove('on');
    dz.ondrop=e=>{ e.preventDefault(); dz.classList.remove('on'); go([...(e.dataTransfer.files||[])]); };
    m.querySelector('#x').onclick=()=>{ urls.forEach(u=>{ try{ URL.revokeObjectURL(u); }catch(e){} }); close(); };
    m.querySelector('#sync').onclick=async()=>{ st('Getting the latest photos…'); await saverFetch(true); draw(); };
    if(((+S.photoRev||0)>(+lsGet('fs.photosAt',0)||0)||(!urls.length&&(S.photoFolder||S.photoRev)))&&!m.dataset.pulled){ m.dataset.pulled='1'; st('Getting the latest photos…'); saverFetch().then(()=>{ if(m.isConnected) draw(); }); }
    m.querySelector('#gp').onclick=async e=>{ const b=e.currentTarget; b.disabled=true; st('Signing in to Google Photos…');
      let p; try{ p=await pickStart(); }catch(err){ b.disabled=false; st(err.message==='closed'?'Cancelled.':'Couldn’t open Google Photos: '+err.message); return; }
      b.disabled=false; b.textContent='📲 Open Google Photos and tick your photos'; st('Tap the button, tick the photos you want (search a name to find faces), then tap Done. Come back here and they’ll arrive.');
      b.onclick=async()=>{ window.open(p.ses.pickerUri+(isPhone()?'':'/autoclose'),'_blank'); b.disabled=true; b.textContent='Waiting for your picks…';
        try{ const r=await pickFinish(p,st); toast(r.ok?`${r.ok} photo${r.ok>1?'s':''} added from Google Photos`:'No photos came through'); }catch(err){ toast(err.message); }
        draw(); }; };
    const photoView=i=>{ const v=document.createElement('div'); v.className='alview';
      v.innerHTML=`<img src="${urls[i]}" alt=""><div class="row" style="gap:10px;justify-content:center"><button class="save bigback" id="vb">‹ Back</button><button class="cancel" id="vd">🗑️ Delete</button></div>`;
      m.appendChild(v); v.querySelector('#vb').onclick=()=>v.remove();
      v.querySelector('#vd').onclick=e=>{ const b=e.currentTarget;
        if(!b.dataset.sure){ b.dataset.sure='1'; b.textContent='🗑️ Yes, delete it for everyone'; b.style.background='#ffd6d6'; return; }
        b.disabled=true; b.textContent='Deleting…'; photoDel(pids[i]).then(ok=>{ v.remove(); if(ok){ toast('Photo deleted'); draw(); } }); }; };
    const t=m.querySelector('#try'); if(t) t.onclick=()=>{ close(); setTimeout(()=>{ hubIdle=Date.now(); saverOn(); },300); };
  };
  m.innerHTML='<p class="note">Opening the album…</p>'; draw(); }); }
// photos dropped anywhere on the fridge or a computer go to the album
document.addEventListener('dragover',e=>{ if(e.dataTransfer&&[...e.dataTransfer.types].includes('Files')) e.preventDefault(); });
document.addEventListener('drop',e=>{ if(e.defaultPrevented||!S.people.length||LOCAL) return; const fs=[...((e.dataTransfer&&e.dataTransfer.files)||[])].filter(f=>/^image\//.test(f.type)); if(!fs.length) return; e.preventDefault(); albumAdd(fs); });
