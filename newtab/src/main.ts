import sky from '../vendor/backdrops/sky.js';
import { initClock } from './clock.js';
import { initDaylight } from './daylight.js';
import { $ } from './dom.js';
import { initFocus } from './focus.js';
import { initLinks } from './links.js';
import { initLocation } from './location.js';
import { initMoon } from './moon.js';
import { initControls, openPanel } from './panels.js';
import { initQuote } from './quotes.js';
import { initSettings, onSettings, settings, SPIN_SECONDS } from './settings.js';
import { initTodos } from './todos.js';
import { initWeather } from './weather.js';

await initSettings();
void initLocation();

const backdrop = sky($<HTMLCanvasElement>('sky'), { ...settings().sky, skyTurnSeconds: SPIN_SECONDS[settings().spin], pole: [0.88, 0.32] });
onSettings((s) => backdrop.set({ ...s.sky, skyTurnSeconds: SPIN_SECONDS[s.spin] }));
initDaylight();
initMoon();

initClock();
initControls();
void initQuote();
initWeather(() => openPanel('settings-panel'));
await Promise.all([initFocus(), initTodos(), initLinks()]);
