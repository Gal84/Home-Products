import { useCallback, useRef, useState } from 'react';
import { bidi } from '../lib/format';
import { tr } from '../i18n';

interface Caption {
  id: number;
  text: string;
  leaving: boolean;
}

/** Room captions for the tour: the outgoing one stays mounted just long enough to fade out. */
export function useCaptions() {
  const [captions, setCaptions] = useState<Caption[]>([]);
  const seq = useRef(0);
  const show = useCallback(
    (text: string) =>
      setCaptions((prev) => [
        ...prev.filter((c) => !c.leaving).map((c) => ({ ...c, leaving: true })),
        { id: ++seq.current, text, leaving: false },
      ]),
    [],
  );
  const remove = useCallback((id: number) => setCaptions((prev) => prev.filter((c) => c.id !== id)), []);
  return { captions, show, remove };
}

export function TourCaptions({ captions, remove }: Pick<ReturnType<typeof useCaptions>, 'captions' | 'remove'>) {
  return (
    <div className="apt3d-captions" aria-hidden>
      {captions.map((c) => (
        <div key={c.id} className={`apt3d-label${c.leaving ? ' leaving' : ''}`} onAnimationEnd={() => c.leaving && remove(c.id)}>
          <i />
          {bidi(tr(c.text))}
        </div>
      ))}
    </div>
  );
}

/**
 * When each caption starts in the pre-rendered video (public/tour/tour.mp4), in seconds. Printed
 * by the film build (`window.__tour.labels` in video/index.html); update it if the camera path changes.
 */
export const VIDEO_CAPTIONS: { t: number; label: string }[] = [
  { t: 0, label: 'טיפוס A · קומה 19' },
  { t: 1, label: 'כניסה' },
  { t: 8, label: 'סלון' },
  { t: 12.75, label: 'מטבח · אי 150×90' },
  { t: 16.2, label: 'מרפסת · 20 מ״ר' },
  { t: 24.1, label: 'סלון' },
  { t: 29.4, label: 'מסדרון' },
  { t: 37, label: 'חדר הורים · 3.71×3.37' },
  { t: 42.25, label: 'מסדרון' },
  { t: 45.6, label: 'ממ״ד · 2.95×3.60' },
  { t: 51.5, label: 'טיפוס A · קומה 19' },
];
