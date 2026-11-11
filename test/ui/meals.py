import asyncio, json
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); pg=await b.new_page(viewport={'width':1885,'height':940},timezone_id='Pacific/Auckland',locale='en-NZ')
        errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
        await pg.goto('http://localhost:5500/index.html?demo'); await pg.wait_for_timeout(700)
        await pg.click('#mealBtn'); await pg.wait_for_timeout(300)
        await pg.screenshot(path='/tmp/m1.png')
        # pick dinner for first day
        await pg.locator('[data-pick$="|dinner"]').first.click(); await pg.wait_for_timeout(200)
        await pg.screenshot(path='/tmp/m_pick.png')
        await pg.fill('#q','nachos'); await pg.wait_for_timeout(100)
        await pg.locator('[data-rid]').first.click(); await pg.wait_for_timeout(300)
        await pg.locator('[data-pick$="|dinner"]').first.click(); await pg.wait_for_timeout(200)
        await pg.locator('[data-rid="s-butter-chicken"]').click(); await pg.wait_for_timeout(200)
        await pg.locator('[data-pick$="|dinner"]').first.click(); await pg.wait_for_timeout(200)
        await pg.click('#note'); await pg.fill('#n','Takeaways'); await pg.click('#s'); await pg.wait_for_timeout(200)
        print('meals:', await pg.evaluate("JSON.stringify(S.meals.map(m=>[m.date,m.slot,m.rid||m.note,m.serves]))"))
        await pg.screenshot(path='/tmp/m2.png')
        # open recipe, fav, scale
        await pg.locator('[data-meal]').first.click(); await pg.wait_for_timeout(300)
        await pg.screenshot(path='/tmp/m_rec.png'); await pg.click('#fav'); await pg.click('#sp'); await pg.wait_for_timeout(100)
        await pg.screenshot(path='/tmp/m_rec.png')
        await pg.click('#cook'); await pg.wait_for_timeout(300); await pg.screenshot(path='/tmp/m_cook0.png')
        await pg.click('#cn'); await pg.click('#cn'); await pg.wait_for_timeout(100)
        if await pg.locator('#tm').count(): await pg.click('#tm')
        await pg.screenshot(path='/tmp/m_cook2.png'); await pg.click('#cookmode #cx')
        # shopping
        await pg.click('#mShop'); await pg.wait_for_timeout(300); await pg.screenshot(path='/tmp/m_shop.png')
        await pg.click('#s'); await pg.wait_for_timeout(300)
        print('groceries:', await pg.evaluate("S.groceries.filter(g=>g.meal).map(g=>g.name).join(' | ')"))
        print('shopped:', await pg.evaluate("S.meals.filter(m=>m.shopped).length"))
        # recipe editor parse
        print('parse:', await pg.evaluate("JSON.stringify(['500 g beef mince','1 1/2 cups milk','2 cloves garlic','1 brown onion','salt (pantry)','1.5kg potatoes','½ tsp cumin'].map(parseIng))"))
        await pg.click('#mClose')
        # renewals
        await pg.evaluate("S.renewals=[{id:'r1',emoji:'🚗',what:'WOF',item:'Mazda',due:dk(addDays(new Date(),9)),every:12},{id:'r2',emoji:'🏠',what:'House insurance',item:'',due:dk(addDays(new Date(),-2)),every:12,cost:'2100'}]; save(); renderAll()")
        await pg.wait_for_timeout(300); await pg.screenshot(path='/tmp/m_todo.png')
        await pg.locator('#todoPanel [data-rn="r1"]').click(); await pg.wait_for_timeout(200); await pg.screenshot(path='/tmp/m_rn.png')
        await pg.click('#dn'); await pg.wait_for_timeout(200)
        print('rolled:', await pg.evaluate("S.renewals[0].due"))
        await pg.evaluate("closeModal()")
        # gifts in demo
        await pg.evaluate("openGifts()"); await pg.wait_for_timeout(300)
        if await pg.locator('#gi').count():
            await pg.fill('#gi','lego friends treehouse'); await pg.press('#gi','Enter'); await pg.wait_for_timeout(200)
            await pg.screenshot(path='/tmp/m_gift.png')
        print('gifts:', await pg.evaluate("JSON.stringify(S.gifts)"))
        print(errs); await b.close()
        b=await p.chromium.launch(); ctx=await b.new_context(viewport={'width':400,'height':820},has_touch=True,is_mobile=True,timezone_id='Pacific/Auckland')
        pg=await ctx.new_page(); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
        await pg.goto('http://localhost:5500/index.html?demo'); await pg.wait_for_timeout(600)
        await pg.evaluate("S.meals=[{id:'a',date:dk(new Date()),slot:'dinner',rid:'s-spag-bol',serves:4},{id:'b',date:dk(addDays(new Date(),1)),slot:'dinner',rid:'s-fish-chips',serves:3},{id:'c',date:dk(addDays(new Date(),1)),slot:'lunch',note:'School lunch'}]; save()")
        await pg.click('[data-tab=meals]'); await pg.wait_for_timeout(400); await pg.screenshot(path='/tmp/m_phone.png')
        await pg.click('[data-meal=a]'); await pg.wait_for_timeout(300); await pg.screenshot(path='/tmp/m_phone_rec.png')
        await pg.click('#cook'); await pg.click('#cn'); await pg.wait_for_timeout(200); await pg.screenshot(path='/tmp/m_phone_cook.png')
        print('phone errs', errs); await b.close()
asyncio.run(main())
