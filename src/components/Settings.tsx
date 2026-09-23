import { useRef, useState } from 'react';
import type { HomeData } from '../types';
import { lineTotal, PRIORITY_LABEL } from '../lib/format';
import { isHomeData, live, sortedCategories } from '../lib/store';
import type { ThemePref } from '../lib/storage';
import { Sheet } from './Sheet';

interface Props {
  data: HomeData;
  code: string;
  theme: ThemePref;
  onTheme: (t: ThemePref) => void;
  onBudget: (b: number | null) => void;
  onImport: (d: HomeData) => void;
  onShare: () => void;
  onLogout: () => void;
  onClose: () => void;
}

function download(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function toCsv(d: HomeData): string {
  const cats = sortedCategories(d);
  const rows = [['קטגוריה', 'מוצר', 'כמות', 'מחיר ליחידה', 'סה"כ', 'עדיפות', 'נרכש', 'חנות', 'קישור', 'הערות']];
  for (const c of cats) {
    for (const i of live(d.items).filter((x) => x.categoryId === c.id)) {
      rows.push([
        c.name,
        i.name,
        String(i.qty),
        String(i.unitPrice),
        String(lineTotal(i)),
        PRIORITY_LABEL[i.priority],
        i.purchased ? 'כן' : 'לא',
        i.store ?? '',
        i.link ?? '',
        i.notes ?? '',
      ]);
    }
  }
  const esc = (s: string) => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
  // BOM so Excel opens Hebrew correctly.
  return '﻿' + rows.map((r) => r.map(esc).join(',')).join('\n');
}

export function Settings({ data, code, theme, onTheme, onBudget, onImport, onShare, onLogout, onClose }: Props) {
  const [budget, setBudget] = useState(data.budget ? String(data.budget) : '');
  const [importError, setImportError] = useState<string | null>(null);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const stamp = new Date().toISOString().slice(0, 10);

  const commitBudget = () => {
    const n = Number(budget.replace(/[^\d.]/g, ''));
    onBudget(budget.trim() && n > 0 ? n : null);
  };

  const exportJson = () => {
    const clean: HomeData = { ...data, categories: live(data.categories), items: live(data.items) };
    download(`home-products-${stamp}.json`, JSON.stringify(clean, null, 2), 'application/json');
  };

  const importJson = async (file: File) => {
    setImportError(null);
    try {
      const parsed = JSON.parse(await file.text());
      if (!isHomeData(parsed)) throw new Error();
      onImport(parsed);
    } catch {
      setImportError('הקובץ לא נראה כמו גיבוי של האפליקציה.');
    }
  };

  return (
    <Sheet eyebrow="הגדרות" title="הגדרות ושיתוף" onClose={onClose}>
      <h3 className="section-title">תקציב</h3>
      <label className="field">
        <span>תקציב יעד לכל הדירה (₪) — לא חובה</span>
        <input
          className="input num"
          inputMode="numeric"
          value={budget}
          placeholder="למשל 400000"
          onChange={(e) => setBudget(e.target.value)}
          onBlur={commitBudget}
          onKeyDown={(e) => e.key === 'Enter' && commitBudget()}
        />
      </label>

      <h3 className="section-title">שיתוף</h3>
      <p className="hint">כל מי שיש לו את הקוד רואה ועורך את אותה רשימה, מכל מכשיר. שתפו רק עם בני הבית.</p>
      <div className="code-box">
        <span className="num">{code}</span>
        <button className="btn sm" onClick={onShare}>
          העתקת קישור
        </button>
      </div>

      <h3 className="section-title">מראה</h3>
      <div className="seg" role="group" aria-label="ערכת צבעים">
        {(
          [
            ['auto', 'אוטומטי'],
            ['light', 'בהיר'],
            ['dark', 'כהה'],
          ] as const
        ).map(([k, label]) => (
          <button key={k} aria-pressed={theme === k} onClick={() => onTheme(k)}>
            {label}
          </button>
        ))}
      </div>

      <h3 className="section-title">גיבוי וייצוא</h3>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        <button className="btn" onClick={() => download(`home-products-${stamp}.csv`, toCsv(data), 'text/csv;charset=utf-8')}>
          ייצוא לאקסל (CSV)
        </button>
        <button className="btn" onClick={exportJson}>
          גיבוי (JSON)
        </button>
        <button className="btn ghost" onClick={() => fileRef.current?.click()}>
          שחזור מגיבוי…
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void importJson(f);
            e.target.value = '';
          }}
        />
      </div>
      <p className="hint">שחזור מגיבוי מחליף את כל הרשימה הנוכחית.</p>
      {importError && <div className="error">{importError}</div>}

      <h3 className="section-title">המכשיר הזה</h3>
      {confirmLogout ? (
        <div style={{ display: 'grid', gap: 8 }}>
          <p className="hint">הרשימה נשארת שמורה בענן. כדי לחזור תצטרכו את הקוד — ודאו ששמרתם אותו.</p>
          <button className="btn danger" onClick={onLogout}>
            יציאה מהדירה במכשיר הזה
          </button>
        </div>
      ) : (
        <button className="btn ghost" style={{ justifySelf: 'start' }} onClick={() => setConfirmLogout(true)}>
          יציאה / מעבר לדירה אחרת
        </button>
      )}
    </Sheet>
  );
}
