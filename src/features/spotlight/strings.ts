export const strings = {
  fa: {
    placeholder: 'جستجو در اپ‌ها، فایل‌ها، تنظیمات، محاسبه...',
    empty: 'برای شروع جستجو کنید',
    noResults: 'نتیجه‌ای یافت نشد',
    topResult: 'نتیجه برتر',
    webSearch: 'جستجو در وب:',
    apps: 'اپ‌ها',
    files: 'فایل‌ها',
    settings: 'تنظیمات',
    calculator: 'ماشین‌حساب',
    units: 'تبدیل واحد',
    commands: 'دستورات',
    web: 'وب',
    preview: 'پیش‌نمایش',
    copy: 'کپی',
    open: 'باز کردن',
    showInFinder: 'نمایش در Finder',
    quickLook: 'پیش‌نمایش سریع',
  },
  en: {
    placeholder: 'Search apps, files, settings, calculate...',
    empty: 'Start typing to search',
    noResults: 'No results found',
    topResult: 'Top result',
    webSearch: 'Search web:',
    apps: 'Apps',
    files: 'Files',
    settings: 'Settings',
    calculator: 'Calculator',
    units: 'Convert',
    commands: 'Commands',
    web: 'Web',
    preview: 'Preview',
    copy: 'Copy',
    open: 'Open',
    showInFinder: 'Show in Finder',
    quickLook: 'Quick Look',
  },
};

export function getLang(): 'fa' | 'en' {
  try {
    if (typeof document !== 'undefined') {
      const lang = document.documentElement.lang || '';
      if (lang.startsWith('fa')) return 'fa';
    }
  } catch {}
  return 'en';
}

export function t() {
  return strings[getLang()];
}
