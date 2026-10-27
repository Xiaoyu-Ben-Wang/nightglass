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

To load a copy that doesn't change while you work in the repo, export it:

```bash
pnpm run export
```

This builds and writes `~/DevApps/Nightglass/Nightglass Theme` and `~/DevApps/Nightglass/Nightglass New Tab`, replacing what was there. Set `EXPORT_DIR` to write somewhere else. Load those two folders unpacked, and run the export again after changes.

## New tab page

- First run asks for your name. Double-click your name in the greeting to change it.
- Settings (bottom left) has your name and clock format, which widgets show, and grouped switches for the weather, the sun and moon, and the stars. The quote source is folded away at the bottom.
- The sky shows stars and the star chart by default; meteors are off. The backdrop's aurora, mountains, stratus clouds and koi pond stay off.
- The sky shows the current weather: clouds, fog, rain slanted by the wind, snow, bouncing hail, and lightning in thunderstorms. Clouds hide the moon. Turn it off in Settings → Weather → Effects.
- The clouds are three inks in a fluid simulation (WebGL2): high wisps, mid puffs and low banks, each drifting at its own speed. Moving the cursor stirs them like ink in water, and they settle back over about ten seconds.
- The sun is drawn on its real path: it rises on the east side, peaks near the top at solar noon and sets off the bottom. Sunlight is marched through the clouds on the GPU: each cloud is lit on its sun-facing side, thin cloud near the sun glows at its edges, the sun dims by the cloud in front of it (a corona through thin cloud, a soft bright patch through overcast), and clouds cast shadows across the sky whose lit gaps are the god rays. Near sunrise and sunset the clouds take on the sun's warm colour. The whole sky costs under a millisecond per frame.
- The temperature is colored by how warm it is: icy blue below freezing, cyan when cool, gold when mild to warm, and red in extreme heat.
- The sky follows the sun: night, twilight, a warm sunrise or sunset rising from the horizon, golden hour, and a muted day blue, with stars fading as the sun rises (see `docs/day-night-cycle.png`). It uses the weather location, or guesses from your time zone. Turn it off in Settings → Sun & moon → Follow the sun.
- The moon shows its real phase and fades in after sunset. Turn it off in Settings → Sun & moon → Moon.
- The chart turns about Polaris once every 4 minutes. Settings → Stars → Spin sets it to off, slow (15 min), medium or fast (1 min).
- Search sits behind the magnifier icon (top left); click it or press `/` to open it, Escape to close. It uses the browser's default search engine. Links are behind the three-line icon.
- Weather comes from [Open-Meteo](https://open-meteo.com), which needs no key or account. Its location is detected through the browser (re-checked every 6 hours) and named with BigDataCloud's free reverse geocoding. A city typed into Settings overrides it until you press Use my location.
- The clock, date and daily rollovers use the time zone of that location, which wins over the browser's because some operating-system zones map to a fixed offset.
- The daily quote comes from the [Quotable](https://github.com/lukepeavey/quotable) API and is cached for the day. If the API fails, it comes from `newtab/data/quotes.json`: 1,581 quotes by 820 authors, at most 12 per author, merged from [dwyl/quotes](https://github.com/dwyl/quotes) (GPL-2.0), [inspirational-quotes](https://github.com/vinitshahdeo/inspirational-quotes) (MIT) and [DummyJSON](https://github.com/Ovi/DummyJSON) (MIT). Licenses are in `newtab/data/licenses/`. Because of the GPL-2.0 source, publishing this repo means the quote file is shared under GPL-2.0. Quotable's public server has been down since its certificate expired in September 2024, so the bundled list is what shows until it returns. Settings → Quote source takes any Quotable-compatible URL, such as a self-hosted Quotable; leave it empty to use only the list. Click the quote to search for it and its author in a new tab.
- Settings and links sync through `chrome.storage.sync`. To-dos and the daily focus stay on this device.

Develop without reloading the extension: serve the repo root (`python -m http.server`) and open `/newtab/newtab.html`. The page falls back to `localStorage` outside the extension. Add `?sun=<degrees>` to pin the sun's elevation, e.g. `?sun=-6` for twilight. Add `?weather=<code>` to pin the weather to a [WMO code](https://open-meteo.com/en/docs#weather_variable_documentation), e.g. `?weather=0` clear, `2` partly cloudy, `45` fog, `63` rain, `75` snow, `99` thunderstorm with hail. `?sunx=<0..1>` places a pinned sun across the screen, and `?seed=<number>` repeats a cloud layout.

## Theme frame image

`theme/images/theme_frame.png` and `theme_frame@2x.png` are rendered from the same sky backdrop, plus the tape and crosses drawn in `tools/frame.html`. The manifest maps them with numeric scale keys (`"100"`, `"200"`); the 2x image keeps the strip sharp on scaled displays.

```bash
pnpm run frame
```

`tools/frame.html` takes query options (`px`, `py` for the compass position, `top` for where decoration starts, `shade` for dimming). Pass them through, e.g. `node tools/render-frame.ts "px=1400&shade=0.45"`. Set `CHROME` if Chrome isn't in a standard location.

The browser draws the image about 16px above the tab strip, which is why decoration starts at `top=16`. After changing images, bump the theme's `version` and delete `theme/Cached Theme.pak`. The browser otherwise keeps showing the old images.

## Vendored design files

Colors come from `newtab/onedark.css`, a One Dark layer over the vendored Nightglass styles. `newtab/vendor/` holds copies from the `theme-design-systems` repo: `tokens/base.css`, `components/components.css`, `themes/nightglass.css`, `backdrops/_core.js`, `backdrops/sky.js`. Copy them again to pick up changes there. One local change: `sky.js` accumulates its rotation angle so the spin speed can change without the chart jumping. Keep it when re-copying. `sky.d.ts` types the backdrop for TypeScript.
