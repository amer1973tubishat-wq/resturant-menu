/**
 * The dashboard's password.
 *
 * The owner's claude.ai account is the real access control; this is the lock
 * screen in front of the open dashboard. These checks hold what it promises:
 * the password is never stored, the panel shows nothing until it is entered,
 * a wrong one is refused and repeated guesses are slowed, locking keeps the
 * work, idle time locks it, and a damaged record locks rather than opens.
 */
const { STORE, resetStore, readStore, chromium, EXECUTABLE, ADMIN_HASH } = require('./harness');
const fs = require('fs');
const path = require('path');
const PAGE = 'file://' + path.resolve(__dirname, '..', '..', 'index.html');

let fails = 0;
const check = (n, ok, extra = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${extra ? ' — ' + extra : ''}`);
  if (!ok) fails++;
};

const PW = 'Shatta-2026!';
const seeded = () => ({
  'content/menu': {
    categories: [{ id: 'burgers', icon: 'burger', img: '', en: { n: 'Burgers', t: '' }, ar: { n: 'برجر', t: '' } }],
    items: [{ id: 'a', cat: 'burgers', price: 5, spice: 0, badge: null, img: '', en: { n: 'Secret Item', d: '' }, ar: { n: 'سري', d: '' } }],
    updatedAt: 1
  },
  'content/site': {
    hours: Array.from({ length: 7 }, () => ({ o: 600, c: 1400 })),
    text: { en: {}, ar: {} }, brand: { en: { a: 'S', b: 'B' }, ar: { a: 'س', b: 'ب' }, logo: '' },
    heroImage: '', contact: { whatsapp: '962700000000', phone: 'p' }, updatedAt: 1
  }
});

async function load(ctx, store, opts = {}) {
  if (store) resetStore(store);
  const page = await ctx.newPage();
  await page.exposeFunction('__storeRead', async () => { try { return fs.readFileSync(STORE, 'utf8'); } catch { return '{}'; } });
  await page.exposeFunction('__storeWrite', async (t) => { fs.writeFileSync(STORE, t); return true; });
  if (opts.clock) await page.clock.install();
  await page.addInitScript(fs.readFileSync(path.join(__dirname, 'mock.js'), 'utf8'));
  page.errs = [];
  page.on('pageerror', e => page.errs.push(e.message));
  await page.goto(PAGE + ADMIN_HASH, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4200);
  return page;
}

const state = (page) => page.evaluate(() => {
  const root = document.getElementById('admin-root');
  return {
    login: !!document.getElementById('adLogin'),
    fields: root.querySelectorAll('[data-path]').length,
    text: root.textContent,
    msg: (document.querySelector('.ad-lock-msg') || {}).textContent || '',
  };
});
const signIn = async (page, pw) => {
  await page.fill('#adPw', pw);
  await page.click('#adLoginBtn');
  await page.waitForTimeout(1500);
};
const setPassword = async (page, cur, next, again) => {
  await page.click('#admin-root .ad-tab[data-tab="security"]');
  await page.waitForTimeout(300);
  if (cur !== null) await page.fill('#adPwCur', cur);
  await page.fill('#adPwNew', next);
  await page.fill('#adPwNew2', again);
  await page.click(cur !== null ? '#adPwChange' : '#adPwSet');
  await page.waitForTimeout(1800);
};

(async () => {
  const b = await chromium.launch({ executablePath: EXECUTABLE });
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
  let page, s;

  /* 1 — no password yet: the dashboard opens and offers to set one. */
  page = await load(ctx, seeded());
  s = await state(page);
  check('with no password the dashboard opens', !s.login && s.fields > 0);
  check('and suggests setting one', /no password yet|بلا كلمة سر/.test(s.text));
  check('the dashboard has a Security tab', (await page.$('#admin-root .ad-tab[data-tab="security"]')) !== null);

  await setPassword(page, null, 'abc', 'abc');
  check('a short password is refused', /Too short|قصيرة/.test(await page.$eval('#adPwMsg', e => e.textContent)));
  check('and nothing is stored', !readStore()['secure/lock']);
  await setPassword(page, null, PW, PW + 'x');
  check('two different entries are refused', /do not match|غير متطابقتين/.test(await page.$eval('#adPwMsg', e => e.textContent)));
  await setPassword(page, null, PW, PW);
  const lock = readStore()['secure/lock'] || {};
  check('a password is saved', /saved|حُفظت/.test(await page.$eval('#adPwMsg', e => e.textContent)));
  check('as a salted PBKDF2 hash', lock.alg === 'PBKDF2-SHA256' && lock.iter >= 310000
    && typeof lock.salt === 'string' && lock.salt.length >= 20 && typeof lock.hash === 'string' && lock.hash.length >= 40,
    JSON.stringify(lock));
  check('the password itself is nowhere in the store', !fs.readFileSync(STORE, 'utf8').includes(PW));
  check('setting it does not lock you out of the open dashboard', !(await state(page)).login);
  check('and a Lock button appears', (await page.$('#adLock')) !== null);
  check('no errors so far', page.errs.length === 0, page.errs.join(' | '));
  await page.close();

  /* 2 — next visit: the login screen, and nothing of the content behind it. */
  const locked = readStore();
  page = await load(ctx, locked);
  s = await state(page);
  check('the next visit asks for the password', s.login);
  check('no field of the dashboard is on the page', s.fields === 0);
  check('none of the content is shown', !s.text.includes('Secret Item'));
  await page.click('#admin-root .ad-tab[data-tab="menu"]').catch(() => {});
  check('the tabs cannot be reached behind it', (await state(page)).login);

  await signIn(page, 'wrong-password');
  s = await state(page);
  check('a wrong password is refused', s.login && /not right|غير صحيحة/.test(s.msg), s.msg);
  for (let i = 0; i < 4; i++) await signIn(page, 'wrong-' + i);
  s = await state(page);
  check('repeated wrong tries make you wait', /Too many|محاولات كثيرة/.test(s.msg), s.msg);
  check('and the button waits too', await page.$eval('#adLoginBtn', e => e.disabled));
  await page.close();

  page = await load(ctx, locked);
  await signIn(page, PW);
  s = await state(page);
  check('the right password opens the dashboard', !s.login && s.fields > 0);
  check('with its content', s.text.includes('Secret Item') || (await page.$eval('#admin-root', e => e.innerHTML)).includes('Secret Item'));

  /* 3 — Lock keeps the work: an edit typed just before is saved. */
  await page.fill('#admin-root [data-path="items.0.en.n"]', 'Typed Before Lock');
  await page.click('#adLock');
  await page.waitForTimeout(2500);
  check('Lock returns to the login screen', (await state(page)).login);
  check('and the edit typed before it was saved',
    readStore()['content/menu'].items[0].en.n === 'Typed Before Lock', readStore()['content/menu'].items[0].en.n);
  check('no errors signing in and out', page.errs.length === 0, page.errs.join(' | '));
  await page.close();

  /* 4 — changing it needs the current one; the old one stops working. */
  page = await load(ctx, readStore());
  await signIn(page, PW);
  await setPassword(page, 'not-it', 'NewPass-99', 'NewPass-99');
  check('changing needs the current password', /current password is not right|الحالية غير صحيحة/.test(await page.$eval('#adPwMsg', e => e.textContent)));
  await setPassword(page, PW, 'NewPass-99', 'NewPass-99');
  check('with it, the password changes', /saved|حُفظت/.test(await page.$eval('#adPwMsg', e => e.textContent)));
  await page.close();
  page = await load(ctx, readStore());
  await signIn(page, PW);
  check('the old password no longer opens it', (await state(page)).login);
  await signIn(page, 'NewPass-99');
  check('the new one does', !(await state(page)).login);

  /* 5 — removing it needs the current one too. */
  await page.click('#admin-root .ad-tab[data-tab="security"]');
  await page.waitForTimeout(300);
  await page.fill('#adPwCur', 'NewPass-99');
  await page.click('#adPwRemove');
  await page.waitForTimeout(1800);
  check('the password can be removed', !readStore()['secure/lock']);
  await page.close();
  page = await load(ctx, readStore());
  check('and the dashboard opens without it again', !(await state(page)).login);
  await page.close();

  /* 6 — idle time locks it. */
  const withLock = readStore();
  withLock['secure/lock'] = locked['secure/lock'];
  page = await load(ctx, withLock, { clock: true });
  await signIn(page, PW);
  check('signed in before the idle wait', !(await state(page)).login);
  await page.clock.fastForward('31:00');
  await page.waitForTimeout(800);
  check('30 idle minutes lock the dashboard', (await state(page)).login);
  await page.close();

  /* 7 — a damaged record locks, never opens. */
  const broken = seeded();
  broken['secure/lock'] = { salt: '', hash: 42, iter: 'x' };
  page = await load(ctx, broken);
  s = await state(page);
  check('a damaged password record still locks', s.login && s.fields === 0);
  await signIn(page, '');
  await signIn(page, 'anything at all');
  check('and no password opens it', (await state(page)).login);
  check('and it says what to do', /damaged|تالف/.test((await state(page)).msg), (await state(page)).msg);
  check('no errors on a damaged record', page.errs.length === 0, page.errs.join(' | '));
  await page.close();

  /* 8 — the public page carries none of it. */
  const pub = fs.readFileSync(path.resolve(__dirname, '..', '..', 'dist', 'public', 'index.html'), 'utf8');
  check('the public page has no login code', !pub.includes('secure/lock') && !pub.includes('adLogin'));

  await ctx.close();
  await b.close();
  console.log(fails ? `\n${fails} FAILED` : '\nAll login checks passed');
  process.exit(fails ? 1 : 0);
})();
