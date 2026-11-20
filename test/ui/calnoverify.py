# A calendar-only account signs in with email and password and goes straight in, no confirmation email needed
import asyncio
from playwright.async_api import async_playwright
U='http://localhost:5500/index.html'; ADMIN='tonyandreynanz@gmail.com'; MAS='masako@outlook.com'; OTHER='someone@outlook.com'
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); ctx=await b.new_context(timezone_id='Pacific/Auckland',locale='en-NZ')
        errs=[]; T=await ctx.new_page(); T.on('pageerror',lambda e:errs.append('T '+str(e))); await T.set_viewport_size({'width':390,'height':844})
        await T.goto(U); await T.wait_for_timeout(500)
        await T.evaluate(f"localStorage.setItem('fs.askedMe',JSON.stringify(['{ADMIN}'])); SYNC.testSignIn('{ADMIN}')"); await T.wait_for_timeout(700)
        await T.click('#gNew'); await T.wait_for_timeout(900)
        await T.evaluate("openSettings()"); await T.wait_for_timeout(300)
        await T.fill('#mIn',MAS); await T.click('#mAddCal'); await T.wait_for_timeout(500)
        await T.fill('#mIn',OTHER); await T.click('#mAdd'); await T.wait_for_timeout(500)
        print('1 added:', await T.evaluate("JSON.stringify([SYNC.getMembers(),SYNC.getLimited()])"))
        for who in [MAS,OTHER]:
            M=await (await b.new_context(timezone_id='Pacific/Auckland')).new_page(); M.on('pageerror',lambda e:errs.append('M '+str(e))); await M.set_viewport_size({'width':390,'height':844})
            await M.goto(U); await M.wait_for_timeout(300)
            # share the mock database with the new browser
            db=await T.evaluate("localStorage.getItem('mockdb')"); await M.evaluate("d=>localStorage.setItem('mockdb',d)", db); await M.reload(); await M.wait_for_timeout(600)
            await M.click('#gMail'); await M.wait_for_timeout(200); await M.click('#gNewPw'); await M.wait_for_timeout(200)
            await M.fill('#gEm',who); await M.fill('#gPw','secret123'); await M.click('#gGo'); await M.wait_for_timeout(1800)
            gate=(await M.evaluate('document.body.innerText'))[:400].replace('\n',' / ')
            print('dbg', await M.evaluate("(()=>{ const e=document.querySelector('#gVer'); return e?getComputedStyle(e).display+' '+(e.offsetParent!==null):'no verify card' })()"), await M.evaluate('SYNC.findHousehold()'), await M.evaluate('JSON.stringify(SYNC.getLimited())'), await M.evaluate('document.body.dataset.tab'))
            print('2' if who==MAS else '3', who, '| verified:', await M.evaluate("SYNC.needsVerify()"), '| in the calendar:', await M.evaluate("!!SYNC.isLimited&&SYNC.isLimited()&&document.body.dataset.tab==='cal'"), '| screen:', gate[:60])
        print('errors:', errs)
        await b.close()
asyncio.run(main())
