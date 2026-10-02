import { useEffect, useRef, useState, type PointerEvent, type ReactNode } from 'react';
import { bidi } from '../lib/format';
import type { ApartmentTour } from '../three/apartmentScene';

interface Caption {
  id: number;
  text: string;
  leaving: boolean;
}

/** Looping 3D fly-through of the apartment; `fallback` shows when WebGL is unavailable. */
export function Apartment3D({ fallback }: { fallback: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const bar = useRef<HTMLDivElement>(null);
  const tour = useRef<ApartmentTour | null>(null);
  const hovered = useRef(false);
  const [paused, setPaused] = useState(false);
  const [captions, setCaptions] = useState<Caption[]>([]);
  const [failed, setFailed] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let seq = 0;
    // The outgoing caption stays mounted just long enough to fade out under the new one.
    const onLabel = (text: string) =>
      setCaptions((prev) => [
        ...prev.filter((c) => !c.leaving).map((c) => ({ ...c, leaving: true })),
        { id: ++seq, text, leaving: false },
      ]);
    // Written straight to the element: a per-frame React update would re-render for nothing.
    const onFrame = (p: number) => {
      if (bar.current) bar.current.style.transform = `scaleX(${p})`;
    };
    import('../three/apartmentScene')
      .then(({ mountApartment }) => {
        if (cancelled || !ref.current) return;
        try {
          tour.current = mountApartment(ref.current, onLabel, onFrame);
          // The pointer may already be resting on the frame while the scene loads.
          if (hovered.current) tour.current.setPaused(true);
          setReady(true);
        } catch {
          setFailed(true);
        }
      })
      .catch(() => setFailed(true));
    return () => {
      cancelled = true;
      tour.current?.dispose();
      tour.current = null;
    };
  }, []);

  // Hovering with a mouse holds the frame so it can be looked at; leaving resumes the tour.
  // Touch has no hover, so on phones the tour simply keeps playing.
  const hold = (e: PointerEvent, on: boolean) => {
    if (e.pointerType !== 'mouse') return;
    hovered.current = on;
    tour.current?.setPaused(on);
    setPaused(on);
  };

  if (failed) return <>{fallback}</>;
  return (
    <div
      className={`apt3d${ready ? ' ready' : ''}${paused ? ' paused' : ''}`}
      onPointerEnter={(e) => hold(e, true)}
      onPointerLeave={(e) => hold(e, false)}
    >
      {/* The canvas lives in its own node so React never reconciles over it. */}
      <div className="apt3d-stage" ref={ref} />
      <div className="apt3d-captions" aria-hidden>
        {captions.map((c) => (
          <div
            key={c.id}
            className={`apt3d-label${c.leaving ? ' leaving' : ''}`}
            onAnimationEnd={() => c.leaving && setCaptions((prev) => prev.filter((x) => x.id !== c.id))}
          >
            <i />
            {bidi(c.text)}
          </div>
        ))}
      </div>
      <div className="apt3d-hold" aria-hidden>
        <i />
        <i />
      </div>
      <div className="apt3d-progress" aria-hidden>
        <div ref={bar} />
      </div>
    </div>
  );
}
