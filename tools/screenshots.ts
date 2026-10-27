// Captures the README screenshots: loads the new tab in headless Chrome or Brave and drives it over the DevTools protocol.
import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import type { Readable, Writable } from 'node:stream';
import { setTimeout as sleep } from 'node:timers/promises';
import { findChrome } from './browser.ts';

const root = resolve(import.meta.dirname, '..');
const out = join(root, 'docs', 'screenshots');
const W = 1440, H = 900;

// Demo data, so no real name or location appears in the images.
const NAME = 'Sam';
const PLACE = { name: 'Lisbon, Lisbon, PT', lat: 38.717, lon: -9.133, tz: 'Europe/Lisbon' };

interface Scene { name: string; query: string; code: number; temp: number; settings?: boolean }
const SCENES: Scene[] = [
  { name: 'day', query: 'weather=2&sun=40&sunx=0.5&seed=21', code: 2, temp: 22 },
  { name: 'sunset', query: 'weather=2&sun=1&sunx=0.2&seed=7', code: 2, temp: 17 },
  { name: 'rain', query: 'weather=63&sun=30&sunx=0.4&seed=7', code: 63, temp: 12 },
  { name: 'night', query: 'weather=1&sun=-20&seed=11', code: 1, temp: 9 },
  { name: 'settings', query: 'weather=2&sun=40&sunx=0.5&seed=21', code: 2, temp: 22, settings: true },
];

/** DevTools protocol over the browser's pipe: null-terminated JSON messages on file descriptors 3 and 4. */
function devtools(input: Writable, output: Readable) {
  let id = 0, buffer = '';
  const pending = new Map<number, { done: (v: any) => void; fail: (e: Error) => void }>();
  const waiters: { method: string; done: () => void }[] = [];
  output.on('data', (chunk: Buffer) => {
    buffer += chunk.toString();
    let end;
    while ((end = buffer.indexOf('\0')) >= 0) {
      const msg = JSON.parse(buffer.slice(0, end));
      buffer = buffer.slice(end + 1);
      const call = pending.get(msg.id);
      if (call) msg.error ? call.fail(new Error(msg.error.message)) : call.done(msg.result);
      const i = waiters.findIndex((w) => w.method === msg.method);
      if (i >= 0) waiters.splice(i, 1)[0]!.done();
    }
  });
  return {
    send(method: string, params: object = {}, sessionId?: string): Promise<any> {
      return new Promise((done, fail) => {
        pending.set(++id, { done, fail });
        input.write(JSON.stringify({ id, method, params, sessionId }) + '\0');
      });
    },
    next: (method: string) => new Promise<void>((done) => waiters.push({ method, done })),
  };
}

async function capture(): Promise<void> {
  const profile = mkdtempSync(join(tmpdir(), 'nightglass-shots-'));
  const browser = spawn(findChrome(), [
    '--headless=new',
    `--user-data-dir=${profile}`,
    '--remote-debugging-pipe',
    '--enable-unsafe-extension-debugging', // allows Extensions.loadUnpacked
    '--enable-unsafe-swiftshader', // WebGL without a GPU
    '--hide-scrollbars',
  ], { stdio: ['ignore', 'ignore', 'ignore', 'pipe', 'pipe'] });
  try {
    const cdp = devtools(browser.stdio[3] as Writable, browser.stdio[4] as Readable);
    const { id: extension } = await cdp.send('Extensions.loadUnpacked', { path: join(root, 'newtab') });
    const base = `chrome-extension://${extension}/newtab.html`;
    const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
    const page = (method: string, params: object = {}) => cdp.send(method, params, sessionId);
    const evaluate = (expression: string) => page('Runtime.evaluate', { expression, awaitPromise: true });
    const open = async (url: string) => {
      const loaded = cdp.next('Page.loadEventFired');
      await page('Page.navigate', { url });
      await loaded;
    };

    await page('Page.enable');
    await page('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: false });
    await open(base);
    mkdirSync(out, { recursive: true });
    for (const scene of SCENES) {
      // A cached reading, in weather.ts's cache format, makes the weather widget match the pinned sky.
      const reading = {
        key: `${PLACE.lat.toFixed(3)},${PLACE.lon.toFixed(3)},c`, at: Date.now(), temp: scene.temp, code: scene.code,
        day: true, hi: scene.temp + 3, lo: scene.temp - 6, tz: PLACE.tz, wind: 12, windDir: 260,
      };
      await evaluate(`Promise.all([
        chrome.storage.sync.set({ settings: { name: ${JSON.stringify(NAME)}, place: ${JSON.stringify(PLACE)} } }),
        chrome.storage.local.set({ weather: ${JSON.stringify(reading)} }),
      ])`);
      await open(`${base}?${scene.query}`);
      await sleep(2500);
      if (scene.settings) {
        await evaluate(`document.getElementById('settings-toggle').click()`);
        await sleep(600);
      }
      const shot = await page('Page.captureScreenshot', { format: 'png' });
      writeFileSync(join(out, `${scene.name}.png`), Buffer.from(shot.data, 'base64'));
      console.log(`wrote docs/screenshots/${scene.name}.png`);
    }
    await cdp.send('Browser.close').catch(() => {});
  } finally {
    browser.kill();
    await sleep(500);
    rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  }
}

await capture();
