# Add anything: one entry for two people (new array form, and the old split form merged)
import asyncio
from playwright.async_api import async_playwright
U='http://localhost:5500/index.html'; ADMIN='tonyandreynanz@gmail.com'
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); P=await (await b.new_context(timezone_id='Pacific/Auckland')).new_page(); errs=[]; P.on('pageerror',lambda e:errs.append(str(e)))
        await P.goto(U); await P.wait_for_timeout(400)
        await P.evaluate(f"localStorage.setItem('fs.askedMe',JSON.stringify(['{ADMIN}'])); SYNC.testSignIn('{ADMIN}')"); await P.wait_for_timeout(700)
        await P.click('#gNew'); await P.wait_for_timeout(1000)
        ids=await P.evaluate("S.people.slice(0,2).map(p=>p.id)")
        r=await P.evaluate("(ids)=>{ const n=S.events.length; const a=applyAdds([{type:'event',title:'Heading to Nora\\'s house',date:'2026-11-22',time:'14:00',who:ids}]); return [S.events.length-n, S.events.at(-1).whos, a[0].label]; }",ids)
        print('1 array form:', r)
        r=await P.evaluate("(ids)=>{ const n=S.events.length; const a=applyAdds([{type:'event',title:'Piano',date:'2026-11-23',time:'15:00',who:ids[0]},{type:'event',title:'Piano',date:'2026-11-23',time:'15:00',who:ids[1]}]); return [S.events.length-n, S.events.at(-1).whos, a.map(x=>x.label)]; }",ids)
        print('2 split form merged:', r)
        print('errors:', errs); await b.close()
asyncio.run(main())
