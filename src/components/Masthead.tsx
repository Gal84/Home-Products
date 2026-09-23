import { useState } from 'react';
import type { Category, HomeData, Item } from '../types';
import { catNo, num, shekel, totals, type Totals } from '../lib/format';
import type { SyncStatus } from '../lib/useHome';
import { IconPlan, IconSettings, IconShare } from './Icons';

const SYNC_LABEL: Record<SyncStatus, string> = {
  loading: 'טוען…',
  synced: 'מסונכרן',
  saving: 'שומר…',
  offline: 'לא מחובר — נשמר במכשיר',
  error: 'שגיאת סנכרון — מנסה שוב',
  notfound: 'לא נמצא',
};

interface Props {
  data: HomeData;
  cats: Category[];
  items: Item[];
  status: SyncStatus;
  onRename: (name: string) => void;
  onPlanner: () => void;
  onSettings: () => void;
  onShare: () => void;
}

export function Masthead({ data, cats, items, status, onRename, onPlanner, onSettings, onShare }: Props) {
  const [editing, setEditing] = useState(false);
  const p = data.profile;
  const t = totals(items);
  const perCat = cats.map((c) => ({ c, t: totals(items.filter((i) => i.categoryId === c.id)) }));
  const maxCat = Math.max(1, ...perCat.map((x) => x.t.total));
  const mustLeft = items.filter((i) => i.priority === 'must' && !i.purchased).length;

  const specs = [
    `${p.rooms} חדרים`,
    p.toilets && `${p.toilets} שירותים`,
    p.showers && `${p.showers > 1 ? `${p.showers} חדרי ` : ''}מקלחת`,
    p.bathtubs && `${p.bathtubs > 1 ? `${p.bathtubs} חדרי ` : ''}אמבטיה`,
    p.balconyArea && `מרפסת ${p.balconyArea} מ״ר`,
    p.kitchenIsland && `אי ${p.kitchenIsland.length}×${p.kitchenIsland.depth}`,
    p.storageArea && `מחסן ${p.storageArea} מ״ר`,
    p.parking && `${p.parking === 1 ? 'חניה' : `${p.parking} חניות`}${p.parkingCovered ? (p.parking === 1 ? ' מקורה' : ' מקורות') : ''}`,
    p.acType === 'central' && 'מיני-מרכזי',
    p.cats && `${p.cats === 1 ? 'חתול' : `${p.cats} חתולים`}`,
    p.dogs && `${p.dogs === 1 ? 'כלב' : `${p.dogs} כלבים`}`,
  ].filter(Boolean) as string[];

  return (
    <>
      <header className="topline">
        <div className="brand">
          <b>N°01</b>
          <span className="eyebrow">קטלוג רכישות · דירה חדשה</span>
        </div>
        <div className="actions">
          <span className="sync" data-s={status} role="status">
            <i />
            {SYNC_LABEL[status]}
          </span>
          <button className="icon-btn" onClick={onShare} aria-label="שיתוף" title="שיתוף">
            <IconShare />
          </button>
          <button className="icon-btn" onClick={onPlanner} aria-label="מתכנן הדירה" title="מתכנן הדירה">
            <IconPlan />
          </button>
          <button className="icon-btn" onClick={onSettings} aria-label="הגדרות" title="הגדרות">
            <IconSettings />
          </button>
        </div>
      </header>

      <section className="masthead">
        <div>
          <div className="eyebrow">גיליון רכישות · {new Date().getFullYear()}</div>
          <h1 onClick={() => setEditing(true)} title="לחצו לשינוי השם">
            {editing ? (
              <input
                autoFocus
                defaultValue={p.name}
                aria-label="שם הדירה"
                onBlur={(e) => {
                  setEditing(false);
                  const v = e.target.value.trim();
                  if (v && v !== p.name) onRename(v);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                  if (e.key === 'Escape') setEditing(false);
                }}
              />
            ) : (
              p.name
            )}
          </h1>
          <div className="specs">
            {specs.map((s) => (
              <span key={s}>{s}</span>
            ))}
          </div>
          <p className="lede">
            {t.count === 0
              ? 'הרשימה ריקה. הוסיפו קטגוריה או הפעילו את מתכנן הדירה.'
              : `נרכשו ${num(t.boughtCount)} מתוך ${num(t.count)} מוצרים ב-${cats.length} קטגוריות. ${
                  mustLeft ? `נשארו ${num(mustLeft)} פריטי חובה לקנות.` : 'כל פריטי החובה נקנו.'
                }`}
          </p>
        </div>

        <Ledger t={t} budget={data.budget} />
      </section>

      {perCat.length > 0 && (
        <nav className="contents" aria-label="תוכן העניינים">
          <div className="contents-head">
            <h2>תוכן העניינים</h2>
            <span className="eyebrow">{perCat.length} קטגוריות</span>
          </div>
          <ol className="toc">
            {perCat.map(({ c, t: ct }, i) => (
              <li key={c.id} className={ct.count > 0 && ct.boughtCount === ct.count ? 'done' : undefined}>
                <a href={`#cat-${c.id}`}>
                  <span className="t-no">{catNo(i)}</span>
                  <span className="t-name">{c.name}</span>
                  <span className="t-share">
                    <i style={{ width: `${(ct.total / maxCat) * 100}%`, background: c.color }} />
                  </span>
                  <span className="t-sum num">{shekel(ct.total)}</span>
                </a>
              </li>
            ))}
          </ol>
        </nav>
      )}
    </>
  );
}

function Ledger({ t, budget }: { t: Totals; budget: number | null }) {
  const scale = Math.max(t.total, budget ?? 0, 1);
  const pct = t.total ? Math.round((t.bought / t.total) * 100) : 0;
  return (
    <div className="ledger">
      <div className="grand">
        <span className="eyebrow">סה״כ כולל</span>
        <span className="num">{shekel(t.total)}</span>
      </div>
      <div className="split">
        <div className="bought">
          <span className="eyebrow">נרכש · {pct}%</span>
          <span className="num">{shekel(t.bought)}</span>
        </div>
        <div>
          <span className="eyebrow">נותר לרכישה</span>
          <span className="num">{shekel(t.left)}</span>
        </div>
      </div>
      <div className="bar" aria-hidden>
        <i style={{ width: `${(t.total / scale) * 100}%`, background: 'var(--rule)' }} />
        <i style={{ width: `${(t.bought / scale) * 100}%` }} />
        {budget ? <b style={{ insetInlineStart: `calc(${(budget / scale) * 100}% - 1px)` }} /> : null}
      </div>
      {budget ? (
        <div className="budget">
          <span>
            תקציב <span className="num">{shekel(budget)}</span>
          </span>
          {t.total > budget ? (
            <span className="over">
              חריגה של <span className="num">{shekel(t.total - budget)}</span>
            </span>
          ) : (
            <span>
              מרווח <span className="num">{shekel(budget - t.total)}</span>
            </span>
          )}
        </div>
      ) : null}
    </div>
  );
}
