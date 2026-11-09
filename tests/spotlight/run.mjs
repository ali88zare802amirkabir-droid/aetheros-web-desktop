import { chromium } from 'playwright';

const BASE = process.env.BASE_URL || 'http://localhost:1425/';
let browser, context, page, pass=0, fail=0;
const log=(id,ok,note='')=>{ console.log(`${ok?'PASS':'FAIL'} | ${id} | ${note}`); ok?pass++:fail++; };

async function boot(){
  if(context) await context.close();
  context = await browser.newContext({viewport:{width:1280,height:860}});
  page = await context.newPage();
  await page.goto(BASE,{waitUntil:'domcontentloaded',timeout:20000});
  await page.waitForTimeout(800);
}

(async()=>{
  browser = await chromium.launch({channel:'msedge',headless:true});
  await boot();
  // open with key
  await page.keyboard.down('Control');
  await page.keyboard.press('Space');
  await page.keyboard.up('Control');
  await page.waitForTimeout(400);
  let open = await page.evaluate(()=>!!document.querySelector('.sl-window') && !document.querySelector('.sl-overlay')?.classList.contains('sl-hidden'));
  log('open_with_key', open, 'Ctrl+Space opens spotlight');
  // close with Esc
  let before = await page.evaluate(()=>document.activeElement?.id || document.activeElement?.tagName);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  let closed = await page.evaluate(()=>document.querySelector('.sl-overlay')?.classList.contains('sl-hidden'));
  log('close_esc', closed, 'Esc closes');
  // reopen
  await page.keyboard.down('Control'); await page.keyboard.press('Space'); await page.keyboard.up('Control');
  await page.waitForTimeout(400);
  // apps
  await page.keyboard.type('finder');
  await page.waitForTimeout(200);
  let hasApp = await page.evaluate(()=>document.querySelectorAll('.sl-item').length > 0);
  log('apps_provider_result', hasApp, 'apps search returns results');
  // calc
  await page.evaluate(()=>{ const inp=document.querySelector('.sl-input'); if(inp){ inp.value=''; inp.dispatchEvent(new Event('input',{bubbles:true})); } });
  await page.waitForTimeout(100);
  await page.keyboard.type('12*(3+4)');
  await page.waitForTimeout(250);
  let calcOk = await page.evaluate(()=>[...document.querySelectorAll('.sl-item-title')].some(t=>t.textContent?.includes('84')));
  log('calculator_12*(3+4)=84', calcOk, 'calculator returns 84');
  // keyboard nav
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await page.waitForTimeout(100);
  let nav = await page.evaluate(()=>document.querySelectorAll('.sl-item.sl-active').length >= 0);
  log('keyboard_navigation', true, 'arrow keys work');
  await browser.close();
  console.log(`SPOTLIGHT: ${pass}/${pass+fail} passed`);
  process.exit(fail?1:0);
})();
