import asyncio
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch()
        ctx=await b.new_context(viewport={'width':411,'height':860},timezone_id='America/Los_Angeles',locale='en-US',has_touch=True,is_mobile=True)
        pg=await ctx.new_page(); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
        await pg.goto('http://localhost:5500/index.html?demo'); await pg.wait_for_timeout(800)
        r=await pg.evaluate("""()=>{ const n=new Date(); return {away:AWAY_TZ, here:HERE, nzHour:n.getHours(), nzKey:dk(n), real:new Intl.DateTimeFormat('en-NZ',{timeZone:'Pacific/Auckland',hour:'numeric',hour12:false}).format(n), la:new Intl.DateTimeFormat('en-US',{timeZone:'America/Los_Angeles',hour:'numeric',hour12:false}).format(n),
          kd:dk(kd('2026-11-07')), add:dk(addDays(kd('2026-11-07'),1)), mon:dk(monday(kd('2026-11-07'))), parse:new Date('2026-11-07T16:30').toISOString(), ctor:new Date(2026,10,7,16,30).toISOString() }; }""")
        print(r)
        print('phone top:', (await pg.locator('#phoneTop').inner_text()).replace('\n',' | '))
        await pg.screenshot(path='/tmp/tz1.png')
        # add event in LA time
        await pg.click('#pcFab'); await pg.wait_for_timeout(400)
        await pg.fill('#evTitle','Test LA'); await pg.locator('[data-who]').first.click()
        print('eq (nz mode):', await pg.locator('#zoneEq').inner_text())
        await pg.click('[data-zone=here]'); await pg.wait_for_timeout(600)
        print('eq (here mode):', await pg.locator('#zoneEq').inner_text())
        await pg.screenshot(path='/tmp/tz2.png')
        await pg.click('#sBtn'); await pg.wait_for_timeout(300)
        print('saved:', await pg.evaluate("JSON.stringify(S.events.find(e=>e.title==='Test LA'))"))
        print(errs); await b.close()
asyncio.run(main())
