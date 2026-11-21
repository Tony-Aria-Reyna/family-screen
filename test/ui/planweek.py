# 4.2 Plan the next 8 days, the ideas board (stays open, any day, any meal), kitchen profile and export
import asyncio, json
from playwright.async_api import async_playwright
U='http://localhost:5500/index.html'; A='tonyandreynanz@gmail.com'
def rec(name,day,uses,buy,ing): return {'name':name,'meal':'dinner','emoji':'🍲','mins':30,'serves':3,'tags':['Kiwi'],'blurb':'Nice.','ing':ing,'steps':[['Cook it.',10]],'day':day,'uses':uses,'buy':buy,'thaw':'Take the lamb out tonight'}
async def main():
  async with async_playwright() as p:
    b=await p.chromium.launch(); ctx=await b.new_context(timezone_id='Pacific/Auckland',viewport={'width':390,'height':844},is_mobile=True,has_touch=True,accept_downloads=True)
    P=await ctx.new_page(); errs=[]; P.on('pageerror',lambda e:errs.append(str(e)))
    await P.clock.install(time='2026-11-21T15:00:00+13:00')
    await P.goto(U); await P.clock.run_for(500)
    await P.evaluate(f"localStorage.setItem('fs.askedMe',JSON.stringify(['{A}'])); SYNC.testSignIn('{A}')"); await P.clock.run_for(800); await P.click('#gNew'); await P.clock.run_for(1200)
    await P.evaluate("S.people[0].email='tonyandreynanz@gmail.com'; stockAdd([{name:'Lamb chops',where:'freezer',qty:'800 g'},{name:'Kūmara',where:'pantry',qty:'3'},{name:'Eggs',where:'fridge',qty:'12'}]); save()")
    prompts=[]
    await P.evaluate("""window.AI_TEST=1; window.__p=[]; window.aiAsk=async o=>{ __p.push(o.prompt); if(/KITCHEN PROFILE for a meal-planning/.test(o.prompt)) return {profile:'Lamb and eggs on hand\\nKūmara is the go-to carb'};
      const d0=dk(new Date()), d2=dk(addDays(new Date(),2)); return {recipes:[REC1,REC2,REC3]}; }; 0""".replace('REC1',json.dumps(rec('Lamb and kūmara traybake','2026-11-21',['Lamb chops','Kūmara'],['rosemary'],[[800,'g','lamb chops'],[3,'','kūmara'],[1,'bunch','rosemary']]))).replace('REC2',json.dumps(rec('Egg fried cauliflower rice','2026-11-23',['Eggs'],['cauliflower'],[[4,'','eggs'],[1,'','cauliflower']]))).replace('REC3',json.dumps(rec('Spare: frittata','',['Eggs'],[],[[6,'','eggs']]))))
    # 1 planner shows today + 7
    await P.evaluate("openMeals()"); await P.clock.run_for(400)
    print('1 planner:', await P.evaluate("document.querySelector('.mnav b').textContent"), '| days:', await P.locator('.mday').count(), '| first:', await P.evaluate("document.querySelector('.mday .mdl').innerText.split('\\n').slice(0,2).join(' ')"), '| plan button:', await P.locator('#mPlan').count())
    # 2 plan the week
    await P.click('#mPlan'); await P.clock.run_for(300)
    print('2 days offered:', await P.locator('[data-d]').count(), '| ticked:', await P.locator('[data-d].on').count(), '|', await P.locator('#go').inner_text())
    await P.click('#go'); await P.clock.run_for(1500)
    print('dbg', await P.evaluate("[typeof window.aiAsk, window.aiAsk.toString().slice(0,40), aiOK(), __p.length, document.querySelector('.toast,.banner')&&document.querySelector('.toast,.banner').textContent]"), errs)
    pr=await P.evaluate("__p[0]"); print('3 prompt has stock, season, freezer rules:', 'Lamb chops (800 g)' in pr, 'In season in New Zealand' in pr, 'Freezer rules' in pr)
    print('4 board:', await P.locator('.idea').count(), '| suggested-all button:', await P.locator('#all').inner_text() if await P.locator('#all').count() else None)
    # 5 assign one to another day via day picker, board stays open
    await P.click('[data-pk] >> nth=0'); await P.clock.run_for(200)
    chips=await P.locator('.idea >> nth=0 >> .dchip').count(); await P.click('.idea >> nth=0 >> .dchip >> nth=5'); await P.clock.run_for(300)
    print('5 picker chips:', chips, '| still on board:', await P.locator('.tvhead h2').inner_text(), '| planned:', await P.evaluate("S.meals.map(m=>[m.date,m.slot,(recipeById(m.rid)||{}).name])"))
    # 6 the rest on suggested days
    await P.click('#all'); await P.clock.run_for(300)
    print('6 after Put all:', await P.evaluate("S.meals.map(m=>[m.date,(recipeById(m.rid)||{}).name])"), '| foot:', await P.locator('.boardfoot span').inner_text())
    # 7 switch one to lunch and back via change day
    await P.click('[data-mv] >> nth=0'); await P.clock.run_for(200); await P.click('.idea.fresh >> nth=0 >> [data-sl$="|lunch"]'); await P.clock.run_for(100)
    await P.click('.idea.fresh >> nth=0 >> .dchip >> nth=1'); await P.clock.run_for(300)
    print('7 moved to lunch tomorrow:', await P.evaluate("S.meals.filter(m=>m.slot==='lunch').map(m=>[m.date,(recipeById(m.rid)||{}).name])"))
    # 8 open a recipe and come back to the same board
    await P.click('[data-open] >> nth=0'); await P.clock.run_for(300); bk=await P.evaluate("[...document.querySelectorAll('#layer button')].map(b=>b.textContent).filter(t=>/Back/.test(t))")
    await P.evaluate("[...document.querySelectorAll('#layer button')].find(b=>/Back/.test(b.textContent)).click()"); await P.clock.run_for(300)
    print('8 recipe back ->', await P.locator('.tvhead h2').inner_text(), '| ideas still there:', await P.locator('.idea').count(), bk)
    # 9 shopping excludes stock
    print('9 shopping list now:', await P.evaluate("S.groceries.filter(g=>!g.done).map(g=>g.name)"))
    await P.click('[data-un] >> nth=0'); await P.clock.run_for(300); print('9b undo takes its shopping off:', await P.evaluate("S.groceries.filter(g=>!g.done).map(g=>g.name)"))
    await P.evaluate("closeModal()"); await P.clock.run_for(200)
    # 10 board persists, reopen from planner
    await P.evaluate("openMeals()"); await P.clock.run_for(300); print('10 planner shows board button:', await P.locator('#mBoard').inner_text())
    # 11 pick a saved recipe for another day from a day's picker
    await P.evaluate("pickMeal(dk(addDays(new Date(),4)),'dinner','all')"); await P.clock.run_for(300)
    print('11 picker day chips:', await P.locator('#layer .dchip').count(), '| this day marked:', await P.locator('#layer .dchip i').count())
    await P.click('#layer .dchip >> nth=6'); await P.clock.run_for(200); await P.click('#layer [data-rid] >> nth=0'); await P.clock.run_for(300)
    print('11b assigned to:', await P.evaluate("S.meals.at(-1).date"))
    # 12 kitchen profile + export
    await P.evaluate("closeModal(); openStock()"); await P.clock.run_for(300); await P.click('#kbb'); await P.clock.run_for(800)
    print('12 profile:', await P.evaluate("S.foodKb"), '| used in prompts:', 'Kūmara is the go-to carb' in await P.evaluate("kitchenKnowledge()"))
    await P.click('#exp'); await P.clock.run_for(300)
    print('13 export text starts:', (await P.evaluate("kitchenText()"))[:120].replace('\n',' | '))
    async with P.expect_download() as d: await P.click('#csv')
    path=await (await d.value).path(); print('14 csv:', open(path,encoding='utf-8-sig').read().splitlines()[:3])
    print('errors:', errs); await b.close()
asyncio.run(main())
