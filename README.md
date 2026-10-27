# Browser customization

Nightglass for Brave and Chrome in One Dark colors: a browser theme and a new tab page.

| Folder | What it is |
| --- | --- |
| `theme/` | Browser theme: One Dark slate, with faint stars, an hour tape, registration crosses and a small polar compass in the tab strip |
| `newtab/` | New tab page in the style of Momentum: clock, greeting, daily focus, to-dos, links, weather, a quote and search, over a live star chart |

They are two extensions because Chrome and Brave only allow colors and static images in a theme. A theme can't run code, animate, or replace the new tab page, and no extension API can set the browser's theme. Tab shape is fixed by the browser.

## Install

```bash
pnpm install
pnpm run build
```

Then open `brave://extensions` (or `chrome://extensions`), turn on Developer mode, choose **Load unpacked**, and select `theme/`, then `newtab/`. Rebuild after changing `newtab/src/`, then click the reload icon on the extension's card.

## New tab page

- First run asks for your name. Double-click your name in the greeting to change it.
- Settings (bottom left) has your weather location, 12/24-hour clock, °C/°F, and switches for each widget and each layer of the sky.
- The sky shows only stars and the star chart by default. Aurora, meteors, clouds, mountains and the koi pond are off.
- `/` focuses the search box. Search uses the browser's default search engine.
- Weather comes from [Open-Meteo](https://open-meteo.com), which needs no key or account.
- Settings and links sync through `chrome.storage.sync`. To-dos and the daily focus stay on this device.

Develop without reloading the extension: serve the repo root (`python -m http.server`) and open `/newtab/newtab.html`. The page falls back to `localStorage` outside the extension.

## Theme frame image

`theme/images/theme_frame.png` and `theme_frame@2x.png` are rendered from the same sky backdrop, plus the tape and crosses drawn in `tools/frame.html`. The manifest maps them with numeric scale keys (`"100"`, `"200"`); the 2x image keeps the strip sharp on scaled displays.

```bash
pnpm run frame
```

`tools/frame.html` takes query options (`px`, `py` for the compass position, `top` for where decoration starts, `shade` for dimming). Pass them through, e.g. `node tools/render-frame.ts "px=1400&shade=0.45"`. Set `CHROME` if Chrome isn't in a standard location.

The browser draws the image about 16px above the tab strip, which is why decoration starts at `top=16`. After changing images, bump the theme's `version` and delete `theme/Cached Theme.pak`. The browser otherwise keeps showing the old images.

## Vendored design files

Colors come from `newtab/onedark.css`, a One Dark layer over the vendored Nightglass styles. `newtab/vendor/` holds copies from the `theme-design-systems` repo: `tokens/base.css`, `components/components.css`, `themes/nightglass.css`, `backdrops/_core.js`, `backdrops/sky.js`. Copy them again to pick up changes there. `sky.d.ts` types the backdrop for TypeScript.
