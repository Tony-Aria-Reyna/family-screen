import asyncio, json
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); errs=[]
        pg=await b.new_page(viewport={'width':1000,'height':1300}); pg.on('pageerror',lambda e:errs.append(str(e)))
        async def helper(route):
            body=json.loads(route.request.post_data)
            await route.fulfill(status=200,content_type='application/json',body=json.dumps({'speech':'x','verse':['Rise and shine, it is swimming day,','Mum is in Tokyo far away!','Grab your togs and brush your hair,','Breakfast is waiting, are you there?'],'then':'Today is sunny, a high of 21 degrees. First up at 9:00am: Swimming.','name':body.get('person'),'style':body.get('style')}))
        await pg.route('https://script.google.com/**',helper)
        await pg.goto('http://localhost:5500/index.html?demo'); await pg.wait_for_timeout(600)
        print('default name:', await pg.evaluate("JSON.parse(alexaModel()).interactionModel.languageModel.invocationName"))
        print('problems:', await pg.evaluate("['sister','your sister','ask sister','the sister','alexa sister','our family helper'].map(n=>n+' -> '+(voiceNameProblem(cleanVoiceName(n))||'ok'))"))
        await pg.evaluate("S.voiceUrl='https://script.google.com/macros/s/abc/exec'; S.voiceKey='k123456789012'; S.voiceName='your sister'")
        mdl=await pg.evaluate("JSON.parse(alexaModel()).interactionModel.languageModel")
        print('name now:', mdl['invocationName'], '| intents', len(mdl['intents']), '| samples', sum(len(i['samples']) for i in mdl['intents']), '| wake', [i['samples'][:3] for i in mdl['intents'] if i['name']=='WakeIntent'])
        await pg.evaluate("openHelp()"); await pg.wait_for_timeout(300)
        print('help lead:', (await pg.locator('.helplead').inner_text())[:80]); print('groups:', await pg.locator('.hgrp h4').all_inner_texts())
        await pg.click('#x')
        await pg.evaluate("openWake()"); await pg.wait_for_timeout(300)
        print('btn:', await pg.locator('#wgo').inner_text())
        await pg.click('[data-ws="pirate"]'); await pg.wait_for_timeout(200)
        await pg.click('#wgo'); await pg.wait_for_timeout(900)
        print('lines:', await pg.locator('.wline').all_inner_texts()); print('style saved:', await pg.evaluate("S.wakeStyle"), '| btn:', await pg.locator('#wgo').inner_text())
        await pg.screenshot(path='/tmp/wake.png')
        await pg.click('#x'); await pg.wait_for_timeout(200)
        await pg.evaluate("openMore()"); await pg.wait_for_timeout(300); print('tile:', await pg.locator('.tile:has-text("Wake-up song")').count())
        print('errs',errs); await b.close()
asyncio.run(main())
