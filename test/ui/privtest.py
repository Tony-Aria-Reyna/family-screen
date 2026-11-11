import asyncio
from playwright.async_api import async_playwright
U='http://localhost:5500/index.html'
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); ctx=await b.new_context(timezone_id='Pacific/Auckland',locale='en-NZ')
        errs=[]
        def mk(pg,tag):
            pg.on('pageerror',lambda e:errs.append(tag+': '+str(e))); pg.on('console',lambda m: errs.append(tag+' console: '+m.text) if m.type=='error' else None)
        F=await ctx.new_page(); mk(F,'fridge'); await F.set_viewport_size({'width':1280,'height':800})
        await F.goto(U); await F.wait_for_timeout(400)
        await F.evaluate("SYNC.testSignIn('tony@example.com')"); await F.wait_for_timeout(500)
        await F.click('#gNew'); await F.wait_for_timeout(600)
        await F.click('#setBtn'); await F.fill('#mIn','reyna@example.com'); await F.click('#mAdd'); await F.wait_for_timeout(400); await F.click('#ok')
        await F.wait_for_timeout(1800)
        print('ask modal on fridge:', await F.locator('text=Which one is you?').count())
        await F.click('.opts [data-mep=p1]'); await F.wait_for_timeout(400)
        print('people emails:', await F.evaluate("S.people.map(p=>p.name+':'+(p.email||'')).join(',')"))
        T=await ctx.new_page(); mk(T,'tonyphone'); await T.set_viewport_size({'width':400,'height':820})
        await T.goto(U); await T.wait_for_timeout(300); await T.evaluate("SYNC.testSignIn('tony@example.com')"); await T.wait_for_timeout(2200)
        print('tony phone asked again (should be 0):', await T.locator('text=Which one is you?').count())
        # Tony adds private event
        await T.evaluate("openAdd()"); await T.wait_for_timeout(300)
        await T.click('#whoBox [data-who=p1]'); await T.fill('#evTitle','Secret dentist'); await T.click('#privBtn'); await T.click('#sBtn'); await T.wait_for_timeout(700)
        # Tony adds private job and a job for Reyna
        await T.click('[data-tab=todo]'); await T.click('#tLock'); await T.fill('#tIn','Buy anniversary gift'); await T.press('#tIn','Enter'); await T.wait_for_timeout(300)
        await T.click('#tLock'); await T.click('[data-tw=p2]'); await T.fill('#tIn','Book flights home'); await T.press('#tIn','Enter'); await T.wait_for_timeout(700)
        await T.screenshot(path='/tmp/pv_tonytodo.png')
        print('tony sees events:', await T.evaluate("S.events.filter(vis).map(e=>e.title+(e.priv?'*':'')).join(',')"))
        print('tony todos:', await T.evaluate("S.todos.map(t=>t.title+(t.priv?'*':'')+' who='+t.who+' from='+(t.from||'')).join(' | ')"))
        print('db keys:', await T.evaluate("Object.keys(localStorage).filter(k=>k.includes('private')).join(' ; ')"))
        R=await ctx.new_page(); mk(R,'reyna'); await R.set_viewport_size({'width':400,'height':820})
        await R.goto(U); await R.wait_for_timeout(300); await R.evaluate("SYNC.testSignIn('reyna@example.com')"); await R.wait_for_timeout(2200)
        if await R.locator('text=Which one is you?').count(): await R.click('.opts [data-mep=p2]'); await R.wait_for_timeout(400)
        print('reyna events:', await R.evaluate("S.events.map(e=>e.title).join(',')"))
        print('reyna todos:', await R.evaluate("S.todos.map(t=>t.title+' from='+(t.from||'')).join(' | ')"))
        await R.click('[data-tab=todo]'); await R.wait_for_timeout(300); await R.screenshot(path='/tmp/pv_reynatodo.png')
        print('fridge (tony) shows private?:', await F.evaluate("S.events.filter(e=>e.priv).length"), 'visible:', await F.evaluate("S.events.filter(vis).filter(e=>e.priv).length"), await F.evaluate("S.todos.filter(vis).map(t=>t.title).join(',')"))
        # edit private toggle off on job -> moves to shared
        await T.evaluate("openTodo(S.todos.find(t=>t.priv))"); await T.wait_for_timeout(300); await T.click('#privBtn'); await T.click('#sBtn'); await T.wait_for_timeout(800)
        print('reyna todos after unprivate:', await R.evaluate("S.todos.map(t=>t.title).join(',')"))
        await T.click('[data-tw=""]'); await T.wait_for_timeout(200); await T.screenshot(path='/tmp/pv_tonyall.png')
        print('errors:', errs)
        await b.close()
asyncio.run(main())
