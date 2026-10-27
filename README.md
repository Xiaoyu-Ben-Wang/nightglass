# Nightglass

A browser theme and a new tab page for Chrome and Brave in One Dark colors. The new tab shows a clock, daily focus, to-dos, links, weather and a quote over a live sky: real star chart, the sun and moon on their actual paths, and weather drawn from current conditions.

![New tab on a partly cloudy afternoon](docs/screenshots/day.png)

| | |
| --- | --- |
| ![Sunset](docs/screenshots/sunset.png) | ![Rain](docs/screenshots/rain.png) |
| ![Night](docs/screenshots/night.png) | ![Settings](docs/screenshots/settings.png) |

## Contents

| Folder | What it is |
| --- | --- |
| `theme/` | Browser theme: One Dark slate, with faint stars, an hour tape, registration crosses and a small polar compass in the tab strip |
| `newtab/` | New tab page extension |
| `tools/` | Build helpers: export, README screenshots, theme frame rendering |
| `docs/` | Screenshots and the day/night cycle sheet |

They are two extensions because a browser theme can only set colors and static images. It can't run code, animate, or replace the new tab page, and no extension API can set the browser's theme.

## Install

```bash
pnpm install
pnpm run build
```

Open `chrome://extensions` (or `brave://extensions`), turn on Developer mode, choose **Load unpacked**, and select `theme/`, then `newtab/`. After changing `newtab/src/`, rebuild and click the reload icon on the extension's card.

To load a copy that doesn't change while you work in the repo:

```bash
pnpm run export
```

This builds and writes `~/DevApps/Nightglass/Nightglass Theme` and `~/DevApps/Nightglass/Nightglass New Tab`, replacing what was there. Set `EXPORT_DIR` to write elsewhere.

## The new tab

### Sky

- **Stars:** a polar star chart of the real constellations, turning about Polaris. Settings → Stars sets the spin: off, slow (15 min), medium (4 min) or fast (1 min).
- **Daylight:** the sky follows the sun's elevation through night, twilight, a warm sunrise or sunset rising from the horizon, golden hour and a muted day blue, with the stars fading at dawn (see `docs/day-night-cycle.png`).
- **Sun:** drawn on its real path. It rises on the east side, peaks near the top at solar noon and sets off the bottom.
- **Moon:** shown at its real phase, fading in after sunset.

### Weather

Conditions come from [Open-Meteo](https://open-meteo.com) and are drawn over the sky:

- clouds and fog
- rain slanted by the wind
- snow
- bouncing hail
- lightning in thunderstorms

The temperature is colored by how warm it is: icy blue below freezing, cyan when cool, gold when mild to warm, red in extreme heat.

### Sun and clouds

The clouds are three inks in a stable-fluids simulation on the GPU: high wisps, mid puffs and low banks, each drifting at its own speed. Moving the cursor stirs them like ink in water, and they settle back over about ten seconds.

Sunlight is marched through the clouds:

- **Shading:** each cloud is lit on its sun-facing side.
- **Silver linings:** thin cloud near the sun glows at its edges.
- **The sun behind cloud:** it dims by the cloud in front of it, as a corona through thin cloud or a soft bright patch through overcast.
- **God rays:** clouds cast shadows across the sky, and the lit gaps between those shadows are the rays.

Near sunrise and sunset the clouds take on the sun's warm color. The whole sky renders in about a millisecond per frame.

### Widgets

- **Greeting:** the first run asks for your name. Double-click it in the greeting to change it.
- **Clock and date:** they use the weather location's time zone, which wins over the browser's because some operating-system zones map to a fixed offset.
- **Focus and to-dos:** one daily focus that clears at midnight, and a to-do list. Both stay on this device.
- **Links:** saved links behind the three-line icon, synced across devices.
- **Search:** behind the magnifier icon. Click it or press `/` to open, Escape to close. It uses the browser's default search engine.
- **Quote:** one quote a day. Click it to search for the quote and its author.

### Settings

Settings (bottom left) has sections for:

| Section | Options |
| --- | --- |
| General | Name, 24-hour clock |
| Show | Which widgets appear |
| Weather | Location, effects, °C/°F |
| Sun & moon | Daylight, moon |
| Stars | Chart, meteors, spin |
| Quote | Quote source |

Settings sync through `chrome.storage.sync`.

## How it works

The page stacks four layers:

1. the star chart (`vendor/backdrops/sky.js`, a 2D canvas)
2. the sunrise and sunset wash (CSS)
3. precipitation and lightning (`scene.ts`, a 2D canvas)
4. the sun and clouds (`atmosphere.ts`, WebGL2)

| Module | Role |
| --- | --- |
| `main.ts` | Starts every widget once the settings have loaded |
| `daylight.ts` | Sun position (USNO low-precision formulas), sky palette by elevation |
| `scene.ts` | Turns a WMO weather code into a scene and runs the frame loop; draws fog, rain, snow, hail and lightning |
| `atmosphere.ts` | Fluid-simulated clouds, sun, light marching and god rays |
| `weather.ts` | Open-Meteo readings, cached for 30 minutes |
| `location.ts` | Location detection, reverse and forward geocoding |
| `moon.ts` | Moon phase |
| `clock.ts`, `focus.ts`, `todos.ts`, `links.ts`, `quotes.ts` | Widgets |
| `panels.ts`, `settings-form.ts`, `search.ts` | Corner controls |
| `settings.ts`, `store.ts` | Settings and storage, with a `localStorage` fallback outside the extension |
| `math.ts`, `motion.ts`, `dom.ts`, `time.ts` | Shared helpers |

The animation loop stops when there is no weather to animate, and the sun is then redrawn once a minute. With reduced motion on, the sky draws a still frame without falling particles, and UI transitions drop their movement.

## Development

Serve the repo root (`python -m http.server`) and open `/newtab/newtab.html` to work without reloading the extension. Outside the extension, settings fall back to `localStorage`.

These query parameters pin the sky for development:

| Parameter | Effect |
| --- | --- |
| `sun=<degrees>` | Pins the sun's elevation, e.g. `sun=-6` for twilight |
| `sunx=<0..1>` | Places a pinned sun across the screen |
| `weather=<code>` | Pins the [WMO weather code](https://open-meteo.com/en/docs#weather_variable_documentation): `0` clear, `2` partly cloudy, `3` overcast, `45` fog, `63` rain, `75` snow, `99` thunderstorm with hail |
| `day=0` | Treats pinned weather as night |
| `wind=<km/h>` | Wind speed for pinned weather |
| `seed=<number>` | Repeats a cloud layout |

| Script | What it does |
| --- | --- |
| `pnpm run build` | Compiles `newtab/src` to `newtab/dist` |
| `pnpm run watch` | Rebuilds on change |
| `pnpm run check` | Type-checks |
| `pnpm run export` | Builds and copies both extensions out of the repo |
| `pnpm run screenshots` | Regenerates `docs/screenshots/` in headless Chrome or Brave (run `build` first) |
| `pnpm run frame` | Renders the theme's frame image |

The tools look for Chrome or Brave in the standard install locations. Set `CHROME` to point them elsewhere.

### Theme frame image

`theme/images/theme_frame.png` and `theme_frame@2x.png` are rendered from the same star backdrop, plus the tape and crosses drawn in `tools/frame.html`. The manifest maps them with numeric scale keys (`"100"`, `"200"`), so the 2x image keeps the strip sharp on scaled displays.

`tools/frame.html` takes query options:

- `px` and `py`: the compass position
- `top`: where decoration starts
- `shade`: dimming

Pass them through, e.g. `node tools/render-frame.ts "px=1400&shade=0.45"`. The browser draws the image about 16px above the tab strip, which is why decoration starts at `top=16`. After changing the images, bump the theme's `version` and delete `theme/Cached Theme.pak`. Otherwise the browser keeps showing the old images.

### Vendored design files

`newtab/onedark.css` is a One Dark layer over the vendored Nightglass styles in `newtab/vendor/`. Those are copies from the `theme-design-systems` repo:

- `tokens/base.css`
- `components/components.css`
- `themes/nightglass.css`
- `backdrops/_core.js`
- `backdrops/sky.js`

`sky.js` has one local change: it accumulates its rotation angle, so the spin speed can change without the chart jumping. Keep that change when re-copying. `sky.d.ts` types the backdrop for TypeScript.

## Data and licenses

- **Weather:** [Open-Meteo](https://open-meteo.com), which needs no key or account.
- **Location:** detected through the browser and re-checked every 6 hours, then named with BigDataCloud's free reverse geocoding. A city typed into Settings overrides it until you press Use my location.
- **Quotes:** the daily quote comes from a [Quotable](https://github.com/lukepeavey/quotable)-compatible API and is cached for the day. Quotable's public server has been down since its certificate expired in September 2024, so quotes come from the bundled list until it returns or you set your own source in Settings.
- **Bundled quote list:** `newtab/data/quotes.json` holds 1,581 quotes by 820 authors, at most 12 per author. It merges [dwyl/quotes](https://github.com/dwyl/quotes) (GPL-2.0), [inspirational-quotes](https://github.com/vinitshahdeo/inspirational-quotes) (MIT) and [DummyJSON](https://github.com/Ovi/DummyJSON) (MIT). Their licenses are in `newtab/data/licenses/`, and because of the GPL-2.0 source, the quote file is distributed under GPL-2.0.
