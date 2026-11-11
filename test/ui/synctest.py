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
        await F.goto(U); await F.wait_for_timeout(400); await F.screenshot(path='/tmp/s_gate.png')
        await F.evaluate("localStorage.setItem('fs.askedMe',JSON.stringify(['tony@example.com','reyna@example.com'])); SYNC.testSignIn('tony@example.com')"); await F.wait_for_timeout(500)
        print('fridge gate after signin:', await F.locator('#gate h1').count(), await F.locator('#gNew').count())
        await F.click('#gNew'); await F.wait_for_timeout(600)
        print('gate hidden:', await F.evaluate("document.getElementById('gate').hidden"), 'people:', await F.evaluate("S.people.map(p=>p.name).join(',')"))
        # add member
        await F.click('#setBtn'); await F.fill('#mIn','reyna@example.com'); await F.click('#mAdd'); await F.wait_for_timeout(500)
        await F.screenshot(path='/tmp/s_settings.png'); await F.click('#ok')
        # rename person 1
        P=await ctx.new_page(); mk(P,'phone'); await P.set_viewport_size({'width':400,'height':820})
        await P.goto(U); await P.wait_for_timeout(300); await P.evaluate("localStorage.setItem('fs.askedMe',JSON.stringify(['tony@example.com','reyna@example.com'])); SYNC.testSignIn('reyna@example.com')"); await P.wait_for_timeout(800)
        print('phone gate hidden:', await P.evaluate("document.getElementById('gate').hidden"))
        # fridge adds grocery
        await F.fill('#sIn','milk'); await F.press('#sIn','Enter'); await F.wait_for_timeout(300); await F.click('[data-pick=super]'); await F.wait_for_timeout(600)
        print('phone groceries:', await P.evaluate("S.groceries.map(g=>g.name+':'+g.done).join(',')"))
        await P.click('[data-tab=shop]'); await P.wait_for_timeout(200); await P.click('[data-g]'); await P.wait_for_timeout(600)
        print('fridge groceries after phone tick:', await F.evaluate("S.groceries.map(g=>g.name+':'+g.done).join(',')"))
        # phone adds todo
        await P.click('[data-tab=todo]'); await P.fill('#tIn','Fix the gate'); await P.press('#tIn','Enter'); await P.wait_for_timeout(200); await P.click('#tWho [data-nw="p2"]'); await P.wait_for_timeout(600)
        print('fridge todos:', await F.evaluate("S.todos.map(t=>t.title).join(',')"))
        # fridge typing should survive a sync re-render
        await F.fill('#tIn','half typ'); await P.click('[data-tab=shop]'); await P.fill('#sIn','bread'); await P.press('#sIn','Enter'); await P.click('[data-pick=super]'); await P.wait_for_timeout(600)
        print('fridge todo input kept:', await F.input_value('#tIn'))
        await F.fill('#tIn','')
        # fridge adds event, multi person
        await F.click('#addBtn'); await F.click('[data-who=p1]'); await F.click('[data-who=p3]'); await F.fill('#evTitle','Swimming lessons'); await F.click('#sBtn'); await F.wait_for_timeout(600)
        print('phone events:', await P.evaluate("S.events.map(e=>e.title+'/'+e.whos.join('+')).join(',')"))
        # rename
        await F.click('#setBtn'); await F.fill('[data-pn=p1]','Tony'); await F.press('[data-pn=p1]','Tab'); await F.wait_for_timeout(600); await F.click('#ok')
        print('phone people:', await P.evaluate("S.people.map(p=>p.name).join(',')"))
        # todo drag to calendar on fridge then check sync of eventId
        await F.wait_for_timeout(300)
        t=F.locator('[data-t]').first; tb=await t.bounding_box(); d=F.locator('#cal [data-drop]').nth(6); db=await d.bounding_box()
        await F.mouse.move(tb['x']+120,tb['y']+15); await F.mouse.down(); await F.mouse.move(db['x']+40,db['y']+300,steps=8); await F.mouse.up(); await F.wait_for_timeout(300)
        await F.click('[data-who=p2]'); await F.click('#sBtn'); await F.wait_for_timeout(700)
        print('phone todo booked:', await P.evaluate("S.todos.map(t=>t.title+':'+(t.eventId?'booked':'open')).join(',')"))
        await F.screenshot(path='/tmp/s_fridge.png'); await P.screenshot(path='/tmp/s_phone_todo.png')
        await P.click('[data-tab=cal]'); await P.wait_for_timeout(200); await P.screenshot(path='/tmp/s_phone_cal.png')
        # stranger
        X=await ctx.new_page(); mk(X,'stranger'); await X.goto(U); await X.wait_for_timeout(300); await X.evaluate("SYNC.testSignIn('stranger@example.com')"); await X.wait_for_timeout(600)
        print('stranger sees nohome:', await X.locator('#gCheck').count())
        # remove reyna -> phone should get kicked to nohome
        print('LAYER', await F.evaluate("document.querySelector('#layer').innerHTML.slice(0,120)")); await F.evaluate('closeModal()'); await F.click('#setBtn'); await F.click('[data-mrm="reyna@example.com"]'); await F.wait_for_timeout(800)
        print('phone after removal nohome:', await P.locator('#gCheck').count())
        print('errors:', errs[:8]); await b.close()
asyncio.run(main())
