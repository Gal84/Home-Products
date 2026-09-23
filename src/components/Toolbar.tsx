import type { Category, Priority } from '../types';
import { PRIORITY_LABEL } from '../lib/format';
import { IconPlus, IconSearch } from './Icons';

export type SortKey = 'default' | 'name' | 'price-desc' | 'price-asc' | 'priority' | 'status';

export interface Filters {
  q: string;
  status: 'all' | 'left' | 'bought';
  priority: 'all' | Priority;
  category: 'all' | string;
  sort: SortKey;
}

export const NO_FILTERS: Filters = { q: '', status: 'all', priority: 'all', category: 'all', sort: 'default' };

export const isFiltering = (f: Filters) =>
  f.q.trim() !== '' || f.status !== 'all' || f.priority !== 'all' || f.category !== 'all';

const SORT_LABEL: Record<SortKey, string> = {
  default: 'סדר מקורי',
  name: 'לפי שם',
  'price-desc': 'מחיר: מהיקר',
  'price-asc': 'מחיר: מהזול',
  priority: 'לפי עדיפות',
  status: 'לא נרכש קודם',
};

interface Props {
  filters: Filters;
  onChange: (f: Filters) => void;
  categories: Category[];
  onAddCategory: () => void;
  onAddItem: () => void;
  summary: string | null;
}

export function Toolbar({ filters, onChange, categories, onAddCategory, onAddItem, summary }: Props) {
  const set = <K extends keyof Filters>(k: K, v: Filters[K]) => onChange({ ...filters, [k]: v });
  return (
    <div className="toolbar">
      <label className="search">
        <IconSearch />
        <span className="sr-only">חיפוש</span>
        <input className="input" type="search" placeholder="חיפוש מוצר או חנות…" value={filters.q} onChange={(e) => set('q', e.target.value)} />
      </label>
      <div className="seg" role="group" aria-label="סטטוס">
        {(
          [
            ['all', 'הכל'],
            ['left', 'נותר לקנות'],
            ['bought', 'נרכש ✓'],
          ] as const
        ).map(([k, label]) => (
          <button key={k} aria-pressed={filters.status === k} onClick={() => set('status', k)}>
            {label}
          </button>
        ))}
      </div>
      <select className="select" aria-label="קטגוריה" value={filters.category} onChange={(e) => set('category', e.target.value)}>
        <option value="all">כל הקטגוריות</option>
        {categories.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
      <select className="select" aria-label="עדיפות" value={filters.priority} onChange={(e) => set('priority', e.target.value as Filters['priority'])}>
        <option value="all">כל העדיפויות</option>
        {(Object.keys(PRIORITY_LABEL) as Priority[]).map((p) => (
          <option key={p} value={p}>
            {PRIORITY_LABEL[p]}
          </option>
        ))}
      </select>
      <select className="select" aria-label="מיון" value={filters.sort} onChange={(e) => set('sort', e.target.value as SortKey)}>
        {(Object.keys(SORT_LABEL) as SortKey[]).map((k) => (
          <option key={k} value={k}>
            {SORT_LABEL[k]}
          </option>
        ))}
      </select>
      <span className="spacer" />
      <div className="tb-actions">
        <button className="btn" onClick={onAddCategory}>
          <IconPlus width={16} height={16} /> קטגוריה
        </button>
        <button className="btn primary" onClick={onAddItem}>
          <IconPlus width={16} height={16} /> מוצר
        </button>
      </div>
      {summary && (
        <div className="filter-note">
          {summary}
          <button onClick={() => onChange({ ...NO_FILTERS, sort: filters.sort })}>ניקוי סינון</button>
        </div>
      )}
    </div>
  );
}
