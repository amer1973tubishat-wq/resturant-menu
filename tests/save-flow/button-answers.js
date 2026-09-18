/**
 * The Save button always answers.
 *
 * The database showed the previous round's symptom exactly: `meta/access-probe`
 * written at 10:57, `meta/last-save` untouched since 10:09. The page was
 * connected and writing, yet pressing Save left no trace at all — because the
 * press fell through a read-only guard and returned in silence. A control that
 * does nothing and says nothing is indistinguishable from a broken one.
 *
 * Each case here puts the dashboard in a state where saving cannot or should
 * not succeed, presses the button, and requires an answer: a visible message,
 * a record in the database, or a completed save. Never silence.
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

async function open(browser, { mock = {}, noClaude = false } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 } });
  const page = await ctx.newPage();
  await page.exposeFunction('__storeRead', async () => { try { return fs.readFileSync(STORE, 'utf8'); } catch { return '{}'; } });
  await page.exposeFunction('__storeWrite', async (t) => { fs.writeFileSync(STORE, t); return true; });
  await page.addInitScript(fs.readFileSync(path.join(__dirname, 'mock.js'), 'utf8'));
  if (noClaude) await page.addInitScript(() => { delete window.claude; });
  if (Object.keys(mock).length) {
    await page.addInitScript((m) => {
      window.addEventListener('DOMContentLoaded', () => Object.assign(window.__MOCK, m));
    }, mock);
  }
  page.errs = [];
  page.on('pageerror', e => page.errs.push(e.message));
  await page.goto(PAGE + '#admin');
  await page.waitForTimeout(4000);
  return { ctx, page };
}

/* Visible, opaque, unobstructed, and inside the window — the way a person
   judges whether a button is there. */
const btn = (page, sel) => page.evaluate((s) => {
  const el = document.querySelector(s);
  if (!el) return { present: false };
  const r = el.getBoundingClientRect();
  const cs = getComputedStyle(el);
  const mid = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
  return {
    present: true,
    disabled: el.disabled,
    text: el.textContent.trim(),
    inWindow: r.top >= 0 && r.bottom <= window.innerHeight,
    opacity: Number(cs.opacity),
    reachable: mid === el || el.contains(mid),
  };
}, sel);

const barText = (page) => page.$eval('#admin-root .ad-save p', el => el.textContent.trim()).catch(() => '(no bar)');

(async () => {
  const b = await chromium.launch({ executablePath: EXECUTABLE });

  /* 1 — a read-only viewer presses Save. */
  {
    resetStore(seeded());
    const { ctx, page } = await open(b, { mock: { canEdit: false } });
    const before = await btn(page, '#adSave');
    check('read-only: the button is there', before.present && before.inWindow, JSON.stringify(before));
    check('read-only: and clickable', before.disabled === false && before.reachable);
    check('read-only: the top button is there too', (await btn(page, '#adSaveTop')).present);

    await page.click('#adSave');
    await page.waitForTimeout(3000);
    const text = await barText(page);
    check('read-only: pressing it produces a message', text.length > 0 && text !== '(no bar)', text);
    /* No record is possible here and that is correct: a viewer the database
       refuses cannot write a diagnostic either. The on-screen answer is the
       whole guarantee. What must not happen is a content write. */
    check('read-only: nothing was written to the content',
      (readStore()['content/menu'] || {}).items[0].en.n === 'Item A',
      String((readStore()['content/menu'] || {}).items[0].en.n));
    check('read-only: the message names the reason', /cannot edit|صلاحية|لا يملك/.test(text), text);
    await ctx.close();
  }

  /* 2 — no database at all (the page opened outside the artifact runtime). */
  {
    resetStore(seeded());
    const { ctx, page } = await open(b, { noClaude: true });
    const s = await btn(page, '#adSave');
    check('no database: the button is still there', s.present && s.inWindow, JSON.stringify(s));
    check('no database: the bar says so up front', /No database|لا اتصال/.test(await barText(page)), await barText(page));
    await page.click('#adSave');
    await page.waitForTimeout(1500);
    check('no database: pressing it explains why', /No database|قاعدة البيانات/.test(await barText(page)), await barText(page));
    check('no database: no page errors', page.errs.length === 0, page.errs.join(' | '));
    await ctx.close();
  }

  /* 3 — a write that never answers must not leave the button dead. */
  {
    resetStore(seeded());
    const { ctx, page } = await open(b, { mock: { hangWrites: true } });
    await page.fill('#admin-root [data-path="items.0.en.n"]', 'Hangs');
    await page.waitForTimeout(300);
    await page.click('#adSave');
    await page.waitForTimeout(1200);
    check('hung write: the button shows it is working', /Saving|جارٍ/.test((await btn(page, '#adSave')).text));

    /* The page gives the database 20s; wait past that. */
    await page.waitForTimeout(21000);
    const after = await btn(page, '#adSave');
    check('hung write: the button comes back', after.disabled === false && /Save|حفظ/.test(after.text), JSON.stringify(after));
    check('hung write: and says what happened', /20 seconds|٢٠ ثانية/.test(await barText(page)), await barText(page));
    const kept = await page.$eval('#admin-root [data-path="items.0.en.n"]', el => el.value);
    check('hung write: the work is still on screen', kept === 'Hangs', kept);
    await ctx.close();
  }

  /* 4 — a branch that throws must not take the other buttons with it. */
  {
    resetStore(seeded());
    const { ctx, page } = await open(b);
    await page.evaluate(() => {
      /* Force the next click through a failing path, the way an unexpected
         exception inside one branch would. */
      const el = document.querySelector('#admin-root [data-path="items.0.en.n"]');
      Object.defineProperty(el, 'value', { get() { throw new Error('boom'); } });
    });
    await page.click('#admin-root .ad-tab[data-tab="hours"]');
    await page.waitForTimeout(600);
    check('one unreadable control does not stop the panel',
      /Opening hours|أوقات العمل/.test(
        await page.$eval('#admin-root .ad-wrap', el => el.textContent)));

    /* And the rest of the buttons keep working. */
    await page.click('#admin-root .ad-tab[data-tab="contact"]');
    await page.waitForTimeout(600);
    check('and the other buttons still respond',
      /WhatsApp|واتساب/.test(await page.$eval('#admin-root .ad-wrap', el => el.textContent)));

    await page.click('#admin-root .ad-tab[data-tab="menu"]');
    await page.waitForTimeout(600);
    await page.fill('#admin-root [data-path="items.0.price"]', '9');
    await page.waitForTimeout(300);
    await page.click('#adSave');
    await page.waitForTimeout(3000);
    check('and a save still goes through',
      (readStore()['content/menu'] || {}).items[0].price === 9,
      String((readStore()['content/menu'] || {}).items[0].price));
    await ctx.close();
  }

  /* 5 — a probe that fails once must not disable the dashboard for good. */
  {
    resetStore(seeded());
    const { ctx, page } = await open(b, { mock: { failWrites: true } });
    check('after a failed probe the save controls are present', (await btn(page, '#adSave')).present);
    await page.evaluate(() => { window.__MOCK.failWrites = false; });
    await page.waitForTimeout(9000);          /* the retries run 1.5s..6s apart */
    const pill = await page.$eval('#admin-root .ad-pill', el => el.textContent.trim());
    check('the probe retries and edit access is regained', /Editor access|صلاحية التعديل/.test(pill), pill);

    await page.fill('#admin-root [data-path="items.0.en.n"]', 'After retry');
    await page.waitForTimeout(300);
    await page.click('#adSave');
    await page.waitForTimeout(3000);
    check('and saving then works',
      (readStore()['content/menu'] || {}).items[0].en.n === 'After retry',
      String((readStore()['content/menu'] || {}).items[0].en.n));
    await ctx.close();
  }

  await b.close();
  console.log(fails ? `\n${fails} FAILED` : '\nAll button-answers checks passed');
  process.exit(fails ? 1 : 0);
})();
