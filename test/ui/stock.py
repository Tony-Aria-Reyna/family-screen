# Kitchen stock and "What can we make?": photos → dinners and gaps; stock list; sauce shelf; assumed use
import asyncio, json
from playwright.async_api import async_playwright
U='http://localhost:5500/index.html'; ADMIN='tonyandreynanz@gmail.com'
REC=lambda n,buy,uses,thaw='':{"name":n,"meal":"dinner","emoji":"🌮","mins":30,"serves":3,"tags":["Mexican"],"blurb":"Quick and tasty.","ing":[[500,"g","beef mince"],[1,"","brown onion"],[1,"tbsp","oil","p"]],"steps":[["Brown the mince.",8],["Serve."]],"uses":uses,"buy":buy,"thaw":thaw}
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); ctx=await b.new_context(timezone_id='Pacific/Auckland',locale='en-NZ')
        errs=[]; P=await ctx.new_page(); P.on('pageerror',lambda e:errs.append(str(e))); await P.set_viewport_size({'width':390,'height':844})
        greq=[]
        async def groute(r):
            u=r.request.url
            if 'models?' in u: await r.fulfill(json={"models":[{"name":"models/gemini-3.6-flash","supportedGenerationMethods":["generateContent"]}]}); return
            body=json.loads(r.request.post_data); greq.append(body); t=json.dumps(body)
            if 'List the food' in t: out={"items":[{"name":"chicken thighs","qty":"2 kg","where":"freezer"},{"name":"lamb chops","qty":"","where":"freezer"}]}
            else: out={"seen":[{"name":"beef mince","qty":"500 g","where":"fridge"},{"name":"capsicum","qty":"2","where":"fridge"}],"recipes":[REC("Mince tacos",["corn tortillas","limes"],["beef mince","capsicum"]),REC("Teriyaki chicken",[],["chicken thighs"],"Take the chicken thighs out now"),REC("Lamb chops and salad",["rocket"],["lamb chops"])]}
            await r.fulfill(status=200,headers={'content-type':'text/event-stream'},body='data: '+json.dumps({"candidates":[{"content":{"parts":[{"text":json.dumps(out)}]}}]})+'\n\n')
        await P.route('https://generativelanguage.googleapis.com/**',groute)
        await P.goto(U); await P.wait_for_timeout(500)
        await P.evaluate(f"localStorage.setItem('fs.askedMe',JSON.stringify(['{ADMIN}'])); SYNC.testSignIn('{ADMIN}')"); await P.wait_for_timeout(700)
        await P.click('#gNew'); await P.wait_for_timeout(900)
        await P.evaluate("SYNC.saveSecret({gemini:'AQ.testkey1234567890abcdefghij',at:Date.now()})"); await P.wait_for_timeout(600)
        await P.evaluate("openStock()"); await P.wait_for_timeout(300)
        await P.fill('#sin','2 kg chicken thighs, lamb chops'); await P.click('#sgo'); await P.wait_for_timeout(1200)
        print('1 stock from a typed list:', await P.evaluate("JSON.stringify(stockNow().map(x=>[x.name,x.qty,x.where]))"))
        await P.click('#seed'); await P.wait_for_timeout(300); n=await P.locator('[data-sc]').count()
        await P.locator('[data-sc]', has_text='Mirin').click(); await P.wait_for_timeout(300)
        print('2 sauce shelf:', n, '| Mirin out → shopping:', await P.evaluate("S.groceries.some(g=>/Mirin/.test(g.name)&&!g.done)"))
        await P.evaluate("closeModal(); openCook()"); await P.wait_for_timeout(300)
        png=await P.evaluate("(()=>{ const c=document.createElement('canvas'); c.width=80; c.height=60; c.getContext('2d').fillRect(0,0,80,60); return c.toDataURL('image/png').split(',')[1]; })()")
        import base64; buf=base64.b64decode(png)
        await P.set_input_files('#pf',files=[{'name':'fridge.png','mimeType':'image/png','buffer':buf},{'name':'freezer.png','mimeType':'image/png','buffer':buf}]); await P.wait_for_timeout(600)
        print('3 two photos attached:', await P.locator('.ckph').count())
        await P.click('#go'); await P.wait_for_timeout(1500)
        parts=greq[-1]['contents'][0]['parts']; txt=parts[0]['text']
        print('4 AI got: photos', sum('inline_data' in x for x in parts), '| tastes', 'Paleo' in txt, '| stock', 'Chicken thighs' in txt, '| sauces', 'Rice vinegar' in txt, '| Mirin listed as run out', 'Run out of: Mirin' in txt)
        print('5 ideas:', (await P.locator('.tvlist').inner_text()).replace('\n',' / ')[:420])
        await P.locator('[data-pl="0|0"]').click(); await P.wait_for_timeout(600)
        print('6 tonight:', await P.evaluate("(()=>{ const m=S.meals.slice(-1)[0]; return JSON.stringify({date:m.date===dk(new Date()),uses:m.uses.map(id=>S.stock.find(x=>x.id===id).name),tortillas:S.groceries.some(g=>/tortillas/i.test(g.name)),limes:S.groceries.some(g=>/^Limes/.test(g.name)),seenKept:stockNow().some(x=>x.name==='Capsicum')}); })()"))
        await P.evaluate("S.meals.slice(-1)[0].date=dk(addDays(new Date(),-1)); stockSettle()"); await P.wait_for_timeout(200)
        print('7 after it is cooked, mince is used:', await P.evaluate("JSON.stringify([stockNow().map(x=>x.name), S.stock.filter(x=>x.used).map(x=>x.name)])"))
        await P.evaluate("openStock()"); await P.wait_for_timeout(300); await P.locator('[data-back]').first.click(); await P.wait_for_timeout(200)
        print('8 put back:', await P.evaluate("stockNow().length"))
        await P.screenshot(path='/tmp/stock.png')
        await P.evaluate("closeModal(); setTab('meals')"); await P.wait_for_timeout(400)
        print('9 Meals has the buttons:', await P.locator('#mCook').count(), await P.locator('#mStock').count())
        print('errors:', errs)
        await b.close()
asyncio.run(main())
