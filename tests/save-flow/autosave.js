/**
 * Work reaches the database without the button.
 *
 * Four rounds of "it does not save" ended in the same record, and the last one
 * settled what it meant: `dirty: false` together with `touched: "(none)"`.
 * Every route from a keystroke to the draft goes through markTouched, so that
 * pair says nothing had been typed in the page load that pressed Save. The
 * typing was in an earlier page load — the artifact had reloaded in between —
 * and the new one had read the stored value back. No button can fix that; by
 * the time it is pressed the work is in a page that no longer exists.
 *
 * So the write no longer waits for the button. It happens about a second after
 * the typing stops, immediately when a field is left, and again when the page
 * is hidden or unloaded. These tests hold that guarantee, with the mock in its
 * most hostile mode: documents handed out by reference (shareReads) and
 * refreshes arriving mid-edit.
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

const seeded = () => ({
  'content/menu': {
    categories: [
      { id: 'burgers', icon: 'burger', img: '', en: { n: 'Burgers', t: '' }, ar: { n: 'برجر', t: '' } },
      { id: 'drinks', icon: 'i-juice', img: '', en: { n: 'Drinks', t: '' }, ar: { n: 'مشروبات', t: '' } }
    ],
    items: [{ id: 'a', cat: 'burgers', price: 5, spice: 0, badge: null, img: '', en: { n: 'Item A', d: '' }, ar: { n: 'أ', d: '' } }],
    updatedAt: 1
  },
  'content/site': {
    hours: Array.from({ length: 7 }, () => ({ o: 720, c: 1500 })),
    text: { en: {}, ar: {} },
    brand: { en: { a: 'BAYTNA', b: 'BURGER' }, ar: { a: 'بيتنا', b: 'برجر' }, logo: '' },
    heroImage: '',
    contact: { whatsapp: '962790000000', phone: '+962 7 9000 0000' },
    updatedAt: 1
  }
});

async function open(browser, { mock = {}, arabic = false } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  await page.exposeFunction('__storeRead', async () => { try { return fs.readFileSync(STORE, 'utf8'); } catch { return '{}'; } });
  await page.exposeFunction('__storeWrite', async (t) => { fs.writeFileSync(STORE, t); return true; });
  await page.addInitScript(fs.readFileSync(path.join(__dirname, 'mock.js'), 'utf8'));
  await page.addInitScript((m) => {
    window.addEventListener('DOMContentLoaded', () => Object.assign(window.__MOCK, m));
  }, Object.assign({ shareReads: true }, mock));
  if (arabic) await page.addInitScript(() => { try { localStorage.setItem('baytna-lang', 'ar'); } catch (e) {} });
  page.errs = [];
  page.on('pageerror', e => page.errs.push(e.message));
  await page.goto(PAGE + '#admin');
  await page.waitForTimeout(4200);
  return { ctx, page };
}

const brandAr = () => ((readStore()['content/site'] || {}).brand || {}).ar?.a;
const itemName = () => (readStore()['content/menu'] || {}).items?.[0]?.en?.n;
const shown = (page, sel) => page.$eval(sel, el => el.value).catch(() => '(absent)');
const barText = (page) => page.$eval('#admin-root .ad-save p', el => el.textContent.trim()).catch(() => '(no bar)');

(async () => {
  const b = await chromium.launch({ executablePath: EXECUTABLE });

  /* 1 — the reported flow: rename the restaurant in Arabic, with the store
     refreshing its own documents underneath. */
  {
    resetStore(seeded());
    const { ctx, page } = await open(b, { arabic: true });
    await page.click('#admin-root .ad-tab[data-tab="brand"]');
    await page.waitForTimeout(600);

    const sel = '#admin-root [data-path="brand.ar.a"]';
    await page.click(sel);
    await page.keyboard.press('Control+A');
    await page.keyboard.type('مطعمي', { delay: 30 });
    await page.waitForTimeout(300);

    /* The refresh that used to overwrite the typing in place. */
    await page.evaluate(() => window.__MOCK.forceNotify());
    await page.waitForTimeout(700);
    check('a store refresh does not overwrite the typing', await shown(page, sel) === 'مطعمي', await shown(page, sel));

    await page.waitForTimeout(2500);        /* auto-save, no button pressed */
    check('the new name reaches the database on its own', brandAr() === 'مطعمي', String(brandAr()));
    check('and the field still shows it', await shown(page, sel) === 'مطعمي', await shown(page, sel));
    check('no page errors', page.errs.length === 0, page.errs.join(' | '));
    await ctx.close();
  }

  /* 2 — the same, but the name is typed and the button pressed immediately. */
  {
    resetStore(seeded());
    const { ctx, page } = await open(b, { arabic: true });
    await page.click('#admin-root .ad-tab[data-tab="brand"]');
    await page.waitForTimeout(600);
    const sel = '#admin-root [data-path="brand.ar.a"]';
    await page.fill(sel, 'اسم جديد');
    await page.click('#adSave');
    await page.waitForTimeout(3000);
    check('pressing Save still saves', brandAr() === 'اسم جديد', String(brandAr()));
    check('and the field is not rebuilt back to the old value',
      await shown(page, sel) === 'اسم جديد', await shown(page, sel));
    await ctx.close();
  }

  /* 3 — typing, then a refresh, then a tab change: the edit survives all of
     it, which is the sequence the user described. */
  {
    resetStore(seeded());
    const { ctx, page } = await open(b);
    await page.fill('#admin-root [data-path="items.0.en.n"]', 'Survivor');
    await page.evaluate(() => window.__MOCK.forceNotify());
    await page.waitForTimeout(500);
    await page.click('#admin-root .ad-tab[data-tab="cats"]');
    await page.waitForTimeout(500);
    await page.click('#admin-root .ad-tab[data-tab="menu"]');
    await page.waitForTimeout(2600);
    check('an edit survives a refresh and two tab changes',
      itemName() === 'Survivor', String(itemName()));
    await ctx.close();
  }

  /* 4 — an edit made while the store is being written to by someone else. */
  {
    resetStore(seeded());
    const { ctx, page } = await open(b);
    await page.fill('#admin-root [data-path="items.0.en.n"]', 'Mine');

    const store = readStore();
    store['content/site'].contact.phone = 'theirs';
    fs.writeFileSync(STORE, JSON.stringify(store, null, 1));
    await page.evaluate(() => window.__MOCK.forceNotify());
    await page.waitForTimeout(3000);

    check('my edit is saved', itemName() === 'Mine', String(itemName()));
    check("their field is untouched",
      (readStore()['content/site'] || {}).contact.phone === 'theirs',
      String((readStore()['content/site'] || {}).contact.phone));
    await ctx.close();
  }

  /* 5a — leaving a field commits it at once, with no timer and no button. */
  {
    resetStore(seeded());
    const { ctx, page } = await open(b);
    await page.fill('#admin-root [data-path="items.0.en.n"]', 'On Blur');
    await page.click('#admin-root .ad-bar h1');      /* click away */
    await page.waitForTimeout(1200);                 /* shorter than the timer */
    check('leaving a field writes it immediately', itemName() === 'On Blur', String(itemName()));
    await ctx.close();
  }

  /* 5b — hiding the page writes what is pending. */
  {
    resetStore(seeded());
    const { ctx, page } = await open(b);
    await page.fill('#admin-root [data-path="items.0.en.n"]', 'On Hide');
    await page.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await page.waitForTimeout(1500);
    check('hiding the page writes the pending edit', itemName() === 'On Hide', String(itemName()));
    await ctx.close();
  }

  /* 5c — and the work is there after a full reload, which is the failure the
     user actually hit. */
  {
    resetStore(seeded());
    const { ctx, page } = await open(b, { arabic: true });
    await page.click('#admin-root .ad-tab[data-tab="brand"]');
    await page.waitForTimeout(500);
    await page.fill('#admin-root [data-path="brand.ar.a"]', 'يبقى بعد التحديث');
    await page.waitForTimeout(2400);
    await page.reload();
    await page.waitForTimeout(4200);
    await page.click('#admin-root .ad-tab[data-tab="brand"]');
    await page.waitForTimeout(600);
    check('the new name is still there after a reload',
      await shown(page, '#admin-root [data-path="brand.ar.a"]') === 'يبقى بعد التحديث',
      await shown(page, '#admin-root [data-path="brand.ar.a"]'));
    check('and the public page shows it',
      /يبقى بعد التحديث/.test(await page.evaluate(() => {
        const el = document.querySelector('.brand-name');
        return el ? el.textContent : '';
      })));
    await ctx.close();
  }

  /* 5 — the resting bar tells the user saving is automatic. */
  {
    resetStore(seeded());
    const { ctx, page } = await open(b);
    check('the bar says saving is automatic',
      /saving is automatic|الحفظ تلقائي/.test(await barText(page)), await barText(page));
    await ctx.close();
  }

  /* 6 — auto-save writes once for a burst of typing, not once per keystroke. */
  {
    resetStore(seeded());
    const { ctx, page } = await open(b);
    await page.evaluate(() => { window.__MOCK.writeLog.length = 0; });
    await page.click('#admin-root [data-path="items.0.en.n"]');
    await page.keyboard.press('Control+A');
    await page.keyboard.type('Debounced Name', { delay: 20 });
    await page.waitForTimeout(3000);
    const contentWrites = await page.evaluate(() =>
      window.__MOCK.writeLog.filter(w => w.path.indexOf('content/') === 0).length);
    check('one burst of typing is one write', contentWrites <= 2, `writes=${contentWrites}`);
    check('and it landed', itemName() === 'Debounced Name', String(itemName()));
    await ctx.close();
  }

  /* 7 — deleting an item saves itself too, and stays deleted. */
  {
    resetStore(seeded());
    const { ctx, page } = await open(b);
    await page.click('#admin-root [data-del="0"]');
    await page.waitForTimeout(3000);
    check('a deletion reaches the database without a button',
      (readStore()['content/menu'] || {}).items.length === 0,
      String((readStore()['content/menu'] || {}).items.length));
    await page.evaluate(() => window.__MOCK.forceNotify());
    await page.waitForTimeout(800);
    check('and a refresh does not bring it back',
      (readStore()['content/menu'] || {}).items.length === 0,
      String((readStore()['content/menu'] || {}).items.length));
    await ctx.close();
  }

  await b.close();
  console.log(fails ? `\n${fails} FAILED` : '\nAll autosave checks passed');
  process.exit(fails ? 1 : 0);
})();
