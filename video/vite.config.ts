import { defineConfig } from 'vite';

// Bundles the tour scene into one classic script that video/index.html loads from disk.
export default defineConfig({
  build: {
    outDir: 'video',
    emptyOutDir: false,
    copyPublicDir: false,
    lib: { entry: 'video/film.ts', formats: ['iife'], name: 'TourFilm', fileName: () => 'tour.bundle.js' },
  },
});
