import type { AppDefinition } from '../core/types';
import { gearIcon } from '../ui/icons';
import { State } from '../core/State';
import { VFS } from '../core/VFS';
import { SettingsStore } from './settings/store';
import { SECTIONS, SETTINGS, ACCENT_PRESETS, APPEARANCE_PROFILES, type SettingDef } from './settings/defs';

const esc = (s: string) => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const fmtBytes = (n: number) => n < 1024 ? `${n} B` : n < 1048576 ? `${(n/1024).toFixed(1)} KB` : `${(n/1048576).toFixed(2)} MB`;

function storageInfo() {
  let ls = 0; try { for (let i=0;i<localStorage.length;i++){ const k=localStorage.key(i)||''; ls += (k.length + (localStorage.getItem(k)||'').length)*2; } } catch {}
  let vfsBytes = 0, counts: Record<string,number> = {file:0,folder:0};
  const walk = (n:any) => { if(!n) return; if(n.type==='file'){ counts.file++; vfsBytes += (n.content||'').length + (n.name||'').length; } if(n.type==='folder'){ counts.folder++; Object.values(n.children||{}).forEach(walk); } };
  try { walk(VFS.root); } catch {}
  return { ls, vfsBytes, counts };
}

const SHORTCUTS = [
  ['Ctrl/Cmd+F','Settings search','جستجو در تنظیمات'],
  ['Ctrl/Cmd+T','New Finder tab','تب جدید'],
  ['Ctrl/Cmd+W','Close Finder tab/window','بستن تب/پنجره'],
  ['Ctrl/Cmd+Shift+T','Reopen tab','بازگردانی تب'],
  ['Ctrl/Cmd+N','New Finder window','پنجره جدید'],
  ['Ctrl/Cmd+I','Get Info','اطلاعات'],
  ['Ctrl/Cmd+Shift+G','Go to Folder','رفتن به پوشه'],
  ['Space','Quick Look','پیش‌نمایش'],
  ['Ctrl/Cmd+1..4','Finder views','نماها'],
  ['Arrow / Shift+Arrow','Navigate/select','ناوبری/انتخاب'],
];

// Visual-only SVG icons (defs.ts untouched). stroke 1.75, white, 16x16 viewbox usage.
const svg = (d: string, extra='') => `<svg class="s2-svg" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${extra}>${d}</svg>`;
const ICONS: Record<string,string> = {
  home: svg('<path d="M2.5 6.5 8 2l5.5 4.5"/><path d="M4 5.8V13.5h8V5.8"/>'),
  appearance: svg('<circle cx="8" cy="8" r="5.5"/><path d="M8 2.5v11"/><path d="M8 2.5a5.5 5.5 0 0 1 0 11" fill="currentColor" stroke="none" opacity=".9"/>'),
  wallpaper: svg('<rect x="2" y="3" width="12" height="10" rx="1.5"/><circle cx="5.5" cy="6.5" r="1.2"/><path d="M14 10.5 10.5 7 4 13"/>'),
  dock: svg('<rect x="2" y="10.5" width="12" height="3" rx="1"/><rect x="4.5" y="3" width="3" height="3" rx=".6"/><rect x="8.5" y="3" width="3" height="3" rx=".6"/>'),
  windows: svg('<rect x="2.5" y="4" width="8" height="6.5" rx="1"/><rect x="5.5" y="6.5" width="8" height="6.5" rx="1" fill="var(--s2-card-solid,rgba(128,128,128,.15))"/>'),
  language: svg('<circle cx="8" cy="8" r="5.5"/><path d="M2.5 8h11"/><path d="M8 2.5c-2 1.8-2 9.2 0 11M8 2.5c2 1.8 2 9.2 0 11"/>'),
  notifications: svg('<path d="M5 6a3 3 0 0 1 6 0c0 2.2.6 3 1.3 3.8H3.7C4.4 9 5 8.2 5 6"/><path d="M6.8 12a1.2 1.2 0 0 0 2.4 0"/>'),
  storage: svg('<ellipse cx="8" cy="4.5" rx="5" ry="2"/><path d="M3 4.5v3.5c0 1.1 2.2 2 5 2s5-.9 5-2V4.5"/><path d="M3 8v3.5c0 1.1 2.2 2 5 2s5-.9 5-2V8"/>'),
  finder: svg('<path d="M3 4.5A1.5 1.5 0 0 1 4.5 3h3l1.2 1.5h2.8A1.5 1.5 0 0 1 13 6v5.5a1.5 1.5 0 0 1-1.5 1.5h-7A1.5 1.5 0 0 1 3 11.5z"/>'),
  terminal: svg('<rect x="2" y="3" width="12" height="10" rx="1.5"/><path d="M4.5 6.5 6.5 8 4.5 9.5M7.8 10h3.2"/>'),
  accessibility: svg('<circle cx="8" cy="3.5" r="1.4"/><path d="M4 6h8M8 6v3.5M5.5 13 8 9.5 10.5 13"/>'),
  shortcuts: svg('<rect x="2" y="4" width="12" height="8.5" rx="1.5"/><path d="M4.5 7h1M7 7h2M10.5 7h1M4.5 9.5h7"/>'),
  privacy: svg('<path d="M8 2.5 3.5 4.5v3.2c0 2.8 1.9 4.7 4.5 5.8 2.6-1.1 4.5-3 4.5-5.8V4.5z"/><path d="m6 8 1.4 1.4L10 6.8"/>'),
  about: svg('<circle cx="8" cy="8" r="5.5"/><path d="M8 7.2v3.6"/><circle cx="8" cy="5.3" r=".8" fill="currentColor" stroke="none"/>'),
  search: svg('<circle cx="7" cy="7" r="4"/><path d="m10.2 10.2 3 3"/>'),
  chevron: svg('<path d="M6 4.5 9.5 8 6 11.5"/>'),
};
const iconFor = (id: string) => ICONS[id] || ICONS.about;
const gradFor = (color: string) => `linear-gradient(145deg, ${color}, color-mix(in srgb, ${color} 55%, #000))`;

// Visual map for section groups (defs unchanged)
const NAV_GROUPS: { label: string; labelFa: string; ids: string[] }[] = [
  { label: 'General', labelFa:'عمومی', ids: ['home','appearance','wallpaper','dock','windows'] },
  { label: 'System', labelFa:'سیستم', ids: ['language','notifications','storage','finder','terminal','accessibility','shortcuts'] },
  { label: 'Admin', labelFa:'مدیریت', ids: ['privacy','about'] },
];

export const SettingsApp: AppDefinition = {
  id: 'settings', name: 'Settings', icon: gearIcon, defaultSize: { width: 1040, height: 700 },
  render(win?: any, vfs?: any, args?: any) {
    const root = document.createElement('div');
    root.className = 'settings2';
    root.setAttribute('dir', document.documentElement.dir || 'rtl');
    let current = 'home';
    let layout = SettingsStore.get('app.layout') as string || 'sidebar';
    let highlightId: string | null = null;
    if (args?.highlight) {
      highlightId = args.highlight;
      const def = SETTINGS.find((d:any)=>d.id === args.highlight);
      if (def) current = def.section;
    }

    const sectionById = (id: string) => SECTIONS.find(s=>s.id===id) || SECTIONS[0];
    const defsFor = (sid: string) => SETTINGS.filter(d=>d.section===sid);
    const isFa = () => document.documentElement.lang === 'fa';

    root.innerHTML = `
      <aside class="s2-side">
        <div class="s2-search-wrap">
          <span class="s2-search-ico">${ICONS.search}</span>
          <input class="s2-search" type="search" placeholder="${isFa()?'جستجوی تنظیمات':'Search settings'}" aria-label="Search settings" />
          <div class="s2-search-results" role="listbox"></div>
        </div>
        <div class="s2-profile">
          <div class="s2-avatar" aria-hidden="true"><span>${esc((SettingsStore.get('profile.name')||'U').charAt(0).toUpperCase())}</span></div>
          <div class="s2-profile-meta"><div class="s2-pname">${esc(SettingsStore.get('profile.name'))}</div><div class="s2-pmail">${esc(SettingsStore.get('profile.email'))}</div></div>
        </div>
        <nav class="s2-nav" role="tablist" aria-label="Settings sections"></nav>
      </aside>
      <main class="s2-main" role="main">
        <div class="s2-page" aria-live="polite"></div>
      </main>`;
    const nav = root.querySelector('.s2-nav') as HTMLElement;
    const page = root.querySelector('.s2-page') as HTMLElement;
    const search = root.querySelector('.s2-search') as HTMLInputElement;
    const results = root.querySelector('.s2-search-results') as HTMLElement;

    const renderNav = () => {
      nav.innerHTML = NAV_GROUPS.map(g => {
        const items = g.ids.map(id => sectionById(id)).filter(Boolean).map(s=>`<button class="s2-nav-item ${s.id===current?'active':''}" data-sec="${s.id}" role="tab" aria-selected="${s.id===current}"><span class="s2-ico" style="--ico-c:${s.color};--ico-g:${gradFor(s.color)}">${iconFor(s.id)}</span><span class="s2-nav-label">${isFa()?s.labelFa:s.label}</span><span class="s2-nav-bar" aria-hidden="true"></span></button>`).join('');
        return `<div class="s2-nav-group"><div class="s2-group-label">${isFa()?g.labelFa:g.label}</div>${items}</div>`;
      }).join('');
      nav.querySelectorAll<HTMLElement>('[data-sec]').forEach(b=>b.onclick=()=>navigate(b.dataset.sec!));
    };

    const controlHtml = (d: SettingDef) => {
      const v = SettingsStore.get(d.id);
      const dis = d.disabled ? ' disabled aria-disabled="true"' : '';
      const disC = d.disabled ? ' is-disabled' : '';
      // Visual special-cases (logic/bindings preserved)
      if (d.section === 'appearance' && d.id === 'appearance.theme') {
        return `<div class="s2-theme-cards${disC}" data-set="${d.id}">${(d.options||[]).map(o=>`<button class="s2-theme-card ${v===o.value?'active':''}" data-val="${esc(o.value)}" aria-pressed="${v===o.value}"${d.disabled?' disabled':''}><span class="s2-theme-thumb ${o.value}"></span><span class="s2-theme-name">${esc(o.label)}</span></button>`).join('')}</div>`;
      }
      if (d.section === 'appearance' && d.id === 'appearance.profile') {
        return `<div class="s2-profiles${disC}" data-set="${d.id}">${APPEARANCE_PROFILES.map(p=>`<button class="s2-prof-card ${v===p.id?'on':''}" data-prof="${p.id}" style="--pc:${p.accent}"${d.disabled?' disabled':''}><span class="s2-prof-grad"></span><span class="s2-prof-name">${esc(p.label)}</span></button>`).join('')}</div>`;
      }
      if (d.control==='toggle') return `<button class="s2-toggle ${v?'on':''}${disC}" data-set="${d.id}" role="switch" aria-checked="${!!v}"${d.disabled?' disabled':''}><span></span></button>`;
      if (d.control==='segmented') return `<div class="s2-seg${disC}" data-set="${d.id}" data-val="${esc(String(v))}">${(d.options||[]).map(o=>`<button class="${v===o.value?'active':''}" data-val="${esc(o.value)}"${d.disabled?' disabled':''}>${esc(o.label)}</button>`).join('')}<span class="s2-seg-pill" aria-hidden="true"></span></div>`;
      if (d.control==='select') return `<span class="s2-select-wrap${disC}"><select class="s2-select" data-set="${d.id}"${d.disabled?' disabled':''}>${(d.options||[]).map(o=>`<option value="${esc(o.value)}" ${v===o.value?'selected':''}>${esc(o.label)}</option>`).join('')}</select><span class="s2-select-arrow">${ICONS.chevron}</span></span>`;
      if (d.control==='slider') return `<div class="s2-slider${disC}"><span class="s2-slider-track"><input type="range" data-set="${d.id}" min="${d.min}" max="${d.max}" step="${d.step}" value="${v}" aria-label="${esc(d.label)}"${d.disabled?' disabled':''} /><output class="s2-slider-bubble">${v}${d.unit||''}</output></span><span class="s2-val">${v}${d.unit||''}</span></div>`;
      if (d.control==='color') return `<div class="s2-colors${disC}" data-set="${d.id}">${ACCENT_PRESETS.map(c=>`<button class="s2-swatch ${String(v).toLowerCase()===c?'on':''}" data-val="${c}" style="--sw:${c}" title="${c}" aria-label="${c}"${d.disabled?' disabled':''}><span class="s2-swatch-check">${svg('<path d="M3 8.5 6.5 12 13 4.5"/>')}</span></button>`).join('')}<label class="s2-custom-c"><span>${isFa()?'دلخواه':'Custom'}</span><input type="color" data-custom-accent value="${esc(String(v))}"${d.disabled?' disabled':''} /></label></div>`;
      if (d.control==='profile') return `<div class="s2-profiles${disC}" data-set="${d.id}">${APPEARANCE_PROFILES.map(p=>`<button class="s2-prof-card ${v===p.id?'on':''}" data-prof="${p.id}" style="--pc:${p.accent}"${d.disabled?' disabled':''}><span class="s2-prof-grad"></span><span class="s2-prof-name">${esc(p.label)}</span></button>`).join('')}</div>`;
      if (d.control==='text') return `<input class="s2-text${disC}" data-set="${d.id}" value="${esc(String(v??''))}"${d.disabled?' disabled':''} />`;
      if (d.control==='button') return `<button class="s2-btn${disC}" data-action="${esc(d.action||'')}"${d.disabled?' disabled':''}>${esc(isFa()?(d.labelFa||d.label):d.label)}</button>`;
      return `<span class="s2-val">${esc(String(v??''))}</span>`;
    };

    const soonBadge = (d: SettingDef) => d.soon ? `<span class="s2-soon">${isFa()?'به‌زودی':'Soon'}</span>` : '';
    const rowHtml = (d: SettingDef) => {
      const dis = d.disabled ? ' s2-disabled' : '';
      // On appearance page, theme/profile get special full-width blocks
      if (d.section==='appearance' && (d.id==='appearance.theme' || d.id==='appearance.profile')) {
        return `<div class="s2-row s2-row-block ${highlightId===d.id?'s2-hit':''}${dis}" data-row="${d.id}" id="srow-${d.id}">
          <div class="s2-row-meta"><div class="s2-row-label">${esc(isFa()?(d.labelFa||d.label):d.label)}${soonBadge(d)}</div>${d.desc||d.descFa?`<div class="s2-row-desc">${esc(isFa()?(d.descFa||d.desc||''):(d.desc||''))}</div>`:''}</div>
          <div class="s2-row-ctl s2-row-ctl-full">${controlHtml(d)}</div>
        </div>`;
      }
      return `<div class="s2-row${dis} ${highlightId===d.id?'s2-hit':''}" data-row="${d.id}" id="srow-${d.id}">
        <div class="s2-row-meta"><div class="s2-row-label">${esc(isFa()?(d.labelFa||d.label):d.label)}${soonBadge(d)}</div>${d.desc||d.descFa?`<div class="s2-row-desc">${esc(isFa()?(d.descFa||d.desc||''):(d.desc||''))}</div>`:''}</div>
        <div class="s2-row-ctl">${controlHtml(d)}</div>
      </div>`;
    };

    const homeHtml = () => {
      const st = storageInfo(); const total = st.ls + st.vfsBytes || 1; const pct = Math.min(100, Math.round((total/(5*1048576))*100));
      const accent = SettingsStore.get('appearance.accent');
      return `<div class="s2-content">
      <div class="s2-hero" style="--hero-a:${accent}">
        <div class="s2-hero-copy"><div class="s2-hero-kicker">${isFa()?'سیستم‌عامل وب':'Web Operating System'}</div><h1 class="s2-hero-title">WebOS</h1><div class="s2-hero-sub">${isFa()?'نسخه 0.7.0 · تنظیمات یکپارچه و زنده':'Version 0.7.0 · Unified, live settings'}</div></div>
        <div class="s2-hero-mark" aria-hidden="true">${svg('<path d="M8 1.5 14.5 8 8 14.5 1.5 8z" fill="currentColor" stroke="none"/>','width="48" height="48" viewBox="0 0 16 16"')}</div>
      </div>
      <div class="s2-home-grid">
        <button class="s2-home-card" data-goto="storage"><div class="s2-hc-top"><span class="s2-hc-ico" style="--ico-g:${gradFor('#af52de')}">${ICONS.storage}</span><span class="s2-hc-ring" style="--p:${pct}"></span></div><div class="s2-hc-value">${fmtBytes(total)}</div><div class="s2-hc-label">${isFa()?'فضای ذخیره‌سازی':'Storage'}</div><div class="s2-muted">${pct}% ${isFa()?'از سهم محلی':'of local budget'}</div></button>
        <button class="s2-home-card" data-goto="appearance"><div class="s2-hc-top"><span class="s2-hc-ico" style="--ico-g:${gradFor(accent)}">${ICONS.appearance}</span></div><div class="s2-hc-value">${esc(SettingsStore.get('appearance.theme'))}</div><div class="s2-hc-label">${isFa()?'ظاهر و رنگ':'Theme & Accent'}</div><div class="s2-muted">${esc(accent)}</div></button>
        <button class="s2-home-card" data-goto="language"><div class="s2-hc-top"><span class="s2-hc-ico" style="--ico-g:${gradFor('#00c7be')}">${ICONS.language}</span></div><div class="s2-hc-value">${SettingsStore.get('lang.language')==='fa'?'FA':'EN'}</div><div class="s2-hc-label">${isFa()?'زبان و منطقه':'Language'}</div><div class="s2-muted">${SettingsStore.get('lang.direction')}</div></button>
        <button class="s2-home-card" data-goto="notifications"><div class="s2-hc-top"><span class="s2-hc-ico" style="--ico-g:${gradFor('#ff3b30')}">${ICONS.notifications}</span></div><div class="s2-hc-value">${SettingsStore.get('notif.enabled')?(SettingsStore.get('notif.dnd')?(isFa()?'مزاحم نشوید':'DND'):(isFa()?'روشن':'On')):(isFa()?'خاموش':'Off')}</div><div class="s2-hc-label">${isFa()?'اعلان‌ها':'Notifications'}</div><div class="s2-muted">${esc(SettingsStore.get('notif.position'))}</div></button>
      </div></div>`;
    };

    const previewHtml = () => {
      const a = SettingsStore.get('appearance.accent');
      return `<div class="s2-preview" aria-hidden="true"><div class="s2-pv-chrome"><span></span><span></span><span></span></div><div class="s2-pv-body"><div class="s2-pv-side"></div><div class="s2-pv-main"><div class="s2-pv-h"></div><div class="s2-pv-card"><div class="s2-pv-row"><i></i><b style="background:${a}"></b></div><div class="s2-pv-row"><i></i><b style="background:${a}"></b></div></div></div></div></div>`;
    };

    const storageHtml = () => {
      const st = storageInfo(); const total = Math.max(1, st.ls+st.vfsBytes); const pct = Math.round((st.vfsBytes/total)*100);
      return `<div class="s2-content"><div class="s2-head"><h1>${isFa()?'فضای ذخیره‌سازی':'Storage'}</h1><p>${isFa()?'مدیریت داده محلی و پاکسازی':'Local data usage and cleanup'}</p></div>
        <div class="s2-card"><div class="s2-storage"><div class="s2-donut" style="--p:${pct}"><span>${pct}%</span></div><div class="s2-storage-meta"><div class="s2-st-row"><span>${isFa()?'مجموع تقریبی':'Approx. total'}</span><b>${fmtBytes(total)}</b></div><div class="s2-st-row"><span>VFS/local</span><b>${fmtBytes(st.vfsBytes)}</b></div><div class="s2-st-row"><span>localStorage</span><b>${fmtBytes(st.ls)}</b></div><div class="s2-st-row"><span>${isFa()?'فایل/پوشه':'Files/Folders'}</span><b>${st.counts.file} / ${st.counts.folder}</b></div><div class="s2-st-row"><span>Trash</span><b>${(State.state.trash||[]).length}</b></div></div></div>
        <div class="s2-card-actions"><button class="s2-btn" data-action="emptyTrash">${isFa()?'خالی کردن سطل زباله':'Empty Trash'}</button><button class="s2-btn s2-btn-muted" data-action="clearCache">${isFa()?'بازخوانی':'Refresh'}</button></div></div>
        <div class="s2-section-label">${isFa()?'تنظیمات':'SETTINGS'}</div><div class="s2-card">${defsFor('storage').map(rowHtml).join('')||`<div class="s2-empty"><div>${isFa()?'تنظیم اضافه‌ای نیست':'No additional settings'}</div></div>`}</div></div>`;
    };

    const shortcutsHtml = () => `<div class="s2-content"><div class="s2-head"><h1>${isFa()?'میانبرها':'Shortcuts'}</h1><p>${isFa()?'میانبرهای سیستم':'System shortcuts'}</p></div><div class="s2-card"><div class="s2-inset-search"><span class="s2-search-ico">${ICONS.search}</span><input class="s2-text" id="s2-sc-q" placeholder="${isFa()?'جستجوی میانبر...':'Search shortcuts...'}" /></div><div id="s2-sc-list" class="s2-sc-list">${SHORTCUTS.map(s=>`<div class="s2-sc-row" data-sc="${esc(s.join(' '))}"><span class="s2-sc-desc">${esc(isFa()?s[2]:s[1])}</span><kbd>${esc(s[0])}</kbd></div>`).join('')}</div></div></div>`;
    const aboutHtml = () => `<div class="s2-content"><div class="s2-head"><h1>${isFa()?'درباره':'About'}</h1><p>${isFa()?'اطلاعات سیستم':'System information'}</p></div><div class="s2-card s2-about"><div class="s2-about-logo" aria-hidden="true">${svg('<path d="M8 1.5 14.5 8 8 14.5 1.5 8z" fill="currentColor" stroke="none"/>','width="28" height="28" viewBox="0 0 16 16"')}</div><div><h3 class="s2-about-title">WebOS <span class="s2-ver">0.7.0</span></h3><div class="s2-muted">Vite + Vanilla TypeScript</div><div class="s2-about-meta"><div><span>${isFa()?'مرورگر':'Browser'}</span><b>${esc((navigator.userAgent.split(')')[0]||'')+')')}</b></div><div><span>${isFa()?'سکو':'Platform'}</span><b>${esc(navigator.platform||'unknown')}</b></div><div><span>${isFa()?'زبان':'Language'}</span><b>${esc(navigator.language)}</b></div><div><span>${isFa()?'نمایشگر':'Screen'}</span><b>${screen.width}×${screen.height}</b></div></div></div></div></div>`;

    const renderSection = (sid: string) => {
      const sec = sectionById(sid);
      if (sid === 'home') { page.innerHTML = homeHtml(); bindCommon(); return; }
      if (sid === 'storage') { page.innerHTML = storageHtml(); bindCommon(); return; }
      if (sid === 'shortcuts') { page.innerHTML = shortcutsHtml(); bindCommon(); return; }
      if (sid === 'about') { page.innerHTML = aboutHtml(); bindCommon(); return; }
      const defs = defsFor(sid);
      page.innerHTML = `<div class="s2-content"><div class="s2-head"><h1>${esc(isFa()?sec.labelFa:sec.label)}</h1><p>${esc(isFa()?sec.label:sec.labelFa)}</p></div>
        ${sid==='appearance' ? `${previewHtml()}<div class="s2-section-label">${isFa()?'شخصی‌سازی':'PERSONALIZATION'}</div>`:''}
        <div class="s2-card">${defs.map(rowHtml).join('') || `<div class="s2-empty">${ICONS.about}<div>${isFa()?'تنظیمی در این بخش ثبت نشده':'No settings in this section'}</div></div>`}</div></div>`;
      bindCommon();
      if (sid==='appearance') syncPreview();
      if (highlightId) { const el = page.querySelector(`#srow-${highlightId}`) as HTMLElement|null; if (el) { el.scrollIntoView({behavior:'smooth', block:'center'}); el.classList.add('s2-hit'); setTimeout(()=>el.classList.remove('s2-hit'), 1400); } highlightId = null; }
    };

    const syncPreview = () => {
      const pv = page.querySelector('.s2-preview') as HTMLElement|null; if(!pv) return;
      const accent = SettingsStore.get('appearance.accent'); const r = SettingsStore.get('appearance.radius');
      const blur = SettingsStore.get('appearance.blur'); const tr = SettingsStore.get('appearance.transparency');
      pv.style.setProperty('--pv-a', accent); pv.style.setProperty('--pv-r', `${Math.max(4, Math.round(+r*0.6))}px`);
      pv.style.setProperty('--pv-blur', `${Math.round(+blur*0.5)}px`); pv.style.setProperty('--pv-alpha', `${+tr/100}`);
      pv.dataset.theme = SettingsStore.get('appearance.theme');
      pv.querySelectorAll<HTMLElement>('.s2-pv-row b').forEach(b=>b.style.background=accent);
    };

    const syncSegPill = (seg: HTMLElement) => {
      const active = seg.querySelector('button.active') as HTMLElement|null; const pill = seg.querySelector('.s2-seg-pill') as HTMLElement|null; if(!active||!pill) return;
      const sr = seg.getBoundingClientRect(); const ar = active.getBoundingClientRect();
      const isRtl = getComputedStyle(seg).direction === 'rtl';
      const x = isRtl ? (sr.right - ar.right) : (ar.left - sr.left);
      pill.style.width = `${active.offsetWidth}px`; pill.style.transform = `translateX(${isRtl ? -x : x}px)`;
    };

    const navigate = (sid: string) => {
      current = sid; renderNav();
      const reduce = SettingsStore.get('appearance.reducedMotion') === 'on' || (SettingsStore.get('appearance.reducedMotion')==='system' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
      if (reduce) { renderSection(sid); return; }
      page.classList.add('s2-leave');
      setTimeout(()=>{ renderSection(sid); page.classList.remove('s2-leave'); page.classList.add('s2-enter'); setTimeout(()=>page.classList.remove('s2-enter'), 240); staggerRows(); }, 90);
    };
    const staggerRows = () => page.querySelectorAll<HTMLElement>('.s2-card .s2-row, .s2-home-card').forEach((el,i)=>{ el.style.animationDelay = `${Math.min(i,8)*30}ms`; el.classList.add('s2-stagger'); });

    const doAction = async (action: string) => {
      if (action === 'export') { const blob = new Blob([SettingsStore.exportJson()], {type:'application/json'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='webos-settings.json'; a.click(); setTimeout(()=>URL.revokeObjectURL(a.href),1000); }
      if (action === 'import') { const inp=document.createElement('input'); inp.type='file'; inp.accept='application/json'; inp.onchange=async()=>{ const f=inp.files?.[0]; if(!f) return; try{ SettingsStore.importJson(await f.text()); renderSection(current); renderNav(); }catch(e){ alert((e as Error).message);} }; inp.click(); }
      if (action === 'reset') { if(confirm(isFa()?'همه تنظیمات به پیش‌فرض بازگردد؟':'Reset all settings to defaults?')){ SettingsStore.reset(); renderSection(current); renderNav(); } }
      if (action === 'clear') { if(confirm(isFa()?'داده‌های محلی پاک شود؟ (تنظیمات/حالت)':'Clear local data (settings/state)?')){ localStorage.clear(); location.reload(); } }
      if (action === 'emptyTrash') { State.update({ trash: [] }); renderSection('storage'); }
      if (action === 'clearCache') { renderSection('storage'); }
    };

    const bindCommon = () => {
      page.querySelectorAll<HTMLElement>('[data-goto]').forEach(b=>b.onclick=()=>navigate(b.dataset.goto!));
      page.querySelectorAll<HTMLElement>('.s2-toggle').forEach(b=>{ if((b as HTMLButtonElement).disabled || b.closest('.s2-disabled')) return; b.onclick=()=>{ const k=b.dataset.set!; const nv=!SettingsStore.get(k); SettingsStore.set(k,nv); b.classList.toggle('on',nv); b.setAttribute('aria-checked',String(nv)); syncPreview(); }; });
      page.querySelectorAll<HTMLElement>('.s2-theme-cards').forEach(w=>{ if(w.classList.contains('is-disabled') || w.closest('.s2-disabled')) return; w.querySelectorAll<HTMLButtonElement>('[data-val]').forEach(btn=>btn.onclick=()=>{ SettingsStore.set(w.dataset.set!, btn.dataset.val); w.querySelectorAll('button').forEach(x=>{x.classList.remove('active'); x.setAttribute('aria-pressed','false');}); btn.classList.add('active'); btn.setAttribute('aria-pressed','true'); syncPreview(); }); });
      page.querySelectorAll<HTMLElement>('.s2-seg').forEach(seg=>{ syncSegPill(seg); if(seg.classList.contains('is-disabled') || seg.closest('.s2-disabled')) return; seg.querySelectorAll<HTMLButtonElement>('button[data-val]').forEach(btn=>btn.onclick=()=>{ SettingsStore.set(seg.dataset.set!, btn.dataset.val); seg.querySelectorAll('button').forEach(x=>x.classList.remove('active')); btn.classList.add('active'); seg.dataset.val=btn.dataset.val!; syncSegPill(seg); if(seg.dataset.set==='app.layout'){ layout=btn.dataset.val!; root.classList.toggle('cards-layout', layout==='cards'); } renderNav(); }); });
      page.querySelectorAll<HTMLSelectElement>('.s2-select').forEach(sel=>{
        const dis = sel.disabled || !!sel.closest('.s2-disabled');
        sel.onchange=()=>{ if(dis) return; SettingsStore.set(sel.dataset.set!, sel.value); syncPreview(); const wrap=sel.closest('.s2-select-wrap'); const lbl=wrap?.querySelector('.s2-select-label'); if(lbl) lbl.textContent = sel.options[sel.selectedIndex]?.text || sel.value; };
        const wrap = sel.closest('.s2-select-wrap') as HTMLElement|null;
        if (wrap && !wrap.dataset.enhanced) {
          wrap.dataset.enhanced='1';
          // hide original arrow (avoids double control/arrow)
          wrap.querySelectorAll(':scope > .s2-select-arrow').forEach(el=>el.remove());
          const btn = document.createElement('button'); btn.type='button'; btn.className='s2-select-btn'; if(dis) btn.disabled = true;
          btn.setAttribute('aria-haspopup','listbox'); btn.setAttribute('aria-expanded','false');
          btn.innerHTML = `<span class="s2-select-label">${esc(sel.options[sel.selectedIndex]?.text||sel.value)}</span><span class="s2-select-arrow">${ICONS.chevron}</span>`;
          sel.classList.add('s2-select-native');
          sel.tabIndex = -1; sel.setAttribute('aria-hidden','true');
          wrap.insertBefore(btn, sel);
          const menu = document.createElement('div'); menu.className='s2-select-menu'; menu.setAttribute('role','listbox');
          menu.tabIndex = -1;
          const portals: HTMLElement[] = ((root as any)._s2portals ||= []);
          let typeBuf = ''; let typeT: number | null = null;
          const positionMenu = () => {
            const r = btn.getBoundingClientRect();
            menu.style.position='fixed'; menu.style.minWidth = r.width+'px'; menu.style.width = Math.max(r.width, 160)+'px';
            menu.style.zIndex = '9999';
            const below = window.innerHeight - r.bottom; const above = r.top;
            const openUp = below < 220 && above > below;
            if (openUp) { menu.style.top=''; menu.style.bottom = (window.innerHeight - r.top + 4)+'px'; menu.style.transformOrigin='bottom center'; }
            else { menu.style.bottom=''; menu.style.top = (r.bottom + 4)+'px'; menu.style.transformOrigin='top center'; }
            menu.style.insetInlineStart = r.left+'px'; menu.style.left = r.left+'px';
          };
          const build = () => { menu.innerHTML = Array.from(sel.options).map((o,i)=>`<button type="button" class="s2-select-opt ${o.selected?'active':''}" data-val="${esc(o.value)}" data-i="${i}" role="option" aria-selected="${o.selected}" tabindex="-1">${esc(o.text)}</button>`).join(''); };
          const close = (focusBtn=true) => {
            if (!menu.isConnected) return;
            menu.remove(); wrap.classList.remove('open'); btn.setAttribute('aria-expanded','false');
            if (focusBtn) btn.focus();
          };
          const focusOpt = (idx: number) => {
            const opts = Array.from(menu.querySelectorAll<HTMLElement>('.s2-select-opt')); if (!opts.length) return;
            const i = Math.max(0, Math.min(opts.length-1, idx));
            opts.forEach((o,j)=>o.classList.toggle('focus', j===i));
            opts[i].focus();
          };
          const open = () => {
            if (dis) return;
            // close others
            portals.forEach(p=>{ if(p.isConnected) p.remove(); });
            root.querySelectorAll('.s2-select-wrap.open').forEach(w=>w.classList.remove('open'));
            root.querySelectorAll('.s2-select-btn[aria-expanded="true"]').forEach(b=>b.setAttribute('aria-expanded','false'));
            build(); positionMenu(); document.body.appendChild(menu); if(!portals.includes(menu)) portals.push(menu);
            wrap.classList.add('open'); btn.setAttribute('aria-expanded','true');
            const activeIdx = Math.max(0, Array.from(sel.options).findIndex(o=>o.selected));
            requestAnimationFrame(()=>focusOpt(activeIdx));
          };
          const selectIdx = (i: number) => {
            if (i<0 || i>=sel.options.length) return;
            sel.value = sel.options[i].value;
            sel.dispatchEvent(new Event('change',{bubbles:true}));
            close(true);
          };
          btn.onclick = (e) => { e.stopPropagation(); if(dis) return; if(menu.isConnected) close(true); else open(); };
          btn.onkeydown = (e) => {
            if (dis) return;
            if (['ArrowDown','ArrowUp','Enter',' '].includes(e.key)) { e.preventDefault(); if(!menu.isConnected) open(); else if(e.key==='Enter'||e.key===' ') selectIdx(Array.from(sel.options).findIndex(o=>o.selected)); }
            if (e.key==='Escape' && menu.isConnected) { e.preventDefault(); close(true); }
          };
          menu.onclick = (e) => { const t=(e.target as HTMLElement).closest<HTMLElement>('[data-i]'); if(!t) return; e.stopPropagation(); selectIdx(+t.dataset.i!); };
          menu.onkeydown = (e) => {
            const opts = Array.from(menu.querySelectorAll<HTMLElement>('.s2-select-opt'));
            const cur = opts.findIndex(o=>o===document.activeElement);
            if (e.key==='Escape') { e.preventDefault(); close(true); }
            else if (e.key==='ArrowDown') { e.preventDefault(); focusOpt((cur<0?0:cur+1)); }
            else if (e.key==='ArrowUp') { e.preventDefault(); focusOpt((cur<=0?0:cur-1)); }
            else if (e.key==='Home') { e.preventDefault(); focusOpt(0); }
            else if (e.key==='End') { e.preventDefault(); focusOpt(opts.length-1); }
            else if (e.key==='Enter' || e.key===' ') { e.preventDefault(); if(cur>=0) selectIdx(cur); }
            else if (e.key==='Tab') { close(true); }
            else if (e.key.length===1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
              typeBuf += e.key.toLowerCase(); if(typeT) window.clearTimeout(typeT); typeT = window.setTimeout(()=>typeBuf='', 500) as any;
              const fi = Array.from(sel.options).findIndex(o=>o.text.toLowerCase().startsWith(typeBuf));
              if (fi>=0) focusOpt(fi);
            }
          };
          if(!(root as any)._s2selGlobal){
            (root as any)._s2selGlobal=true;
            const closeAll = (ev?: Event) => {
              const t = ev?.target as HTMLElement | null;
              if (t && (t.closest('.s2-select-wrap') || t.closest('.s2-select-menu'))) return;
              ((root as any)._s2portals||[]).forEach((p:HTMLElement)=>{ if(p.isConnected) p.remove(); });
              root.querySelectorAll('.s2-select-wrap.open').forEach(w=>w.classList.remove('open'));
              root.querySelectorAll('.s2-select-btn[aria-expanded="true"]').forEach(b=>b.setAttribute('aria-expanded','false'));
            };
            root.addEventListener('click', closeAll);
            document.addEventListener('scroll', () => closeAll(), true);
            window.addEventListener('resize', () => closeAll());
          }
          sel.addEventListener('change', build);
        }
      });
      page.querySelectorAll<HTMLInputElement>('input.s2-text[data-set]').forEach(inp=>{ if(inp.disabled || inp.closest('.s2-disabled')) return; const commit=()=>SettingsStore.set(inp.dataset.set!, inp.value); inp.onchange=commit; inp.onblur=commit; });
      page.querySelectorAll<HTMLInputElement>('input[type="range"][data-set]').forEach(r=>{ if(r.disabled || r.closest('.s2-disabled')) return; const wrap=r.closest('.s2-slider'); const bubble=wrap?.querySelector('.s2-slider-bubble') as HTMLElement|null; const val=wrap?.querySelector('.s2-val') as HTMLElement|null; const def=SETTINGS.find(d=>d.id===r.dataset.set); const upd=()=>{ const t=r.value+(def?.unit||''); if(val) val.textContent=t; if(bubble){ bubble.textContent=t; const pct=(+r.value-+r.min)/(+r.max-+r.min); bubble.style.insetInlineStart=`calc(${pct*100}% + ${(0.5-pct)*18}px)`; } };
        r.oninput=()=>{ const parsed = r.step && String(r.step).includes('.') ? +r.value : +r.value; SettingsStore.set(r.dataset.set!, parsed); upd(); syncPreview(); if(bubble) bubble.classList.add('show'); };
        r.onpointerup=()=>bubble?.classList.remove('show'); r.onblur=()=>bubble?.classList.remove('show'); upd();
      });
      page.querySelectorAll<HTMLElement>('.s2-colors').forEach(w=>{ if(w.classList.contains('is-disabled') || w.closest('.s2-disabled')) return; w.querySelectorAll<HTMLElement>('.s2-swatch').forEach(sw=>sw.onclick=()=>{ SettingsStore.set('appearance.accent', sw.dataset.val); w.querySelectorAll('.s2-swatch').forEach(x=>x.classList.remove('on')); sw.classList.add('on'); const ci=w.querySelector<HTMLInputElement>('[data-custom-accent]'); if(ci) ci.value=sw.dataset.val!; syncPreview(); renderNav(); }); const ci=w.querySelector<HTMLInputElement>('[data-custom-accent]'); if(ci) ci.oninput=()=>{ SettingsStore.set('appearance.accent', ci.value); syncPreview(); renderNav(); }; });
      page.querySelectorAll<HTMLElement>('.s2-profiles').forEach(w=>w.querySelectorAll<HTMLButtonElement>('[data-prof]').forEach(b=>b.onclick=()=>{ const p=APPEARANCE_PROFILES.find(x=>x.id===b.dataset.prof); if(!p) return; SettingsStore.setMany({'appearance.profile':p.id,'appearance.accent':p.accent,'appearance.theme':p.theme}); renderSection('appearance'); renderNav(); }));
      page.querySelectorAll<HTMLElement>('[data-action]').forEach(b=>b.onclick=()=>void doAction(b.dataset.action!));
      const scq = page.querySelector('#s2-sc-q') as HTMLInputElement|null;
      if (scq) scq.oninput=()=>{ const q=scq.value.toLowerCase(); page.querySelectorAll<HTMLElement>('.s2-sc-row').forEach(r=>r.style.display = (r.dataset.sc||'').toLowerCase().includes(q)?'':'none'); };
      setTimeout(()=>page.querySelectorAll<HTMLElement>('.s2-seg').forEach(syncSegPill), 0);
    };

    // global search (logic unchanged)
    const runSearch = () => {
      const q = search.value.trim().toLowerCase();
      if (!q) { results.classList.remove('open'); results.innerHTML=''; return; }
      const hits = SETTINGS.filter(d => [d.label,d.labelFa,d.desc,d.descFa,d.id, ...(d.keywords||[]), ...(sectionById(d.section).keywords||[])].join(' ').toLowerCase().includes(q)).slice(0,12);
      if (!hits.length) { results.innerHTML=`<div class="s2-sr-empty"><span class="s2-empty-ico">${ICONS.search}</span><div>${isFa()?'نتیجه‌ای پیدا نشد':'No results found'}</div></div>`; results.classList.add('open'); return; }
      const mark = (txt: string) => { const i=txt.toLowerCase().indexOf(q); if(i<0) return esc(txt); return `${esc(txt.slice(0,i))}<b class="s2-hl">${esc(txt.slice(i,i+q.length))}</b>${esc(txt.slice(i+q.length))}`; };
      results.innerHTML = hits.map(d=>{ const sec=sectionById(d.section); const label=isFa()?(d.labelFa||d.label):d.label; return `<button class="s2-sr" data-go="${d.section}" data-hit="${d.id}"><span class="s2-ico sm" style="--ico-g:${gradFor(sec.color)}">${iconFor(sec.id)}</span><span class="s2-sr-body"><span class="s2-sr-title">${mark(label)}</span><span class="s2-sr-path">${esc(isFa()?sec.labelFa:sec.label)} › ${esc(isFa()?d.label:d.labelFa||d.label)}</span></span></button>`; }).join('');
      results.classList.add('open');
      results.querySelectorAll<HTMLElement>('[data-go]').forEach(b=>b.onclick=()=>{ highlightId=b.dataset.hit!; search.value=''; results.classList.remove('open'); navigate(b.dataset.go!); });
    };
    search.oninput = runSearch;
    search.onkeydown = (e) => { if(e.key==='Escape'){ results.classList.remove('open'); search.blur(); } };
    root.addEventListener('keydown', (e) => { if((e.ctrlKey||e.metaKey) && e.key.toLowerCase()==='f'){ e.preventDefault(); search.focus(); search.select(); } });

    root.classList.toggle('cards-layout', layout==='cards');
    const off = SettingsStore.on(()=>{ syncPreview(); });
    renderNav(); renderSection('home'); staggerRows();
    (root as any)._cleanup = off;
    return root;
  }
};
