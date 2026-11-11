import asyncio
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); ctx=await b.new_context(timezone_id='Pacific/Auckland',viewport={'width':1280,'height':800})
        F=await ctx.new_page(); errs=[]; F.on('pageerror',lambda e:errs.append(str(e)))
        await F.goto('http://localhost:5500/index.html'); await F.wait_for_timeout(300); await F.evaluate("localStorage.setItem('fs.askedMe',JSON.stringify(['tony@example.com','reyna@example.com'])); SYNC.testSignIn('tony@example.com')"); await F.wait_for_timeout(500); await F.click('#gNew'); await F.wait_for_timeout(700)
        # helper writes notifier + live onto the household doc
        await F.evaluate("""()=>{ const d=JSON.parse(localStorage.mockdb); const k=Object.keys(d).find(k=>/^households\\/[^/]+$/.test(k));
          d[k].notifier={lastRun:Date.now(),error:'',version:4,flights:{key:false,used:0,budget:280,error:''}}; d[k].live={x1:{status:'EnRoute',checked:Date.now()}};
          localStorage.mockdb=JSON.stringify(d); window.dispatchEvent(new StorageEvent('storage',{key:'mockdb'})); }""")
        await F.wait_for_timeout(500)
        print('S.live synced:', await F.evaluate("JSON.stringify(S.live)"))
        # change a setting in the app -> live must survive
        await F.evaluate("S.hideHotels=true; save();"); await F.wait_for_timeout(500)
        print('live kept after app saves settings:', await F.evaluate("""(()=>{ const d=JSON.parse(localStorage.mockdb); const k=Object.keys(d).find(k=>/^households\\/[^/]+$/.test(k)); return !!(d[k].live&&d[k].live.x1)&&d[k].hideHotels; })()"""))
        await F.click('#setBtn'); await F.wait_for_timeout(300); await F.click('#goNotify'); await F.wait_for_timeout(400)
        card=F.locator('.srccard:has(h4:has-text("Live flight status"))'); print('card (no key):', (await card.inner_text())[:160].replace('\n',' | '))
        await card.scroll_into_view_if_needed(); await F.screenshot(path='/tmp/live5.png')
        await F.evaluate("""()=>{ const d=JSON.parse(localStorage.mockdb); const k=Object.keys(d).find(k=>/^households\\/[^/]+$/.test(k)); d[k].notifier.flights={key:true,used:23,budget:280,error:''}; localStorage.mockdb=JSON.stringify(d); window.dispatchEvent(new StorageEvent('storage',{key:'mockdb'})); }""")
        await F.wait_for_timeout(400); await F.click('#ok'); await F.wait_for_timeout(1500); await F.click('#setBtn'); await F.wait_for_timeout(300); await F.click('#goNotify'); await F.wait_for_timeout(400)
        print('card (key set):', (await F.locator('.srccard:has(h4:has-text("Live flight status"))').inner_text()).replace('\n',' | '))
        print(errs); await b.close()
asyncio.run(main())
