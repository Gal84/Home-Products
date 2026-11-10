import { useEffect, useRef, useState, type PointerEvent, type ReactNode } from 'react';
import { TourCaptions, useCaptions, VIDEO_CAPTIONS } from './TourCaptions';

/**
 * The apartment tour as a pre-rendered video (rendered offline with HyperFrames, see video/):
 * far better lighting than a phone can compute live, and it plays smoothly on anything.
 * `fallback` (the live 3D tour) takes over if the video cannot be played.
 */
export function TourVideo({ fallback }: { fallback: ReactNode }) {
  const video = useRef<HTMLVideoElement>(null);
  const bar = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [paused, setPaused] = useState(false);
  const { captions, show, remove } = useCaptions();

  useEffect(() => {
    const v = video.current;
    if (!v) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    // Autoplay can be refused (data saver, low-power mode): the poster frame stays, which is fine.
    if (!reduced) v.play().catch(() => {});
    // Some phones hold back video data until playback starts; show the poster frame regardless.
    const reveal = setTimeout(() => setReady(true), 2500);
    let raf = 0;
    let last = '';
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const t = v.currentTime;
      if (bar.current && v.duration) bar.current.style.transform = `scaleX(${t / v.duration})`;
      let label = VIDEO_CAPTIONS[0].label;
      for (const c of VIDEO_CAPTIONS) if (c.t <= t) label = c.label;
      if (label !== last) show((last = label));
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(reveal);
    };
  }, [show, failed]);

  // Hovering with a mouse holds the frame so it can be looked at; leaving resumes the tour.
  const hold = (e: PointerEvent, on: boolean) => {
    const v = video.current;
    if (e.pointerType !== 'mouse' || !v) return;
    if (on) v.pause();
    else if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) v.play().catch(() => {});
    setPaused(on);
  };

  if (failed) return <>{fallback}</>;
  return (
    <div
      className={`apt3d${ready ? ' ready' : ''}${paused ? ' paused' : ''}`}
      onPointerEnter={(e) => hold(e, true)}
      onPointerLeave={(e) => hold(e, false)}
    >
      <div className="apt3d-stage">
        <video
          ref={video}
          src="/tour/tour.mp4"
          poster="/tour/poster.jpg"
          muted
          loop
          playsInline
          preload="metadata"
          aria-hidden
          tabIndex={-1}
          disablePictureInPicture
          onLoadedData={() => setReady(true)}
          onError={() => setFailed(true)}
        />
      </div>
      <TourCaptions captions={captions} remove={remove} />
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
