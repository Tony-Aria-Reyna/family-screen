import asyncio
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); ctx=await b.new_context(viewport={'width':411,'height':860},has_touch=True,is_mobile=True,timezone_id='Pacific/Auckland')
        pg=await ctx.new_page(); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
        await pg.goto('http://localhost:5500/index.html?demo'); await pg.wait_for_timeout(600)
        await pg.evaluate("S.cards=[{id:'a',name:'Everyday Rewards',num:'9490043903320',fmt:'EAN13',color:'#f26a10',owner:''}]; save();"); await pg.wait_for_timeout(300)
        await pg.goto('http://localhost:5500/index.html?demo&open=cards'); await pg.wait_for_timeout(1200)
        print('shortcut cards -> wallet:', await pg.locator('#wallet').count(), '| url:', pg.url)
        await pg.goto('http://localhost:5500/index.html?demo&open=add'); await pg.wait_for_timeout(1200); print('shortcut add -> modal:', await pg.locator('.modal h2').inner_text())
        print(errs); await b.close()
asyncio.run(main())
