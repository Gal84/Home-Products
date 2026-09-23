import type { Item, Priority } from '../types';

const nf = new Intl.NumberFormat('he-IL', { maximumFractionDigits: 0 });

export const shekel = (n: number) => `₪${nf.format(Math.round(n))}`;
export const num = (n: number) => nf.format(n);
export const catNo = (i: number) => `N°${String(i + 1).padStart(2, '0')}`;

export const PRIORITY_LABEL: Record<Priority, string> = {
  must: 'חובה',
  important: 'חשוב',
  later: 'אפשר לחכות',
};
export const PRIORITY_RANK: Record<Priority, number> = { must: 0, important: 1, later: 2 };

/** What a line costs: the price actually paid when recorded, otherwise qty × unit price. */
export function lineTotal(item: Item): number {
  if (item.actualPrice != null && item.actualPrice >= 0) return item.actualPrice;
  return item.qty * item.unitPrice;
}

export interface Totals {
  total: number;
  bought: number;
  left: number;
  count: number;
  boughtCount: number;
}

export function totals(items: Item[]): Totals {
  const t: Totals = { total: 0, bought: 0, left: 0, count: 0, boughtCount: 0 };
  for (const it of items) {
    const v = lineTotal(it);
    t.total += v;
    t.count++;
    if (it.purchased) {
      t.bought += v;
      t.boughtCount++;
    } else t.left += v;
  }
  return t;
}
