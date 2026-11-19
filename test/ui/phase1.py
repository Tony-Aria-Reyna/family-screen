# Phase 1 in the app: alerts mend themselves (1.1), who added and finished what (1.5), the daily opened mark, Home (2.2)
import asyncio, json
from playwright.async_api import async_playwright
U='http://localhost:5500/index.html'; ADMIN='tonyandreynanz@gmail.com'; R='reyna@example.com'
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); ctx=await b.new_context(timezone_id='Pacific/Auckland',locale='en-NZ')
        # headless Chromium always says notifications are denied: stand in for a phone that hasn't been asked yet
        await ctx.add_init_script("(()=>{ let p=localStorage.getItem('perm')||'default'; Object.defineProperty(Notification,'permission',{get:()=>p}); Notification.requestPermission=async()=>{ p='granted'; localStorage.setItem('perm','granted'); return p; }; })()")
        errs=[]
        def mk(pg,tag): pg.on('pageerror',lambda e:errs.append(tag+': '+str(e)))
        F=await ctx.new_page(); mk(F,'fridge'); await F.set_viewport_size({'width':1280,'height':800})
        await F.goto(U); await F.wait_for_timeout(500)
        await F.evaluate(f"localStorage.setItem('fs.askedMe',JSON.stringify(['{ADMIN}','{R}'])); SYNC.testSignIn('{ADMIN}')"); await F.wait_for_timeout(700)
        await F.click('#gNew'); await F.wait_for_timeout(800)
        await F.evaluate(f"SYNC.addMember('{R}')"); await F.wait_for_timeout(300)
        await F.evaluate("S.todos.push({id:'t1',title:'Fix the gate',done:false,who:'p2'},{id:'t2',title:'Book the WOF',done:false,who:'p2',due:'2026-11-25'}); save();"); await F.wait_for_timeout(500)
        P=await ctx.new_page(); mk(P,'phone'); await P.set_viewport_size({'width':390,'height':844})
        await P.goto(U); await P.wait_for_timeout(300)
        await P.evaluate("navigator.serviceWorker.register('sw.js')")
        await P.evaluate(f"SYNC.testSignIn('{R}')"); await P.wait_for_timeout(1200)
        await P.evaluate("S.people[1].email='"+R+"'; save(); setTab('home')"); await P.wait_for_timeout(500)
        print('1 Home shows the alerts banner:', await P.locator('#hAlerts').count()==1, '|', (await P.locator('#hAlerts b').inner_text())[:60])
        print('2 needs-doing card:', (await P.locator('#hNeed').inner_text()).replace('\n',' / ')[:120])
        print('3 Aria\'s jars tile gone from Home:', await P.locator('.hgrid .tile b', has_text='corner').count()==0)
        await P.click('#hAlertsOn'); await P.wait_for_timeout(1500)
        devs=await P.evaluate("Object.keys(SYNC.getDevices()).length")
        print('4 turned on: banner gone', await P.locator('#hAlerts').count()==0, '| devices', devs)
        # the helper forgets the phone (Google said it stopped answering): it signs itself up again next time it opens
        h=await P.evaluate("lsGet('fs.pushHash','')"); await F.evaluate(f"SYNC.removeDevice('{h}')"); await F.wait_for_timeout(500)
        print('5 phone forgotten by the helper: devices', await F.evaluate("Object.keys(SYNC.getDevices()).length"))
        await P.reload(); await P.wait_for_timeout(300); await P.evaluate("navigator.serviceWorker.register('sw.js')"); await P.wait_for_timeout(9500)
        print('6 after reopening: back on the list', await F.evaluate("Object.keys(SYNC.getDevices()).length")==1, '| banner', await P.locator('#hAlerts').count())
        # who added and finished what
        await P.evaluate("S.groceries.push({id:'g1',name:'Milk',shop:'super',done:false}); save();"); await P.wait_for_timeout(500)
        await F.evaluate("S.events.push({id:'e1',title:'Dentist',date:'2026-11-25',time:'10:00',whos:['p3']}); save();"); await F.wait_for_timeout(500)
        db=json.loads(await P.evaluate("localStorage.getItem('mockdb')")); hid=[k for k in db if k.startswith('households/') and k.count('/')==1][0]
        g=db[hid+'/groceries/g1']; e=db[hid+'/events/e1']
        print('7 stamps: milk by', g.get('by'), g.get('dev'), '| dentist by', e.get('by'), e.get('dev'))
        await F.evaluate("S.groceries.find(x=>x.id==='g1').done=true; save();"); await F.wait_for_timeout(500)
        db=json.loads(await P.evaluate("localStorage.getItem('mockdb')")); g=db[hid+'/groceries/g1']
        print('8 ticked off by', g.get('doneBy'), '| at set', bool(g.get('doneAt')), '| added-by kept', g.get('by'))
        await P.wait_for_timeout(1000)
        db=json.loads(await P.evaluate("localStorage.getItem('mockdb')")); us=[k for k in db if '/usage/' in k]
        op=[k for k in us if '/reads-' not in k]; rdk=[k for k in us if '/reads-' in k]
        print('9 opened marks:', op[:1], json.dumps(db[op[0]]) if op else '')
        await P.evaluate("SYNC.sendReads()"); await P.wait_for_timeout(500)
        db=json.loads(await P.evaluate("localStorage.getItem('mockdb')")); rdk=[k for k in db if '/usage/reads-' in k]
        print('10 reads saved:', [(k.split('/')[-1], {d:v.get('n') for d,v in db[k].items()}) for k in rdk])
        print('errors:', errs)
        await b.close()
asyncio.run(main())
