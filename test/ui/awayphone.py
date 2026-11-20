# The traveller's own phone while she is abroad: Home reads properly, the bottom bar works, and the safety net pulls the
# bar back into view if the bottom of the page is hidden (but not while typing). Then the same days seen from home.
import asyncio
from playwright.async_api import async_playwright
U='http://localhost:5500/index.html'; ADMIN='tonyandreynanz@gmail.com'
SEED="""(()=>{ S.people[0].name='Tony'; S.people[0].email=EMAIL0; S.people[1].name='Reyna'; S.people[1].email=EMAIL1; S.people[1].traveller=true; S.people[1].nick='Mummy'; S.people[2].name='Aria';
  const iso=d=>new Date(d).toISOString(), R=S.people[1].id;
  S.flights.push({id:'f1',who:R,flight:'NZ87',from:'AKL',to:'HKG',start:iso('2026-11-19T23:59:00+13:00'),end:iso('2026-11-20T11:30:00+13:00')},{id:'f2',who:R,flight:'NZ80',from:'HKG',to:'AKL',start:iso('2026-11-21T22:45:00+13:00'),end:iso('2026-11-22T09:45:00+13:00')});
  S.events.push({id:'e1',title:'Piano',date:'2026-11-21',time:'11:30',dur:30,whos:[S.people[2].id]}); save(); setTab('home'); })()"""
async def run(b, tz, me_is_traveller, fake_gap):
    ctx=await b.new_context(viewport={'width':411,'height':800},device_scale_factor=2,is_mobile=True,has_touch=True,timezone_id=tz)
    if fake_gap: await ctx.add_init_script("Object.defineProperty(window,'visualViewport',{value:{get height(){ return innerHeight-%d; },offsetTop:0,scale:1,addEventListener(){}}});"%fake_gap)
    P=await ctx.new_page(); errs=[]; P.on('pageerror',lambda e:errs.append(str(e)))
    await P.clock.install(time='2026-11-21T09:03:00+13:00'); await P.goto(U); await P.clock.run_for(500)
    await P.evaluate(f"localStorage.setItem('fs.askedMe',JSON.stringify(['{ADMIN}'])); SYNC.testSignIn('{ADMIN}')"); await P.clock.run_for(900)
    await P.click('#gNew'); await P.clock.run_for(1200)
    e0,e1=("'t@example.com'",f"'{ADMIN}'") if me_is_traveller else (f"'{ADMIN}'","'r@example.com'")
    await P.evaluate(SEED.replace('EMAIL0',e0).replace('EMAIL1',e1)); await P.clock.run_for(6000)
    bar=lambda: P.evaluate("(()=>{ const r=document.querySelector('.tabbar').getBoundingClientRect(); return [Math.round(r.top),Math.round(r.bottom),innerHeight]; })()")
    print(' me:', await P.evaluate("nm(mePerson())"), '| today:', await P.evaluate("[...document.querySelectorAll('#hToday .hln')].map(x=>x.textContent)"), '| tomorrow:', await P.evaluate("[...document.querySelectorAll('#hTmrw .hln')].map(x=>x.textContent)"))
    if me_is_traveller: print(' her own card:', await P.evaluate("[...document.querySelectorAll('#hPers .hln')].map(x=>x.textContent)"), '| gap between cards px:', await P.evaluate("Math.round(document.querySelector('#hToday').getBoundingClientRect().top-document.querySelector('#hPers').getBoundingClientRect().bottom)"))
    print(' bottom bar [top,bottom,screen]:', await bar())
    if fake_gap:
        await P.evaluate("document.querySelector('#hAdd input, #hAdd textarea').focus()"); await P.clock.run_for(6000); print(' while typing (left alone):', await bar())
        await P.evaluate("document.activeElement.blur()"); await P.clock.run_for(6000); print(' after typing:', await bar())
    await P.click('.tabbar [data-tab=cal]'); await P.clock.run_for(500); print(' Calendar tab works:', await P.evaluate("document.body.dataset.tab"), '| errors:', errs)
    await ctx.close()
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch()
        print('A her phone in Hong Kong'); await run(b,'Asia/Hong_Kong',True,0)
        print('B her phone, bottom 180px of the page hidden'); await run(b,'Asia/Hong_Kong',True,180)
        print('C seen from home on Tony\'s phone'); await run(b,'Pacific/Auckland',False,0)
        await b.close()
asyncio.run(main())
