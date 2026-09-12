const fs = require('fs');
const path = require('path');

/* Playwright is not vendored into this repo. Resolve it from wherever it is
   installed and say so plainly rather than failing with MODULE_NOT_FOUND. */
let chromium;
try {
  ({ chromium } = require('playwright'));
} catch {
  console.error(
    'These tests need Playwright and a Chromium build.\n' +
    '  npm i -D playwright\n' +
    'If Chromium lives elsewhere, point CHROMIUM_PATH at the binary.'
  );
  process.exit(2);
}

/* Prefer a preinstalled browser over downloading one. */
const EXECUTABLE = process.env.CHROMIUM_PATH ||
  (fs.existsSync('/opt/pw-browsers/chromium-1194/chrome-linux/chrome')
    ? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
    : undefined);

const STORE = path.join(process.env.TMPDIR || '/tmp', 'baytna-save-flow-store.json');
const MOCK  = fs.readFileSync(path.join(__dirname, 'mock.js'), 'utf8');
const PAGE  = 'file://' + path.resolve(__dirname, '..', '..', 'index.html');

function resetStore(obj) { fs.writeFileSync(STORE, JSON.stringify(obj || {}, null, 1)); }
function readStore() { try { return JSON.parse(fs.readFileSync(STORE, 'utf8')); } catch { return {}; } }

async function openPage(browser, { hash = '', mock = {} } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await ctx.newPage();
  await page.exposeFunction('__storeRead', async () => {
    try { return fs.readFileSync(STORE, 'utf8'); } catch { return '{}'; }
  });
  await page.exposeFunction('__storeWrite', async (t) => { fs.writeFileSync(STORE, t); return true; });
  await page.addInitScript(MOCK);
  if (Object.keys(mock).length) {
    await page.addInitScript((m) => { window.addEventListener('DOMContentLoaded', () => Object.assign(window.__MOCK, m)); }, mock);
  }
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  page.errs = errs;
  await page.goto(PAGE + hash);
  await page.waitForTimeout(3600);
  return { ctx, page };
}

module.exports = { STORE, resetStore, readStore, openPage, chromium, EXECUTABLE };
