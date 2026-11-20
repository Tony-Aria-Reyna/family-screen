# Fridge photo frame: photos in the day window, dim clock outside it, a touch goes to Today
import asyncio
from playwright.async_api import async_playwright
U='http://localhost:5500/index.html'; ADMIN='tonyandreynanz@gmail.com'
async def run(clock):
    async with async_playwright() as p:
        b=await p.chromium.launch(); ctx=await b.new_context(timezone_id='Pacific/Auckland',viewport={'width':1280,'height':800})
        errs=[]; P=await ctx.new_page(); P.on('pageerror',lambda e:errs.append(str(e)))
        await P.clock.install(time=clock)
        await P.goto(U); await P.wait_for_timeout(400)
        await P.evaluate(f"localStorage.setItem('fs.askedMe',JSON.stringify(['{ADMIN}'])); SYNC.testSignIn('{ADMIN}')"); await P.wait_for_timeout(700)
        await P.click('#gNew'); await P.wait_for_timeout(1000)
        await P.evaluate("setTab&&0; hubIdle=Date.now()-6*60e3; hubTick()"); await P.wait_for_timeout(600)
        on=await P.locator('#saver').count(); night=await P.evaluate("document.getElementById('saver')&&document.getElementById('saver').className")
        clk=await P.locator('#saver .sv-clock').count(); info=await P.locator('#saver .sv-info').count()
        await P.mouse.click(640,400); await P.wait_for_timeout(300)
        print(clock,'| frame on:',on,'| night:',night=='night','| clock only:',clk,'| photo info:',info,'| touch closes:',await P.locator('#saver').count()==0,'| errors:',errs)
        await b.close()
async def main():
    await run('2026-11-21T14:00:00+13:00'); await run('2026-11-21T23:30:00+13:00')
asyncio.run(main())
