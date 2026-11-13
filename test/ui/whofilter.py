import asyncio
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); errs=[]
        # phone with two people hidden (as left by the old bug)
        ctx=await b.new_context(viewport={'width':400,'height':820},has_touch=True,is_mobile=True,timezone_id='Pacific/Auckland')
        pg=await ctx.new_page(); pg.on('pageerror',lambda e:errs.append(str(e)))
        await pg.goto('http://localhost:5500/index.html?demo'); await pg.wait_for_timeout(500)
        await pg.evaluate("S.people.find(p=>p.id==='p2').show=false; S.people.find(p=>p.id==='p3').show=false; savePrefs(); renderAll()"); await pg.wait_for_timeout(500)
        print('hidden on load:', await pg.evaluate("hiddenPeople().map(p=>p.name)"))
        print('note shown:', await pg.locator('.fnote').count(), '| badge:', await pg.locator('#pcWho i').inner_text())
        await pg.screenshot(path='/tmp/who_phone1.png')
        await pg.click('#pcWho'); await pg.wait_for_timeout(250); await pg.screenshot(path='/tmp/who_phone2.png')
        await pg.click('[data-who="p2"]'); await pg.wait_for_timeout(150)
        print('after re-showing p2:', await pg.evaluate("hiddenPeople().map(p=>p.name)"))
        await pg.click('#all'); await pg.wait_for_timeout(150); await pg.click('#ok'); await pg.wait_for_timeout(250)
        print('after show everyone:', await pg.evaluate("hiddenPeople().length"), '| note gone:', await pg.locator('.fnote').count()==0, '| stored:', await pg.evaluate("localStorage.getItem('fs.hidden')"))
        # can't hide everyone
        await pg.click('#pcWho'); await pg.wait_for_timeout(200)
        for pid in ['p1','p2','p3','p4','all']: await pg.click(f'[data-who="{pid}"]'); await pg.wait_for_timeout(80)
        print('left showing:', await pg.evaluate("S.people.filter(p=>p.show).map(p=>p.name)"))
        await pg.click('#ok')
        # week view gets the button too
        await pg.click('[data-pv="week"]'); await pg.wait_for_timeout(300); print('week has 👥:', await pg.locator('#pcWho').count())
        # fridge
        pg2=await b.new_page(viewport={'width':1885,'height':940}); pg2.on('pageerror',lambda e:errs.append(str(e)))
        await pg2.goto('http://localhost:5500/index.html?demo'); await pg2.wait_for_timeout(500); await pg2.evaluate("S.people.find(p=>p.id==='p3').show=false; savePrefs(); renderAll()"); await pg2.wait_for_timeout(400)
        print('fridge show-all chip:', await pg2.locator('#bar [data-showall]').count())
        await pg2.screenshot(path='/tmp/who_fridge.png',clip={'x':0,'y':120,'width':1100,'height':80})
        await pg2.click('#bar [data-showall]'); await pg2.wait_for_timeout(200)
        print('fridge after:', await pg2.evaluate("hiddenPeople().length"), await pg2.locator('#bar [data-showall]').count())
        print(errs); await b.close()
asyncio.run(main())
