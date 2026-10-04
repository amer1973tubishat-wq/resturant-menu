/**
 * The dashboard is not part of the site a customer sees.
 *
 * Two separate things, and only the second is a control:
 *
 *   1. It is unlisted. Nothing on the page links to it, so a customer
 *      browsing the menu never arrives. That is a convenience — anyone who
 *      reads the page source can find the address.
 *   2. It is gated. The panel renders only for a viewer the database accepts
 *      writes from. Someone who finds the address anyway gets nothing: no
 *      controls, and not even a read-only copy of the content.
 *
 * The second is what makes the first safe to rely on.
 */
const { STORE, ADMIN_HASH, resetStore, chromium, EXECUTABLE } = require('./harness');
const fs = require('fs');
const path = require('path');
const SRC = path.resolve(__dirname, '..', '..', 'index.html');
const PAGE = 'file://' + SRC;

let fails = 0;
const check = (n, ok, extra = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${extra ? ' — ' + extra : ''}`);
  if (!ok) fails++;
};

const seeded = () => ({
  'content/menu': {
    categories: [{ id: 'burgers', icon: 'burger', img: '', en: { n: 'Burgers', t: '' }, ar: { n: 'برجر', t: '' } }],
    items: [{ id: 'a', cat: 'burgers', price: 5, spice: 0, badge: null, img: '', en: { n: 'Secret Item', d: '' }, ar: { n: 'أ', d: '' } }],
    updatedAt: 1
  },
  'content/site': {
    hours: Array.from({ length: 7 }, () => ({ o: 600, c: 1400 })),
    text: { en: {}, ar: {} }, brand: { en: { a: 'S', b: 'B' }, ar: { a: 'س', b: 'ب' }, logo: '' },
    heroImage: '', contact: { whatsapp: '962700000000', phone: 'p' }, updatedAt: 1
  }
});

async function load(ctx, hash, mock) {
  resetStore(seeded());
  const page = await ctx.newPage();
  await page.exposeFunction('__storeRead', async () => { try { return fs.readFileSync(STORE, 'utf8'); } catch { return '{}'; } });
  await page.exposeFunction('__storeWrite', async (t) => { fs.writeFileSync(STORE, t); return true; });
  await page.addInitScript(fs.readFileSync(path.join(__dirname, 'mock.js'), 'utf8'));
  if (mock) await page.addInitScript((m) => {
    window.addEventListener('DOMContentLoaded', () => Object.assign(window.__MOCK, m));
  }, mock);
  page.errs = [];
  page.on('pageerror', e => page.errs.push(e.message));
  await page.goto(PAGE + hash, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4200);
  return page;
}

const panelOpen = (page) => page.evaluate(() =>
  document.getElementById('admin-root').classList.contains('open'));
const controls = (page) => page.evaluate(() =>
  document.querySelectorAll('#admin-root input,#admin-root textarea,#admin-root select').length);

(async () => {
  /* 1 — nothing in the source points at it. */
  {
    const src = fs.readFileSync(SRC, 'utf8');
    const route = src.match(/var ADMIN_ROUTE = '([^']+)'/)[1];
    check('the route is long enough not to be guessed', route.length >= 20, route);

    /* The only place the route may appear is its own declaration. An href
       anywhere would put it back in front of customers. */
    const hrefs = [...src.matchAll(/href="([^"]*)"/g)].map(m => m[1]);
    check('no link anywhere points at the dashboard',
      hrefs.every(h => h !== route && !h.includes(route.slice(1))),
      hrefs.filter(h => h.includes(route.slice(1))).join(', '));
    check('the word Admin is gone from the page chrome',
      !/data-i18n="admin_link"/.test(src) && !/id="adminLink"/.test(src));
  }

  const b = await chromium.launch({ executablePath: EXECUTABLE });
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
  let page;

  /* 2 — a customer on the site is never offered it. */
  page = await load(ctx, '');
  check('the footer offers no dashboard link',
    (await page.evaluate(() => {
      const t = document.querySelector('footer').textContent;
      return /admin|لوحة التحكم/i.test(t);
    })) === false);
  check('the panel is closed on the site', (await panelOpen(page)) === false);
  await page.close();

  /* 2b — the owner's way in: a button on the site, for the owner only. */
  page = await load(ctx, '');
  const ownerBtn = await page.evaluate(() => {
    const b = document.getElementById('ownerBtn');
    return b ? { shown: !b.hidden, text: b.textContent } : { shown: false };
  });
  check('the owner sees a dashboard button on the site', ownerBtn.shown === true, JSON.stringify(ownerBtn));
  await page.click('#ownerBtn');
  await page.waitForTimeout(1500);
  check('one click opens the dashboard', (await panelOpen(page)) === true);
  check('and it is usable', (await controls(page)) > 0);
  await page.close();

  page = await load(ctx, '', { canEdit: false });
  await page.waitForTimeout(9000);          /* past every probe retry */
  check('a customer never sees the button',
    (await page.evaluate(() => {
      const b = document.getElementById('ownerBtn');
      return !b || b.hidden;
    })) === true);
  await page.close();

  /* 3 — the old address, and a wrong guess, open nothing. */
  for (const guess of ['#admin', '#manage', '#manage-0000000000000000', '#dashboard']) {
    page = await load(ctx, guess);
    check(`${guess} does not open the dashboard`, (await panelOpen(page)) === false);
    check(`${guess} shows no controls`, (await controls(page)) === 0);
    await page.close();
  }

  /* 4 — the real address, for someone who may edit. */
  page = await load(ctx, ADMIN_HASH);
  check('the real address opens the dashboard', (await panelOpen(page)) === true);
  check('and it is usable', (await controls(page)) > 0);
  check('no page errors', page.errs.length === 0, page.errs.join(' | '));
  await page.close();

  /* 5 — the real address, for someone the database refuses. Knowing where
     the door is must not be enough to get through it. */
  page = await load(ctx, ADMIN_HASH, { canEdit: false });
  check('a refused viewer sees no controls', (await controls(page)) === 0);
  const text = await page.$eval('#admin-root', el => el.textContent);
  check('a refused viewer is told plainly', /not available|غير متاحة/.test(text), text.slice(0, 80));
  check('and the content is not shown to them', !/Secret Item/.test(text));
  check('and the page is still offered a way back', /Back to the site|العودة/.test(text));
  await page.close();

  await ctx.close();
  await b.close();
  console.log(fails ? `\n${fails} FAILED` : '\nAll private-route checks passed');
  process.exit(fails ? 1 : 0);
})();
