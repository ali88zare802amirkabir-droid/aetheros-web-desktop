export type ControlType = 'toggle'|'select'|'slider'|'color'|'text'|'segmented'|'button'|'profile'|'readonly';
export interface SettingDef {
  id: string; section: string; label: string; labelFa?: string; desc?: string; descFa?: string;
  keywords?: string[]; control: ControlType; default?: any;
  options?: {value:string; label:string}[]; min?: number; max?: number; step?: number; unit?: string;
  action?: string;
  disabled?: boolean;
  soon?: boolean;
}
export interface SectionDef { id: string; label: string; labelFa: string; icon: string; color: string; keywords?: string[] }

export const SECTIONS: SectionDef[] = [
  { id:'home', label:'Home', labelFa:'خانه', icon:'⌂', color:'#8e8e93' },
  { id:'appearance', label:'Appearance', labelFa:'ظاهر', icon:'◐', color:'#007aff', keywords:['theme','dark','light','accent','font','تم','رنگ','فونت'] },
  { id:'wallpaper', label:'Wallpaper & Desktop', labelFa:'تصویر زمینه و دسکتاپ', icon:'🖼', color:'#34c759', keywords:['wallpaper','desktop','icon','پس‌زمینه','دسکتاپ'] },
  { id:'dock', label:'Dock & Menu Bar', labelFa:'داک و نوار منو', icon:'▣', color:'#ff9500', keywords:['dock','menubar','clock','داک'] },
  { id:'windows', label:'Windows & Multitasking', labelFa:'پنجره‌ها و چندوظیفگی', icon:'▢', color:'#5856d6', keywords:['snap','window','پنجره'] },
  { id:'language', label:'Language & Region', labelFa:'زبان و منطقه', icon:'🌐', color:'#00c7be', keywords:['language','rtl','persian','زبان','فارسی'] },
  { id:'notifications', label:'Notifications', labelFa:'اعلان‌ها', icon:'🔔', color:'#ff3b30', keywords:['notification','dnd','اعلان'] },
  { id:'storage', label:'Storage', labelFa:'فضای ذخیره‌سازی', icon:'🗄', color:'#af52de', keywords:['storage','cache','trash','حافظه'] },
  { id:'finder', label:'Finder', labelFa:'فایندر', icon:'📁', color:'#0a84ff', keywords:['finder','files','فایل'] },
  { id:'terminal', label:'Terminal', labelFa:'ترمینال', icon:'⌘', color:'#1d1d1f', keywords:['terminal','shell','command','ترمینال'] },
  { id:'accessibility', label:'Accessibility', labelFa:'دسترسی‌پذیری', icon:'♿', color:'#30b0c7', keywords:['accessibility','contrast','دسترسی'] },
  { id:'shortcuts', label:'Shortcuts', labelFa:'میانبرها', icon:'⌨', color:'#8e8e93', keywords:['shortcut','keyboard','میانبر'] },
  { id:'privacy', label:'Privacy & Data', labelFa:'حریم خصوصی و داده', icon:'🛡', color:'#ff2d55', keywords:['privacy','export','reset','حریم'] },
  { id:'about', label:'About', labelFa:'درباره', icon:'ℹ', color:'#64d2ff', keywords:['about','version','درباره'] },
];

const profiles = [
  { id:'aurora', label:'Aurora', accent:'#00c7be', theme:'dark' },
  { id:'midnight', label:'Midnight', accent:'#5856d6', theme:'dark' },
  { id:'sakura', label:'Sakura', accent:'#ff2d55', theme:'light' },
  { id:'forest', label:'Forest', accent:'#34c759', theme:'light' },
  { id:'mono', label:'Mono', accent:'#8e8e93', theme:'auto' },
];

export const SETTINGS: SettingDef[] = [
  { id:'app.layout', section:'appearance', label:'Settings layout', labelFa:'چیدمان تنظیمات', desc:'Choose sidebar or cards layout', descFa:'انتخاب چیدمان سایدبار یا کارت', control:'segmented', options:[{value:'sidebar',label:'Sidebar'},{value:'cards',label:'Cards'}], keywords:['layout','چیدمان'] },
  { id:'appearance.theme', section:'appearance', label:'Theme', labelFa:'تم', desc:'Light, dark, or automatic', descFa:'روشن، تیره یا خودکار', control:'segmented', options:[{value:'light',label:'Light'},{value:'dark',label:'Dark'},{value:'auto',label:'Auto'}], keywords:['theme','dark','light','auto','تم','تیره','روشن'] },
  { id:'appearance.themePack', section:'appearance', label:'Theme pack', labelFa:'پک تم', desc:'AetherOS visual packs', descFa:'پک‌های بصری AetherOS', control:'segmented', options:[{value:'',label:'Default'},{value:'blackos',label:'Aether'}], keywords:['theme','pack','aether','blackos','خفن'] },
  { id:'appearance.accent', section:'appearance', label:'Accent color', labelFa:'رنگ تاکید', desc:'System highlight color', descFa:'رنگ برجسته سیستم', control:'color', keywords:['accent','color','رنگ'] },
  { id:'appearance.profile', section:'appearance', label:'Appearance profiles', labelFa:'پروفایل‌های ظاهری', desc:'One-click presets', descFa:'پریست‌های یک‌کلیکی', control:'profile', options:profiles.map(p=>({value:p.id,label:p.label})), keywords:['profile','preset','پروفایل'] },
  { id:'appearance.blur', section:'appearance', label:'Glass blur', labelFa:'میزان Blur شیشه', desc:'Backdrop blur intensity', control:'slider', min:0, max:32, step:1, unit:'px', keywords:['blur','glass','شفاف'] },
  { id:'appearance.transparency', section:'appearance', label:'Glass transparency', labelFa:'شفافیت شیشه', control:'slider', min:40, max:100, step:1, unit:'%', keywords:['transparency','opacity'] },
  { id:'appearance.radius', section:'appearance', label:'Corner radius', labelFa:'شعاع گوشه‌ها', control:'slider', min:4, max:24, step:1, unit:'px', keywords:['radius','corner','گوشه'] },
  { id:'appearance.font', section:'appearance', label:'UI font', labelFa:'فونت رابط', control:'select', options:[{value:'Inter',label:'Inter'},{value:'Segoe UI',label:'Segoe UI'},{value:'Vazirmatn',label:'Vazirmatn'}], keywords:['font','فونت'] },
  { id:'appearance.textSize', section:'appearance', label:'Text size', labelFa:'اندازه متن', control:'slider', min:85, max:125, step:5, unit:'%', keywords:['text','size','متن'] },
  { id:'appearance.reducedMotion', section:'appearance', label:'Reduced motion', labelFa:'کاهش حرکت', control:'select', options:[{value:'system',label:'Follow system'},{value:'on',label:'On'},{value:'off',label:'Off'}], keywords:['motion','animation','حرکت'] },

  { id:'wallpaper.url', section:'wallpaper', label:'Wallpaper', labelFa:'تصویر زمینه', desc:'Image URL or upload', control:'text', keywords:['wallpaper','background','پس‌زمینه'] },
  { id:'wallpaper.autoByTheme', section:'wallpaper', label:'Auto wallpaper by theme', labelFa:'والپیپر خودکار با تم', control:'toggle', keywords:['auto','theme'], disabled:true, soon:true },
  { id:'wallpaper.blur', section:'wallpaper', label:'Background blur', labelFa:'Blur پس‌زمینه', control:'slider', min:0, max:24, step:1, unit:'px', keywords:['blur'] },
  { id:'desktop.iconSize', section:'wallpaper', label:'Desktop icon size', labelFa:'اندازه آیکن دسکتاپ', control:'slider', min:40, max:96, step:8, unit:'px', keywords:['desktop','icon','آیکن'] },
  { id:'desktop.iconPosition', section:'wallpaper', label:'Desktop icon position', labelFa:'جایگاه آیکن‌ها', control:'segmented', options:[{value:'left',label:'Left'},{value:'right',label:'Right'}], keywords:['position'] },

  { id:'dock.size', section:'dock', label:'Dock size', labelFa:'اندازه داک', control:'slider', min:36, max:72, step:2, unit:'px', keywords:['dock','size'] },
  { id:'dock.magnification', section:'dock', label:'Magnification', labelFa:'بزرگ‌نمایی', control:'toggle', keywords:['magnification'] },
  { id:'dock.position', section:'dock', label:'Position', labelFa:'موقعیت', control:'segmented', options:[{value:'bottom',label:'Bottom'},{value:'left',label:'Left'},{value:'right',label:'Right'}], keywords:['position'] },
  { id:'dock.autoHide', section:'dock', label:'Auto-hide', labelFa:'پنهان‌سازی خودکار', control:'toggle', keywords:['autohide'] },
  { id:'dock.minimizeAnim', section:'dock', label:'Minimize animation', labelFa:'انیمیشن minimize', control:'segmented', options:[{value:'genie',label:'Genie'},{value:'scale',label:'Scale'}], keywords:['minimize','genie'] },
  { id:'dock.showRecents', section:'dock', label:'Show recent apps', labelFa:'نمایش اپ‌های اخیر', control:'toggle', keywords:['recent'], disabled:true, soon:true },
  { id:'dock.clockFormat', section:'dock', label:'Clock format', labelFa:'فرمت ساعت', control:'segmented', options:[{value:'24h',label:'24h'},{value:'12h',label:'12h'}], keywords:['clock','time','ساعت'] },

  { id:'wm.snap', section:'windows', label:'Snap Layouts', labelFa:'چیدمان Snap', control:'toggle', keywords:['snap','layout'] },
  { id:'wm.buttonStyle', section:'windows', label:'Window button style', labelFa:'سبک دکمه‌های پنجره', control:'segmented', options:[{value:'mac',label:'Traffic lights'},{value:'win',label:'Windows'}], keywords:['button','traffic'] },
  { id:'wm.shadow', section:'windows', label:'Window shadows', labelFa:'سایه پنجره', control:'toggle', keywords:['shadow'] },
  { id:'wm.animations', section:'windows', label:'Open/close animations', labelFa:'انیمیشن باز/بسته', control:'toggle', keywords:['animation'] },

  { id:'lang.language', section:'language', label:'Language', labelFa:'زبان', control:'segmented', options:[{value:'fa',label:'فارسی'},{value:'en',label:'English'}], keywords:['language','زبان','فارسی','english'] },
  { id:'lang.direction', section:'language', label:'Direction', labelFa:'جهت متن', control:'segmented', options:[{value:'rtl',label:'RTL'},{value:'ltr',label:'LTR'}], keywords:['rtl','ltr','direction'] },
  { id:'lang.calendar', section:'language', label:'Calendar', labelFa:'تقویم', control:'segmented', options:[{value:'shamsi',label:'شمسی'},{value:'gregorian',label:'میلادی'}], keywords:['calendar','تقویم'], disabled:true, soon:true },
  { id:'lang.numberFormat', section:'language', label:'Number format', labelFa:'فرمت اعداد', control:'segmented', options:[{value:'fa',label:'فارسی'},{value:'en',label:'لاتین'}], keywords:['number','اعداد'], disabled:true, soon:true },
  { id:'lang.timezone', section:'language', label:'Time zone', labelFa:'منطقه زمانی', control:'select', options:[{value:'Asia/Tehran',label:'Asia/Tehran'},{value:'UTC',label:'UTC'},{value:'Europe/Berlin',label:'Europe/Berlin'}], keywords:['timezone'], disabled:true, soon:true },
  { id:'lang.faFont', section:'language', label:'Persian font', labelFa:'فونت فارسی', control:'select', options:[{value:'Vazirmatn',label:'Vazirmatn'},{value:'IRANSans',label:'IRANSans (if available)'},{value:'Tahoma',label:'Tahoma'}], keywords:['font','فارسی'], disabled:true, soon:true },

  { id:'notif.enabled', section:'notifications', label:'Notifications', labelFa:'اعلان‌ها', control:'toggle', keywords:['notification'] },
  { id:'notif.position', section:'notifications', label:'Toast position', labelFa:'موقعیت Toast', control:'select', options:[{value:'top-right',label:'Top right'},{value:'top-left',label:'Top left'},{value:'bottom-right',label:'Bottom right'},{value:'bottom-left',label:'Bottom left'}], keywords:['position','toast'] },
  { id:'notif.duration', section:'notifications', label:'Duration', labelFa:'مدت نمایش', control:'slider', min:2, max:10, step:1, unit:'s', keywords:['duration'] },
  { id:'notif.dnd', section:'notifications', label:'Do Not Disturb', labelFa:'مزاحم نشوید', control:'toggle', keywords:['dnd','مزاحم'] },

  { id:'finder.defaultView', section:'finder', label:'Default view', labelFa:'نمای پیش‌فرض', control:'select', options:[{value:'icons',label:'Icons'},{value:'list',label:'List'},{value:'columns',label:'Columns'},{value:'gallery',label:'Gallery'}], keywords:['view','finder'] },
  { id:'finder.showHidden', section:'finder', label:'Show hidden files', labelFa:'نمایش فایل‌های مخفی', control:'toggle', keywords:['hidden'] },
  { id:'finder.showExtensions', section:'finder', label:'Show extensions', labelFa:'نمایش پسوندها', control:'toggle', keywords:['extension'] },
  { id:'finder.tabBehavior', section:'finder', label:'Tab behavior', labelFa:'رفتار تب‌ها', control:'select', options:[{value:'new',label:'New tab'},{value:'same',label:'Same tab'}], keywords:['tab'], disabled:true, soon:true },
  { id:'finder.iconSize', section:'finder', label:'Default icon size', labelFa:'اندازه پیش‌فرض آیکن', control:'segmented', options:[{value:'sm',label:'Small'},{value:'md',label:'Medium'},{value:'lg',label:'Large'}], keywords:['icon','size'] },

  { id:'a11y.highContrast', section:'accessibility', label:'High contrast', labelFa:'کنتراست بالا', control:'toggle', keywords:['contrast','کنتراست'] },
  { id:'a11y.largeText', section:'accessibility', label:'Larger text', labelFa:'متن بزرگ‌تر', control:'toggle', keywords:['text','متن'] },
  { id:'a11y.reduceTransparency', section:'accessibility', label:'Reduce transparency', labelFa:'کاهش شفافیت', control:'toggle', keywords:['transparency'] },
  { id:'a11y.focusRing', section:'accessibility', label:'Focus ring', labelFa:'حلقه فوکوس', control:'toggle', keywords:['focus'] },
  { id:'a11y.keyboard', section:'accessibility', label:'Keyboard navigation', labelFa:'ناوبری کیبورد', control:'toggle', keywords:['keyboard','کیبورد'], disabled:true, soon:true },

  { id:'terminal.font', section:'terminal', label:'Terminal font', labelFa:'فونت ترمینال', control:'select', options:[{value:'JetBrains Mono',label:'JetBrains Mono'},{value:'Fira Code',label:'Fira Code'},{value:'Consolas',label:'Consolas'}], keywords:['terminal','font'] },
  { id:'terminal.fontSize', section:'terminal', label:'Terminal font size', labelFa:'اندازه فونت ترمینال', control:'slider', min:10,max:20,step:1,unit:'px', keywords:['terminal','size'] },
  { id:'terminal.cursor', section:'terminal', label:'Cursor shape', labelFa:'شکل کرسر', control:'segmented', options:[{value:'block',label:'Block'},{value:'bar',label:'Bar'},{value:'underline',label:'Underline'}], keywords:['cursor'] },

  { id:'privacy.export', section:'privacy', label:'Export settings', labelFa:'خروجی تنظیمات', desc:'Download all settings as JSON', control:'button', action:'export', keywords:['export','خروجی'] },
  { id:'privacy.import', section:'privacy', label:'Import settings', labelFa:'ورود تنظیمات', desc:'Restore from JSON file', control:'button', action:'import', keywords:['import','ورود'] },
  { id:'privacy.reset', section:'privacy', label:'Reset to defaults', labelFa:'بازنشانی به پیش‌فرض', desc:'Restore all defaults (with confirmation)', control:'button', action:'reset', keywords:['reset','بازنشانی'] },
  { id:'privacy.clear', section:'privacy', label:'Clear app data', labelFa:'پاک‌سازی داده‌ها', desc:'Clear local data with confirmation', control:'button', action:'clear', keywords:['clear','پاکسازی'] },
];

export const APPEARANCE_PROFILES = profiles;
export const ACCENT_PRESETS = ['#007aff','#34c759','#ff9500','#ff3b30','#af52de','#ff2d55','#5856d6','#00c7be'];
