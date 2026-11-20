# Scanning a bill: Bills buttons, add-anything routing, and a bounced payment caught
import asyncio, json, base64
from playwright.async_api import async_playwright
U='http://localhost:5500/index.html'; ADMIN='tonyandreynanz@gmail.com'
PNG=base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==')
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); ctx=await b.new_context(timezone_id='Pacific/Auckland')
        errs=[]; P=await ctx.new_page(); P.on('pageerror',lambda e:errs.append(str(e))); await P.set_viewport_size({'width':1280,'height':800})
        async def groute(r):
            u=r.request.url
            if 'models?' in u: await r.fulfill(json={"models":[{"name":"models/gemini-3.6-flash","supportedGenerationMethods":["generateContent"]}]}); return
            t=r.request.post_data
            if 'Sort what a family member' in t: out={"bill":True,"items":[{"type":"todo","title":"Pay Watercare overdue bill $271.51"}]}
            else: out={"isBill":True,"biller":"Watercare","amount":271.51,"due":"2026-12-04","directDebit":True,"account":"5108028-02","period":"November","category":"Water","summary":"Water and wastewater for November plus the overdue balance.","carried":{"amount":133.32,"why":"dishonoured"},"overdue":True}
            await r.fulfill(status=200,headers={'content-type':'text/event-stream'},body='data: '+json.dumps({"candidates":[{"content":{"parts":[{"text":json.dumps(out)}]}}]})+'\n\n')
        await P.route('https://generativelanguage.googleapis.com/**',groute)
        await P.goto(U); await P.wait_for_timeout(400)
        await P.evaluate(f"localStorage.setItem('fs.askedMe',JSON.stringify(['{ADMIN}'])); SYNC.testSignIn('{ADMIN}')"); await P.wait_for_timeout(700)
        await P.click('#gNew'); await P.wait_for_timeout(1000)
        await P.evaluate("SYNC.saveSecret({gemini:'AQ.testkey1234567890abcdefghij',at:Date.now()}); S.bills=[{id:'w1',biller:'Watercare',amount:13332,due:'2026-11-16',status:'paid',paidAt:Date.parse('2026-11-16'),paidHow:'Bank transfer'}]; save()"); await P.wait_for_timeout(600)
        # 1) through the add-anything box
        await P.evaluate("openAddAny()"); await P.wait_for_timeout(300)
        await P.set_input_files('#mAdd .aafilec',files=[{'name':'bill.png','mimeType':'image/png','buffer':PNG}]); await P.wait_for_timeout(2000)
        print('1 add-anything result:', (await P.locator('#mAdd .aares').inner_text()).replace('\n',' / '))
        print('2 bills now:', await P.evaluate("JSON.stringify(S.bills.map(b=>[b.biller,b.amount,b.due,b.status,b.directDebit,!!b.dishonoured]))"), '| jobs:', await P.evaluate("S.todos.map(t=>t.title)"))
        # 2) again from Bills: recognised, not doubled
        await P.evaluate("closeModal(); openBills('due')"); await P.wait_for_timeout(300)
        print('3 Bills has scan buttons:', await P.locator('#bScan').count(), await P.locator('#bPick').count())
        await P.set_input_files('#bfC',files=[{'name':'bill.png','mimeType':'image/png','buffer':PNG}]); await P.wait_for_timeout(2000)
        print('4 second scan:', await P.evaluate("S.bills.length"), '| opened:', (await P.locator('.modal h2').first.inner_text()))
        await P.evaluate("closeModal(); openBills('paid')"); await P.wait_for_timeout(300); print('5 paid tab:', (await P.locator('.tvlist').inner_text()).replace('\n',' / ')[:200])
        print('errors:', errs)
        await b.close()
asyncio.run(main())
