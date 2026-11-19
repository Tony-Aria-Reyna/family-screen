# 2.4 Share to Family Screen: the service worker keeps what was shared, the app opens, the AI sorts it into the inbox
import asyncio, json
from playwright.async_api import async_playwright
U='http://localhost:5500/index.html'; ADMIN='tonyandreynanz@gmail.com'
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); ctx=await b.new_context(timezone_id='Pacific/Auckland',locale='en-NZ')
        errs=[]; P=await ctx.new_page(); P.on('pageerror',lambda e:errs.append(str(e))); await P.set_viewport_size({'width':390,'height':844})
        greq=[]
        async def groute(r):
            u=r.request.url
            if 'models?' in u: await r.fulfill(json={"models":[{"name":"models/gemini-3.6-flash","supportedGenerationMethods":["generateContent"]}]}); return
            body=json.loads(r.request.post_data); greq.append(body)
            out={"summary":"School camp letter","items":[{"type":"event","title":"School camp","date":"2026-12-02","time":"08:30","end":"","due":"","note":"bring a sleeping bag","who":"p3"},{"type":"todo","title":"Pay camp fee","date":"","time":"","end":"","due":"2026-11-27","note":"$85","who":""}]}
            await r.fulfill(status=200,headers={'content-type':'text/event-stream'},body='data: '+json.dumps({"candidates":[{"content":{"parts":[{"text":json.dumps(out)}]}}]})+'\n\n')
        await P.route('https://generativelanguage.googleapis.com/**',groute)
        await P.goto(U); await P.wait_for_timeout(500)
        await P.evaluate("navigator.serviceWorker.register('sw.js')"); await P.wait_for_timeout(800)
        await P.evaluate(f"localStorage.setItem('fs.askedMe',JSON.stringify(['{ADMIN}'])); SYNC.testSignIn('{ADMIN}')"); await P.wait_for_timeout(700)
        await P.click('#gNew'); await P.wait_for_timeout(900)
        await P.evaluate("SYNC.saveSecret({gemini:'AQ.testkey1234567890abcdefghij',at:Date.now()})"); await P.wait_for_timeout(600)
        await P.reload(); await P.wait_for_timeout(1500)
        ctl=await P.evaluate("!!navigator.serviceWorker.controller")
        # what Android sends when someone taps Share → Family Screen on a photo of the camp letter
        st=await P.evaluate("""(async()=>{ const f=new FormData(); f.append('title','Camp letter'); f.append('text','Year 4 camp'); f.append('url','');
          const cv=document.createElement('canvas'); cv.width=200; cv.height=120; const g=cv.getContext('2d'); g.fillStyle='#fff'; g.fillRect(0,0,200,120); g.fillStyle='#000'; g.fillText('Camp 2 Dec',20,60);
          const bl=await new Promise(r=>cv.toBlob(r,'image/jpeg',.8)); f.append('file',new File([bl],'letter.jpg',{type:'image/jpeg'}));
          const r=await fetch('share',{method:'POST',body:f}); return r.url; })()""")
        print('1 service worker answered the share:', ctl, '| went to:', st.split('/')[-1])
        await P.goto(U.replace('index.html','')+'?open=share'); await P.wait_for_timeout(2500)
        inbox=await P.evaluate("JSON.stringify((S.inbox||[])[0]||null)")
        d=json.loads(inbox) if inbox!='null' else {}
        print('2 in the inbox:', d.get('sender'), '|', d.get('summary'), '|', [(i['type'],i['title'],i.get('date') or i.get('due')) for i in d.get('items',[])])
        print('3 the photo went to the AI:', bool(greq) and any('inline_data' in pt for pt in greq[-1]['contents'][0]['parts']))
        print('4 inbox open:', await P.locator('.modal h2', has_text='Family inbox').count(), '| share kept once only:', await P.evaluate("caches.open('fs-share').then(c=>c.match('share-meta')).then(r=>!r)"))
        print('errors:', errs)
        await b.close()
asyncio.run(main())
