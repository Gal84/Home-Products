import type { Category, Item } from '../types';
import { bidi, catNo, lineTotal, num, PRIORITY_LABEL, shekel, totals } from '../lib/format';
import { t, tr, useLang } from '../i18n';
import { IconCheck, IconChevron, IconDown, IconEdit, IconMinus, IconPlus, IconRestore, IconUp } from './Icons';

interface Props {
  index: number;
  category: Category;
  allItems: Item[];
  shown: Item[];
  collapsed: boolean;
  filtering: boolean;
  isFirst: boolean;
  isLast: boolean;
  onToggleCollapse: () => void;
  onEdit: () => void;
  onMove: (dir: -1 | 1) => void;
  onAddItem: () => void;
  onOpenItem: (item: Item) => void;
  onTogglePurchased: (item: Item) => void;
  onToggleExcluded: (item: Item) => void;
}

export function CategorySection(props: Props) {
  const { index, category: c, allItems, shown, collapsed, filtering } = props;
  const tot = totals(allItems);
  const pct = tot.count ? (tot.boughtCount / tot.count) * 100 : 0;
  const rtl = useLang() === 'he';

  return (
    <section id={`cat-${c.id}`} className={`cat${collapsed ? ' collapsed' : ''}`} style={{ ['--cat' as string]: c.color }}>
      <div className="cat-head">
        <div className="cat-no" aria-hidden>
          <small>N°</small>
          {String(index + 1).padStart(2, '0')}
        </div>
        <div className="cat-title">
          <h2>
            <button onClick={props.onToggleCollapse} aria-expanded={!collapsed}>
              {tr(c.name)}
            </button>
          </h2>
          <div className="meta">
            <span>{catNo(index)}</span>
            {c.note && <span>{bidi(tr(c.note))}</span>}
            <span>{t('{a}/{b} נרכשו', { a: num(tot.boughtCount), b: num(tot.count) })}</span>
          </div>
        </div>
        <div className="cat-sum">
          <span className="num">{shekel(tot.total)}</span>
          <span className="sub">
            {t('נרכש')} <span className="num">{shekel(tot.bought)}</span> · {t('נותר')} <span className="num">{shekel(tot.left)}</span>
          </span>
          <div className="cat-tools">
            <button className="icon-btn" onClick={props.onAddItem} aria-label={t('הוספת מוצר ל{c}', { c: tr(c.name) })} title={t('הוספת מוצר')}>
              <IconPlus />
            </button>
            <button className="icon-btn" onClick={props.onEdit} aria-label={t('עריכת {c}', { c: tr(c.name) })} title={t('עריכת קטגוריה')}>
              <IconEdit />
            </button>
            <button className="icon-btn" onClick={() => props.onMove(-1)} disabled={props.isFirst} aria-label={t('הזזה למעלה')} title={t('הזזה למעלה')}>
              <IconUp />
            </button>
            <button className="icon-btn" onClick={() => props.onMove(1)} disabled={props.isLast} aria-label={t('הזזה למטה')} title={t('הזזה למטה')}>
              <IconDown />
            </button>
            <button className="icon-btn" onClick={props.onToggleCollapse} aria-label={t(collapsed ? 'פתיחה' : 'קיפול')} title={t(collapsed ? 'פתיחה' : 'קיפול')}>
              {/* Points back towards the reading direction while collapsed. */}
              <IconChevron className="chev" style={{ transform: collapsed ? (rtl ? 'rotate(0deg)' : 'rotate(180deg)') : 'rotate(-90deg)' }} />
            </button>
          </div>
        </div>
      </div>
      <div className="cat-progress" aria-hidden>
        <i style={{ width: `${pct}%` }} />
      </div>

      {!collapsed && (
        <>
          {shown.length === 0 ? (
            <div className="empty-cat">{t(filtering ? 'אין מוצרים שמתאימים לסינון.' : 'עוד אין כאן מוצרים.')}</div>
          ) : (
            <ul className="items">
              {shown.map((it) => (
                <ItemRow
                  key={it.id}
                  item={it}
                  onOpen={() => props.onOpenItem(it)}
                  onToggle={() => props.onTogglePurchased(it)}
                  onExclude={() => props.onToggleExcluded(it)}
                />
              ))}
            </ul>
          )}
          <div className="add-row">
            <button onClick={props.onAddItem}>+ {t('הוספת מוצר ל{c}', { c: tr(c.name) })}</button>
          </div>
        </>
      )}
    </section>
  );
}

function ItemRow({ item, onOpen, onToggle, onExclude }: { item: Item; onOpen: () => void; onToggle: () => void; onExclude: () => void }) {
  const name = tr(item.name);
  const sub = [item.store, tr(item.notes)].filter(Boolean).join(' · ');
  const paid = item.actualPrice != null;
  return (
    <li className={`item${item.purchased ? ' bought' : ''}${item.excluded ? ' excluded' : ''}`}>
      <button
        className="check"
        role="checkbox"
        aria-checked={item.purchased}
        aria-label={`${name} — ${t(item.purchased ? 'נרכש' : 'לא נרכש')}`}
        onClick={onToggle}
      >
        <IconCheck />
      </button>
      <button className="name" onClick={onOpen}>
        <b>{bidi(name)}</b>
        {sub && <small>{bidi(sub)}</small>}
      </button>
      <span className={`prio ${item.priority}`}>{t(PRIORITY_LABEL[item.priority])}</span>
      <span className="calc">
        {item.qty !== 1 ? (
          <>
            <span className="num">{num(item.qty)}</span> × <span className="num">{shekel(item.unitPrice)}</span>
          </>
        ) : (
          <span className="num">{shekel(item.unitPrice)}</span>
        )}
      </span>
      <span className="total num">
        {shekel(lineTotal(item))}
        {paid && <span className="paid">{t('שולם בפועל')}</span>}
      </span>
      <button
        className="skip"
        onClick={onExclude}
        aria-pressed={!!item.excluded}
        aria-label={t(item.excluded ? 'החזרת {n} לחישוב' : 'הוצאת {n} מהחישוב', { n: name })}
        title={t(item.excluded ? 'החזרה לחישוב' : 'הוצאה מהחישוב (בלי למחוק)')}
      >
        {item.excluded ? <IconRestore /> : <IconMinus />}
      </button>
    </li>
  );
}
