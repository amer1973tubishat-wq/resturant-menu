/**
 * The customer site and the admin page are two pages, built from one source.
 *
 *   - The PUBLIC page must contain nothing of the dashboard: no markup, no
 *     styles, no code, no database calls. It reads its content from
 *     content.json as data, and keeps working if that file is missing.
 *   - The ADMIN page opens straight into the dashboard for an account with
 *     edit access, and its Publish button starts the background task that
 *     rebuilds content.json — or says exactly why it could not.
 *
 * The public page is served over HTTP here because that is how it runs:
 * browsers refuse fetch() from file://, and a test that loaded it from disk
 * would pass for the wrong reason.
 */
const { STORE, resetStore, readStore, chromium, EXECUTABLE } = require('./harness');
const fs = require('fs');
const path = require('path');
const http = require('http');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..', '..');
const DIST = path.join(ROOT, 'dist');
const BUILD = path.join(ROOT, 'scripts', 'build.js');

let fails = 0;
const check = (n, ok, extra = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${extra ? ' — ' + extra : ''}`);
  if (!ok) fails++;
};

/* Build both pages fresh, with a test trigger wired into the admin one. */
function build() {
  execFileSync('node', [BUILD, 'public'], { cwd: ROOT, stdio: 'pipe' });
  execFileSync('node', [BUILD, 'admin'], {
    cwd: ROOT, stdio: 'pipe',
    env: Object.assign({}, process.env, { BAYTNA_TRIGGER_ID: 'trig_test123', BAYTNA_PUBLIC_URL: 'https://example.com/site' }),
  });
}

/* The viewer serves every published page inside its own skeleton, so the
   built files carry none of their own. Serve them the same way. */
const wrap = (html) => '<!doctype html><html><head><meta charset="utf-8">'
  + '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">'
  + '</head><body>' + html + '</body></html>';

/* A static server for dist/public (and the admin page at /admin.html), with
   content.json swappable per test. */
let contentJson = null;
let base = null;
function serve() {
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      const url = req.url.split('?')[0];
      if (url === '/content.json') {
        if (contentJson === null) { res.writeHead(404); res.end(); return; }
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(contentJson);
        return;
      }
      const file = url === '/admin.html' ? path.join(DIST, 'admin.html')
        : path.join(DIST, 'public', url === '/' ? 'index.html' : url);
      if (!file.startsWith(DIST) || !fs.existsSync(file)) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      res.end(wrap(fs.readFileSync(file, 'utf8')));
    });
    srv.listen(0, '127.0.0.1', () => resolve(srv));
  });
}

const content = (overrides = {}) => JSON.stringify(Object.assign({
  menu: {
    categories: [{ id: 'burgers', icon: 'burger', img: '', en: { n: 'Burgers', t: 'Smashed' }, ar: { n: 'برجر', t: '' } }],
    items: [{ id: 'z', cat: 'burgers', price: 9.5, spice: 2, badge: 'chef', img: '', en: { n: 'Published Burger', d: 'From content.json' }, ar: { n: 'برجر منشور', d: '' } }],
  },
  site: {
    brand: { en: { a: 'TESTBRAND', b: 'GRILL' }, ar: { a: 'تجربة', b: 'شواء' }, logo: '' },
    text: { en: { hero_l1: 'FROM JSON' }, ar: {} },
    contact: { whatsapp: '962700000001', phone: '+962 7 2222222' },
  },
  media: {},
}, overrides));

const seededAdmin = () => ({
  'content/menu': {
    categories: [{ id: 'burgers', icon: 'burger', img: '', en: { n: 'Burgers', t: '' }, ar: { n: 'برجر', t: '' } }],
    items: [{ id: 'a', cat: 'burgers', price: 5, spice: 0, badge: null, img: '', en: { n: 'Item A', d: '' }, ar: { n: 'أ', d: '' } }],
    updatedAt: 1
  },
  'content/site': {
    hours: Array.from({ length: 7 }, () => ({ o: 600, c: 1400 })),
    text: { en: {}, ar: {} }, brand: { en: { a: 'S', b: 'B' }, ar: { a: 'س', b: 'ب' }, logo: '' },
    heroImage: '', contact: { whatsapp: '962700000000', phone: 'p' }, updatedAt: 1
  }
});

async function openAdmin(ctx, mock) {
  const page = await ctx.newPage();
  await page.exposeFunction('__storeRead', async () => { try { return fs.readFileSync(STORE, 'utf8'); } catch { return '{}'; } });
  await page.exposeFunction('__storeWrite', async (t) => { fs.writeFileSync(STORE, t); return true; });
  await page.addInitScript(fs.readFileSync(path.join(__dirname, 'mock.js'), 'utf8'));
  if (mock) await page.addInitScript((m) => {
    window.addEventListener('DOMContentLoaded', () => Object.assign(window.__MOCK, m));
  }, mock);
  page.errs = [];
  page.on('pageerror', e => page.errs.push(e.message));
  await page.goto(base + 'admin.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4500);
  return page;
}

const panelOpen = (page) => page.evaluate(() => {
  const r = document.getElementById('admin-root');
  return !!(r && r.classList.contains('open'));
});

(async () => {
  build();

  /* 1 — the public page's source: nothing of the dashboard survives. */
  {
    const html = fs.readFileSync(path.join(DIST, 'public', 'index.html'), 'utf8');
    for (const t of ['admin-root', 'claude.use', 'ADMIN_ROUTE', 'ensureDb', 'ownerBtn', 'adSave', 'pressSave',
                     'access-probe', 'meta/', '@admin', 'fire_trigger', 'Claude Code Remote', '.ad-bar', '.owner-btn']) {
      check(`public page does not contain "${t}"`, !html.includes(t));
    }
    check('public page is much smaller than the admin page',
      html.length < fs.readFileSync(path.join(DIST, 'admin.html'), 'utf8').length * 0.7);
    check('public page carries no document wrapper of its own',
      !/<!doctype/i.test(html) && !/<html[\s>]/i.test(html) && !/<\/body>/i.test(html));
    check('public page names itself', /<title>Baytna Burger<\/title>/.test(html.slice(0, 8192)));
  }

  const srv = await serve();
  base = `http://127.0.0.1:${srv.address().port}/`;
  const b = await chromium.launch({ executablePath: EXECUTABLE });
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });

  /* 2 — the public page renders the published content, with no runtime. */
  {
    contentJson = content();
    const page = await ctx.newPage();
    const errs = []; page.on('pageerror', e => errs.push(e.message));
    await page.goto(base, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3500);
    const r = await page.evaluate(() => ({
      claude: typeof window.claude,
      brand: document.querySelector('.brand-name').textContent.trim(),
      hero: document.querySelector('[data-i18n="hero_l1"]').textContent.trim(),
      card: (document.querySelector('.card-name') || {}).textContent,
      price: (document.querySelector('.price') || {}).textContent,
      adminRoot: !!document.getElementById('admin-root'),
      ownerBtn: !!document.getElementById('ownerBtn'),
    }));
    check('public page runs with no claude.ai runtime', r.claude === 'undefined');
    check('the published brand is shown', r.brand === 'TESTBRAND GRILL', r.brand);
    check('a published text override is shown', r.hero === 'FROM JSON', r.hero);
    check('the published menu is shown', r.card === 'Published Burger', String(r.card));
    check('with its price', /9\.50/.test(r.price || ''), String(r.price));
    check('no dashboard element exists', r.adminRoot === false && r.ownerBtn === false);
    check('no errors', errs.length === 0, errs.join(' | '));
    await page.close();
  }

  /* 3 — hostile content in content.json is data, never code. */
  {
    const evil = '<img src=x onerror="window.__pwned=1"><script>window.__pwned=1</script>';
    contentJson = content({
      menu: { categories: [{ id: 'burgers', icon: '"><svg onload=window.__pwned=1>', img: 'javascript:window.__pwned=1', en: { n: evil, t: evil }, ar: { n: evil, t: '' } }],
              items: [{ id: evil, cat: 'burgers', price: 'NaN', spice: 99, badge: evil, img: 'javascript:window.__pwned=1', en: { n: evil, d: evil }, ar: { n: evil, d: evil } }] },
      site: { brand: { en: { a: evil, b: evil }, ar: { a: evil, b: evil }, logo: 'javascript:alert(1)' },
              text: { en: { hero_l1: evil, menu_title: evil }, ar: {} },
              links: { instagram: 'javascript:window.__pwned=1', facebook: '', tiktok: '', maps: '' },
              theme: { flame: 'red;background:url(x)', gold: '', red: '', bg: '' } },
      media: { x: 'javascript:window.__pwned=1' },
    });
    const page = await ctx.newPage();
    const errs = []; let dialogs = 0;
    page.on('pageerror', e => errs.push(e.message));
    page.on('dialog', async d => { dialogs++; await d.dismiss(); });
    await page.goto(base, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3500);
    const bad = await page.evaluate(() => {
      const out = [];
      document.querySelectorAll('*').forEach((el) => {
        for (const a of Array.from(el.attributes)) {
          if (/^on/i.test(a.name)) out.push(el.tagName + '[' + a.name + ']');
          if (/^\s*javascript:/i.test(a.value)) out.push(el.tagName + '[' + a.name + ']');
        }
      });
      return { pwned: !!window.__pwned, bad: out, shown: document.body.innerText.includes('<script>') };
    });
    check('hostile content runs nothing on the public page', bad.pwned === false && dialogs === 0);
    check('and leaves no script URL or handler in the DOM', bad.bad.length === 0, bad.bad.join(', '));
    check('and is shown as text', bad.shown === true);
    check('and throws nothing', errs.length === 0, errs.join(' | '));
    await page.close();
  }

  /* 4 — with no content.json at all, the built-in menu still renders. */
  {
    contentJson = null;
    const page = await ctx.newPage();
    const errs = []; page.on('pageerror', e => errs.push(e.message));
    await page.goto(base, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3500);
    const cards = await page.evaluate(() => document.querySelectorAll('.card').length);
    check('a missing content.json falls back to the built-in menu', cards > 0, String(cards));
    check('without errors', errs.length === 0, errs.join(' | '));
    await page.close();
  }

  /* 5 — the admin page opens straight into the dashboard for an editor. */
  {
    resetStore(seededAdmin());
    const page = await openAdmin(ctx);
    check('the admin page opens into the dashboard, no address needed', (await panelOpen(page)) === true);
    check('it is usable', (await page.evaluate(() => document.querySelectorAll('#admin-root input').length)) > 0);
    check('it offers Publish', (await page.$('#adPublish')) !== null);
    check('and a link to the public site',
      (await page.evaluate(() => {
        const a = [...document.querySelectorAll('#admin-root a')].find(x => /View website|عرض الموقع/.test(x.textContent));
        return a ? a.getAttribute('href') : null;
      })) === 'https://example.com/site');
    check('it says nothing has been published yet',
      /Not published yet|لم يُنشر/.test(await page.$eval('#adPubStatus', el => el.textContent)));

    /* Close previews the site; the corner button brings the dashboard back. */
    await page.click('#adClose');
    await page.waitForTimeout(600);
    check('Close shows the site preview', (await panelOpen(page)) === false);
    check('with a way back', await page.evaluate(() => {
      const b = document.getElementById('ownerBtn'); return !!b && !b.hidden;
    }));
    await page.click('#ownerBtn');
    await page.waitForTimeout(800);
    check('the corner button reopens the dashboard', (await panelOpen(page)) === true);
    check('no errors', page.errs.length === 0, page.errs.join(' | '));
    await page.close();
  }

  /* 6 — Publish starts the task, and records that it asked. */
  {
    resetStore(seededAdmin());
    const page = await openAdmin(ctx);
    await page.click('#adPublish');
    await page.waitForTimeout(1500);
    const calls = await page.evaluate(() => window.__MOCK.mcpCalls);
    check('Publish calls the task through Claude Code Remote',
      calls.length === 1 && calls[0].server === 'Claude Code Remote' && calls[0].tool === 'fire_trigger',
      JSON.stringify(calls));
    check('with the configured task', calls[0] && calls[0].input && calls[0].input.trigger_id === 'trig_test123');
    const rec = readStore()['meta/publish'] || {};
    check('and records the request', rec.status === 'requested', JSON.stringify(rec));
    check('the button waits while the task runs', await page.$eval('#adPublish', el => el.disabled));
    check('and the status says so',
      /Publishing|بدأ النشر/.test(await page.$eval('#adPubStatus', el => el.textContent)));

    /* The task reports back through the database; the page shows it live. */
    const store = readStore();
    store['meta/publish'] = { status: 'live', at: Date.now() };
    fs.writeFileSync(STORE, JSON.stringify(store, null, 1));
    await page.evaluate(() => window.__MOCK.forceNotify());
    await page.waitForTimeout(900);
    check('a finished publish shows as up to date',
      /up to date|محدّث/.test(await page.$eval('#adPubStatus', el => el.textContent)),
      await page.$eval('#adPubStatus', el => el.textContent));
    check('and the button is ready again', !(await page.$eval('#adPublish', el => el.disabled)));
    await page.close();
  }

  /* 7 — every failure that has its own fix gets its own message. */
  for (const [mode, expect] of [
    ['absent', /only works with this page open on claude\.ai/],
    ['server_not_connected', /Add Claude Code Remote in claude\.ai Settings/],
    ['needs_reauth', /Reconnect Claude Code Remote/],
    ['not_in_manifest', /Allow this page to use Claude Code Remote/],
    ['blocked_by_policy', /organisation settings blocked/],
    ['server_unavailable', /try again in a minute/],
  ]) {
    resetStore(seededAdmin());
    const page = await openAdmin(ctx, { mcpMode: mode });
    await page.click('#adPublish');
    await page.waitForTimeout(1500);
    const text = await page.$eval('#adPubStatus', el => el.textContent);
    check(`publish failure "${mode}" explains itself`, expect.test(text), text);
    check(`and "${mode}" is recorded for later`, (readStore()['meta/publish'] || {}).status === 'failed');
    check(`and the button is usable again after "${mode}"`, !(await page.$eval('#adPublish', el => el.disabled)));
    await page.close();
  }

  /* 8 — unsaved work is saved before it is published. */
  {
    resetStore(seededAdmin());
    const page = await openAdmin(ctx);
    await page.evaluate(() => {
      const el = document.querySelector('#admin-root [data-path="items.0.en.n"]');
      el.value = 'Unsaved Then Published';           /* no event: not yet saved */
    });
    await page.click('#adPublish');
    await page.waitForTimeout(4000);
    check('the edit was saved first',
      readStore()['content/menu'].items[0].en.n === 'Unsaved Then Published',
      readStore()['content/menu'].items[0].en.n);
    check('then the publish was started',
      (await page.evaluate(() => window.__MOCK.mcpCalls.length)) === 1);
    await page.close();
  }

  /* 9 — the admin page gives nothing to an account without edit access. */
  {
    resetStore(seededAdmin());
    const page = await openAdmin(ctx, { canEdit: false });
    await page.waitForTimeout(5000);
    const t = await page.$eval('#admin-root', el => el.textContent);
    check('a refused viewer of the admin page sees no controls',
      (await page.evaluate(() => document.querySelectorAll('#admin-root input,#adPublish').length)) === 0);
    check('and is told plainly', /not available|غير متاحة/.test(t), t.slice(0, 80));
    check('and no publish was attempted', (await page.evaluate(() => window.__MOCK.mcpCalls.length)) === 0);
    await page.close();
  }

  await ctx.close();
  await b.close();
  srv.close();
  console.log(fails ? `\n${fails} FAILED` : '\nAll split checks passed');
  process.exit(fails ? 1 : 0);
})();
