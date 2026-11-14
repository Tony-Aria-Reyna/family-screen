import asyncio, json
from playwright.async_api import async_playwright
U='http://localhost:5500/index.html'
def CSSE(txt):
    ev=[{"type":"message_start","message":{}},{"type":"content_block_start","index":0,"content_block":{"type":"thinking"}},{"type":"content_block_delta","index":0,"delta":{"type":"thinking_delta","thinking":"hmm"}}]
    ev+=[{"type":"content_block_delta","index":1,"delta":{"type":"text_delta","text":txt[i:i+9]}} for i in range(0,len(txt),9)]+[{"type":"message_stop"}]
    return ''.join('event: '+e['type']+'\ndata: '+json.dumps(e)+'\n\n' for e in ev)
GSSE=lambda txt: 'data: '+json.dumps({"candidates":[{"content":{"parts":[{"text":txt}]}}]})+'\n\n'
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); ctx=await b.new_context(viewport={'width':1200,'height':1300},timezone_id='Pacific/Auckland')
        F=await ctx.new_page(); errs=[]; F.on('pageerror',lambda e:errs.append(str(e)))
        creq=[]; greq=[]; mode={'c':'ok'}
        async def croute(r):
            body=json.loads(r.request.post_data); creq.append((body, r.request.headers))
            if mode['c']=='nocredit': await r.fulfill(status=400,json={"type":"error","error":{"type":"invalid_request_error","message":"Your credit balance is too low to access the Anthropic API."}}); return
            if mode['c']=='noeffort' and 'output_config' in body: await r.fulfill(status=400,json={"type":"error","error":{"message":"output_config.effort is not supported"}}); return
            txt=body['messages'][0]['content'][-1]['text']
            out='Tomorrow: dentist at 9.' if 'Question:' in txt else ('Kia ora whānau, good morning!' if 'good morning' in txt else json.dumps({"recipes":[{"name":"Claude curry","meal":"dinner","emoji":"🍛","mins":25,"serves":3,"tags":["Asian"],"blurb":"x","ing":[[400,"g","chicken"]],"steps":[["Cook.",5]]}]}))
            await r.fulfill(status=200,headers={'content-type':'text/event-stream'},body=CSSE(out))
        async def groute(r):
            u=r.request.url
            if 'models?' in u: await r.fulfill(json={"models":[{"name":"models/gemini-3.6-flash","supportedGenerationMethods":["generateContent"]}]}); return
            greq.append(json.loads(r.request.post_data)); await r.fulfill(status=200,headers={'content-type':'text/event-stream'},body=GSSE('Gemini says hi'))
        await F.route('https://api.anthropic.com/**',croute); await F.route('https://generativelanguage.googleapis.com/**',groute)
        await F.goto(U); await F.wait_for_timeout(400); await F.evaluate("SYNC.testSignIn('tony@example.com')"); await F.wait_for_timeout(500)
        await F.click('#gNew'); await F.wait_for_timeout(2500)
        if await F.locator('text=Which one is you?').count(): await F.click('.opts [data-mep=p1]')
        await F.evaluate("SYNC.saveSecret({gemini:'AQ.testkey1234567890abcdefghij',at:Date.now()})"); await F.wait_for_timeout(600)
        print('1 default:', await F.evaluate("aiLabel()"))
        await F.evaluate("aiSetup()"); await F.wait_for_timeout(300)
        await F.click('[data-prov="claude"]'); await F.wait_for_timeout(200)
        print('2 claude chosen, no key ->', await F.evaluate("aiLabel()"))
        await F.fill('#ck','not-a-key'); await F.click('#cs'); await F.wait_for_timeout(200); print('3 bad key msg:', await F.locator('text=starts with sk-ant-').count()>0)
        await F.fill('#ck','sk-ant-api03-abcdefghijklmnopqrstuvwxyz0123456789'); await F.click('#cs'); await F.wait_for_timeout(700)
        print('4 after key:', await F.evaluate("aiLabel()"), '| gemini key kept:', await F.evaluate("!!S.aiKey"), '| claude key:', await F.evaluate("!!S.claudeKey"))
        await F.click('[data-cm="claude-opus-5-5"]'); await F.wait_for_timeout(150); await F.click('[data-ef="high"]'); await F.wait_for_timeout(150)
        await F.click('#tst'); await F.wait_for_timeout(900); print('5 test:', await F.locator('#tout').inner_text())
        body,hd=creq[-1]; print('6 request:', body['model'], body['output_config'], body['stream'], '| headers:', hd.get('anthropic-version'), hd.get('anthropic-dangerous-direct-browser-access'), hd.get('x-api-key','')[:7])
        await F.screenshot(path='/tmp/aiset.png')
        await F.click('#c'); await F.wait_for_timeout(300)
        # settings survive a sync round trip
        print('7 saved:', await F.evaluate("[S.aiProv,S.aiClaudeModel,S.aiEffort,S.claudeKeyTail].join('|')"))
        # JSON feature through Claude
        await F.evaluate("openIdeas()"); await F.click('[data-mood="Asian"]'); await F.click('#go'); await F.wait_for_timeout(900)
        print('8 ideas via claude:', await F.locator('.idea').count(), '| gemini calls so far:', len(greq)); await F.evaluate("closeModal()")
        # ask, streaming
        await F.click('#askBtn'); await F.wait_for_timeout(200); print('9 ask chip:', await F.locator('#aiw').inner_text())
        await F.fill('#aq','What is on tomorrow?'); await F.press('#aq','Enter'); await F.wait_for_timeout(800)
        print('10 ask:', await F.locator('.ask.ai').last.inner_text()); await F.click('#x')
        # effort rejected -> retried without
        mode['c']='noeffort'; n=len(creq); r=await F.evaluate("aiAsk({prompt:'good morning',json:false})"); print('11 effort retry:', r, len(creq)-n, 'output_config' in creq[-1][0])
        # credits gone -> falls back to Gemini
        mode['c']='nocredit'; r=await F.evaluate("aiAsk({prompt:'good morning',json:false})"); await F.wait_for_timeout(200); print('12 fallback:', r, '| toast:', (await F.locator('.toast').last.inner_text()) if await F.locator('.toast').count() else '')
        # url goes to gemini
        mode['c']='ok'; n=len(creq); g=len(greq); await F.evaluate("aiAsk({prompt:'read',url:'https://example.com/r',json:false})"); print('13 url -> gemini:', len(creq)-n==0, len(greq)-g==1)
        # switch back
        await F.evaluate("aiSetup()"); await F.wait_for_timeout(200); await F.click('[data-prov="gemini"]'); await F.wait_for_timeout(200); print('14 back:', await F.evaluate("aiLabel()"), '| model row hidden:', await F.locator('[data-cm]').count()==0)
        n=len(creq); r=await F.evaluate("aiAsk({prompt:'good morning',json:false})"); print('15 gemini answers:', r, len(creq)-n==0)
        await F.click('[data-prov="claude"]'); await F.wait_for_timeout(200); print('16 forth again keeps choices:', await F.evaluate("aiLabel()"))
        print('errs',errs); await b.close()
asyncio.run(main())
