import asyncio
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); errs=[]
        pg=await b.new_page(viewport={'width':400,'height':820}); pg.on('pageerror',lambda e:errs.append(str(e)))
        await pg.goto('http://localhost:5500/index.html?demo'); await pg.wait_for_timeout(700)
        print('tab:', await pg.evaluate('document.body.dataset.tab'), '| tabs:', await pg.locator('.tabbar button').count())
        print('today rows:', await pg.locator('#hToday .hln').count(), '| tiles:', await pg.locator('#phome .tile').count())
        print('subs:', await pg.locator('#phome [data-ht] small').all_inner_texts())
        await pg.screenshot(path='/tmp/home1.png', full_page=True)
        await pg.click('[data-ht="2"]'); await pg.wait_for_timeout(200); print('shop tab:', await pg.evaluate('document.body.dataset.tab'))
        await pg.click('.tabbar [data-tab="home"]'); await pg.wait_for_timeout(200)
        await pg.click('#hTmrw'); await pg.wait_for_timeout(300); print('cal tab:', await pg.evaluate('document.body.dataset.tab'), await pg.evaluate('pSel'))
        await pg.go_back(); await pg.wait_for_timeout(300); print('after back:', await pg.evaluate('document.body.dataset.tab'))
        await pg.click('.tabbar [data-tab="home"]'); await pg.wait_for_timeout(200)
        await pg.click('#phome [data-hm] >> text=Recipes'); await pg.wait_for_timeout(400); print('recipes open:', await pg.locator('#layer h2').count())
        big=await b.new_page(viewport={'width':1885,'height':940}); big.on('pageerror',lambda e:errs.append(str(e))); await big.goto('http://localhost:5500/index.html?demo'); await big.wait_for_timeout(500)
        print('fridge home hidden:', await big.evaluate("getComputedStyle(document.querySelector('#phome')).display"))
        print('errs', errs); await b.close()
asyncio.run(main())
