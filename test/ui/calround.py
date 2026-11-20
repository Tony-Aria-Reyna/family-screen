# Calendar round: details view, clash warning, drag to move with confirm, swipe weeks, minute tap, away bar, shopping
import asyncio, json
from playwright.async_api import async_playwright
U='http://localhost:5500/index.html'; ADMIN='tonyandreynanz@gmail.com'
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); ctx=await b.new_context(timezone_id='Pacific/Auckland',has_touch=True)
        errs=[]; P=await ctx.new_page(); P.on('pageerror',lambda e:errs.append(str(e))); await P.set_viewport_size({'width':1280,'height':800})
        await P.goto(U); await P.wait_for_timeout(400)
        await P.evaluate(f"localStorage.setItem('fs.askedMe',JSON.stringify(['{ADMIN}'])); SYNC.testSignIn('{ADMIN}')"); await P.wait_for_timeout(700)
        await P.click('#gNew'); await P.wait_for_timeout(1200)
        await P.evaluate("""S.people[0].name='Tony'; S.people[1].name='Reyna'; S.people[1].traveller=true; const t=dk(new Date()), tm=dk(addDays(new Date(),1)), d3=dk(addDays(new Date(),3));
          S.events.push({id:'a',title:'Dentist',date:tm,time:'10:00',dur:60,whos:['p1'],addr:'1 Queen St'}); S.events.push({id:'b',title:'Gym',date:tm,time:'15:00',dur:60,whos:['p1']});
          S.flights.push({id:'f1',who:'p2',from:'AKL',to:'YVR',flight:'NZ24',start:new Date(Date.now()+86400e3).toISOString().slice(0,11)+'03:00:00Z',end:new Date(Date.now()+86400e3).toISOString().slice(0,11)+'16:00:00Z'});
          S.flights.push({id:'f2',who:'p2',from:'YVR',to:'AKL',flight:'NZ23',start:new Date(Date.now()+4*86400e3).toISOString().slice(0,11)+'07:00:00Z',end:new Date(Date.now()+5*86400e3).toISOString().slice(0,11)+'00:30:00Z'});
          S.view='week'; weekOff=0; save(); renderAll();""")
        await P.wait_for_timeout(600)
        allrow=await P.evaluate("[...document.querySelectorAll('#cal .fw-all .fw-a')].map(x=>x.textContent)")
        print('1 away bars in the week:', allrow)
        await P.locator('#cal [data-ev="a"]').first.click(); await P.wait_for_timeout(300)
        print('2 tap shows details:', (await P.locator('.modal').inner_text()).replace('\n',' / ')[:200], '| form opened?', await P.locator('#evTitle').count())
        await P.screenshot(path='/tmp/c_details.png')
        await P.click('#ed'); await P.wait_for_timeout(300)
        # change the time onto the gym slot: clash
        await P.evaluate("document.querySelector('.modal').scrollTop=9999"); await P.wait_for_timeout(200)
        vis=await P.evaluate("(()=>{ const b=document.querySelector('#sBtn').getBoundingClientRect(); return b.bottom<=innerHeight&&b.top>=0; })()")
        print('3 Save button visible without scrolling:', vis)
        await P.screenshot(path='/tmp/c_form.png')
        await P.locator('#d0 .wheel').nth(1).locator('.wi.sel').click(); await P.wait_for_timeout(300)
        print('4 tap minutes focuses minutes:', await P.evaluate("document.activeElement&&document.activeElement.className"))
        await P.evaluate("closeModal()")
        ev=await P.evaluate("JSON.stringify(clashesFor({date:dk(addDays(new Date(),1)),time:'15:30',dur:60,whos:['p1']}).map(c=>c.who.name+':'+c.e.title))"); print('5 clash found:', ev)
        # drag Dentist to the next day at about 2pm with the mouse
        src=P.locator('#cal [data-ev="a"]').first; await src.scroll_into_view_if_needed(); await P.wait_for_timeout(200)
        bb=await src.bounding_box(); await P.mouse.move(bb['x']+10,bb['y']+10); await P.mouse.down(); await P.mouse.move(bb['x']+30,bb['y']+30,steps=4)
        await P.mouse.move(bb['x']+bb['width']*1.5,bb['y']+200,steps=10); await P.mouse.up(); await P.wait_for_timeout(400)
        print('6 confirm:', (await P.locator('.modal').inner_text()).replace('\n',' / ')[:200] if await P.locator('.modal').count() else 'none')
        await P.screenshot(path='/tmp/c_move.png')
        if await P.locator('#y').count(): await P.click('#y'); await P.wait_for_timeout(300)
        print('7 moved:', await P.evaluate("JSON.stringify((({date,time})=>({date,time}))(S.events.find(e=>e.id==='a')))"), 'expected day', await P.evaluate("dk(addDays(new Date(),2))"))
        # swipe the week
        lbl=await P.evaluate("$('#calhead .lbl').textContent")
        await P.evaluate("""(()=>{ const z=document.querySelector('#cal .fweek'); const mk=(t,x)=>new TouchEvent(t,{bubbles:true,touches:t==='touchend'?[]:[new Touch({identifier:1,target:z,clientX:x,clientY:300})],changedTouches:[new Touch({identifier:1,target:z,clientX:x,clientY:300})]}); z.dispatchEvent(mk('touchstart',900)); z.dispatchEvent(mk('touchend',500)); })()"""); await P.wait_for_timeout(400)
        print('8 swipe:', lbl, '→', await P.evaluate("$('#calhead .lbl').textContent"))
        await P.evaluate("weekOff=0; renderAll(); closeModal&&closeModal()")
        # shopping
        await P.evaluate("S.groceries.push({id:'g1',name:'Milk',shop:S.shops[0].id,done:true}); S.groceries.push({id:'g2',name:'Eggs',shop:S.shops[0].id,done:false}); save(); renderShop()"); await P.wait_for_timeout(300)
        print('9 shop chips hidden:', await P.evaluate("getComputedStyle(document.querySelector('#shopPanel .shops')).display"), '| filter button:', await P.locator('#shF').count(), '| ✕ on ticked:', await P.locator('[data-gx]').count(), '| clear:', await P.locator('#gClear').inner_text())
        await P.click('[data-gx="g1"]'); await P.wait_for_timeout(200); print('10 ✕ removed it:', await P.evaluate("S.groceries.map(g=>g.name)"))
        await P.click('#shF'); await P.wait_for_timeout(200); print('11 filter opens:', await P.evaluate("getComputedStyle(document.querySelector('#shopPanel .shops')).display"))
        await P.screenshot(path='/tmp/c_shop.png')
        print('errors:', errs)
        await b.close()
asyncio.run(main())
