import asyncio
from playwright.async_api import async_playwright
U='http://localhost:5500/index.html'
JS1="""() => { const b=document.querySelector('.tvp[data-k="Samoa"][data-p="p2"]'); return [b.onclick&&b.onclick.toString(), b.closest('.tvc')&&b.closest('.tvc').innerHTML.slice(0,200), document.querySelectorAll('.tvp[data-k="Samoa"][data-p="p2"]').length]; }"""
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); ctx=await b.new_context(timezone_id='Pacific/Auckland',viewport={'width':400,'height':820},has_touch=True,is_mobile=True)
        F=await ctx.new_page(); errs=[]; F.on('pageerror',lambda e:errs.append(str(e))); F.on('console',lambda m:errs.append('C '+m.text))
        await F.goto(U); await F.wait_for_timeout(400); await F.evaluate("SYNC.testSignIn('tony@example.com')"); await F.wait_for_timeout(500)
        await F.click('#gNew'); await F.wait_for_timeout(2500)
        if await F.locator('text=Which one is you?').count(): await F.click('.opts [data-mep=p1]')
        await F.click('[data-tab=where]'); await F.wait_for_timeout(800); await F.click('[data-gm="1"]'); await F.wait_for_timeout(800)
        await F.click('#tvEdit'); await F.wait_for_timeout(300); await F.fill('#tvQ','samoa'); await F.wait_for_timeout(200)
        print('before:', await F.evaluate(JS1))
        await F.tap('.tvp[data-k="Samoa"][data-p="p1"]'); await F.wait_for_timeout(600)
        print('after1:', await F.evaluate(JS1))
        await F.evaluate("""() => { window.__t=[]; const ot=window.setVisited; }""")
        await F.tap('.tvp[data-k="Samoa"][data-p="p2"]'); await F.wait_for_timeout(600)
        print('visited:', await F.evaluate("JSON.stringify(S.visited)"))
        await F.tap('.tvp[data-k="Samoa"][data-p="p3"]'); await F.wait_for_timeout(600); await F.tap('.tvp[data-k="Samoa"][data-p="p1"]'); await F.wait_for_timeout(600)
        print('visited after 4 taps:', await F.evaluate("JSON.stringify(S.visited)"), 'bar filters intact:', await F.evaluate("S.people.map(p=>p.show).join()"))
        print(errs[-10:]); await b.close()
asyncio.run(main())
