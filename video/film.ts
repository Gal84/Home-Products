import { mountApartment } from '../src/three/apartmentScene';

/*
 * Entry for the pre-rendered tour. HyperFrames loads video/index.html in headless Chrome and
 * dispatches `hf-seek` for every frame, in any order; each frame is drawn from that time alone.
 */

interface SeekEvent extends Event {
  detail: { time: number };
}

const stage = document.getElementById('scene') as HTMLElement;
const root = document.getElementById('tour') as HTMLElement;
const samples = Number(new URLSearchParams(location.search).get('samples')) || Number(root.dataset.samples) || 8;
const fps = Number(root.dataset.fps) || 30;

const tour = mountApartment(stage, () => {}, undefined, { samples, fps });
const film = tour.film!;

// Read by scripts/render-tour.mjs to write the caption timeline next to the video.
(window as unknown as { __tour: unknown }).__tour = { duration: film.duration, labels: film.labels, seek: film.seek };

window.addEventListener('hf-seek', (e) => film.seek((e as SeekEvent).detail.time));
