import asyncio
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); errs=[]
        pg=await b.new_page(viewport={'width':900,'height':1400}); pg.on('pageerror',lambda e:errs.append(str(e)))
        await pg.goto('http://localhost:5500/index.html?demo'); await pg.wait_for_timeout(600)
        await pg.evaluate("openHelp()"); await pg.wait_for_timeout(300); await pg.screenshot(path='/tmp/help_fridge.png')
        print('groups:', await pg.locator('.hgrp h4').all_inner_texts())
        print('rows:', await pg.locator('.hrow b').count())
        await pg.click('#x')
        pg2=await b.new_page(viewport={'width':400,'height':820},has_touch=True,is_mobile=True); pg2.on('pageerror',lambda e:errs.append(str(e)))
        await pg2.goto('http://localhost:5500/index.html?demo'); await pg2.wait_for_timeout(600)
        await pg2.click('#tabMore'); await pg2.wait_for_timeout(300)
        await pg2.click('[data-tile="0"]'); await pg2.wait_for_timeout(300); await pg2.screenshot(path='/tmp/help_phone.png')
        print(errs); await b.close()
asyncio.run(main())
