# Family album: add photos (choose several / drag onto the fridge), saved through the helper, shown, photo frame uses them
import asyncio, json, base64
from playwright.async_api import async_playwright
U='http://localhost:5500/index.html'; ADMIN='tonyandreynanz@gmail.com'
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); ctx=await b.new_context(timezone_id='Pacific/Auckland')
        errs=[]; P=await ctx.new_page(); P.on('pageerror',lambda e:errs.append(str(e))); await P.set_viewport_size({'width':1280,'height':800})
        saved=[]
        async def helper(r):
            body=json.loads(r.request.post_data or '{}')
            if body.get('action')=='photo_add': saved.append((body.get('name'),len(body.get('data','')),body.get('by'))); await r.fulfill(json={'ok':True,'id':'ph%d'%len(saved),'folder':'FOLDER1'}); return
            if body.get('action')=='photos': await r.fulfill(json={'photos':[],'more':False}); return
            await r.fulfill(json={})
        await P.route('https://script.google.com/**',helper)
        await P.goto(U); await P.wait_for_timeout(400)
        await P.evaluate(f"localStorage.setItem('fs.askedMe',JSON.stringify(['{ADMIN}'])); SYNC.testSignIn('{ADMIN}')"); await P.wait_for_timeout(700)
        await P.click('#gNew'); await P.wait_for_timeout(1000)
        await P.evaluate("S.voiceUrl='https://script.google.com/macros/s/x/exec'; S.voiceKey='k'; S.people[0].email='tonyandreynanz@gmail.com'; S.people[0].name='Tony'; save()")
        png=await P.evaluate("(()=>{ const c=document.createElement('canvas'); c.width=300; c.height=200; const g=c.getContext('2d'); g.fillStyle='#4a9'; g.fillRect(0,0,300,200); return c.toDataURL('image/png').split(',')[1]; })()")
        buf=base64.b64decode(png)
        await P.evaluate("openMore()"); await P.wait_for_timeout(200)
        print('1 More has the album:', await P.evaluate("[...document.querySelectorAll('.tile')].some(t=>/Family album/.test(t.textContent))"))
        await P.evaluate("closeModal(); openAlbum()"); await P.wait_for_timeout(600)
        await P.set_input_files('#alP',files=[{'name':'beach.png','mimeType':'image/png','buffer':buf},{'name':'birthday.png','mimeType':'image/png','buffer':buf}]); await P.wait_for_timeout(2000)
        print('2 saved through the helper:', saved, '| folder remembered:', await P.evaluate("S.photoFolder"))
        print('3 shown in the album:', await P.locator('.algrid img').count(), '|', await P.locator('#alS').inner_text())
        await P.evaluate("closeModal()")
        # drag a photo onto the fridge screen anywhere
        await P.evaluate("""(async()=>{ const r=await fetch('data:image/png;base64,"""+png+"""'); const bl=await r.blob(); const dt=new DataTransfer(); dt.items.add(new File([bl],'dog.png',{type:'image/png'})); document.querySelector('#cal').dispatchEvent(new DragEvent('drop',{bubbles:true,cancelable:true,dataTransfer:dt})); })()"""); await P.wait_for_timeout(1500)
        print('4 dropped on the fridge:', len(saved), saved[-1][0])
        await P.evaluate("saverOn()"); await P.wait_for_timeout(800); print('5 photo frame shows album photos:', await P.locator('#saver img').count())
        print('errors:', errs)
        await b.close()
asyncio.run(main())
