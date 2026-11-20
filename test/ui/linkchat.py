# 4.1 Chats and calls with a linked family: Masako has her own household; she and Tony's family message and call
# each other. The records live in Tony's family's database, each marked with her address ("em").
import asyncio, json, base64
from playwright.async_api import async_playwright
U='http://localhost:5500/index.html'; ADMIN='tonyandreynanz@gmail.com'; MAS='masakofraser@gmail.com'
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(args=['--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream','--autoplay-policy=no-user-gesture-required'])
        ctx=await b.new_context(timezone_id='Pacific/Auckland',locale='en-NZ',permissions=['camera','microphone'])
        errs=[]; helper=[]
        async def route(r):
            body=json.loads(r.request.post_data or '{}'); helper.append((body.get('key'),body.get('action'),body.get('id'))); await r.fulfill(json={'ok':True,'ice':[]})
        T=await ctx.new_page(); T.on('pageerror',lambda e:errs.append('T '+str(e))); await T.set_viewport_size({'width':390,'height':844}); await T.route('https://script.google.com/**',route)
        await T.goto(U); await T.wait_for_timeout(500)
        await T.evaluate(f"localStorage.setItem('fs.askedMe',JSON.stringify(['{ADMIN}','{MAS}'])); SYNC.testSignIn('{ADMIN}')"); await T.wait_for_timeout(700)
        await T.click('#gNew'); await T.wait_for_timeout(900)
        await T.evaluate(f"""S.people[0].name='Tony'; S.people[0].email='{ADMIN}'; S.people[1].name='Reyna'; S.people[2].name='Aria'; S.people[3].name='Masako'; S.people[3].email='{MAS}'; S.vapidKey='VAPID'; S.voiceUrl='https://script.google.com/macros/s/TONY/exec'; S.voiceKey='tonykey';
          msgSend('p1','fam','Old family message'); msgSend('p1','p1|p2','Private to Reyna'); save()""")
        await T.evaluate(f"SYNC.addCalMember('{MAS}')"); await T.wait_for_timeout(400)
        await T.evaluate("openSettings()"); await T.wait_for_timeout(400)
        await T.locator(f'[data-mown="{MAS}"]').click(); await T.wait_for_timeout(500); await T.evaluate("closeModal()")
        M=await ctx.new_page(); M.on('pageerror',lambda e:errs.append('M '+str(e))); await M.set_viewport_size({'width':390,'height':844}); await M.route('https://script.google.com/**',route)
        await M.goto(U); await M.wait_for_timeout(500); await M.evaluate(f"SYNC.testSignIn('{MAS}')"); await M.wait_for_timeout(1500)
        await M.click('#gNew'); await M.wait_for_timeout(2500)
        print('0 linked people on Tony\'s side:', await T.evaluate("SYNC.linkedPeople().map(p=>p.name)"), '| a message to Masako is marked for:', await T.evaluate("SYNC.chatEm('p1|p4')"), '| to Reyna:', await T.evaluate("SYNC.chatEm('p1|p2')"), '| Family chat:', await T.evaluate("SYNC.chatEm('fam')"), '| Family call:', await T.evaluate("SYNC.chatEm('fam',true)"))
        await M.evaluate("msgAs=mePerson(); openMsgs()"); await M.wait_for_timeout(500)
        print('1 her chat list:', await M.evaluate("[...document.querySelectorAll('.mrow b')].map(x=>x.textContent)"), '| old messages she can see:', await M.evaluate("S.msgs.length"))
        # Tony writes to her and to the Family chat
        await T.evaluate("msgSend('p1','p1|p4','Hi Machan'); msgSend('p1','fam','Dinner at 6'); msgSend('p1','p1|p2','Still private')"); await M.wait_for_timeout(1200)
        print('2 she receives:', await M.evaluate("S.msgs.map(m=>[m.text,nm(m.from)])"), '| unread badge:', await M.evaluate("msgUnreadAll()"))
        await M.evaluate("msgOpen.draw()"); await M.wait_for_timeout(200)
        await M.locator('.mrow',has_text='Tony').filter(has_not_text='family').click(); await M.wait_for_timeout(400)
        print('3 she opens Tony:', await M.locator('.mhead h2').inner_text(), '|', await M.locator('.mb .mtxt').all_inner_texts(), '| call buttons:', await M.locator('#cA').count(), await M.locator('#cV').count())
        await M.fill('#mi','Hello Tony'); await M.click('#ms'); await T.wait_for_timeout(2200)
        db=json.loads(await T.evaluate("localStorage.getItem('mockdb')")); hT=[k for k in db if k.count('/')==1 and db[k].get('owner')==ADMIN][0]; hM=[k for k in db if k.count('/')==1 and db[k].get('owner')==MAS][0]
        hers=[v for k,v in db.items() if k.startswith(hT+'/msgs/') and v.get('text')=='Hello Tony'][0]
        print('4 her reply is stored in Tony\'s family, marked hers:', {k:hers.get(k) for k in ('th','from','em','byE')}, '| nothing in her own household:', not [k for k in db if k.startswith(hM+'/msgs/')])
        print('5 Tony sees it:', await T.evaluate("msgIn('p1|p4').map(m=>[m.text,nm(m.from),(m.seen||[]).map(nm)])"), '| their helper asked to alert:', ('tonykey','msg_push',None) in helper)
        # a photo from her
        png=await M.evaluate("(()=>{ const c=document.createElement('canvas'); c.width=800; c.height=600; c.getContext('2d').fillRect(0,0,800,600); return c.toDataURL('image/png').split(',')[1]; })()")
        await M.set_input_files('#mpP',files=[{'name':'cake.png','mimeType':'image/png','buffer':base64.b64decode(png)}]); await T.wait_for_timeout(2500)
        db=json.loads(await T.evaluate("localStorage.getItem('mockdb')"))
        await T.evaluate("msgAs='p1'; openMsgs('p1|p4')"); await T.wait_for_timeout(1200)
        print('6 her photo: kept in Tony\'s family:', len([k for k in db if k.startswith(hT+'/msgpics/')]), 'in hers:', len([k for k in db if k.startswith(hM+'/msgpics/')]), '| Tony sees it:', await T.locator('.mpic img').count())
        # Tony calls her
        await T.click('#cV'); await T.wait_for_timeout(4500)
        print('7 Tony video-calls Masako: her phone rings:', await M.locator('#callUI.cs-ringing').count(), await M.locator('#cName').inner_text() if await M.locator('#cName').count() else '', '| ring alert asked of Tony\'s helper:', any(h[0]=='tonykey' and h[1]=='call_ring' for h in helper))
        await M.click('#cYesV')
        for i in range(30):
            await T.wait_for_timeout(500)
            if await T.evaluate("!!call&&call.st==='live'") and await M.evaluate("!!call&&call.st==='live'"): break
        await T.wait_for_timeout(2000)
        print('8 connected:', await T.evaluate("call&&call.st"), await M.evaluate("call&&call.st"), '| video both ways:', await T.evaluate("document.querySelector('#cvR').videoWidth>0"), await M.evaluate("document.querySelector('#cvR').videoWidth>0"))
        await M.click('#cEnd'); await T.wait_for_timeout(1800)
        print('9 she hangs up: both closed:', await T.locator('#callUI').count()==0, await M.locator('#callUI').count()==0, '| chat line on her side:', await M.evaluate("S.msgs.filter(m=>m.call).map(m=>m.text)"))
        # she calls Aria (who has no phone): must stay away from Tony's phone... it is not a fridge here, so nobody answers; then she calls Family
        await M.evaluate("closeModal(); openMsgs()"); await M.wait_for_timeout(300); await M.click('.mrow >> text=family'); await M.wait_for_timeout(400)
        print('10 her Family chat with them:', await M.locator('.mhead h2').inner_text(), '|', await M.locator('.mb .mtxt').all_inner_texts())
        helper.clear(); await M.click('#cA'); await T.wait_for_timeout(4500)
        print('11 she calls the family: Tony\'s phone rings:', await T.locator('#callUI.cs-ringing').count(), await T.locator('#cName').inner_text() if await T.locator('#cName').count() else '', '| alert asked of their helper with their id:', [h[:2] for h in helper if h[1]=='call_ring'], all('~' not in (h[2] or '') for h in helper))
        await T.click('#cYes')
        for i in range(30):
            await T.wait_for_timeout(500)
            if await T.evaluate("!!call&&call.st==='live'") and await M.evaluate("!!call&&call.st==='live'"): break
        print('12 answered:', await T.evaluate("call&&call.st"), await M.evaluate("call&&call.st"))
        await T.wait_for_timeout(1200); await T.click('#cEnd'); await T.wait_for_timeout(6500)
        db=json.loads(await T.evaluate("localStorage.getItem('mockdb')"))
        print('13 call records left behind:', len([k for k in db if '/calls/' in k]), '| a Family call from Tony is not sent to her:', await T.evaluate("SYNC.chatEm('fam',true).length")==0)
        # Tony takes her out of the Family chat
        await T.evaluate("closeModal(); openSettings()"); await T.wait_for_timeout(500)
        print('14 setting shown:', await T.locator('[data-fch]').count()); await T.locator('[data-fch]').uncheck(); await T.wait_for_timeout(800)
        await T.evaluate("closeModal(); msgSend('p1','fam','Just us now')"); await M.wait_for_timeout(1500)
        await M.evaluate("closeModal(); openMsgs()"); await M.wait_for_timeout(400)
        print('15 after that: she gets:', 'Just us now' in await M.evaluate("S.msgs.map(m=>m.text)"), '| her chat list:', await M.evaluate("[...document.querySelectorAll('.mrow b')].map(x=>x.textContent)"))
        seen=await M.evaluate("S.msgs.map(m=>m.text)"); print('16 never saw the private or older ones:', not any(t in seen for t in ['Private to Reyna','Still private','Old family message']), seen)
        # a record where the linked account speaks as someone else is ignored on the family's side
        await T.evaluate("""(()=>{ const d=JSON.parse(localStorage.getItem('mockdb')); const k=Object.keys(d).find(x=>/^households\\/[^/]+$/.test(x)&&d[x].owner==='tonyandreynanz@gmail.com');
          d[k+'/msgs/fake1']={th:'p1|p2',from:'p1',text:'FAKE as Tony',at:Date.now(),seen:[],em:['masakofraser@gmail.com'],byE:'masakofraser@gmail.com'}; localStorage.setItem('mockdb',JSON.stringify(d)); window.dispatchEvent(new StorageEvent('storage',{key:'mockdb'})); })()"""); await T.wait_for_timeout(800)
        print('17 a message written by her but signed as Tony is ignored:', await T.evaluate("S.msgs.some(m=>m.text==='FAKE as Tony')"), '-> shown:', await T.evaluate("msgIn('p1|p2').some(m=>m.text==='FAKE as Tony')"), '| unread for Reyna:', await T.evaluate("msgUnread('p2')"))
        print('errors:', errs); await b.close()
asyncio.run(main())
