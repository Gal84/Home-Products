import { useMemo, useState } from 'react';
import type { AcType, ApartmentProfile, AptType, BedroomUse, BudgetTier } from '../types';
import { applyPlan } from '../planner/generate';
import { APT_TYPE_LABEL, BEDROOM_LABEL, defaultBedrooms, withDefaults } from '../planner/templates';
import { emptyHome, live } from '../lib/store';
import { shekel, totals } from '../lib/format';
import { Sheet, Stepper } from './Sheet';
import { t, tr } from '../i18n';

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
  const setAptType = (aptType: AptType) =>
    setP((x) => ({
      ...x,
      aptType,
      floor: aptType === 'garden' ? 0 : x.floor || 1,
      gardenArea: aptType === 'garden' ? x.gardenArea || 60 : x.gardenArea,
      roofArea: aptType === 'penthouse' ? x.roofArea || 40 : x.roofArea,
    }));
  const setSize = (i: number, v: string) =>
    setP((x) => {
      const bedroomSizes = [...x.bedroomSizes];
      bedroomSizes[i] = v;
      return { ...x, bedroomSizes };
    });
  const set = <K extends keyof ApartmentProfile>(k: K, v: ApartmentProfile[K]) => setP((x) => ({ ...x, [k]: v }));

  const setRooms = (rooms: number) =>
    setP((x) => {
      const want = Math.max(0, rooms - 1);
      const bedrooms = x.bedrooms.slice(0, want);
      const defaults = defaultBedrooms(rooms);
      while (bedrooms.length < want) bedrooms.push(defaults[bedrooms.length] ?? 'kids');
      const bedroomSizes = x.bedroomSizes.slice(0, want);
      const mamad = x.mamad != null && x.mamad < want ? x.mamad : null;
      return { ...x, rooms, bedrooms, bedroomSizes, mamad };
    });

  const preview = useMemo(() => {
    const d = applyPlan(emptyHome(), p, 'merge');
    return { cats: live(d.categories).length, ...totals(live(d.items)) };
  }, [p]);

  return (
    <Sheet
      wide
      eyebrow={t('מתכנן הדירה')}
      title={t('ספרו לי על הדירה')}
      onClose={onClose}
      footer={
        <>
          <button className="btn accent" disabled={busy} onClick={() => onApply(p, mode)}>
            {t(hasData ? (mode === 'merge' ? 'הוספת החסר לרשימה' : 'בניית רשימה מחדש') : 'בניית הרשימה')}
          </button>
          <button className="btn ghost" onClick={onClose}>
            {t('ביטול')}
          </button>
        </>
      }
    >
      <h3 className="section-title">{t('הדירה')}</h3>
      <label className="field">
        <span>{t('שם')}</span>
        <input className="input" value={tr(p.name)} onChange={(e) => set('name', e.target.value)} />
      </label>
      <div className="field">
        <span>{t('סוג הדירה')}</span>
        <div className="seg" role="group" aria-label={t('סוג הדירה')}>
          {(Object.keys(APT_TYPE_LABEL) as AptType[]).map((o) => (
            <button type="button" key={o} aria-pressed={p.aptType === o} onClick={() => setAptType(o)}>
              {t(APT_TYPE_LABEL[o])}
            </button>
          ))}
        </div>
      </div>
      <div className="grid-3">
        {p.aptType !== 'garden' && (
          <label className="field">
            <span>{t('קומה')}</span>
            <Stepper label={t('קומה')} value={p.floor} max={80} onChange={(v) => set('floor', v)} />
          </label>
        )}
        {p.aptType === 'garden' && (
          <label className="field">
            <span>{t('שטח הגינה (מ״ר)')}</span>
            <Stepper label={t('שטח גינה')} value={p.gardenArea} max={1000} step={5} onChange={(v) => set('gardenArea', v)} />
          </label>
        )}
        {p.aptType === 'penthouse' && (
          <>
            <label className="field">
              <span>{t('מרפסת גג (מ״ר)')}</span>
              <Stepper label={t('מרפסת גג')} value={p.roofArea} max={500} step={5} onChange={(v) => set('roofArea', v)} />
            </label>
            <label className="toggle" style={{ alignSelf: 'end' }}>
              <input type="checkbox" checked={p.duplex} onChange={(e) => set('duplex', e.target.checked)} />
              <span>
                <b>{t('דופלקס')}</b>
                <small>{t('שתי קומות עם מדרגות')}</small>
              </span>
            </label>
          </>
        )}
      </div>
      <div className="grid-3">
        <label className="field">
          <span>{t('מספר חדרים (כולל סלון)')}</span>
          <Stepper label={t('חדרים')} value={p.rooms} min={1} max={12} onChange={setRooms} />
        </label>
        <label className="field">
          <span>{t('חדרי שירותים')}</span>
          <Stepper label={t('שירותים')} value={p.toilets} max={6} onChange={(v) => set('toilets', v)} />
        </label>
        <label className="field">
          <span>{t('חדרי מקלחת')}</span>
          <Stepper label={t('מקלחות')} value={p.showers} max={4} onChange={(v) => set('showers', v)} />
        </label>
        <label className="field">
          <span>{t('חדרי אמבטיה')}</span>
          <Stepper label={t('אמבטיות')} value={p.bathtubs} max={4} onChange={(v) => set('bathtubs', v)} />
        </label>
      </div>

      {p.bedrooms.length > 0 && (
        <>
          <h3 className="section-title">{t('ייעוד החדרים')}</h3>
          <p className="hint">{t('חדר אחד הוא הסלון. לכל שאר החדרים בחרו ייעוד, ואפשר לרשום מידות ולסמן איזה חדר הוא הממ״ד.')}</p>
          <div className="room-list">
            {p.bedrooms.map((use, i) => (
              <div className="room-row" key={i}>
                <span className="eyebrow">{t('חדר {n}', { n: i + 1 })}</span>
                <div className="seg" role="group" aria-label={t('ייעוד חדר {n}', { n: i + 1 })}>
                  {(Object.keys(BEDROOM_LABEL) as BedroomUse[]).map((u) => (
                    <button
                      type="button"
                      key={u}
                      aria-pressed={use === u}
                      onClick={() => set('bedrooms', p.bedrooms.map((b, j) => (j === i ? u : b)))}
                    >
                      {t(BEDROOM_LABEL[u].replace('חדר ', '').replace('שינה ', ''))}
                    </button>
                  ))}
                </div>
                <input
                  className="input num room-size"
                  dir="ltr"
                  aria-label={t('מידות חדר {n}', { n: i + 1 })}
                  placeholder="3.50×3.20"
                  value={p.bedroomSizes[i] ?? ''}
                  onChange={(e) => setSize(i, e.target.value)}
                />
                <button
                  type="button"
                  className="btn sm room-mamad"
                  aria-pressed={p.mamad === i}
                  onClick={() => set('mamad', p.mamad === i ? null : i)}
                >
                  {t('ממ״ד')}
                </button>
              </div>
            ))}
          </div>
        </>
      )}

      <h3 className="section-title">{t('מטבח')}</h3>
      <label className="toggle">
        <input
          type="checkbox"
          checked={!!p.kitchenIsland}
          onChange={(e) => set('kitchenIsland', e.target.checked ? { length: 150, depth: 90 } : null)}
        />
        <span>
          <b>{t('אי מטבח')}</b>
          <small>{t('כולל משטח, כיסאות בר ותאורה מעל')}</small>
        </span>
      </label>
      {p.kitchenIsland && (
        <div className="grid-2">
          <label className="field">
            <span>{t('אורך (ס״מ)')}</span>
            <Stepper label={t('אורך אי')} value={p.kitchenIsland.length} min={60} max={400} step={10} onChange={(v) => set('kitchenIsland', { ...p.kitchenIsland!, length: v })} />
          </label>
          <label className="field">
            <span>{t('עומק (ס״מ)')}</span>
            <Stepper label={t('עומק אי')} value={p.kitchenIsland.depth} min={40} max={200} step={10} onChange={(v) => set('kitchenIsland', { ...p.kitchenIsland!, depth: v })} />
          </label>
        </div>
      )}

      <h3 className="section-title">{t('מיזוג אוויר')}</h3>
      <div className="seg" role="group" aria-label={t('סוג מיזוג')}>
        {AC_TYPES.map((o) => (
          <button type="button" key={o.k} aria-pressed={p.acType === o.k} onClick={() => set('acType', o.k)}>
            {t(o.label)}
          </button>
        ))}
      </div>

      <h3 className="section-title">{t('מרפסת')}</h3>
      <div className="grid-3">
        <label className="field">
          <span>{t('שטח (מ״ר)')}</span>
          <Stepper label={t('שטח מרפסת')} value={p.balconyArea} max={200} onChange={(v) => set('balconyArea', v)} />
        </label>
        <label className="field">
          <span>{t('מתוכו מקורה (מ״ר)')}</span>
          <Stepper label={t('מקורה')} value={p.balconyCovered} max={p.balconyArea} onChange={(v) => set('balconyCovered', v)} />
        </label>
        <label className="field">
          <span>{t('סגירה (מ״ר)')}</span>
          <Stepper label={t('סגירת מרפסת')} value={p.balconyEnclosure} max={p.balconyArea} onChange={(v) => set('balconyEnclosure', v)} />
        </label>
      </div>

      <h3 className="section-title">{t('מחסן וחניות')}</h3>
      <div className="grid-3">
        <label className="field">
          <span>{t('מחסן (מ״ר)')}</span>
          <Stepper label={t('מחסן')} value={p.storageArea} max={40} onChange={(v) => set('storageArea', v)} />
        </label>
        <label className="field">
          <span>{t('חניות')}</span>
          <Stepper
            label={t('חניות')}
            value={p.parking}
            max={4}
            onChange={(v) => setP((x) => ({ ...x, parking: v, evChargers: Math.min(x.evChargers, v) }))}
          />
        </label>
        <label className="field">
          <span>{t('עמדות טעינה לרכב חשמלי')}</span>
          <Stepper label={t('עמדות טעינה')} value={p.evChargers} max={p.parking} onChange={(v) => set('evChargers', v)} />
        </label>
        <label className="toggle" style={{ alignSelf: 'end' }}>
          <input type="checkbox" checked={p.parkingCovered} onChange={(e) => set('parkingCovered', e.target.checked)} />
          <span>
            <b>{t('מקורות')}</b>
          </span>
        </label>
      </div>

      <h3 className="section-title">{t('חיות מחמד')}</h3>
      <div className="grid-3">
        <label className="field">
          <span>{t('חתולים')}</span>
          <Stepper label={t('חתולים')} value={p.cats} max={10} onChange={(v) => set('cats', v)} />
        </label>
        <label className="field">
          <span>{t('כלבים')}</span>
          <Stepper label={t('כלבים')} value={p.dogs} max={10} onChange={(v) => set('dogs', v)} />
        </label>
      </div>

      <h3 className="section-title">{t('תוספות ותקציב')}</h3>
      <div className="grid-2">
        <label className="toggle">
          <input type="checkbox" checked={p.works} onChange={(e) => set('works', e.target.checked)} />
          <span>
            <b>{t('עבודות ושדרוגים')}</b>
            <small>{t('בדק בית, חשמלאי, הובלה, תריסים')}</small>
          </span>
        </label>
        <label className="toggle">
          <input type="checkbox" checked={p.smartHome} onChange={(e) => set('smartHome', e.target.checked)} />
          <span>
            <b>{t('בית חכם ואבטחה')}</b>
            <small>{t('Mesh, מנעול, מצלמות, חיישנים')}</small>
          </span>
        </label>
      </div>
      <div className="field">
        <span>{t('רמת מחירים')}</span>
        <div className="seg" role="group" aria-label={t('רמת מחירים')}>
          {TIERS.map((o) => (
            <button type="button" key={o.k} aria-pressed={p.tier === o.k} onClick={() => set('tier', o.k)}>
              {t(o.label)}
            </button>
          ))}
        </div>
      </div>

      {hasData && (
        <>
          <h3 className="section-title">{t('מה לעשות עם הרשימה הקיימת?')}</h3>
          <div className="seg" role="group" aria-label={t('מצב')}>
            <button type="button" aria-pressed={mode === 'merge'} onClick={() => setMode('merge')}>
              {t('להוסיף רק מה שחסר')}
            </button>
            <button type="button" aria-pressed={mode === 'replace'} onClick={() => setMode('replace')}>
              {t('למחוק ולבנות מחדש')}
            </button>
          </div>
          <p className="hint">
            {t(
              mode === 'merge'
                ? 'מוצרים שכבר ברשימה (כולל מחירים וסימוני ✓) לא ישתנו.'
                : 'כל הקטגוריות והמוצרים הנוכחיים יימחקו, כולל סימוני ✓.',
            )}
          </p>
        </>
      )}

      <div className="plan-summary">
        <span>
          {t('{n} קטגוריות', { n: preview.cats })} · {t('{n} מוצרים', { n: preview.count })}
        </span>
        <span className="num">{shekel(preview.total)}</span>
      </div>
    </Sheet>
  );
}
