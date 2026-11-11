import asyncio
from playwright.async_api import async_playwright
U='http://localhost:5500/index.html'
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); ctx=await b.new_context(timezone_id='Pacific/Auckland',viewport={'width':1280,'height':800})
        F=await ctx.new_page(); errs=[]; F.on('pageerror',lambda e:errs.append(str(e)))
        await F.goto(U); await F.wait_for_timeout(300); await F.evaluate("localStorage.setItem('fs.askedMe',JSON.stringify(['tony@example.com','reyna@example.com'])); SYNC.testSignIn('tony@example.com')"); await F.wait_for_timeout(500); await F.click('#gNew'); await F.wait_for_timeout(600)
        await F.click('#setBtn'); await F.click('#pinSet'); await F.wait_for_timeout(150)
        for d in '2580': await F.click(f'.pinpad [data-k="{d}"]')
        await F.wait_for_timeout(150)
        for d in '2580': await F.click(f'.pinpad [data-k="{d}"]')
        await F.wait_for_timeout(500); print('back in settings after setting PIN:', await F.locator('#pinChange').count())
        await F.click('#goNotify'); await F.wait_for_timeout(300); print('moved to Notifications without PIN:', await F.locator('.pinpad').count()==0)
        await F.click('#ok'); await F.wait_for_timeout(1600)
        await F.click('#setBtn'); await F.wait_for_timeout(200); print('asks for PIN after closing:', await F.locator('.pinpad').count())
        print(errs); await b.close()
asyncio.run(main())
