import { useState } from 'react';
import type { Category } from '../types';
import { PALETTE } from '../planner/templates';
import { Sheet } from './Sheet';

interface Props {
  category: Category | null;
  itemCount: number;
  onSave: (v: { name: string; note?: string; color: string }) => void;
  onDelete?: () => void;
  onClose: () => void;
}

export function CategoryEditor({ category, itemCount, onSave, onDelete, onClose }: Props) {
  const [name, setName] = useState(category?.name ?? '');
  const [note, setNote] = useState(category?.note ?? '');
  const [color, setColor] = useState(category?.color ?? PALETTE[Math.floor(Math.random() * PALETTE.length)]);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const valid = name.trim().length > 0;

  const save = () => valid && onSave({ name: name.trim(), note: note.trim() || undefined, color });

  return (
    <Sheet
      eyebrow={category ? 'עריכת קטגוריה' : 'קטגוריה חדשה'}
      title={category ? category.name : 'הוספת קטגוריה'}
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
          {onDelete &&
            (confirmDelete ? (
              <button className="btn danger" onClick={onDelete}>
                {itemCount ? `למחוק גם ${itemCount} מוצרים?` : 'בטוח? מחיקה'}
              </button>
            ) : (
              <button className="btn ghost" onClick={() => setConfirmDelete(true)}>
                מחיקת קטגוריה
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
          <span>שם הקטגוריה</span>
          <input className="input" data-autofocus value={name} onChange={(e) => setName(e.target.value)} placeholder="למשל: חדר כביסה" />
        </label>
        <label className="field">
          <span>תיאור קצר — לא חובה</span>
          <input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="למשל: 6 מ״ר" />
        </label>
        <div className="field">
          <span>צבע</span>
          <div className="swatches">
            {PALETTE.map((c) => (
              <button
                type="button"
                key={c}
                aria-label={c}
                aria-pressed={color === c}
                style={{ background: c }}
                onClick={() => setColor(c)}
              />
            ))}
          </div>
        </div>
        <button type="submit" hidden />
      </form>
    </Sheet>
  );
}
