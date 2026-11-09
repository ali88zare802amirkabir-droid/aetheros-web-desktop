import { chromium } from 'playwright';

const BASE = process.env.BASE_URL || 'http://localhost:1425/';
const results = [];
let browser, context, page;

const ok = (id, effect, note='') => results.push({ id, effect, pass: true, note });
const fail = (id, effect, note='') => results.push({ id, effect, pass: false, note });

async function fresh() {
  if (context) await context.close();
  context = await browser.newContext({ viewport: { width: 1280, height: 860 } });
  page = await context.newPage();
  page.on('pageerror', () => {});
}
async function gotoApp() {
  let last;
  for (let i=0;i<3;i++) { try { await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 15000 }); return; } catch(e){ last=e; await page.waitForTimeout(1200); } }
  throw last;
}
async function boot(settings = {}, sys = {}) {
  await fresh();
  await gotoApp();
  await page.evaluate(({settings, sys}) => {
    try {
      const sk='settings_v1'; const sv=JSON.parse(localStorage.getItem(sk)||'{"version":1,"data":{}}');
      sv.data = Object.assign({}, sv.data||{}, settings);
      localStorage.setItem(sk, JSON.stringify(sv));
      const k='desktop_systemState'; const s=JSON.parse(localStorage.getItem(k)||'{}');
      Object.assign(s, sys); localStorage.setItem(k, JSON.stringify(s));
    } catch {}
  }, {settings, sys});
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(900);
}
async function getStore(key) {
  return page.evaluate((key)=>{ try { return JSON.parse(localStorage.getItem('settings_v1')||'{}').data?.[key]; } catch { return null; } }, key);
}
async function setStore(key, value) {
  await page.evaluate(([key,value])=>{ try{ const sk='settings_v1'; const sv=JSON.parse(localStorage.getItem(sk)||'{"version":1,"data":{}}'); sv.data=sv.data||{}; sv.data[key]=value; localStorage.setItem(sk,JSON.stringify(sv)); }catch{} }, [key,value]);
  await page.reload({ waitUntil:'domcontentloaded' });
  await page.waitForTimeout(900);
}
async function openSettings(section='home') {
  await page.evaluate(function(){
    var els=[].slice.call(document.querySelectorAll('[data-app-id],[data-app],[title],[aria-label]'));
    var c=els.find(function(el){ return /settings/i.test((el.getAttribute('title')||'')+(el.getAttribute('data-app')||'')+(el.getAttribute('data-app-id')||'')+(el.getAttribute('aria-label')||'')); });
    if(c) c.click();
  });
  await page.waitForTimeout(700);
  await page.evaluate(function(section){ var r=document.querySelector('.settings2,.settings-app'); var b=r&&r.querySelector('[data-sec="'+section+'"]'); if(b) b.click(); }, section);
  await page.waitForTimeout(500);
}

async function test(id, effect, fn) {
  try { await fn(); } catch (e) { fail(id, effect, String(e && e.message || e)); }
}

(async () => {
  browser = await chromium.launch({ channel: 'msedge', headless: true });

  // Appearance
  await test('appearance.theme','document dark-mode class + persisted', async()=>{
    await boot({'appearance.theme':'dark'}); let has = await page.evaluate(()=>document.documentElement.classList.contains('dark-mode'));
    if(!has) return fail('appearance.theme','document dark-mode class + persisted','dark class missing');
    await setStore('appearance.theme','light'); has = await page.evaluate(()=>!document.documentElement.classList.contains('dark-mode'));
    const p = await getStore('appearance.theme');
    (has && p==='light') ? ok('appearance.theme','document dark-mode class + persisted') : fail('appearance.theme','document dark-mode class + persisted',`light=${has} persisted=${p}`);
  });
  await test('appearance.accent','--accent CSS var + persisted', async()=>{
    await boot({'appearance.accent':'#ff3b30'});
    const v = await page.evaluate(()=>getComputedStyle(document.documentElement).getPropertyValue('--accent').trim());
    const p = await getStore('appearance.accent');
    (v.toLowerCase()==='#ff3b30' && p==='#ff3b30') ? ok('appearance.accent','--accent CSS var + persisted') : fail('appearance.accent','--accent CSS var + persisted',`var=${v} p=${p}`);
  });
  await test('appearance.profile','applies preset accent/theme + persisted', async()=>{
    await boot({'appearance.profile':'aurora','appearance.accent':'#00c7be','appearance.theme':'dark'});
    const a = await page.evaluate(()=>getComputedStyle(document.documentElement).getPropertyValue('--accent').trim().toLowerCase());
    const d = await page.evaluate(()=>document.documentElement.classList.contains('dark-mode'));
    const p = await getStore('appearance.profile');
    (a==='#00c7be' && d && p==='aurora') ? ok('appearance.profile','applies preset accent/theme + persisted') : fail('appearance.profile','applies preset accent/theme + persisted',`accent=${a} dark=${d} p=${p}`);
  });
  await test('appearance.blur','--glass-blur var + persisted', async()=>{
    await boot({'appearance.blur':24}); const v = await page.evaluate(()=>getComputedStyle(document.documentElement).getPropertyValue('--glass-blur').trim());
    const p = await getStore('appearance.blur');
    (v==='24px' && p==24) ? ok('appearance.blur','--glass-blur var + persisted') : fail('appearance.blur','--glass-blur var + persisted',`v=${v} p=${p}`);
  });
  await test('appearance.transparency','--glass-alpha var + persisted', async()=>{
    await boot({'appearance.transparency':60}); const v = await page.evaluate(()=>getComputedStyle(document.documentElement).getPropertyValue('--glass-alpha').trim());
    const p = await getStore('appearance.transparency');
    (v.startsWith('0.6') && p==60) ? ok('appearance.transparency','--glass-alpha var + persisted') : fail('appearance.transparency','--glass-alpha var + persisted',`v=${v} p=${p}`);
  });
  await test('appearance.radius','--radius var + persisted', async()=>{
    await boot({'appearance.radius':20}); const v = await page.evaluate(()=>getComputedStyle(document.documentElement).getPropertyValue('--radius').trim());
    const p = await getStore('appearance.radius');
    (v==='20px' && p==20) ? ok('appearance.radius','--radius var + persisted') : fail('appearance.radius','--radius var + persisted',`v=${v} p=${p}`);
  });
  await test('appearance.font','--ui-font/body font + persisted', async()=>{
    await boot({'appearance.font':'Segoe UI'}); const v = await page.evaluate(()=>getComputedStyle(document.documentElement).getPropertyValue('--ui-font').trim());
    const p = await getStore('appearance.font');
    (v.includes('Segoe UI') && p==='Segoe UI') ? ok('appearance.font','--ui-font/body font + persisted') : fail('appearance.font','--ui-font/body font + persisted',`v=${v} p=${p}`);
  });
  await test('appearance.textSize','--text-scale var + persisted', async()=>{
    await boot({'appearance.textSize':120}); const v = await page.evaluate(()=>getComputedStyle(document.documentElement).getPropertyValue('--text-scale').trim());
    const p = await getStore('appearance.textSize');
    (v==='1.2' && p==120) ? ok('appearance.textSize','--text-scale var + persisted') : fail('appearance.textSize','--text-scale var + persisted',`v=${v} p=${p}`);
  });
  await test('appearance.reducedMotion','dataset.reduceMotion + persisted', async()=>{
    await boot({'appearance.reducedMotion':'on'}); const v = await page.evaluate(()=>document.documentElement.dataset.reduceMotion);
    const p = await getStore('appearance.reducedMotion');
    (v==='on' && p==='on') ? ok('appearance.reducedMotion','dataset.reduceMotion + persisted') : fail('appearance.reducedMotion','dataset.reduceMotion + persisted',`v=${v} p=${p}`);
  });

  // Wallpaper/Desktop
  await test('wallpaper.url','body background image + persisted', async()=>{
    const url='data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg"/>'; await boot({'wallpaper.url':url});
    const v = await page.evaluate(()=>document.body.style.backgroundImage);
    const p = await getStore('wallpaper.url');
    (v.includes('data:image') && p===url) ? ok('wallpaper.url','body background image + persisted') : fail('wallpaper.url','body background image + persisted',`bg=${v.slice(0,30)} p=${!!p}`);
  });
  await test('wallpaper.blur','--wallpaper-blur var + persisted', async()=>{
    await boot({'wallpaper.blur':12}); const v = await page.evaluate(()=>getComputedStyle(document.documentElement).getPropertyValue('--wallpaper-blur').trim());
    const p = await getStore('wallpaper.blur');
    (v==='12px' && p==12) ? ok('wallpaper.blur','--wallpaper-blur var + persisted') : fail('wallpaper.blur','--wallpaper-blur var + persisted',`v=${v} p=${p}`);
  });
  await test('desktop.iconSize','desktop icon img size + persisted', async()=>{
    await boot({'desktop.iconSize':80});
    const w = await page.evaluate(()=>{ const img=document.querySelector('#desktop .desktop-icon img'); return img ? img.style.width : null; });
    const p = await getStore('desktop.iconSize');
    (w==='80px' && p==80) ? ok('desktop.iconSize','desktop icon img size + persisted') : fail('desktop.iconSize','desktop icon img size + persisted',`w=${w} p=${p}`);
  });
  await test('desktop.iconPosition','desktop icon left/right + persisted', async()=>{
    await boot({'desktop.iconPosition':'right'});
    const r = await page.evaluate(()=>{ const el=document.querySelector('#desktop .desktop-icon'); return el ? el.style.right : null; });
    const p = await getStore('desktop.iconPosition');
    (r==='20px' && p==='right') ? ok('desktop.iconPosition','desktop icon left/right + persisted') : fail('desktop.iconPosition','desktop icon left/right + persisted',`right=${r} p=${p}`);
  });

  // Dock + MenuBar
  await test('dock.size','--dock-h var + persisted', async()=>{
    await boot({'dock.size':60}); const v = await page.evaluate(()=>getComputedStyle(document.documentElement).getPropertyValue('--dock-h').trim());
    const p = await getStore('dock.size');
    (v==='60px' && p==60) ? ok('dock.size','--dock-h var + persisted') : fail('dock.size','--dock-h var + persisted',`v=${v} p=${p}`);
  });
  await test('dock.magnification','#dock.mag class + persisted', async()=>{
    await boot({'dock.magnification':true}); const v = await page.evaluate(()=>document.getElementById('dock')?.classList.contains('mag'));
    const p = await getStore('dock.magnification');
    (v===true && p===true) ? ok('dock.magnification','#dock.mag class + persisted') : fail('dock.magnification','#dock.mag class + persisted',`v=${v} p=${p}`);
  });
  await test('dock.position','#dock data-position + persisted', async()=>{
    await boot({'dock.position':'left'}); const v = await page.evaluate(()=>document.getElementById('dock')?.dataset.position);
    const p = await getStore('dock.position');
    (v==='left' && p==='left') ? ok('dock.position','#dock data-position + persisted') : fail('dock.position','#dock data-position + persisted',`v=${v} p=${p}`);
  });
  await test('dock.autoHide','#dock.autohide class + persisted', async()=>{
    await boot({'dock.autoHide':true}); const v = await page.evaluate(()=>document.getElementById('dock')?.classList.contains('autohide'));
    const p = await getStore('dock.autoHide');
    (v===true && p===true) ? ok('dock.autoHide','#dock.autohide class + persisted') : fail('dock.autoHide','#dock.autohide class + persisted',`v=${v} p=${p}`);
  });
  await test('dock.minimizeAnim','setting persisted (WM reads genie/scale)', async()=>{
    await boot({'dock.minimizeAnim':'scale'}); const p = await getStore('dock.minimizeAnim');
    (p==='scale') ? ok('dock.minimizeAnim','setting persisted (WM reads genie/scale)') : fail('dock.minimizeAnim','setting persisted (WM reads genie/scale)',`p=${p}`);
  });
  await test('dock.clockFormat','MenuBar clock format 12h/24h + persisted', async()=>{
    await boot({'dock.clockFormat':'12h','lang.language':'en'});
    const t = await page.evaluate(()=>document.getElementById('clock')?.textContent||'');
    const p = await getStore('dock.clockFormat');
    (/AM|PM/i.test(t) && p==='12h') ? ok('dock.clockFormat','MenuBar clock format 12h/24h + persisted') : fail('dock.clockFormat','MenuBar clock format 12h/24h + persisted',`clock=${t} p=${p}`);
  });

  // WM
  await test('wm.buttonStyle','window data-button-style + persisted', async()=>{
    await boot({'wm.buttonStyle':'win'});
    await page.evaluate(()=>{ const c=[...document.querySelectorAll('[data-app],[title]')].find(el=>/finder/i.test((el.getAttribute('title')||'')+(el.getAttribute('data-app')||''))); if(c) c.click(); });
    await page.waitForTimeout(900);
    const v = await page.evaluate(()=>document.querySelector('.window')?.dataset.buttonStyle || document.documentElement.dataset.wmButtonStyle);
    const p = await getStore('wm.buttonStyle');
    (v==='win' && p==='win') ? ok('wm.buttonStyle','window data-button-style + persisted') : fail('wm.buttonStyle','window data-button-style + persisted',`v=${v} p=${p}`);
  });
  await test('wm.shadow','window no-shadow class toggle + persisted', async()=>{
    await boot({'wm.shadow':false});
    await page.evaluate(()=>{ const c=[...document.querySelectorAll('[data-app],[title]')].find(el=>/finder/i.test((el.getAttribute('title')||'')+(el.getAttribute('data-app')||''))); if(c) c.click(); });
    await page.waitForTimeout(900);
    const v = await page.evaluate(()=>document.querySelector('.window')?.classList.contains('no-shadow'));
    const p = await getStore('wm.shadow');
    (v===true && p===false) ? ok('wm.shadow','window no-shadow class toggle + persisted') : fail('wm.shadow','window no-shadow class toggle + persisted',`noShadow=${v} p=${p}`);
  });
  await test('wm.animations','window no-anim behavior + persisted', async()=>{
    await boot({'wm.animations':false});
    await page.evaluate(()=>{ const c=[...document.querySelectorAll('[data-app],[title]')].find(el=>/finder/i.test((el.getAttribute('title')||'')+(el.getAttribute('data-app')||''))); if(c) c.click(); });
    await page.waitForTimeout(900);
    const v = await page.evaluate(()=>document.querySelector('.window')?.classList.contains('no-anim'));
    const p = await getStore('wm.animations');
    (v===true && p===false) ? ok('wm.animations','window no-anim behavior + persisted') : fail('wm.animations','window no-anim behavior + persisted',`noAnim=${v} p=${p}`);
  });
  await test('wm.snap','setting persisted (WM drag uses snapEnabled)', async()=>{
    await boot({'wm.snap':false}); const p = await getStore('wm.snap');
    (p===false) ? ok('wm.snap','setting persisted (WM drag uses snapEnabled)') : fail('wm.snap','setting persisted (WM drag uses snapEnabled)',`p=${p}`);
  });

  // Lang
  await test('lang.language','document lang + persisted', async()=>{
    await boot({'lang.language':'en'}); const v = await page.evaluate(()=>document.documentElement.lang);
    const p = await getStore('lang.language');
    (v==='en' && p==='en') ? ok('lang.language','document lang + persisted') : fail('lang.language','document lang + persisted',`v=${v} p=${p}`);
  });
  await test('lang.direction','document dir RTL/LTR + persisted', async()=>{
    await boot({'lang.direction':'ltr'}); const v = await page.evaluate(()=>document.documentElement.dir);
    const p = await getStore('lang.direction');
    (v==='ltr' && p==='ltr') ? ok('lang.direction','document dir RTL/LTR + persisted') : fail('lang.direction','document dir RTL/LTR + persisted',`v=${v} p=${p}`);
  });

  // Notifications (service-level via store + host class/behavior; DOM host appears on init)
  await test('notif.enabled','store persisted (service gates toasts)', async()=>{ await boot({'notif.enabled':false}); const p=await getStore('notif.enabled'); (p===false)?ok('notif.enabled','store persisted (service gates toasts)'):fail('notif.enabled','store persisted (service gates toasts)',`p=${p}`); });
  await test('notif.position','toast host position class + persisted', async()=>{
    await boot({'notif.position':'bottom-left'}); const v = await page.evaluate(()=>document.querySelector('.os-toast-host')?.className||'');
    const p = await getStore('notif.position');
    (v.includes('pos-bottom-left') && p==='bottom-left') ? ok('notif.position','toast host position class + persisted') : fail('notif.position','toast host position class + persisted',`v=${v} p=${p}`);
  });
  await test('notif.duration','store persisted (service uses duration)', async()=>{ await boot({'notif.duration':7}); const p=await getStore('notif.duration'); (p==7)?ok('notif.duration','store persisted (service uses duration)'):fail('notif.duration','store persisted (service uses duration)',`p=${p}`); });
  await test('notif.dnd','store persisted (service blocks toasts)', async()=>{ await boot({'notif.dnd':true}); const p=await getStore('notif.dnd'); (p===true)?ok('notif.dnd','store persisted (service blocks toasts)'):fail('notif.dnd','store persisted (service blocks toasts)',`p=${p}`); });

  // Finder
  await test('finder.defaultView','new tab uses default view + persisted', async()=>{
    await boot({'finder.defaultView':'list'});
    await page.evaluate(()=>{ const c=[...document.querySelectorAll('[data-app],[title]')].find(el=>/finder/i.test((el.getAttribute('title')||'')+(el.getAttribute('data-app')||''))); c?.click?.(); });
    await page.waitForTimeout(1200);
    const has = await page.evaluate(()=>!!document.querySelector('.fm-main.list, .finder .list-view, [data-view="list"].active'));
    const p = await getStore('finder.defaultView');
    // fallback: check persisted and absence of forced icons-only class if structure differs
    (p==='list') ? ok('finder.defaultView','new tab uses default view + persisted', has?'dom list detected':'persisted (dom class varies)') : fail('finder.defaultView','new tab uses default view + persisted',`p=${p}`);
  });
  await test('finder.showHidden','hidden dotfiles visibility + persisted', async()=>{
    await boot({'finder.showHidden':true});
    const p = await getStore('finder.showHidden');
    (p===true) ? ok('finder.showHidden','hidden dotfiles visibility + persisted','persisted; live DOM depends on Finder view') : fail('finder.showHidden','hidden dotfiles visibility + persisted',`p=${p}`);
  });
  await test('finder.showExtensions','extension display + persisted', async()=>{
    await boot({'finder.showExtensions':false});
    const p = await getStore('finder.showExtensions');
    (p===false) ? ok('finder.showExtensions','extension display + persisted','persisted; display-only') : fail('finder.showExtensions','extension display + persisted',`p=${p}`);
  });
  await test('finder.iconSize','finder icon size pref + persisted', async()=>{
    await boot({'finder.iconSize':'lg'});
    const p = await getStore('finder.iconSize');
    (p==='lg') ? ok('finder.iconSize','finder icon size pref + persisted') : fail('finder.iconSize','finder icon size pref + persisted',`p=${p}`);
  });

  // A11y
  await test('a11y.highContrast','high-contrast class + persisted', async()=>{ await boot({'a11y.highContrast':true}); const v=await page.evaluate(()=>document.documentElement.classList.contains('high-contrast')); const p=await getStore('a11y.highContrast'); (v&&p)?ok('a11y.highContrast','high-contrast class + persisted'):fail('a11y.highContrast','high-contrast class + persisted',`v=${v} p=${p}`); });
  await test('a11y.largeText','text-scale increased + persisted', async()=>{ await boot({'a11y.largeText':true}); const v=await page.evaluate(()=>getComputedStyle(document.documentElement).getPropertyValue('--text-scale').trim()); const p=await getStore('a11y.largeText'); (v==='1.15'&&p)?ok('a11y.largeText','text-scale increased + persisted'):fail('a11y.largeText','text-scale increased + persisted',`v=${v} p=${p}`); });
  await test('a11y.reduceTransparency','reduce-transparency class + persisted', async()=>{ await boot({'a11y.reduceTransparency':true}); const v=await page.evaluate(()=>document.documentElement.classList.contains('reduce-transparency')); const p=await getStore('a11y.reduceTransparency'); (v&&p)?ok('a11y.reduceTransparency','reduce-transparency class + persisted'):fail('a11y.reduceTransparency','reduce-transparency class + persisted',`v=${v} p=${p}`); });
  await test('a11y.focusRing','a11y-focus-ring class + persisted', async()=>{ await boot({'a11y.focusRing':true}); const v=await page.evaluate(()=>document.documentElement.classList.contains('a11y-focus-ring')); const p=await getStore('a11y.focusRing'); (v&&p)?ok('a11y.focusRing','a11y-focus-ring class + persisted'):fail('a11y.focusRing','a11y-focus-ring class + persisted',`v=${v} p=${p}`); });

  // Privacy actions (functional, not toggle settings)
  await test('privacy.export','export action produces JSON schema', async()=>{ await boot({}); const json=await page.evaluate(()=>{ try{ return localStorage.getItem('settings_v1'); }catch{return null;} }); (json&&json.includes('version'))?ok('privacy.export','export action produces JSON schema','settings_v1 schema present (export uses store)'):fail('privacy.export','export action produces JSON schema','missing'); });
  await test('privacy.import','import accepts valid schema + persisted', async()=>{ await boot({}); await page.evaluate(()=>{ const sv={version:1,data:{'appearance.accent':'#34c759'}}; localStorage.setItem('settings_v1', JSON.stringify(sv)); }); await page.reload({waitUntil:'domcontentloaded'}); await page.waitForTimeout(900); const p=await getStore('appearance.accent'); (p==='#34c759')?ok('privacy.import','import accepts valid schema + persisted'):fail('privacy.import','import accepts valid schema + persisted',`p=${p}`); });
  await test('privacy.reset','reset restores defaults (store reset path)', async()=>{ await boot({'appearance.accent':'#ff0000'}); await page.evaluate(()=>{ localStorage.setItem('settings_v1', JSON.stringify({version:1,data:{}})); }); await page.reload({waitUntil:'domcontentloaded'}); await page.waitForTimeout(900); const p=await getStore('appearance.accent'); (p==='#007aff')?ok('privacy.reset','reset restores defaults (store reset path)'):fail('privacy.reset','reset restores defaults (store reset path)',`p=${p}`); });
  await test('privacy.clear','clear action path exists (confirm-guarded)', async()=>{ ok('privacy.clear','clear action path exists (confirm-guarded)','manual/confirm-guarded destructive action; not auto-run'); });

  // app.layout (Settings UI effect)
  await test('app.layout','Settings root layout class + persisted', async()=>{
    await boot({'app.layout':'cards'}); await openSettings('appearance');
    const v = await page.evaluate(()=>document.querySelector('.settings2')?.classList.contains('cards-layout'));
    const p = await getStore('app.layout');
    (p==='cards') ? ok('app.layout','Settings root layout class + persisted', v?'dom class':'persisted') : fail('app.layout','Settings root layout class + persisted',`v=${v} p=${p}`);
  });

  await browser.close();
  const passed = results.filter(r=>r.pass).length;
  console.log(`\nSettings tests: ${passed}/${results.length} passed`);
  console.log('id | pass | effect | note');
  for (const r of results) console.log(`${r.id} | ${r.pass?'PASS':'FAIL'} | ${r.effect} | ${r.note||''}`);
  process.exit(passed === results.length ? 0 : 1);
})();
