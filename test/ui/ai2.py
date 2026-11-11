import asyncio, json
from playwright.async_api import async_playwright
U='http://localhost:5500/index.html'
SSE=lambda txt: ''.join('data: '+json.dumps({"candidates":[{"content":{"parts":[{"text":t}]}}]})+'\n\n' for t in [txt[i:i+12] for i in range(0,len(txt),12)])
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); ctx=await b.new_context(viewport={'width':1885,'height':940},timezone_id='Pacific/Auckland')
        F=await ctx.new_page(); errs=[]; F.on('pageerror',lambda e:errs.append(str(e)+' @ '+str(getattr(e,'stack',''))[:300]))
        reqs=[]
        async def route(r):
            u=r.request.url; reqs.append(u)
            if 'models?' in u: await r.fulfill(json=({"models":[{"name":"models/gemini-3.7-flash","supportedGenerationMethods":["generateContent"]},{"name":"models/gemini-3.6-flash","supportedGenerationMethods":["generateContent"]}]})); return
            body=json.loads(r.request.post_data); prompt=body['contents'][0]['parts'][0]['text']; reqs.append(prompt)
            if 'memory bank' in prompt: out=json.dumps({"title":"Aria's school","notes":["Aria is at Glen Eden Primary, Room 7","School finishes 3pm"]})
            elif 'Question:' in prompt: out="Tomorrow is Thursday.\n- Dentist 9am\n- Reyna lands 8:30pm"
            else: out=json.dumps({"recipes":[{"name":"Peanut-free satay","meal":"dinner","emoji":"🍢","mins":25,"serves":3,"tags":["Asian"],"blurb":"x","ing":[[400,"g","chicken"]],"steps":[["Cook.",5]]}]})
            await r.fulfill(status=200,headers={'content-type':'text/event-stream'},body=SSE(out))
        await F.route('https://generativelanguage.googleapis.com/**',route)
        await F.goto(U); await F.wait_for_timeout(400); await F.evaluate("SYNC.testSignIn('tony@example.com')"); await F.wait_for_timeout(500)
        await F.click('#gNew'); await F.wait_for_timeout(2500)
        if await F.locator('text=Which one is you?').count(): await F.click('.opts [data-mep=p1]')
        await F.evaluate("SYNC.saveSecret({gemini:'AQ.testkey1234567890abcdefghij',at:Date.now()})"); await F.wait_for_timeout(800)
        print('key in app:', await F.evaluate("!!S.aiKey"))
        # memory: type a fact, drop a text file, drop an 'image'
        await F.evaluate("openMemory()"); await F.wait_for_timeout(300)
        await F.fill('#mtxt','Aria is allergic to peanuts'); await F.press('#mtxt','Enter'); await F.wait_for_timeout(200)
        await F.set_input_files('#mf',[{'name':'car.txt','mimeType':'text/plain','buffer':b'The Mazda CX-5 plate ABC123 takes 95 petrol. WOF due March.'}]); await F.wait_for_timeout(300)
        png=bytes.fromhex('89504e470d0a1a0a0000000d4948445200000001000000010802000000907753de0000000c4944415408d763f8cfc0000003010100c9fe92ef0000000049454e44ae426082')
        await F.set_input_files('#mf',[{'name':'school.png','mimeType':'image/png','buffer':png}]); await F.wait_for_timeout(1500)
        print('memory:', await F.evaluate("S.memory.map(m=>(m.title||'')+'|'+m.text.slice(0,50)).join(' ;; ')"))
        await F.screenshot(path='/tmp/mem1.png'); await F.click('#x')
        # ideas use memory
        await F.evaluate("openIdeas()"); await F.click('[data-mood="Asian"]'); await F.click('#go'); await F.wait_for_timeout(800)
        pr=[r for r in reqs if 'Suggest' in r][-1]; print('ideas prompt has memory:', 'peanuts' in pr and 'Mazda' in pr, '| streaming url:', any('streamGenerateContent' in r for r in reqs))
        print('ideas shown:', await F.locator('.idea').count()); await F.evaluate("closeModal()")
        # ask
        await F.click('#askBtn'); await F.wait_for_timeout(200); await F.fill('#aq','What is on tomorrow?'); await F.press('#aq','Enter'); await F.wait_for_timeout(800)
        print('ask answer:', (await F.locator('.ask.ai').last.inner_text()).replace('\n',' / '))
        pr=[r for r in reqs if 'Question:' in r][-1]; print('ask prompt has context:', 'What the app knows' in pr, 'right now' in pr)
        await F.screenshot(path='/tmp/ask1.png')
        print(errs); await b.close()
asyncio.run(main())
