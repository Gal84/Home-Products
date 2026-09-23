import { useMemo, useState } from 'react';
import type { AcType, ApartmentProfile, BedroomUse, BudgetTier } from '../types';
import { applyPlan } from '../planner/generate';
import { BEDROOM_LABEL, defaultBedrooms, withDefaults } from '../planner/templates';
import { emptyHome, live } from '../lib/store';
import { shekel, totals } from '../lib/format';
import { Sheet, Stepper } from './Sheet';

interface Props {
  initial: ApartmentProfile;
  hasData: boolean;
  onApply: (profile: ApartmentProfile, mode: 'merge' | 'replace') => void;
  onClose: () => void;
  busy?: boolean;
}

const AC_TYPES: { k: AcType; label: string }[] = [
  { k: 'central', label: 'מיני-מרכזי לכל הבית' },
  { k: 'split', label: 'מזגן לכל חדר' },
];

const TIERS: { k: BudgetTier; label: string }[] = [
  { k: 'saver', label: 'חסכוני' },
  { k: 'mid', label: 'בינוני' },
  { k: 'premium', label: 'גבוה' },
];

export function PlannerWizard({ initial, hasData, onApply, onClose, busy }: Props) {
  const [p, setP] = useState<ApartmentProfile>(() => withDefaults(initial));
  const [mode, setMode] = useState<'merge' | 'replace'>('merge');
  const set = <K extends keyof ApartmentProfile>(k: K, v: ApartmentProfile[K]) => setP((x) => ({ ...x, [k]: v }));

  const setRooms = (rooms: number) =>
    setP((x) => {
      const want = Math.max(0, rooms - 1);
      const bedrooms = x.bedrooms.slice(0, want);
      const defaults = defaultBedrooms(rooms);
      while (bedrooms.length < want) bedrooms.push(defaults[bedrooms.length] ?? 'kids');
      return { ...x, rooms, bedrooms };
    });

  const preview = useMemo(() => {
    const d = applyPlan(emptyHome(), p, 'merge');
    return { cats: live(d.categories).length, ...totals(live(d.items)) };
  }, [p]);

  return (
    <Sheet
      wide
      eyebrow="מתכנן הדירה"
      title="ספרו לי על הדירה"
      onClose={onClose}
      footer={
        <>
          <button className="btn accent" disabled={busy} onClick={() => onApply(p, mode)}>
            {hasData ? (mode === 'merge' ? 'הוספת החסר לרשימה' : 'בניית רשימה מחדש') : 'בניית הרשימה'}
          </button>
          <button className="btn ghost" onClick={onClose}>
            ביטול
          </button>
        </>
      }
    >
      <h3 className="section-title">הדירה</h3>
      <label className="field">
        <span>שם</span>
        <input className="input" value={p.name} onChange={(e) => set('name', e.target.value)} />
      </label>
      <div className="grid-3">
        <label className="field">
          <span>מספר חדרים (כולל סלון)</span>
          <Stepper label="חדרים" value={p.rooms} min={1} max={12} onChange={setRooms} />
        </label>
        <label className="field">
          <span>חדרי שירותים</span>
          <Stepper label="שירותים" value={p.toilets} max={6} onChange={(v) => set('toilets', v)} />
        </label>
        <label className="field">
          <span>חדרי מקלחת</span>
          <Stepper label="מקלחות" value={p.showers} max={4} onChange={(v) => set('showers', v)} />
        </label>
        <label className="field">
          <span>חדרי אמבטיה</span>
          <Stepper label="אמבטיות" value={p.bathtubs} max={4} onChange={(v) => set('bathtubs', v)} />
        </label>
      </div>

      {p.bedrooms.length > 0 && (
        <>
          <h3 className="section-title">ייעוד החדרים</h3>
          <p className="hint">חדר אחד הוא הסלון; לכל שאר החדרים בחרו ייעוד — הרשימה תיבנה בהתאם.</p>
          <div className="room-list">
            {p.bedrooms.map((use, i) => (
              <div className="room-row" key={i}>
                <span className="eyebrow">חדר {i + 1}</span>
                <div className="seg" role="group" aria-label={`ייעוד חדר ${i + 1}`}>
                  {(Object.keys(BEDROOM_LABEL) as BedroomUse[]).map((u) => (
                    <button
                      type="button"
                      key={u}
                      aria-pressed={use === u}
                      onClick={() => set('bedrooms', p.bedrooms.map((b, j) => (j === i ? u : b)))}
                    >
                      {BEDROOM_LABEL[u].replace('חדר ', '').replace('שינה ', '')}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <h3 className="section-title">מטבח</h3>
      <label className="toggle">
        <input
          type="checkbox"
          checked={!!p.kitchenIsland}
          onChange={(e) => set('kitchenIsland', e.target.checked ? { length: 150, depth: 90 } : null)}
        />
        <span>
          <b>אי מטבח</b>
          <small>כולל משטח, כיסאות בר ותאורה מעל</small>
        </span>
      </label>
      {p.kitchenIsland && (
        <div className="grid-2">
          <label className="field">
            <span>אורך (ס״מ)</span>
            <Stepper label="אורך אי" value={p.kitchenIsland.length} min={60} max={400} step={10} onChange={(v) => set('kitchenIsland', { ...p.kitchenIsland!, length: v })} />
          </label>
          <label className="field">
            <span>עומק (ס״מ)</span>
            <Stepper label="עומק אי" value={p.kitchenIsland.depth} min={40} max={200} step={10} onChange={(v) => set('kitchenIsland', { ...p.kitchenIsland!, depth: v })} />
          </label>
        </div>
      )}

      <h3 className="section-title">מיזוג אוויר</h3>
      <div className="seg" role="group" aria-label="סוג מיזוג">
        {AC_TYPES.map((t) => (
          <button type="button" key={t.k} aria-pressed={p.acType === t.k} onClick={() => set('acType', t.k)}>
            {t.label}
          </button>
        ))}
      </div>

      <h3 className="section-title">מרפסת</h3>
      <div className="grid-3">
        <label className="field">
          <span>שטח (מ״ר)</span>
          <Stepper label="שטח מרפסת" value={p.balconyArea} max={200} onChange={(v) => set('balconyArea', v)} />
        </label>
        <label className="field">
          <span>מתוכו מקורה (מ״ר)</span>
          <Stepper label="מקורה" value={p.balconyCovered} max={p.balconyArea} onChange={(v) => set('balconyCovered', v)} />
        </label>
        <label className="field">
          <span>סגירה (מ״ר)</span>
          <Stepper label="סגירת מרפסת" value={p.balconyEnclosure} max={p.balconyArea} onChange={(v) => set('balconyEnclosure', v)} />
        </label>
      </div>

      <h3 className="section-title">מחסן וחניות</h3>
      <div className="grid-3">
        <label className="field">
          <span>מחסן (מ״ר)</span>
          <Stepper label="מחסן" value={p.storageArea} max={40} onChange={(v) => set('storageArea', v)} />
        </label>
        <label className="field">
          <span>חניות</span>
          <Stepper
            label="חניות"
            value={p.parking}
            max={4}
            onChange={(v) => setP((x) => ({ ...x, parking: v, evChargers: Math.min(x.evChargers, v) }))}
          />
        </label>
        <label className="field">
          <span>עמדות טעינה לרכב חשמלי</span>
          <Stepper label="עמדות טעינה" value={p.evChargers} max={p.parking} onChange={(v) => set('evChargers', v)} />
        </label>
        <label className="toggle" style={{ alignSelf: 'end' }}>
          <input type="checkbox" checked={p.parkingCovered} onChange={(e) => set('parkingCovered', e.target.checked)} />
          <span>
            <b>מקורות</b>
          </span>
        </label>
      </div>

      <h3 className="section-title">חיות מחמד</h3>
      <div className="grid-3">
        <label className="field">
          <span>חתולים</span>
          <Stepper label="חתולים" value={p.cats} max={10} onChange={(v) => set('cats', v)} />
        </label>
        <label className="field">
          <span>כלבים</span>
          <Stepper label="כלבים" value={p.dogs} max={10} onChange={(v) => set('dogs', v)} />
        </label>
      </div>

      <h3 className="section-title">תוספות ותקציב</h3>
      <div className="grid-2">
        <label className="toggle">
          <input type="checkbox" checked={p.works} onChange={(e) => set('works', e.target.checked)} />
          <span>
            <b>עבודות ושדרוגים</b>
            <small>בדק בית, חשמלאי, הובלה, תריסים</small>
          </span>
        </label>
        <label className="toggle">
          <input type="checkbox" checked={p.smartHome} onChange={(e) => set('smartHome', e.target.checked)} />
          <span>
            <b>בית חכם ואבטחה</b>
            <small>Mesh, מנעול, מצלמות, חיישנים</small>
          </span>
        </label>
      </div>
      <div className="field">
        <span>רמת מחירים</span>
        <div className="seg" role="group" aria-label="רמת מחירים">
          {TIERS.map((t) => (
            <button type="button" key={t.k} aria-pressed={p.tier === t.k} onClick={() => set('tier', t.k)}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {hasData && (
        <>
          <h3 className="section-title">מה לעשות עם הרשימה הקיימת?</h3>
          <div className="seg" role="group" aria-label="מצב">
            <button type="button" aria-pressed={mode === 'merge'} onClick={() => setMode('merge')}>
              להוסיף רק מה שחסר
            </button>
            <button type="button" aria-pressed={mode === 'replace'} onClick={() => setMode('replace')}>
              למחוק ולבנות מחדש
            </button>
          </div>
          <p className="hint">
            {mode === 'merge'
              ? 'מוצרים שכבר ברשימה (כולל מחירים וסימוני ✓) לא ישתנו.'
              : 'כל הקטגוריות והמוצרים הנוכחיים יימחקו, כולל סימוני ✓.'}
          </p>
        </>
      )}

      <div className="plan-summary">
        <span>
          {preview.cats} קטגוריות · {preview.count} מוצרים
        </span>
        <span className="num">{shekel(preview.total)}</span>
      </div>
    </Sheet>
  );
}
