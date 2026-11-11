import asyncio
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); pg=await b.new_page(viewport={'width':1885,'height':940},timezone_id='Pacific/Auckland')
        errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
        await pg.goto('http://localhost:5500/index.html?demo'); await pg.wait_for_timeout(600)
        await pg.evaluate("""()=>{ S.billFolders=['Power','Power/Mercury','Power/Mercury/2025','Insurance','/Personal','/Personal/Tax']; S.billsRootName='Household Bills';
          S.bills=[{id:'email-m1',status:'check',by:'email',biller:'Mercury',category:'Power',amount:18240,due:dk(addDays(new Date(),10)),reference:'•••• 5678',period:'October',directDebit:true,summary:'Power bill for October',at:Date.now(),date:dk(new Date()),fromEmail:{from:'Mercury',subject:'Your bill',link:'https://mail.google.com/x'},pdf:{driveId:'f1',link:'https://drive/f1',name:'x.pdf',folder:'_To file'}},
            {id:'email-m2',status:'check',by:'email',biller:'Watercare',category:'Water',amount:9530,due:dk(addDays(new Date(),5)),pdf:{driveId:'f2',link:'https://drive/f2',folder:'_To file'},at:Date.now()},
            {id:'email-m3',status:'due',biller:'Spark',category:'Internet',amount:9900,due:dk(addDays(new Date(),2)),at:Date.now()-864e5*20},
            {id:'email-m4',status:'paid',biller:'AA Insurance',category:'Insurance',amount:21000,due:dk(addDays(new Date(),-20)),paidAt:Date.now()-864e5*21,paidHow:'Bank transfer'}]; save(); renderAll(); }""")
        await pg.wait_for_timeout(300); await pg.screenshot(path='/tmp/b_todo.png')
        await pg.locator('#todoPanel [data-bills="check"]').click(); await pg.wait_for_timeout(300); await pg.screenshot(path='/tmp/b_list.png')
        await pg.locator('.modal [data-bill="email-m1"]').click(); await pg.wait_for_timeout(300); await pg.screenshot(path='/tmp/b_check.png')
        print('suggested:', await pg.locator('.bfold b').first.inner_text())
        await pg.click('#bok'); await pg.wait_for_timeout(300)
        print('m1:', await pg.evaluate("JSON.stringify(S.bills.find(b=>b.id==='email-m1'))"))
        await pg.locator('.modal [data-bill="email-m2"]').click(); await pg.wait_for_timeout(200)
        print('suggested2:', await pg.locator('.bfold').first.inner_text())
        await pg.click('#fp'); await pg.fill('#fq','pers'); await pg.wait_for_timeout(100)
        await pg.screenshot(path='/tmp/b_pick.png')
        await pg.locator('[data-f="/Personal/Tax"]').click(); await pg.click('#bok'); await pg.wait_for_timeout(200)
        print('m2 fileTo:', await pg.evaluate("S.bills.find(b=>b.id==='email-m2').fileTo"))
        await pg.click('[data-bt="due"]'); await pg.locator('.modal [data-bill="email-m3"]').click(); await pg.click('#bpd'); await pg.wait_for_timeout(200); await pg.click('[data-h="Bank transfer"]'); await pg.wait_for_timeout(200)
        print('m3:', await pg.evaluate("S.bills.find(b=>b.id==='email-m3').status"))
        await pg.click('[data-bt="report"]'); await pg.wait_for_timeout(200); await pg.screenshot(path='/tmp/b_report.png')
        await pg.click('#x'); await pg.wait_for_timeout(200)
        await pg.evaluate("S.view='month'; renderAll()"); await pg.wait_for_timeout(300); await pg.screenshot(path='/tmp/b_cal.png')
        await pg.evaluate("openHelpers()"); await pg.wait_for_timeout(300); await pg.screenshot(path='/tmp/b_helpers.png')
        print(errs); await b.close()
asyncio.run(main())
