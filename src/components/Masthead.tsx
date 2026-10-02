import { useState } from 'react';
import type { Category, HomeData, Item } from '../types';
import { bidi, catNo, num, shekel, totals, type Totals } from '../lib/format';
import type { SyncStatus } from '../lib/useHome';
import { IconPlan, IconSettings, IconShare } from './Icons';
import { LangSwitch } from './LangSwitch';
import { t, tr } from '../i18n';

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
  const tot = totals(items);
  const perCat = cats.map((c) => ({ c, t: totals(items.filter((i) => i.categoryId === c.id)) }));
  const maxCat = Math.max(1, ...perCat.map((x) => x.t.total));
  const mustLeft = items.filter((i) => i.priority === 'must' && !i.purchased && !i.excluded).length;

  const specs = [
    t('{n} חדרים', { n: p.rooms }),
    p.aptType === 'garden' && `${t('דירת גן')}${p.gardenArea ? ` · ${t('גינה {n} מ״ר', { n: p.gardenArea })}` : ''}`,
    p.aptType === 'penthouse' &&
      `${t('פנטהאוז')}${p.roofArea ? ` · ${t('גג {n} מ״ר', { n: p.roofArea })}` : ''}${p.duplex ? ` · ${t('דופלקס')}` : ''}`,
    p.aptType !== 'garden' && p.floor && t('קומה {n}', { n: p.floor }),
    p.toilets && t('{n} שירותים', { n: p.toilets }),
    p.showers && (p.showers > 1 ? t('{n} חדרי מקלחת', { n: p.showers }) : t('מקלחת')),
    p.bathtubs && (p.bathtubs > 1 ? t('{n} חדרי אמבטיה', { n: p.bathtubs }) : t('אמבטיה')),
    p.balconyArea && t('מרפסת {n} מ״ר', { n: p.balconyArea }),
    p.kitchenIsland && t('אי {a}×{b}', { a: p.kitchenIsland.length, b: p.kitchenIsland.depth }),
    p.storageArea && t('מחסן {n} מ״ר', { n: p.storageArea }),
    p.parking &&
      (p.parking === 1
        ? t(p.parkingCovered ? 'חניה מקורה' : 'חניה')
        : t(p.parkingCovered ? '{n} חניות מקורות' : '{n} חניות', { n: p.parking })),
    p.acType === 'central' && t('מיני-מרכזי'),
    p.cats && t('{n} חתולים', { n: p.cats }),
    p.dogs && t('{n} כלבים', { n: p.dogs }),
  ].filter(Boolean) as string[];

  return (
    <>
      <header className="topline">
        <div className="brand">
          <b>N°01</b>
          <span className="eyebrow">{t('קטלוג רכישות · דירה חדשה')}</span>
        </div>
        <div className="actions">
          <span className="sync" data-s={status} role="status" title={t(SYNC_LABEL[status])}>
            <i />
            <span className="sync-text">{t(SYNC_LABEL[status])}</span>
          </span>
          <LangSwitch />
          <button className="icon-btn" onClick={onShare} aria-label={t('שיתוף')} title={t('שיתוף')}>
            <IconShare />
          </button>
          <button className="icon-btn" onClick={onPlanner} aria-label={t('מתכנן הדירה')} title={t('מתכנן הדירה')}>
            <IconPlan />
          </button>
          <button className="icon-btn" onClick={onSettings} aria-label={t('הגדרות')} title={t('הגדרות')}>
            <IconSettings />
          </button>
        </div>
      </header>

      <section className="masthead">
        <div>
          <div className="eyebrow">{t('גיליון רכישות · {y}', { y: new Date().getFullYear() })}</div>
          <h1 onClick={() => setEditing(true)} title={t('לחצו לשינוי השם')}>
            {editing ? (
              <input
                autoFocus
                defaultValue={tr(p.name)}
                aria-label={t('שם הדירה')}
                onBlur={(e) => {
                  setEditing(false);
                  const v = e.target.value.trim();
                  if (v && v !== p.name && v !== tr(p.name)) onRename(v);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                  if (e.key === 'Escape') setEditing(false);
                }}
              />
            ) : (
              tr(p.name)
            )}
          </h1>
          <div className="specs">
            {specs.map((s) => (
              <span key={s}>{bidi(s)}</span>
            ))}
          </div>
          <p className="lede">
            {tot.count === 0
              ? t('הרשימה ריקה. הוסיפו קטגוריה או הפעילו את מתכנן הדירה.')
              : `${t('נרכשו {a} מתוך {b} מוצרים ב-{c} קטגוריות.', {
                  a: num(tot.boughtCount),
                  b: num(tot.count),
                  n: tot.count,
                  c: cats.length,
                })} ${mustLeft ? t('נשארו {n} פריטי חובה לקנות.', { n: num(mustLeft), k: mustLeft }) : t('כל פריטי החובה נקנו.')}`}
          </p>
        </div>

        <Ledger t={tot} budget={data.budget} />
      </section>

      {perCat.length > 0 && (
        <nav className="contents" aria-label={t('תוכן העניינים')}>
          <div className="contents-head">
            <h2>{t('תוכן העניינים')}</h2>
            <span className="eyebrow">{t('{n} קטגוריות', { n: perCat.length })}</span>
          </div>
          <ol className="toc">
            {perCat.map(({ c, t: ct }, i) => (
              <li key={c.id} className={ct.count > 0 && ct.boughtCount === ct.count ? 'done' : undefined}>
                <a href={`#cat-${c.id}`}>
                  <span className="t-no">{catNo(i)}</span>
                  <span className="t-name">{tr(c.name)}</span>
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

function Ledger({ t: tot, budget }: { t: Totals; budget: number | null }) {
  const scale = Math.max(tot.total, budget ?? 0, 1);
  const pct = tot.total ? Math.round((tot.bought / tot.total) * 100) : 0;
  return (
    <div className="ledger">
      <div className="grand">
        <span className="eyebrow">{t('סה״כ כולל')}</span>
        <span className="num">{shekel(tot.total)}</span>
      </div>
      <div className="split">
        <div className="bought">
          <span className="eyebrow">{t('נרכש · {n}%', { n: pct })}</span>
          <span className="num">{shekel(tot.bought)}</span>
        </div>
        <div>
          <span className="eyebrow">{t('נותר לרכישה')}</span>
          <span className="num">{shekel(tot.left)}</span>
        </div>
      </div>
      <div className="bar" aria-hidden>
        <i style={{ width: `${(tot.total / scale) * 100}%`, background: 'var(--rule)' }} />
        <i style={{ width: `${(tot.bought / scale) * 100}%` }} />
        {budget ? <b style={{ insetInlineStart: `calc(${(budget / scale) * 100}% - 1px)` }} /> : null}
      </div>
      {budget ? (
        <div className="budget">
          <span>
            {t('תקציב')} <span className="num">{shekel(budget)}</span>
          </span>
          {tot.total > budget ? (
            <span className="over">
              {t('חריגה של')} <span className="num">{shekel(tot.total - budget)}</span>
            </span>
          ) : (
            <span>
              {t('מרווח')} <span className="num">{shekel(budget - tot.total)}</span>
            </span>
          )}
        </div>
      ) : null}
    </div>
  );
}
