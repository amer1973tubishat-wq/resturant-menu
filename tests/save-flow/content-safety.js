/**
 * Content from the database is data, never code.
 *
 * Everything the public page renders — item names, descriptions, category
 * labels, headings, the brand wordmark, image references — is read from a
 * shared database that the dashboard writes to. The runtime contract is
 * explicit that shared data is untrusted, so each of these payloads is stored
 * the way an attacker with write access would store it, and the page is then
 * required to render it as visible text and nothing else.
 *
 * The test for "did it execute" is not a string match on the HTML: it counts
 * actual effects — dialogs, thrown errors, and a flag a payload would set on
 * window if any of its scripts ran.
 */
const { STORE, resetStore, readStore, chromium, EXECUTABLE } = require('./harness');
const fs = require('fs');
const path = require('path');
const PAGE = 'file://' + path.resolve(__dirname, '..', '..', 'index.html');

let fails = 0;
const check = (n, ok, extra = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${extra ? ' — ' + extra : ''}`);
  if (!ok) fails++;
};

/* Each one tries a different way out of the context it lands in. */
const XSS = [
  '<script>window.__pwned=1</script>',
  '"><script>window.__pwned=1</script>',
  "'><img src=x onerror=window.__pwned=1>",
  '<img src=x onerror="window.__pwned=1">',
  '<svg/onload=window.__pwned=1>',
  '</textarea><script>window.__pwned=1</script>',
  '</option></select><img src=x onerror=window.__pwned=1>',
  'javascript:window.__pwned=1',
  '<iframe srcdoc="<script>parent.__pwned=1</script>">',
  '<body onload=window.__pwned=1>',
  '"onmouseover="window.__pwned=1',
  '<a href="javascript:window.__pwned=1">x</a>',
];

const hostile = () => ({
  'content/menu': {
    categories: [{
      id: XSS[1], icon: XSS[4], img: 'javascript:window.__pwned=1',
      en: { n: XSS[0], t: XSS[2] }, ar: { n: XSS[3], t: XSS[5] }
    }],
    items: [{
      id: XSS[6], cat: XSS[1], price: '1e9', spice: 99, badge: XSS[0], img: XSS[7],
      en: { n: XSS[2], d: XSS[8] }, ar: { n: XSS[9], d: XSS[10] }
    }],
    updatedAt: 1
  },
  'content/site': {
    hours: Array.from({ length: 7 }, () => ({ o: 600, c: 1400 })),
    text: { en: { hero_l1: XSS[0], menu_title: XSS[3], hero_tag: XSS[11] }, ar: {} },
    brand: { en: { a: XSS[0], b: XSS[2] }, ar: { a: XSS[3], b: XSS[4] }, logo: 'javascript:window.__pwned=1' },
    heroImage: XSS[8],
    contact: { whatsapp: '962700000000"><script>window.__pwned=1</script>', phone: XSS[0] },
    updatedAt: 1
  },
  'media/evil': { url: 'javascript:window.__pwned=1', at: 1 },
  'media/evil2': { url: 'data:text/html;base64,PHNjcmlwdD53aW5kb3cuX19wd25lZD0xPC9zY3JpcHQ+', at: 1 },
});

/* A fresh page per scenario, in one shared context.
   Navigating the same page between scenarios hung: the dashboard leaves
   unsaved work, the page's beforeunload guard asks to confirm, and the
   navigation never completes. Closing a page skips that handler, so each
   scenario gets a clean load without fighting the guard it is not testing. */
async function load(ctx, store, hash) {
  resetStore(store);
  const page = await ctx.newPage();
  await page.exposeFunction('__storeRead', async () => { try { return fs.readFileSync(STORE, 'utf8'); } catch { return '{}'; } });
  await page.exposeFunction('__storeWrite', async (t) => { fs.writeFileSync(STORE, t); return true; });
  await page.addInitScript(fs.readFileSync(path.join(__dirname, 'mock.js'), 'utf8'));
  page.errs = [];
  page.dialogs = 0;
  page.on('pageerror', e => page.errs.push(e.message));
  page.on('dialog', async d => { page.dialogs++; await d.dismiss(); });
  await page.goto(PAGE + hash, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4200);
  return page;
}

/* Every attribute of every element, so a script URL cannot hide in one. */
const dangerousAttributes = (page) => page.evaluate(() => {
  const bad = [];
  document.querySelectorAll('*').forEach((el) => {
    for (const a of Array.from(el.attributes)) {
      const v = String(a.value || '');
      if (/^\s*(javascript|vbscript|data:text\/html)/i.test(v)) bad.push(el.tagName + '[' + a.name + ']');
      if (/^on/i.test(a.name)) bad.push(el.tagName + '[' + a.name + ']');
    }
  });
  return bad;
});

const pwned = (page) => page.evaluate(() => !!window.__pwned);

(async () => {
  const b = await chromium.launch({ executablePath: EXECUTABLE });
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
  let page;

  /* 1 — the public page, rendering hostile content in both languages. */
  if (page) await page.close();
  page = await load(ctx, hostile(), '');
  check('public page: no script ran', (await pwned(page)) === false);
  check('public page: no dialog', page.dialogs === 0);
  check('public page: no errors thrown', page.errs.length === 0, page.errs.join(' | '));
  check('public page: the payload is shown as text',
    (await page.evaluate(() => document.body.innerText)).includes('<script>'));
  check('public page: no element carries a script URL or handler',
    (await dangerousAttributes(page)).length === 0,
    JSON.stringify(await dangerousAttributes(page)));
  check('public page: no frame or object was created',
    (await page.evaluate(() => document.querySelectorAll('iframe,object,embed').length)) === 0);

  await page.click('.lang-toggle button[data-lang="ar"]');
  await page.waitForTimeout(800);
  check('public page: still clean in Arabic',
    (await pwned(page)) === false && page.errs.length === 0 &&
    (await dangerousAttributes(page)).length === 0);

  /* 2 — the dashboard renders the same content into form controls. */
  if (page) await page.close();
  page = await load(ctx, hostile(), '#admin');
  for (const tab of ['menu', 'cats', 'brand', 'hero', 'text', 'hours', 'contact']) {
    await page.click(`#admin-root .ad-tab[data-tab="${tab}"]`).catch(() => {});
    await page.waitForTimeout(250);
  }
  check('dashboard: no script ran across every tab', (await pwned(page)) === false);
  check('dashboard: no dialog', page.dialogs === 0);
  check('dashboard: no errors thrown', page.errs.length === 0, page.errs.join(' | '));
  check('dashboard: no element carries a script URL or handler',
    (await dangerousAttributes(page)).length === 0,
    JSON.stringify(await dangerousAttributes(page)));

  /* 3 — an image reference the store resolves to a script URL is refused, and
     the built-in illustration is drawn instead. */
  if (page) await page.close();
  page = await load(ctx, hostile(), '');
  const srcs = await page.evaluate(() => Array.from(document.images).map(i => i.getAttribute('src') || ''));
  check('no img src carries a script URL',
    srcs.every(s => !/^javascript:/i.test(s) && !/^data:text\/html/i.test(s)), JSON.stringify(srcs));
  check('the illustration is drawn instead of the refused image',
    (await page.evaluate(() => document.querySelectorAll('.card-art svg use, .cat-ico svg use').length)) > 0);

  /* 4 — a path cannot be made to reach the prototype. */
  if (page) await page.close();
  page = await load(ctx, hostile(), '#admin');
  const polluted = await page.evaluate(() => {
    const root = document.getElementById('admin-root');
    const victim = root.querySelector('input[data-path]');
    if (!victim) return 'no control';
    victim.setAttribute('data-path', '__proto__.polluted');
    victim.removeAttribute('id');
    delete victim.__adPath;
    victim.value = 'yes';
    victim.dispatchEvent(new Event('input', { bubbles: true }));
    return ({}).polluted === undefined ? 'clean' : 'POLLUTED';
  });
  check('a __proto__ path writes nothing', polluted === 'clean', String(polluted));
  check('no errors from the attempt', page.errs.length === 0, page.errs.join(' | '));

  /* 5 — absurd numbers from the store still render. */
  if (page) await page.close();
  page = await load(ctx, hostile(), '');
  const price = await page.evaluate(() => {
    const el = document.querySelector('.price');
    return el ? el.textContent : '(none)';
  });
  check('a nonsense price still renders a number', /\d/.test(price), price);
  check('no errors from it', page.errs.length === 0, page.errs.join(' | '));

  /* 6 — a stored document of the wrong shape must not blank the page. */
  if (page) await page.close();
  page = await load(ctx, {
    'content/menu': { categories: ['not an object', null, 42], items: ['x', null], updatedAt: 1 },
    'content/site': { hours: 'nope', text: 'nope', brand: 'nope', heroImage: 42, contact: 'nope', updatedAt: 1 },
  }, '');
  check('a malformed document does not throw', page.errs.length === 0, page.errs.join(' | '));
  check('and the page still renders',
    (await page.evaluate(() => !!document.querySelector('#menu') && document.body.innerText.length > 200)) === true);

  /* 7 — and the dashboard survives it too. */
  if (page) await page.close();
  page = await load(ctx, {
    'content/menu': { categories: ['x'], items: [null, 7], updatedAt: 1 },
    'content/site': { brand: 42, contact: [], text: null, hours: [], heroImage: {}, updatedAt: 1 },
  }, '#admin');
  check('the dashboard opens on a malformed document', page.errs.length === 0, page.errs.join(' | '));
  check('and shows its tabs',
    (await page.evaluate(() => document.querySelectorAll('#admin-root .ad-tab').length)) === 7);

  await ctx.close();
  await b.close();
  console.log(fails ? `\n${fails} FAILED` : '\nAll content-safety checks passed');
  process.exit(fails ? 1 : 0);
})();
