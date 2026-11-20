# 4.0 Calls and photos in Messages: a phone calls Family, the fridge rings and answers, video both ways, camera off/on,
# hang up, one line in the chat; then a missed call; then a photo sent and shown on the other screen.
import asyncio, base64, json
from playwright.async_api import async_playwright
U='http://localhost:5500/index.html'; ADMIN='tonyandreynanz@gmail.com'
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(args=['--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream','--autoplay-policy=no-user-gesture-required'])
        ctx=await b.new_context(timezone_id='Pacific/Auckland',permissions=['camera','microphone'])
        errs=[]; helper=[]
        async def route(r):
            body=json.loads(r.request.post_data or '{}'); helper.append(body.get('action')); await r.fulfill(json={'ok':True,'ice':[],'ttl':43200})
        A=await ctx.new_page(); await A.set_viewport_size({'width':390,'height':844}); A.on('pageerror',lambda e:errs.append('A '+str(e)))
        await A.route('https://script.google.com/**',route)
        await A.clock.install(time='2026-11-21T10:00:00+13:00') if False else None
        await A.goto(U); await A.wait_for_timeout(400)
        await A.evaluate(f"localStorage.setItem('fs.askedMe',JSON.stringify(['{ADMIN}'])); SYNC.testSignIn('{ADMIN}')"); await A.wait_for_timeout(700)
        await A.click('#gNew'); await A.wait_for_timeout(1000)
        await A.evaluate("S.people[0].name='Tony'; S.people[0].email='tonyandreynanz@gmail.com'; S.people[1].name='Reyna'; S.people[1].email='reyna@example.com'; S.people[2].name='Aria'; S.people[3].name='Masako'; S.people[3].email='m@example.com'; S.voiceUrl='https://script.google.com/macros/s/x/exec'; S.voiceKey='k'; save()"); await A.wait_for_timeout(500)
        B=await ctx.new_page(); await B.set_viewport_size({'width':1280,'height':800}); B.on('pageerror',lambda e:errs.append('B '+str(e)))
        await B.route('https://script.google.com/**',route)
        await B.goto(U); await B.wait_for_timeout(400)
        await B.evaluate(f"SYNC.testSignIn('{ADMIN}')"); await B.wait_for_timeout(1500)
        print('0 phone is', await A.evaluate("nm(mePerson())"), '| fridge answers for', await B.evaluate("callFor().map(nm)"), '| calls ready', await A.evaluate("SYNC.callsReady()"), await B.evaluate("SYNC.callsReady()"))
        # --- phone: open the Family chat, video call
        await A.evaluate("msgAs=mePerson(); openMsgs('fam')"); await A.wait_for_timeout(400)
        print('1 chat has call and photo buttons:', await A.locator('#cA').count(), await A.locator('#cV').count(), await A.locator('#mpB').count())
        await A.click('#cV'); await A.wait_for_timeout(4500)
        print('2 phone:', await A.locator('#cSt').inner_text(), '| fridge rings:', await B.locator('#callUI.cs-ringing').count(), await B.locator('#cName').inner_text() if await B.locator('#cName').count() else '', '| ring push asked:', 'call_ring' in helper)
        await B.screenshot(path='/tmp/ring_fridge.png')
        await B.click('#cYesV'); 
        for i in range(30):
            await A.wait_for_timeout(500)
            if await A.evaluate("!!call&&call.st==='live'") and await B.evaluate("!!call&&call.st==='live'"): break
        print('3 connected:', await A.evaluate("call&&call.st"), await B.evaluate("call&&call.st"), '| after', (i+1)*0.5, 's')
        await A.wait_for_timeout(2500)
        vid=lambda P: P.evaluate("(()=>{ const v=document.querySelector('#cvR'); return [v.videoWidth>0, call.peerCam, document.querySelector('#callUI').className, call.remote.getAudioTracks().length]; })()")
        print('4 video seen  phone:', await vid(A), '| fridge:', await vid(B))
        await A.screenshot(path='/tmp/call_phone.png'); await B.screenshot(path='/tmp/call_fridge.png')
        await B.click('#cCam'); await A.wait_for_timeout(1200)
        print('5 fridge camera off -> phone sees:', await A.evaluate("call.peerCam"), '| phone shows the face instead:', 'c-rv' not in await A.evaluate("document.querySelector('#callUI').className"))
        await B.click('#cCam'); await A.wait_for_timeout(2500)
        print('6 camera back on -> phone sees:', await A.evaluate("call.peerCam"), await A.evaluate("document.querySelector('#cvR').videoWidth>0"))
        await A.click('#cMic'); await A.wait_for_timeout(300); print('7 mute:', await A.evaluate("call.local.getAudioTracks()[0].enabled"), await A.locator('#cMic').inner_text())
        await A.click('#cMin'); await A.wait_for_timeout(200); mini=await A.evaluate("document.querySelector('#callUI').classList.contains('c-mini')"); await A.click('#callUI'); await A.wait_for_timeout(200)
        print('8 minimise then tap to bring back:', mini, not await A.evaluate("document.querySelector('#callUI').classList.contains('c-mini')"))
        await A.wait_for_timeout(1000); await A.click('#cEnd'); await A.wait_for_timeout(1500)
        print('9 ended  phone:', await A.locator('#callUI').count(), '| fridge:', await B.locator('#callUI').count(), '| chat line:', await A.evaluate("S.msgs.filter(m=>m.call).map(m=>[m.text,m.call.ok,m.seen.length,!!m.pushed])"))
        await A.wait_for_timeout(5500); print('10 call record removed:', await A.evaluate("Object.keys(JSON.parse(localStorage.mockdb)).filter(k=>k.includes('/calls/')).length"))
        # --- fridge (as Aria) calls Tony; Tony declines
        await B.evaluate("msgAs=S.people[2].id; openMsgs(msgThread(S.people[2].id,S.people[0].id))"); await B.wait_for_timeout(400)
        await B.click('#cA'); await B.wait_for_timeout(4000)
        print('11 Aria calls Tony: phone rings:', await A.locator('#callUI.cs-ringing').count(), await A.locator('#cName').inner_text(), '|', await A.locator('#cSt').inner_text(), '| buttons:', await A.evaluate("[...document.querySelectorAll('#cBar button')].map(b=>b.innerText.replace(/\\n/g,' '))"))
        await A.screenshot(path='/tmp/ring_phone.png')
        await A.click('#cNo'); await B.wait_for_timeout(2000)
        print('12 declined: fridge closed:', await B.locator('#callUI').count()==0, '| chat line:', await B.evaluate("S.msgs.filter(m=>m.call).map(m=>[m.text,m.call.ok,!!m.pushed]).slice(-1)"), '| shown:', await B.locator('.mcall.miss').inner_text())
        # --- a call to Reyna must NOT ring the fridge or Tony's phone
        await A.evaluate("closeModal(); msgAs=mePerson(); openMsgs(msgThread(mePerson(),S.people[1].id))"); await A.wait_for_timeout(400)
        await A.click('#cA'); await A.wait_for_timeout(4000)
        print('13 Tony calls Reyna: fridge stays quiet:', await B.locator('#callUI').count()==0, '| phone:', await A.locator('#cSt').inner_text())
        await A.click('#cEnd'); await A.wait_for_timeout(800)
        # --- a photo
        png=await A.evaluate("(()=>{ const c=document.createElement('canvas'); c.width=1600; c.height=1200; const g=c.getContext('2d'); g.fillStyle='#4a9'; g.fillRect(0,0,1600,1200); g.fillStyle='#fff'; g.font='200px sans-serif'; g.fillText('Hello',300,600); return c.toDataURL('image/png').split(',')[1]; })()")
        await A.evaluate("closeModal(); openMsgs('fam')"); await A.wait_for_timeout(300)
        await A.set_input_files('#mpP',files=[{'name':'beach.png','mimeType':'image/png','buffer':base64.b64decode(png)}]); await A.wait_for_timeout(2500)
        print('14 photo sent:', await A.evaluate("S.msgs.filter(m=>m.pic).map(m=>[m.text,m.pic.w,m.pic.h,m.pic.t.length])"), '| stored:', await A.evaluate("Object.keys(JSON.parse(localStorage.mockdb)).filter(k=>k.includes('/msgpics/')).length"), '| shown on phone:', await A.locator('.mpic img').count())
        await B.evaluate("closeModal(); msgAs=S.people[2].id; openMsgs('fam')"); await B.wait_for_timeout(1500)
        print('15 fridge shows it:', await B.locator('.mpic img').count(), await B.evaluate("(()=>{ const i=document.querySelector('.mpic img'); return i&&[i.naturalWidth,i.naturalHeight]; })()"))
        await B.screenshot(path='/tmp/msg_thread.png')
        await B.click('.mpic'); await B.wait_for_timeout(300); print('16 tap opens it big:', await B.locator('.alview img').count(), await B.locator('.alview #va').inner_text())
        await B.screenshot(path='/tmp/msg_photo.png')
        print('errors:', errs); await b.close()
asyncio.run(main())
