import asyncio
from playwright.async_api import async_playwright
U='http://localhost:5500/index.html'
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); ctx=await b.new_context(timezone_id='Pacific/Auckland',viewport={'width':1280,'height':800})
        F=await ctx.new_page(); errs=[]; F.on('pageerror',lambda e:errs.append(str(e)))
        await F.goto(U); await F.wait_for_timeout(400); await F.evaluate("SYNC.testSignIn('tony@example.com')"); await F.wait_for_timeout(500)
        await F.click('#gNew'); await F.wait_for_timeout(2500)
        if await F.locator('text=Which one is you?').count(): await F.click('.opts [data-mep=p1]')
        await F.evaluate("""()=>{ S.linkHelper={url:'https://helper.example/exec',key:'k1'}; save(); window.__sent=[]; const of=window.fetch; window.fetch=async(u,o)=>{ if(String(u).startsWith('https://helper')){ window.__sent.push(JSON.parse(o.body)); return new Response(JSON.stringify({ok:true})); } return of(u,o); }; }""")
        await F.click('#setBtn'); await F.wait_for_timeout(200); await F.click('#goAI'); await F.wait_for_timeout(300)
        await F.fill('#k','AIzaSyD-abc_1234567890xyzXYZ'); await F.click('#s'); await F.wait_for_timeout(800)
        print('sent:', await F.evaluate("JSON.stringify(window.__sent)"))
        print('tail:', await F.evaluate("S.aiKeyTail"), '| db secret:', await F.evaluate("JSON.parse(localStorage.getItem(Object.keys(localStorage).find(k=>k.includes('mock'))||'{}'))['households/'+Object.keys(JSON.parse(localStorage.getItem(Object.keys(localStorage).find(k=>k.includes('mock'))||'{}'))).find(k=>k.startsWith('households/')&&k.split('/').length==2).split('/')[1]+'/secrets/ai']"))
        await F.evaluate("closeModal()"); await F.click('#setBtn'); await F.click('#goAI'); await F.wait_for_timeout(300); await F.screenshot(path='/tmp/aikey.png')
        print(errs); await b.close()
asyncio.run(main())
