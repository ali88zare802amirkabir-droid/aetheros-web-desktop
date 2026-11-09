export type IconName = 'search' | 'app' | 'file' | 'folder' | 'settings' | 'calc' | 'command' | 'web' | 'arrow' | 'clock';

export function icon(name: IconName, size = 16): string {
  const stroke = 'currentColor';
  switch (name) {
    case 'search':
      return `<svg width="${size}" height="${size}" viewBox="0 0 16 16" fill="none" stroke="${stroke}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="7" cy="7" r="4.5"/><path d="m10.5 10.5 3 3"/></svg>`;
    case 'app':
      return `<svg width="${size}" height="${size}" viewBox="0 0 16 16" fill="none" stroke="${stroke}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="2.5" width="4.5" height="4.5" rx="1"/><rect x="9" y="2.5" width="4.5" height="4.5" rx="1"/><rect x="2.5" y="9" width="4.5" height="4.5" rx="1"/><rect x="9" y="9" width="4.5" height="4.5" rx="1"/></svg>`;
    case 'file':
      return `<svg width="${size}" height="${size}" viewBox="0 0 16 16" fill="none" stroke="${stroke}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 2.5h5l4 4v7a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-10a1 1 0 0 1 1-1z"/><path d="M9 2.5v4h4"/></svg>`;
    case 'folder':
      return `<svg width="${size}" height="${size}" viewBox="0 0 16 16" fill="none" stroke="${stroke}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 5.5V4a1 1 0 0 1 1-1h3.5l1.5 1.5h5a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1h-10a1 1 0 0 1-1-1v-6.5z"/></svg>`;
    case 'settings':
      return `<svg width="${size}" height="${size}" viewBox="0 0 16 16" fill="none" stroke="${stroke}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="8" r="2"/><path d="M8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2M3.4 3.4l1.4 1.4M11.2 11.2l1.4 1.4M12.6 3.4l-1.4 1.4M4.8 11.2l-1.4 1.4"/></svg>`;
    case 'calc':
      return `<svg width="${size}" height="${size}" viewBox="0 0 16 16" fill="none" stroke="${stroke}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="2.5" width="10" height="11" rx="1.5"/><path d="M5 5.5h6M5 8h2M9 8h2M5 10.5h2M9 10.5h2"/></svg>`;
    case 'command':
      return `<svg width="${size}" height="${size}" viewBox="0 0 16 16" fill="none" stroke="${stroke}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 5v1.5a1 1 0 0 1-1 1H2.5M5 11v-1.5a1 1 0 0 0-1-1H2.5M11 5v1.5a1 1 0 0 0 1 1h1.5M11 11v-1.5a1 1 0 0 1 1-1h1.5M6 8h4"/></svg>`;
    case 'web':
      return `<svg width="${size}" height="${size}" viewBox="0 0 16 16" fill="none" stroke="${stroke}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="8" r="5.5"/><path d="M2.5 8h11M8 2.5c2 2 2 9 0 11M8 2.5c-2 2-2 9 0 11"/></svg>`;
    case 'arrow':
      return `<svg width="${size}" height="${size}" viewBox="0 0 16 16" fill="none" stroke="${stroke}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="m6 4 4 4-4 4"/></svg>`;
    case 'clock':
      return `<svg width="${size}" height="${size}" viewBox="0 0 16 16" fill="none" stroke="${stroke}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="8" r="5.5"/><path d="M8 5v3l2 1"/></svg>`;
    default:
      return '';
  }
}
