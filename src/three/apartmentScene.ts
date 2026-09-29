import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

/*
 * A furnished 3D model of the owner's apartment (Damri "Afek", type A, floor 19), with a camera that
 * drops in from above, enters through the front door, floats through the rooms and rises out again
 * in a seamless loop. Coordinates are metres: x → east, z → south, y ↑. The plan is simplified but
 * keeps the real room sizes and adjacency.
 */

const WALL_H = 2.7;
const WALL_T = 0.12;

type LabelFn = (label: string) => void;

interface Rect {
  x0: number;
  x1: number;
  z0: number;
  z1: number;
}

// ─── Procedural textures ────────────────────────────────────────────────────

function canvasTexture(size: number, draw: (g: CanvasRenderingContext2D, s: number) => void) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  draw(c.getContext('2d')!, size);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

function rand(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function planks(base: [number, number, number], seed: number) {
  const r = rand(seed);
  return canvasTexture(512, (g, s) => {
    const rows = 8;
    const h = s / rows;
    for (let row = 0; row < rows; row++) {
      let x = -r() * 200;
      while (x < s) {
        const len = 180 + r() * 220;
        const k = 0.9 + r() * 0.2;
        g.fillStyle = `rgb(${base[0] * k},${base[1] * k},${base[2] * k})`;
        g.fillRect(x, row * h, len, h);
        g.strokeStyle = 'rgba(60,40,25,0.10)';
        g.lineWidth = 1;
        for (let i = 0; i < 6; i++) {
          const y = row * h + r() * h;
          g.beginPath();
          g.moveTo(x, y);
          g.bezierCurveTo(x + len * 0.3, y + (r() - 0.5) * 6, x + len * 0.6, y + (r() - 0.5) * 6, x + len, y);
          g.stroke();
        }
        g.fillStyle = 'rgba(50,35,20,0.35)';
        g.fillRect(x, row * h, 1.5, h);
        x += len;
      }
      g.fillStyle = 'rgba(50,35,20,0.3)';
      g.fillRect(0, row * h, s, 1.5);
    }
  });
}

function tiles(color: string, grout: string, n: number) {
  return canvasTexture(256, (g, s) => {
    g.fillStyle = grout;
    g.fillRect(0, 0, s, s);
    const t = s / n;
    const r = rand(n * 97);
    for (let i = 0; i < n; i++)
      for (let j = 0; j < n; j++) {
        g.fillStyle = color;
        g.globalAlpha = 0.92 + r() * 0.08;
        g.fillRect(i * t + 1.5, j * t + 1.5, t - 3, t - 3);
      }
    g.globalAlpha = 1;
  });
}

function marble() {
  const r = rand(42);
  return canvasTexture(512, (g, s) => {
    g.fillStyle = '#e9e3d9';
    g.fillRect(0, 0, s, s);
    for (let i = 0; i < 14; i++) {
      g.strokeStyle = `rgba(${120 + r() * 40},${110 + r() * 30},${100 + r() * 30},${0.07 + r() * 0.14})`;
      g.lineWidth = 0.6 + r() * 2.2;
      g.beginPath();
      let x = r() * s;
      let y = 0;
      g.moveTo(x, y);
      while (y < s) {
        const nx = x + (r() - 0.5) * 90;
        const ny = y + 30 + r() * 60;
        g.quadraticCurveTo(x + (r() - 0.5) * 60, (y + ny) / 2, nx, ny);
        x = nx;
        y = ny;
      }
      g.stroke();
    }
  });
}

function subway() {
  const r = rand(5);
  return canvasTexture(256, (g, s) => {
    g.fillStyle = '#cfc8bd';
    g.fillRect(0, 0, s, s);
    const h = s / 8;
    const w = s / 4;
    for (let row = 0; row < 8; row++)
      for (let col = -1; col < 5; col++) {
        const x = col * w + (row % 2 ? w / 2 : 0);
        const k = 238 + r() * 12;
        g.fillStyle = `rgb(${k},${k - 3},${k - 9})`;
        g.fillRect(x + 1.5, row * h + 1.5, w - 3, h - 3);
      }
  });
}

// ─── Scene building helpers ─────────────────────────────────────────────────

class Builder {
  readonly group = new THREE.Group();
  private mats = new Map<string, THREE.MeshStandardMaterial>();

  mat(color: string, roughness = 0.8, metalness = 0, extra: THREE.MeshStandardMaterialParameters = {}) {
    const key = `${color}|${roughness}|${metalness}|${JSON.stringify(extra)}`;
    let m = this.mats.get(key);
    if (!m) {
      m = new THREE.MeshStandardMaterial({ color, roughness, metalness, ...extra });
      this.mats.set(key, m);
    }
    return m;
  }

  add<T extends THREE.Object3D>(o: T, shadow = true): T {
    o.traverse((c) => {
      if ((c as THREE.Mesh).isMesh) {
        c.castShadow = shadow;
        c.receiveShadow = true;
      }
    });
    this.group.add(o);
    return o;
  }

  /** Box by its footprint centre (x, z) and bottom height y. */
  box(w: number, h: number, d: number, m: THREE.Material, x: number, y: number, z: number, radius = 0) {
    const geo = radius > 0 ? new RoundedBoxGeometry(w, h, d, 3, Math.min(radius, w / 2, h / 2, d / 2)) : new THREE.BoxGeometry(w, h, d);
    const mesh = new THREE.Mesh(geo, m);
    mesh.position.set(x, y + h / 2, z);
    return this.add(mesh);
  }

  cyl(rTop: number, rBottom: number, h: number, m: THREE.Material, x: number, y: number, z: number, seg = 24) {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBottom, h, seg), m);
    mesh.position.set(x, y + h / 2, z);
    return this.add(mesh);
  }

  sphere(r: number, m: THREE.Material, x: number, y: number, z: number, sy = 1) {
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(r, 20, 14), m);
    mesh.scale.y = sy;
    mesh.position.set(x, y, z);
    return this.add(mesh);
  }

  /** Floor with a repeating texture scaled to metres. */
  floor(r: Rect, m: THREE.Material, repeat = 2) {
    const w = r.x1 - r.x0;
    const d = r.z1 - r.z0;
    const geo = new THREE.PlaneGeometry(w, d);
    const uv = geo.attributes.uv as THREE.BufferAttribute;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) * w) / repeat, (uv.getY(i) * d) / repeat);
    const mesh = new THREE.Mesh(geo, m);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set((r.x0 + r.x1) / 2, 0.001, (r.z0 + r.z1) / 2);
    mesh.receiveShadow = true;
    this.group.add(mesh);
  }

  /** Ceiling that faces down: seen from inside, invisible from the overhead shots. */
  ceiling(r: Rect, m: THREE.Material) {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(r.x1 - r.x0, r.z1 - r.z0), m);
    mesh.rotation.x = Math.PI / 2;
    mesh.position.set((r.x0 + r.x1) / 2, WALL_H, (r.z0 + r.z1) / 2);
    this.group.add(mesh);
  }

  /**
   * Straight wall from (x1,z1) to (x2,z2). `gaps` are [from, to] distances along the wall; a gap is a
   * doorway (lintel above 2.1 m) or, with `window`, a window (sill below 0.9 m, glass in between).
   */
  wall(
    x1: number,
    z1: number,
    x2: number,
    z2: number,
    m: THREE.Material,
    gaps: { a: number; b: number; window?: boolean }[] = [],
    glass?: THREE.Material,
    height = WALL_H,
  ) {
    const len = Math.hypot(x2 - x1, z2 - z1);
    const dx = (x2 - x1) / len;
    const dz = (z2 - z1) / len;
    const angle = Math.atan2(-dz, dx);
    const piece = (a: number, b: number, y0: number, y1: number, mat: THREE.Material, t = WALL_T) => {
      if (b - a <= 0.001 || y1 - y0 <= 0.001) return;
      const mid = (a + b) / 2;
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(b - a, y1 - y0, t), mat);
      mesh.position.set(x1 + dx * mid, (y0 + y1) / 2, z1 + dz * mid);
      mesh.rotation.y = angle;
      this.add(mesh);
    };
    const sorted = [...gaps].sort((p, q) => p.a - q.a);
    let at = 0;
    for (const g of sorted) {
      piece(at, g.a, 0, height, m);
      if (g.window) {
        piece(g.a, g.b, 0, 0.9, m);
        piece(g.a, g.b, 2.25, height, m);
        if (glass) {
          piece(g.a, g.b, 0.9, 2.25, glass, 0.02);
          piece(g.a, g.b, 0.9, 0.95, this.mat('#2b2825', 0.5, 0.4), 0.06);
          piece(g.a, g.b, 2.2, 2.25, this.mat('#2b2825', 0.5, 0.4), 0.06);
        }
      } else {
        piece(g.a, g.b, 2.1, height, m);
      }
      at = g.b;
    }
    piece(at, len, 0, height, m);
  }
}

// ─── Furniture ──────────────────────────────────────────────────────────────

function plant(b: Builder, x: number, z: number, scale = 1, pot = '#d8c9b2') {
  b.cyl(0.2 * scale, 0.16 * scale, 0.42 * scale, b.mat(pot, 0.9), x, 0, z);
  const leaf = b.mat('#5c7a4a', 0.85);
  const leaf2 = b.mat('#4a6a3d', 0.85);
  const r = rand(Math.round(x * 100 + z * 7));
  for (let i = 0; i < 7; i++) {
    const a = r() * Math.PI * 2;
    const d = r() * 0.18 * scale;
    b.sphere((0.16 + r() * 0.12) * scale, i % 2 ? leaf : leaf2, x + Math.cos(a) * d, (0.62 + r() * 0.55) * scale, z + Math.sin(a) * d, 1.2);
  }
}

function pendant(b: Builder, x: number, z: number, y = 1.75, lights?: THREE.Group) {
  b.cyl(0.004, 0.004, WALL_H - y - 0.18, b.mat('#1e1c1a', 0.4, 0.6), x, y + 0.18, z, 6);
  b.cyl(0.05, 0.19, 0.2, b.mat('#1e1c1a', 0.45, 0.5), x, y, z);
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), new THREE.MeshBasicMaterial({ color: '#fff1d6' }));
  bulb.position.set(x, y + 0.02, z);
  b.group.add(bulb);
  if (lights) {
    const l = new THREE.PointLight('#ffd9a8', 1.6, 5, 2);
    l.position.set(x, y - 0.05, z);
    lights.add(l);
  }
}

function bed(b: Builder, x: number, z: number, w: number, len: number, rot: number, cover: string, head = '#cbbfae') {
  const g = new THREE.Group();
  const wood = b.mat('#7a5a40', 0.7);
  const add = (w2: number, h: number, d: number, m: THREE.Material, px: number, py: number, pz: number, r = 0.03) => {
    const mesh = new THREE.Mesh(new RoundedBoxGeometry(w2, h, d, 3, r), m);
    mesh.position.set(px, py + h / 2, pz);
    g.add(mesh);
  };
  add(w + 0.06, 0.3, len + 0.04, wood, 0, 0, 0, 0.02);
  add(w, 0.22, len - 0.05, b.mat('#f3efe8', 0.95), 0, 0.3, 0.02, 0.06);
  add(w + 0.02, 0.08, len * 0.62, b.mat(cover, 0.95), 0, 0.5, len * 0.19, 0.04);
  add(w * 0.42, 0.14, 0.34, b.mat('#faf7f1', 0.95), -w * 0.24, 0.52, -len / 2 + 0.28, 0.06);
  add(w * 0.42, 0.14, 0.34, b.mat('#faf7f1', 0.95), w * 0.24, 0.52, -len / 2 + 0.28, 0.06);
  add(w + 0.14, 1.05, 0.1, b.mat(head, 0.95), 0, 0.1, -len / 2 - 0.04, 0.04);
  g.position.set(x, 0, z);
  g.rotation.y = rot;
  b.add(g);
}

function chair(b: Builder, x: number, z: number, rot: number, color: string) {
  const g = new THREE.Group();
  const seat = new THREE.Mesh(new RoundedBoxGeometry(0.44, 0.06, 0.44, 2, 0.02), b.mat(color, 0.85));
  seat.position.set(0, 0.46, 0);
  const back = new THREE.Mesh(new RoundedBoxGeometry(0.44, 0.4, 0.05, 2, 0.02), b.mat(color, 0.85));
  back.position.set(0, 0.7, 0.2);
  g.add(seat, back);
  const leg = b.mat('#3a2c21', 0.6);
  for (const [lx, lz] of [
    [-0.18, -0.18],
    [0.18, -0.18],
    [-0.18, 0.18],
    [0.18, 0.18],
  ]) {
    const l = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.45, 6), leg);
    l.position.set(lx, 0.225, lz);
    g.add(l);
  }
  g.position.set(x, 0, z);
  g.rotation.y = rot;
  b.add(g);
}

function rug(b: Builder, r: Rect, color: string, border: string) {
  b.box(r.x1 - r.x0, 0.012, r.z1 - r.z0, b.mat(border, 1), (r.x0 + r.x1) / 2, 0.002, (r.z0 + r.z1) / 2);
  b.box(r.x1 - r.x0 - 0.16, 0.014, r.z1 - r.z0 - 0.16, b.mat(color, 1), (r.x0 + r.x1) / 2, 0.002, (r.z0 + r.z1) / 2);
}

type ArtStyle = 'circles' | 'blocks' | 'landscape' | 'lines';

/** A framed print; rot 0 faces +z, π faces −z, π/2 faces +x, −π/2 faces −x. */
function artwork(
  b: Builder,
  x: number,
  y: number,
  z: number,
  rot: number,
  w: number,
  h: number,
  colors: string[],
  style: ArtStyle = 'circles',
  frameColor = '#1e1c1a',
) {
  const g = new THREE.Group();
  const frame = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.03), b.mat(frameColor, 0.5));
  g.add(frame);
  const inner = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.08, h - 0.08), b.mat('#f2ece2', 0.95));
  inner.position.z = 0.016;
  g.add(inner);
  const iw = w - 0.2;
  const ih = h - 0.2;
  const shape = (geo: THREE.BufferGeometry, c: string, px: number, py: number, i: number) => {
    const m = new THREE.Mesh(geo, b.mat(c, 0.9));
    m.position.set(px, py, 0.018 + i * 0.001);
    g.add(m);
  };
  colors.forEach((c, i) => {
    const n = colors.length;
    if (style === 'circles') shape(new THREE.CircleGeometry(iw * (0.32 - i * 0.07), 32), c, (i - 1) * w * 0.14, (i % 2 ? -1 : 1) * h * 0.08, i);
    if (style === 'blocks') shape(new THREE.PlaneGeometry(iw * 0.86, (ih / n) * 0.82), c, 0, ih / 2 - (ih / n) * (i + 0.5), i);
    if (style === 'lines') shape(new THREE.PlaneGeometry(iw * 0.07, ih * (0.55 + (i % 3) * 0.15)), c, -iw / 2 + (iw / (n + 1)) * (i + 1), -ih * 0.05, i);
    if (style === 'landscape') {
      if (i === 0) shape(new THREE.PlaneGeometry(iw, ih * 0.55), c, 0, ih * 0.22, i);
      else if (i === colors.length - 1) shape(new THREE.CircleGeometry(ih * 0.12, 24), c, iw * 0.22, ih * 0.25, i + 4);
      else shape(new THREE.CircleGeometry(iw * (0.5 - i * 0.08), 40, 0, Math.PI), c, (i % 2 ? -1 : 1) * iw * 0.18, -ih / 2, i);
    }
  });
  g.position.set(x, y, z);
  g.rotation.y = rot;
  b.add(g, false);
}

// ─── The apartment ──────────────────────────────────────────────────────────

function buildApartment(b: Builder, lights: THREE.Group) {
  const wall = b.mat('#efe9df', 0.95);
  const accentWall = b.mat('#d9c9b3', 0.95);
  const glass = new THREE.MeshStandardMaterial({ color: '#cfe0e6', roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.16 });
  // Ceilings only get bounce light, so they glow slightly to read as white rather than brown.
  const ceilingMat = b.mat('#f6f2ec', 1, 0, { emissive: '#d9d0c3', emissiveIntensity: 0.6 });

  const oak = new THREE.MeshStandardMaterial({ map: planks([200, 165, 122], 7), roughness: 0.72 });
  const tile = new THREE.MeshStandardMaterial({ map: tiles('#dcd5ca', '#c3b9ab', 4), roughness: 0.55 });
  const deck = new THREE.MeshStandardMaterial({ map: planks([150, 128, 108], 3), roughness: 0.85 });
  const lobbyTile = new THREE.MeshStandardMaterial({ map: tiles('#e6e0d6', '#cfc6b8', 3), roughness: 0.6 });

  const R = {
    living: { x0: 0, x1: 7, z0: 0, z1: 8.4 },
    balcony: { x0: 0, x1: 7.3, z0: -2.7, z1: 0 },
    hall: { x0: 7, x1: 11, z0: 4.9, z1: 7.3 },
    hall2: { x0: 7.1, x1: 8.6, z0: 7.3, z1: 9.2 },
    mamad: { x0: 7, x1: 10.2, z0: 1.3, z1: 4.9 },
    bed2: { x0: 10.2, x1: 13.2, z0: 1.4, z1: 4.9 },
    ensuite: { x0: 13.2, x1: 15, z0: 2.3, z1: 4.9 },
    master: { x0: 11, x1: 15, z0: 4.9, z1: 8.3 },
    bath: { x0: 8.6, x1: 11, z0: 7.3, z1: 9.2 },
    bed1: { x0: 5.4, x1: 9, z0: 9.2, z1: 13.3 },
    wc: { x0: 5.4, x1: 7.1, z0: 8.4, z1: 9.2 },
    lobby: { x0: -0.6, x1: 4.2, z0: 8.4, z1: 11.2 },
  } satisfies Record<string, Rect>;

  // Structural slab under the whole flat.
  const slab = b.mat('#d6cec2', 0.95);
  for (const r of Object.values(R)) {
    b.box(r.x1 - r.x0 + 0.12, 0.3, r.z1 - r.z0 + 0.12, slab, (r.x0 + r.x1) / 2, -0.3, (r.z0 + r.z1) / 2);
  }
  for (const k of ['living', 'hall', 'hall2', 'mamad', 'bed2', 'master', 'bed1'] as const) b.floor(R[k], oak, 2.4);
  for (const k of ['ensuite', 'bath', 'wc'] as const) b.floor(R[k], tile, 1.2);
  b.floor(R.balcony, deck, 2);
  b.floor(R.lobby, lobbyTile, 1.8);
  for (const k of ['living', 'hall', 'hall2', 'mamad', 'bed2', 'ensuite', 'master', 'bath', 'bed1', 'wc'] as const) b.ceiling(R[k], ceilingMat);
  b.ceiling({ x0: 0, x1: 7.3, z0: -1.4, z1: 0 }, ceilingMat); // covered half of the balcony (floor 20 above)
  b.box(7.42, 0.25, 1.4, slab, 3.65, WALL_H, -0.7);

  // ── Walls ──
  // Living room: sliding doors to the balcony (open in the middle), TV wall, entrance, WC.
  b.wall(0, 0, 2.4, 0, glass, [], undefined);
  b.wall(4.4, 0, 7, 0, glass);
  for (const x of [0, 1.2, 2.4, 4.4, 5.7, 7]) b.box(0.05, WALL_H, 0.08, b.mat('#2b2825', 0.5, 0.4), x, 0, 0);
  b.box(7, 0.06, 0.1, b.mat('#2b2825', 0.5, 0.4), 3.5, WALL_H - 0.06, 0);
  b.wall(0, 0, 0, 8.4, wall, [{ a: 0.6, b: 1.8, window: true }], glass);
  b.wall(0, 8.4, 7.1, 8.4, wall, [
    { a: 0.8, b: 1.8 },
    { a: 5.9, b: 6.6 },
  ]);
  b.wall(7, 0, 7, 4.9, wall);
  b.wall(7.05, 7.3, 7.05, 9.2, wall);
  // Bedroom wing.
  b.wall(7, 1.3, 10.2, 1.3, wall, [{ a: 1.0, b: 2.2, window: true }], glass);
  b.wall(10.2, 1.4, 13.2, 1.4, wall, [{ a: 0.9, b: 2.1, window: true }], glass);
  b.wall(10.2, 1.3, 10.2, 4.9, wall);
  b.wall(13.2, 1.4, 13.2, 4.9, wall);
  b.wall(13.2, 2.3, 15, 2.3, wall);
  b.wall(7, 4.9, 15, 4.9, wall, [
    { a: 1.9, b: 2.7 },
    { a: 3.35, b: 3.95 },
    { a: 6.5, b: 7.1 },
  ]);
  b.wall(15, 2.3, 15, 8.3, wall, [{ a: 3.3, b: 5.0, window: true }], glass);
  b.wall(11, 8.3, 15, 8.3, wall, [{ a: 1.3, b: 3.0, window: true }], glass);
  b.wall(11, 4.9, 11, 9.2, wall, [{ a: 0.5, b: 1.3 }]);
  b.wall(8.6, 7.3, 11, 7.3, wall, [{ a: 0.6, b: 1.3 }]);
  b.wall(8.6, 7.3, 8.6, 9.2, wall);
  b.wall(5.4, 9.2, 11, 9.2, wall, [{ a: 2.0, b: 2.8 }]);
  b.wall(5.4, 8.4, 5.4, 13.3, wall);
  b.wall(5.4, 13.3, 9, 13.3, wall, [{ a: 1.0, b: 2.6, window: true }], glass);
  b.wall(9, 9.2, 9, 13.3, wall);
  // Master bedroom accent wall behind the bed.
  b.box(0.02, WALL_H - 0.02, 3.2, accentWall, 14.93, 0, 6.6);
  const lightOak = b.mat('#c9a57a', 0.65);
  for (let z = 5.08; z < 8.14; z += 0.075) b.box(0.03, WALL_H - 0.02, 0.04, lightOak, 14.905, 0, z);

  // Front door, open inwards, with a frame.
  const door = b.mat('#5b4331', 0.6);
  const frame = b.mat('#2b2825', 0.5, 0.3);
  b.box(0.06, 2.12, 0.14, frame, 0.8, 0, 8.4);
  b.box(0.06, 2.12, 0.14, frame, 1.8, 0, 8.4);
  b.box(1.06, 0.06, 0.14, frame, 1.3, 2.08, 8.4);
  b.box(0.05, 2.05, 0.95, door, 0.86, 0, 7.9);
  b.box(0.04, 0.04, 0.16, b.mat('#b08d57', 0.3, 0.8), 0.92, 1.0, 7.5);

  // Balcony: glass railing, side wall and a planter.
  const rail = new THREE.MeshStandardMaterial({ color: '#d7e6ea', roughness: 0.05, transparent: true, opacity: 0.22 });
  b.wall(0, -2.7, 7.3, -2.7, rail, [], undefined, 1.1);
  b.wall(0, -2.7, 0, 0, rail, [], undefined, 1.1);
  b.box(7.3, 0.04, 0.06, b.mat('#2b2825', 0.5, 0.4), 3.65, 1.08, -2.7);
  b.wall(7.3, -2.7, 7.3, 0, wall);

  // ── Living room ──
  const walnut = b.mat('#6b4a33', 0.6);
  const sage = b.mat('#8c9b7e', 0.95);
  const sand = b.mat('#d8cbb6', 0.95);
  const terracotta = b.mat('#b5522b', 0.9);
  rug(b, { x0: 0.9, x1: 3.9, z0: 2.6, z1: 5.8 }, '#e6dccb', '#b9a78d');
  // L-shaped sofa facing the TV wall.
  b.box(0.95, 0.42, 2.8, sage, 3.3, 0, 4.2, 0.06);
  b.box(0.22, 0.42, 2.8, sage, 3.72, 0.4, 4.2, 0.08);
  b.box(1.4, 0.42, 0.95, sage, 2.4, 0, 5.1, 0.06);
  b.box(0.9, 0.22, 0.2, sage, 2.35, 0.4, 5.53, 0.08);
  for (const z of [3.2, 3.9, 4.6]) b.box(0.18, 0.4, 0.48, sand, 3.56, 0.42, z, 0.08);
  b.box(0.16, 0.32, 0.38, terracotta, 3.56, 0.42, 5.2, 0.08);
  // Coffee table + TV console + TV.
  b.cyl(0.55, 0.55, 0.05, walnut, 1.9, 0.36, 4.0, 40);
  b.cyl(0.08, 0.08, 0.36, b.mat('#1e1c1a', 0.4, 0.6), 1.9, 0, 4.0);
  b.cyl(0.08, 0.1, 0.18, b.mat('#efe6d8', 0.6), 1.75, 0.41, 3.9);
  // TV feature wall: marble slab behind an 85" screen, walnut slats either side, floating console.
  const marbleMat = new THREE.MeshStandardMaterial({ map: marble(), roughness: 0.3 });
  b.box(0.04, WALL_H, 2.3, marbleMat, 0.08, 0, 4.1);
  for (let z = 2.45; z < 2.93; z += 0.07) b.box(0.035, WALL_H, 0.035, walnut, 0.078, 0, z);
  for (let z = 5.29; z < 5.8; z += 0.07) b.box(0.035, WALL_H, 0.035, walnut, 0.078, 0, z);
  b.box(0.01, 1.15, 1.98, b.mat('#ffd9a8', 1, 0, { emissive: '#ffcf93', emissiveIntensity: 0.9 }), 0.105, 0.82, 4.1);
  b.box(0.04, 1.08, 1.9, b.mat('#141312', 0.25, 0.3), 0.12, 0.86, 4.1);
  b.box(0.005, 1.02, 1.84, b.mat('#1f2a33', 0.15, 0.2), 0.143, 0.89, 4.1);
  b.box(0.42, 0.3, 2.4, walnut, 0.31, 0.24, 4.1, 0.02);
  b.box(0.36, 0.01, 2.3, b.mat('#1e1c1a', 0.5), 0.31, 0.385, 4.1);
  // Armchair.
  b.box(0.8, 0.4, 0.8, terracotta, 1.6, 0, 2.1, 0.12);
  b.box(0.8, 0.45, 0.16, terracotta, 1.6, 0.38, 1.76, 0.07);
  // Floor lamp.
  b.cyl(0.14, 0.14, 0.02, b.mat('#1e1c1a', 0.4, 0.6), 3.9, 0, 2.7);
  b.cyl(0.012, 0.012, 1.5, b.mat('#1e1c1a', 0.4, 0.6), 3.9, 0, 2.7, 6);
  b.cyl(0.14, 0.2, 0.28, b.mat('#f3e9d8', 0.9, 0, { emissive: '#ffdca8', emissiveIntensity: 0.35 }), 3.9, 1.45, 2.7);
  artwork(b, 0.08, 1.6, 6.8, Math.PI / 2, 1.1, 0.8, ['#b5522b', '#c08a2e', '#46607a']);
  artwork(b, 4.75, 1.5, 8.32, Math.PI, 0.9, 1.15, ['#cfd9de', '#8c9b7e', '#6b6b3a', '#c08a2e'], 'landscape', '#c9a57a');
  plant(b, 0.55, 0.6, 1.25, '#b5522b');
  plant(b, 6.6, 7.9, 1.1);
  // Entrance console.
  b.box(1.1, 0.8, 0.35, walnut, 3.1, 0, 8.18, 0.02);
  b.box(0.7, 0.9, 0.03, b.mat('#d3dcdd', 0.15, 0.15), 3.1, 1.25, 8.33);

  // Kitchen: counters on the east wall, tall units, island 150×90 with stools and pendants.
  const cab = b.mat('#cfc6b8', 0.7);
  const quartz = b.mat('#f4f1ec', 0.35);
  b.box(0.62, 0.88, 3.8, cab, 6.66, 0, 2.6, 0.01);
  b.box(0.66, 0.04, 3.8, quartz, 6.64, 0.88, 2.6);
  b.box(0.62, 2.3, 1.2, cab, 6.66, 0, 0.6, 0.01);
  b.box(0.35, 0.7, 2.6, cab, 6.8, 1.55, 3.1, 0.01);
  b.box(0.5, 0.02, 0.6, b.mat('#1b1a19', 0.2, 0.3), 6.62, 0.92, 3.4);
  b.box(0.9, 0.88, 1.5, b.mat('#3f4a44', 0.7), 5.0, 0, 2.75, 0.01);

  // Door seams and small, slim brass pulls.
  const brass = b.mat('#b08d57', 0.3, 0.8);
  const seam = b.mat('#8f877b', 0.8);
  const doors = (x: number, z0: number, z1: number, n: number, y0: number, h: number, handleY: number, facing: 1 | -1, vertical = false) => {
    const w = (z1 - z0) / n;
    for (let i = 0; i < n; i++) {
      const zc = z0 + w * (i + 0.5);
      if (i > 0) b.box(0.006, h - 0.04, 0.006, seam, x, y0 + 0.02, z0 + w * i);
      const hx = x + facing * 0.012;
      if (vertical) b.box(0.012, 0.2, 0.012, brass, hx, handleY - 0.1, zc + (i % 2 ? -1 : 1) * (w / 2 - 0.06));
      else b.box(0.012, 0.012, 0.14, brass, hx, handleY, zc);
    }
  };
  doors(6.345, 0.7, 4.5, 6, 0, 0.88, 0.8, -1);
  doors(6.345, 0, 1.2, 2, 0, 2.3, 1.15, -1, true);
  doors(6.62, 1.8, 4.4, 4, 1.55, 0.7, 1.6, -1);
  doors(5.455, 2.0, 3.5, 3, 0, 0.88, 0.8, 1);

  // Undermount sink with a brass gooseneck tap.
  b.box(0.46, 0.012, 0.62, b.mat('#aab1b3', 0.25, 0.8), 6.6, 0.915, 2.0);
  b.box(0.38, 0.006, 0.54, b.mat('#5d6366', 0.35, 0.7), 6.6, 0.924, 2.0);
  b.cyl(0.025, 0.03, 0.05, brass, 6.86, 0.92, 2.0);
  b.cyl(0.012, 0.012, 0.3, brass, 6.86, 0.97, 2.0, 12);
  const spout = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.012, 8, 24, Math.PI), brass);
  spout.position.set(6.75, 1.27, 2.0);
  b.add(spout);
  b.cyl(0.012, 0.01, 0.06, brass, 6.64, 1.21, 2.0, 12);

  // Off-white tile splashback between counter and wall units.
  const splash = new THREE.MeshStandardMaterial({ map: subway(), roughness: 0.35 });
  const sp = new THREE.Mesh(new THREE.PlaneGeometry(3.3, 0.65), splash);
  const uv = sp.geometry.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 5.5, uv.getY(i) * 1.1);
  sp.position.set(6.935, 1.245, 2.85);
  sp.rotation.y = -Math.PI / 2;
  b.add(sp, false);
  b.box(1.0, 0.05, 1.62, quartz, 5.0, 0.88, 2.75);
  b.box(1.0, 0.9, 0.05, quartz, 5.0, 0, 3.55);
  for (const z of [2.25, 2.75, 3.25]) {
    b.cyl(0.19, 0.19, 0.05, b.mat('#c9a57a', 0.6), 4.25, 0.68, z);
    b.cyl(0.015, 0.015, 0.68, b.mat('#1e1c1a', 0.4, 0.6), 4.25, 0, z, 6);
  }
  pendant(b, 5.0, 2.4, 1.85, lights);
  pendant(b, 5.0, 3.1, 1.85);
  b.cyl(0.12, 0.1, 0.12, b.mat('#efe6d8', 0.6), 5.1, 0.93, 2.6);
  for (const [dx, dz] of [
    [0.0, 0.0],
    [0.06, 0.07],
    [-0.06, 0.05],
  ])
    b.sphere(0.045, b.mat('#e0a24a', 0.7), 5.1 + dx, 1.07, 2.6 + dz);

  // Dining table with six chairs and a pendant.
  b.box(1.9, 0.05, 0.95, walnut, 3.0, 0.72, 6.9, 0.02);
  for (const x of [2.2, 3.8]) b.box(0.08, 0.72, 0.8, walnut, x, 0, 6.9);
  for (const x of [2.45, 3.0, 3.55]) {
    chair(b, x, 6.35, Math.PI, '#d8cbb6');
    chair(b, x, 7.45, 0, '#d8cbb6');
  }
  pendant(b, 3.0, 6.9, 1.6, lights);

  // ── Balcony ──
  b.box(2.2, 0.36, 0.8, b.mat('#e9e2d6', 0.95), 1.6, 0, -2.1, 0.08);
  b.box(2.2, 0.35, 0.18, b.mat('#e9e2d6', 0.95), 1.6, 0.34, -2.4, 0.06);
  b.box(0.8, 0.36, 0.8, b.mat('#e9e2d6', 0.95), 0.55, 0, -1.3, 0.08);
  b.cyl(0.35, 0.35, 0.04, b.mat('#c9a57a', 0.6), 1.7, 0.4, -1.2);
  b.cyl(0.03, 0.03, 0.4, b.mat('#2b2825', 0.5), 1.7, 0, -1.2, 6);
  b.box(0.8, 0.4, 0.8, terracotta, 5.4, 0, -1.6, 0.1);
  plant(b, 6.8, -2.3, 1.3, '#b5522b');
  plant(b, 0.4, -2.35, 1.0);
  plant(b, 4.2, -2.4, 0.8);

  // ── Hallway ──
  rug(b, { x0: 7.4, x1: 10.6, z0: 5.7, z1: 6.5 }, '#c4a88a', '#8c6f55');
  artwork(b, 10.45, 1.55, 7.23, Math.PI, 0.9, 1.1, ['#b5522b', '#d8cbb6', '#46607a'], 'blocks');
  artwork(b, 8.9, 1.6, 7.23, Math.PI, 0.42, 0.56, ['#1e1c1a', '#b5522b', '#1e1c1a', '#c08a2e'], 'lines', '#c9a57a');
  artwork(b, 8.6, 1.55, 4.97, 0, 0.5, 0.65, ['#7e8c6a', '#c08a2e']);

  // ── ממ״ד as a study ──
  b.box(1.5, 0.04, 0.7, b.mat('#c9a57a', 0.6), 8.6, 0.74, 1.72);
  for (const x of [7.9, 9.3]) b.box(0.05, 0.74, 0.6, b.mat('#1e1c1a', 0.4, 0.6), x, 0, 1.72);
  b.box(0.6, 0.36, 0.03, b.mat('#141312', 0.3), 8.6, 1.0, 1.55);
  b.box(0.3, 0.02, 0.2, b.mat('#1e1c1a', 0.5), 8.6, 0.78, 1.55);
  chair(b, 8.6, 2.35, Math.PI, '#2e2b28');
  b.box(0.35, 2.0, 1.6, b.mat('#efe6d8', 0.8), 7.25, 0, 3.4, 0.01);
  for (let i = 0; i < 4; i++) b.box(0.3, 0.26, 1.4, b.mat(['#b5522b', '#46607a', '#c08a2e', '#7e8c6a'][i], 0.9), 7.25, 0.25 + i * 0.45, 3.4);
  b.box(0.12, 2.05, 0.9, b.mat('#8b8f8e', 0.35, 0.7), 9.3, 0, 4.85);
  plant(b, 9.8, 1.7, 0.9);
  artwork(b, 10.13, 1.55, 3.0, -Math.PI / 2, 1.0, 0.7, ['#e6dccb', '#b5522b', '#46607a'], 'lines');

  // ── Bedroom 2 (guest) ──
  bed(b, 11.7, 3.3, 1.4, 1.95, Math.PI, '#b9c3b0');
  b.box(0.45, 0.5, 0.4, walnut, 10.65, 0, 4.4, 0.02);
  b.box(1.6, 2.3, 0.6, b.mat('#efe6d8', 0.8), 12.3, 0, 1.75, 0.01);
  rug(b, { x0: 10.6, x1: 12.8, z0: 2.5, z1: 3.6 }, '#e4d6c3', '#c9b394');
  artwork(b, 11.7, 1.6, 4.83, Math.PI, 1.1, 0.6, ['#dfe7ea', '#8c9b7e', '#7e8c6a', '#e0a24a'], 'landscape', '#c9a57a');

  // ── Master bedroom ──
  bed(b, 14.0, 6.6, 1.6, 2.0, -Math.PI / 2, '#b5522b', '#d8cbb6');
  for (const z of [5.45, 7.75]) {
    b.box(0.45, 0.5, 0.42, walnut, 14.7, 0, z, 0.02);
    b.cyl(0.1, 0.12, 0.3, b.mat('#efe6d8', 0.8, 0, { emissive: '#ffd49a', emissiveIntensity: 0.3 }), 14.7, 0.5, z);
  }
  rug(b, { x0: 12.2, x1: 13.4, z0: 5.6, z1: 7.6 }, '#e8dfd1', '#b9a78d');
  b.box(2.6, 2.4, 0.6, b.mat('#e9e1d4', 0.75), 12.4, 0, 7.95, 0.01);
  for (const x of [11.75, 12.4, 13.05]) b.box(0.02, 2.3, 0.01, b.mat('#b8ab98', 0.8), x, 0.05, 7.64);
  b.box(0.9, 0.45, 0.45, sand, 11.5, 0, 5.3, 0.06);
  plant(b, 14.6, 8.0, 1.0);
  pendant(b, 13.2, 6.6, 2.0, lights);
  for (const z of [5.45, 7.75]) {
    b.cyl(0.05, 0.05, 0.18, b.mat('#b08d57', 0.3, 0.8), 14.83, 1.35, z, 16);
    b.sphere(0.045, b.mat('#fff1d6', 1, 0, { emissive: '#ffd9a8', emissiveIntensity: 1 }), 14.83, 1.58, z);
  }
  artwork(b, 12.2, 1.6, 4.97, 0, 1.2, 0.8, ['#b5522b', '#e0a24a', '#6e4a5e'], 'circles', '#c9a57a');

  // ── En-suite shower ──
  b.box(0.9, 0.02, 0.9, b.mat('#cfc7bb', 0.4), 14.5, 0.01, 2.8);
  b.wall(14.0, 2.3, 14.0, 3.3, glass);
  b.box(0.4, 0.42, 0.55, b.mat('#f6f4f0', 0.3), 14.6, 0, 4.55, 0.1);
  b.box(0.9, 0.55, 0.45, walnut, 13.7, 0.3, 4.65, 0.01);
  b.box(0.7, 0.05, 0.45, quartz, 13.7, 0.85, 4.65);
  b.box(0.7, 0.9, 0.02, b.mat('#d3dcdd', 0.15, 0.15), 13.7, 1.15, 4.87);

  // Wet rooms have no daylight in the model; a soft ceiling light keeps them from reading as black.
  for (const [x, z] of [
    [14.1, 3.6],
    [9.8, 8.2],
    [6.2, 8.8],
  ]) {
    const l = new THREE.PointLight('#fff1dc', 1.2, 4, 2);
    l.position.set(x, 2.4, z);
    lights.add(l);
  }

  // ── Bathroom with tub ──
  b.box(1.7, 0.55, 0.75, b.mat('#f6f4f0', 0.25), 9.9, 0, 8.75, 0.08);
  b.box(1.5, 0.05, 0.55, b.mat('#bcd3da', 0.15), 9.9, 0.49, 8.75);
  b.box(0.9, 0.5, 0.45, walnut, 9.4, 0.35, 7.55, 0.01);
  b.box(0.9, 0.05, 0.45, quartz, 9.4, 0.85, 7.55);
  b.box(0.4, 0.4, 0.55, b.mat('#f6f4f0', 0.3), 8.85, 0, 8.0, 0.1);

  // ── Guest WC ──
  b.box(0.38, 0.4, 0.55, b.mat('#f6f4f0', 0.3), 6.7, 0, 8.9, 0.1);
  b.box(0.4, 0.12, 0.3, b.mat('#f6f4f0', 0.3), 5.75, 0.8, 8.62, 0.04);

  // ── Kids' bedroom ──
  bed(b, 6.1, 11.3, 1.2, 1.95, 0, '#46607a', '#e4d6c3');
  b.box(1.2, 0.04, 0.6, b.mat('#c9a57a', 0.6), 8.3, 0.72, 11.6);
  for (const z of [11.35, 11.85]) b.box(0.04, 0.72, 0.04, b.mat('#efe6d8', 0.6), 7.75, 0, z);
  chair(b, 7.8, 11.6, -Math.PI / 2, '#c08a2e');
  b.box(1.8, 2.2, 0.6, b.mat('#efe6d8', 0.8), 7.95, 0, 9.55, 0.01);
  rug(b, { x0: 6.3, x1: 8.2, z0: 12.1, z1: 13.1 }, '#e7c9a0', '#c08a2e');
  for (let i = 0; i < 3; i++) b.box(0.6, 0.02, 0.22, b.mat('#efe6d8', 0.8), 8.6, 1.3 + i * 0.35, 12.9);
  plant(b, 5.7, 12.95, 0.8);
  const kidsPaint = b.mat('#a9b89c', 0.95);
  b.box(0.01, 1.1, 4.0, kidsPaint, 5.465, 0, 11.25);
  b.box(0.01, 1.1, 4.0, kidsPaint, 8.935, 0, 11.25);
  b.box(0.02, 0.03, 4.0, b.mat('#f6f2ec', 0.6), 5.47, 1.1, 11.25);
  artwork(b, 5.48, 1.65, 10.9, Math.PI / 2, 0.5, 0.7, ['#e0a24a', '#46607a', '#b5522b'], 'circles', '#f6f2ec');
  artwork(b, 5.48, 1.65, 11.7, Math.PI / 2, 0.5, 0.7, ['#b5522b', '#e0a24a', '#46607a', '#7e8c6a'], 'blocks', '#f6f2ec');

  // ── Lobby outside the front door ──
  b.box(0.9, 2.2, 0.1, b.mat('#8b8f8e', 0.35, 0.6), 3.4, 0, 11.15);
  b.box(0.1, 0.16, 0.02, b.mat('#8b8f8e', 0.35, 0.6), 1.98, 1.35, 8.47);
  plant(b, -0.25, 9.1, 1.1);
}

// ─── City outside (floor 19) ────────────────────────────────────────────────

function buildCity(scene: THREE.Scene) {
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(1600, 1600), new THREE.MeshLambertMaterial({ color: '#bfb4a2' }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -58;
  scene.add(ground);
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(900, 500), new THREE.MeshLambertMaterial({ color: '#9fb4b9' }));
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(-150, -57.8, -420);
  scene.add(sea);
  const r = rand(1234);
  const geo = new THREE.BoxGeometry(1, 1, 1);
  geo.translate(0, 0.5, 0);
  const palette = ['#e2d9cc', '#d6ccbd', '#cbbfae', '#e9e2d7', '#bfb3a2'].map((c) => new THREE.MeshLambertMaterial({ color: c }));
  // Floor 19 is ~58 m up: most of the city sits below eye level, with a few towers further out.
  for (let i = 0; i < 190; i++) {
    const a = r() * Math.PI * 2;
    const d = 75 + r() * 330;
    const x = 7 + Math.cos(a) * d;
    const z = 5 + Math.sin(a) * d;
    const tower = d > 170 && r() < 0.12;
    const h = tower ? 60 + r() * 25 : 8 + r() * 34;
    const m = new THREE.Mesh(geo, palette[i % palette.length]);
    m.scale.set(12 + r() * 18, h, 12 + r() * 18);
    m.position.set(x, -58, z);
    m.rotation.y = r() * Math.PI;
    scene.add(m);
  }
  const hill = new THREE.MeshLambertMaterial({ color: '#a9a58e' });
  for (const [x, z, s] of [
    [-420, 260, 240],
    [-200, 420, 200],
    [120, 520, 260],
  ]) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 12), hill);
    m.scale.set(s, s * 0.28, s * 0.7);
    m.position.set(x, -60, z);
    scene.add(m);
  }
  // Sky dome with a warm gradient.
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(900, 32, 16),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: { top: { value: new THREE.Color('#b9cdd6') }, bottom: { value: new THREE.Color('#f3e8d8') } },
      vertexShader: 'varying float h; void main(){ h = normalize(position).y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader:
        'uniform vec3 top; uniform vec3 bottom; varying float h; void main(){ gl_FragColor = vec4(mix(bottom, top, smoothstep(-0.05, 0.45, h)), 1.0); }',
    }),
  );
  scene.add(sky);
}

// ─── Camera path ────────────────────────────────────────────────────────────

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

// Each stop: camera position, where it looks, and the caption shown while passing it.
const STOPS: { p: THREE.Vector3; t: THREE.Vector3; label: string }[] = [
  { p: V(9.5, 17, 21), t: V(7.2, 0, 5.2), label: 'טיפוס A · קומה 19' },
  { p: V(2.2, 4.2, 13.5), t: V(1.3, 1.2, 8.4), label: 'כניסה' },
  { p: V(1.3, 1.6, 9.6), t: V(1.6, 1.3, 7), label: 'כניסה' },
  { p: V(1.5, 1.6, 7.6), t: V(1.4, 1.1, 4.0), label: 'סלון' },
  { p: V(2.3, 1.62, 5.9), t: V(0.4, 1.1, 3.8), label: 'סלון' },
  { p: V(4.15, 1.7, 5.7), t: V(5.3, 1.0, 2.4), label: 'מטבח · אי 150×90' },
  { p: V(3.4, 1.6, 1.4), t: V(3.2, 1.3, -2.6), label: 'מרפסת · 20 מ״ר' },
  { p: V(3.3, 1.55, -1.3), t: V(0.8, 0.8, -2.3), label: 'מרפסת · 20 מ״ר' },
  { p: V(3.9, 1.6, 1.5), t: V(6.8, 1.3, 5.6), label: 'סלון' },
  { p: V(5.6, 1.6, 5.6), t: V(10.5, 1.4, 6.1), label: 'מסדרון' },
  { p: V(8.4, 1.6, 6.1), t: V(12.5, 1.3, 5.8), label: 'מסדרון' },
  { p: V(11.6, 1.65, 6.0), t: V(14.8, 0.7, 6.6), label: 'חדר הורים · 3.71×3.37' },
  { p: V(12.1, 1.72, 7.6), t: V(14.2, 0.9, 6.1), label: 'חדר הורים · 3.71×3.37' },
  { p: V(11.6, 1.6, 5.8), t: V(9.4, 1.3, 5.8), label: 'מסדרון' },
  { p: V(9.35, 1.6, 5.9), t: V(9.2, 1.2, 3.0), label: 'ממ״ד · 2.95×3.60' },
  { p: V(9.2, 1.62, 3.6), t: V(8.4, 0.9, 1.6), label: 'ממ״ד · 2.95×3.60' },
  { p: V(8.8, 6.5, 5.8), t: V(7.6, 0.5, 5.4), label: 'טיפוס A · קומה 19' },
];

function makePath() {
  const pos = new THREE.CatmullRomCurve3(
    STOPS.map((s) => s.p),
    true,
    'centripetal',
  );
  const tgt = new THREE.CatmullRomCurve3(
    STOPS.map((s) => s.t),
    true,
    'centripetal',
  );
  // Time-warp: glide slowly at eye level and faster through the overhead parts.
  const N = 3000;
  const times = new Float64Array(N + 1);
  const len = pos.getLength();
  let prev = pos.getPointAt(0);
  for (let i = 1; i <= N; i++) {
    const p = pos.getPointAt(i / N);
    const speed = 0.95 + Math.max(0, p.y - 1.7) * 0.55;
    times[i] = times[i - 1] + prev.distanceTo(p) / speed;
    prev = p;
  }
  const total = times[N];
  const uAt = (sec: number) => {
    const t = ((sec % total) + total) % total;
    let lo = 0;
    let hi = N;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (times[mid] <= t) lo = mid;
      else hi = mid;
    }
    const f = (t - times[lo]) / (times[hi] - times[lo] || 1);
    return (lo + f) / N;
  };
  return { pos, tgt, total, uAt, len };
}

// ─── Mount ──────────────────────────────────────────────────────────────────

export function mountApartment(container: HTMLElement, onLabel: LabelFn): () => void {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const small = Math.min(window.innerWidth, window.innerHeight) < 700;

  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, small ? 1.5 : 1.75));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.domElement.setAttribute('aria-hidden', 'true');
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog('#efe6d8', 60, 520);

  const camera = new THREE.PerspectiveCamera(62, 1, 0.05, 2000);

  const hemi = new THREE.HemisphereLight('#fff4e6', '#b9a992', 1.2);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight('#ffe2bd', 2.6);
  sun.position.set(-9, 16, -12);
  sun.target.position.set(7, 0, 5);
  sun.castShadow = true;
  sun.shadow.mapSize.set(small ? 1024 : 2048, small ? 1024 : 2048);
  Object.assign(sun.shadow.camera, { left: -14, right: 14, top: 14, bottom: -14, near: 1, far: 60 });
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.03;
  scene.add(sun, sun.target);
  const fill = new THREE.DirectionalLight('#dfe8ff', 0.5);
  fill.position.set(18, 10, 20);
  scene.add(fill);

  const lights = new THREE.Group();
  const b = new Builder();
  buildApartment(b, lights);
  scene.add(b.group, lights);
  buildCity(scene);

  const path = makePath();
  let lastLabel = '';
  const look = new THREE.Vector3();

  const place = (sec: number) => {
    const u = path.uAt(sec);
    const t = path.pos.getUtoTmapping(u, 0);
    const p = path.pos.getPointAt(u);
    p.y += Math.sin(sec * 0.9) * 0.025;
    camera.position.copy(p);
    look.copy(path.tgt.getPoint(t));
    camera.lookAt(look);
    const label = STOPS[Math.round(t * STOPS.length) % STOPS.length].label;
    if (label !== lastLabel) {
      lastLabel = label;
      onLabel(label);
    }
  };

  const resize = () => {
    const w = container.clientWidth;
    const h = container.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.fov = w / h < 1 ? 72 : 60;
    camera.updateProjectionMatrix();
    renderer.render(scene, camera);
  };
  const ro = new ResizeObserver(resize);
  ro.observe(container);

  let visible = true;
  const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting));
  io.observe(container);

  let raf = 0;
  let clock = 0;
  let last = performance.now();
  const frame = (now: number) => {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    if (!visible || document.hidden) return;
    clock += dt;
    place(clock);
    renderer.render(scene, camera);
  };

  // `?apt-t=SECONDS` freezes the tour at one moment (used for screenshots).
  const frozen = Number(new URLSearchParams(window.location.search).get('apt-t'));
  place(Number.isFinite(frozen) && frozen > 0 ? frozen : 0);
  resize();
  if (!reduced && !(frozen > 0)) raf = requestAnimationFrame(frame);

  return () => {
    cancelAnimationFrame(raf);
    ro.disconnect();
    io.disconnect();
    scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        m.geometry.dispose();
        const mats = Array.isArray(m.material) ? m.material : [m.material];
        mats.forEach((mat) => {
          (mat as THREE.MeshStandardMaterial).map?.dispose();
          mat.dispose();
        });
      }
    });
    renderer.dispose();
    renderer.domElement.remove();
  };
}
