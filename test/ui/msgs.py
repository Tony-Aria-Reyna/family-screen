import asyncio, time
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); errs=[]
        pg=await b.new_page(viewport={'width':400,'height':820}); pg.on('pageerror',lambda e:errs.append(str(e)))
        await pg.goto('http://localhost:5500/index.html?demo'); await pg.wait_for_timeout(700)
        ids=await pg.evaluate("S.people.filter(p=>p.id!=='all').map(p=>p.id)")
        await pg.evaluate("""(ids)=>{ const fri=dk(addDays(new Date(),5));
          S.inbox=[{id:'email-1',status:'new',kind:'school',sender:'Room 5',summary:'Week 6 notices: swimming sports and camp forms.',at:Date.now(),fromEmail:{from:'r5@school.nz',subject:'Week 6 notices',link:'https://mail.google.com/'},
            items:[{id:'e0',type:'event',title:'Swimming sports',date:fri,time:'09:30',end:'12:00',who:ids[2],note:'Bring togs',state:'new'},{id:'t0',type:'todo',title:'Return the camp slip',due:fri,who:ids[1],note:'',state:'new'},{id:'t1',type:'todo',title:'Pay $5 for mufti day',due:'',who:'',note:'',state:'new'}]}];
          S.msgs=[{id:'m1',th:'fam',from:ids[1],text:'Dinner at 6 tonight',at:Date.now()-3600e3,seen:[ids[1]]},{id:'m2',th:[ids[0],ids[2]].sort().join('|'),from:ids[2],text:'Can you pick me up?',at:Date.now()-60e3,seen:[ids[2]]}];
          msgAs=ids[0]; renderAll(); }""", ids)
        await pg.wait_for_timeout(300)
        print('home tiles:', await pg.locator('#phome [data-ht] small').all_inner_texts())
        await pg.evaluate('openInbox()'); await pg.wait_for_timeout(300); await pg.screenshot(path='/tmp/inbox1.png', full_page=True)
        ev0=await pg.evaluate('S.events.length'); td0=await pg.evaluate('S.todos.length')
        await pg.click('[data-add="email-1|e0"]'); await pg.wait_for_timeout(200)
        await pg.click('[data-all="email-1"]'); await pg.wait_for_timeout(200)
        print('added events', await pg.evaluate('S.events.length')-ev0, 'todos', await pg.evaluate('S.todos.length')-td0, '| status', await pg.evaluate('S.inbox[0].status'), '|', await pg.evaluate('S.todos[0].title+" / "+S.events[S.events.length-1].title+" "+S.events[S.events.length-1].dur'))
        await pg.click('#x'); await pg.wait_for_timeout(200)
        await pg.evaluate("msgAs=S.people.filter(p=>p.id!=='all')[0].id; openMsgs()"); await pg.wait_for_timeout(300); await pg.screenshot(path='/tmp/msg1.png')
        print('threads:', await pg.locator('.mrow').count(), '| unread dots:', await pg.locator('.mrow .mdot').all_inner_texts())
        await pg.click('.mrow.unread >> nth=0'); await pg.wait_for_timeout(200)
        await pg.fill('#mi','On my way'); await pg.screenshot(path='/tmp/msg0.png'); await pg.click('#ms'); await pg.wait_for_timeout(200)
        await pg.fill('#mi','I’m home 🏠'); await pg.click('#ms'); await pg.wait_for_timeout(200); await pg.screenshot(path='/tmp/msg2.png')
        print('bubbles:', await pg.locator('.mb').count(), 'mine:', await pg.locator('.mb.me').count(), '| unread now', await pg.evaluate('msgUnreadAll()'))
        await pg.evaluate("S.msgs.push({id:'m9',th:msgOpen.th,from:msgOpen.th.split('|').find(x=>x!==msgAs),text:'Thanks Dad',at:Date.now()+5,seen:[]}); renderAll()"); await pg.wait_for_timeout(300)
        print('live bubble:', await pg.locator('.mb').count())
        big=await b.new_page(viewport={'width':1885,'height':940}); big.on('pageerror',lambda e:errs.append(str(e))); await big.goto('http://localhost:5500/index.html?demo'); await big.wait_for_timeout(600)
        await big.evaluate("(()=>{ const ps=S.people.filter(p=>p.id!=='all'); ps.forEach((p,i)=>{ if(i<2) p.email='a'+i+'@x.com'; }); S.msgs=[{id:'k1',th:'fam',from:ps[0].id,text:'Home soon',at:Date.now()+50,seen:[]}]; renderAll(); })()"); await big.wait_for_timeout(300)
        print('fridge badge:', await big.inner_text('#msgBadge'), '| toast:', await big.locator('.banner').count())
        await big.click('#msgBtn'); await big.wait_for_timeout(300); await big.screenshot(path='/tmp/msg3.png')
        print('fridge who-picker rows:', await big.locator('[data-as]').count(), '| thread rows:', await big.locator('[data-th]').count())
        print('errs', errs); await b.close()
asyncio.run(main())
