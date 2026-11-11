import asyncio, json
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); pg=await b.new_page(viewport={'width':1885,'height':940},timezone_id='Pacific/Auckland')
        errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
        await pg.context.grant_permissions(['clipboard-read','clipboard-write'])
        await pg.goto('http://localhost:5500/index.html?demo'); await pg.wait_for_timeout(600)
        await pg.evaluate("openAlexa()"); await pg.wait_for_timeout(400)
        print('key made:', await pg.evaluate("S.voiceKey && S.voiceKey.length"))
        await pg.screenshot(path='/tmp/alexa1.png')
        # bad url rejected, good url saved
        await pg.fill('#vu','not a url'); await pg.click('#vs'); await pg.wait_for_timeout(200)
        print('bad url kept out:', await pg.evaluate("!S.voiceUrl"))
        await pg.fill('#vu','https://script.google.com/macros/s/AKfycbxTESTTESTTEST/exec'); await pg.click('#vs'); await pg.wait_for_timeout(300)
        print('url saved:', await pg.evaluate("S.voiceUrl"))
        model=await pg.evaluate("alexaModel()"); code=await pg.evaluate("alexaCode()")
        open('/tmp/model.json','w').write(model); open('/tmp/skill.js','w').write(code)
        print('model bytes',len(model),'code bytes',len(code))
        print('key in code:', await pg.evaluate("alexaCode().includes(S.voiceKey) && alexaCode().includes(S.voiceUrl)"))
        print('people in code:', json.loads(code.split('const PEOPLE = ')[1].split(';')[0]))
        await pg.click('#nk'); await pg.wait_for_timeout(200)
        print('errs:',errs); await b.close()
asyncio.run(main())
