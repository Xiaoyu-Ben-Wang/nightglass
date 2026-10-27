import sky from '../vendor/backdrops/sky.js';
import { initClock } from './clock.js';
import { $ } from './dom.js';
import { initFocus } from './focus.js';
import { initLinks } from './links.js';
import { initControls, openPanel } from './panels.js';
import { initQuote } from './quotes.js';
import { initSettings, onSettings, settings } from './settings.js';
import { initTodos } from './todos.js';
import { initWeather } from './weather.js';

await initSettings();

const backdrop = sky($<HTMLCanvasElement>('sky'), { ...settings().sky, pole: [0.88, 0.32] });
onSettings((s) => backdrop.set(s.sky));

initClock();
initControls();
initQuote();
initWeather(() => openPanel('settings-panel'));
await Promise.all([initFocus(), initTodos(), initLinks()]);
