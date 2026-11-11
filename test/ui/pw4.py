import asyncio
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch()
        ctx=await b.new_context(viewport={'width':411,'height':860},timezone_id='Pacific/Auckland',locale='en-NZ',has_touch=True,is_mobile=True,device_scale_factor=2)
        pg=await ctx.new_page(); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
        await pg.goto('http://localhost:5500/index.html?demo'); await pg.wait_for_timeout(700)
        await pg.evaluate("localStorage.setItem('fs.pview',JSON.stringify('month'))"); await pg.reload(); await pg.wait_for_timeout(600)
        # try to scroll #pcal
        print('pcal scrollTop after forced scroll:', await pg.evaluate("(()=>{ const p=$('#pcal'); p.scrollTop=200; return p.scrollTop; })()"))
        hb=await pg.locator('#pcToday').bounding_box(); print('today btn inside screen:', hb['x']+hb['width']<=411, round(hb['x']+hb['width']))
        await pg.screenshot(path='/tmp/m1.png')
        await pg.click('[data-pv=week]'); await pg.wait_for_timeout(300)
        hb=await pg.locator('#pcToday').bounding_box(); print('week: today btn inside:', hb['x']+hb['width']<=411)
        y=lambda: pg.evaluate("$('#pwSheet').getBoundingClientRect().top")
        print('initial snap', await pg.evaluate('pwSnap'), round(await y()))
        # drag sheet up via grab
        g=await pg.locator('#pwGrab').bounding_box(); gx,gy=g['x']+g['width']/2,g['y']+g['height']/2
        await pg.mouse.move(gx,gy); await pg.mouse.down(); await pg.mouse.move(gx,gy-150,steps=8); mid=await y(); await pg.mouse.move(gx,gy-500,steps=10); await pg.mouse.up(); await pg.wait_for_timeout(400)
        print('follows finger mid-drag:', round(mid), '| settled:', await pg.evaluate('pwSnap'), round(await y()))
        await pg.screenshot(path='/tmp/w1.png')
        g=await pg.locator('#pwGrab').bounding_box(); gx,gy=g['x']+g['width']/2,g['y']+g['height']/2
        await pg.mouse.move(gx,gy); await pg.mouse.down(); await pg.mouse.move(gx,gy+900,steps=10); await pg.mouse.up(); await pg.wait_for_timeout(400)
        print('dragged down:', await pg.evaluate('pwSnap'), round(await y()))
        await pg.screenshot(path='/tmp/w2.png')
        await pg.locator('[data-pwd]').nth(2).click(); await pg.wait_for_timeout(300)
        print('tap date from low -> ', await pg.evaluate('pwSnap'), '| day:', (await pg.locator('#pwHead').inner_text()).split('\n')[0], '| still week:', await pg.locator('.pw-title').count())
        await pg.screenshot(path='/tmp/w3.png')
        await pg.go_back(); await pg.wait_for_timeout(300); print('back -> low:', await pg.evaluate('pwSnap'))
        print(errs); await b.close()
asyncio.run(main())
