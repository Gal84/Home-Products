import type { Category, Item } from '../types';
import { catNo, lineTotal, num, PRIORITY_LABEL, shekel, totals } from '../lib/format';
import { IconCheck, IconChevron, IconDown, IconEdit, IconPlus, IconUp } from './Icons';

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
}

export function CategorySection(props: Props) {
  const { index, category: c, allItems, shown, collapsed, filtering } = props;
  const t = totals(allItems);
  const pct = t.count ? (t.boughtCount / t.count) * 100 : 0;

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
              {c.name}
            </button>
          </h2>
          <div className="meta">
            <span>{catNo(index)}</span>
            {c.note && <span>{c.note}</span>}
            <span>
              {num(t.boughtCount)}/{num(t.count)} נרכשו
            </span>
          </div>
        </div>
        <div className="cat-sum">
          <span className="num">{shekel(t.total)}</span>
          <span className="sub">
            נרכש <span className="num">{shekel(t.bought)}</span> · נותר <span className="num">{shekel(t.left)}</span>
          </span>
          <div className="cat-tools">
            <button className="icon-btn" onClick={props.onAddItem} aria-label={`הוספת מוצר ל${c.name}`} title="הוספת מוצר">
              <IconPlus />
            </button>
            <button className="icon-btn" onClick={props.onEdit} aria-label={`עריכת ${c.name}`} title="עריכת קטגוריה">
              <IconEdit />
            </button>
            <button className="icon-btn" onClick={() => props.onMove(-1)} disabled={props.isFirst} aria-label="הזזה למעלה" title="הזזה למעלה">
              <IconUp />
            </button>
            <button className="icon-btn" onClick={() => props.onMove(1)} disabled={props.isLast} aria-label="הזזה למטה" title="הזזה למטה">
              <IconDown />
            </button>
            <button className="icon-btn" onClick={props.onToggleCollapse} aria-label={collapsed ? 'פתיחה' : 'קיפול'} title={collapsed ? 'פתיחה' : 'קיפול'}>
              <IconChevron className="chev" style={{ transform: collapsed ? 'rotate(0deg)' : 'rotate(-90deg)' }} />
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
            <div className="empty-cat">{filtering ? 'אין מוצרים שמתאימים לסינון.' : 'עוד אין כאן מוצרים.'}</div>
          ) : (
            <ul className="items">
              {shown.map((it) => (
                <ItemRow key={it.id} item={it} onOpen={() => props.onOpenItem(it)} onToggle={() => props.onTogglePurchased(it)} />
              ))}
            </ul>
          )}
          <div className="add-row">
            <button onClick={props.onAddItem}>+ הוספת מוצר ל{c.name}</button>
          </div>
        </>
      )}
    </section>
  );
}

function ItemRow({ item, onOpen, onToggle }: { item: Item; onOpen: () => void; onToggle: () => void }) {
  const sub = [item.store, item.notes].filter(Boolean).join(' · ');
  const paid = item.actualPrice != null;
  return (
    <li className={`item${item.purchased ? ' bought' : ''}`}>
      <button
        className="check"
        role="checkbox"
        aria-checked={item.purchased}
        aria-label={`${item.name} — ${item.purchased ? 'נרכש' : 'לא נרכש'}`}
        onClick={onToggle}
      >
        <IconCheck />
      </button>
      <button className="name" onClick={onOpen}>
        <b>{item.name}</b>
        {sub && <small>{sub}</small>}
      </button>
      <span className={`prio ${item.priority}`}>{PRIORITY_LABEL[item.priority]}</span>
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
        {paid && <span className="paid">שולם בפועל</span>}
      </span>
    </li>
  );
}
