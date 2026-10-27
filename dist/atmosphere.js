// The sun, clouds and god rays in WebGL2: three cloud inks in a stable-fluids simulation, lit by sunlight marched through them.
import { clamp, mixRGB } from './math.js';
import { MASK_SCALE, textMask } from './text-mask.js';
const VERT = `#version 300 es
in vec2 aPos;
uniform vec2 uTexel;
out vec2 vUv, vL, vR, vT, vB;
void main() {
  vUv = aPos * 0.5 + 0.5;
  vL = vUv - vec2(uTexel.x, 0.0);
  vR = vUv + vec2(uTexel.x, 0.0);
  vT = vUv + vec2(0.0, uTexel.y);
  vB = vUv - vec2(0.0, uTexel.y);
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;
const HEAD = `#version 300 es
precision highp float;
precision highp sampler2D;
in vec2 vUv, vL, vR, vT, vB;
out vec4 o;
`;
// Inks by channel: r = high wisps, g = mid puffs, b = low banks.
const FRAG = {
    advect: `${HEAD}
uniform sampler2D uVelocity, uSource;
uniform vec2 uTexel;
uniform float uDt, uDissipation;
void main() {
  vec2 coord = vUv - uDt * texture(uVelocity, vUv).xy * uTexel;
  o = texture(uSource, coord) / (1.0 + uDissipation * uDt);
}`,
    // Each ink also rides its own wind: high cloud moves fastest, low cloud slowest.
    advectInk: `${HEAD}
uniform sampler2D uVelocity, uSource;
uniform vec2 uTexel;
uniform float uDt, uWind;
void main() {
  vec2 back = uDt * texture(uVelocity, vUv).xy * uTexel;
  vec2 w = vec2(uDt * uWind, 0.0);
  o = vec4(
    texture(uSource, vUv - back - w * 1.7).r,
    texture(uSource, vUv - back - w).g,
    texture(uSource, vUv - back - w * 0.55).b,
    1.0);
}`,
    divergence: `${HEAD}
uniform sampler2D uVelocity;
void main() {
  float L = texture(uVelocity, vL).x, R = texture(uVelocity, vR).x;
  float T = texture(uVelocity, vT).y, B = texture(uVelocity, vB).y;
  vec2 C = texture(uVelocity, vUv).xy;
  if (vL.x < 0.0) L = -C.x;
  if (vR.x > 1.0) R = -C.x;
  if (vT.y > 1.0) T = -C.y;
  if (vB.y < 0.0) B = -C.y;
  o = vec4(0.5 * (R - L + T - B), 0.0, 0.0, 1.0);
}`,
    curl: `${HEAD}
uniform sampler2D uVelocity;
void main() {
  float L = texture(uVelocity, vL).y, R = texture(uVelocity, vR).y;
  float T = texture(uVelocity, vT).x, B = texture(uVelocity, vB).x;
  o = vec4(0.5 * (R - L - T + B), 0.0, 0.0, 1.0);
}`,
    vorticity: `${HEAD}
uniform sampler2D uVelocity, uCurl;
uniform float uCurlStrength, uDt;
void main() {
  float L = texture(uCurl, vL).x, R = texture(uCurl, vR).x;
  float T = texture(uCurl, vT).x, B = texture(uCurl, vB).x;
  float C = texture(uCurl, vUv).x;
  vec2 force = 0.5 * vec2(abs(T) - abs(B), abs(R) - abs(L));
  force /= length(force) + 0.0001;
  force *= uCurlStrength * C;
  force.y *= -1.0;
  vec2 v = texture(uVelocity, vUv).xy + force * uDt;
  o = vec4(clamp(v, -1000.0, 1000.0), 0.0, 1.0);
}`,
    pressure: `${HEAD}
uniform sampler2D uPressure, uDivergence;
void main() {
  float L = texture(uPressure, vL).x, R = texture(uPressure, vR).x;
  float T = texture(uPressure, vT).x, B = texture(uPressure, vB).x;
  o = vec4((L + R + B + T - texture(uDivergence, vUv).x) * 0.25, 0.0, 0.0, 1.0);
}`,
    gradient: `${HEAD}
uniform sampler2D uPressure, uVelocity;
void main() {
  float L = texture(uPressure, vL).x, R = texture(uPressure, vR).x;
  float T = texture(uPressure, vT).x, B = texture(uPressure, vB).x;
  o = vec4(texture(uVelocity, vUv).xy - vec2(R - L, T - B), 0.0, 1.0);
}`,
    scale: `${HEAD}
uniform sampler2D uSource;
uniform float uValue;
void main() { o = uValue * texture(uSource, vUv); }`,
    splat: `${HEAD}
uniform sampler2D uSource;
uniform vec2 uPoint;
uniform vec3 uColor;
uniform float uAspect, uRadius;
void main() {
  vec2 p = vUv - uPoint;
  p.x *= uAspect;
  o = vec4(texture(uSource, vUv).xyz + exp(-dot(p, p) / uRadius) * uColor, 1.0);
}`,
    // Pulls each ink toward its resting clouds.
    relax: `${HEAD}
uniform sampler2D uSource;
uniform vec3 uShift;
uniform float uAspect, uCover, uRate, uSeed;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7)) + uSeed) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}
float fbm(vec2 p) {
  float s = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) { s += a * noise(p); p = p * 2.03 + 17.0; a *= 0.5; }
  return s;
}
float field(vec2 p) { return fbm(p + 0.35 * vec2(fbm(p + 3.1), fbm(p + 7.7))); }
void main() {
  float x = vUv.x * uAspect;
  // High: thin streaks stretched by the wind, across the top of the sky.
  vec2 ph = vec2((x - uShift.x * uAspect) * 1.1, vUv.y * 7.0) + 40.0;
  float high = smoothstep(mix(0.7, 0.5, uCover), 0.78, field(ph)) * smoothstep(0.45, 0.9, vUv.y) * 0.8;
  // Mid: puffy cumulus, denser toward the top.
  vec2 pm = vec2((x - uShift.y * uAspect) * 2.0, vUv.y * 3.6);
  float cutM = mix(0.72, 0.4, uCover);
  float mid = smoothstep(cutM, cutM + 0.3, field(pm) * mix(0.55, 1.15, smoothstep(0.15, 0.95, vUv.y)));
  // Low: broad, darker banks lower down, only once the sky clouds over.
  vec2 pl = vec2((x - uShift.z * uAspect) * 1.2, vUv.y * 2.2) + 90.0;
  float cutL = mix(0.95, 0.42, uCover);
  float low = smoothstep(cutL, cutL + 0.25, field(pl)) * smoothstep(0.05, 0.4, vUv.y) * (1.0 - smoothstep(0.75, 1.0, vUv.y) * 0.6);
  vec3 d = texture(uSource, vUv).rgb;
  o = vec4(d + (vec3(high, mid, low) - d) * uRate, 1.0);
}`,
    // Sunlight reaching each point of each ink: march toward the sun (or straight up when it is down) and
    // accumulate optical depth per layer. Runs at low resolution; clouds are soft.
    light: `${HEAD}
uniform sampler2D uSource;
uniform vec2 uSun, uRes;
uniform float uSunVis, uCloudOn;
void main() {
  vec2 toSun = (uSun - vUv) * uRes;
  // Toward the sun by day, blending to straight up as it sets, so the shading never jumps.
  float toward = smoothstep(0.0, 0.05, uSunVis);
  vec2 dir = toSun / max(length(toSun), 0.001) * toward + vec2(0.0, 1.0) * (1.0 - toward);
  dir /= max(length(dir), 0.001);
  // About a cloud's thickness (~100px at 1080p): each cloud shades itself, not its neighbors.
  float unit = min(uRes.x, uRes.y) * 0.008;
  vec3 tau = vec3(0.0);
  float s = unit * 0.5;
  for (int i = 0; i < 8; i++) {
    vec2 uv = vUv + dir * s / uRes;
    float inside = step(0.0, uv.x) * step(uv.x, 1.0) * step(0.0, uv.y) * step(uv.y, 1.0);
    float w = unit * (1.0 + float(i) * 0.15);
    tau += texture(uSource, uv).rgb * inside * w;
    s += w;
  }
  o = vec4(exp(-tau * uCloudOn / unit * vec3(0.06, 0.22, 0.25)), 1.0);
}`,
    // Shadow cast by every cloud, and the clock's digits, between a pixel and the sun: beams of light are the lit
    // gaps between shadows.
    rays: `${HEAD}
uniform sampler2D uSource, uMask;
uniform vec2 uSun, uRes;
uniform float uCloudOn, uMaskScale;
float ign(vec2 p) { return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715)))); }
void main() {
  vec2 toSun = (uSun - vUv) * uRes;
  float r = length(toSun);
  const int N = 44;
  float ds = min(r, 1.3 * max(uRes.x, uRes.y)) / float(N);
  vec2 stepUv = toSun / max(r, 0.001) * ds / uRes;
  // Jittered start, so the coarse march blurs instead of banding.
  vec2 uv = vUv + stepUv * ign(gl_FragCoord.xy);
  // The digits are read at the mip level one step wide, so strokes thinner than a step still block their share.
  float lod = log2(max(ds * uMaskScale, 1.0));
  float span = max(uRes.x, uRes.y);
  float tau = 0.0, solid = 0.0;
  for (int i = 0; i < N; i++) {
    float inside = step(0.0, uv.x) * step(uv.x, 1.0) * step(0.0, uv.y) * step(uv.y, 1.0);
    // Puffs and banks cast the shadows, sharpened into crisp-edged occluders as real cumulus are; thin high
    // cloud barely shades.
    vec3 d = texture(uSource, uv).rgb;
    tau += (0.05 * d.r + smoothstep(0.28, 0.62, d.g) + smoothstep(0.3, 0.65, d.b)) * inside;
    // Digits shade only near the sun: when it is behind them, not when it is across the sky.
    float near = exp(-length((uv - uSun) * uRes) / (0.07 * span));
    solid += textureLod(uMask, uv, lod).a * near * inside;
    uv += stepUv;
  }
  // Cloud depth per step is scaled to the screen, so shadows look the same in any window size. About 6px of
  // stroke blocks the most the digits can, half the light, which keeps their beams gentle.
  float cloudT = exp(-tau * uCloudOn * ds / (min(uRes.x, uRes.y) * 0.039));
  o = vec4(cloudT * (1.0 - 0.5 * (1.0 - exp(-solid * ds / 6.0))), 0.0, 0.0, 1.0);
}`,
    // Beams, worked out at low resolution from the shadow field: a beam is a lit path running beside shadowed
    // ones; with no shadow nearby there is nothing to see.
    beams: `${HEAD}
uniform sampler2D uRays;
uniform vec2 uSun, uRes;
// 1 on screen, fading to 0 just past the edge; a hard cut would leave stair steps along the edges.
float onScreen(vec2 uv) {
  vec2 out2 = max(-uv, uv - 1.0);
  return clamp(1.0 - max(out2.x, out2.y) * 12.0, 0.0, 1.0);
}
// Shadow transmittance at the same distance from the sun turned by a radians, and how far that is on screen.
vec2 turned(vec2 rel, float a) {
  vec2 p = rel * uRes;
  vec2 uv = uSun + vec2(cos(a) * p.x - sin(a) * p.y, sin(a) * p.x + cos(a) * p.y) / uRes;
  return vec2(texture(uRays, uv).r, onScreen(uv));
}
float along(vec2 uv, float fallback) {
  return mix(fallback, texture(uRays, uv).r, onScreen(uv));
}
void main() {
  vec2 rel = vUv - uSun;
  // Blurred along the ray, which hides the march's jitter without softening the beams' edges.
  float t0 = texture(uRays, vUv).r;
  float T = (t0 + along(uSun + rel * 0.975, t0) + along(uSun + rel * 1.025, t0)) / 3.0;
  // Off-screen neighbors carry no shadow information: they count as neither lit nor shadowed.
  float lo = 1.0, hi = 0.0;
  for (int i = 0; i < 6; i++) {
    float ang = (i < 2 ? 0.05 : i < 4 ? 0.14 : 0.3) * (i % 2 == 0 ? 1.0 : -1.0);
    vec2 n = turned(rel, ang);
    lo = min(lo, mix(1.0, n.x, n.y));
    hi = max(hi, n.x * n.y);
  }
  float reach = exp(-length(rel * uRes) / (0.6 * max(uRes.x, uRes.y)));
  o = vec4(T * (1.0 - lo) * reach, (1.0 - T) * hi * reach, 0.0, 1.0);
}`,
    display: `${HEAD}
uniform sampler2D uSource, uBeams, uLight;
uniform vec2 uSun, uRes;
uniform vec3 uLit, uShade, uLow, uSunCol;
uniform float uOpacity, uCloudOn, uSunR, uSunVis, uRayStrength, uGolden;
const vec3 K = vec3(1.2, 3.0, 3.2); // extinction per unit of ink: high, mid, low
vec4 over(vec4 top, vec4 under) { return top + under * (1.0 - top.a); }
// One ink: opacity from its optical depth, lit by the sky plus whatever sunlight reaches it. Thin ink near
// the sun scatters light forward toward the viewer: the silver lining.
vec4 ink(float d, float k, float sunlit, vec3 ambient, vec3 lit, float forward, float opacity) {
  float tau = d * k;
  // Golden hour: sunlit undersides glow and the shade turns rosy.
  float warm = uGolden * uSunVis;
  ambient *= mix(vec3(1.0), vec3(1.16, 0.84, 0.88), warm);
  lit *= 1.0 + 1.1 * warm;
  opacity *= 1.0 + 0.3 * warm;
  float a = (1.0 - exp(-tau)) * opacity;
  float thin = exp(-tau * 0.9);
  vec3 col = ambient + lit * sunlit + uSunCol * forward * thin * sunlit;
  return vec4(min(col, vec3(1.0)) * a, a);
}
void main() {
  vec3 d = texture(uSource, vUv).rgb * uCloudOn;
  vec3 sunlit = texture(uLight, vUv).rgb;
  vec2 rel = vUv - uSun;
  float r = length(rel * uRes);
  float forward = uSunVis * (1.6 * exp(-r / (uSunR * 3.5)) + 0.35 * exp(-r / (uSunR * 12.0)));
  // Sunlight tints the lit side, fully near sunrise and sunset; at night it is plain sky light from above.
  vec3 tint = mix(vec3(1.0), uSunCol * 1.08, uSunVis * mix(0.7, 1.0, uGolden));
  forward += uSunVis * uGolden * 0.35;
  vec4 high = ink(d.r, K.r, sunlit.r, uShade * 1.05, (uLit - uShade) * tint, forward * 1.3, uOpacity * 0.7);
  vec4 mid = ink(d.g, K.g, sunlit.g, uShade, (uLit - uShade) * tint, forward, uOpacity);
  vec4 low = ink(d.b, K.b, sunlit.b, uShade * 0.85, (uLow - uShade * 0.85) * tint, forward * 0.8, uOpacity * 0.9);
  // Seen from the ground, low cloud is nearest.
  vec4 cloud = over(low, over(mid, high));

  // The sun dims by the optical depth in front of it: thin high cloud only veils it, puffs and banks hide it.
  float tauV = dot(d, vec3(0.35, K.g, K.b));
  float seen = exp(-tauV * 1.3);
  float disc = (1.0 - smoothstep(uSunR * 0.7, uSunR, r)) * (0.55 + 0.15 * sqrt(max(0.0, 1.0 - r * r / (uSunR * uSunR))));
  float halo = exp(-r / (uSunR * 1.6)) * 0.28 + exp(-r / (uSunR * 5.0)) * 0.13 + exp(-r / (uSunR * 16.0)) * 0.07;
  // Light diffused by the cloud in front: a tight corona through thin cloud, a broad soft patch through a deck.
  float corona = exp(-r / (uSunR * (2.6 + tauV * 1.4))) * (1.0 - seen) * exp(-tauV * 0.18) * 0.42;
  // Through cloud the disc stays as a pale shape, fading only slowly with thickness.
  float discSeen = max(seen, 0.3 * exp(-tauV * 0.35));
  vec3 sun = uSunCol * (disc * discSeen + halo * exp(-tauV * 0.6) + corona) * uSunVis;
  // Cloud in front of the sun glows a little from the light behind it.
  vec3 backlit = uSunCol * exp(-r / (uSunR * 2.4)) * 0.35 * cloud.a * exp(-tauV * 0.25) * uSunVis;

  // Beams brighten the lit paths; shadowed air beside them dims slightly, so shafts read by contrast.
  vec2 bs = texture(uBeams, vUv).rg * uRayStrength * uSunVis;
  vec3 rays = uSunCol * 0.7 * bs.r;

  // Light is screened over the sky: alpha at least the brightest channel keeps the output validly premultiplied.
  vec3 rgb = min(cloud.rgb + backlit + sun + rays, vec3(1.0));
  float a = max(cloud.a, max(rgb.r, max(rgb.g, rgb.b)));
  o = vec4(rgb, a + 0.24 * bs.g * (1.0 - a));
}`,
};
const SIM = 128;
const DYE = 512;
const RAYS = 200;
const LIGHT = 256;
let gl = null;
let canvas;
let programs;
let velocity, dye, pressure, divergence, curl, rays, beams, light;
let mask;
let shadowCaster;
let fresh = true;
let shift = 0;
let nextGust = 0;
// ?seed=<number> repeats a cloud layout during development.
const seed = +(new URLSearchParams(location.search).get('seed') ?? Math.random() * 100);
let strokes = [];
let px = -1;
let py = -1;
function compile(type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS))
        throw new Error(gl.getShaderInfoLog(s) ?? 'shader');
    return s;
}
function program(frag) {
    const prog = gl.createProgram();
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, frag));
    gl.bindAttribLocation(prog, 0, 'aPos');
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS))
        throw new Error(gl.getProgramInfoLog(prog) ?? 'program');
    return { prog, uni: new Map() };
}
function target(w, h) {
    const g = gl;
    const tex = g.createTexture();
    g.bindTexture(g.TEXTURE_2D, tex);
    g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MIN_FILTER, g.LINEAR);
    g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MAG_FILTER, g.LINEAR);
    g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_S, g.CLAMP_TO_EDGE);
    g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_T, g.CLAMP_TO_EDGE);
    g.texImage2D(g.TEXTURE_2D, 0, g.RGBA16F, w, h, 0, g.RGBA, g.HALF_FLOAT, null);
    const fbo = g.createFramebuffer();
    g.bindFramebuffer(g.FRAMEBUFFER, fbo);
    g.framebufferTexture2D(g.FRAMEBUFFER, g.COLOR_ATTACHMENT0, g.TEXTURE_2D, tex, 0);
    g.viewport(0, 0, w, h);
    g.clearColor(0, 0, 0, 1);
    g.clear(g.COLOR_BUFFER_BIT);
    return { tex, fbo, w, h };
}
function double(w, h) {
    const d = { read: target(w, h), write: target(w, h), swap() { [d.read, d.write] = [d.write, d.read]; } };
    return d;
}
function free(t) {
    gl.deleteTexture(t.tex);
    gl.deleteFramebuffer(t.fbo);
}
function size(base) {
    const aspect = innerWidth / innerHeight;
    return aspect > 1 ? [Math.round(base * aspect), base] : [base, Math.round(base / aspect)];
}
function allocate() {
    if (velocity)
        [velocity.read, velocity.write, dye.read, dye.write, pressure.read, pressure.write, divergence, curl, rays, beams, light].forEach(free);
    const [sw, sh] = size(SIM), [dw, dh] = size(DYE), [rw, rh] = size(RAYS);
    velocity = double(sw, sh);
    pressure = double(sw, sh);
    divergence = target(sw, sh);
    curl = target(sw, sh);
    dye = double(dw, dh);
    rays = target(rw, rh);
    beams = target(rw, rh);
    light = target(...size(LIGHT));
    fresh = true;
}
/** Runs one pass of a program into out (null draws to the screen); Targets bind as textures. */
function pass(name, out, uniforms) {
    const g = gl;
    const p = programs[name];
    g.useProgram(p.prog);
    const loc = (k) => {
        if (!p.uni.has(k))
            p.uni.set(k, g.getUniformLocation(p.prog, k));
        return p.uni.get(k);
    };
    const texel = out ? [1 / out.w, 1 / out.h] : [1 / dye.read.w, 1 / dye.read.h];
    g.uniform2f(loc('uTexel'), texel[0], texel[1]);
    let unit = 0;
    for (const [k, v] of Object.entries(uniforms)) {
        if (typeof v === 'number')
            g.uniform1f(loc(k), v);
        else if (Array.isArray(v))
            (v.length === 2 ? g.uniform2f(loc(k), v[0], v[1]) : g.uniform3f(loc(k), v[0], v[1], v[2]));
        else {
            g.activeTexture(g.TEXTURE0 + unit);
            g.bindTexture(g.TEXTURE_2D, v.tex);
            g.uniform1i(loc(k), unit++);
        }
    }
    g.bindFramebuffer(g.FRAMEBUFFER, out ? out.fbo : null);
    g.viewport(0, 0, out ? out.w : canvas.width, out ? out.h : canvas.height);
    g.drawArrays(g.TRIANGLE_STRIP, 0, 4);
}
function uploadMask(source) {
    const g = gl;
    g.bindTexture(g.TEXTURE_2D, mask.tex);
    g.pixelStorei(g.UNPACK_FLIP_Y_WEBGL, true);
    g.texImage2D(g.TEXTURE_2D, 0, g.RGBA, g.RGBA, g.UNSIGNED_BYTE, source);
    g.pixelStorei(g.UNPACK_FLIP_Y_WEBGL, false);
    g.generateMipmap(g.TEXTURE_2D);
}
function splat(x, y, dx, dy, radius) {
    const aspect = canvas.width / canvas.height;
    pass('splat', velocity.write, { uSource: velocity.read, uPoint: [x, y], uColor: [dx, dy, 0], uAspect: aspect, uRadius: radius });
    velocity.swap();
}
function step(dt, wind) {
    // Cursor strokes push the water only close to the pointer's path.
    for (const [x0, y0, x1, y1] of strokes) {
        const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 0.008));
        for (let i = 1; i <= n; i++)
            splat(x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * i / n, (x1 - x0) / n * 4500, (y1 - y0) / n * 4500, 0.0008);
    }
    strokes = [];
    // An occasional gentle gust keeps the clouds billowing.
    nextGust -= dt;
    if (nextGust <= 0) {
        nextGust = 0.6 + Math.random() * 1.5;
        const a = Math.random() * Math.PI * 2;
        splat(Math.random(), 0.35 + Math.random() * 0.65, Math.cos(a) * 8, Math.sin(a) * 5, 0.004);
    }
    pass('curl', curl, { uVelocity: velocity.read });
    pass('vorticity', velocity.write, { uVelocity: velocity.read, uCurl: curl, uCurlStrength: 6, uDt: dt });
    velocity.swap();
    pass('divergence', divergence, { uVelocity: velocity.read });
    pass('scale', pressure.write, { uSource: pressure.read, uValue: 0.8 });
    pressure.swap();
    for (let i = 0; i < 20; i++) {
        pass('pressure', pressure.write, { uPressure: pressure.read, uDivergence: divergence });
        pressure.swap();
    }
    pass('gradient', velocity.write, { uPressure: pressure.read, uVelocity: velocity.read });
    velocity.swap();
    const simTexel = [1 / velocity.read.w, 1 / velocity.read.h];
    pass('advect', velocity.write, { uVelocity: velocity.read, uSource: velocity.read, uDt: dt, uDissipation: 0.4 });
    velocity.swap();
    // Ink moves through velocity-grid texels, so pass that texel size explicitly.
    pass('advectInk', dye.write, { uTexel: simTexel, uVelocity: velocity.read, uSource: dye.read, uDt: dt, uWind: wind });
    dye.swap();
}
function relax(rate, cover) {
    const aspect = canvas.width / canvas.height;
    pass('relax', dye.write, { uSource: dye.read, uShift: [shift * 1.7, shift, shift * 0.55], uAspect: aspect, uCover: cover, uRate: rate, uSeed: seed });
    dye.swap();
}
// Below this the sun is treated as gone and its passes are skipped.
const SUN_VISIBLE = 0.001;
export function renderAtmosphere(dt, p) {
    if (!gl)
        return;
    const cloudy = p.cover >= 0.005;
    const sunVis = clamp((p.sun.elev + 1.5) / 3) * p.sun.vis * p.day;
    if (!cloudy)
        fresh = true;
    if (!cloudy && sunVis <= SUN_VISIBLE) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.viewport(0, 0, canvas.width, canvas.height);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        return;
    }
    if (cloudy) {
        shift += p.wind * dt;
        if (p.still || fresh) {
            relax(1, p.cover);
            fresh = false;
        }
        if (!p.still && dt > 0) {
            step(dt, p.wind);
            // Stirred clouds settle back over roughly ten seconds.
            relax(1 - Math.exp(-dt * 0.12), p.cover);
        }
    }
    const res = [canvas.width, canvas.height];
    const sun = [p.sun.x, 1 - p.sun.y];
    const sunR = Math.max(22, Math.min(canvas.width, canvas.height) * 0.04);
    // White at height, orange-red at the horizon.
    const sunCol = mixRGB([1, 0.52, 0.3], [1, 0.92, 0.78], clamp((p.sun.elev + 1) / 12));
    const cloudOn = cloudy ? 1 : 0;
    if (cloudy)
        pass('light', light, { uSource: dye.read, uSun: sun, uRes: res, uSunVis: sunVis, uCloudOn: cloudOn });
    if (sunVis > SUN_VISIBLE) {
        const text = shadowCaster && textMask(shadowCaster);
        if (text)
            uploadMask(text);
        pass('rays', rays, { uSource: dye.read, uMask: mask, uMaskScale: MASK_SCALE, uSun: sun, uRes: res, uCloudOn: cloudOn });
        pass('beams', beams, { uRays: rays, uSun: sun, uRes: res });
    }
    const lit = mixRGB(mixRGB([0.36, 0.39, 0.45], [0.95, 0.96, 0.98], p.day), [0.62, 0.65, 0.7], p.dark * 0.6);
    const shade = mixRGB(mixRGB([0.16, 0.18, 0.22], [0.58, 0.62, 0.69], p.day), [0.3, 0.32, 0.37], p.dark * 0.7);
    const low = mixRGB(mixRGB([0.2, 0.22, 0.27], [0.7, 0.74, 0.8], p.day), [0.34, 0.36, 0.41], p.dark * 0.7);
    pass('display', null, {
        uSource: dye.read, uBeams: beams, uLight: light, uSun: sun, uRes: res, uSunR: sunR, uSunCol: sunCol, uSunVis: sunVis,
        uRayStrength: sunVis > SUN_VISIBLE ? 1 : 0, uCloudOn: cloudOn,
        uGolden: sunVis > SUN_VISIBLE ? 1 - clamp(p.sun.elev / 12) : 0,
        uLit: lit, uShade: shade, uLow: low, uOpacity: (0.38 + 0.18 * p.cover) * (0.75 + 0.25 * p.day),
    });
}
/** shadow is an element whose text blocks the sun like cloud. */
export function initAtmosphere(el, shadow) {
    canvas = el;
    shadowCaster = shadow;
    gl = canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: true, antialias: false, depth: false });
    if (!gl || !gl.getExtension('EXT_color_buffer_float')) {
        gl = null;
        return;
    }
    try {
        programs = Object.fromEntries(Object.entries(FRAG).map(([k, src]) => [k, program(src)]));
    }
    catch (err) {
        console.warn('Sun and clouds disabled:', err);
        gl = null;
        return;
    }
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    mask = { tex: gl.createTexture() };
    gl.bindTexture(gl.TEXTURE_2D, mask.tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    // Empty until the text is first drawn.
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4));
    resizeAtmosphere();
    addEventListener('pointermove', (e) => {
        const x = e.clientX / innerWidth, y = 1 - e.clientY / innerHeight;
        if (px >= 0)
            strokes.push([px, py, x, y]);
        px = x;
        py = y;
    }, { passive: true });
    document.documentElement.addEventListener('pointerleave', () => { px = py = -1; });
}
export function resizeAtmosphere() {
    if (!gl)
        return;
    // Soft light and clouds don't need device pixels.
    canvas.width = innerWidth;
    canvas.height = innerHeight;
    allocate();
}
