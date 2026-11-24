# 4.3 Messages only: Nana and Pop are added just for Messages and calls. They get a second family chat ("Family + Nana & Pop"),
# never the first Family chat (Masako's), and see nothing but Messages.
import asyncio, json
from playwright.async_api import async_playwright
U='http://localhost:5500/index.html'; ADMIN='tonyandreynanz@gmail.com'; MAS='masakofraser@gmail.com'; NAN='nana@example.com'; POP='pop@example.com'
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); ctx=await b.new_context(timezone_id='Pacific/Auckland',locale='en-NZ'); errs=[]
        async def route(r): await r.fulfill(json={'ok':True,'ice':[]})
        async def page(tag):
            P=await ctx.new_page(); P.on('pageerror',lambda e:errs.append(tag+' '+str(e))); await P.set_viewport_size({'width':390,'height':844}); await P.route('https://script.google.com/**',route); await P.goto(U); await P.wait_for_timeout(500); return P
        T=await page('T')
        await T.evaluate(f"localStorage.setItem('fs.askedMe',JSON.stringify(['{ADMIN}','{MAS}','{NAN}','{POP}'])); SYNC.testSignIn('{ADMIN}')"); await T.wait_for_timeout(700)
        await T.click('#gNew'); await T.wait_for_timeout(900)
        await T.evaluate(f"""S.people[0].name='Tony'; S.people[0].email='{ADMIN}'; S.people[1].name='Reyna'; S.people[2].name='Aria'; S.people[3].name='Masako'; S.people[3].email='{MAS}'; S.voiceUrl='https://script.google.com/macros/s/TONY/exec'; S.voiceKey='k'; save()""")
        await T.evaluate(f"SYNC.addCalMember('{MAS}')"); await T.wait_for_timeout(400)
        await T.evaluate("openSettings()"); await T.wait_for_timeout(400)
        await T.locator(f'[data-mown="{MAS}"]').click(); await T.wait_for_timeout(400)
        for em,nm in ((NAN,'Nana'),(POP,'Pop')):
            await T.evaluate("openSettings()"); await T.wait_for_timeout(400)
            await T.fill('#mIn',em); await T.fill('#mNm',nm); await T.evaluate("document.querySelector('#mAddChat').click()"); await T.wait_for_timeout(900)
        await T.evaluate("closeModal()")
        print('1 Tony: people', await T.evaluate("S.people.map(p=>p.name+(p.show?'':'(hidden)'))"), '| chatOnly', await T.evaluate("S.chatOnly"), '| Family chat goes to', await T.evaluate("SYNC.chatEm('fam')"), '| second chat goes to', await T.evaluate("SYNC.chatEm('fam2')"))
        await T.evaluate("msgSend('p1','fam','For Masako and us'); msgSend('p1','fam2','Hello Nana and Pop'); msgSend('p1','p1|p2','Private')"); await T.wait_for_timeout(500)
        await T.evaluate("msgAs='p1'; openMsgs()"); await T.wait_for_timeout(400)
        print('2 Tony\'s chat list:', await T.evaluate("[...document.querySelectorAll('.mrow b')].map(x=>x.textContent)")); await T.evaluate("closeModal()")
        N=await page('N'); await N.evaluate(f"SYNC.testSignIn('{NAN}')"); await N.wait_for_timeout(1500); await N.click('#gNew'); await N.wait_for_timeout(3000)
        O=await page('O'); await O.evaluate(f"SYNC.testSignIn('{POP}')"); await O.wait_for_timeout(1500); await O.click('#gNew'); await O.wait_for_timeout(3000)
        M=await page('M'); await M.evaluate(f"SYNC.testSignIn('{MAS}')"); await M.wait_for_timeout(1500); await M.click('#gNew'); await M.wait_for_timeout(3000)
        vis=await N.evaluate("[getComputedStyle(document.querySelector('.app')).display, getComputedStyle(document.querySelector('.tabbar')).display, document.body.classList.contains('chatonly'), !!document.querySelector('#chatHome #chMsg')]")
        print('3 Nana: app/tabbar hidden, messages-only card:', vis, '| Messages opened by itself:', await N.locator('#msgBox').count())
        print('4 Nana\'s chat list:', await N.evaluate("[...document.querySelectorAll('.mrow b')].map(x=>x.textContent)"), '| messages she holds:', await N.evaluate("S.msgs.map(m=>m.text)"), '| calendar entries:', await N.evaluate("S.events.length"))
        await N.locator('.mrow',has_text='family').click(); await N.wait_for_timeout(400)
        await N.fill('#mi','Hello from Nana'); await N.evaluate("document.querySelector('#ms').click()"); await N.wait_for_timeout(2000)
        print('5 Tony sees her in the second chat:', await T.evaluate("msgIn('fam2').map(m=>[m.text,nm(m.from)])"), '| not in Family:', await T.evaluate("msgIn('fam').map(m=>m.text)"))
        print('6 Pop sees Nana\'s and Tony\'s:', await O.evaluate("S.msgs.map(m=>m.text).sort()"), '| Masako sees:', await M.evaluate("S.msgs.map(m=>m.text).sort()"))
        print('7 Pop\'s list (no Nana, no Masako one-to-one):', await O.evaluate("(msgOpen&&msgOpen.draw(), [...document.querySelectorAll('.mrow b')].map(x=>x.textContent))"))
        db=json.loads(await T.evaluate("localStorage.getItem('mockdb')")); hT=[k for k in db if k.count('/')==1 and db[k].get('owner')==ADMIN][0]
        hers=[v for k,v in db.items() if k.startswith(hT+'/msgs/') and v.get('text')=='Hello from Nana'][0]
        print('8 stored:', {k:hers.get(k) for k in ('th','from','em','byE')})
        await N.screenshot(path='/tmp/co1.png'); await N.evaluate("closeModal(); renderAll()"); await N.wait_for_timeout(300); await N.screenshot(path='/tmp/co2.png')
        print('errors:', errs); await b.close()
asyncio.run(main())
