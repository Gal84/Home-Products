import { useState } from 'react';
import type { Category, Item, Priority } from '../types';
import { PRIORITY_LABEL, shekel } from '../lib/format';
import type { NewItem } from '../lib/store';
import { Sheet } from './Sheet';

interface Props {
  item: Item | null;
  categoryId: string;
  categories: Category[];
  onSave: (value: NewItem) => void;
  onDelete?: () => void;
  onDuplicate?: () => void;
  onClose: () => void;
}

const toNum = (s: string) => {
  const n = Number(s.replace(/[^\d.]/g, ''));
  return Number.isFinite(n) ? n : 0;
};

export function ItemEditor({ item, categoryId, categories, onSave, onDelete, onDuplicate, onClose }: Props) {
  const [name, setName] = useState(item?.name ?? '');
  const [cat, setCat] = useState(item?.categoryId ?? categoryId);
  const [qty, setQty] = useState(String(item?.qty ?? 1));
  const [price, setPrice] = useState(item ? String(item.unitPrice) : '');
  const [actual, setActual] = useState(item?.actualPrice != null ? String(item.actualPrice) : '');
  const [priority, setPriority] = useState<Priority>(item?.priority ?? 'important');
  const [purchased, setPurchased] = useState(item?.purchased ?? false);
  const [store, setStore] = useState(item?.store ?? '');
  const [link, setLink] = useState(item?.link ?? '');
  const [notes, setNotes] = useState(item?.notes ?? '');
  const [confirmDelete, setConfirmDelete] = useState(false);

  const planned = toNum(qty) * toNum(price);
  const valid = name.trim().length > 0;

  const save = () => {
    if (!valid) return;
    onSave({
      name: name.trim(),
      categoryId: cat,
      qty: Math.max(0, toNum(qty)),
      unitPrice: toNum(price),
      actualPrice: actual.trim() === '' ? null : toNum(actual),
      priority,
      purchased,
      store: store.trim() || undefined,
      link: link.trim() || undefined,
      notes: notes.trim() || undefined,
      key: item?.key,
    });
  };

  return (
    <Sheet
      eyebrow={item ? 'עריכת מוצר' : 'מוצר חדש'}
      title={item ? item.name : 'הוספת מוצר'}
      onClose={onClose}
      footer={
        <>
          <button className="btn primary" onClick={save} disabled={!valid}>
            שמירה
          </button>
          <button className="btn ghost" onClick={onClose}>
            ביטול
          </button>
          <span className="spacer" />
          {onDuplicate && (
            <button className="btn ghost" onClick={onDuplicate}>
              שכפול
            </button>
          )}
          {onDelete &&
            (confirmDelete ? (
              <button className="btn danger" onClick={onDelete}>
                בטוח? מחיקה
              </button>
            ) : (
              <button className="btn ghost" onClick={() => setConfirmDelete(true)}>
                מחיקה
              </button>
            ))}
        </>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
        style={{ display: 'contents' }}
      >
        <label className="field">
          <span>שם המוצר</span>
          <input className="input" data-autofocus value={name} onChange={(e) => setName(e.target.value)} placeholder="למשל: ספה פינתית" />
        </label>

        <label className="field">
          <span>קטגוריה</span>
          <select className="select" value={cat} onChange={(e) => setCat(e.target.value)}>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>

        <div className="grid-2">
          <label className="field">
            <span>כמות</span>
            <input className="input num" inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value)} />
          </label>
          <label className="field">
            <span>מחיר ליחידה (₪)</span>
            <input className="input num" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0" />
          </label>
        </div>

        <div className="line-preview">
          <span>סה״כ מתוכנן</span>
          <span className="num">{shekel(planned)}</span>
        </div>

        <div className="field">
          <span>עדיפות</span>
          <div className="seg" role="group" aria-label="עדיפות">
            {(Object.keys(PRIORITY_LABEL) as Priority[]).map((p) => (
              <button type="button" key={p} aria-pressed={priority === p} onClick={() => setPriority(p)}>
                {PRIORITY_LABEL[p]}
              </button>
            ))}
          </div>
        </div>

        <label className="toggle">
          <input type="checkbox" checked={purchased} onChange={(e) => setPurchased(e.target.checked)} />
          <span>
            <b>נרכש ✓</b>
            <small>מסמן שהמוצר כבר נקנה</small>
          </span>
        </label>

        <label className="field">
          <span>מחיר ששולם בפועל לכל השורה (₪) — לא חובה</span>
          <input
            className="input num"
            inputMode="decimal"
            value={actual}
            onChange={(e) => setActual(e.target.value)}
            placeholder={planned ? String(planned) : ''}
          />
        </label>

        <div className="grid-2">
          <label className="field">
            <span>חנות / ספק</span>
            <input className="input" value={store} onChange={(e) => setStore(e.target.value)} placeholder="IKEA, ACE…" />
          </label>
          <label className="field">
            <span>קישור</span>
            <input className="input" dir="ltr" value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://" />
          </label>
        </div>

        <label className="field">
          <span>הערות</span>
          <textarea className="textarea" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </label>
        <button type="submit" hidden />
      </form>
    </Sheet>
  );
}
