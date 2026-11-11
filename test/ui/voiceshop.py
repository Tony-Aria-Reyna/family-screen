import asyncio
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); pg=await b.new_page(viewport={'width':1885,'height':940}); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
        await pg.goto('http://localhost:5500/index.html?demo'); await pg.wait_for_timeout(600)
        await pg.evaluate("S.groceries.push({id:'vx1',name:'Oat milk',shop:S.shops.find(s=>s.aisles).id,aisle:'',done:false,voice:true}); save(); renderShop()")
        await pg.wait_for_timeout(300)
        print('aisle filled:', await pg.evaluate("JSON.stringify(S.groceries.find(g=>g.id==='vx1'))"))
        print(errs); await b.close()
asyncio.run(main())
