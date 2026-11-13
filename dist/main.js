// Starts every widget once the settings have loaded.
import './fonts.js';
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
import { initSettings, onSettings, settings, SPIN_SECONDS } from './settings.js';
import { initTodos } from './todos.js';
import { initWeather } from './weather.js';
/** Runs one widget's setup; a failure is logged and the rest of the page still starts. */
async function start(setup) {
    try {
        await setup();
    }
    catch (err) {
        console.error(err);
    }
}
await initSettings();
void start(initLocation);
// The backdrop's aurora, clouds and mountains stay off; the weather draws its own clouds.
const skyOptions = (s) => ({
    chart: s.sky.chart, meteors: s.sky.meteors, koi: s.sky.koi, jellyfish: s.sky.jellyfish,
    aurora: false, clouds: false, mountains: false,
    skyTurnSeconds: SPIN_SECONDS[s.spin],
});
void start(() => {
    const backdrop = sky($('sky'), { ...skyOptions(settings()), pole: [0.88, 0.32] });
    onSettings((s) => backdrop.set(skyOptions(s)));
});
void start(initDaylight);
void start(initMoon);
void start(initScene);
void start(initClock);
void start(initPanels);
void start(initSettingsForm);
void start(initSearch);
void start(initQuote);
void start(() => initWeather(() => openPanel('settings-panel')));
await Promise.all([start(initFocus), start(initTodos), start(initLinks)]);
markReady();
