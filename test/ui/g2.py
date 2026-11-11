import asyncio
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch()
        pg=await b.new_page(viewport={'width':1885,'height':940},timezone_id='Pacific/Auckland',locale='en-NZ')
        errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
        await pg.goto('http://localhost:5500/index.html?demo'); await pg.wait_for_timeout(600)
        await pg.click('#globeBtn'); await pg.wait_for_timeout(2300)
        print('card:', (await pg.locator('#gCard').inner_text()).replace('\n',' | '))
        await pg.screenshot(path='/tmp/g1.png')
        await pg.click('[data-z=in]'); await pg.click('[data-z=in]'); await pg.wait_for_timeout(300); await pg.screenshot(path='/tmp/g1z.png')
        await pg.click('#gMore'); await pg.wait_for_timeout(200); print('more menu:', await pg.locator('.modal').inner_text()); await pg.evaluate('closeModal()')
        print(errs); await b.close()
        b=await p.chromium.launch(); ctx=await b.new_context(viewport={'width':400,'height':820},has_touch=True,is_mobile=True,timezone_id='Pacific/Auckland')
        pg=await ctx.new_page(); await pg.goto('http://localhost:5500/index.html?demo'); await pg.wait_for_timeout(600); await pg.click('[data-tab=where]'); await pg.wait_for_timeout(2300)
        await pg.screenshot(path='/tmp/g2.png'); await b.close()
asyncio.run(main())
