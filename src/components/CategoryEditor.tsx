import { useState } from 'react';
import type { Category } from '../types';
import { PALETTE } from '../planner/templates';
import { Sheet } from './Sheet';
import { t, tr } from '../i18n';

interface Props {
  category: Category | null;
  itemCount: number;
  onSave: (v: { name: string; note?: string; color: string }) => void;
  onDelete?: () => void;
  onClose: () => void;
}

export function CategoryEditor({ category, itemCount, onSave, onDelete, onClose }: Props) {
  // Planner-made names are shown translated; saving them untouched keeps the stored original.
  const shownName = category ? tr(category.name) : '';
  const shownNote = tr(category?.note) ?? '';
  const [name, setName] = useState(shownName);
  const [note, setNote] = useState(shownNote);
  const [color, setColor] = useState(category?.color ?? PALETTE[Math.floor(Math.random() * PALETTE.length)]);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const valid = name.trim().length > 0;

  const save = () =>
    valid &&
    onSave({
      name: category && name === shownName ? category.name : name.trim(),
      note: category && note === shownNote ? category.note : note.trim() || undefined,
      color,
    });

  return (
    <Sheet
      eyebrow={t(category ? 'עריכת קטגוריה' : 'קטגוריה חדשה')}
      title={category ? shownName : t('הוספת קטגוריה')}
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
          {onDelete &&
            (confirmDelete ? (
              <button className="btn danger" onClick={onDelete}>
                {itemCount ? t('למחוק גם {n} מוצרים?', { n: itemCount }) : t('בטוח? מחיקה')}
              </button>
            ) : (
              <button className="btn ghost" onClick={() => setConfirmDelete(true)}>
                {t('מחיקת קטגוריה')}
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
          <span>{t('שם הקטגוריה')}</span>
          <input className="input" data-autofocus value={name} onChange={(e) => setName(e.target.value)} placeholder={t('למשל: חדר כביסה')} />
        </label>
        <label className="field">
          <span>{t('תיאור קצר — לא חובה')}</span>
          <input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('למשל: 6 מ״ר')} />
        </label>
        <div className="field">
          <span>{t('צבע')}</span>
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
