import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Category, Item } from './types';
import { Gate } from './components/Gate';
import { Masthead } from './components/Masthead';
import { isFiltering, NO_FILTERS, Toolbar, type Filters } from './components/Toolbar';
import { CategorySection } from './components/CategorySection';
import { ItemEditor } from './components/ItemEditor';
import { CategoryEditor } from './components/CategoryEditor';
import { PlannerWizard } from './components/PlannerWizard';
import { Settings } from './components/Settings';
import { IconPlus } from './components/Icons';
import { applyPlan } from './planner/generate';
import { lineTotal, PRIORITY_RANK, shekel, totals } from './lib/format';
import { normalizeCode } from './lib/id';
import { live, ops, sortedCategories } from './lib/store';
import { homeCache, savedCode, themePref, uiPref, type ThemePref } from './lib/storage';
import { useHome } from './lib/useHome';

function codeFromUrl(): string | null {
  const url = new URL(window.location.href);
  const c = url.searchParams.get('code');
  if (!c) return null;
  url.searchParams.delete('code');
  window.history.replaceState(null, '', url.pathname + url.search + url.hash);
  return normalizeCode(c);
}

export default function App() {
  const [code, setCode] = useState<string | null>(() => {
    const fromUrl = codeFromUrl();
    if (fromUrl) savedCode.set(fromUrl);
    return fromUrl ?? savedCode.get();
  });
  const [notice, setNotice] = useState<string | null>(null);
  const [theme, setTheme] = useState<ThemePref>(themePref.get());

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'auto') delete root.dataset.theme;
    else root.dataset.theme = theme;
    themePref.set(theme);
  }, [theme]);

  const enter = (c: string) => {
    savedCode.set(c);
    setNotice(null);
    setCode(c);
  };
  const leave = (msg?: string) => {
    if (code) homeCache.set(code, null);
    savedCode.set(null);
    setNotice(msg ?? null);
    setCode(null);
  };

  if (!code) return <Gate onEnter={enter} notice={notice} />;
  return <HomeView key={code} code={code} theme={theme} onTheme={setTheme} onLeave={leave} />;
}

type ItemDraft = { item: Item | null; categoryId: string };

function HomeView({
  code,
  theme,
  onTheme,
  onLeave,
}: {
  code: string;
  theme: ThemePref;
  onTheme: (t: ThemePref) => void;
  onLeave: (msg?: string) => void;
}) {
  const { data, status, update } = useHome(code);
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const [collapsed, setCollapsed] = useState<string[]>(uiPref.collapsed());
  const [itemDraft, setItemDraft] = useState<ItemDraft | null>(null);
  const [catDraft, setCatDraft] = useState<{ category: Category | null } | null>(null);
  const [planner, setPlanner] = useState(false);
  const [settings, setSettings] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'notfound') onLeave('הדירה לא נמצאה בשרת. אולי הקוד השתנה?');
  }, [status, onLeave]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2400);
    return () => clearTimeout(t);
  }, [toast]);

  const cats = useMemo(() => (data ? sortedCategories(data) : []), [data]);
  const items = useMemo(() => {
    if (!data) return [];
    const liveCats = new Set(cats.map((c) => c.id));
    return live(data.items).filter((i) => liveCats.has(i.categoryId));
  }, [data, cats]);

  const filtering = isFiltering(filters);
  const shownByCat = useMemo(() => {
    const q = filters.q.trim().toLowerCase();
    const match = (i: Item) =>
      (filters.status === 'all' || (filters.status === 'bought') === i.purchased) &&
      (filters.priority === 'all' || i.priority === filters.priority) &&
      (!q || [i.name, i.store, i.notes].some((s) => s?.toLowerCase().includes(q)));
    const sorters: Record<Filters['sort'], (a: Item, b: Item) => number> = {
      default: (a, b) => a.createdAt - b.createdAt,
      name: (a, b) => a.name.localeCompare(b.name, 'he'),
      'price-desc': (a, b) => lineTotal(b) - lineTotal(a),
      'price-asc': (a, b) => lineTotal(a) - lineTotal(b),
      priority: (a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority],
      status: (a, b) => Number(a.purchased) - Number(b.purchased),
    };
    const map = new Map<string, Item[]>();
    for (const c of cats) map.set(c.id, []);
    for (const i of items) if (match(i)) map.get(i.categoryId)?.push(i);
    for (const list of map.values()) list.sort((a, b) => sorters[filters.sort](a, b) || a.createdAt - b.createdAt);
    return map;
  }, [items, cats, filters]);

  const visibleCats = cats.filter(
    (c) => (filters.category === 'all' || filters.category === c.id) && (!filtering || filters.category === c.id || (shownByCat.get(c.id)?.length ?? 0) > 0),
  );

  const summary = useMemo(() => {
    if (!filtering) return null;
    const shown = visibleCats.flatMap((c) => shownByCat.get(c.id) ?? []);
    return `מוצגים ${shown.length} מוצרים · ${shekel(totals(shown).total)}`;
  }, [filtering, visibleCats, shownByCat]);

  const toggleCollapse = (id: string) =>
    setCollapsed((cur) => {
      const next = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id];
      uiPref.setCollapsed(next);
      return next;
    });

  const share = useCallback(async () => {
    const link = `${window.location.origin}${window.location.pathname}?code=${encodeURIComponent(code)}`;
    try {
      if (navigator.share && matchMedia('(pointer: coarse)').matches) {
        await navigator.share({ title: 'רשימת הקניות לדירה', text: 'הרשימה המשותפת שלנו לדירה החדשה', url: link });
        return;
      }
      await navigator.clipboard.writeText(link);
      setToast('קישור השיתוף הועתק');
    } catch {
      setToast(`קוד הדירה: ${code}`);
    }
  }, [code]);

  const addItem = (categoryId?: string) => {
    const target = categoryId ?? (filters.category !== 'all' ? filters.category : cats[0]?.id);
    if (!target) return setCatDraft({ category: null });
    setItemDraft({ item: null, categoryId: target });
  };

  if (!data) {
    return (
      <div className="page">
        <div className="empty-state">
          <div className="eyebrow">N°01</div>
          <h2>{status === 'loading' ? 'פותח את הקטלוג…' : 'אין חיבור לשרת'}</h2>
          {status !== 'loading' && (
            <button className="btn" onClick={() => onLeave()}>
              חזרה למסך הכניסה
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <Masthead
        data={data}
        cats={cats}
        items={items}
        status={status}
        onRename={(name) => update((d) => ops.setMeta(d, { profile: { ...d.profile, name } }))}
        onPlanner={() => setPlanner(true)}
        onSettings={() => setSettings(true)}
        onShare={share}
      />

      <Toolbar
        filters={filters}
        onChange={setFilters}
        categories={cats}
        onAddCategory={() => setCatDraft({ category: null })}
        onAddItem={() => addItem()}
        summary={summary}
      />

      {cats.length === 0 ? (
        <div className="empty-state">
          <h2>דף ריק</h2>
          <p>התחילו בקטגוריה ראשונה, או תנו למתכנן לבנות רשימה מלאה לפי מספר החדרים.</p>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button className="btn accent" onClick={() => setPlanner(true)}>
              מתכנן הדירה
            </button>
            <button className="btn" onClick={() => setCatDraft({ category: null })}>
              קטגוריה חדשה
            </button>
          </div>
        </div>
      ) : (
        visibleCats.map((c) => {
          const index = cats.indexOf(c);
          return (
            <CategorySection
              key={c.id}
              index={index}
              category={c}
              allItems={items.filter((i) => i.categoryId === c.id)}
              shown={shownByCat.get(c.id) ?? []}
              collapsed={collapsed.includes(c.id) && !filtering}
              filtering={filtering}
              isFirst={index === 0}
              isLast={index === cats.length - 1}
              onToggleCollapse={() => toggleCollapse(c.id)}
              onEdit={() => setCatDraft({ category: c })}
              onMove={(dir) => update((d) => ops.moveCategory(d, c.id, dir))}
              onAddItem={() => addItem(c.id)}
              onOpenItem={(item) => setItemDraft({ item, categoryId: item.categoryId })}
              onTogglePurchased={(item) => update((d) => ops.updateItem(d, item.id, { purchased: !item.purchased }))}
            />
          );
        })
      )}

      {filtering && visibleCats.length === 0 && cats.length > 0 && (
        <div className="empty-state">
          <h2>לא נמצא</h2>
          <p>אין מוצרים שמתאימים לחיפוש ולסינון.</p>
        </div>
      )}

      <footer className="colophon">
        <span className="eyebrow">N°01 · קטלוג הדירה</span>
        <span className="eyebrow">המחירים הם הערכה — עדכנו לפי הצעות מחיר</span>
      </footer>

      <button className="btn primary fab" onClick={() => addItem()}>
        <IconPlus width={16} height={16} /> מוצר
      </button>

      {itemDraft && (
        <ItemEditor
          key={itemDraft.item?.id ?? 'new'}
          item={itemDraft.item}
          categoryId={itemDraft.categoryId}
          categories={cats}
          onClose={() => setItemDraft(null)}
          onSave={(v) => {
            const existing = itemDraft.item;
            update((d) => (existing ? ops.updateItem(d, existing.id, v) : ops.addItem(d, v)));
            setItemDraft(null);
          }}
          onDelete={
            itemDraft.item
              ? () => {
                  const id = itemDraft.item!.id;
                  update((d) => ops.deleteItem(d, id));
                  setItemDraft(null);
                }
              : undefined
          }
          onDuplicate={
            itemDraft.item
              ? () => {
                  const id = itemDraft.item!.id;
                  update((d) => ops.duplicateItem(d, id));
                  setItemDraft(null);
                  setToast('המוצר שוכפל');
                }
              : undefined
          }
        />
      )}

      {catDraft && (
        <CategoryEditor
          category={catDraft.category}
          itemCount={catDraft.category ? items.filter((i) => i.categoryId === catDraft.category!.id).length : 0}
          onClose={() => setCatDraft(null)}
          onSave={(v) => {
            const existing = catDraft.category;
            update((d) => (existing ? ops.updateCategory(d, existing.id, v) : ops.addCategory(d, v)));
            setCatDraft(null);
          }}
          onDelete={
            catDraft.category
              ? () => {
                  const id = catDraft.category!.id;
                  update((d) => ops.deleteCategory(d, id));
                  setCatDraft(null);
                }
              : undefined
          }
        />
      )}

      {planner && (
        <PlannerWizard
          initial={data.profile}
          hasData={items.length > 0}
          onClose={() => setPlanner(false)}
          onApply={(profile, mode) => {
            const before = items.length;
            update((d) => applyPlan(d, profile, mode));
            setPlanner(false);
            if (mode === 'merge') setToast('הרשימה עודכנה');
            else setToast(`הרשימה נבנתה מחדש (${before} מוצרים הוסרו)`);
          }}
        />
      )}

      {settings && (
        <Settings
          data={data}
          code={code}
          theme={theme}
          onTheme={onTheme}
          onBudget={(budget) => update((d) => ops.setMeta(d, { budget }))}
          onImport={(incoming) => {
            update((d) => ops.importAll(d, incoming));
            setSettings(false);
            setToast('הגיבוי שוחזר');
          }}
          onShare={share}
          onLogout={() => onLeave()}
          onClose={() => setSettings(false)}
        />
      )}

      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </div>
  );
}
