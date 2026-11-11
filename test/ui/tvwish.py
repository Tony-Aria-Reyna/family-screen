import asyncio
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); pg=await b.new_page(viewport={'width':1885,'height':940},timezone_id='Pacific/Auckland')
        errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
        await pg.goto('http://localhost:5500/index.html?demo'); await pg.wait_for_timeout(600)
        await pg.evaluate("S.visited={'Japan':['p1','p2','p3','p4'],'Australia':['p1','p2','p4'],'Fiji':['p3']}; save()")
        await pg.click('#globeBtn'); await pg.wait_for_timeout(500); await pg.click('[data-gm="1"]'); await pg.wait_for_timeout(1500)
        await pg.click('#tvEdit'); await pg.wait_for_timeout(200)
        await pg.click('#tvWho [data-who=p4]'); 
        await pg.fill('#tvQ','peru'); await pg.click('.tvp[data-k="Peru"][data-p="⭐"]')
        await pg.fill('#tvQ','canada'); await pg.click('.tvp[data-k="Canada"][data-p="⭐"]')
        await pg.fill('#tvQ','fiji'); await pg.click('.tvp[data-k="Fiji"][data-p="⭐"]')
        await pg.fill('#tvQ',''); await pg.wait_for_timeout(100); await pg.screenshot(path='/tmp/tvw_list.png')
        await pg.click('#ok'); await pg.wait_for_timeout(300)
        await pg.evaluate("document.querySelector('#gCard')"); 
        print('card:', (await pg.locator('.tvcard').inner_text()).replace('\n',' | '))
        print('state:', await pg.evaluate("JSON.stringify({w:S.wish,off:S.tvOff,trav:travellers().map(p=>p.id),jp:visitedBy('Japan')})"))
        await pg.screenshot(path='/tmp/tvw1.png'); print(errs); await b.close()
asyncio.run(main())
