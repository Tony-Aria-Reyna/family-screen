import asyncio, zxingcpp
from PIL import Image
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch()
        ctx=await b.new_context(viewport={'width':411,'height':860},timezone_id='Pacific/Auckland',has_touch=True,is_mobile=True,device_scale_factor=2)
        pg=await ctx.new_page(); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
        await pg.goto('http://localhost:5500/index.html?demo'); await pg.wait_for_timeout(700)
        await pg.click('[data-tab=shop]'); await pg.wait_for_timeout(300)
        print('add prompt shown:', await pg.locator('#cardAdd').count())
        await pg.click('#cardAdd'); await pg.wait_for_timeout(300)
        # add card 1 by typing
        await pg.click('#cAdd'); await pg.wait_for_timeout(300)
        await pg.fill('#cNum','9490043903320'); await pg.locator('#cNum').dispatch_event('input')
        print('detected 1:', await pg.locator('#cFmtNote').inner_text())
        await pg.locator('[data-pre="Everyday Rewards"]').click(); await pg.click('#cSave'); await pg.wait_for_timeout(300)
        await pg.click('#cAdd'); await pg.wait_for_timeout(300)
        await pg.fill('#cNum','6059 1742 6522 5359'); await pg.locator('#cNum').dispatch_event('input')
        print('detected 2:', await pg.locator('#cFmtNote').inner_text())
        await pg.screenshot(path='/tmp/c0.png')
        await pg.locator('[data-pre="New World Clubcard"]').click(); await pg.fill('#cOwner','Reyna Ross'); await pg.click('#cSave'); await pg.wait_for_timeout(300)
        print('cards list:', (await pg.locator('.modal').inner_text())[:200].replace('\n',' | '))
        await pg.click('#cX'); await pg.wait_for_timeout(1400)
        await pg.screenshot(path='/tmp/c1.png')
        await pg.locator('[data-card="1"]').click(); await pg.wait_for_timeout(700)
        await pg.screenshot(path='/tmp/c2.png')
        print('wallet open on:', await pg.evaluate("Math.round($('#wlTrack').scrollLeft/$('#wlTrack').clientWidth)"))
        # decode each card's barcode
        for i in range(2):
            await pg.evaluate(f"$('#wlTrack').scrollLeft={i}*$('#wlTrack').clientWidth"); await pg.wait_for_timeout(300)
            bc=pg.locator('.wl-bc').nth(i); await bc.screenshot(path=f'/tmp/bc{i}.png')
            r=zxingcpp.read_barcodes(Image.open(f'/tmp/bc{i}.png'))
            print(f'card {i} decodes as:', [(x.format.name, x.text) for x in r])
        await pg.go_back(); await pg.wait_for_timeout(300); print('back closes wallet:', await pg.locator('#wallet').count()==0)
        # QR card
        await pg.evaluate("S.cards.push({id:'q',name:'Library card',num:'LIB-123456',fmt:'QR',color:'#2f8f82',owner:''}); save(); renderAll(); openWallet(2)"); await pg.wait_for_timeout(600)
        await pg.locator('.wl-bc').nth(2).screenshot(path='/tmp/bc2.png'); print('QR decodes as:', [(x.format.name,x.text) for x in zxingcpp.read_barcodes(Image.open('/tmp/bc2.png'))])
        print(errs); await b.close()
asyncio.run(main())
