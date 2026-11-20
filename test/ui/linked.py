# Two households with linked calendars: Masako gets her own household; each side sees the other's calendar
import asyncio, json
from playwright.async_api import async_playwright
U='http://localhost:5500/index.html'; ADMIN='tonyandreynanz@gmail.com'; MAS='masakofraser@gmail.com'
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); ctx=await b.new_context(timezone_id='Pacific/Auckland',locale='en-NZ')
        errs=[]; T=await ctx.new_page(); T.on('pageerror',lambda e:errs.append('T '+str(e))); await T.set_viewport_size({'width':390,'height':844})
        await T.goto(U); await T.wait_for_timeout(500)
        await T.evaluate(f"localStorage.setItem('fs.askedMe',JSON.stringify(['{ADMIN}','{MAS}'])); SYNC.testSignIn('{ADMIN}')"); await T.wait_for_timeout(700)
        await T.click('#gNew'); await T.wait_for_timeout(900)
        await T.evaluate(f"""S.people[0].name='Tony'; S.people[0].email='{ADMIN}'; S.people[1].name='Reyna'; S.people[2].name='Aria'; S.people[3].name='Masako'; S.people[3].email='{MAS}'; S.vapidKey='VAPID';
          S.todos.push({{id:'t1',title:'Tony job',done:false}}); S.events.push({{id:'e1',title:'Swimming',date:dk(new Date()),time:'16:00',whos:['p3'],dur:60}}); S.events.push({{id:'e2',title:'Lunch at ours',date:dk(new Date()),time:'12:00',whos:['p4'],dur:60}});
          S.flights.push({{id:'f1',who:'p2',from:'AKL',to:'NRT',start:new Date(Date.now()+3600e3).toISOString(),end:new Date(Date.now()+12*3600e3).toISOString(),flight:'NZ99'}}); save()""")
        await T.evaluate(f"SYNC.addCalMember('{MAS}')"); await T.wait_for_timeout(400)
        await T.evaluate("openSettings()"); await T.wait_for_timeout(400)
        await T.locator(f'[data-mown="{MAS}"]').click(); await T.wait_for_timeout(500); await T.evaluate("closeModal()")
        M=await ctx.new_page(); M.on('pageerror',lambda e:errs.append('M '+str(e))); await M.set_viewport_size({'width':390,'height':844})
        await M.goto(U); await M.wait_for_timeout(500); await M.evaluate(f"SYNC.testSignIn('{MAS}')"); await M.wait_for_timeout(1500)
        print('1 Masako is offered her own household:', await M.locator('#gNew').is_visible())
        await M.click('#gNew'); await M.wait_for_timeout(2500)
        print('2 her household:', await M.evaluate("JSON.stringify({people:S.people.map(p=>p.name),limited:SYNC.isLimited(),members:SYNC.getMembers(),guests:SYNC.getLimited(),vapid:S.vapidKey,tabs:[...document.querySelectorAll('.tabbar button')].filter(b=>getComputedStyle(b).display!=='none').length})"))
        print('3 she sees their calendar, not their jobs:', await M.evaluate("JSON.stringify({events:S.events.map(e=>[e.title,e.whos.map(w=>(person(w)||{}).name)]),flights:S.flights.length,todos:S.todos.length})"))
        await T.evaluate("(()=>{ const d=JSON.parse(localStorage.getItem('mockdb')); const k=Object.keys(d).find(x=>/^households\\/[^/]+$/.test(x)&&d[x].owner==='tonyandreynanz@gmail.com'); d[k].live={f1:{status:'Delayed',gate:'7'}}; localStorage.setItem('mockdb',JSON.stringify(d)); window.dispatchEvent(new StorageEvent('storage',{key:'mockdb'})); })()"); await M.wait_for_timeout(800)
        print('4a live flight status reaches her:', await M.evaluate("JSON.stringify(liveOf(S.flights[0]))"))
        print('4 Where is:', await M.evaluate("(traveller()||{}).name"), '| guest people to pick:', await M.evaluate("guestPeople().map(p=>p.name)"))
        # she adds her own entry, and one for Aria
        await M.evaluate("S.events.push({id:'m1',title:'Doctor',date:dk(new Date()),time:'09:00',whos:['p1'],dur:30}); S.todos.push({id:'mt',title:'Her job',done:false}); S.groceries.push({id:'mg',name:'Tofu',shop:S.shops[0].id,done:false}); const a=guestPeople().find(p=>p.name==='Aria'); S.events.push({id:'m2',title:'Aria sleepover',date:dk(new Date()),time:'18:00',whos:[a.id,'p1'],dur:60}); save()"); await M.wait_for_timeout(1200); await T.wait_for_timeout(1500)
        print('5 Tony sees hers:', await T.evaluate("JSON.stringify(S.events.filter(e=>['Doctor','Aria sleepover'].includes(e.title)).map(e=>[e.title,e.whos.map(w=>(person(w)||{}).name),!!e.g]))"), '| not her lists:', await T.evaluate("JSON.stringify([S.todos.map(t=>t.title),S.groceries.some(g=>g.name==='Tofu')])"))
        db=json.loads(await T.evaluate("localStorage.getItem('mockdb')")); hT=[k for k in db if k.count('/')==1 and db[k].get('owner')==ADMIN][0]
        print('6 the sleepover is stored in Tony’s calendar, stamped hers:', [(k.split('/')[-1],v.get('whos'),v.get('by')) for k,v in db.items() if k.startswith(hT+'/events/') and v.get('title')=='Aria sleepover'])
        # Tony can't edit hers; she can edit her own in his calendar, not his
        await T.evaluate("openAdd(S.events.find(e=>e.title==='Doctor'))"); await T.wait_for_timeout(300); print('7 Tony tapping her entry:', await T.locator('#evTitle').count(), await T.evaluate("(document.querySelector('.toast')||{}).textContent||''"))
        await M.evaluate("S.events.find(e=>e.title==='Aria sleepover').time='19:00'; S.events.find(e=>e.title==='Swimming').title='HACKED'; save()"); await M.wait_for_timeout(1000); await T.wait_for_timeout(1200)
        print('8 her change to her own arrives, his is untouched:', await T.evaluate("JSON.stringify(S.events.filter(e=>/sleepover|Swimming|HACKED/.test(e.title)).map(e=>[e.title,e.time]))"))
        await M.evaluate("S.events=S.events.filter(e=>e.title!=='Aria sleepover'); save()"); await M.wait_for_timeout(900); await T.wait_for_timeout(1200)
        print('9 she deletes hers:', await T.evaluate("S.events.some(e=>e.title==='Aria sleepover')"))
        await T.reload(); await T.wait_for_timeout(2500); print('10 Tony after reopening:', await T.evaluate("JSON.stringify({home:SYNC.getMembers().length,lim:SYNC.isLimited(),hers:S.events.some(e=>e.title==='Doctor'),own:S.todos.map(t=>t.title)})"))
        await T.evaluate("openAdd(S.events.find(e=>e.title==='Doctor'))"); await T.wait_for_timeout(300); print('11 Tony tapping her entry: form', await T.locator('#evTitle').count(), '|', await T.evaluate("[...document.querySelectorAll('body *')].map(x=>x.childElementCount?'':x.textContent).find(t=>/can change this entry/.test(t))||''"))
        print('errors:', errs)
        await b.close()
asyncio.run(main())
