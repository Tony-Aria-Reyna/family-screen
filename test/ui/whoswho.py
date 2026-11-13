import asyncio, json
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); errs=[]
        pg=await b.new_page(viewport={'width':1000,'height':1300}); pg.on('pageerror',lambda e:errs.append(str(e)))
        await pg.goto('http://localhost:5500/index.html?demo'); await pg.wait_for_timeout(600)
        await pg.evaluate("openWhosWho()"); await pg.wait_for_timeout(300)
        await pg.fill('[data-role="p4"]',"Mum's mother, lives with us"); await pg.dispatch_event('[data-role="p4"]','change')
        await pg.fill('[data-aka="p4"]','Marjan, Grandma'); await pg.dispatch_event('[data-aka="p4"]','change')
        await pg.fill('[data-aka="p2"]','Mummy, Mum'); await pg.dispatch_event('[data-aka="p2"]','change')
        await pg.fill('#fn','Biscuit is the cat.'); await pg.dispatch_event('#fn','change')
        await pg.screenshot(path='/tmp/whoswho.png')
        print(await pg.evaluate("S.people.map(p=>[p.name,p.role||'',p.nick||'',p.aka||''].join('|'))"))
        print(await pg.evaluate("familyIntro()"))
        print(await pg.evaluate("JSON.stringify(JSON.parse(alexaModel()).interactionModel.languageModel.types[0].values.map(v=>v.name))"))
        await pg.click('#x'); await pg.evaluate("openSettings()"); await pg.wait_for_timeout(300); print('settings btn', await pg.locator('#goWho').count())
        print('errs',errs); await b.close()
asyncio.run(main())
