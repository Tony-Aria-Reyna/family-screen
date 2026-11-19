# 2.1 Settings in plain sections, the Health card with one-tap fixes, and the email addresses in Settings
import asyncio, json
from playwright.async_api import async_playwright
U='http://localhost:5500/index.html'; ADMIN='tonyandreynanz@gmail.com'
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); ctx=await b.new_context(timezone_id='Pacific/Auckland',locale='en-NZ')
        await ctx.add_init_script("(()=>{ let p=localStorage.getItem('perm')||'default'; Object.defineProperty(Notification,'permission',{get:()=>p}); Notification.requestPermission=async()=>{ p='granted'; localStorage.setItem('perm','granted'); return p; }; })()")
        errs=[]; P=await ctx.new_page(); P.on('pageerror',lambda e:errs.append(str(e))); await P.set_viewport_size({'width':390,'height':844})
        await P.goto(U); await P.wait_for_timeout(500)
        await P.evaluate("navigator.serviceWorker.register('sw.js')")
        await P.evaluate(f"localStorage.setItem('fs.askedMe',JSON.stringify(['{ADMIN}'])); SYNC.testSignIn('{ADMIN}')"); await P.wait_for_timeout(700)
        await P.click('#gNew'); await P.wait_for_timeout(900)
        # what the helper reported on its last run
        await P.evaluate("""(()=>{ const d=JSON.parse(localStorage.getItem('mockdb')); const k=Object.keys(d).find(x=>/^households\\/[^/]+$/.test(x));
          d[k].notifier={lastRun:Date.now()-120000,version:25,health:{reads:12345,readsHelper:9000,readsApp:3345,stale:['School calendar'],dropped:[],slow:0}}; d[k].voiceUrl='https://h/x'; d[k].voiceKey='k123456789012';
          localStorage.setItem('mockdb',JSON.stringify(d)); window.dispatchEvent(new StorageEvent('storage',{key:'mockdb'})); })()"""); await P.wait_for_timeout(800)
        await P.evaluate("openSettings()"); await P.wait_for_timeout(500)
        secs=await P.evaluate("[...document.querySelectorAll('.modal .shd')].map(x=>x.textContent)")
        print('1 sections:', secs)
        hc=await P.locator('#hcard').inner_text()
        print('2 health card:', hc.replace('\n',' / ')[:420])
        print('3 alerts fix button:', await P.locator('[data-hfix="alerts"]').count(), '| calendars fix:', await P.locator('[data-hfix="sync"]').count())
        await P.click('[data-hfix="alerts"]'); await P.wait_for_timeout(1500)
        print('4 after Turn on alerts:', (await P.locator('#hcard').inner_text()).replace('\n',' / ')[:200], '| phone registered', await P.evaluate("Object.keys(SYNC.getDevices()).length"))
        await P.click('[data-sgo="mail"]'); await P.wait_for_timeout(1500)
        print('5 email section in view:', await P.evaluate("(()=>{ const r=document.querySelector('#s-mail').getBoundingClientRect(); return r.top>=-5&&r.top<300; })()"))
        await P.fill('#ia','tony+family@gmail.com'); await P.click('#isv'); await P.wait_for_timeout(600)
        await P.fill('#be','tony+bills@gmail.com'); await P.click('#bs'); await P.wait_for_timeout(600)
        print('6 saved addresses:', await P.evaluate("[S.inboxEmail,S.billEmail]"), '| check-now buttons', await P.locator('#ick').count(), await P.locator('#bck').count())
        await P.evaluate("closeModal(); openSettings('shops')"); await P.wait_for_timeout(500)
        print('7 opens at Shops:', await P.evaluate("(()=>{ const r=document.querySelector('#s-shops').getBoundingClientRect(); return r.top>=-5&&r.top<300; })()"))
        print('8 people, PIN and accounts still there:', await P.locator('[data-pn]').count()>0, await P.locator('#pinSet').count(), await P.locator('#mAdd').count())
        print('errors:', errs)
        await b.close()
asyncio.run(main())
