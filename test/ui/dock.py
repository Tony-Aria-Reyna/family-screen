import asyncio
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch()
        pg=await b.new_page(viewport={'width':1885,'height':940},timezone_id='Pacific/Auckland',locale='en-NZ')
        errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
        await pg.goto('http://localhost:5500/index.html?demo'); await pg.wait_for_timeout(600)
        # squeeze columns
        await pg.evaluate("LAY.t=240;LAY.s=240;applyLayout()"); await pg.wait_for_timeout(200)
        for id in ['T','S']:
            bb=await pg.locator(f'[data-hidep={id}]').bounding_box(); print(id,'button visible box', bb and round(bb['x']), bb and round(bb['width']))
        await pg.screenshot(path='/tmp/dock0.png',clip={'x':1100,'y':0,'width':785,'height':200})
        await pg.click('[data-hidep=T]'); await pg.wait_for_timeout(300)
        print('cols:', await pg.evaluate("$('.app').style.gridTemplateColumns"))
        await pg.screenshot(path='/tmp/dock1.png')
        await pg.click('[data-hidep=S]'); await pg.wait_for_timeout(2800)
        print('cols both:', await pg.evaluate("$('.app').style.gridTemplateColumns")); await pg.screenshot(path='/tmp/dock2.png')
        await pg.click('[data-showp=T]'); await pg.wait_for_timeout(300); print('after restore T:', await pg.evaluate("$('.app').style.gridTemplateColumns"))
        await pg.set_viewport_size({'width':1280,'height':800}); await pg.wait_for_timeout(300)
        print('medium, shop hidden:', await pg.evaluate("$('.app').style.gridTemplateColumns")); await pg.screenshot(path='/tmp/dock3.png')
        await pg.click('[data-showp=S]')
        print(errs); await b.close()
asyncio.run(main())
