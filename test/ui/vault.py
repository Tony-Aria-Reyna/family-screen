# 3.5 documents vault and 3.4 fridge photo frame / back to Today
import asyncio, json
from playwright.async_api import async_playwright
U='http://localhost:5500/index.html'; ADMIN='tonyandreynanz@gmail.com'
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); ctx=await b.new_context(timezone_id='Pacific/Auckland',locale='en-NZ')
        errs=[]; P=await ctx.new_page(); P.on('pageerror',lambda e:errs.append(str(e))); await P.set_viewport_size({'width':1280,'height':800})
        greq=[]
        async def groute(r):
            u=r.request.url
            if 'models?' in u: await r.fulfill(json={"models":[{"name":"models/gemini-3.6-flash","supportedGenerationMethods":["generateContent"]}]}); return
            body=json.loads(r.request.post_data); greq.append(body); txt=body['contents'][0]['parts'][-1].get('text','') if body['contents'][0]['parts'] else ''
            alltxt=json.dumps(body)
            out={"overlaps":["Roadside help is in both the car policy and the AA membership"],"gaps":["No contents cover"],"check":[]} if 'doubles up' in alltxt else {"kind":"Car","title":"Mazda car insurance","insurer":"AMI","policyNo":"CAR123","covers":"Comprehensive","excess":"$400","premium":"$84 a month","renews":"2027-03-01","claimsPhone":"0800 100 200","emergencyPhone":"","when":"after a crash","summary":"Full cover for the Mazda."}
            await r.fulfill(status=200,headers={'content-type':'text/event-stream'},body='data: '+json.dumps({"candidates":[{"content":{"parts":[{"text":json.dumps(out)}]}}]})+'\n\n')
        await P.route('https://generativelanguage.googleapis.com/**',groute)
        await P.goto(U); await P.wait_for_timeout(500)
        await P.evaluate(f"localStorage.setItem('fs.askedMe',JSON.stringify(['{ADMIN}'])); SYNC.testSignIn('{ADMIN}')"); await P.wait_for_timeout(700)
        await P.click('#gNew'); await P.wait_for_timeout(900)
        await P.evaluate("SYNC.saveSecret({gemini:'AQ.testkey1234567890abcdefghij',at:Date.now()})"); await P.wait_for_timeout(600)
        await P.evaluate("openVault()"); await P.wait_for_timeout(300)
        await P.set_input_files('#vFile',files=[{'name':'policy.pdf','mimeType':'application/pdf','buffer':b'%PDF-1.4 test'}]); await P.wait_for_timeout(1500)
        print('1 saved:', await P.evaluate("JSON.stringify((S.docs||[]).map(d=>[d.kind,d.title,d.claimsPhone,d.renews]))"), '| renewal added:', await P.evaluate("(S.renewals||[]).some(r=>r.item==='Mazda car insurance')"))
        await P.evaluate("S.docs.push({id:'d2',kind:'House',title:'House insurance',insurer:'Tower',claimsPhone:'0800 300 400'}); save(); closeModal(); openVault()"); await P.wait_for_timeout(300)
        await P.click('#vCall'); await P.wait_for_timeout(200); print('2 who to call:', (await P.locator('#vOut').inner_text()).replace('\n',' / ')[:200])
        await P.click('#vOver'); await P.wait_for_timeout(1200); print('3 overlaps:', (await P.locator('#vOut').inner_text()).replace('\n',' / ')[:200])
        # fridge hub: untouched for 3 minutes → back to Today; photo frame on and off
        await P.evaluate("hubIdle=Date.now()-4*60e3; hubHome=false; hubTick()"); await P.wait_for_timeout(300)
        print('4 modal closed after idle:', await P.locator('.scrim').count()==0)
        await P.evaluate("saverOn()"); await P.wait_for_timeout(400); print('5 photo frame shows clock:', (await P.locator('#saver').inner_text()).replace('\n',' / ')[:120])
        await P.mouse.click(300,300); await P.wait_for_timeout(300); print('6 a touch wakes it:', await P.locator('#saver').count()==0)
        print('errors:', errs)
        await b.close()
asyncio.run(main())
