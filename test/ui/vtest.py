import asyncio, json
from playwright.async_api import async_playwright
CASES=[({"error":"not allowed · helper key ends 4680"},'calendar'),({"ok":True,"helper":2,"hasKey":True},'calendar'),
       ({"ok":True,"version":10,"people":["Tony"]},'ok'),({"ok":True,"version":9},'old'),({"error":"not allowed"},'key'),]
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); pg=await b.new_page(viewport={'width':1200,'height':900}); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
        await pg.goto('http://localhost:5500/index.html?demo'); await pg.wait_for_timeout(500)
        for body,label in CASES:
            await pg.evaluate("""b=>{ window.fetch=async(u,o)=>new Response(JSON.stringify(b)); }""",body)
            await pg.evaluate("closeModal&&closeModal(); S.voiceUrl='https://script.google.com/macros/s/AKfycbxZZ/exec'; openAlexa()"); await pg.wait_for_timeout(200)
            await pg.click('#vt'); await pg.wait_for_timeout(400)
            print(label.ljust(9), (await pg.locator('#vr').inner_text())[:110])
        print(errs); await b.close()
asyncio.run(main())
