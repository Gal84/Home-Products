import { useSyncExternalStore } from 'react';
import { RU, RU_PATTERNS } from './ru';

/*
 * Two-language UI. Hebrew is the source: every string is written in Hebrew in the code and `t()`
 * looks it up in the Russian dictionary when Russian is on. Stored data stays as it was written;
 * `tr()` translates planner-generated names and notes at display time, so switching back and forth
 * never rewrites anyone's list.
 */

export type Lang = 'he' | 'ru';
type Params = Record<string, string | number>;
export type Entry = string | ((p: Params) => string);

const KEY = 'hp-lang';

function initial(): Lang {
  try {
    const q = new URLSearchParams(window.location.search).get('lang');
    if (q === 'ru' || q === 'he') return q;
    const saved = localStorage.getItem(KEY);
    if (saved === 'ru' || saved === 'he') return saved;
  } catch {
    /* storage blocked: fall back to Hebrew */
  }
  return 'he';
}

let lang: Lang = initial();
const listeners = new Set<() => void>();

function apply() {
  const root = document.documentElement;
  root.lang = lang;
  root.dir = lang === 'ru' ? 'ltr' : 'rtl';
  document.title = t('N°01 · קטלוג הדירה');
}

export const getLang = () => lang;

export function setLang(next: Lang) {
  if (next === lang) return;
  lang = next;
  try {
    localStorage.setItem(KEY, next);
  } catch {
    /* not remembered on this device */
  }
  apply();
  listeners.forEach((f) => f());
}

export function useLang(): Lang {
  return useSyncExternalStore(
    (f) => {
      listeners.add(f);
      return () => listeners.delete(f);
    },
    getLang,
  );
}

const fill = (s: string, p?: Params) => (p ? s.replace(/\{(\w+)\}/g, (m, k: string) => (k in p ? String(p[k]) : m)) : s);

/** UI text: `t('נרכש {n}', { n })`. Unknown strings fall back to Hebrew. */
export function t(he: string, p?: Params): string {
  if (lang === 'he') return fill(he, p);
  const e = RU[he];
  if (e === undefined) {
    if (import.meta.env.DEV) console.warn('[i18n] missing ru:', he);
    return fill(he, p);
  }
  return typeof e === 'function' ? e(p ?? {}) : fill(e, p);
}

// Longest first, so "floor {n} — …" wins over the bare "floor {n}".
const patterns = [...RU_PATTERNS]
  .sort((a, b) => b[0].length - a[0].length)
  .map(([he, ru]) => {
    const names: string[] = [];
    const src = he
      .split(/(\{\w+\})/)
      .map((part) => {
        const m = /^\{(\w+)\}$/.exec(part);
        if (m) {
          names.push(m[1]);
          return '(.+?)';
        }
        return part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      })
      .join('');
    return { re: new RegExp(`^${src}$`), names, ru };
  });

function trOne(s: string): string {
  const e = RU[s];
  if (typeof e === 'string') return e;
  for (const { re, names, ru } of patterns) {
    const m = re.exec(s);
    if (!m) continue;
    const p: Params = {};
    names.forEach((n, i) => (p[n] = trOne(m[i + 1])));
    return typeof ru === 'function' ? ru(p) : fill(ru, p);
  }
  return s;
}

/**
 * Data text (category and item names, notes) written by the planner in Hebrew. Text the user typed
 * themselves has no translation and is shown as written.
 */
export function tr(s: string): string;
export function tr(s: string | undefined): string | undefined;
export function tr(s: string | undefined): string | undefined {
  if (!s || lang === 'he') return s;
  return s.split(' · ').map(trOne).join(' · ');
}

export { plural } from './plural';

// Last, once every helper above exists.
apply();
