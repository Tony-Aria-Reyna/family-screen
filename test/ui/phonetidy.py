# Phone: 5-tab bar with More; tidy Home; album delete; new photos flagged for other screens
import asyncio, json, base64
from playwright.async_api import async_playwright
U='http://localhost:5500/index.html'; ADMIN='tonyandreynanz@gmail.com'
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); ctx=await b.new_context(timezone_id='Pacific/Auckland',viewport={'width':390,'height':844},has_touch=True,is_mobile=True)
        errs=[]; P=await ctx.new_page(); P.on('pageerror',lambda e:errs.append(str(e)))
        acts=[]
        async def helper(r):
            body=json.loads(r.request.post_data or '{}'); acts.append(body.get('action'))
            if body.get('action')=='photo_add': await r.fulfill(json={'ok':True,'id':'ph%d'%len(acts),'folder':'F1'}); return
            if body.get('action')=='photo_del': await r.fulfill(json={'ok':True}); return
            await r.fulfill(json={})
        await P.route('https://script.google.com/**',helper)
        await P.route('https://accounts.google.com/**',lambda r: r.fulfill(body=''))
        await P.goto(U); await P.wait_for_timeout(400)
        await P.evaluate(f"localStorage.setItem('fs.askedMe',JSON.stringify(['{ADMIN}'])); SYNC.testSignIn('{ADMIN}')"); await P.wait_for_timeout(700)
        await P.click('#gNew'); await P.wait_for_timeout(1000)
        await P.evaluate("S.voiceUrl='https://script.google.com/macros/s/x/exec'; S.voiceKey='k'; save(); setTab('home')"); await P.wait_for_timeout(500)
        vis=await P.evaluate("[...document.querySelectorAll('.tabbar button')].filter(b=>b.offsetParent).map(b=>b.textContent.trim())")
        print('1 tabs:', vis)
        print('2 home tiles:', await P.locator('#phome .hgrid .tile').count(), '| everything-else button:', await P.locator('#hAll').count())
        await P.click('#tabMore'); await P.wait_for_timeout(300)
        t=await P.evaluate("[...document.querySelectorAll('.modal .tile b')].slice(0,3).map(x=>x.textContent)"); print('3 More opens, first tiles:', t)
        await P.click('.modal .tile >> nth=0'); await P.wait_for_timeout(400); print('4 Meals from More -> tab:', await P.evaluate("document.body.dataset.tab"))
        await P.evaluate("closeMeals&&closeMeals(); setTab('home'); openAlbum()"); await P.wait_for_timeout(600)
        print('5 picker button:', await P.locator('#gp').count())
        png=await P.evaluate("(()=>{ const c=document.createElement('canvas'); c.width=300; c.height=200; c.getContext('2d').fillRect(0,0,300,200); return c.toDataURL('image/png').split(',')[1]; })()")
        rev0=await P.evaluate("S.photoRev||0")
        await P.set_input_files('#alP',files=[{'name':'a.png','mimeType':'image/png','buffer':base64.b64decode(png)}]); await P.wait_for_timeout(1800)
        print('6 added, shared photoRev bumped:', await P.evaluate("S.photoRev")>rev0, '| shown:', await P.locator('.algrid img').count())
        await P.click('.algrid img >> nth=0'); await P.wait_for_timeout(300)
        await P.click('#vd'); await P.wait_for_timeout(100); print('7 asks first:', await P.locator('#vd').inner_text())
        await P.click('#vd'); await P.wait_for_timeout(1200)
        print('8 deleted via helper:', 'photo_del' in acts, '| left:', await P.locator('.algrid img').count())
        print('errors:', errs)
        await b.close()
asyncio.run(main())
