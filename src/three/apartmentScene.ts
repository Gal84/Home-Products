import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

/*
 * A furnished 3D model of the owner's apartment (Damri "Afek", type A, floor 19), with a camera that
 * drops in from above, enters through the front door, floats through the rooms and rises out again
 * in a seamless loop. Coordinates are metres: x → east, z → south, y ↑. The plan is simplified but
 * keeps the real room sizes and adjacency.
 */

const WALL_H = 2.7;
const WALL_T = 0.12;

type LabelFn = (label: string) => void;
type Animator = (t: number) => void;

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
  /** Per-frame motion for props (plants in the breeze, curtains, cats). */
  readonly anim: Animator[] = [];
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
  const potH = 0.42 * scale;
  b.cyl(0.2 * scale, 0.16 * scale, potH, b.mat(pot, 0.9), x, 0, z);
  const leaf = b.mat('#5c7a4a', 0.85);
  const leaf2 = b.mat('#4a6a3d', 0.85);
  const r = rand(Math.round(x * 100 + z * 7));
  // Foliage pivots at the soil so it bends from the base.
  const crown = new THREE.Group();
  crown.position.set(x, potH, z);
  for (let i = 0; i < 7; i++) {
    const a = r() * Math.PI * 2;
    const d = r() * 0.18 * scale;
    const m = new THREE.Mesh(new THREE.SphereGeometry((0.16 + r() * 0.12) * scale, 20, 14), i % 2 ? leaf : leaf2);
    m.scale.y = 1.2;
    m.position.set(Math.cos(a) * d, (0.62 + r() * 0.55) * scale - potH, Math.sin(a) * d);
    crown.add(m);
  }
  b.add(crown);
  // Outdoors the breeze is stronger than the draught inside.
  const sway = z < 0 ? 0.05 : 0.018;
  const phase = x * 1.7 + z * 0.9;
  b.anim.push((t) => {
    crown.rotation.z = Math.sin(t * 0.9 + phase) * sway + Math.sin(t * 2.3 + phase * 2) * sway * 0.25;
    crown.rotation.x = Math.sin(t * 0.7 + phase * 1.3) * sway * 0.6;
  });
}

/** A sheer curtain on a track, rippling in the draught from the open balcony door. */
function curtain(b: Builder, x0: number, x1: number, z: number) {
  const w = x1 - x0;
  const h = WALL_H - 0.1;
  const geo = new THREE.PlaneGeometry(w, h, 36, 18);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const base = Float32Array.from(pos.array as Float32Array);
  const m = new THREE.MeshStandardMaterial({ color: '#fbf6ee', roughness: 1, transparent: true, opacity: 0.6, side: THREE.DoubleSide, depthWrite: false });
  const mesh = new THREE.Mesh(geo, m);
  mesh.position.set((x0 + x1) / 2, 0.06 + h / 2, z);
  b.group.add(mesh);
  b.box(w + 0.1, 0.03, 0.04, b.mat('#2b2825', 0.5, 0.4), (x0 + x1) / 2, WALL_H - 0.05, z);
  let frame = 0;
  b.anim.push((t) => {
    // Every other frame is plenty for cloth this slow.
    if (frame++ % 2) return;
    for (let i = 0; i < pos.count; i++) {
      const px = base[i * 3];
      const py = base[i * 3 + 1];
      const hang = 0.5 - py / h; // 0 at the top, 1 at the hem
      const pleat = Math.sin(px * 26) * 0.035;
      const billow = (Math.sin(px * 3.2 + t * 1.1) * 0.5 + Math.sin(px * 5.1 - t * 1.7) * 0.25 + 0.6) * 0.07 * hang * hang;
      pos.setZ(i, pleat + billow);
    }
    pos.needsUpdate = true;
    geo.computeVertexNormals();
  });
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
type CatKind = 'white' | 'black' | 'tabby';

function tabbyStripes() {
  const r = rand(21);
  return canvasTexture(256, (g, s) => {
    g.fillStyle = '#8f6c49';
    g.fillRect(0, 0, s, s);
    for (let i = 0; i < 220; i++) {
      g.fillStyle = r() < 0.5 ? 'rgba(196,160,112,0.35)' : 'rgba(70,52,36,0.3)';
      g.fillRect(r() * s, r() * s, 2 + r() * 8, 1 + r() * 3);
    }
    for (let y = 0; y < s; y += 22 + r() * 10) {
      g.strokeStyle = 'rgba(46,34,24,0.85)';
      g.lineWidth = 5 + r() * 6;
      g.beginPath();
      g.moveTo(0, y);
      for (let x = 0; x <= s; x += 32) g.lineTo(x, y + (r() - 0.5) * 12);
      g.stroke();
    }
  });
}

/**
 * The owner's cats, lying in a loaf with front paws forward (facing −z; turn with `rot`):
 * a long-haired white with blue eyes, a sleek short-haired black, and a long-haired brown
 * tabby with white chest, belly, muzzle and paws. Returns an animator that sways the tail.
 */
function cat(b: Builder, x: number, y: number, z: number, rot: number, kind: CatKind, scale = 0.95) {
  const look = {
    white: { fur: '#f2f0eb', light: '#f7f5f1', ear: '#e6a6a8', nose: '#e39598', eyes: '#6fa6dc', fluffy: true },
    black: { fur: '#1b1a19', light: '#211f1e', ear: '#3b2f2f', nose: '#2a2222', eyes: '#c9c24c', fluffy: false },
    tabby: { fur: '#8f6c49', light: '#f1eee8', ear: '#c99494', nose: '#d4979a', eyes: '#d8901e', fluffy: true },
  }[kind];
  const g = new THREE.Group();
  const furMat =
    kind === 'tabby'
      ? new THREE.MeshStandardMaterial({ map: tabbyStripes(), roughness: 0.95 })
      : b.mat(look.fur, kind === 'black' ? 0.55 : 0.95);
  const plainFur = b.mat(look.fur, kind === 'black' ? 0.55 : 0.95);
  const light = b.mat(look.light, 0.95);
  const ball = new THREE.SphereGeometry(1, 20, 14);
  const part = (m: THREE.Material, px: number, py: number, pz: number, sx: number, sy: number, sz: number, geo: THREE.BufferGeometry = ball) => {
    const mesh = new THREE.Mesh(geo, m);
    mesh.position.set(px, py, pz);
    mesh.scale.set(sx, sy, sz);
    g.add(mesh);
    return mesh;
  };
  const fl = look.fluffy ? 1.12 : 0.92;
  // Body lies along z; rotating the sphere puts its stripes across the back like tabby bands.
  const body = part(furMat, 0, 0.095 * fl, 0.04, 0.12 * fl, 0.25, 0.095 * fl);
  body.rotation.x = Math.PI / 2;
  part(plainFur, 0.035, 0.1 * fl, 0.17, 0.085 * fl, 0.075 * fl, 0.1);
  if (kind === 'tabby') part(light, 0, 0.05, 0.0, 0.1, 0.05, 0.2);
  part(kind === 'tabby' ? light : plainFur, 0, 0.115, -0.15, 0.092 * fl, 0.088 * fl, 0.075 * fl);
  // Head, cheeks, muzzle, nose, eyes, ears.
  part(plainFur, 0, 0.2, -0.2, 0.072, 0.068, 0.068);
  if (kind === 'tabby') part(furMat, 0, 0.235, -0.2, 0.06, 0.035, 0.055);
  if (look.fluffy) for (const s of [-1, 1]) part(kind === 'tabby' ? light : plainFur, s * 0.05, 0.18, -0.205, 0.038, 0.036, 0.036);
  part(kind === 'tabby' ? light : plainFur, 0, 0.18, -0.262, 0.036, 0.026, 0.026);
  part(b.mat(look.nose, 0.6), 0, 0.192, -0.288, 0.009, 0.007, 0.006);
  for (const s of [-1, 1]) {
    part(b.mat(look.eyes, 0.25, 0, { emissive: look.eyes, emissiveIntensity: 0.35 }), s * 0.027, 0.214, -0.258, 0.014, 0.013, 0.008);
    part(b.mat('#141312', 0.3), s * 0.027, 0.214, -0.265, 0.005, 0.01, 0.004);
    const ear = part(plainFur, s * 0.043, 0.268, -0.19, 1, 1, 1, new THREE.ConeGeometry(0.028, 0.062, 4));
    ear.rotation.z = -s * 0.3;
    const inner = part(b.mat(look.ear, 0.8), s * 0.041, 0.262, -0.198, 1, 1, 1, new THREE.ConeGeometry(0.016, 0.042, 4));
    inner.rotation.z = -s * 0.3;
    // Front legs stretched forward, white socks on the tabby.
    const leg = part(plainFur, s * 0.04, 0.026, -0.225, 1, 1, 1, new THREE.CylinderGeometry(0.026, 0.028, 0.12, 10));
    leg.rotation.x = Math.PI / 2;
    part(kind === 'tabby' ? light : plainFur, s * 0.04, 0.026, -0.29, 0.03, 0.025, 0.036);
  }
  // Tail: a chain of spheres, bushy for the long-haired cats, ringed on the tabby.
  const tailPivot = new THREE.Group();
  tailPivot.position.set(0.02, 0.045, 0.27);
  const tailCurve = new THREE.CatmullRomCurve3([V(0, 0, 0), V(0.08, 0, 0.07), V(0.17, -0.01, 0.03), V(0.2, -0.015, -0.08), V(0.17, -0.02, -0.19)]);
  tailPivot.add(new THREE.Mesh(new THREE.TubeGeometry(tailCurve, 24, look.fluffy ? 0.024 : 0.016, 10), plainFur));
  const dark = b.mat('#3b2c1f', 0.95);
  const n = look.fluffy ? 26 : 0;
  for (let i = 0; i < n; i++) {
    const p = tailCurve.getPointAt(i / (n - 1));
    const rad = 0.036 * (1 - (i / n) * 0.4);
    const m = kind === 'tabby' ? (i % 4 < 2 ? plainFur : dark) : plainFur;
    const sph = new THREE.Mesh(ball, m);
    sph.position.copy(p);
    sph.scale.setScalar(rad);
    tailPivot.add(sph);
  }
  g.add(tailPivot);
  g.position.set(x, y, z);
  g.rotation.y = rot;
  g.scale.setScalar(scale);
  b.add(g);
  const phase = x * 3.1 + z;
  return (t: number) => {
    tailPivot.rotation.y = Math.sin(t * 1.1 + phase) * 0.3;
    // Slow breathing: a sleeping cat takes about 25 breaths a minute.
    g.scale.set(scale, scale * (1 + Math.sin(t * 2.6 + phase) * 0.014), scale * (1 + Math.sin(t * 2.6 + phase) * 0.006));
  };
}

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

function buildApartment(b: Builder, lights: THREE.Group): ((t: number) => void)[] {
  const animators: ((t: number) => void)[] = [];
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
  // The slab sits a hair above the ceiling plane; flush, the two faces z-fight and the ceiling flickers.
  b.box(7.42, 0.25, 1.4, slab, 3.65, WALL_H + 0.01, -0.7);

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
  // Reading lamp beside the armchair (clear of the camera's line past the sofa).
  b.cyl(0.14, 0.14, 0.02, b.mat('#1e1c1a', 0.4, 0.6), 2.6, 0, 2.35);
  b.cyl(0.012, 0.012, 1.5, b.mat('#1e1c1a', 0.4, 0.6), 2.6, 0, 2.35, 6);
  b.cyl(0.14, 0.2, 0.28, b.mat('#f3e9d8', 0.9, 0, { emissive: '#ffdca8', emissiveIntensity: 0.35 }), 2.6, 1.45, 2.35);
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
  // Silver four-door fridge in a tall surround (cabinet above).
  b.box(0.62, 0.42, 1.2, cab, 6.66, 1.88, 0.6, 0.01);
  b.box(0.62, 1.88, 0.08, cab, 6.66, 0, 0.04);
  b.box(0.62, 1.88, 0.08, cab, 6.66, 0, 1.16);
  const steel = b.mat('#c3c7c9', 0.28, 0.75);
  const steelDark = b.mat('#8f9496', 0.35, 0.6);
  b.box(0.68, 1.84, 1.02, steel, 6.64, 0.02, 0.6, 0.012);
  b.box(0.004, 0.02, 1.0, steelDark, 6.298, 0.98, 0.6);
  b.box(0.004, 0.02, 1.0, steelDark, 6.298, 0.56, 0.6);
  b.box(0.004, 0.84, 0.006, steelDark, 6.298, 1.0, 0.6);
  for (const z of [0.54, 0.66]) b.box(0.03, 0.55, 0.018, b.mat('#e1e4e5', 0.2, 0.85), 6.28, 1.15, z);
  for (const y of [0.88, 0.47]) b.box(0.03, 0.018, 0.55, b.mat('#e1e4e5', 0.2, 0.85), 6.28, y, 0.6);
  b.box(0.004, 0.14, 0.1, b.mat('#1b1c1d', 0.3), 6.297, 1.45, 0.4);
  b.box(0.35, 0.7, 2.6, cab, 6.8, 1.55, 3.1, 0.01);
  b.box(0.5, 0.02, 0.6, b.mat('#1b1a19', 0.2, 0.3), 6.62, 0.92, 3.4);
  b.box(0.9, 0.88, 1.5, b.mat('#3f4a44', 0.7), 5.0, 0, 2.75, 0.01);

  // Door seams and small, slim brass pulls.
  const brass = b.mat('#c7a064', 0.28, 0.85);
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
  doors(6.345, 0.08, 1.12, 2, 1.88, 0.42, 1.93, -1);
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
  // Sheers gathered either side of the open sliding door.
  curtain(b, 1.5, 2.36, 0.13);
  curtain(b, 4.44, 5.3, 0.13);
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

  // ── The owner's three cats ──
  // Stone sill on the living-room window.
  b.box(0.26, 0.03, 1.3, b.mat('#e4ddd1', 0.5), 0.17, 0.88, 1.2);
  animators.push(cat(b, 3.72, 0.82, 3.75, 0, 'white'));
  animators.push(cat(b, 1.6, 0.4, 2.25, Math.PI, 'tabby'));
  animators.push(cat(b, 13.45, 0.58, 6.95, Math.PI / 2, 'black'));

  // ── Lobby outside the front door ──
  b.box(0.9, 2.2, 0.1, b.mat('#8b8f8e', 0.35, 0.6), 3.4, 0, 11.15);
  b.box(0.1, 0.16, 0.02, b.mat('#8b8f8e', 0.35, 0.6), 1.98, 1.35, 8.47);
  plant(b, -0.25, 9.1, 1.1);
  return animators;
}

// ─── Outside: the Afek nature reserve at sunset (floor 19) ─────────────────

const GROUND_Y = -58;

function meadow() {
  const r = rand(77);
  return canvasTexture(1024, (g, s) => {
    g.fillStyle = '#5d6e41';
    g.fillRect(0, 0, s, s);
    const tones = ['#6d7c48', '#4f5f37', '#7a7650', '#617449', '#566a3c', '#83805a'];
    for (let i = 0; i < 900; i++) {
      g.fillStyle = tones[i % tones.length];
      g.globalAlpha = 0.18 + r() * 0.3;
      g.beginPath();
      g.ellipse(r() * s, r() * s, 6 + r() * 40, 4 + r() * 22, r() * Math.PI, 0, Math.PI * 2);
      g.fill();
    }
    g.globalAlpha = 1;
  });
}

function facade(lit: boolean, seed: number) {
  const r = rand(seed);
  return canvasTexture(256, (g, s) => {
    const rows = 16;
    const cols = 8;
    const h = s / rows;
    const w = s / cols;
    g.fillStyle = lit ? '#000' : '#f1eee8';
    g.fillRect(0, 0, s, s);
    for (let y = 0; y < rows; y++)
      for (let x = 0; x < cols; x++) {
        const on = r() < 0.55;
        if (lit) {
          if (!on) continue;
          g.fillStyle = `rgb(255,${190 + r() * 40},${120 + r() * 50})`;
        } else g.fillStyle = on ? '#8d8272' : '#59616a';
        g.fillRect(x * w + w * 0.18, y * h + h * 0.22, w * 0.64, h * 0.5);
        if (!lit) {
          g.fillStyle = '#d9d5ce';
          g.fillRect(x * w, y * h + h * 0.8, w, h * 0.12);
        }
      }
  });
}

function blob(cx: number, cz: number, rx: number, rz: number, seed: number, wobble = 0.22) {
  const r = rand(seed);
  const shape = new THREE.Shape();
  const n = 28;
  const phase = r() * 6;
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2;
    const k = 1 + Math.sin(a * 3 + phase) * wobble * 0.6 + (r() - 0.5) * wobble * 0.5;
    const x = cx + Math.cos(a) * rx * k;
    const y = cz + Math.sin(a) * rz * k;
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  const geo = new THREE.ShapeGeometry(shape);
  geo.rotateX(Math.PI / 2);
  return geo;
}

/** Flat strip following a curve on the ground (stream, road, light trails). */
function ribbon(points: THREE.Vector3[], width: number, y: number) {
  const curve = new THREE.CatmullRomCurve3(points);
  const n = 120;
  const pos: number[] = [];
  const idx: number[] = [];
  for (let i = 0; i <= n; i++) {
    const p = curve.getPointAt(i / n);
    const t = curve.getTangentAt(i / n);
    const nx = -t.z;
    const nz = t.x;
    const len = Math.hypot(nx, nz) || 1;
    pos.push(p.x + (nx / len) * width / 2, y, p.z + (nz / len) * width / 2, p.x - (nx / len) * width / 2, y, p.z - (nz / len) * width / 2);
    if (i < n) {
      const a = i * 2;
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

function tower(scene: THREE.Scene, x: number, z: number, w: number, d: number, top: number, seed: number, crown = true) {
  const h = top - GROUND_Y;
  const map = facade(false, seed);
  map.repeat.set(w / 10, h / 20);
  const emissiveMap = facade(true, seed);
  emissiveMap.repeat.copy(map.repeat);
  const side = new THREE.MeshLambertMaterial({ map, emissiveMap, emissive: '#ffd9a8', emissiveIntensity: 0.55 });
  const roof = new THREE.MeshLambertMaterial({ color: '#d8d2c8' });
  // Box faces: +x, −x, +y (roof), −y, +z, −z.
  const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), [side, side, roof, roof, side, side]);
  body.position.set(x, GROUND_Y + h / 2, z);
  scene.add(body);
  if (crown) {
    const c = new THREE.Mesh(new THREE.BoxGeometry(w + 0.6, 8, d + 0.6), new THREE.MeshLambertMaterial({ color: '#2d3136' }));
    c.position.set(x, top - 4, z);
    scene.add(c);
  }
}

function buildLandscape(scene: THREE.Scene): Animator[] {
  const animators: Animator[] = [];
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(2600, 2600), new THREE.MeshLambertMaterial({ map: meadow() }));
  (ground.material as THREE.MeshLambertMaterial).map!.repeat.set(26, 26);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = GROUND_Y;
  scene.add(ground);

  // Ponds of the reserve, north and west of the towers, with muddy rims.
  // Shape geometry lies face-down after rotateX, so render both sides.
  const mud = new THREE.MeshLambertMaterial({ color: '#5a5436', side: THREE.DoubleSide });
  const water = new THREE.MeshLambertMaterial({ color: '#93b4cc', emissive: '#6d93b3', emissiveIntensity: 0.35, side: THREE.DoubleSide });
  const ponds: [number, number, number, number][] = [
    [-30, -105, 44, 20],
    [70, -135, 78, 30],
    [175, -95, 36, 16],
    [-140, -170, 62, 26],
    [20, -225, 46, 20],
    [190, -205, 58, 22],
    [-220, -95, 32, 15],
  ];
  ponds.forEach(([x, z, rx, rz], i) => {
    const rim = new THREE.Mesh(blob(x, z, rx + 5, rz + 4, i + 10), mud);
    rim.position.y = GROUND_Y + 0.05;
    const pond = new THREE.Mesh(blob(x, z, rx, rz, i + 10), water);
    pond.position.y = GROUND_Y + 0.12;
    scene.add(rim, pond);
  });
  // Light playing on the water.
  animators.push((t) => {
    water.emissiveIntensity = 0.33 + Math.sin(t * 0.8) * 0.04 + Math.sin(t * 2.1) * 0.015;
  });
  // Winding stream.
  const stream = new THREE.Mesh(
    ribbon([V(-420, 0, -60), V(-260, 0, -95), V(-170, 0, -70), V(-90, 0, -120), V(-60, 0, -200), V(-120, 0, -300), V(-60, 0, -420)], 7, GROUND_Y + 0.1),
    new THREE.MeshLambertMaterial({ color: '#7d93a0', side: THREE.DoubleSide }),
  );
  scene.add(stream);

  // Road between the towers and the reserve, with red and white light trails.
  const roadPts = [V(-600, 0, -30), V(-200, 0, -42), V(0, 0, -48), V(200, 0, -40), V(420, 0, -10), V(700, 0, 30)];
  scene.add(new THREE.Mesh(ribbon(roadPts, 12, GROUND_Y + 0.15), new THREE.MeshLambertMaterial({ color: '#3b3a38', side: THREE.DoubleSide })));
  const trail = (off: number, color: string) => {
    const pts = roadPts.map((p) => V(p.x, 0, p.z + off));
    scene.add(new THREE.Mesh(ribbon(pts, 0.8, GROUND_Y + 0.25), new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide })));
  };
  trail(-3, '#ff4b36');
  trail(-1.5, '#ff7a55');
  trail(2.5, '#fff1d0');

  // The project's towers: ours below the flat, three siblings in a row.
  tower(scene, 7.4, 5.3, 17.5, 17.5, -0.35, 1, false);
  tower(scene, -48, 16, 24, 20, 20, 2);
  tower(scene, 44, 26, 24, 20, 17, 3);
  tower(scene, 76, 40, 22, 20, 18, 4);
  // Existing mid-rise neighbourhood to the south, and the distant city.
  const r = rand(991);
  const geo = new THREE.BoxGeometry(1, 1, 1);
  geo.translate(0, 0.5, 0);
  const shades = ['#ece8e1', '#d9d4cc', '#c7c1b7', '#b9b3a9'].map((c) => new THREE.MeshLambertMaterial({ color: c }));
  for (let i = 0; i < 70; i++) {
    const x = -260 + r() * 520;
    const z = 70 + r() * 220;
    const m = new THREE.Mesh(geo, shades[i % shades.length]);
    m.scale.set(16 + r() * 16, 18 + r() * 30, 14 + r() * 12);
    m.position.set(x, GROUND_Y, z);
    scene.add(m);
  }
  for (let i = 0; i < 160; i++) {
    const a = r() * Math.PI * 2;
    const d = 520 + r() * 420;
    const m = new THREE.Mesh(geo, shades[i % shades.length]);
    m.scale.set(14 + r() * 20, 10 + r() * 38, 14 + r() * 16);
    m.position.set(Math.cos(a) * d, GROUND_Y, Math.sin(a) * d);
    scene.add(m);
  }
  // Trees: palms along the road, eucalyptus clumps in the reserve.
  const leaf = new THREE.MeshLambertMaterial({ color: '#3f5230' });
  const dark = new THREE.MeshLambertMaterial({ color: '#2f3d25' });
  for (let i = 0; i < 26; i++) {
    const t = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 8), leaf);
    t.scale.set(4, 3, 4);
    t.position.set(-120 + i * 12 + r() * 4, GROUND_Y + 7, -30 + r() * 6);
    scene.add(t);
  }
  for (let i = 0; i < 14; i++) {
    const side = i % 2 ? 1 : -1;
    const cx = side * (260 + r() * 200);
    const cz = -60 - r() * 380;
    for (let j = 0; j < 4; j++) {
      const t = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 8), dark);
      t.scale.set(7 + r() * 5, 6 + r() * 5, 7 + r() * 5);
      t.position.set(cx + (r() - 0.5) * 16, GROUND_Y + 8 + r() * 6, cz + (r() - 0.5) * 16);
      scene.add(t);
    }
  }

  // Sunset sky: dusky blue overhead, amber at the horizon, drifting clouds.
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(1400, 32, 16),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: {
        top: { value: new THREE.Color('#7383b3') },
        mid: { value: new THREE.Color('#eeac7c') },
        bottom: { value: new THREE.Color('#f7cb92') },
      },
      vertexShader: 'varying float h; void main(){ h = normalize(position).y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader:
        'uniform vec3 top; uniform vec3 mid; uniform vec3 bottom; varying float h;' +
        'void main(){ vec3 c = mix(bottom, mid, smoothstep(-0.02, 0.12, h)); c = mix(c, top, smoothstep(0.12, 0.55, h)); gl_FragColor = vec4(c, 1.0);\n' +
        '#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}',
    }),
  );
  // Drawn first and never depth-tested: it is the backdrop, and it has no log-depth chunks.
  sky.renderOrder = -1;
  sky.material.depthTest = false;
  scene.add(sky);
  const cloudTex = canvasTexture(256, (g, s) => {
    const cr = rand(5);
    for (let i = 0; i < 26; i++) {
      const x = s * 0.15 + cr() * s * 0.7;
      const y = s * 0.4 + cr() * s * 0.2;
      const rad = s * (0.06 + cr() * 0.1);
      const grd = g.createRadialGradient(x, y, 0, x, y, rad);
      grd.addColorStop(0, 'rgba(255,170,110,0.75)');
      grd.addColorStop(1, 'rgba(250,140,95,0)');
      g.fillStyle = grd;
      g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    }
  });
  const clouds = new THREE.Group();
  for (let i = 0; i < 12; i++) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: cloudTex, fog: false, depthWrite: false, transparent: true, opacity: 0.95 }));
    const a = -Math.PI * 0.95 + (i / 12) * Math.PI * 1.4;
    sp.position.set(Math.cos(a) * 1100, 90 + r() * 170, Math.sin(a) * 1100);
    sp.scale.set(420 + r() * 300, 140 + r() * 60, 1);
    clouds.add(sp);
  }
  scene.add(clouds);
  // The clouds drift, slowly enough that the loop point never shows.
  animators.push((t) => {
    clouds.rotation.y = Math.sin(t * 0.012) * 0.06;
  });

  animators.push(...flock(scene));
  return animators;
}

/** A small flock of egrets circling over the reserve at about the height of the flat. */
function flock(scene: THREE.Scene): Animator[] {
  const wingGeo = new THREE.BufferGeometry();
  // One wing: a swept triangle from the body out to the tip.
  wingGeo.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, -0.18, 0, 0, 0.22, 0.95, 0, -0.1], 3));
  wingGeo.computeVertexNormals();
  const mat = new THREE.MeshLambertMaterial({ color: '#fbf3e6', side: THREE.DoubleSide, emissive: '#6b5a4a', emissiveIntensity: 0.25 });
  const bodyGeo = new THREE.CapsuleGeometry(0.09, 0.5, 4, 8).rotateX(Math.PI / 2);
  const out: Animator[] = [];
  const r = rand(77);
  const centre = V(-10, -6, -95);
  for (let i = 0; i < 9; i++) {
    const bird = new THREE.Group();
    bird.add(new THREE.Mesh(bodyGeo, mat));
    const left = new THREE.Mesh(wingGeo, mat);
    const right = new THREE.Mesh(wingGeo, mat);
    right.scale.x = -1;
    bird.add(left, right);
    bird.scale.setScalar(1.6);
    scene.add(bird);
    const lag = i * 0.055 + r() * 0.02;
    const lane = V((r() - 0.5) * 9, (r() - 0.5) * 5, (r() - 0.5) * 9);
    const flap = 5 + r() * 1.5;
    const phase = r() * 6;
    const next = new THREE.Vector3();
    const at = (t: number, v: THREE.Vector3) => {
      const a = t * 0.07 - lag;
      return v.set(
        centre.x + Math.cos(a) * 70 + Math.sin(a * 2.3) * 12 + lane.x,
        centre.y + Math.sin(a * 1.7) * 6 + lane.y,
        centre.z + Math.sin(a) * 38 + lane.z,
      );
    };
    out.push((t) => {
      at(t, bird.position);
      at(t + 0.2, next);
      bird.lookAt(next);
      // Flap, then glide for a beat.
      const glide = Math.sin(t * 0.5 + phase) > 0.55;
      const w = glide ? 0.12 : Math.sin(t * flap + phase) * 0.55;
      left.rotation.z = w;
      right.rotation.z = -w;
    });
  }
  return out;
}

/** Specks of dust turning in the evening sun that slants in through the balcony door. */
function dust(scene: THREE.Scene): Animator {
  const n = 220;
  const r = rand(4242);
  const seed = new Float32Array(n * 4);
  const pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    seed.set([0.3 + r() * 6.4, 0.25 + r() * 2.3, 0.2 + r() * 6.5, r() * 100], i * 4);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const tex = canvasTexture(64, (g, s) => {
    const grd = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    grd.addColorStop(0, 'rgba(255,240,215,1)');
    grd.addColorStop(1, 'rgba(255,240,215,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, s, s);
  });
  const pts = new THREE.Points(
    geo,
    new THREE.PointsMaterial({ map: tex, size: 0.018, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending, color: '#ffe2b8' }),
  );
  pts.frustumCulled = false;
  scene.add(pts);
  return (t) => {
    for (let i = 0; i < n; i++) {
      const [x, y, z, k] = seed.subarray(i * 4, i * 4 + 4);
      pos[i * 3] = x + Math.sin(t * 0.13 + k) * 0.35;
      pos[i * 3 + 1] = y + Math.sin(t * 0.09 + k * 1.3) * 0.25;
      pos[i * 3 + 2] = z + Math.cos(t * 0.11 + k * 0.7) * 0.35;
    }
    geo.attributes.position.needsUpdate = true;
  };
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

/** Wrapping box blur; three passes approximate a Gaussian. The tour is a loop, so the ends meet. */
function blurLoop(src: Float64Array, radius: number) {
  const n = src.length;
  let a = src;
  for (let pass = 0; pass < 3; pass++) {
    const b = new Float64Array(n);
    let sum = 0;
    for (let k = -radius; k <= radius; k++) sum += a[(k + n) % n];
    for (let i = 0; i < n; i++) {
      b[i] = sum / (2 * radius + 1);
      sum += a[(i + radius + 1) % n] - a[(i - radius + n) % n];
    }
    a = b;
  }
  return a;
}

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
  const N = 3000;
  const pts: THREE.Vector3[] = [];
  const dirs: THREE.Vector3[] = [];
  for (let i = 0; i < N; i++) {
    const u = i / N;
    const p = pos.getPointAt(u);
    pts.push(p);
    dirs.push(tgt.getPoint(pos.getUtoTmapping(u, 0)).sub(p).normalize());
  }
  // Speed profile: glide at walking pace, ease off while the view swings round (a pan reads as a
  // deliberate look, not a whip), and move faster through the overhead parts. Blurring the profile
  // turns every change of pace into a gentle acceleration instead of a lurch.
  const raw = new Float64Array(N);
  for (let i = 0; i < N; i++) {
    const j = (i + 1) % N;
    const ds = Math.max(1e-4, pts[i].distanceTo(pts[j]));
    const turn = dirs[i].angleTo(dirs[j]) / ds; // radians per metre
    raw[i] = (0.95 + Math.max(0, pts[i].y - 1.7) * 0.55) / (1 + turn * 0.55);
  }
  const speed = blurLoop(raw, 45);
  const times = new Float64Array(N + 1);
  for (let i = 1; i <= N; i++) times[i] = times[i - 1] + pts[i - 1].distanceTo(pts[i % N]) / speed[i - 1];
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
  return { pos, tgt, total, uAt };
}

// ─── Mount ──────────────────────────────────────────────────────────────────

/**
 * Mounts the tour into `container`. `onLabel` fires when the caption changes; `onFrame` gets the
 * loop progress (0–1) every frame, for a progress line.
 */
export function mountApartment(container: HTMLElement, onLabel: LabelFn, onFrame?: (progress: number) => void): () => void {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const small = Math.min(window.innerWidth, window.innerHeight) < 700;

  // A logarithmic depth buffer keeps thin layers (floors on slabs, ponds on the meadow 1 km out)
  // from z-fighting at any distance.
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance', logarithmicDepthBuffer: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, small ? 1.5 : 1.75));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.domElement.setAttribute('aria-hidden', 'true');
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog('#e6cfb4', 260, 1300);

  const camera = new THREE.PerspectiveCamera(62, 1, 0.06, 3000);

  // Soft studio reflections so steel, brass and glass read as metal instead of black.
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = envTex;
  scene.environmentIntensity = 0.45;

  const hemi = new THREE.HemisphereLight('#ffe9d2', '#a4a27c', 0.95);
  scene.add(hemi);
  // Low, warm evening sun from the west-north-west over the reserve.
  const sun = new THREE.DirectionalLight('#ffd3a3', 2.6);
  sun.position.set(-15, 11, -9);
  sun.target.position.set(7, 0, 5);
  sun.castShadow = true;
  sun.shadow.mapSize.set(small ? 1024 : 2048, small ? 1024 : 2048);
  Object.assign(sun.shadow.camera, { left: -14, right: 14, top: 14, bottom: -14, near: 1, far: 60 });
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.03;
  scene.add(sun, sun.target);
  const fill = new THREE.DirectionalLight('#c9d0ee', 0.55);
  fill.position.set(18, 10, 20);
  scene.add(fill);

  const lights = new THREE.Group();
  const b = new Builder();
  const animators = [...buildApartment(b, lights), ...b.anim, ...buildLandscape(scene), dust(scene)];
  scene.add(b.group, lights);

  // Soft bloom on large screens: bulbs, sunlit walls and the horizon glow a little, like a lens.
  // Phones skip it to keep the frame rate up.
  let composer: EffectComposer | null = null;
  if (!small) {
    const rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 });
    composer = new EffectComposer(renderer, rt);
    composer.addPass(new RenderPass(scene, camera));
    composer.addPass(new UnrealBloomPass(new THREE.Vector2(256, 256), 0.2, 0.45, 0.97));
    composer.addPass(new OutputPass());
  }
  const draw = () => (composer ? composer.render() : renderer.render(scene, camera));

  const path = makePath();
  let lastLabel = '';
  const look = new THREE.Vector3();

  // Look direction at a moment of the tour.
  const dirAt = (sec: number, out: THREE.Vector3) => {
    const u = path.uAt(sec);
    const p = path.pos.getPointAt(u);
    return out.copy(path.tgt.getPoint(path.pos.getUtoTmapping(u, 0))).sub(p).normalize();
  };
  // Gaussian-weighted window: the gaze leads into turns and settles out of them like a steadicam
  // operator's, with no lag and no dependence on frame history (so frozen frames still match).
  const WIN = [-0.9, -0.6, -0.3, 0, 0.3, 0.6, 0.9];
  const WEIGHT = WIN.map((o) => Math.exp(-(o * o) / 0.32));
  const tmp = new THREE.Vector3();
  const dir = new THREE.Vector3();
  const ahead = new THREE.Vector3();
  const behind = new THREE.Vector3();

  const place = (sec: number) => {
    const u = path.uAt(sec);
    const t = path.pos.getUtoTmapping(u, 0);
    const p = path.pos.getPointAt(u);
    // Two slow, unrelated sways read as a hand-held camera rather than a metronome.
    p.y += Math.sin(sec * 0.83) * 0.018 + Math.sin(sec * 0.31 + 1.3) * 0.012;
    p.x += Math.sin(sec * 0.47 + 0.4) * 0.012;
    camera.position.copy(p);
    dir.set(0, 0, 0);
    WIN.forEach((o, i) => dir.addScaledVector(dirAt(sec + o, tmp), WEIGHT[i]));
    dir.normalize();
    look.copy(p).add(dir);
    camera.lookAt(look);
    // Bank gently into turns, like a drone.
    dirAt(sec + 0.45, ahead);
    dirAt(sec - 0.45, behind);
    const yawRate = Math.atan2(behind.x * ahead.z - behind.z * ahead.x, behind.x * ahead.x + behind.z * ahead.z) / 0.9;
    camera.rotateZ(THREE.MathUtils.clamp(-yawRate * 0.045, -0.035, 0.035));
    onFrame?.(((sec % path.total) + path.total) % path.total / path.total);
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
    if (composer) {
      composer.setPixelRatio(renderer.getPixelRatio());
      composer.setSize(w, h);
    }
    camera.aspect = w / h;
    camera.fov = w / h < 1 ? 72 : 60;
    camera.updateProjectionMatrix();
    draw();
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
    // Cap the step so a dropped frame is a short pause, not a jump.
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (!visible || document.hidden) return;
    clock += dt;
    place(clock);
    for (const a of animators) a(clock);
    draw();
  };

  // `?apt-t=SECONDS` freezes the tour at one moment (used for screenshots).
  const frozen = Number(new URLSearchParams(window.location.search).get('apt-t'));
  const start = Number.isFinite(frozen) && frozen > 0 ? frozen : 0;
  place(start);
  for (const a of animators) a(start);
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
    composer?.dispose();
    envTex.dispose();
    pmrem.dispose();
    renderer.dispose();
    renderer.domElement.remove();
  };
}
