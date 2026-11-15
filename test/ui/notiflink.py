import asyncio
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); errs=[]
        pg=await b.new_page(viewport={'width':400,'height':820}); pg.on('pageerror',lambda e:errs.append(str(e)))
        await pg.goto('http://localhost:5500/index.html?demo'); await pg.wait_for_timeout(600)
        th=await pg.evaluate("(()=>{const ps=S.people.filter(p=>p.id!=='all'); const t=[ps[0].id,ps[2].id].sort().join('|'); S.msgs=[{id:'m1',th:t,from:ps[2].id,text:'Hi Dad',at:Date.now(),seen:[]}]; msgAs=ps[0].id; launchAct='msg:'+t; runLaunch(); return t})()")
        await pg.wait_for_timeout(700); print('thread open:', await pg.locator('#msgBox .mb').count(), await pg.inner_text('#msgBox h2'))
        await pg.evaluate("closeModal(); launchAct='inbox'; runLaunch()"); await pg.wait_for_timeout(700); print('inbox open:', await pg.locator('.modal h2').inner_text())
        await pg.goto('http://localhost:5500/index.html?demo&open='+'msg%3Afam'); await pg.wait_for_timeout(1200); print('from url:', await pg.locator('#msgBox').count(), '| url cleaned:', 'open=' not in pg.url)
        print(errs); await b.close()
asyncio.run(main())
