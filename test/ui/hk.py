import asyncio
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); pg=await b.new_page(viewport={'width':1885,'height':940},timezone_id='Pacific/Auckland')
        errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
        mode={'v':'old'}
        async def handle(route):
            body={'old':'not allowed','other':'not allowed · helper key ends zzzz','ok':'bad link'}[mode['v']]
            await route.fulfill(status=200,body=body,headers={'Access-Control-Allow-Origin':'*'})
        await pg.route('**/script.google.com/**',handle)
        await pg.goto('http://localhost:5500/index.html?demo'); await pg.wait_for_timeout(600)
        await pg.evaluate("S.linkHelper=null; openHelperSetup()"); await pg.wait_for_timeout(300)
        k1=await pg.evaluate("S.linkHelper.key"); await pg.evaluate("closeModal()"); await pg.wait_for_timeout(200)
        await pg.evaluate("openHelperSetup()"); await pg.wait_for_timeout(300); k2=await pg.evaluate("S.linkHelper.key")
        print('key stays the same across openings:', k1==k2, '| code has key:', k1 in await pg.locator('.modal pre').text_content())
        await pg.fill('#hUrl','https://script.google.com/macros/s/ABC/exec')
        for v in ['old','other','ok']:
            mode['v']=v; await pg.click('#hS'); await pg.wait_for_timeout(400)
            open_=await pg.locator('.modal #hUrl').count()
            print(v,'->', (await pg.locator('#hErr').inner_text()) if open_ else 'closed (working)')
        print(errs); await b.close()
asyncio.run(main())
