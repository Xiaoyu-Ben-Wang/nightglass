// Small WAAPI helpers for exits and swaps that CSS transitions can't express; easing comes from the design tokens.
const root = document.documentElement;
export const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

const token = (name: string, fallback: string) => getComputedStyle(root).getPropertyValue(name).trim() || fallback;
const easeOut = () => token('--ease-out', 'cubic-bezier(0.23, 1, 0.32, 1)');
const ms = (name: string, fallback: number) => parseFloat(token(name, `${fallback}ms`)) || fallback;

/** True once the first paint is done, so content that renders on load doesn't animate in. */
const ready = () => document.body.classList.contains('motion-ready');

export function markReady(): void {
  requestAnimationFrame(() => requestAnimationFrame(() => document.body.classList.add('motion-ready')));
}

/** Slides an element out, then runs done (which usually removes it). */
export function leave(el: Element, done: () => void): void {
  if (!ready()) return done();
  const to = reducedMotion.matches ? { opacity: 0 } : { opacity: 0, transform: 'translateX(8px)' };
  el.animate([{ opacity: 1, transform: 'none' }, to], { duration: ms('--dur-1', 120), easing: easeOut(), fill: 'forwards' })
    .finished.then(done, done);
}

/** Fades the elements out, applies update, and brings them back in from slightly below. */
export function swap(els: HTMLElement[], update: () => void): void {
  if (!ready() || els.every((el) => !el.textContent)) return update();
  const out = els.map((el) => el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: ms('--dur-1', 120), easing: easeOut(), fill: 'forwards' }));
  void Promise.all(out.map((a) => a.finished)).then(() => {
    update();
    for (const [i, el] of els.entries()) {
      const from = reducedMotion.matches ? { opacity: 0 } : { opacity: 0, transform: 'translateY(4px)' };
      el.animate([from, { opacity: 1, transform: 'none' }], { duration: ms('--dur-2', 200), delay: i * 50, easing: easeOut(), fill: 'backwards' });
      out[i]!.cancel();
    }
  }, update);
}

/** Rolls a changed character: the old one rises out as the new one rises in. */
export function roll(slot: HTMLElement, old: string): void {
  if (!ready()) return;
  const ghost = document.createElement('span');
  ghost.className = 'digit__old';
  ghost.textContent = old;
  ghost.setAttribute('aria-hidden', 'true');
  slot.append(ghost);
  const duration = ms('--dur-3', 320), easing = easeOut();
  const move = reducedMotion.matches ? 0 : 0.32;
  ghost.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: `translateY(-${move}em)` }], { duration, easing, fill: 'forwards' })
    .finished.then(() => ghost.remove(), () => ghost.remove());
  const now = slot.querySelector<HTMLElement>('.digit__now')!;
  now.animate([{ opacity: 0, transform: `translateY(${move}em)` }, { opacity: 1, transform: 'none' }], { duration, easing });
}
