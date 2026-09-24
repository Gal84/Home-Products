import type { ApartmentProfile, BudgetTier, Category, HomeData, Item } from '../types';
import { uid } from '../lib/id';
import { buildTemplates } from './templates';

export const TIER_FACTOR: Record<BudgetTier, number> = { saver: 0.7, mid: 1, premium: 1.6 };

const roundPrice = (n: number) => (n >= 1000 ? Math.round(n / 50) * 50 : Math.round(n / 10) * 10);

/**
 * Adds the planner's categories and items for `profile` to `data`.
 * Categories are matched by template key and items by `${categoryKey}:${itemKey}`, so re-running
 * the planner only adds what is missing and never touches prices or ✓ the user already set.
 */
export function applyPlan(data: HomeData, profile: ApartmentProfile, mode: 'merge' | 'replace'): HomeData {
  const now = Date.now();
  const factor = TIER_FACTOR[profile.tier];
  const tombstone = <T extends { updatedAt: number; deleted?: boolean }>(x: T): T => ({ ...x, deleted: true, updatedAt: now });

  let categories: Category[] = mode === 'replace' ? data.categories.map(tombstone) : [...data.categories];
  let items: Item[] = mode === 'replace' ? data.items.map(tombstone) : [...data.items];

  const liveCats = categories.filter((c) => !c.deleted);
  const liveItemKeys = new Set(items.filter((i) => !i.deleted && i.key).map((i) => i.key));
  let order = liveCats.reduce((m, c) => Math.max(m, c.order), -1) + 1;

  for (const tpl of buildTemplates(profile)) {
    let cat = liveCats.find((c) => c.key === tpl.key);
    if (cat && !cat.note && tpl.note) {
      // Fill in details the planner learned since (room size, ממ״ד) without overwriting the user's text.
      const withNote: Category = { ...cat, note: tpl.note, updatedAt: now };
      categories = categories.map((c) => (c.id === withNote.id ? withNote : c));
      cat = withNote;
    }
    if (!cat) {
      cat = { id: uid(), key: tpl.key, name: tpl.name, note: tpl.note, color: tpl.color, order: order++, updatedAt: now };
      categories = [...categories, cat];
    }
    for (const it of tpl.items) {
      const key = `${tpl.key}:${it.k}`;
      if (liveItemKeys.has(key) || (it.q ?? 1) <= 0) continue;
      items.push({
        id: uid(),
        categoryId: cat.id,
        key,
        name: it.n,
        qty: it.q ?? 1,
        unitPrice: roundPrice(it.p * factor),
        priority: it.pr ?? 'important',
        purchased: false,
        notes: it.note,
        createdAt: now,
        updatedAt: now,
      });
    }
  }

  return { ...data, profile, categories, items, updatedAt: now };
}
