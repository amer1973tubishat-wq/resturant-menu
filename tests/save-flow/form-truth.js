/**
 * The form on screen is what gets saved.
 *
 * The live database recorded six consecutive save attempts as
 * outcome "nothing", detail "no field differed from the loaded copy", with
 * dirty false and nothing touched — the dashboard was telling the truth about
 * its own model, which simply never received the typing. Every test here
 * starts from an edit that exists only in the DOM, which is the state the
 * database caught, and demands that a save still write it.
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
    categories: [{ id: 'burgers', icon: 'i-burger', img: '', en: { n: 'Burgers', t: '' }, ar: { n: 'برجر', t: '' } }],
    items: [{ id: 'a', cat: 'burgers', price: 5, spice: 0, badge: null, img: '', en: { n: 'Item A', d: '' }, ar: { n: 'أ', d: '' } }],
    updatedAt: 1
  },
  'content/site': {
    hours: Array.from({ length: 7 }, () => ({ o: 600, c: 1400 })),
    text: { en: {}, ar: {} },
    brand: { en: { a: 'S', b: 'B' }, ar: { a: 'س', b: 'ب' }, logo: '' },
    heroImage: '',
    contact: { whatsapp: '962700000000', phone: 'stored' },
    updatedAt: 1
  }
});

async function open(browser, { width = 1400, height = 900 } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height } });
  const page = await ctx.newPage();
  await page.exposeFunction('__storeRead', async () => { try { return fs.readFileSync(STORE, 'utf8'); } catch { return '{}'; } });
  await page.exposeFunction('__storeWrite', async (t) => { fs.writeFileSync(STORE, t); return true; });
  await page.addInitScript(fs.readFileSync(path.join(__dirname, 'mock.js'), 'utf8'));
  page.errs = [];
  page.on('pageerror', e => page.errs.push(e.message));
  await page.goto(PAGE + '#admin');
  await page.waitForTimeout(4000);
  return { ctx, page };
}

/* Types into a control the way a browser that never delivered the event
   would leave it: the text is on screen, nothing else heard about it. */
async function typeSilently(page, selector, value) {
  await page.evaluate(({ s, v }) => {
    const el = document.querySelector(s);
    el.value = v;                       // no input/change event dispatched
  }, { s: selector, v: value });
}

async function saveAndWait(page) {
  await page.click('#adSave');
  await page.waitForTimeout(2500);
}

const itemName = () => (readStore()['content/menu'] || {}).items?.[0]?.en?.n;

(async () => {
  const b = await chromium.launch({ executablePath: EXECUTABLE });

  /* 1 — the recorded failure: an edit that only the DOM knows about. */
  {
    resetStore(seeded());
    const { ctx, page } = await open(b);
    await typeSilently(page, '#admin-root [data-path="items.0.en.n"]', 'Silent Edit');
    await saveAndWait(page);
    check('an edit that fired no input event is still saved', itemName() === 'Silent Edit', String(itemName()));

    const note = readStore()['meta/last-save'] || {};
    check('the attempt is recorded as a real save', note.outcome === 'ok', JSON.stringify(note.outcome));
    check('the record says the form was read back', note.formFields > 0, `formFields=${note.formFields}`);
    check('the record says which controls are bound', note.bound > 0, `bound=${note.bound}`);
    await ctx.close();
  }

  /* 2 — a store refresh must not wipe the form under the user. */
  {
    resetStore(seeded());
    const { ctx, page } = await open(b);
    await typeSilently(page, '#admin-root [data-path="items.0.en.n"]', 'Survives Refresh');
    await page.evaluate(() => window.__MOCK.forceNotify());
    await page.waitForTimeout(900);
    const onScreen = await page.$eval('#admin-root [data-path="items.0.en.n"]', el => el.value);
    check('a background refresh leaves the typing on screen', onScreen === 'Survives Refresh', onScreen);
    await saveAndWait(page);
    check('and the refresh did not cost the edit', itemName() === 'Survives Refresh', String(itemName()));
    await ctx.close();
  }

  /* 3 — a rebuild for another reason (tab change) keeps the edit too. */
  {
    resetStore(seeded());
    const { ctx, page } = await open(b);
    await typeSilently(page, '#admin-root [data-path="items.0.en.n"]', 'Across Tabs');
    await page.click('#admin-root .ad-tab[data-tab="contact"]');
    await page.waitForTimeout(400);
    await page.click('#admin-root .ad-tab[data-tab="menu"]');
    await page.waitForTimeout(400);
    const back = await page.$eval('#admin-root [data-path="items.0.en.n"]', el => el.value);
    check('switching tabs and back keeps the edit', back === 'Across Tabs', back);
    await saveAndWait(page);
    check('and it reaches the database', itemName() === 'Across Tabs', String(itemName()));
    await ctx.close();
  }

  /* 4 — real typing still works, and still reports honestly. */
  {
    resetStore(seeded());
    const { ctx, page } = await open(b);
    const sel = '#admin-root [data-path="items.0.en.n"]';
    await page.click(sel);
    await page.keyboard.press('Control+A');
    await page.keyboard.type('Typed Normally', { delay: 25 });
    await page.waitForTimeout(300);
    const dot = await page.$eval('#adSave', el => !!el.querySelector('.ad-dot'));
    check('typing marks the work unsaved', dot === true);
    await saveAndWait(page);
    check('typing is saved', itemName() === 'Typed Normally', String(itemName()));
    await ctx.close();
  }

  /* 5 — revert must not resurrect what it discarded. */
  {
    resetStore(seeded());
    const { ctx, page } = await open(b);
    await typeSilently(page, '#admin-root [data-path="items.0.en.n"]', 'Unwanted');
    await page.evaluate(() => { document.querySelector('#adRevert').disabled = false; });
    await page.click('#adRevert');
    await page.waitForTimeout(2000);
    const shown = await page.$eval('#admin-root [data-path="items.0.en.n"]', el => el.value);
    check('revert clears the unwanted edit from the form', shown === 'Item A', shown);
    await saveAndWait(page);
    check('revert leaves the database untouched', itemName() === 'Item A', String(itemName()));
    await ctx.close();
  }

  /* 6 — an untouched field still belongs to whoever last wrote it. */
  {
    resetStore(seeded());
    const { ctx, page } = await open(b);
    await typeSilently(page, '#admin-root [data-path="items.0.en.n"]', 'Mine');

    const store = readStore();
    store['content/site'].contact.phone = 'written elsewhere';
    fs.writeFileSync(STORE, JSON.stringify(store, null, 1));
    await page.evaluate(() => window.__MOCK.forceNotify());
    await page.waitForTimeout(800);

    await saveAndWait(page);
    check('my edit is saved', itemName() === 'Mine', String(itemName()));
    check('a field I never touched is not overwritten',
      (readStore()['content/site'] || {}).contact.phone === 'written elsewhere',
      String((readStore()['content/site'] || {}).contact.phone));
    check('no page errors', page.errs.length === 0, page.errs.join(' | '));
    await ctx.close();
  }

  /* 7 — nothing typed still means nothing written, honestly reported. */
  {
    resetStore(seeded());
    const { ctx, page } = await open(b);
    await saveAndWait(page);
    const note = readStore()['meta/last-save'] || {};
    check('an untouched form reports nothing to save', note.outcome === 'nothing', String(note.outcome));
    check('and says so on screen', /Nothing to save|لا توجد تغييرات/.test(
      await page.$eval('#admin-root .ad-save p', el => el.textContent)));
    check('without writing content', itemName() === 'Item A', String(itemName()));
    await ctx.close();
  }

  /* 8 — keys the store has never held render empty, and an empty box is not
     an edit. Reading the form back must not invent changes out of absence. */
  {
    const sparse = seeded();
    delete sparse['content/site'].contact;
    delete sparse['content/site'].text;
    delete sparse['content/menu'].items[0].en.d;
    resetStore(sparse);
    const { ctx, page } = await open(b);
    await page.click('#admin-root .ad-tab[data-tab="contact"]');
    await page.waitForTimeout(500);
    const bar = await page.$eval('#admin-root .ad-save p', el => el.textContent);
    check('absent keys do not read as unsaved work', /All changes saved|كل التعديلات/.test(bar), bar);
    check('no unsaved dot on a sparse store', await page.$eval('#adSave', el => !el.querySelector('.ad-dot')));

    await saveAndWait(page);
    const note = readStore()['meta/last-save'] || {};
    check('saving a sparse store finds nothing to write', note.outcome === 'nothing', String(note.outcome));
    await ctx.close();
  }

  await b.close();
  console.log(fails ? `\n${fails} FAILED` : '\nAll form-truth checks passed');
  process.exit(fails ? 1 : 0);
})();
