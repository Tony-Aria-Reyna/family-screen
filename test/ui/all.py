import asyncio, json
from playwright.async_api import async_playwright
FAKE={"features":[{"properties":{"housenumber":"12","street":"Glenview Road","district":"Glen Eden","city":"Auckland"}},{"properties":{"name":"Glen Eden Library","street":"Glendale Road","district":"Glen Eden","city":"Auckland"}}]}
async def swipe(pg,sel,dx):
    await pg.evaluate("""([sel,dx])=>{ const el=document.querySelector(sel); const r=el.getBoundingClientRect(), x=r.left+r.width/2, y=r.top+Math.min(r.height-20,120);
      const T=(t,cx)=>new TouchEvent(t,{bubbles:true,touches:t==='touchend'?[]:[new Touch({identifier:1,target:el,clientX:cx,clientY:y})],changedTouches:[new Touch({identifier:1,target:el,clientX:cx,clientY:y})]});
      el.dispatchEvent(T('touchstart',x)); el.dispatchEvent(T('touchend',x+dx)); }""",[sel,dx])
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch()
        ctx=await b.new_context(viewport={'width':411,'height':860},timezone_id='Pacific/Auckland',locale='en-NZ',has_touch=True,is_mobile=True)
        pg=await ctx.new_page(); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
        await pg.route('**/photon.komoot.io/**', lambda r: r.fulfill(status=200,content_type='application/json',body=json.dumps(FAKE),headers={'Access-Control-Allow-Origin':'*'}))
        await pg.goto('http://localhost:5500/index.html?demo'); await pg.wait_for_timeout(700)
        await pg.evaluate("localStorage.setItem('fs.pview',JSON.stringify('month'))"); await pg.reload(); await pg.wait_for_timeout(600)
        d0=await pg.evaluate('pSel'); await swipe(pg,'#pcSheet .ps-scroll',-150); await pg.wait_for_timeout(300); d1=await pg.evaluate('pSel')
        print('month sheet swipe left:', d0,'->',d1, '| tab:', await pg.evaluate("document.body.dataset.tab||'cal'"))
        await swipe(pg,'#pcSheet .ps-scroll',150); await pg.wait_for_timeout(300); print('swipe right back:', await pg.evaluate('pSel'))
        await swipe(pg,'#phoneTop',-150); await pg.wait_for_timeout(300); print('swipe header -> tab:', await pg.evaluate("document.body.dataset.tab"))
        await pg.click('[data-tab=cal]'); await pg.wait_for_timeout(300)
        await pg.click('[data-pv=week]'); await pg.wait_for_timeout(300)
        d0=await pg.evaluate('pSel'); await swipe(pg,'#pwSheet .ps-scroll',-150); await pg.wait_for_timeout(300); print('week sheet swipe:', d0,'->',await pg.evaluate('pSel'))
        # add form: dials
        await pg.wait_for_timeout(500); await pg.click('#pcFab'); await pg.wait_for_timeout(500)
        print('default time:', await pg.evaluate("document.querySelector('#d0 .wi.sel') && [...document.querySelectorAll('#d0 .wi.sel')].map(x=>x.textContent).join(':')"), '| len:', await pg.locator('#lenTxt').inner_text())
        # roll minutes from 00 up one to 59 (loop)
        await pg.evaluate("(()=>{ const w=document.querySelectorAll('#d0 .wheel')[1]; w.scrollTop-=w.querySelector('.wi').getBoundingClientRect().height; })()"); await pg.wait_for_timeout(600)
        print('minute rolled back past 00 ->', await pg.evaluate("document.querySelectorAll('#d0 .wheel')[1].querySelector('.wi.sel').textContent"), '| finish keeps length:', await pg.locator('#lenTxt').inner_text())
        # end dial: +1 hour
        await pg.evaluate("(()=>{ const w=document.querySelectorAll('#d1 .wheel')[0]; w.scrollTop+=w.querySelector('.wi').getBoundingClientRect().height; })()"); await pg.wait_for_timeout(500)
        print('after end +1h:', await pg.locator('#lenTxt').inner_text())
        # tap selected hour -> typing
        await pg.locator('#d0 .wheel').first.locator('.wi.sel').click(); await pg.wait_for_timeout(300)
        print('tap number -> typing:', await pg.locator('#d0 .typed').count())
        await pg.fill('#d0 .hh','3'); await pg.fill('#d0 .mm','45'); await pg.click('#d0 [data-ap=pm]'); await pg.click('#d0 .okt'); await pg.wait_for_timeout(300)
        # address
        await pg.fill('#evTitle','Swim'); await pg.locator('#evAddr').type('12 Glenview',delay=20); await pg.wait_for_timeout(800)
        opts=await pg.locator('.addropt').all_inner_texts(); print('address suggestions:', opts)
        await pg.locator('.addropt').first.click(); await pg.wait_for_timeout(100); print('address picked:', await pg.input_value('#evAddr'))
        await pg.locator('[data-who]').first.click(); await pg.click('#sBtn'); await pg.wait_for_timeout(300)
        print('saved:', await pg.evaluate("JSON.stringify(S.events.find(e=>e.title==='Swim'))"))
        await pg.screenshot(path='/tmp/all1.png')
        print(errs); await b.close()
        # fridge day view swipe
        b=await p.chromium.launch(); ctx=await b.new_context(viewport={'width':1885,'height':940},timezone_id='Pacific/Auckland',has_touch=True)
        pg=await ctx.new_page(); await pg.goto('http://localhost:5500/index.html?demo'); await pg.wait_for_timeout(600)
        await pg.click('[data-v=day]'); await pg.wait_for_timeout(200); d0=await pg.evaluate('fDay'); await swipe(pg,'#cal .fday',-200); await pg.wait_for_timeout(300); print('fridge day swipe:', d0,'->',await pg.evaluate('fDay'))
        await pg.click('[data-v=week]'); await b.close()
asyncio.run(main())
