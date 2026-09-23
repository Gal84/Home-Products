import { useState } from 'react';
import type { ApartmentProfile } from '../types';
import { applyPlan } from '../planner/generate';
import { DEFAULT_PROFILE } from '../planner/templates';
import { newHomeCode, normalizeCode } from '../lib/id';
import { emptyHome } from '../lib/store';
import { homeCache } from '../lib/storage';
import { createHome, HomeNotFound, loadHome, supabaseConfigured } from '../lib/supabase';
import { PlannerWizard } from './PlannerWizard';

interface Props {
  onEnter: (code: string) => void;
  notice?: string | null;
}

export function Gate({ onEnter, notice }: Props) {
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(notice ?? null);
  const [busy, setBusy] = useState(false);
  const [planning, setPlanning] = useState(false);
  const [created, setCreated] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const open = async () => {
    const c = normalizeCode(code);
    if (c.length < 12) return setError('הקוד קצר מדי — בדקו שהעתקתם את כולו.');
    setBusy(true);
    setError(null);
    try {
      const remote = await loadHome(c);
      homeCache.set(c, { ...remote, dirty: false });
      onEnter(c);
    } catch (e) {
      setError(e instanceof HomeNotFound ? 'לא נמצאה דירה עם הקוד הזה.' : 'אין חיבור לשרת כרגע. נסו שוב בעוד רגע.');
    } finally {
      setBusy(false);
    }
  };

  const create = async (profile: ApartmentProfile) => {
    setBusy(true);
    setError(null);
    try {
      const c = newHomeCode();
      const data = applyPlan(emptyHome(), profile, 'merge');
      const version = await createHome(c, data);
      homeCache.set(c, { data, version, dirty: false });
      setPlanning(false);
      setCreated(c);
    } catch {
      setError('לא הצלחנו ליצור את הדירה. בדקו חיבור ונסו שוב.');
      setPlanning(false);
    } finally {
      setBusy(false);
    }
  };

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      /* clipboard blocked — the code is on screen */
    }
  };

  return (
    <div className="gate">
      <section className="gate-art">
        <div className="eyebrow">N°01 — קטלוג רכישות לדירה חדשה</div>
        <FloorPlan />
        <h1>
          דירה
          <br />
          <em>ריקה.</em>
          <br />
          רשימה מלאה.
        </h1>
      </section>

      <section className="gate-form">
        {created ? (
          <>
            <div>
              <div className="eyebrow">הדירה נוצרה</div>
              <h2>שמרו את קוד הדירה</h2>
            </div>
            <p className="hint" style={{ fontSize: 15 }}>
              זה המפתח היחיד לרשימה. מי שיש לו את הקוד (או את קישור השיתוף) יכול לראות ולערוך — שלחו אותו רק לבני הבית.
            </p>
            <div className="code-box">
              <span className="num">{created}</span>
              <button className="btn sm" onClick={() => copy(created)}>
                {copied ? 'הועתק ✓' : 'העתקה'}
              </button>
            </div>
            <button className="btn primary" onClick={() => onEnter(created)}>
              לרשימה שלי ←
            </button>
          </>
        ) : (
          <>
            <div>
              <div className="eyebrow">כניסה</div>
              <h2>יש לכם קוד דירה?</h2>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void open();
              }}
              style={{ display: 'grid', gap: 12 }}
            >
              <input
                className="input num"
                dir="ltr"
                placeholder="HOME-XXXX-XXXX-XXXX-XXXX"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                autoComplete="off"
                spellCheck={false}
              />
              <button className="btn primary" disabled={busy || !code.trim()}>
                כניסה לרשימה
              </button>
            </form>
            <div className="or">או</div>
            <div style={{ display: 'grid', gap: 12 }}>
              <p className="hint" style={{ fontSize: 15 }}>
                מתחילים מאפס? מזינים כמה חדרים, מרפסת, מחסן וחניות — ומקבלים רשימת קניות מלאה עם מחירים, שאפשר לערוך בכל רגע.
              </p>
              <button className="btn accent" onClick={() => setPlanning(true)} disabled={busy || !supabaseConfigured}>
                תכנון דירה חדשה
              </button>
            </div>
            {!supabaseConfigured && <div className="error">חסרים פרטי Supabase בהגדרות הבנייה.</div>}
            {error && <div className="error">{error}</div>}
          </>
        )}
      </section>

      {planning && (
        <PlannerWizard initial={DEFAULT_PROFILE} hasData={false} busy={busy} onApply={(p) => void create(p)} onClose={() => setPlanning(false)} />
      )}
    </div>
  );
}

function FloorPlan() {
  return (
    <svg className="plan" viewBox="0 0 420 260" fill="none" stroke="currentColor" aria-hidden>
      <g strokeWidth="4">
        <path d="M10 10h400v200H250v40H10z" />
      </g>
      <g strokeWidth="1.5">
        <path d="M150 10v90M10 100h100M130 100h20M150 100h30M200 100h40v110" />
        <path d="M290 10v70M290 100v40h120M240 140h30" />
        <path d="M10 170h60M90 170h60v40M150 210v40" />
        <path d="M340 10v70" />
      </g>
      <g stroke="var(--accent)" strokeWidth="1.2" strokeDasharray="3 3">
        <path d="M250 210h160v40H250" />
      </g>
      <rect x="175" y="150" width="45" height="27" stroke="var(--accent)" strokeWidth="1.5" />
      <g fill="currentColor" stroke="none" fontFamily="IBM Plex Mono, monospace" fontSize="10">
        <text x="70" y="55">01</text>
        <text x="215" y="55">02</text>
        <text x="310" y="45">03</text>
        <text x="370" y="45">04</text>
        <text x="60" y="140">05</text>
        <text x="330" y="175">06</text>
        <text x="185" y="167" fill="var(--accent)">אי</text>
        <text x="300" y="235" fill="var(--accent)">מרפסת 20</text>
      </g>
    </svg>
  );
}
