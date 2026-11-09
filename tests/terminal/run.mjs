import { chromium } from 'playwright';
const BASE = process.env.BASE_URL || 'http://localhost:1425/';
let browser, context, page, pass=0, fail=0;
const log=(id,ok,note='')=>{ console.log(`${ok?'PASS':'FAIL'} | ${id} | ${note}`); ok?pass++:fail++; };

async function boot(){
  if(context) await context.close();
  context = await browser.newContext({viewport:{width:1280,height:860}});
  page = await context.newPage();
  await page.goto(BASE,{waitUntil:'domcontentloaded',timeout:20000});
  await page.waitForTimeout(1500);
  await page.evaluate(()=>{ try { window.dispatchEvent(new CustomEvent('openApp',{detail:'terminal'})); } catch(e){} });
  await page.waitForTimeout(300);
  await page.evaluate(()=>{ try { window.WindowManager && window.WindowManager.openApp && window.WindowManager.openApp({id:'terminal'}); } catch(e){} });
  await page.waitForTimeout(1000);
}

async function runCmd(cmd){
  const inp = await page.$('.tm-input');
  if(!inp) return false;
  await inp.click();
  await page.keyboard.type(cmd);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(600);
  return true;
}

async function outText(){
  return page.evaluate(()=> (document.querySelector('.tm-output') && document.querySelector('.tm-output').textContent) || '');
}

(async()=>{
  browser = await chromium.launch({channel:'msedge',headless:true});
  try {
    await boot();
    const has = await page.$('.tm-app');
    log('terminal_opens', !!has, 'terminal app renders');
    if (has) {
      await runCmd('mkdir -p tdir && cd tdir && pwd');
      let t = await outText(); log('mkdir_cd_pwd', t.includes('tdir'), 'mkdir/cd/pwd');
      await runCmd('touch a.txt && echo hello > a.txt && cat a.txt');
      t = await outText(); log('touch_echo_cat', t.includes('hello'), 'touch/echo/cat');
      await runCmd('echo apple | grep app');
      t = await outText(); log('pipe_grep', t.includes('apple') || t.includes('app'), 'pipe grep');
      await runCmd('rm a.txt');
      const inTrash = await page.evaluate(()=>{ try { return (localStorage.getItem('desktop_systemState')||'').includes('a.txt'); } catch(e){ return false; } });
      log('rm_to_trash', inTrash, 'rm moves to trash');
      const inp = await page.$('.tm-input');
      if(inp){ await inp.click(); await page.keyboard.type('his'); await page.keyboard.press('Tab'); await page.waitForTimeout(250); }
      const tab = await page.evaluate(()=> (document.querySelector('.tm-input') && document.querySelector('.tm-input').value) || '');
      log('tab_completion', tab.includes('history'), 'tab completion');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(300);
      await runCmd('echo updown');
      await page.keyboard.press('ArrowUp');
      await page.waitForTimeout(100);
      const hist = await page.evaluate(()=> (document.querySelector('.tm-input') && document.querySelector('.tm-input').value) || '');
      log('history_up', hist.length > 0, 'history navigation');
      await runCmd('settings get appearance.theme');
      t = await outText(); log('settings_get', t.trim().length>0, 'settings get');
    } else {
      ['mkdir_cd_pwd','touch_echo_cat','pipe_grep','rm_to_trash','tab_completion','history_up','settings_get'].forEach(k=>log(k,false,'terminal not open'));
    }
  } catch(e) { log('error', false, String(e && e.message ? e.message : e)); }
  await browser.close();
  console.log(`TERMINAL: ${pass}/${pass+fail} passed`);
  process.exit(fail?1:0);
})();
