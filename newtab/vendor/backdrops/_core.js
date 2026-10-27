// Shared runtime for every backdrop. A backdrop is an ES module whose default export is
// `mount(canvas, opts) -> { stop, redraw, restart, set }`, built on `stage()` below.
//
// stage() handles everything that isn't drawing:
// - sizes the canvas to its CSS box (ResizeObserver), device pixel ratio capped at 2
// - runs a requestAnimationFrame loop at 60fps, dropping to 30 if frames get expensive
// - pauses when the tab is hidden or the canvas is scrolled offscreen (IntersectionObserver)
// - under prefers-reduced-motion draws one still frame (dt = 0) and redraws on resize
// - tracks the pointer over the canvas's host element, in canvas coordinates
// - re-runs setup when the theme changes (a `ds:theme` event, or data-ds / data-theme attribute
//   changes on <html> or the canvas's ancestors), so colours read from CSS stay current
//
// The scene object `s` passed to every hook:
//   s.ctx, s.canvas, s.w, s.h (CSS px), s.dpr, s.t (seconds since mount), s.opts
//   s.pointer = { x, y, active, down, time }  (active: moved over the host in the last 4s)
//   s.css(name, fallback)  -> trimmed custom property value from the canvas's computed style
//   s.rgb(name, fallback)  -> [r, g, b] for any CSS colour custom property
//   s.still                -> true when drawing a single reduced-motion frame
//   s.state                -> free object for the backdrop's own data

export const TAU = Math.PI * 2;
export const rand = (a, b) => a + Math.random() * (b - a);
export const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const rgba = ([r, g, b], a) => `rgba(${r | 0},${g | 0},${b | 0},${clamp(a, 0, 1)})`;
export const mixRGB = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

// Seeded PRNG (mulberry32) for scenes that should look the same on every load.
export function seeded(seed = 1) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 2D value noise in [0, 1], plus fractal sum.
export function noise2(seed = 7) {
  const hash = (x, y) => {
    let h = (x * 374761393 + y * 668265263 + seed * 2246822519) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  };
  const n = (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = x - xi, yf = y - yi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };
  n.fbm = (x, y, oct = 4) => {
    let v = 0, amp = 0.5, f = 1, norm = 0;
    for (let i = 0; i < oct; i++) { v += amp * n(x * f, y * f); norm += amp; amp *= 0.5; f *= 2; }
    return v / norm;
  };
  return n;
}

// A soft round glow sprite, drawn once and stamped with drawImage.
export function glowSprite(rgb, size = 64, core = 0.9) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const r = size / 2;
  const gr = g.createRadialGradient(r, r, 0, r, r, r);
  gr.addColorStop(0, rgba(rgb, core));
  gr.addColorStop(0.18, rgba(rgb, core * 0.4));
  gr.addColorStop(1, rgba(rgb, 0));
  g.fillStyle = gr;
  g.fillRect(0, 0, size, size);
  return c;
}

const probe = typeof document !== 'undefined' ? document.createElement('canvas').getContext('2d', { willReadFrequently: true }) : null;
export function toRGB(css, fallback = [255, 255, 255]) {
  if (!probe || !css) return fallback;
  probe.clearRect(0, 0, 1, 1);
  probe.fillStyle = '#000';
  probe.fillStyle = css;
  probe.fillRect(0, 0, 1, 1);
  const d = probe.getImageData(0, 0, 1, 1).data;
  return [d[0], d[1], d[2]];
}

// Clicks on these leave the scene alone (the page's own controls sit on top of the canvas).
const UI = 'a, button, input, select, textarea, label, summary, [role="button"], [contenteditable], .ds-panel, .ds-ui';

export function stage(canvas, hooks, opts = {}) {
  const ctx = canvas.getContext('2d');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const host = opts.host || canvas.parentElement || document.body;
  const s = {
    ctx, canvas, w: 0, h: 0, dpr: 1, t: 0, opts, still: false, state: {},
    pointer: { x: -1e4, y: -1e4, active: false, down: false, time: -Infinity },
    css(name, fallback = '') {
      const v = getComputedStyle(canvas).getPropertyValue(name).trim();
      return v || fallback;
    },
    rgb(name, fallback) { return toRGB(s.css(name), fallback); },
  };
  const start = performance.now();
  let raf = 0, last = 0, frameMs = 1000 / 60, cost = 0, visible = true, stopped = false;

  function size() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return false;
    s.dpr = Math.min(window.devicePixelRatio || 1, opts.maxDpr || 2);
    s.w = w; s.h = h;
    canvas.width = Math.round(w * s.dpr);
    canvas.height = Math.round(h * s.dpr);
    ctx.setTransform(s.dpr, 0, 0, s.dpr, 0, 0);
    return true;
  }

  function draw(now, dt) {
    if (!s.w || !s.h) return;
    s.t = (now - start) / 1000;
    s.pointer.active = now - s.pointer.time < 4000;
    hooks.draw(s, s.t, dt);
  }

  function frame(now) {
    raf = requestAnimationFrame(frame);
    const elapsed = now - last;
    if (elapsed < frameMs - 2) return;
    last = now;
    const t0 = performance.now();
    draw(now, Math.min(elapsed / 1000, 0.1));
    cost = cost * 0.95 + (performance.now() - t0) * 0.05;
    frameMs = cost > 12 ? 1000 / 30 : 1000 / (opts.fps || 60);
  }

  function run() {
    cancelAnimationFrame(raf);
    raf = 0;
    if (stopped) return;
    s.still = reduce.matches;
    if (s.still || document.hidden || !visible) {
      if (s.still) draw(performance.now(), 0);
      return;
    }
    last = performance.now();
    raf = requestAnimationFrame(frame);
  }

  function setup() {
    if (!size()) return;
    hooks.setup && hooks.setup(s);
  }

  // ---- observers ----
  let resizeTimer = 0, first = true;
  const ro = new ResizeObserver(() => {
    if (first) { first = false; setup(); run(); return; }
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if (Math.abs(canvas.clientWidth - s.w) > 1 || Math.abs(canvas.clientHeight - s.h) > 1) {
        setup();
        run();
      }
    }, 150);
  });
  ro.observe(canvas);

  const io = new IntersectionObserver((entries) => {
    visible = entries[entries.length - 1].isIntersecting;
    run();
  }, { rootMargin: '80px' });
  io.observe(canvas);

  const retheme = () => { if (s.w) { hooks.retheme ? hooks.retheme(s) : setup(); if (s.still || !raf) draw(performance.now(), 0); } };
  const mo = new MutationObserver(retheme);
  for (let el = canvas; el; el = el.parentElement) mo.observe(el, { attributes: true, attributeFilter: ['data-ds', 'data-theme', 'data-palette', 'data-tradition', 'data-mode'] });
  document.addEventListener('ds:theme', retheme);

  const local = (e) => {
    const r = canvas.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  };
  const onMove = (e) => {
    [s.pointer.x, s.pointer.y] = local(e);
    s.pointer.time = performance.now();
    hooks.pointermove && hooks.pointermove(s, s.pointer.x, s.pointer.y, e);
  };
  const onDown = (e) => {
    if (e.target instanceof Element && e.target.closest(UI)) return;
    [s.pointer.x, s.pointer.y] = local(e);
    s.pointer.time = performance.now();
    s.pointer.down = true;
    hooks.pointerdown && hooks.pointerdown(s, s.pointer.x, s.pointer.y, e);
  };
  const onUp = () => { s.pointer.down = false; hooks.pointerup && hooks.pointerup(s); };
  const onLeave = () => { s.pointer.time = -Infinity; s.pointer.down = false; };
  host.addEventListener('pointermove', onMove, { passive: true });
  host.addEventListener('pointerdown', onDown, { passive: true });
  window.addEventListener('pointerup', onUp, { passive: true });
  host.addEventListener('pointerleave', onLeave);
  document.addEventListener('visibilitychange', run);
  reduce.addEventListener('change', run);

  return {
    scene: s,
    redraw() { draw(performance.now(), 0); },
    restart() { setup(); run(); },
    set(next) { Object.assign(opts, next); hooks.options && hooks.options(s, next); if (!raf) draw(performance.now(), 0); },
    stop() {
      stopped = true;
      cancelAnimationFrame(raf);
      ro.disconnect(); io.disconnect(); mo.disconnect();
      document.removeEventListener('ds:theme', retheme);
      host.removeEventListener('pointermove', onMove);
      host.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointerup', onUp);
      host.removeEventListener('pointerleave', onLeave);
      document.removeEventListener('visibilitychange', run);
      reduce.removeEventListener('change', run);
    },
  };
}
