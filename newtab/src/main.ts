// Starts every widget once the settings have loaded.
import sky from '../vendor/backdrops/sky.js';
import { initClock } from './clock.js';
import { initDaylight } from './daylight.js';
import { $ } from './dom.js';
import { initFocus } from './focus.js';
import { initLinks } from './links.js';
import { initLocation } from './location.js';
import { markReady } from './motion.js';
import { initMoon } from './moon.js';
import { initPanels, openPanel } from './panels.js';
import { initQuote } from './quotes.js';
import { initScene } from './scene.js';
import { initSearch } from './search.js';
import { initSettingsForm } from './settings-form.js';
import { initSettings, onSettings, settings, SPIN_SECONDS, type Settings } from './settings.js';
import { initTodos } from './todos.js';
import { initWeather } from './weather.js';

await initSettings();
void initLocation();

// The backdrop's aurora, clouds, mountains and koi stay off; the weather draws its own clouds.
const skyOptions = (s: Settings) => ({
  chart: s.sky.chart, meteors: s.sky.meteors, aurora: false, clouds: false, mountains: false, koi: false,
  skyTurnSeconds: SPIN_SECONDS[s.spin],
});
const backdrop = sky($<HTMLCanvasElement>('sky'), { ...skyOptions(settings()), pole: [0.88, 0.32] });
onSettings((s) => backdrop.set(skyOptions(s)));
initDaylight();
initMoon();
initScene();

initClock();
initPanels();
initSettingsForm();
initSearch();
void initQuote();
initWeather(() => openPanel('settings-panel'));
await Promise.all([initFocus(), initTodos(), initLinks()]);
markReady();
