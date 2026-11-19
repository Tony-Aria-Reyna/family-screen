# 2.3 the add-anything box: rules without AI, AI sorting (stubbed), Undo, typing survives a refresh, the fridge's ＋ ADD
import asyncio, json
from playwright.async_api import async_playwright
U='http://localhost:5500/index.html'; ADMIN='tonyandreynanz@gmail.com'
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); ctx=await b.new_context(timezone_id='Pacific/Auckland',locale='en-NZ')
        errs=[]; P=await ctx.new_page(); P.on('pageerror',lambda e:errs.append(str(e))); await P.set_viewport_size({'width':390,'height':844})
        greq=[]
        async def groute(r):
            u=r.request.url
            if 'models?' in u: await r.fulfill(json={"models":[{"name":"models/gemini-3.6-flash","supportedGenerationMethods":["generateContent"]}]}); return
            body=json.loads(r.request.post_data); greq.append(body)
            out={"items":[{"type":"shop","title":"豆腐"},{"type":"todo","title":"郵便局に行く","date":"2026-11-23","who":"p2"},{"type":"event","title":"Swimming","date":"2026-11-21","time":"09:30","mins":45,"who":""}]}
            await r.fulfill(status=200,headers={'content-type':'text/event-stream'},body='data: '+json.dumps({"candidates":[{"content":{"parts":[{"text":json.dumps(out)}]}}]})+'\n\n')
        await P.route('https://generativelanguage.googleapis.com/**',groute)
        await P.goto(U); await P.wait_for_timeout(500)
        await P.evaluate(f"localStorage.setItem('fs.askedMe',JSON.stringify(['{ADMIN}'])); SYNC.testSignIn('{ADMIN}')"); await P.wait_for_timeout(700)
        await P.click('#gNew'); await P.wait_for_timeout(900)
        await P.evaluate("S.people[0].name='Tony'; S.people[1].name='Reyna'; S.people[1].nick='Mummy'; save(); setTab('home')"); await P.wait_for_timeout(500)
        print('1 box on Home:', await P.locator('#hAdd .aain').count())
        n0=await P.evaluate("[S.groceries.length,S.todos.length,S.events.length]")
        await P.fill('#hAdd .aain','milk, eggs and bread'); await P.click('#hAdd .aago'); await P.wait_for_timeout(600)
        await P.fill('#hAdd .aain','Dentist Tuesday 3pm for Mummy'); await P.press('#hAdd .aain','Enter'); await P.wait_for_timeout(600)
        ev=await P.evaluate("JSON.stringify(S.events.slice(-1)[0])")
        await P.fill('#hAdd .aain','Tony: fix the gate by Friday'); await P.click('#hAdd .aago'); await P.wait_for_timeout(600)
        td=await P.evaluate("JSON.stringify(S.todos.slice(-1)[0])")
        n1=await P.evaluate("[S.groceries.length,S.todos.length,S.events.length]")
        print('2 rules: shopping', n1[0]-n0[0], '| event', ev, '| job', td)
        await P.wait_for_timeout(400); print('2b calendar change stamped for the helper (evAt):', await P.evaluate("(()=>{ const d=JSON.parse(localStorage.getItem('mockdb')); const k=Object.keys(d).find(x=>/^households\\/[^/]+$/.test(x)); return !!d[k].evAt; })()"))
        print('3 result line:', (await P.locator('#hAdd .aares').inner_text()).replace('\n',' / '))
        await P.click('#hAdd .aaundo'); await P.wait_for_timeout(500)
        print('4 undo took the job off:', await P.evaluate("S.todos.length")==n1[1]-1)
        # AI sorting, with the answer stubbed
        await P.evaluate("SYNC.saveSecret({gemini:'AQ.testkey1234567890abcdefghij',at:Date.now()})"); await P.wait_for_timeout(800)
        await P.fill('#hAdd .aain','豆腐、郵便局 月曜まで、土曜9時半 水泳'); await P.click('#hAdd .aago'); await P.wait_for_timeout(700)
        print('5 AI sorted:', (await P.locator('#hAdd .aares').inner_text()).replace('\n',' / '), '| prompt has people:', bool(greq) and 'Mummy' in greq[-1]['contents'][0]['parts'][0]['text'])
        # what's being typed survives the Home refreshing
        await P.fill('#hAdd .aain','half typed'); await P.evaluate("renderHome()"); await P.wait_for_timeout(200)
        print('6 typing kept after refresh:', await P.locator('#hAdd .aain').input_value())
        F=await ctx.new_page(); F.on('pageerror',lambda e:errs.append('fridge: '+str(e))); await F.set_viewport_size({'width':1280,'height':800}); await F.goto(U); await F.wait_for_timeout(500)
        await F.evaluate(f"SYNC.testSignIn('{ADMIN}')"); await F.wait_for_timeout(1800)
        await F.click('#addBtn'); await F.wait_for_timeout(400)
        print('7 fridge ＋ Add anything opens the box:', await F.locator('#mAdd .aain').count(), '| focused:', await F.evaluate("document.activeElement&&document.activeElement.classList.contains('aain')"))
        await F.click('#aaForm'); await F.wait_for_timeout(400)
        print('8 calendar form one tap away:', await F.locator('#evTitle').count())
        print('errors:', errs)
        await b.close()
asyncio.run(main())
