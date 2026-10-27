// An element's text drawn as a coverage mask, so the sun's rays can treat the clock's digits as solid.
export const MASK_SCALE = 0.5;

const canvas = document.createElement('canvas');
const ctx = canvas.getContext('2d')!;
let drawn = '';

/** Redraws the mask when el's text, its place or the window changed; returns the canvas only then. */
export function textMask(el: HTMLElement): HTMLCanvasElement | null {
  const box = el.getBoundingClientRect();
  const key = [innerWidth, innerHeight, box.x, box.y, box.width, box.height, el.textContent, document.fonts.status].join();
  if (key === drawn) return null;
  drawn = key;

  canvas.width = Math.ceil(innerWidth * MASK_SCALE);
  canvas.height = Math.ceil(innerHeight * MASK_SCALE);
  ctx.setTransform(MASK_SCALE, 0, 0, MASK_SCALE, 0, 0);
  ctx.fillStyle = '#fff';
  const range = document.createRange();
  const walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  for (let node = walk.nextNode(); node; node = walk.nextNode()) {
    const host = node.parentElement!;
    // Skips the outgoing digit of a minute change, which is fading away.
    if (host.closest('[aria-hidden="true"]')) continue;
    const style = getComputedStyle(host);
    ctx.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
    const text = node.textContent ?? '';
    for (let i = 0; i < text.length; i++) {
      range.setStart(node, i);
      range.setEnd(node, i + 1);
      const r = range.getBoundingClientRect();
      // A text range's box spans the font's ascent and descent, so the baseline sits one ascent below its top.
      ctx.fillText(text[i]!, r.left, r.top + ctx.measureText(text[i]!).fontBoundingBoxAscent);
    }
  }
  return canvas;
}
