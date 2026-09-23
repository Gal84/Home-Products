import type { Category, HomeData, Item } from '../types';
import { uid } from './id';
import { DEFAULT_PROFILE } from '../planner/templates';

export const live = <T extends { deleted?: boolean }>(xs: T[]) => xs.filter((x) => !x.deleted);

export function emptyHome(): HomeData {
  return { schema: 1, profile: DEFAULT_PROFILE, budget: null, categories: [], items: [], updatedAt: Date.now() };
}

export function sortedCategories(d: HomeData): Category[] {
  return live(d.categories).sort((a, b) => a.order - b.order);
}

const touch = <T extends { updatedAt: number }>(x: T, patch: Partial<T>): T => ({ ...x, ...patch, updatedAt: Date.now() });

export type NewItem = Omit<Item, 'id' | 'createdAt' | 'updatedAt'>;

export const ops = {
  addCategory(d: HomeData, c: Pick<Category, 'name' | 'note' | 'color'>): HomeData {
    const order = live(d.categories).reduce((m, x) => Math.max(m, x.order), -1) + 1;
    return { ...d, categories: [...d.categories, { ...c, id: uid(), order, updatedAt: Date.now() }] };
  },

  updateCategory(d: HomeData, id: string, patch: Partial<Category>): HomeData {
    return { ...d, categories: d.categories.map((c) => (c.id === id ? touch(c, patch) : c)) };
  },

  /** Deletes the category and every item in it. */
  deleteCategory(d: HomeData, id: string): HomeData {
    return {
      ...d,
      categories: d.categories.map((c) => (c.id === id ? touch(c, { deleted: true }) : c)),
      items: d.items.map((i) => (i.categoryId === id && !i.deleted ? touch(i, { deleted: true }) : i)),
    };
  },

  moveCategory(d: HomeData, id: string, dir: -1 | 1): HomeData {
    const cats = sortedCategories(d);
    const i = cats.findIndex((c) => c.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= cats.length) return d;
    const a = cats[i];
    const b = cats[j];
    return {
      ...d,
      categories: d.categories.map((c) =>
        c.id === a.id ? touch(c, { order: b.order }) : c.id === b.id ? touch(c, { order: a.order }) : c,
      ),
    };
  },

  addItem(d: HomeData, item: NewItem): HomeData {
    const now = Date.now();
    return { ...d, items: [...d.items, { ...item, id: uid(), createdAt: now, updatedAt: now }] };
  },

  updateItem(d: HomeData, id: string, patch: Partial<Item>): HomeData {
    return { ...d, items: d.items.map((i) => (i.id === id ? touch(i, patch) : i)) };
  },

  deleteItem(d: HomeData, id: string): HomeData {
    return ops.updateItem(d, id, { deleted: true });
  },

  duplicateItem(d: HomeData, id: string): HomeData {
    const src = d.items.find((i) => i.id === id);
    if (!src) return d;
    const { id: _id, createdAt: _c, updatedAt: _u, key: _k, ...rest } = src;
    return ops.addItem(d, { ...rest, name: `${src.name} (עותק)`, purchased: false, actualPrice: null });
  },

  setMeta(d: HomeData, patch: Partial<Pick<HomeData, 'budget' | 'profile'>>): HomeData {
    return { ...d, ...patch, updatedAt: Date.now() };
  },

  /** Replaces everything with an imported document; old rows become tombstones so other devices drop them too. */
  importAll(d: HomeData, incoming: HomeData): HomeData {
    const now = Date.now();
    const ids = new Set([...incoming.categories.map((c) => c.id), ...incoming.items.map((i) => i.id)]);
    return {
      schema: 1,
      profile: incoming.profile ?? d.profile,
      budget: incoming.budget ?? null,
      updatedAt: now,
      categories: [
        ...d.categories.filter((c) => !ids.has(c.id)).map((c) => ({ ...c, deleted: true, updatedAt: now })),
        ...incoming.categories.map((c) => ({ ...c, updatedAt: now })),
      ],
      items: [
        ...d.items.filter((i) => !ids.has(i.id)).map((i) => ({ ...i, deleted: true, updatedAt: now })),
        ...incoming.items.map((i) => ({ ...i, updatedAt: now })),
      ],
    };
  },
};

export function isHomeData(x: unknown): x is HomeData {
  const d = x as HomeData;
  return !!d && Array.isArray(d.categories) && Array.isArray(d.items) && typeof d.profile === 'object';
}
