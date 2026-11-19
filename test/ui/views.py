# 3.1 views: the big and simple screen (Japanese/English), a person's card on Home, device language saved for alerts
import asyncio, json
from playwright.async_api import async_playwright
U='http://localhost:5500/index.html'; ADMIN='tonyandreynanz@gmail.com'
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); ctx=await b.new_context(timezone_id='Pacific/Auckland',locale='en-NZ')
        await ctx.add_init_script("(()=>{ let p=localStorage.getItem('perm')||'default'; Object.defineProperty(Notification,'permission',{get:()=>p}); Notification.requestPermission=async()=>{ p='granted'; localStorage.setItem('perm','granted'); return p; }; })()")
        errs=[]; P=await ctx.new_page(); P.on('pageerror',lambda e:errs.append(str(e))); await P.set_viewport_size({'width':390,'height':844})
        await P.goto(U); await P.wait_for_timeout(500); await P.evaluate("navigator.serviceWorker.register('sw.js')")
        await P.evaluate(f"localStorage.setItem('fs.askedMe',JSON.stringify(['{ADMIN}'])); SYNC.testSignIn('{ADMIN}')"); await P.wait_for_timeout(700)
        await P.click('#gNew'); await P.wait_for_timeout(900)
        await P.evaluate("""S.people[0].name='Tony'; S.people[0].email='tonyandreynanz@gmail.com'; S.people[3].name='Masako'; S.people[3].role='Machan';
          const t=dk(new Date()); S.events.push({id:'e1',title:'病院',date:t,time:'10:30',whos:[S.people[3].id],dur:60}); S.todos.push({id:'t1',title:'Water the plants',done:false,who:S.people[3].id});
          S.groceries.push({id:'g1',name:'Tofu',shop:S.shops[0].id,done:false}); S.bills=[{id:'b1',status:'due',biller:'Mercury',amount:18240,due:dk(addDays(new Date(),3))}]; save(); setTab('home');"""); await P.wait_for_timeout(600)
        print('1 Tony’s bills card on Home:', (await P.locator('#hBills').inner_text()).replace('\n',' / ') if await P.locator('#hBills').count() else None)
        await P.evaluate("openMore()"); await P.wait_for_timeout(300)
        print('1b More has the tile:', await P.locator('.tile', has_text='Big and simple').count()); await P.evaluate("[...document.querySelectorAll('.tile')].find(t=>/Big and simple/.test(t.textContent)).click()"); await P.wait_for_timeout(300)
        await P.locator('[data-w]', has_text='Masako').click(); await P.wait_for_timeout(200)
        await P.click('#ok'); await P.wait_for_timeout(600)
        print('2 simple screen in Japanese:', (await P.locator('#simple').inner_text()).replace('\n',' / ')[:260])
        await P.screenshot(path='/tmp/simple_ja.png')
        await P.locator('[data-st^="todos"]').first.click(); await P.wait_for_timeout(300)
        print('3 ticked, toast:', await P.locator('#sToast').inner_text(), '| done:', await P.evaluate("S.todos.find(t=>t.id==='t1').done"))
        await P.click('#sToast button'); await P.wait_for_timeout(300); print('4 undo:', await P.evaluate("S.todos.find(t=>t.id==='t1').done"))
        await P.click('#sLang'); await P.wait_for_timeout(300); print('5 English now:', (await P.locator('#simple h3').first.inner_text()))
        await P.click('#sLang'); await P.click('#sMsg'); await P.wait_for_timeout(400); print('6 messages open above it:', await P.evaluate("(()=>{ const s=document.querySelector('.scrim'); if(!s) return false; const r=s.getBoundingClientRect(); return document.elementFromPoint(r.width/2,r.height/2)!==document.querySelector('#simple') })()"))
        await P.evaluate("closeModal()")
        await P.evaluate("turnOnPush()"); await P.wait_for_timeout(1200)
        print('7 phone saved as Japanese for alerts:', await P.evaluate("(()=>{ const d=SYNC.getDevices(); return Object.values(d).map(x=>x.lang) })()"))
        await P.click('#sNormal'); await P.wait_for_timeout(400); print('8 back to normal:', await P.locator('#simple').count())
        print('errors:', errs)
        await b.close()
asyncio.run(main())
