import { useState } from 'react';
import type { Category, Item, Priority } from '../types';
import { PRIORITY_LABEL, shekel } from '../lib/format';
import type { NewItem } from '../lib/store';
import { Sheet } from './Sheet';
import { t, tr } from '../i18n';

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
  // Planner-made names and notes are shown translated; saving them untouched keeps the stored original.
  const shownName = item ? tr(item.name) : '';
  const shownNotes = tr(item?.notes) ?? '';
  const [name, setName] = useState(shownName);
  const [cat, setCat] = useState(item?.categoryId ?? categoryId);
  const [qty, setQty] = useState(String(item?.qty ?? 1));
  const [price, setPrice] = useState(item ? String(item.unitPrice) : '');
  const [actual, setActual] = useState(item?.actualPrice != null ? String(item.actualPrice) : '');
  const [priority, setPriority] = useState<Priority>(item?.priority ?? 'important');
  const [purchased, setPurchased] = useState(item?.purchased ?? false);
  const [store, setStore] = useState(item?.store ?? '');
  const [link, setLink] = useState(item?.link ?? '');
  const [notes, setNotes] = useState(shownNotes);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const planned = toNum(qty) * toNum(price);
  const valid = name.trim().length > 0;

  const save = () => {
    if (!valid) return;
    onSave({
      name: item && name === shownName ? item.name : name.trim(),
      categoryId: cat,
      qty: Math.max(0, toNum(qty)),
      unitPrice: toNum(price),
      actualPrice: actual.trim() === '' ? null : toNum(actual),
      priority,
      purchased,
      store: store.trim() || undefined,
      link: link.trim() || undefined,
      notes: item && notes === shownNotes ? item.notes : notes.trim() || undefined,
      key: item?.key,
    });
  };

  return (
    <Sheet
      eyebrow={t(item ? 'עריכת מוצר' : 'מוצר חדש')}
      title={item ? shownName : t('הוספת מוצר')}
      onClose={onClose}
      footer={
        <>
          <button className="btn primary" onClick={save} disabled={!valid}>
            {t('שמירה')}
          </button>
          <button className="btn ghost" onClick={onClose}>
            {t('ביטול')}
          </button>
          <span className="spacer" />
          {onDuplicate && (
            <button className="btn ghost" onClick={onDuplicate}>
              {t('שכפול')}
            </button>
          )}
          {onDelete &&
            (confirmDelete ? (
              <button className="btn danger" onClick={onDelete}>
                {t('בטוח? מחיקה')}
              </button>
            ) : (
              <button className="btn ghost" onClick={() => setConfirmDelete(true)}>
                {t('מחיקה')}
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
          <span>{t('שם המוצר')}</span>
          <input className="input" data-autofocus value={name} onChange={(e) => setName(e.target.value)} placeholder={t('למשל: ספה פינתית')} />
        </label>

        <label className="field">
          <span>{t('קטגוריה')}</span>
          <select className="select" value={cat} onChange={(e) => setCat(e.target.value)}>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {tr(c.name)}
              </option>
            ))}
          </select>
        </label>

        <div className="grid-2">
          <label className="field">
            <span>{t('כמות')}</span>
            <input className="input num" inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value)} />
          </label>
          <label className="field">
            <span>{t('מחיר ליחידה (₪)')}</span>
            <input className="input num" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0" />
          </label>
        </div>

        <div className="line-preview">
          <span>{t('סה״כ מתוכנן')}</span>
          <span className="num">{shekel(planned)}</span>
        </div>

        <div className="field">
          <span>{t('עדיפות')}</span>
          <div className="seg" role="group" aria-label={t('עדיפות')}>
            {(Object.keys(PRIORITY_LABEL) as Priority[]).map((p) => (
              <button type="button" key={p} aria-pressed={priority === p} onClick={() => setPriority(p)}>
                {t(PRIORITY_LABEL[p])}
              </button>
            ))}
          </div>
        </div>

        <label className="toggle">
          <input type="checkbox" checked={purchased} onChange={(e) => setPurchased(e.target.checked)} />
          <span>
            <b>{t('נרכש ✓')}</b>
            <small>{t('מסמן שהמוצר כבר נקנה')}</small>
          </span>
        </label>

        <label className="field">
          <span>{t('מחיר ששולם בפועל לכל השורה (₪) — לא חובה')}</span>
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
            <span>{t('חנות / ספק')}</span>
            <input className="input" value={store} onChange={(e) => setStore(e.target.value)} placeholder="IKEA, ACE…" />
          </label>
          <label className="field">
            <span>{t('קישור')}</span>
            <input className="input" dir="ltr" value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://" />
          </label>
        </div>

        <label className="field">
          <span>{t('הערות')}</span>
          <textarea className="textarea" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </label>
        <button type="submit" hidden />
      </form>
    </Sheet>
  );
}
