// The weather scene: turns a WMO code into fog, rain, snow, hail and lightning, and runs the frame loop for the atmosphere.
import { initAtmosphere, renderAtmosphere, resizeAtmosphere } from './atmosphere.js';
import { nightness, sunPlace } from './daylight.js';
import { clamp, mixRGB, rgba, type RGB } from './math.js';
import { reducedMotion } from './motion.js';
import { onSettings, settings } from './settings.js';

export interface Conditions { code: number; day: boolean; wind?: number; windDir?: number }

interface Scene { sun: number; cover: number; dark: number; fog: number; rain: number; snow: number; hail: number; storm: number }
const NONE: Scene = { sun: 1, cover: 0, dark: 0, fog: 0, rain: 0, snow: 0, hail: 0, storm: 0 };
const KEYS = Object.keys(NONE) as (keyof Scene)[];

function sceneFor(code: number): Scene {
  // Unless a case says otherwise, heavy cloud dims the sun to a soft glow behind it.
  const s = (p: Partial<Scene>): Scene => ({ ...NONE, sun: (p.cover ?? 0) >= 0.85 ? 0.4 : 1, ...p });
  switch (code) {
    case 0: return s({ cover: 0.12 });
    case 1: return s({ cover: 0.28 });
    case 2: return s({ sun: 0.9, cover: 0.55 });
    case 3: return s({ sun: 0.45, cover: 1, dark: 0.3 });
    case 45: case 48: return s({ sun: 0.4, cover: 0.5, fog: 1 });
    case 51: return s({ cover: 0.9, dark: 0.3, rain: 0.15 });
    case 53: return s({ cover: 0.9, dark: 0.35, rain: 0.25 });
    case 55: return s({ cover: 0.95, dark: 0.4, rain: 0.35 });
    case 56: return s({ cover: 0.9, dark: 0.35, rain: 0.2, hail: 0.1 });
    case 57: return s({ cover: 0.95, dark: 0.4, rain: 0.35, hail: 0.2 });
    case 61: return s({ cover: 1, dark: 0.4, rain: 0.45 });
    case 63: return s({ cover: 1, dark: 0.5, rain: 0.7 });
    case 65: return s({ cover: 1, dark: 0.6, rain: 1 });
    case 66: return s({ cover: 1, dark: 0.45, rain: 0.5, hail: 0.25 });
    case 67: return s({ cover: 1, dark: 0.55, rain: 0.8, hail: 0.4 });
    case 71: return s({ cover: 0.9, dark: 0.2, snow: 0.35 });
    case 73: return s({ cover: 1, dark: 0.3, snow: 0.65 });
    case 75: return s({ cover: 1, dark: 0.4, snow: 1 });
    case 77: return s({ cover: 0.9, dark: 0.2, snow: 0.3 });
    case 80: return s({ sun: 0.5, cover: 0.75, dark: 0.3, rain: 0.45 });
    case 81: return s({ cover: 0.9, dark: 0.45, rain: 0.7 });
    case 82: return s({ cover: 1, dark: 0.6, rain: 1 });
    case 85: return s({ cover: 0.85, dark: 0.3, snow: 0.5 });
    case 86: return s({ cover: 1, dark: 0.4, snow: 0.9 });
    case 95: return s({ sun: 0.2, cover: 1, dark: 0.75, rain: 0.85, storm: 1 });
    case 96: return s({ sun: 0.2, cover: 1, dark: 0.75, rain: 0.8, hail: 0.5, storm: 1 });
    case 99: return s({ sun: 0.2, cover: 1, dark: 0.8, rain: 0.8, hail: 1, storm: 1 });
    default: return NONE;
  }
}

const rand = (a: number, b: number) => a + Math.random() * (b - a);
// Rain's lean (horizontal travel per unit of fall) per km/h of wind, and its limit.
const LEAN_PER_KMH = 1 / 70;
const MAX_LEAN = 0.6;
// The atmosphere's cloud drift, in screen widths per second, for each unit of lean.
const DRIFT_PER_LEAN = 0.012;
const COVER_KEY = 'sky-cover';
const SCENE_KEY = 'sky-scene';

function canvasOf(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w));
  c.height = Math.max(1, Math.ceil(h));
  return [c, c.getContext('2d')!];
}

function dotSprite(hard: number): HTMLCanvasElement {
  const [c, g] = canvasOf(32, 32);
  const grad = g.createRadialGradient(16, 16, 0, 16, 16, 16);
  grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
  grad.addColorStop(hard, 'rgba(255, 255, 255, 0.85)');
  grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 32, 32);
  return c;
}

function fogSprite(width: number, col: RGB): HTMLCanvasElement {
  const height = width * 0.18;
  const [c, g] = canvasOf(width, height);
  g.filter = `blur(${Math.round(height * 0.12)}px)`;
  for (let i = 0; i < 7; i++) {
    const x = rand(width * 0.2, width * 0.8), y = rand(height * 0.4, height * 0.6), r = rand(width * 0.12, width * 0.25);
    g.save();
    g.translate(x, y);
    g.scale(1, 0.28);
    const grad = g.createRadialGradient(0, 0, 0, 0, 0, r);
    grad.addColorStop(0, rgba(col, 0.5));
    grad.addColorStop(1, rgba(col, 0));
    g.fillStyle = grad;
    g.fillRect(-r, -r, r * 2, r * 2);
    g.restore();
  }
  return c;
}

interface Drop { x: number; y: number; z: number }
interface Flake extends Drop { ph: number }
interface Stone extends Drop { vx: number; vy: number; gy: number; bounces: number }
interface Splash { x: number; y: number; t: number; z: number }
interface Band { x: number; y: number; w: number; speed: number; sprite?: HTMLCanvasElement }

const root = document.documentElement;

let canvas: HTMLCanvasElement;
let ctx: CanvasRenderingContext2D;
let w = 0, h = 0, dpr = 1;
let target: Scene = NONE;
const cur: Scene = { ...NONE };
let windX = 0.12;
let fromApi: Conditions | null = null;
let pinned: Conditions | null = null;
let enabled = true;
let primed = false;
// The last scene shown, so a new tab starts from it instead of a clear sky while the weather loads.
let lastScene: Scene | null = null;
let lastCover = '';

let drops: Drop[] = [], flakes: Flake[] = [], stones: Stone[] = [], splashes: Splash[] = [];
let bands: Band[] = [];
let toneKey = '';
let lit: RGB = [225, 230, 238], base: RGB = [128, 138, 155], fogCol: RGB = [200, 206, 216];
const dot = dotSprite(0.35), softDot = dotSprite(0.05);

let raf = 0, last = 0, clock = 0;

let flash = 0, bolt: [number, number][][] = [], boltLife = 0, nextStrike = 3, reflash = -1;

function resize(): void {
  dpr = Math.min(2, devicePixelRatio || 1);
  w = innerWidth;
  h = innerHeight;
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  const area = w * h;
  drops = Array.from({ length: Math.round(area / 3400) }, () => ({ x: spawnX(), y: rand(-h, h), z: rand(0.25, 1) }));
  flakes = Array.from({ length: Math.round(area / 6500) }, () => ({ x: rand(0, w), y: rand(-h, h), z: rand(0.2, 1), ph: rand(0, 6.3) }));
  stones = Array.from({ length: Math.round(area / 9000) }, () => newStone(true));
  bands = Array.from({ length: 7 }, (_, i) => ({ x: rand(-w, w), y: h * (0.3 + i * 0.11), w: rand(1.2, 1.8) * w, speed: rand(4, 12) * (i % 2 ? 1 : -1) }));
  toneKey = '';
}

/** An x to drop from, upwind enough that the wind carries it across the whole screen. */
function spawnX(): number {
  const drift = windX * h * 1.1;
  return rand(Math.min(0, -drift) - 20, w + Math.max(0, -drift) + 20);
}

function newStone(anywhere = false): Stone {
  const z = rand(0.3, 1);
  return { x: spawnX(), y: anywhere ? rand(-h, h) : rand(-h * 0.3, -10), z, vx: 0, vy: rand(500, 800) * (0.6 + z * 0.6), gy: h - rand(2, 40) * (1.2 - z), bounces: 0 };
}

/** 1 in full day, 0 at night: the sun's elevation when following it, otherwise the reading's day flag. */
function dayness(): number {
  if (pinned && new URLSearchParams(location.search).get('sun') === null) return pinned.day ? 1 : 0;
  if (settings().daylight) return 1 - nightness();
  return (fromApi ?? pinned)?.day ? 1 : 0;
}

function retone(d: number): void {
  const k = Math.round(cur.dark * 10) / 10, dd = Math.round(d * 10) / 10;
  const key = `${k},${dd}`;
  if (key === toneKey) return;
  toneKey = key;
  lit = mixRGB(mixRGB([62, 68, 82], [196, 203, 215], dd), [88, 95, 110], k * 0.8);
  base = mixRGB(mixRGB([30, 34, 41], [122, 133, 152], dd), [38, 42, 50], k * 0.85);
  fogCol = mixRGB([80, 86, 100], [168, 176, 190], dd);
  for (const b of bands) b.sprite = fogSprite(b.w, fogCol);
}

/** Overcast deck: a flat sheet of cloud color that hides the stars and dims the sky. */
function drawDeck(): void {
  const a = clamp((cur.cover - 0.45) * 1.8) * (0.4 + 0.25 * cur.dark);
  if (a <= 0.005) return;
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, rgba(base, a));
  g.addColorStop(0.55, rgba(mixRGB(base, lit, 0.2), a * 0.85));
  g.addColorStop(1, rgba(base, a * 0.6));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

function drawFog(dt: number): void {
  const a = cur.fog;
  if (a <= 0.01) return;
  const g = ctx.createLinearGradient(0, h * 0.25, 0, h);
  g.addColorStop(0, rgba(fogCol, 0));
  g.addColorStop(1, rgba(fogCol, 0.22 * a));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  for (const b of bands) {
    b.x += b.speed * dt;
    if (b.x > w) b.x = -b.w;
    if (b.x < -b.w) b.x = w;
    if (!b.sprite) continue;
    ctx.globalAlpha = a * 0.35;
    ctx.drawImage(b.sprite, b.x, b.y - b.w * 0.09, b.w, b.w * 0.18);
  }
  ctx.globalAlpha = 1;
}

function drawRain(dt: number, d: number): void {
  const n = Math.round(drops.length * cur.rain);
  if (!n) return;
  const col: RGB = mixRGB([150, 165, 190], [200, 215, 235], d);
  const lenScale = 0.55 + 0.45 * cur.rain;
  // Three depth buckets, one stroke each.
  for (const [lo, hi, width, alpha] of [[0, 0.5, 0.7, 0.1], [0.5, 0.8, 0.9, 0.17], [0.8, 1.01, 1.1, 0.26]] as const) {
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const p = drops[i]!;
      if (p.z < lo || p.z >= hi) continue;
      const vy = (650 + 1000 * p.z) * (0.8 + 0.3 * cur.rain);
      p.y += vy * dt;
      p.x += vy * windX * dt;
      const len = (12 + 26 * p.z) * lenScale;
      if (p.y > h) {
        if (p.z > 0.65 && splashes.length < 300) splashes.push({ x: p.x, y: h - rand(0, 18) * (1.2 - p.z), t: 0, z: p.z });
        p.y = rand(-80, -10);
        p.x = spawnX();
      }
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x - len * windX, p.y - len);
    }
    ctx.strokeStyle = rgba(col, alpha);
    ctx.lineWidth = width;
    ctx.stroke();
  }
  ctx.strokeStyle = rgba(col, 0.25);
  ctx.lineWidth = 0.8;
  splashes = splashes.filter((s) => (s.t += dt) < 0.3);
  for (const s of splashes) {
    const k = s.t / 0.3, r = 2 + 7 * k * s.z;
    ctx.globalAlpha = 1 - k;
    ctx.beginPath();
    ctx.ellipse(s.x, s.y, r, r * 0.3, 0, Math.PI, Math.PI * 2);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

function drawSnow(t: number, dt: number): void {
  const n = Math.round(flakes.length * cur.snow);
  for (let i = 0; i < n; i++) {
    const f = flakes[i]!;
    const vy = 18 + 55 * f.z;
    f.y += vy * dt;
    f.x += (Math.sin(t * (0.6 + f.z * 0.5) + f.ph) * 22 * f.z + vy * windX * 2) * dt;
    if (f.y > h + 6) { f.y = -6; f.x = rand(-0.1 * w, w * 1.1); }
    if (f.x > w + 10) f.x -= w + 20;
    if (f.x < -10) f.x += w + 20;
    const r = 1.2 + 3.2 * f.z;
    ctx.globalAlpha = 0.22 + 0.4 * f.z;
    ctx.drawImage(f.z > 0.85 ? softDot : dot, f.x - r, f.y - r, r * 2, r * 2);
  }
  ctx.globalAlpha = 1;
}

function drawHail(dt: number): void {
  const n = Math.round(stones.length * cur.hail);
  for (let i = 0; i < n; i++) {
    const s = stones[i]!;
    s.vy += 1600 * dt;
    s.x += (s.vx + s.vy * windX * (s.bounces ? 0 : 1)) * dt;
    s.y += s.vy * dt;
    if (s.y >= s.gy && s.vy > 0) {
      if (s.bounces >= 2) { stones[i] = newStone(); continue; }
      s.y = s.gy;
      s.vy *= -rand(0.22, 0.38);
      s.vx = rand(-90, 90);
      s.bounces++;
    }
    const r = 1.1 + 1.9 * s.z;
    ctx.globalAlpha = 0.4 + 0.35 * s.z;
    if (!s.bounces) {
      ctx.strokeStyle = 'rgba(230, 236, 245, 0.25)';
      ctx.lineWidth = r;
      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(s.x - s.vy * windX * 0.02, s.y - s.vy * 0.02);
      ctx.stroke();
    }
    ctx.drawImage(dot, s.x - r, s.y - r, r * 2, r * 2);
  }
  ctx.globalAlpha = 1;
}

function makeBolt(): [number, number][][] {
  const paths: [number, number][][] = [];
  const grow = (x: number, y: number, ang: number, len: number, depth: number) => {
    const pts: [number, number][] = [[x, y]];
    const end = y + len;
    while (y < end && y < h) {
      ang += rand(-0.5, 0.5);
      ang = clamp(ang, Math.PI / 2 - 0.9, Math.PI / 2 + 0.9);
      const step = rand(8, 22);
      x += Math.cos(ang) * step;
      y += Math.sin(ang) * step;
      pts.push([x, y]);
      if (depth < 2 && Math.random() < 0.06) grow(x, y, ang + rand(-0.8, 0.8), len * rand(0.15, 0.35), depth + 1);
    }
    paths.push(pts);
  };
  grow(rand(w * 0.15, w * 0.85), -10, Math.PI / 2, h * rand(0.5, 0.8), 0);
  return paths;
}

function drawStorm(t: number, dt: number): void {
  if (cur.storm > 0.5 && t > nextStrike) {
    bolt = makeBolt();
    boltLife = 0.35;
    flash = 1;
    reflash = Math.random() < 0.6 ? t + rand(0.08, 0.18) : -1;
    nextStrike = t + rand(4, 12) / cur.storm;
  }
  if (reflash > 0 && t > reflash) { flash = 0.8; boltLife = 0.25; reflash = -1; }
  if (flash > 0.01) {
    ctx.fillStyle = `rgba(205, 215, 255, ${0.18 * flash * cur.storm})`;
    ctx.fillRect(0, 0, w, h);
    flash *= Math.exp(-dt * 7);
  }
  if (boltLife > 0) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.shadowColor = 'rgba(190, 205, 255, 0.9)';
    ctx.shadowBlur = 18;
    ctx.lineJoin = 'round';
    for (const [i, path] of bolt.entries()) {
      ctx.strokeStyle = `rgba(235, 240, 255, ${clamp(boltLife / 0.35) * (i === bolt.length - 1 ? 0.95 : 0.5)})`;
      ctx.lineWidth = i === bolt.length - 1 ? 2.4 : 1.1;
      ctx.beginPath();
      path.forEach(([x, y], j) => (j ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.stroke();
    }
    ctx.restore();
    boltLife -= dt;
  }
}

function frame(t: number, dt: number): void {
  const ease = 1 - Math.exp(-dt * 0.8);
  for (const k of KEYS) cur[k] += (target[k] - cur[k]) * ease;
  const d = dayness();
  retone(d);
  const cover = clamp(Math.max(cur.cover, cur.fog)).toFixed(2);
  if (cover !== lastCover) {
    lastCover = cover;
    root.style.setProperty('--weather-cover', cover);
    try { localStorage.setItem(COVER_KEY, cover); } catch {}
  }

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  drawDeck();
  drawFog(dt);
  drawStorm(t, dt);
  const sun = sunPlace();
  renderAtmosphere(dt, {
    cover: cur.cover, dark: cur.dark, day: d, wind: windX * DRIFT_PER_LEAN, still: reducedMotion.matches,
    sun: { ...sun, vis: settings().daylight ? cur.sun : 0 },
  });
  drawRain(dt, d);
  drawHail(dt);
  drawSnow(t, dt);
}

const settled = () => KEYS.every((k) => Math.abs(cur[k] - target[k]) < 0.002);
const empty = () => KEYS.every((k) => k === 'sun' || target[k] === 0);

function loop(ms: number): void {
  const dt = Math.min(0.05, last ? (ms - last) / 1000 : 0);
  last = ms;
  clock += dt;
  if (settled() && empty()) {
    Object.assign(cur, target);
    flash = boltLife = 0;
    frame(clock, 0);
    raf = 0;
    return;
  }
  frame(clock, dt);
  raf = requestAnimationFrame(loop);
}

function start(): void {
  if (reducedMotion.matches) {
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
    // One still frame with the sun, clouds and fog; no falling particles.
    Object.assign(cur, target, { rain: 0, snow: 0, hail: 0, storm: 0 });
    frame(0, 0);
    return;
  }
  if (!raf) { last = 0; raf = requestAnimationFrame(loop); }
}

function apply(): void {
  const c = pinned ?? fromApi;
  target = enabled && c ? sceneFor(c.code) : NONE;
  if (!primed && !c && enabled && lastScene) target = lastScene;
  // A new tab shows the weather at once; later changes fade.
  if (!primed && c) { Object.assign(cur, target); primed = true; }
  if (c && enabled && !pinned) {
    try { localStorage.setItem(SCENE_KEY, JSON.stringify(target)); } catch {}
  }
  if (c?.wind !== undefined && c.windDir !== undefined) {
    // windDir is where the wind comes from; westerlies push the rain to the right.
    windX = clamp(c.wind * LEAN_PER_KMH, 0.04, MAX_LEAN) * -Math.sin(c.windDir * Math.PI / 180);
  }
  start();
}

/** Called by weather.ts with each new reading, or null when there is none. */
export function setConditions(c: Conditions | null): void {
  fromApi = c;
  // A known absence of weather replaces the remembered scene too.
  if (!c) primed = true;
  apply();
}

export function initScene(): void {
  canvas = document.getElementById('weather-layer') as HTMLCanvasElement;
  ctx = canvas.getContext('2d')!;
  // ?weather=<WMO code>[&day=0][&wind=<km/h>] pins the conditions for development.
  const q = new URLSearchParams(location.search);
  const code = q.get('weather');
  if (code !== null) pinned = { code: +code, day: q.get('day') !== '0', wind: +(q.get('wind') ?? 15), windDir: 260 };
  // The last cover, so the moon doesn't show before the weather loads.
  try { root.style.setProperty('--weather-cover', localStorage.getItem(COVER_KEY) ?? '0'); } catch {}
  try {
    const saved = JSON.parse(localStorage.getItem(SCENE_KEY) ?? 'null') as Partial<Scene> | null;
    if (saved && !pinned && settings().weatherFx) {
      lastScene = { ...NONE, ...saved };
      Object.assign(cur, lastScene);
    }
  } catch {}
  resize();
  initAtmosphere(document.getElementById('atmosphere') as HTMLCanvasElement);
  addEventListener('resize', () => { resize(); resizeAtmosphere(); start(); });
  // With no weather to animate the loop stops; the sun still moves, so redraw once a minute.
  setInterval(() => { if (!raf) frame(clock, 0); }, 60_000);
  // daylight.ts fires this when the sky's colors change; the reduced-motion still frame follows it.
  document.addEventListener('ds:theme', () => { if (reducedMotion.matches) start(); });
  reducedMotion.addEventListener('change', start);
  let daylight = settings().daylight;
  onSettings((s) => {
    if (s.daylight !== daylight) {
      // The sun shows only while following it; redraw now rather than at the next minute.
      daylight = s.daylight;
      if (!raf) frame(clock, 0);
    }
    if (s.weatherFx === enabled) return;
    enabled = s.weatherFx;
    apply();
  });
  apply();
}
