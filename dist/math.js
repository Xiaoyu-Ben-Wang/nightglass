// Numeric and color helpers shared by the sky modules.
export const DAY_MS = 86_400_000;
export const clamp = (v, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const mixRGB = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
/** c moved toward the grey of the same luminance by t. */
export const grey = (c, t) => {
    const y = 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
    return mixRGB(c, [y, y, y], t);
};
export const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
export const rgb = (c) => `rgb(${c.map(Math.round).join(', ')})`;
export const rgba = (c, a) => `rgba(${c.map(Math.round).join(', ')}, ${a})`;
/** The stops on either side of x in a list sorted by `at`, and how far x lies between them; held at the ends. */
export function between(stops, x) {
    const i = stops.findIndex((s) => s.at > x);
    if (i === 0)
        return [stops[0], stops[0], 0];
    if (i < 0)
        return [stops.at(-1), stops.at(-1), 0];
    const a = stops[i - 1], b = stops[i];
    return [a, b, (x - a.at) / (b.at - a.at)];
}
