import type { HomeData } from '../types';

// Browser storage can be unavailable (private mode, blocked site data); every access is guarded.
function get(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function set(key: string, value: string | null) {
  try {
    if (value == null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
}

export const savedCode = {
  get: () => get('hp:code'),
  set: (code: string | null) => set('hp:code', code),
};

export interface CachedHome {
  data: HomeData;
  version: number;
  dirty: boolean;
}

export const homeCache = {
  get(code: string): CachedHome | null {
    const raw = get(`hp:cache:${code}`);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as CachedHome;
    } catch {
      return null;
    }
  },
  set(code: string, value: CachedHome | null) {
    set(`hp:cache:${code}`, value ? JSON.stringify(value) : null);
  },
};

export type ThemePref = 'auto' | 'light' | 'dark';
export const themePref = {
  get: (): ThemePref => (get('hp:theme') as ThemePref) || 'auto',
  set: (t: ThemePref) => set('hp:theme', t),
};

export const uiPref = {
  collapsed(): string[] {
    try {
      return JSON.parse(get('hp:collapsed') || '[]');
    } catch {
      return [];
    }
  },
  setCollapsed(ids: string[]) {
    set('hp:collapsed', JSON.stringify(ids));
  },
};
