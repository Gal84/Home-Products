import type { HomeData } from '../types';

function mergeById<T extends { id: string; updatedAt: number }>(a: T[], b: T[]): T[] {
  const byId = new Map<string, T>();
  for (const x of a) byId.set(x.id, x);
  for (const y of b) {
    const x = byId.get(y.id);
    if (!x || y.updatedAt > x.updatedAt) byId.set(y.id, y);
  }
  return [...byId.values()];
}

/** Last-writer-wins per category / item (deletions are tombstones), and per document for profile/budget. */
export function mergeHome(local: HomeData, remote: HomeData): HomeData {
  const meta = remote.updatedAt > local.updatedAt ? remote : local;
  return {
    schema: 1,
    profile: meta.profile,
    budget: meta.budget,
    updatedAt: meta.updatedAt,
    categories: mergeById(local.categories, remote.categories),
    items: mergeById(local.items, remote.items),
  };
}
