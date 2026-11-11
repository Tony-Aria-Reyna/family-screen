import asyncio
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); pg=await b.new_page(viewport={'width':1885,'height':940}); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
        await pg.goto('http://localhost:5500/index.html?demo'); await pg.wait_for_timeout(500)
        await pg.click('#moreBtn'); await pg.wait_for_timeout(300); await pg.screenshot(path='/tmp/more1.png')
        await pg.click('[data-tile="0"]'); await pg.wait_for_timeout(300); print('bills open:', await pg.locator('h2:has-text("Bills")').count())
        pg2=await b.new_page(viewport={'width':400,'height':820}); pg2.on('pageerror',lambda e:errs.append(str(e))); await pg2.goto('http://localhost:5500/index.html?demo'); await pg2.wait_for_timeout(500)
        await pg2.click('#tabMore'); await pg2.wait_for_timeout(300); await pg2.screenshot(path='/tmp/more2.png')
        print(errs); await b.close()
asyncio.run(main())
