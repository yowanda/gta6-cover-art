// SPDX-License-Identifier: MIT
// Vice City Cover Studio — screenshot + verification driver (Node 22+,
// standard library only). Serves app/ on localhost, drives the Playwright
// Chromium over CDP with the built-in WebSocket client, and:
//   1. Renders the four screenshots into screenshots/ (JPEG, each capped
//      at 256 KiB — the quality steps down until the cap holds).
//   2. Fails loudly on any console error, page exception or failed request.
//   3. Clicks the real "All 3 sizes" export and checks the three PNGs
//      land with the right dimensions.
// Usage: node scripts/shots.mjs [--shots-only] [--exports-only]
//   --shots-only    regenerate the four screenshots, skip the export check
//   --exports-only  run the export check, skip the screenshots
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { createReadStream, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = fileURLToPath(new URL('.', import.meta.url));
const ROOT = resolve(HERE, '..');
const APP_DIR = join(ROOT, 'app');
const SHOTS_DIR = join(ROOT, 'screenshots');
const EXPORTS_DIR = join(ROOT, '.exports-check');
const CHROME = '/home/hatch/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome';
const PORT = 8131;
const DEBUG_PORT = 9344;
const MAX_SHOT_BYTES = 262144;

/** The four screenshots: name, scene query, viewport, first JPEG quality. */
const SHOTS = [
  {
    name: '1-cover.jpg',
    query: '?shot=cover&size=1920x1080&preset=neonNights',
    w: 1280, h: 720, quality: 88,
  },
  {
    name: '2-editor.jpg',
    query: '?shot=editor&preset=sunsetHeist',
    w: 1280, h: 800, quality: 88,
  },
  {
    name: '3-cover.jpg',
    query: '?shot=cover&size=1080x1080&layout=heroLeft&grade=chrome&slots=rooftop,pier,boulevard,pier&caption=ROOFTOP%20NIGHTS&captionFont=typewriter',
    w: 1080, h: 1080, quality: 88,
  },
  {
    name: '4-cover.jpg',
    query: '?shot=cover&size=1080x1350&preset=chromeRooftop',
    w: 1024, h: 1280, quality: 88,
  },
];

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain; charset=utf-8',
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** A minimal static server for app/, same rules as serve.ts. */
function serveApp() {
  const server = createServer((request, response) => {
    const url = new URL(request.url ?? '/', 'http://localhost');
    let pathname = url.pathname;
    try {
      pathname = decodeURIComponent(pathname);
    } catch {
      response.writeHead(400).end('bad request');
      return;
    }
    if (pathname.endsWith('/')) pathname += 'index.html';
    const file = resolve(join(APP_DIR, normalize(pathname)));
    if (file !== APP_DIR && !file.startsWith(APP_DIR + sep)) {
      response.writeHead(403).end('forbidden');
      return;
    }
    let size;
    try {
      const stats = statSync(file);
      if (!stats.isFile()) throw new Error('not a file');
      size = stats.size;
    } catch {
      response.writeHead(404).end('not found');
      return;
    }
    response.writeHead(200, {
      'content-type': MIME[extname(file).toLowerCase()] ?? 'application/octet-stream',
      'content-length': size,
      'cache-control': 'no-store',
    });
    createReadStream(file).pipe(response);
  });
  return new Promise((resolve) => server.listen(PORT, '127.0.0.1', () => resolve(server)));
}

/** A thin CDP client over one page target. */
class Page {
  constructor(wsUrl) {
    this.ws = new WebSocket(wsUrl);
    this.nextId = 1;
    this.pending = new Map();
    this.events = [];
    this.ready = new Promise((resolve, reject) => {
      this.ws.onopen = resolve;
      this.ws.onerror = reject;
    });
    this.ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) reject(new Error(`CDP ${msg.error.code}: ${msg.error.message}`));
        else resolve(msg.result);
      } else if (msg.method) {
        this.events.push(msg);
      }
    };
  }

  async call(method, params = {}) {
    await this.ready;
    const id = this.nextId++;
    this.ws.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error(`CDP timeout: ${method}`));
        }
      }, 30000);
    });
  }

  async eval(expression) {
    const result = await this.call('Runtime.evaluate', {
      expression, returnByValue: true, awaitPromise: true,
    });
    if (result.exceptionDetails) {
      throw new Error(`page eval failed: ${result.exceptionDetails.text}`);
    }
    return result.result?.value;
  }

  async waitFor(expression, timeoutMs = 30000) {
    const deadline = Date.now() + timeoutMs;
    for (;;) {
      const value = await this.eval(expression).catch(() => undefined);
      if (value) return value;
      if (Date.now() > deadline) throw new Error(`timed out waiting for ${expression}`);
      await sleep(200);
    }
  }

  /** Console errors, page exceptions and failed requests seen so far. */
  problems() {
    const out = [];
    for (const event of this.events) {
      if (event.method === 'Runtime.exceptionThrown') {
        out.push(`exception: ${event.params.exceptionDetails.text} ${event.params.exceptionDetails.exception?.description ?? ''}`);
      }
      if (event.method === 'Runtime.consoleAPICalled' && event.params.type === 'error') {
        out.push(`console.error: ${event.params.args.map((a) => a.value ?? a.description ?? '').join(' ')}`);
      }
      if (event.method === 'Log.entryAdded' && event.params.entry.level === 'error') {
        out.push(`log error: ${event.params.entry.text} ${event.params.entry.url ?? ''}`);
      }
      if (event.method === 'Network.loadingFailed') {
        out.push(`request failed: ${event.params.errorText}`);
      }
    }
    return out;
  }

  close() {
    try {
      this.ws.close();
    } catch { /* already closed */ }
  }
}

async function newPage(url) {
  const target = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/new?${encodeURIComponent(url)}`, { method: 'PUT' }).then((r) => r.json());
  const page = new Page(target.webSocketDebuggerUrl);
  await page.call('Page.enable');
  await page.call('Runtime.enable');
  await page.call('Log.enable');
  await page.call('Network.enable');
  return page;
}

/** A PNG's dimensions, read from its IHDR chunk (no decoder needed). */
function pngSize(bytes) {
  if (bytes.length < 33 || bytes.readUInt32BE(0) !== 0x89504e47) return null;
  return { w: bytes.readUInt32BE(16), h: bytes.readUInt32BE(20) };
}

/** One screenshot: navigate, wait for the scene, capture within the cap. */
async function takeShot(shot) {
  const page = await newPage(`http://127.0.0.1:${PORT}/index.html${shot.query}`);
  try {
    await page.call('Emulation.setDeviceMetricsOverride', {
      width: shot.w, height: shot.h, deviceScaleFactor: 1, mobile: false,
    });
    await page.waitFor('window.__shotReady === true');
    await sleep(150);
    let quality = shot.quality;
    let buffer = null;
    for (;;) {
      const result = await page.call('Page.captureScreenshot', { format: 'jpeg', quality });
      buffer = Buffer.from(result.data, 'base64');
      if (buffer.length <= MAX_SHOT_BYTES || quality <= 55) break;
      quality -= 8;
    }
    const out = join(SHOTS_DIR, shot.name);
    writeFileSync(out, buffer);
    const problems = page.problems();
    console.log(`${shot.name}: ${buffer.length} bytes (quality ${quality}), ${shot.w}x${shot.h}${problems.length ? ` — PROBLEMS: ${problems.join(' | ')}` : ''}`);
    if (problems.length > 0) throw new Error(`${shot.name}: page problems: ${problems.join(' | ')}`);
    return { name: shot.name, bytes: buffer.length, quality };
  } finally {
    page.close();
  }
}

/** The export check: click "All 3 sizes" and verify the three PNGs. */
async function checkExports() {
  mkdirSync(EXPORTS_DIR, { recursive: true });
  const page = await newPage(`http://127.0.0.1:${PORT}/index.html`);
  try {
    await page.call('Emulation.setDeviceMetricsOverride', {
      width: 1280, height: 900, deviceScaleFactor: 1, mobile: false,
    });
    await page.call('Page.setDownloadBehavior', { behavior: 'allow', downloadPath: EXPORTS_DIR });
    await sleep(1500);
    await page.eval(`document.getElementById('exportAll').click()`);
    const exports = await page.waitFor(
      `(window.__lastExports && window.__lastExports.length >= 3) ? window.__lastExports : null`,
      20000,
    );
    await sleep(1200);
    console.log(`exports reported: ${exports.map((e) => `${e.w}x${e.h} (${e.bytes} bytes)`).join(', ')}`);
    const expected = [
      { w: 1080, h: 1080 },
      { w: 1080, h: 1350 },
      { w: 1920, h: 1080 },
    ];
    for (const size of expected) {
      const file = join(EXPORTS_DIR, `vice-city-cover-${size.w}x${size.h}.png`);
      if (!existsSync(file)) throw new Error(`export missing: ${file}`);
      const bytes = readFileSync(file);
      const dims = pngSize(bytes);
      if (!dims || dims.w !== size.w || dims.h !== size.h) {
        throw new Error(`export ${file}: dimensions ${dims ? `${dims.w}x${dims.h}` : 'unreadable'}, expected ${size.w}x${size.h}`);
      }
      console.log(`export file OK: vice-city-cover-${size.w}x${size.h}.png, ${bytes.length} bytes`);
    }
    const problems = page.problems();
    if (problems.length > 0) throw new Error(`export page problems: ${problems.join(' | ')}`);
    console.log('exports: no console/page errors.');
  } finally {
    page.close();
  }
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const shotsOnly = args.has('--shots-only');
  const exportsOnly = args.has('--exports-only');
  if (!existsSync(CHROME)) throw new Error(`Chromium not found at ${CHROME}`);
  const server = await serveApp();
  console.log(`app/ on http://127.0.0.1:${PORT}`);
  const chrome = spawn(CHROME, [
    '--headless=new',
    `--remote-debugging-port=${DEBUG_PORT}`,
    '--no-sandbox',
    '--disable-gpu',
    '--user-data-dir=/tmp/vice-shots-profile',
    'about:blank',
  ], { stdio: 'ignore' });
  try {
    // Wait for the DevTools endpoint to answer.
    const deadline = Date.now() + 20000;
    for (;;) {
      try {
        const res = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/version`);
        if (res.ok) break;
      } catch { /* not up yet */ }
      if (Date.now() > deadline) throw new Error('Chromium DevTools did not come up');
      await sleep(200);
    }
    if (!exportsOnly) {
      mkdirSync(SHOTS_DIR, { recursive: true });
      for (const shot of SHOTS) await takeShot(shot);
    }
    if (!shotsOnly) await checkExports();
    console.log('ALL CHECKS PASSED');
  } finally {
    chrome.kill('SIGKILL');
    server.close();
  }
}

main().catch((error) => {
  console.error(`FAILED: ${error.message}`);
  process.exit(1);
});
