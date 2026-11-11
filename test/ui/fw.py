import asyncio
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch()
        pg=await b.new_page(viewport={'width':1885,'height':940},timezone_id='Pacific/Auckland',locale='en-NZ')
        errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
        await pg.goto('http://localhost:5500/index.html?demo'); await pg.wait_for_timeout(600)
        await pg.evaluate("""()=>{ const tp=traveller(); S.flights=S.flights.filter(f=>f.flight!=='NZ99'); const n=new Date(); const D=(h,m)=>{const x=new Date(n); x.setHours(h,m,0,0); return x.toISOString();};
          S.flights.push({id:'a',who:tp.id,flight:'NZ4',from:'AKL',to:'LAX',start:D(19,0),end:new Date(Date.parse(D(19,0))+12*36e5).toISOString(),report:D(17,45)});
          S.events.push({id:'g1',title:'Gymnastics',date:dk(n),time:'16:30',dur:60,whos:[S.people[0].id,tp.id]}); S.view='week'; renderAll(); }""")
        await pg.wait_for_timeout(300)
        print('blocks:', await pg.locator('.fweek .tb').count(), '| now:', await pg.locator('.fw-now').count())
        tx=pg.locator('.fweek .tb', has_text='Taxi pick-up'); bb=await tx.bounding_box(); print('taxi block h(px):', round(bb['height']), '≈', round(bb['height']/52*60),'min')
        await pg.screenshot(path='/tmp/fw1.png')
        await pg.locator('[data-fday]').nth(2).click(); await pg.wait_for_timeout(200); print('header -> day view:', await pg.evaluate('S.view'))
        await pg.click('[data-v=week]'); await pg.wait_for_timeout(200)
        await tx.click(); await pg.wait_for_timeout(300); print('taxi opens flight:', await pg.locator('.modal h2').inner_text()); await pg.evaluate('closeModal()')
        print(errs); await b.close()
asyncio.run(main())
