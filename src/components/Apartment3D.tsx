import { useEffect, useRef, useState, type ReactNode } from 'react';
import { bidi } from '../lib/format';

/** Looping 3D fly-through of the apartment; `fallback` shows when WebGL is unavailable. */
export function Apartment3D({ fallback }: { fallback: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [label, setLabel] = useState('');
  const [failed, setFailed] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let dispose: (() => void) | undefined;
    let cancelled = false;
    import('../three/apartmentScene')
      .then(({ mountApartment }) => {
        if (cancelled || !ref.current) return;
        try {
          dispose = mountApartment(ref.current, setLabel);
          setReady(true);
        } catch {
          setFailed(true);
        }
      })
      .catch(() => setFailed(true));
    return () => {
      cancelled = true;
      dispose?.();
    };
  }, []);

  if (failed) return <>{fallback}</>;
  return (
    <div className={`apt3d${ready ? ' ready' : ''}`}>
      {/* The canvas lives in its own node so React never reconciles over it. */}
      <div className="apt3d-stage" ref={ref} />
      {label && (
        <div className="apt3d-label" aria-hidden>
          <i />
          {bidi(label)}
        </div>
      )}
    </div>
  );
}
