import asyncio
from playwright.async_api import async_playwright
U='http://localhost:5500/index.html'
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); ctx=await b.new_context(timezone_id='Pacific/Auckland',viewport={'width':400,'height':820},has_touch=True,is_mobile=True)
        F=await ctx.new_page(); errs=[]; F.on('pageerror',lambda e:errs.append(str(e)))
        await F.goto(U); await F.wait_for_timeout(400); await F.evaluate("SYNC.testSignIn('tony@example.com')"); await F.wait_for_timeout(500)
        await F.click('#gNew'); await F.wait_for_timeout(2500)
        if await F.locator('text=Which one is you?').count(): await F.click('.opts [data-mep=p1]')
        await F.evaluate("S.todos.push({id:'u1',title:'Old job 1',who:'',done:false},{id:'u2',title:'Old job 2',who:'',done:false},{id:'r1',title:'Reyna thing',who:'p2',done:false}); save(); renderAll()")
        await F.click('[data-tab=todo]'); await F.wait_for_timeout(300)
        print('default view:', await F.locator('.tchip.on').inner_text(), '| shown:', await F.locator('#todoPanel .item .nm').all_inner_texts())
        await F.click('[data-tw=""]'); await F.wait_for_timeout(200)
        await F.fill('#tIn','Pick up dry cleaning'); await F.wait_for_timeout(100)
        print('who row visible:', await F.locator('#tWho').is_visible())
        await F.press('#tIn','Enter'); await F.wait_for_timeout(100)
        print('saved without name? ', await F.evaluate("S.todos.some(t=>t.title==='Pick up dry cleaning')"))
        await F.screenshot(path='/tmp/ta1.png')
        await F.click('#tWho [data-nw="p2"]'); await F.wait_for_timeout(200)
        print('saved for:', await F.evaluate("S.todos.find(t=>t.title==='Pick up dry cleaning').who"), 'input cleared:', await F.input_value('#tIn')=='' )
        await F.click('[data-tw="_none"]'); await F.wait_for_timeout(200); await F.screenshot(path='/tmp/ta2.png')
        F.on('dialog', lambda d: asyncio.ensure_future(d.accept()))
        await F.click('#tMine'); await F.wait_for_timeout(300)
        print('unassigned left:', await F.evaluate("S.todos.filter(t=>!t.done&&!t.who).length"), '| view now:', await F.locator('.tchip.on').inner_text())
        print(errs); await b.close()
asyncio.run(main())
