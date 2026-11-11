import asyncio
from playwright.async_api import async_playwright
U='http://localhost:5500/index.html'
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); ctx=await b.new_context(timezone_id='Pacific/Auckland')
        errs=[]
        def mk(pg,t): pg.on('pageerror',lambda e:errs.append(t+': '+str(e)))
        F=await ctx.new_page(); mk(F,'tony'); await F.set_viewport_size({'width':1280,'height':800})
        await F.goto(U); await F.wait_for_timeout(400); await F.evaluate("SYNC.testSignIn('tony@example.com')"); await F.wait_for_timeout(500)
        await F.click('#gNew'); await F.wait_for_timeout(600)
        await F.click('#setBtn'); await F.fill('#mIn','reyna@example.com'); await F.click('#mAdd'); await F.wait_for_timeout(400); await F.click('#ok'); await F.wait_for_timeout(1800)
        if await F.locator('text=Which one is you?').count(): await F.click('.opts [data-mep=p1]')
        await F.wait_for_timeout(300)
        # meal + renewal sync
        await F.evaluate("planMeal(dk(new Date()),'dinner',recipeById('s-spag-bol')); S.renewals.push({id:'w1',emoji:'🚗',what:'WOF',due:dk(addDays(new Date(),5)),every:12}); save()")
        await F.evaluate("openGifts()"); await F.wait_for_timeout(300)
        print('viewer dialog:', await F.locator('text=Who can see gift ideas?').count())
        await F.click('#s'); await F.wait_for_timeout(3000)
        print('tony canSee:', await F.evaluate("SYNC.canSee('gifts')"), 'viewers:', await F.evaluate("S.giftViewers"))
        if await F.locator('#gi').count():
            await F.fill('#gi','Bike helmet'); await F.press('#gi','Enter'); await F.wait_for_timeout(800)
        print('tony gifts:', await F.evaluate("S.gifts.map(g=>g.idea)"))
        R=await ctx.new_page(); mk(R,'reyna'); await R.set_viewport_size({'width':400,'height':820})
        await R.goto(U); await R.wait_for_timeout(300); await R.evaluate("SYNC.testSignIn('reyna@example.com')"); await R.wait_for_timeout(2000)
        print('reyna meals:', await R.evaluate("S.meals.map(m=>m.rid)"), 'renewals:', await R.evaluate("S.renewals.map(r=>r.what)"))
        print('reyna gifts (should be empty):', await R.evaluate("S.gifts.length"), 'canSee', await R.evaluate("SYNC.canSee('gifts')"))
        await R.evaluate("closeModal&&closeModal(); openGifts()"); await R.wait_for_timeout(300)
        print('reyna sees:', (await R.locator('.modal').inner_text())[:90].replace('\n',' | '))
        await R.evaluate("closeModal()")
        await F.evaluate("S.giftViewers=['tony@example.com','reyna@example.com']; save()"); await R.wait_for_timeout(2500)
        print('reyna after added:', await R.evaluate("S.gifts.map(g=>g.idea)"), await R.evaluate("SYNC.canSee('gifts')"))
        print('gate hidden reyna:', await R.evaluate("document.getElementById('gate').hidden"))
        print(errs); await b.close()
asyncio.run(main())
