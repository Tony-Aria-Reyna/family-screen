import asyncio, json
from playwright.async_api import async_playwright
SSE=lambda txt: ''.join('data: '+json.dumps({"candidates":[{"content":{"parts":[{"text":t}]}}]})+'\n\n' for t in [txt[i:i+40] for i in range(0,len(txt),40)])
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); pg=await b.new_page(viewport={'width':1885,'height':940},timezone_id='Pacific/Auckland'); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
        async def route(r):
            if 'models?' in r.request.url: await r.fulfill(json={"models":[{"name":"models/gemini-3.6-flash","supportedGenerationMethods":["generateContent"]}]}); return
            out=json.dumps({"intro":"Let's explore Japan!","questions":[{"q":"What is the capital of Japan?","options":["Osaka","Tokyo","Kyoto","Nara"],"answer":1,"fun":"Tokyo is one of the biggest cities in the world."},{"q":"Which animal?","options":["Kiwi","Panda","Macaque","Koala"],"answer":2,"fun":"Snow monkeys love hot springs."}]})
            await r.fulfill(status=200,headers={'content-type':'text/event-stream'},body=SSE(out))
        await pg.route('https://generativelanguage.googleapis.com/**',route)
        await pg.goto('http://localhost:5500/index.html?demo'); await pg.wait_for_timeout(500)
        await pg.evaluate("window.AI_TEST=true; S.aiKey='AQ.test'; S.visited={'Japan':['p1','p3']}; S.wish=['Peru']; save()")
        pg.on('dialog', lambda d: asyncio.ensure_future(d.accept('9')))
        await pg.evaluate("openKids()"); await pg.wait_for_timeout(300); await pg.screenshot(path='/tmp/k1.png')
        await pg.click('#kage'); await pg.wait_for_timeout(300); await pg.fill('#a','9'); await pg.click('#s'); await pg.wait_for_timeout(300)
        await pg.click('#jadd'); await pg.fill('#n','Nintendo Switch'); await pg.fill('#t','450'); await pg.fill('#e','🎮'); await pg.click('#s'); await pg.wait_for_timeout(300)
        await pg.locator('[data-jar]').first.click(); await pg.wait_for_timeout(200); await pg.click('#in'); await pg.wait_for_timeout(200)
        await pg.fill('#a','20'); await pg.click('[data-n="Pocket money"]'); await pg.click('#s'); await pg.wait_for_timeout(300); await pg.screenshot(path='/tmp/k2.png')
        print('jar:', await pg.evaluate("JSON.stringify(S.kids.filter(k=>k.kind==='jar').map(j=>[j.name,j.target,jarTotal(j)]))"))
        await pg.click('#bk'); await pg.wait_for_timeout(200); await pg.click('#kq'); await pg.wait_for_timeout(200)
        print('countries offered:', await pg.locator('[data-k]').all_inner_texts())
        await pg.click('[data-k="Japan"]'); await pg.wait_for_timeout(800); await pg.screenshot(path='/tmp/k3.png')
        await pg.click('[data-o="1"]'); await pg.wait_for_timeout(200); await pg.screenshot(path='/tmp/k4.png'); await pg.click('#n'); await pg.wait_for_timeout(200)
        await pg.click('[data-o="0"]'); await pg.wait_for_timeout(200); await pg.click('#n'); await pg.wait_for_timeout(300); await pg.screenshot(path='/tmp/k5.png')
        print('stamps:', await pg.evaluate("JSON.stringify(S.kids.filter(k=>k.kind==='stamp').map(s=>[s.name,s.score]))"))
        await pg.click('#x'); await pg.wait_for_timeout(300); print('corner:', (await pg.locator('.kstats').inner_text()).replace('\n',' '))
        print(errs); await b.close()
asyncio.run(main())
