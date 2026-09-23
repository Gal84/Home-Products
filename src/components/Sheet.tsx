import { useEffect, useRef, type ReactNode } from 'react';
import { IconClose } from './Icons';

interface Props {
  eyebrow?: string;
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}

export function Sheet({ eyebrow, title, onClose, children, footer, wide }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && closeRef.current();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    ref.current?.querySelector<HTMLElement>('[data-autofocus]')?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, []);

  return (
    <>
      <div className="scrim" onClick={onClose} />
      <div ref={ref} className={`sheet${wide ? ' wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="sheet-head">
          <div>
            {eyebrow && <div className="eyebrow">{eyebrow}</div>}
            <h2>{title}</h2>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="סגירה">
            <IconClose />
          </button>
        </div>
        <div className="sheet-body">{children}</div>
        {footer && <div className="sheet-foot">{footer}</div>}
      </div>
    </>
  );
}

export function Stepper({
  value,
  onChange,
  min = 0,
  max = 99,
  step = 1,
  label,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  label: string;
}) {
  const clamp = (v: number) => Math.min(max, Math.max(min, v));
  return (
    <div className="stepper">
      <button type="button" onClick={() => onChange(clamp(value + step))} aria-label={`הוספה — ${label}`}>
        +
      </button>
      <input
        inputMode="decimal"
        aria-label={label}
        value={value}
        onChange={(e) => {
          const v = Number(e.target.value.replace(/[^\d.]/g, ''));
          if (!Number.isNaN(v)) onChange(clamp(v));
        }}
      />
      <button type="button" onClick={() => onChange(clamp(value - step))} aria-label={`הפחתה — ${label}`}>
        −
      </button>
    </div>
  );
}
