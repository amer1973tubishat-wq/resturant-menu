/**
 * Everything on the site is editable from the dashboard, and an edit reaches
 * the page people see.
 *
 * Before this, 41 of the site's 64 strings were literals in the file — the
 * navigation, the hero buttons, the story, the whole footer, the opening
 * status, the currency — along with the ingredient chips, the badge wording and every social link. They
 * could only be changed by editing the page.
 *
 * The first test is the one that keeps it true: every data-i18n key in the
 * markup must be reachable from the Text tab. Add a string to the page without
 * exposing it and this fails immediately, rather than being noticed months
 * later by someone who cannot change their own menu.
 */
const { STORE, resetStore, readStore, chromium, EXECUTABLE, ADMIN_HASH } = require('./harness');
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
    items: [{ id: 'a', cat: 'burgers', price: 5, spice: 0, badge: 'best', img: '', en: { n: 'Item A', d: 'd' }, ar: { n: 'أ', d: 'و' } }],
    updatedAt: 1
  },
  'content/site': {
    hours: Array.from({ length: 7 }, () => ({ o: 600, c: 1400 })),
    text: { en: {}, ar: {} },
    brand: { en: { a: 'S', b: 'B' }, ar: { a: 'س', b: 'ب' }, logo: '' },
    heroImage: '', contact: { whatsapp: '962700000000', phone: '+962 7 1111111' },
    updatedAt: 1
  }
});

async function load(ctx, store, hash) {
  resetStore(store);
  const page = await ctx.newPage();
  await page.exposeFunction('__storeRead', async () => { try { return fs.readFileSync(STORE, 'utf8'); } catch { return '{}'; } });
  await page.exposeFunction('__storeWrite', async (t) => { fs.writeFileSync(STORE, t); return true; });
  await page.addInitScript(fs.readFileSync(path.join(__dirname, 'mock.js'), 'utf8'));
  page.errs = [];
  page.on('pageerror', e => page.errs.push(e.message));
  await page.goto(PAGE + hash, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4200);
  return page;
}

const tab = async (page, name) => {
  await page.click(`#admin-root .ad-tab[data-tab="${name}"]`);
  await page.waitForTimeout(400);
};
const setField = async (page, selector, value) => {
  await page.fill(selector, value);
  await page.waitForTimeout(2400);          /* let the auto-save land */
};

(async () => {
  /* 1 — no string on the page may be unreachable from the dashboard. */
  {
    const src = fs.readFileSync(SRC, 'utf8');
    const inMarkup = [...new Set([...src.matchAll(/data-i18n="([^"]+)"/g)].map(m => m[1]))];
    const groups = src.slice(src.indexOf('var TEXT_GROUPS = ['), src.indexOf('var TEXT_LABEL'));
    const exposed = new Set([...groups.matchAll(/'([a-z0-9_]+)'/g)].map(m => m[1]));
    const missing = inMarkup.filter(k => !exposed.has(k));
    check('every string in the markup is editable', missing.length === 0, missing.join(', '));

    /* And every key the dashboard offers must actually exist in the page's
       own strings, or it is a field that edits nothing. */
    /* Keys share lines in T, so match every identifier followed by a colon
       inside the block rather than one per line. */
    const tblock = src.slice(src.indexOf('var T = {'), src.indexOf("var lang = 'en';"));
    const known = new Set([...tblock.matchAll(/([A-Za-z_][A-Za-z0-9_]*)\s*:/g)].map(m => m[1]));
    const synthetic = new Set(['badge_best', 'badge_chef', 'badge_spicy', 'badge_veg']);
    const offered = [...exposed].filter(k => !known.has(k) && !synthetic.has(k));
    check('every field the dashboard offers edits a real string', offered.length === 0, offered.join(', '));
  }

  const b = await chromium.launch({ executablePath: EXECUTABLE });
  const ctx = await b.newContext({ viewport: { width: 1280, height: 950 } });
  let page;

  /* 2 — a navigation label, which used to be a literal. */
  page = await load(ctx, seeded(), ADMIN_HASH);
  await tab(page, 'text');
  await setField(page, '#admin-root [data-path="text.en.nav_menu"]', 'Our Food');
  check('a nav label is stored', (readStore()['content/site'].text.en.nav_menu) === 'Our Food');
  await page.close();

  page = await load(ctx, readStore(), '');
  check('and the site shows it',
    (await page.$eval('.nav-links a[href="#menu"]', el => el.textContent.trim())) === 'Our Food');
  await page.close();

  /* 3 — the build-your-own section was removed at the owner's request: not
     on the site, not in the dashboard — but options already saved are kept,
     not deleted, by an unrelated save. */
  {
    const st = seeded();
    st['content/site'].steps = [{ key: 'bun', multi: false, en: 'Bun', ar: 'الخبز',
      opts: [{ id: 'brioche', p: 0.4, en: { n: 'Brioche' }, ar: { n: 'بريوش' } }] }];
    page = await load(ctx, st, '');
    check('the site has no builder section', (await page.$('#build')) === null);
    check('and nothing links to it', (await page.$('a[href="#build"]')) === null);
    check('the menu cards have no builder button', (await page.$('[data-add]')) === null);
    await page.close();

    page = await load(ctx, st, ADMIN_HASH);
    check('the dashboard has no Builder tab', (await page.$('#admin-root [data-tab="build"]')) === null);
    await tab(page, 'text');
    await setField(page, '#admin-root [data-path="text.en.nav_menu"]', 'Food');
    const kept = readStore()['content/site'].steps;
    check('saved builder options survive another save',
      Array.isArray(kept) && kept[0] && kept[0].opts[0].p === 0.4, JSON.stringify(kept));
    await page.close();
  }

  /* 4 — the ingredient chips, edited as a list. */
  page = await load(ctx, seeded(), ADMIN_HASH);
  await tab(page, 'text');
  await setField(page, '#admin-root [data-list="ings.en"]', 'Olive oil\nSea salt\nSumac');
  check('the ingredient list is stored',
    (readStore()['content/site'].ings.en || []).join('|') === 'Olive oil|Sea salt|Sumac',
    JSON.stringify(readStore()['content/site'].ings.en));
  await page.close();

  page = await load(ctx, readStore(), '');
  check('and the chips show it',
    (await page.$$eval('.ing', els => els.map(e => e.textContent).join('|'))) === 'Olive oil|Sea salt|Sumac');
  await page.close();

  /* 5 — a social link appears when set and disappears when cleared. */
  page = await load(ctx, seeded(), '');
  check('an unset social link is hidden',
    (await page.$eval('.soc[aria-label="Instagram"]', el => el.hidden)) === true);
  await page.close();

  page = await load(ctx, seeded(), ADMIN_HASH);
  await tab(page, 'contact');
  await setField(page, '#admin-root [data-path="links.instagram"]', 'https://instagram.com/baytna');
  await page.close();

  page = await load(ctx, readStore(), '');
  const ig = await page.$eval('.soc[aria-label="Instagram"]', el => ({ href: el.getAttribute('href'), hidden: el.hidden, rel: el.getAttribute('rel') }));
  check('a set social link is shown', ig.hidden === false && ig.href === 'https://instagram.com/baytna', JSON.stringify(ig));
  check('and it opens safely', ig.rel === 'noopener noreferrer', String(ig.rel));
  await page.close();

  /* 6 — a badge label, previously fixed wording. */
  page = await load(ctx, seeded(), ADMIN_HASH);
  await tab(page, 'text');
  await setField(page, '#admin-root [data-path="text.en.badge_best"]', 'House Favourite');
  await page.close();

  page = await load(ctx, readStore(), '');
  check('a badge uses the new wording',
    (await page.$eval('.card-badge', el => el.textContent.trim())) === 'House Favourite');
  await page.close();

  /* 7 — the currency, read while rendering rather than swapped into an
     element, so it exercises the other override path. */
  page = await load(ctx, seeded(), ADMIN_HASH);
  await tab(page, 'text');
  await setField(page, '#admin-root [data-path="text.en.cur"]', 'USD');
  await page.close();

  page = await load(ctx, readStore(), '');
  check('the currency changes on the cards',
    /USD/.test(await page.$eval('.price', el => el.textContent)),
    await page.$eval('.price', el => el.textContent));
  await page.close();

  /* 8 — the palette, which recolours the whole site. */
  page = await load(ctx, seeded(), ADMIN_HASH);
  await tab(page, 'theme');
  check('the colours tab offers the palette',
    (await page.$('#admin-root [data-path="theme.flame"]')) !== null);
  await page.evaluate(() => {
    const el = document.querySelector('#admin-root [data-path="theme.flame"]');
    el.value = '#00aa88';
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await page.waitForTimeout(2600);
  check('a colour applies at once, before any reload',
    (await page.evaluate(() => document.documentElement.style.getPropertyValue('--flame').trim())) === '#00aa88');
  check('and is stored', (readStore()['content/site'].theme || {}).flame === '#00aa88',
    JSON.stringify(readStore()['content/site'].theme));
  await page.close();

  page = await load(ctx, readStore(), '');
  check('the public page opens in the new colour',
    (await page.evaluate(() => document.documentElement.style.getPropertyValue('--flame').trim())) === '#00aa88');
  await page.close();

  /* A colour that is not a colour never reaches the style engine. */
  {
    const store = readStore();
    store['content/site'].theme = { flame: 'red; background:url(x)', gold: 'javascript:1', red: '', bg: '#112233' };
    page = await load(ctx, store, '');
    const applied = await page.evaluate(() => ({
      flame: document.documentElement.style.getPropertyValue('--flame'),
      gold: document.documentElement.style.getPropertyValue('--gold'),
      bg: document.documentElement.style.getPropertyValue('--char-900').trim(),
    }));
    check('a stored value that is not a hex colour is ignored',
      applied.flame === '' && applied.gold === '', JSON.stringify(applied));
    check('while a valid one still applies', applied.bg === '#112233', JSON.stringify(applied));
    check('no errors from it', page.errs.length === 0, page.errs.join(' | '));
    await page.close();
  }

  /* 10 — the location: the Google Maps link, and a picture of the map in
     place of the drawn one. */
  {
    const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
    const MAPS = 'https://maps.app.goo.gl/abc123';
    page = await load(ctx, seeded(), ADMIN_HASH);
    await tab(page, 'location');
    check('the Location tab offers the map picture',
      (await page.$('#admin-root [data-upload="mapImage"]')) !== null);
    check('the map link is edited there, not in Contact',
      (await page.$('#admin-root [data-path="links.maps"]')) !== null);
    await setField(page, '#admin-root [data-path="links.maps"]', MAPS);
    await setField(page, '#admin-root [data-path="mapImage"]', PNG);
    await setField(page, '#admin-root [data-path="text.en.map_addr"]', 'King Hussein St, Amman');
    const st = readStore()['content/site'];
    check('the map link is stored', (st.links || {}).maps === MAPS, JSON.stringify(st.links));
    check('the map picture is stored', st.mapImage === PNG, String(st.mapImage).slice(0, 40));
    check('the address is stored', (st.text.en || {}).map_addr === 'King Hussein St, Amman');
    await tab(page, 'contact');
    check('Contact no longer carries the map link',
      (await page.$('#admin-root [data-path="links.maps"]')) === null);
    await page.close();

    page = await load(ctx, readStore(), '');
    const site = await page.evaluate(() => {
      const img = document.querySelector('#mapCard .map-photo');
      return {
        src: img && !img.hidden ? img.getAttribute('src') : '',
        svgHidden: getComputedStyle(document.querySelector('#mapCard .map-svg')).display === 'none',
        dir: document.getElementById('directions').getAttribute('href'),
        open: document.getElementById('mapOpen').getAttribute('href'),
        addr: document.querySelector('[data-i18n="map_addr"]').textContent,
      };
    });
    check('the site shows the map picture', site.src === PNG);
    check('in place of the drawn map', site.svgHidden);
    check('directions open the stored link', site.dir === MAPS, site.dir);
    check('and so does tapping the map', site.open === MAPS, site.open);
    check('the map label shows the address', site.addr === 'King Hussein St, Amman', site.addr);
    await page.close();

    page = await load(ctx, readStore(), ADMIN_HASH);
    await tab(page, 'location');
    await page.click('#admin-root [data-clearimg="mapImage"]');
    await page.waitForTimeout(2400);
    check('clearing the picture is stored', readStore()['content/site'].mapImage === '');
    await page.close();
    page = await load(ctx, readStore(), '');
    check('and the drawn map comes back', await page.evaluate(() => {
      const img = document.querySelector('#mapCard .map-photo');
      return (!img || img.hidden) && getComputedStyle(document.querySelector('#mapCard .map-svg')).display !== 'none';
    }));
    await page.close();
  }

  /* 11 — Upload really stores the picture. The URL box beside it used to hand
     its old value back at the next render, undoing every upload and Clear. */
  {
    const file = path.join(process.env.TMPDIR || '/tmp', 'baytna-map-test.png');
    fs.writeFileSync(file, Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAIAAAAmkwkpAAAAEklEQVR4nGP4z8DAwMDAxAAAHxcCBQWqpWAAAAAASUVORK5CYII=', 'base64'));
    for (const [tabName, p] of [['location', 'mapImage'], ['hero', 'heroImage']]) {
      page = await load(ctx, seeded(), ADMIN_HASH);
      await tab(page, tabName);
      const [chooser] = await Promise.all([
        page.waitForEvent('filechooser'),
        page.click(`#admin-root [data-upload="${p}"]`),
      ]);
      await chooser.setFiles(file);
      await page.waitForTimeout(3500);
      const st = readStore();
      const id = st['content/site'][p];
      check(`an uploaded ${p} is stored`, typeof id === 'string' && /^m/.test(id), String(id));
      check(`and its picture is in the database`, !!(st['media/' + id] && /^data:image\//.test(st['media/' + id].url)));
      await page.close();
    }
    page = await load(ctx, readStore(), '');
    check('the uploaded hero picture shows on the site',
      await page.evaluate(() => { const i = document.querySelector('.hero-photo'); return !!(i && !i.hidden && /^data:image\//.test(i.src)); }));
    await page.close();
  }

  /* 9 — the phone number drives the link, not just the text. */
  page = await load(ctx, seeded(), '');
  const tel = await page.$eval('.vmeta a[href^="tel:"]', el => el.getAttribute('href'));
  check('the visit panel calls the stored number', tel === 'tel:+9627111111' || tel === 'tel:+96271111111', String(tel));
  check('no page errors anywhere', page.errs.length === 0, page.errs.join(' | '));
  await page.close();

  await ctx.close();
  await b.close();
  console.log(fails ? `\n${fails} FAILED` : '\nAll editable-surface checks passed');
  process.exit(fails ? 1 : 0);
})();
