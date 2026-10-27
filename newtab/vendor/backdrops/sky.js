// Polar Sky: a pond reflecting the night sky. A GPU aurora (2D fallback), stars wheeling about Polaris,
// a polar star chart of real constellations, shooting stars, stratus clouds, faceted moonlit mountain
// ranges with snow, pines and mist, and ASCII koi that ripple the water and follow or flee the cursor.
//
// Colours: --sky-ink (stars, chart lines, labels), --sky-rim (moonlit ridges, the pole pointer),
// --sky-glow / --sky-mid / --sky-deep (the background gradient stops).
import { stage, rand, seeded, clamp, TAU } from './_core.js';

export const meta = {
  name: 'sky',
  title: 'Polar Sky',
  options: {
    aurora: true,
    stars: true,
    chart: true,
    meteors: true,
    clouds: true,
    mountains: true,
    koi: true,
    pole: [0.7, 0.3], // Polaris, as fractions of width and height
    fish: 0, // 0 = by area
    skyTurnSeconds: 900, // one full turn of the sky
    transparent: false,
  },
};

const MAX_CLICK_RINGS = 3;
const RING = '205, 225, 255';
// Drawn small and scaled up, which blurs the 2D aurora for free.
const AURORA_SCALE = 8;
const CELL = 5;
const MONO = 'ui-monospace, "Cascadia Mono", "SF Mono", Consolas, Menlo, monospace';
const INK = [221, 227, 234];
const RIM = [184, 227, 233];
const BG = ['#0d1424', '#070a12', '#05060a'];
// night-sky tones: dusty blue, indigo with violet, silver, and a faint aurora teal
const KOI = [
  { odds: 0.35, base: '150, 172, 210', spot: '96, 112, 180' },
  { odds: 0.25, base: '112, 120, 190', spot: '160, 132, 220' },
  { odds: 0.25, base: '178, 186, 206', spot: '84, 100, 140' },
  { odds: 0.15, base: '96, 168, 180', spot: '124, 192, 224' },
];
const EYE = '8, 9, 14';

const BANDS = [
  { y: 0.2, amp: 0.05, freq: 0.0038, speed: 0.12, tall: 0.24, rgb: [70, 240, 170], alpha: 0.2 },
  { y: 0.28, amp: 0.05, freq: 0.0052, speed: -0.09, tall: 0.18, rgb: [60, 200, 230], alpha: 0.13 },
  { y: 0.13, amp: 0.04, freq: 0.0027, speed: 0.07, tall: 0.26, rgb: [150, 100, 255], alpha: 0.12 },
];

// Mountains: four ranges, far to near. Distant ranges are paler and bluer with soft contrast (air between),
// near ones dark and crisp. `top`/`low` are peak and valley heights as fractions of the scene height;
// `snow` is the snowline within that span.
const RANGES = [
  { top: 0.27, low: 0.13, gap: 0.24, rough: 0.22, base: [17, 24, 42], light: [32, 42, 64], rim: 0.28, snow: 0.55, haze: 0.45 },
  { top: 0.2, low: 0.085, gap: 0.18, rough: 0.22, base: [11, 16, 29], light: [28, 37, 56], rim: 0.16, snow: 0.72, haze: 0.38 },
  { top: 0.13, low: 0.05, gap: 0.13, rough: 0.22, base: [7, 10, 18], light: [20, 26, 40], rim: 0.08, trees: 0.25, haze: 0.3 },
  { top: 0.08, low: 0.022, gap: 0.1, rough: 0.2, base: [3, 4, 8], light: [12, 15, 24], rim: 0.05, trees: 0.7 },
];

// Northern-sky constellations from real star positions: [right ascension (hours), declination (deg), magnitude],
// with lines joining star indexes.
const CONSTELLATIONS = [
  { // Ursa Major: the Big Dipper
    stars: [[11.062, 61.75, 1.8], [11.031, 56.38, 2.4], [11.897, 53.69, 2.4], [12.257, 57.03, 3.3], [12.9, 55.96, 1.8], [13.399, 54.93, 2.2], [13.792, 49.31, 1.9]],
    lines: [[0, 1], [1, 2], [2, 3], [3, 0], [3, 4], [4, 5], [5, 6]],
  },
  { // Ursa Minor: the Little Dipper, Polaris first
    stars: [[2.53, 89.26, 2.0], [17.537, 86.59, 4.4], [16.766, 82.04, 4.2], [15.734, 77.79, 4.3], [16.292, 75.76, 5.0], [14.845, 74.16, 2.1], [15.345, 71.83, 3.0]],
    lines: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 6], [6, 5], [5, 3]],
  },
  { // Cassiopeia
    stars: [[0.153, 59.15, 2.3], [0.675, 56.54, 2.2], [0.945, 60.72, 2.5], [1.43, 60.24, 2.7], [1.907, 63.67, 3.4]],
    lines: [[0, 1], [1, 2], [2, 3], [3, 4]],
  },
  { // Cygnus: the Northern Cross
    stars: [[20.69, 45.28, 1.3], [20.37, 40.26, 2.2], [20.77, 33.97, 2.5], [19.75, 45.13, 2.9], [19.512, 27.96, 3.1]],
    lines: [[0, 1], [1, 4], [3, 1], [1, 2]],
  },
  { // Lyra, with Vega
    stars: [[18.616, 38.78, 0.0], [18.739, 39.67, 4.7], [18.746, 37.61, 4.3], [18.908, 36.9, 4.3], [18.982, 32.69, 3.2], [18.835, 33.36, 3.5]],
    lines: [[0, 1], [0, 2], [2, 3], [3, 4], [4, 5], [5, 2]],
  },
  { // Leo: the sickle and the hindquarters
    stars: [[10.14, 11.97, 1.4], [10.122, 16.76, 3.5], [10.333, 19.84, 2.0], [10.278, 23.42, 3.4], [9.764, 23.77, 3.0], [11.818, 14.57, 2.1], [11.235, 20.52, 2.6], [11.237, 15.43, 3.3]],
    lines: [[0, 1], [1, 2], [2, 3], [3, 4], [2, 6], [6, 5], [5, 7], [7, 0], [6, 7]],
  },
  { // Gemini: the twins Castor and Pollux
    stars: [[7.577, 31.89, 1.6], [7.755, 28.03, 1.1], [6.629, 16.4, 1.9], [6.732, 25.13, 3.0], [7.335, 21.98, 3.5], [6.383, 22.51, 2.9]],
    lines: [[0, 1], [0, 3], [3, 5], [1, 4], [4, 2]],
  },
  { // Orion
    stars: [[5.919, 7.41, 0.5], [5.418, 6.35, 1.6], [5.679, -1.94, 1.8], [5.603, -1.2, 1.7], [5.533, -0.3, 2.2], [5.796, -9.67, 2.1], [5.242, -8.2, 0.1], [5.585, 9.93, 3.4]],
    lines: [[7, 0], [7, 1], [0, 1], [0, 2], [1, 4], [2, 3], [3, 4], [2, 5], [4, 6]],
  },
];
const POLARIS = [2.53, 89.26];

// Aurora curtains on the GPU: domain-warped noise folds and drifts the curtain like smoke,
// rays slide along it, and colour runs from a green hem to violet at the top.
const AURORA_FRAG = `
  precision mediump float;
  uniform vec2 res;
  uniform float t;
  float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p), u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
  }
  float fbm(vec2 p) {
    float v = 0.0, a = 0.5;
    mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
    for (int i = 0; i < 4; i++) { v += a * noise(p); p = m * p; a *= 0.5; }
    return v;
  }
  vec3 curtain(vec2 uv, float seed, float base, float speed) {
    float s = t * speed;
    vec2 p = vec2(uv.x * 1.2 + seed, s * 0.05);
    vec2 q = vec2(fbm(p + vec2(0.0, s * 0.08)), fbm(p + vec2(5.2, 1.3) - s * 0.06));
    vec2 r = vec2(fbm(p + 3.0 * q + vec2(1.7, 9.2) + s * 0.1), fbm(p + 3.0 * q + vec2(8.3, 2.8) - s * 0.08));
    float x = uv.x + 0.4 * (r.x - 0.5);
    float edge = base + 0.2 * (fbm(vec2(x * 2.0 + seed, s * 0.07)) - 0.5) + 0.08 * (r.y - 0.5);
    float d = uv.y - edge;
    float rays = fbm(vec2(x * 34.0 + seed * 7.0 - s * 0.5, uv.y * 0.8 + s * 0.15));
    rays = 0.5 + rays * 0.9;
    float body = d > 0.0 ? exp(-d * 4.0) : exp(d * 50.0);
    float fold = smoothstep(0.3, 0.75, r.x);
    float hgt = clamp(d * 3.2, 0.0, 1.0);
    vec3 col = mix(vec3(0.25, 1.0, 0.62), vec3(0.2, 0.75, 1.0), smoothstep(0.0, 0.45, hgt));
    col = mix(col, vec3(0.62, 0.35, 1.0), smoothstep(0.4, 1.0, hgt));
    col *= body * (0.3 + rays) * (0.3 + fold);
    col += vec3(0.45, 1.0, 0.75) * exp(-abs(d) * 80.0) * 0.25 * fold;
    return col;
  }
  void main() {
    vec2 uv = gl_FragCoord.xy / res;
    uv.x *= res.x / res.y;
    vec3 col = curtain(uv, 0.0, 0.68, 0.5) * 0.8
      + curtain(uv, 3.7, 0.57, 0.6) * 0.5
      + curtain(uv, 9.1, 0.8, 0.4) * 0.4;
    // muted: dimmed and pulled toward grey so it stays behind the page
    col = mix(col, vec3(dot(col, vec3(0.33))), 0.35);
    gl_FragColor = vec4(col * 0.2, 1.0);
  }`;

const canvasOf = (w, h) => {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w));
  c.height = Math.max(1, Math.ceil(h));
  return c;
};

// A vertical light curtain: faint violet top, bright at the lower edge, then a quick fade.
function raySprite({ rgb }) {
  const c = canvasOf(1, 128);
  const cc = c.getContext('2d');
  const g = cc.createLinearGradient(0, 0, 0, 128);
  const [r, gr, b] = rgb;
  g.addColorStop(0, 'rgba(120, 80, 255, 0)');
  g.addColorStop(0.45, `rgba(${r}, ${gr}, ${b}, 0.25)`);
  g.addColorStop(0.78, `rgba(${r}, ${gr}, ${b}, 1)`);
  g.addColorStop(1, `rgba(${r}, ${gr}, ${b}, 0)`);
  cc.fillStyle = g;
  cc.fillRect(0, 0, 1, 128);
  return c;
}

function inkGlow(ink) {
  const c = canvasOf(32, 32);
  const cc = c.getContext('2d');
  const g = cc.createRadialGradient(16, 16, 0, 16, 16, 16);
  g.addColorStop(0, `rgba(${ink}, 0.9)`);
  g.addColorStop(0.15, `rgba(${ink}, 0.35)`);
  g.addColorStop(1, `rgba(${ink}, 0)`);
  cc.fillStyle = g;
  cc.fillRect(0, 0, 32, 32);
  return c;
}

// Thin stratus wisps: soft puffs squashed flat.
function cloudSprite(width) {
  const height = width * 0.14;
  const c = canvasOf(width, height);
  const cc = c.getContext('2d');
  for (let i = 0; i < 18; i++) {
    const x = rand(width * 0.12, width * 0.88);
    const y = rand(height * 0.4, height * 0.6);
    const r = rand(width * 0.06, width * 0.16);
    cc.save();
    cc.translate(x, y);
    cc.scale(1, rand(0.12, 0.22));
    const g = cc.createRadialGradient(0, 0, 0, 0, 0, r);
    g.addColorStop(0, 'rgba(150, 165, 210, 0.07)');
    g.addColorStop(1, 'rgba(150, 165, 210, 0)');
    cc.fillStyle = g;
    cc.fillRect(-r, -r, r * 2, r * 2);
    cc.restore();
  }
  return c;
}

function makeAuroraGL(st) {
  const c = document.createElement('canvas');
  const g = c.getContext('webgl', { antialias: false, preserveDrawingBuffer: true, alpha: false });
  if (!g) return null;
  const shader = (type, src) => {
    const sh = g.createShader(type);
    g.shaderSource(sh, src);
    g.compileShader(sh);
    return g.getShaderParameter(sh, g.COMPILE_STATUS) ? sh : null;
  };
  const vs = shader(g.VERTEX_SHADER, 'attribute vec2 p; void main() { gl_Position = vec4(p, 0.0, 1.0); }');
  const fs = shader(g.FRAGMENT_SHADER, AURORA_FRAG);
  if (!vs || !fs) return null;
  const prog = g.createProgram();
  g.attachShader(prog, vs);
  g.attachShader(prog, fs);
  g.linkProgram(prog);
  if (!g.getProgramParameter(prog, g.LINK_STATUS)) return null;
  g.useProgram(prog);
  g.bindBuffer(g.ARRAY_BUFFER, g.createBuffer());
  g.bufferData(g.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), g.STATIC_DRAW);
  const loc = g.getAttribLocation(prog, 'p');
  g.enableVertexAttribArray(loc);
  g.vertexAttribPointer(loc, 2, g.FLOAT, false, 0, 0);
  const gl = { c, g, res: g.getUniformLocation(prog, 'res'), t: g.getUniformLocation(prog, 't'), lost: false };
  // fall back to the 2D aurora while the GPU resets, then rebuild on a fresh canvas
  c.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    gl.lost = true;
  });
  c.addEventListener('webglcontextrestored', () => {
    if (!st.stopped) st.gl = makeAuroraGL(st);
  });
  return gl;
}

export default function mount(canvas, opts = {}) {
  opts = { ...meta.options, ...opts };
  const st = {
    seed: (Math.random() * 2 ** 32) >>> 0,
    glyphs: new Map(),
    rays: null,
    gl: undefined, // undefined = not tried yet, null = unavailable
    stars: [], clouds: [], meteors: [], fish: [], ripples: [],
    nextMeteor: 0, nextDrop: 0,
    stopped: false,
  };

  const pole = (s) => {
    const p = Array.isArray(s.opts.pole) ? s.opts.pole : meta.options.pole;
    return [s.w * (+p[0] || 0), s.h * (+p[1] || 0)];
  };
  const turnRate = (s) => TAU / Math.max(1, +s.opts.skyTurnSeconds || 900);

  // ---------- colours and cached layers ----------

  function colours(s) {
    st.ink = s.rgb('--sky-ink', INK).join(', ');
    st.rim = s.rgb('--sky-rim', RIM).join(', ');
    st.bgStops = [s.css('--sky-glow', BG[0]), s.css('--sky-mid', BG[1]), s.css('--sky-deep', BG[2])];
    st.glow = inkGlow(st.ink);
    st.glyphs.clear();
  }

  // The CSS sky: radial-gradient(120% 80% at 70% 0%, glow 0%, mid 45%, deep 100%), baked once.
  function drawBackground(s) {
    const c = (st.bg = canvasOf(s.canvas.width, s.canvas.height));
    const g = c.getContext('2d');
    g.setTransform(s.dpr, 0, 0, s.dpr, 0, 0);
    g.fillStyle = st.bgStops[2];
    g.fillRect(0, 0, s.w, s.h);
    g.save();
    g.translate(s.w * 0.7, 0);
    g.scale(s.w * 1.2, s.h * 0.8);
    const gr = g.createRadialGradient(0, 0, 0, 0, 0, 1);
    gr.addColorStop(0, st.bgStops[0]);
    gr.addColorStop(0.45, st.bgStops[1]);
    gr.addColorStop(1, st.bgStops[2]);
    g.fillStyle = gr;
    g.fillRect(-2, -2, 4, 4);
    g.restore();
  }

  function buildStars(s) {
    // Stars sit on a disc around the pole wide enough to cover the canvas at any rotation.
    const [px, py] = pole(s);
    const reach = Math.hypot(Math.max(px, s.w - px), Math.max(py, s.h - py));
    st.stars = Array.from({ length: Math.round((Math.PI * reach * reach) / 3400) }, () => {
      const big = Math.random() < 0.06;
      return {
        angle: rand(0, TAU),
        dist: reach * Math.sqrt(Math.random()),
        r: big ? rand(1, 1.5) : rand(0.35, 0.9),
        big,
        base: big ? rand(0.6, 0.9) : rand(0.15, 0.6),
        speed: rand(0.5, 2),
        phase: rand(0, TAU),
      };
    });
  }

  function buildFish(s) {
    const n = +s.opts.fish > 0 ? Math.round(+s.opts.fish) : Math.max(4, Math.min(10, Math.round((s.w * s.h) / 170000)));
    st.fish = Array.from({ length: n }, () => makeFish(s));
    st.fish.sort((a, b) => a.depth - b.depth);
    st.ripples = [];
    // a few seconds of swimming up front, so a still frame shows curved bodies and a ring or two
    const away = s.pointer.active;
    s.pointer.active = false;
    for (let i = 0; i < 120; i++) {
      for (const f of st.fish) swim(s, f, i * 33, 1 / 30);
      drawRipples(s, 1 / 30, false);
    }
    s.pointer.active = away;
    const lag = s.t * 1000 - 4000;
    for (const f of st.fish) { f.nextMood += lag; f.nextWander += lag; f.nextRipple += lag; }
  }

  function setup(s) {
    colours(s);
    drawBackground(s);
    st.aurora = canvasOf(s.w / AURORA_SCALE, s.h / AURORA_SCALE);
    st.actx = st.aurora.getContext('2d');
    st.rays = st.rays || BANDS.map(raySprite);
    buildStars(s);
    st.clouds = Array.from({ length: Math.max(3, Math.round(s.w / 420)) }, () => {
      const sprite = cloudSprite(rand(s.w * 0.35, s.w * 0.7));
      return { sprite, x: rand(-sprite.width, s.w), y: rand(s.h * 0.38, s.h * 0.8) - sprite.height / 2, v: rand(3, 9) };
    });
    buildFish(s);
    st.meteors = [];
    const now = s.t * 1000;
    st.nextMeteor = now + 1500;
    st.nextDrop = now + rand(8000, 20000);
    st.horizon = null;
    if (s.opts.mountains) drawHorizon(s);
  }

  // A theme change only recolours: same stars, fish and (seeded) mountains.
  function retheme(s) {
    colours(s);
    drawBackground(s);
    st.horizon = null;
    if (s.opts.mountains) drawHorizon(s);
  }

  // ---------- pond ----------

  // One character pre-rendered per colour, so each fish cell is a cheap drawImage.
  function glyph(s, ch, rgb) {
    const key = ch + rgb;
    let g = st.glyphs.get(key);
    if (!g) {
      g = canvasOf(CELL * 1.6 * s.dpr, CELL * 1.6 * s.dpr);
      const gc = g.getContext('2d');
      gc.scale(s.dpr, s.dpr);
      gc.font = `700 ${CELL + 2}px ${MONO}`;
      gc.textAlign = 'center';
      gc.textBaseline = 'middle';
      gc.fillStyle = `rgb(${rgb})`;
      gc.fillText(ch, CELL * 0.8, CELL * 0.8);
      st.glyphs.set(key, g);
    }
    return g;
  }

  function makeFish(s) {
    let roll = Math.random();
    const kind = KOI.find((k) => (roll -= k.odds) < 0) || KOI[0];
    const a = rand(0, TAU);
    const x = rand(s.w * 0.1, s.w * 0.9);
    const y = rand(s.h * 0.1, s.h * 0.85);
    const seg = CELL * 0.9;
    const len = Math.round(rand(10, 14));
    return {
      pts: Array.from({ length: len }, (_, i) => ({ x: x - Math.cos(a) * seg * i, y: y - Math.sin(a) * seg * i })),
      seg,
      a,
      kind,
      width: rand(1.6, 2.2) * CELL,
      spots: Array.from({ length: Math.round(rand(1, 3)) }, () => ({ s: rand(0.05, 0.7), side: rand(-0.8, 0.8), r: rand(0.1, 0.22) })),
      depth: rand(0.4, 1),
      cruise: rand(20, 40),
      speed: 25,
      boost: 0,
      wander: a,
      nextWander: 0,
      // +1 swims to the cursor, -1 darts away; re-rolled now and then
      mood: Math.random() < 0.5 ? 1 : -1,
      nextMood: 0,
      startled: false,
      phase: rand(0, TAU),
      nextRipple: 0,
    };
  }

  // size is roughly how far the ring carries before it fades, in px
  function ripple(x, y, size, strength = 1, click = false) {
    if (st.ripples.length > 40) st.ripples.shift();
    // at most three click rings at once: a new click quickly fades out the oldest
    if (click) {
      const clicks = st.ripples.filter((r) => r.click && r.fade === undefined);
      if (clicks.length >= MAX_CLICK_RINGS) clicks[0].fade = 1;
    }
    st.ripples.push({ x, y, r: 0, max: size * 5.5, speed: rand(52, 64), strength: Math.min(1, 0.45 * strength + 0.15), click });
  }

  const turnToward = (from, to) => Math.atan2(Math.sin(to - from), Math.cos(to - from));

  function swim(s, f, now, dt) {
    const { w, h, pointer } = s;
    const head = f.pts[0];
    if (now > f.nextMood) {
      f.mood = Math.random() < 0.5 ? 1 : -1;
      f.nextMood = now + rand(6000, 15000);
    }
    if (now > f.nextWander) {
      f.wander = f.a + rand(-1.2, 1.2);
      f.nextWander = now + rand(1500, 4000);
    }
    let desired = f.wander;
    let target = f.cruise;
    const edge = 50;
    if (head.x < edge || head.x > w - edge || head.y < edge || head.y > h - edge) {
      desired = Math.atan2(h / 2 - head.y + rand(-80, 80), w / 2 - head.x + rand(-80, 80));
      f.wander = desired;
    }
    if (pointer.active) {
      const dx = pointer.x - head.x;
      const dy = pointer.y - head.y;
      const d = Math.hypot(dx, dy);
      if (f.mood > 0 && d < 280) {
        desired = Math.atan2(dy, dx);
        target = d < 40 ? 4 : f.cruise * 1.5;
      } else if (f.mood < 0 && d < 170) {
        desired = Math.atan2(-dy, -dx);
        target = f.cruise * 2.5;
        if (!f.startled) {
          f.startled = true;
          f.boost = 1;
          ripple(head.x, head.y, 40, 1);
        }
      } else f.startled = false;
    } else f.startled = false;

    f.boost = Math.max(0, f.boost - dt * 0.9);
    f.speed += (target + f.boost * 140 - f.speed) * Math.min(1, dt * 2.5);
    const turn = (2.4 + f.boost * 5) * dt;
    f.a += Math.max(-turn, Math.min(turn, turnToward(f.a, desired)));
    // the tail beat: the head weaves, the body follows it
    const weave = f.a + Math.sin((now / 1000) * (3 + f.speed / 10) + f.phase) * 0.38;
    head.x += Math.cos(weave) * f.speed * dt;
    head.y += Math.sin(weave) * f.speed * dt;
    for (let i = 1; i < f.pts.length; i++) {
      const p = f.pts[i - 1];
      const q = f.pts[i];
      const L = Math.hypot(q.x - p.x, q.y - p.y) || 1;
      q.x = p.x + ((q.x - p.x) / L) * f.seg;
      q.y = p.y + ((q.y - p.y) / L) * f.seg;
    }
    if (now > f.nextRipple) {
      ripple(head.x, head.y, rand(14, 26), 0.55);
      f.nextRipple = now + rand(3000, 8000) / (1 + f.boost * 3);
    }
  }

  // Half-width along the body, as a fraction of the fish's width: round head, plump middle, fanned tail.
  function profile(u0) {
    if (u0 > 0.8) return 0.25 + 0.65 * ((u0 - 0.8) / 0.2);
    const u = u0 / 0.8;
    return Math.max(0.25, Math.pow(Math.sin(Math.PI * (0.1 + u * 0.85)), 0.75) * (u < 0.4 ? 1 : 1 - (u - 0.4) * 0.8));
  }

  function drawFish(s, f, t) {
    const ctx = s.ctx;
    const cells = new Map();
    const put = (gx, gy, ch, rgb, rank) => {
      const key = gx * 65536 + gy;
      const had = cells.get(key);
      if (!had || had.rank < rank) cells.set(key, { gx, gy, ch, rgb, rank });
    };
    const n = f.pts.length;
    const flap = 0.6 + 0.4 * Math.sin(t * 5 + f.phase);
    for (let i = 0; i < n - 1; i++) {
      const p = f.pts[i];
      const q = f.pts[i + 1];
      const L = Math.hypot(p.x - q.x, p.y - q.y) || 1;
      const nx = -(p.y - q.y) / L;
      const ny = (p.x - q.x) / L;
      for (let u = 0; u < 1; u += 0.5) {
        const x = p.x + (q.x - p.x) * u;
        const y = p.y + (q.y - p.y) * u;
        const sAlong = (i + u) / (n - 1);
        const half = profile(sAlong) * f.width;
        const fin = sAlong > 0.2 && sAlong < 0.32 ? f.width * 0.8 * flap : 0;
        const reach = half + fin;
        for (let k = -reach; k <= reach + 0.01; k += CELL * 0.5) {
          const gx = Math.floor((x + nx * k) / CELL);
          const gy = Math.floor((y + ny * k) / CELL);
          const side = k / half;
          const ab = Math.abs(side);
          if (ab > 1) put(gx, gy, '~', f.kind.base, 0);
          else if (sAlong > 0.8) put(gx, gy, ab > 0.55 ? '.' : ':', f.kind.base, 1);
          else {
            const spot = f.spots.some((sp) => ((sAlong - sp.s) / sp.r) ** 2 + ((side - sp.side) / 0.9) ** 2 < 1);
            const rgb = spot ? f.kind.spot : f.kind.base;
            if (ab < 0.3) put(gx, gy, '@', rgb, 5);
            else if (ab < 0.6) put(gx, gy, '#', rgb, 4);
            else if (ab < 0.85) put(gx, gy, '*', rgb, 3);
            else put(gx, gy, ':', rgb, 2);
          }
        }
      }
    }
    // eyes, just behind the snout
    const [p, q] = f.pts;
    const L = Math.hypot(p.x - q.x, p.y - q.y) || 1;
    const half = profile(0.06) * f.width * 0.6;
    for (const sgn of [-1, 1]) {
      const ex = p.x + ((q.x - p.x) / L) * f.seg * 0.5 - ((p.y - q.y) / L) * half * sgn;
      const ey = p.y + ((q.y - p.y) / L) * f.seg * 0.5 + ((p.x - q.x) / L) * half * sgn;
      put(Math.floor(ex / CELL), Math.floor(ey / CELL), 'o', EYE, 9);
    }
    ctx.globalAlpha = 0.15 + 0.4 * f.depth;
    const size = CELL * 1.6;
    const off = CELL / 2 - CELL * 0.8;
    for (const c of cells.values()) ctx.drawImage(glyph(s, c.ch, c.rgb), c.gx * CELL + off, c.gy * CELL + off, size, size);
    ctx.globalAlpha = 1;
  }

  // Ripples are thin rings that travel far and fade slowly. Where two rings cross, the meeting points glint.
  function drawRipples(s, dt, paint = true) {
    const ctx = s.ctx;
    st.ripples = st.ripples.filter((r) => r.r < r.max && !(r.fade <= 0));
    const live = [];
    for (const r of st.ripples) {
      r.r += r.speed * dt;
      if (r.fade !== undefined) r.fade -= dt / 0.25;
      const a = r.strength * Math.pow(1 - r.r / r.max, 1.6) * Math.min(1, r.r / 24) * Math.max(0, r.fade ?? 1);
      if (a < 0.004) continue;
      if (!paint) continue;
      live.push({ r, a });
      ctx.lineWidth = 1;
      for (const [off, k] of [[0, 1], [-9, 0.45], [-18, 0.2]]) {
        const radius = r.r + off;
        if (radius < 2) continue;
        ctx.strokeStyle = `rgba(${RING}, ${a * k})`;
        ctx.beginPath();
        ctx.arc(r.x, r.y, radius, 0, TAU);
        ctx.stroke();
      }
    }
    for (let i = 0; i < live.length; i++) {
      for (let j = i + 1; j < live.length; j++) {
        const A = live[i].r;
        const B = live[j].r;
        const dx = B.x - A.x;
        const dy = B.y - A.y;
        const d = Math.hypot(dx, dy);
        if (d === 0 || d >= A.r + B.r || d <= Math.abs(A.r - B.r)) continue;
        const along = (A.r * A.r - B.r * B.r + d * d) / (2 * d);
        const across = Math.sqrt(Math.max(0, A.r * A.r - along * along));
        const mx = A.x + (dx * along) / d;
        const my = A.y + (dy * along) / d;
        ctx.globalAlpha = Math.min(0.9, Math.sqrt(live[i].a * live[j].a) * 2.2);
        for (const sgn of [-1, 1]) {
          const px = mx - (dy * across * sgn) / d;
          const py = my + (dx * across * sgn) / d;
          ctx.drawImage(st.glow, px - 7, py - 7, 14, 14);
        }
      }
    }
    ctx.globalAlpha = 1;
  }

  // ---------- mountains ----------

  // Each ridgeline is fractal, cut into low-poly facets lit by a moon in the upper left. Seeded, so a
  // theme change redraws the same ranges.
  function drawHorizon(s) {
    const { w, h, dpr } = s;
    const horizon = (st.horizon = canvasOf(s.canvas.width, s.canvas.height));
    const hctx = horizon.getContext('2d');
    hctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const R = seeded(st.seed);
    const rnd = (a, b) => a + R() * (b - a);
    // scene height: on tall phone screens the range scales with width instead
    const H = Math.min(h, w * 1.1);
    const phase = rnd(0, 10);
    const lerp2 = (p, q, t) => [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t];
    const poly = (pts, fill) => {
      hctx.beginPath();
      pts.forEach(([x, y], i) => (i ? hctx.lineTo(x, y) : hctx.moveTo(x, y)));
      hctx.closePath();
      hctx.fillStyle = fill;
      hctx.fill();
    };
    // v > 0 adds moonlight, v < 0 deepens the shadow
    const tone = (r, v) =>
      v >= 0
        ? `rgb(${r.base.map((c, i) => Math.round(c + r.light[i] * v)).join(', ')})`
        : `rgb(${r.base.map((c) => Math.round(c * (1 + 0.5 * v))).join(', ')})`;

    // a faint glow along the horizon so the farthest ridge stands off the sky
    const glowTop = h - H * 0.5;
    const skyGlow = hctx.createLinearGradient(0, glowTop, 0, h - H * 0.12);
    skyGlow.addColorStop(0, 'rgba(60, 90, 140, 0)');
    skyGlow.addColorStop(1, 'rgba(60, 90, 140, 0.12)');
    hctx.fillStyle = skyGlow;
    hctx.fillRect(0, glowTop, w, h - glowTop);

    RANGES.forEach((r, layer) => {
      const ceil = h - H * r.top * 1.3;
      const floor = h - H * r.low * 0.5;

      // anchors follow a slow swell plus one or two dominant summits
      const summits = [rnd(0.05, 0.95), rnd(0.05, 0.95)];
      const gap = Math.max(60, w * r.gap);
      let pts = [];
      for (let x = -gap; x <= w + gap; x += gap * rnd(0.6, 1.2)) {
        const u = x / w;
        let f = 0.22 + 0.22 * Math.sin(u * 3 + phase + layer) * Math.sin(u * 1.3 - phase * 0.5);
        for (const p of summits) f += 0.7 * Math.exp(-((u - p) ** 2) / 0.006);
        f = clamp(f * rnd(0.6, 1.15), 0.04, 1);
        pts.push([x, h - H * (r.low + (r.top - r.low) * f)]);
      }
      // midpoint displacement: split every segment twice, nudging each new point up or down
      for (let pass = 0, amp = r.rough; pass < 2; pass++, amp *= 0.5) {
        const next = [pts[0]];
        for (let i = 1; i < pts.length; i++) {
          const [ax, ay] = pts[i - 1];
          const [bx, by] = pts[i];
          const len = bx - ax;
          next.push([ax + len * rnd(0.35, 0.65), clamp((ay + by) / 2 + rnd(-1, 1) * len * amp, ceil, floor)], [bx, by]);
        }
        pts = next;
      }

      // each ridge point drops a spur partway down the slope; ridge, spurs and ground form the facets
      const spurs = pts.map(([x, y], i) => {
        const span = pts[Math.min(i + 1, pts.length - 1)][0] - pts[Math.max(i - 1, 0)][0];
        return [x + rnd(-0.15, 0.15) * span, y + (h - y) * rnd(0.35, 0.6)];
      });
      poly([[pts[0][0], h], ...pts, [pts[pts.length - 1][0], h]], tone(r, -0.2));
      for (let i = 0; i < pts.length - 1; i++) {
        const A = pts[i];
        const B = pts[i + 1];
        const SA = spurs[i];
        const SB = spurs[i + 1];
        // a slope rising to the right faces the moon
        const slope = (B[1] - A[1]) / (B[0] - A[0] || 1);
        const lit = clamp(-slope * 1.3, -1, 1) + rnd(-0.07, 0.07);
        if (R() < 0.5) {
          poly([A, B, SA], tone(r, lit));
          poly([B, SB, SA], tone(r, lit * 0.5 - 0.12));
        } else {
          poly([A, B, SB], tone(r, lit));
          poly([A, SB, SA], tone(r, lit * 0.5 - 0.12));
        }
        poly([SA, SB, [SB[0], h], [SA[0], h]], tone(r, lit * 0.2 - 0.3));
      }

      // faceted snowcaps above the snowline, brighter on the moonward side
      if (r.snow) {
        const line = h - H * (r.low + (r.top - r.low) * r.snow);
        const fade = 1 - layer * 0.25;
        for (let i = 1; i < pts.length - 1; i++) {
          const V = pts[i];
          const depth = line - V[1];
          if (depth <= 0) continue;
          const reach = (q) => clamp(depth / (Math.abs(q[1] - V[1]) + depth), 0.15, 0.85) * rnd(0.7, 1);
          const left = lerp2(V, pts[i - 1], reach(pts[i - 1]));
          const right = lerp2(V, pts[i + 1], reach(pts[i + 1]));
          const down = lerp2(V, spurs[i], clamp(depth / (spurs[i][1] - V[1]), 0.1, 0.55) * rnd(0.7, 1));
          poly([left, V, down], `rgba(226, 236, 255, ${0.3 * fade})`);
          poly([V, right, down], `rgba(150, 170, 210, ${0.14 * fade})`);
        }
      }

      // moonlight catches the ridge only on slopes that face it
      hctx.lineWidth = 1;
      for (let i = 0; i < pts.length - 1; i++) {
        const [ax, ay] = pts[i];
        const [bx, by] = pts[i + 1];
        const facing = -(by - ay) / (bx - ax || 1);
        hctx.strokeStyle = facing > 0 ? `rgba(${st.rim}, ${r.rim * clamp(facing * 1.5, 0.15, 1)})` : `rgba(${st.ink}, ${r.rim * 0.12})`;
        hctx.beginPath();
        hctx.moveTo(ax, ay);
        hctx.lineTo(bx, by);
        hctx.stroke();
      }

      // pines along the ridge in loose clusters, for scale
      if (r.trees) {
        const scale = layer === RANGES.length - 1 ? 1 : 0.55;
        const pine = tone(r, -0.45);
        let k = 0;
        for (let x = rnd(0, 20); x < w; ) {
          while (k < pts.length - 2 && pts[k + 1][0] < x) k++;
          const [ax, ay] = pts[k];
          const [bx, by] = pts[k + 1];
          const y = ay + ((by - ay) * (x - ax)) / (bx - ax || 1);
          if (R() > r.trees) {
            x += rnd(20, 90);
            continue;
          }
          const tall = H * rnd(0.012, 0.03) * scale;
          for (let tier = 0; tier < 3; tier++) {
            const tipY = y + 2 - tall * (1 - tier * 0.26);
            const half = tall * (0.16 + tier * 0.07);
            poly([[x, tipY], [x - half, tipY + tall * 0.42], [x + half, tipY + tall * 0.42]], pine);
          }
          x += tall * rnd(0.35, 0.9);
        }
      }

      // mist pools in the valleys in front of every range but the nearest
      if (r.haze) {
        const top = h - H * r.top * 0.7;
        const mist = hctx.createLinearGradient(0, top, 0, h - H * r.low * 0.4);
        mist.addColorStop(0, 'rgba(20, 30, 52, 0)');
        mist.addColorStop(1, `rgba(20, 30, 52, ${r.haze})`);
        hctx.fillStyle = mist;
        hctx.fillRect(0, top, w, h - top);
      }
    });
  }

  // ---------- sky ----------

  function drawAurora(s, t) {
    const { ctx, w, h } = s;
    if (st.gl === undefined) st.gl = makeAuroraGL(st);
    const gl = st.gl;
    if (gl && !gl.lost) {
      const { c, g } = gl;
      // a quarter resolution is plenty for soft light and keeps the GPU cost small
      const cw = Math.ceil(w / 4);
      const ch = Math.ceil(h / 4);
      if (c.width !== cw || c.height !== ch) {
        c.width = cw;
        c.height = ch;
      }
      g.viewport(0, 0, cw, ch);
      g.uniform2f(gl.res, cw, ch);
      g.uniform1f(gl.t, t);
      g.drawArrays(g.TRIANGLES, 0, 3);
      ctx.globalCompositeOperation = 'lighter';
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(c, 0, 0, w, h);
      ctx.globalCompositeOperation = 'source-over';
      return;
    }
    const { aurora, actx, rays } = st;
    const aw = aurora.width;
    const ah = aurora.height;
    actx.clearRect(0, 0, aw, ah);
    actx.globalCompositeOperation = 'lighter';
    BANDS.forEach((b, i) => {
      for (let x = 0; x < aw; x++) {
        const X = x * AURORA_SCALE;
        const curve =
          b.y + b.amp * Math.sin(X * b.freq + t * b.speed + i) + b.amp * 0.45 * Math.sin(X * b.freq * 2.7 - t * b.speed * 1.9);
        const shimmer = 0.5 + 0.5 * Math.sin(X * 0.0047 + t * 0.35 + i * 2.1);
        const folds = 0.5 + 0.5 * Math.sin(X * 0.013 - t * 0.22 + i);
        const ray = 0.6 + 0.4 * Math.sin(X * 0.09 + i * 5 + t * 0.6) * Math.sin(X * 0.031 - t * 0.4);
        const strength = b.alpha * (0.15 + 0.85 * shimmer * shimmer) * (0.55 + 0.45 * folds) * ray;
        const tall = (b.tall * h * (0.7 + 0.5 * folds) * (0.8 + 0.3 * ray)) / AURORA_SCALE;
        const bottom = ((curve + 0.012 * ray) * h) / AURORA_SCALE;
        actx.globalAlpha = strength;
        actx.drawImage(rays[i], x, bottom - tall, 1.5, tall);
      }
    });
    actx.globalAlpha = 1;
    actx.globalCompositeOperation = 'source-over';
    ctx.globalCompositeOperation = 'lighter';
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(aurora, 0, 0, w, h);
    ctx.globalCompositeOperation = 'source-over';
  }

  function drawStars(s, t) {
    const { ctx, w, h } = s;
    const [cx, cy] = pole(s);
    const turn = t * turnRate(s);
    ctx.fillStyle = `rgb(${st.ink})`;
    for (const star of st.stars) {
      const x = cx + Math.cos(star.angle + turn) * star.dist;
      const y = cy + Math.sin(star.angle + turn) * star.dist;
      if (x < -10 || y < -10 || x > w + 10 || y > h + 10) continue;
      const a = star.base * (0.65 + 0.35 * Math.sin(t * star.speed + star.phase));
      ctx.globalAlpha = a;
      ctx.beginPath();
      ctx.arc(x, y, star.r, 0, TAU);
      ctx.fill();
      if (star.big) {
        ctx.globalAlpha = a * 0.6;
        ctx.drawImage(st.glow, x - 9, y - 9, 18, 18);
      }
    }
    ctx.globalAlpha = 1;
  }

  // Polar star chart pivoting on Polaris, which stays put while everything else turns with the sky:
  // declination circles, right-ascension spokes and hour labels, a ticked rim at +50°, and the constellations.
  function drawChart(s, t) {
    const { ctx, w, h } = s;
    const [cx, cy] = pole(s);
    const r = Math.min(w, h) * 0.3;
    const turn = t * turnRate(s);
    const perDeg = r / 40;
    const cosT = Math.cos(turn);
    const sinT = Math.sin(turn);
    const flat = ([ra, dec]) => {
      const a = -(ra / 24) * TAU;
      const d = (90 - dec) * perDeg;
      return [Math.cos(a) * d, Math.sin(a) * d];
    };
    const [px, py] = flat(POLARIS);
    const place = (star) => {
      const [x, y] = flat(star);
      const dx = x - px;
      const dy = y - py;
      return [cx + dx * cosT - dy * sinT, cy + dx * sinT + dy * cosT];
    };
    const raAngle = (hours) => -(hours / 24) * TAU + turn;
    const ring = (dec) => (90 - dec) * perDeg;
    const ink = (alpha) => `rgba(${st.ink}, ${alpha})`;
    const at = (ang, dist) => [cx + Math.cos(ang) * dist, cy + Math.sin(ang) * dist];
    ctx.lineWidth = 1;

    // declination circles; +30° and the celestial equator dashed
    for (const [dec, alpha, dash] of [[80, 0.05, []], [70, 0.05, []], [60, 0.06, []], [30, 0.05, [2, 6]], [0, 0.06, [2, 6]]]) {
      ctx.setLineDash(dash);
      ctx.strokeStyle = ink(alpha);
      ctx.beginPath();
      ctx.arc(cx, cy, ring(dec), 0, TAU);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    // right-ascension spokes every two hours
    ctx.strokeStyle = ink(0.045);
    ctx.beginPath();
    for (let hr = 0; hr < 24; hr += 2) {
      ctx.moveTo(...at(raAngle(hr), ring(80)));
      ctx.lineTo(...at(raAngle(hr), r));
    }
    ctx.stroke();

    // the rim: a double line with degree ticks
    ctx.strokeStyle = ink(0.13);
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, TAU);
    ctx.stroke();
    ctx.strokeStyle = ink(0.06);
    ctx.beginPath();
    ctx.arc(cx, cy, r + 5, 0, TAU);
    ctx.stroke();
    for (const major of [false, true]) {
      ctx.strokeStyle = ink(major ? 0.2 : 0.09);
      ctx.beginPath();
      for (let d = 0; d < 360; d += 2) {
        if ((d % 30 === 0) !== major) continue;
        const len = d % 30 === 0 ? 10 : d % 10 === 0 ? 6 : 3;
        const ang = (d * Math.PI) / 180 + turn;
        ctx.moveTo(...at(ang, r));
        ctx.lineTo(...at(ang, r - len));
      }
      ctx.stroke();
    }

    // hour labels round the rim, declination labels along one spoke
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `10px ${MONO}`;
    ctx.fillStyle = ink(0.32);
    for (let hr = 0; hr < 24; hr += 2) ctx.fillText(`${hr}h`, ...at(raAngle(hr), r + 17));
    ctx.font = `9px ${MONO}`;
    ctx.fillStyle = ink(0.22);
    for (const dec of [80, 70, 60]) ctx.fillText(`+${dec}°`, ...at(raAngle(3), ring(dec)));
    ctx.fillText('0°', ...at(raAngle(3), ring(0)));

    for (const c of CONSTELLATIONS) {
      const pts = c.stars.map(place);
      ctx.strokeStyle = ink(0.13);
      ctx.beginPath();
      for (const [i, j] of c.lines) {
        ctx.moveTo(pts[i][0], pts[i][1]);
        ctx.lineTo(pts[j][0], pts[j][1]);
      }
      ctx.stroke();
      ctx.fillStyle = `rgb(${st.ink})`;
      c.stars.forEach(([, , mag], i) => {
        const [x, y] = pts[i];
        const bright = Math.max(0, 1 - mag / 5.5);
        ctx.globalAlpha = 0.35 + 0.6 * bright;
        ctx.beginPath();
        ctx.arc(x, y, 0.6 + 1.5 * bright, 0, TAU);
        ctx.fill();
        if (mag < 2.2) {
          ctx.globalAlpha = 0.5 * bright;
          const g = 8 + 14 * bright;
          ctx.drawImage(st.glow, x - g / 2, y - g / 2, g, g);
        }
      });
      ctx.globalAlpha = 1;
    }

    // a reticle on Polaris
    ctx.strokeStyle = ink(0.35);
    ctx.beginPath();
    for (let q = 0; q < 4; q++) {
      const ang = (q * Math.PI) / 2 + turn;
      ctx.moveTo(...at(ang, 6));
      ctx.lineTo(...at(ang, 12));
    }
    ctx.stroke();
    ctx.strokeStyle = ink(0.15);
    ctx.beginPath();
    ctx.arc(cx, cy, 16, 0, TAU);
    ctx.stroke();
    ctx.textAlign = 'left';
    ctx.font = `9px ${MONO}`;
    ctx.fillStyle = ink(0.35);
    ctx.fillText('POLARIS', cx + 21, cy - 12);

    // a fixed pointer under the rim, like an astrolabe's meridian mark; the sky turns above it
    ctx.fillStyle = `rgba(${st.rim}, 0.8)`;
    ctx.beginPath();
    ctx.moveTo(cx, cy + r + 7);
    ctx.lineTo(cx - 4, cy + r + 14);
    ctx.lineTo(cx + 4, cy + r + 14);
    ctx.closePath();
    ctx.fill();
  }

  function drawClouds(s, dt) {
    for (const c of st.clouds) {
      c.x += c.v * dt;
      if (c.x > s.w) c.x = -c.sprite.width;
      s.ctx.drawImage(c.sprite, c.x, c.y);
    }
  }

  function drawMeteors(s, now, dt) {
    const { ctx, w, h } = s;
    if (now > st.nextMeteor) {
      const dir = Math.random() < 0.5 ? -1 : 1;
      const ang = rand(0.35, 0.6);
      st.meteors.push({
        x: rand(w * 0.15, w * 0.85),
        y: rand(0, h * 0.35),
        vx: Math.cos(ang) * 900 * dir,
        vy: Math.sin(ang) * 900,
        life: 0,
        span: rand(0.7, 1.1),
      });
      st.nextMeteor = now + rand(3500, 9000);
    }
    st.meteors = st.meteors.filter((m) => m.life < m.span);
    for (const m of st.meteors) {
      m.life += dt;
      m.x += m.vx * dt;
      m.y += m.vy * dt;
      const fade = Math.sin((m.life / m.span) * Math.PI);
      const tail = 0.17;
      const tx = m.x - m.vx * tail;
      const ty = m.y - m.vy * tail;
      const g = ctx.createLinearGradient(m.x, m.y, tx, ty);
      g.addColorStop(0, `rgba(${st.ink}, ${0.95 * fade})`);
      g.addColorStop(1, `rgba(${st.ink}, 0)`);
      ctx.strokeStyle = g;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(m.x, m.y);
      ctx.lineTo(tx, ty);
      ctx.stroke();
      ctx.globalAlpha = fade;
      ctx.drawImage(st.glow, m.x - 8, m.y - 8, 16, 16);
      ctx.globalAlpha = 1;
    }
  }

  function draw(s, t, dt) {
    const { ctx, w, h, opts: o } = s;
    const moving = dt > 0;
    const now = t * 1000;
    if (o.transparent) ctx.clearRect(0, 0, w, h);
    else ctx.drawImage(st.bg, 0, 0, w, h);
    if (o.aurora) drawAurora(s, t);
    if (o.stars) drawStars(s, t);
    if (o.chart) drawChart(s, t);
    if (o.meteors && moving) drawMeteors(s, now, dt);
    if (o.clouds) drawClouds(s, dt);
    if (o.mountains) {
      if (!st.horizon) drawHorizon(s);
      ctx.drawImage(st.horizon, 0, 0, w, h);
    }
    if (o.koi) {
      for (const f of st.fish) {
        if (moving) swim(s, f, now, dt);
        drawFish(s, f, t);
      }
    }
    if (moving) {
      // the odd drop lands on the pond
      if (now > st.nextDrop) {
        ripple(rand(0, w), rand(0, h), rand(30, 60), 0.3);
        st.nextDrop = now + rand(15000, 35000);
      }
      drawRipples(s, dt);
    } else if (o.koi) drawRipples(s, 0);
  }

  const ctl = stage(canvas, {
    setup,
    retheme,
    draw,
    // a tap on the water: curious fish come over, skittish ones scatter
    pointerdown(s, x, y) {
      if (!s.still) ripple(x, y, 90, 0.9, true);
    },
    options(s, next) {
      if (!s.w) return;
      if ('pole' in next) buildStars(s);
      if ('fish' in next) buildFish(s);
      if ('meteors' in next) st.meteors = [];
    },
  }, opts);

  const stop = ctl.stop;
  ctl.stop = () => {
    stop();
    st.stopped = true;
    // hand the WebGL context back so a page of many backdrops doesn't run out
    const lose = st.gl && st.gl.g.getExtension('WEBGL_lose_context');
    if (lose) lose.loseContext();
    st.gl = null;
  };
  return ctl;
}
