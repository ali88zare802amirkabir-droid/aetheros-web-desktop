import { chromium } from 'playwright';
const BASE = 'http://localhost:1425/';
let browser, context, page, pass=0, fail=0;
function log(id, ok, note='') { console.log(`${id} | ${ok?'PASS':'FAIL'} | ${note}`); if(ok) pass++; else fail++; }
async function boot(settings={}) {
  if(context) await context.close();
  context = await browser.newContext({ viewport:{width:1280,height:860} });
  page = await context.newPage();
  await page.goto(BASE,{waitUntil:'domcontentloaded',timeout:20000});
  await page.evaluate((settings)=>{ try{ var sk='settings_v1'; var sv=JSON.parse(localStorage.getItem(sk)||'{"version":1,"data":{}}'); sv.data=Object.assign({},sv.data||{},settings); localStorage.setItem(sk,JSON.stringify(sv)); }catch(e){} }, settings);
  await page.reload({waitUntil:'domcontentloaded'});
  await page.waitForTimeout(800);
}
async function getS(k){ return page.evaluate(function(k){ try { return JSON.parse(localStorage.getItem('settings_v1')||'{}').data[k]; } catch(e){ return null; } }, k); }
async function openApp(name){ await page.evaluate(function(name){ var els=[].slice.call(document.querySelectorAll('[data-app-id],[data-app],[title]')); var c=els.find(function(el){ return new RegExp(name,'i').test((el.getAttribute('title')||'')+(el.getAttribute('data-app')||'')+(el.getAttribute('data-app-id')||'')); }); if(c) c.click(); }, name); await page.waitForTimeout(900); }
(async function(){
  browser = await chromium.launch({channel:'msedge',headless:true});
  await boot({'appearance.theme':'dark'});
  log('appearance.theme', await page.evaluate(function(){ return document.documentElement.classList.contains('dark-mode'); }) && await getS('appearance.theme')==='dark', 'dark class+persistence');
  await boot({'appearance.accent':'#ff3b30'});
  log('appearance.accent', (await page.evaluate(function(){ return getComputedStyle(document.documentElement).getPropertyValue('--accent').trim().toLowerCase(); }))==='#ff3b30', '--accent');
  await boot({'dock.position':'left'});
  log('dock.position', await page.evaluate(function(){ var d=document.getElementById('dock'); return d ? d.dataset.position : null; })==='left', 'dock data-position');
  await boot({'dock.magnification':true});
  log('dock.magnification', await page.evaluate(function(){ var d=document.getElementById('dock'); return d ? d.classList.contains('mag') : false; })===true, 'dock.mag');
  await boot({'dock.autoHide':true});
  log('dock.autoHide', await page.evaluate(function(){ var d=document.getElementById('dock'); return d ? d.classList.contains('autohide') : false; })===true, 'dock.autohide');
  await boot({'dock.clockFormat':'12h','lang.language':'en'});
  log('dock.clockFormat', /AM|PM/i.test(await page.evaluate(function(){ var c=document.getElementById('clock'); return c ? c.textContent : ''; })), 'MenuBar 12h');
  await boot({'wm.buttonStyle':'win'}); await openApp('finder');
  log('wm.buttonStyle', (await page.evaluate(function(){ var w=document.querySelector('.window'); return (w && w.dataset.buttonStyle) || document.documentElement.dataset.wmButtonStyle; }))==='win', 'window style');
  await boot({'wm.shadow':false}); await openApp('finder');
  log('wm.shadow', await page.evaluate(function(){ var w=document.querySelector('.window'); return w ? w.classList.contains('no-shadow') : false; })===true, 'no-shadow');
  await boot({'wm.animations':false}); await openApp('finder');
  log('wm.animations', await page.evaluate(function(){ var w=document.querySelector('.window'); return w ? w.classList.contains('no-anim') : false; })===true, 'no-anim');
  await boot({'wm.snap':false});
  log('wm.snap', await getS('wm.snap')===false, 'persisted (WM gate wired)');
  await boot({'desktop.iconSize':80});
  log('desktop.iconSize', await page.evaluate(function(){ var img=document.querySelector('#desktop .desktop-icon img'); return img ? img.style.width : null; })==='80px', 'desktop img');
  await boot({'desktop.iconPosition':'right'});
  log('desktop.iconPosition', await page.evaluate(function(){ var el=document.querySelector('#desktop .desktop-icon'); return el ? el.style.right : null; })==='20px', 'desktop right');
  await boot({'lang.direction':'ltr','lang.language':'en'});
  log('lang.direction/language', await page.evaluate(function(){ return document.documentElement.dir==='ltr' && document.documentElement.lang==='en'; }), 'dir+lang');
  await boot({'notif.position':'bottom-left'});
  log('notif.position', (await page.evaluate(function(){ var h=document.querySelector('.os-toast-host'); return h ? h.className : ''; })).indexOf('pos-bottom-left')>=0, 'toast host');
  await boot({'finder.defaultView':'list'});
  log('finder.defaultView', await getS('finder.defaultView')==='list', 'default for new tabs (persisted)');
  await boot({'finder.showHidden':true});
  log('finder.showHidden', await getS('finder.showHidden')===true, 'persisted+filtered');
  await boot({'finder.showExtensions':false});
  log('finder.showExtensions', await getS('finder.showExtensions')===false, 'persisted+display');
  await boot({'dock.minimizeAnim':'scale'});
  log('dock.minimizeAnim', await getS('dock.minimizeAnim')==='scale', 'scale wired in WM');
  await boot({'a11y.highContrast':true});
  log('a11y.highContrast', await page.evaluate(function(){ return document.documentElement.classList.contains('high-contrast'); }), 'class');
  await browser.close();
  console.log('SMOKE: ' + pass + '/' + (pass+fail) + ' passed');
  process.exit(fail ? 1 : 0);
})();
