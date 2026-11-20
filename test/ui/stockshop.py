# The week's shopping list leaves out what Kitchen stock already has; Ideas are told what's in the kitchen
import asyncio
from playwright.async_api import async_playwright
U='http://localhost:5500/index.html'; A='tonyandreynanz@gmail.com'
async def main():
  async with async_playwright() as p:
    b=await p.chromium.launch(); P=await (await b.new_context(timezone_id='Pacific/Auckland')).new_page(); errs=[]; P.on('pageerror',lambda e:errs.append(str(e)))
    await P.goto(U); await P.wait_for_timeout(400)
    await P.evaluate(f"localStorage.setItem('fs.askedMe',JSON.stringify(['{A}'])); SYNC.testSignIn('{A}')"); await P.wait_for_timeout(700); await P.click('#gNew'); await P.wait_for_timeout(1000)
    await P.evaluate("stockAdd([{name:'Chicken thighs',where:'freezer',qty:'1 kg'},{name:'Onions',where:'pantry',qty:'4'}]); stockAdd([{name:'Soy sauce',where:'sauce'}])")
    print('1 match rules:', await P.evaluate("[inStock('chicken thigh')&&inStock('chicken thigh').name, inStock('onion')&&inStock('onion').name, inStock('chicken stock'), inStock('soy sauce')&&inStock('soy sauce').name, inStock('carrots')]"))
    print('2 Ideas are told:', await P.evaluate("stockLine().slice(0,200)"))
    await P.evaluate("addIngredients([{r:{name:'Stir fry',serves:4,ing:[[600,'g','chicken thighs'],[2,'','onions'],[3,'','carrots'],[2,'tbsp','soy sauce','p']]},serves:4}])"); await P.wait_for_timeout(400)
    print('3 list:', await P.evaluate("[...document.querySelectorAll('#layer .ing')].map(b=>[b.classList.contains('on'),b.querySelector('small').textContent])"), '|', await P.locator('#s').inner_text())
    print(errs); await b.close()
asyncio.run(main())
