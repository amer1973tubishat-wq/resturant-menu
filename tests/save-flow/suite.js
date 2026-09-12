const { resetStore, readStore, openPage, chromium, EXECUTABLE } = require('./harness');
let fails = 0;
const check = (n, ok, extra='') => { console.log(`${ok?'PASS':'FAIL'}  ${n}${extra?' — '+extra:''}`); if(!ok) fails++; };

const seeded = () => ({
  'content/menu': {
    categories: [
      { id:'burgers', icon:'burger', en:{n:'Burgers',t:''}, ar:{n:'برجر',t:''} },
      { id:'drinks',  icon:'i-juice', en:{n:'Drinks',t:''},  ar:{n:'مشروبات',t:''} }
    ],
    items: [
      { id:'a', cat:'burgers', price:5, spice:0, badge:null, img:'', en:{n:'Item A',d:''}, ar:{n:'أ',d:''} },
      { id:'b', cat:'burgers', price:6, spice:0, badge:null, img:'', en:{n:'Item B',d:''}, ar:{n:'ب',d:''} }
    ], updatedAt:1
  },
  'content/site': {
    hours: Array.from({length:7},()=>({o:600,c:1400})),
    text:{en:{menu_title:'STORED TITLE'},ar:{}},
    brand:{en:{a:'STORED',b:'BRAND'},ar:{a:'مخزن',b:'اسم'},logo:''},
    heroImage:'', contact:{whatsapp:'962700000000',phone:'stored-phone'}, updatedAt:1
  }
});

async function openAdmin(b, hash){
  const t = await openPage(b, { hash: hash || '' });
  if(!hash){ await t.page.evaluate(()=>{location.hash='#admin';}); }
  await t.page.waitForTimeout(1400);
  return t;
}
const field = (page, sel) => page.evaluate(s => (document.querySelector(s)||{}).value, sel);
async function fieldOnTab(page, tab, sel){
  await page.click(`[data-tab="${tab}"]`); await page.waitForTimeout(400);
  return field(page, sel);
}

(async () => {
  const b = await chromium.launch({ executablePath: EXECUTABLE });

  // ---------------- Test 0: the original root cause ----------------
  console.log('--- Test 0: land directly on #admin (the failing path) ---');
  resetStore(seeded());
  {
    const t = await openAdmin(b, '#admin');
    const shown = await field(t.page, '[data-path="items.0.en.n"]');
    check('editor loads STORED content, not defaults', shown === 'Item A', `shows "${shown}"`);
    await t.page.click('[data-tab="contact"]'); await t.page.waitForTimeout(300);
    await t.page.fill('[data-path="contact.phone"]', 'NEW-PHONE');
    await t.page.click('#adSave'); await t.page.waitForTimeout(2500);
    const s = readStore();
    check('the edited field saved', s['content/site'].contact.phone === 'NEW-PHONE');
    check('untouched item survived', s['content/menu'].items[0].en.n === 'Item A');
    check('untouched heading survived', s['content/site'].text.en.menu_title === 'STORED TITLE');
    check('untouched brand survived', s['content/site'].brand.en.a === 'STORED');
    await t.ctx.close();
  }

  // ---------------- Test 1: edit -> save -> refresh ----------------
  console.log('\n--- Test 1: save then refresh ---');
  resetStore(seeded());
  {
    const t = await openAdmin(b);
    await t.page.click('[data-tab="contact"]'); await t.page.waitForTimeout(300);
    await t.page.fill('[data-path="contact.phone"]', 'PERSISTED-1');
    await t.page.click('#adSave'); await t.page.waitForTimeout(2500);
    await t.page.reload(); await t.page.waitForTimeout(3800);
    check('value survives refresh',
      await fieldOnTab(t.page,'contact','[data-path="contact.phone"]') === 'PERSISTED-1');
    await t.ctx.close();
  }

  // ---------------- Test 3 / 9: brand-new browser context ----------------
  console.log('\n--- Test 3 & 9: reopen in a separate browser context ---');
  {
    const t = await openAdmin(b);
    check('another session reads the saved value',
      await fieldOnTab(t.page,'contact','[data-path="contact.phone"]') === 'PERSISTED-1');
    const pub = await t.page.evaluate(()=>document.querySelectorAll('#menuGrid .card').length);
    check('public site renders from the store', pub === 2, `${pub} cards`);
    await t.ctx.close();
  }

  // ---------------- Test 4: several fields at once ----------------
  console.log('\n--- Test 4: many fields in one save ---');
  resetStore(seeded());
  {
    const t = await openAdmin(b);
    await t.page.fill('[data-path="items.0.en.n"]', 'Renamed A');
    await t.page.fill('[data-path="items.0.price"]', '12.5');
    await t.page.click('[data-tab="brand"]'); await t.page.waitForTimeout(300);
    await t.page.fill('[data-path="brand.en.a"]', 'NEWBRAND');
    await t.page.click('[data-tab="contact"]'); await t.page.waitForTimeout(300);
    await t.page.fill('[data-path="contact.phone"]', 'MULTI');
    await t.page.click('#adSave'); await t.page.waitForTimeout(2500);
    const s = readStore();
    check('item name saved',  s['content/menu'].items[0].en.n === 'Renamed A');
    check('item price saved', Number(s['content/menu'].items[0].price) === 12.5);
    check('brand saved',      s['content/site'].brand.en.a === 'NEWBRAND');
    check('phone saved',      s['content/site'].contact.phone === 'MULTI');
    await t.ctx.close();
  }

  // ---------------- Test 5: reopen the editor ----------------
  console.log('\n--- Test 5: reopen the editor shows new values ---');
  {
    const t = await openAdmin(b);
    check('editor shows the new item name', await field(t.page,'[data-path="items.0.en.n"]') === 'Renamed A');
    await t.ctx.close();
  }

  // ---------------- Test: deleting everything persists ----------------
  console.log('\n--- Test: delete all items (empty must persist) ---');
  resetStore(seeded());
  {
    const t = await openAdmin(b);
    const n = await t.page.evaluate(()=>document.querySelectorAll('[data-del]').length);
    for(let i=0;i<n;i++){ await t.page.click('[data-del]'); await t.page.waitForTimeout(220); }
    await t.page.click('#adSave'); await t.page.waitForTimeout(2500);
    check('empty list written', (readStore()['content/menu'].items||[]).length === 0);
    const t2 = await openPage(b);
    const cards = await t2.page.evaluate(()=>[...document.querySelectorAll('.card-name')].map(e=>e.textContent));
    check('deletion survives reload (no silent revert)', cards.length === 0, JSON.stringify(cards.slice(0,3)));
    await t.ctx.close(); await t2.ctx.close();
  }

  // ---------------- Test 6: rapid double save ----------------
  console.log('\n--- Test 6: hammer the save button ---');
  resetStore(seeded());
  {
    const t = await openAdmin(b);
    await t.page.click('[data-tab="contact"]'); await t.page.waitForTimeout(300);
    await t.page.fill('[data-path="contact.phone"]', 'RAPID');
    await t.page.evaluate(()=>{ window.__MOCK.writeLog = []; });
    for(let i=0;i<6;i++){ await t.page.click('#adSave').catch(()=>{}); await t.page.waitForTimeout(60); }
    await t.page.waitForTimeout(3000);
    const writes = await t.page.evaluate(()=>window.__MOCK.writeLog.filter(w=>w.path==='content/site').length);
    check('six clicks did not fan out into many writes', writes <= 2, `${writes} site writes`);
    check('value correct after hammering', readStore()['content/site'].contact.phone === 'RAPID');
    await t.ctx.close();
  }

  // ---------------- Test 8: write fails ----------------
  console.log('\n--- Test 8: the write fails mid-save ---');
  resetStore(seeded());
  {
    const t = await openAdmin(b);
    await t.page.click('[data-tab="contact"]'); await t.page.waitForTimeout(300);
    await t.page.fill('[data-path="contact.phone"]', 'SHOULD-NOT-CLAIM-SUCCESS');
    await t.page.evaluate(()=>{ window.__MOCK.failWrites = true; });
    await t.page.click('#adSave'); await t.page.waitForTimeout(2600);
    const ui = await t.page.evaluate(()=>({
      err: (document.querySelector('.ad-bad')||{}).textContent || '',
      ok:  !!document.querySelector('.ad-ok'),
      barVisible: !!document.querySelector('.ad-save.show'),
      value: (document.querySelector('[data-path="contact.phone"]')||{}).value,
      pill: (document.querySelector('.ad-pill')||{}).textContent
    }));
    check('no false success shown', ui.ok === false);
    check('a clear error is shown', ui.err.length > 0, JSON.stringify(ui.err));
    check('unsaved bar stays visible', ui.barVisible);
    check('user input is preserved', ui.value === 'SHOULD-NOT-CLAIM-SUCCESS');
    check('transient failure not mislabelled as read-only', !/read-only/i.test(ui.pill), ui.pill);
    check('store untouched', readStore()['content/site'].contact.phone === 'stored-phone');

    // recovery: the failure clears and the retry succeeds
    await t.page.evaluate(()=>{ window.__MOCK.failWrites = false; });
    await t.page.click('#adSave'); await t.page.waitForTimeout(2600);
    check('retry after recovery saves', readStore()['content/site'].contact.phone === 'SHOULD-NOT-CLAIM-SUCCESS');
    check('success only shown once verified', await t.page.evaluate(()=>!!document.querySelector('.ad-ok')));
    await t.ctx.close();
  }

  // ---------------- Test: two sessions ----------------
  console.log('\n--- Test: two sessions must not overwrite each other ---');
  resetStore(seeded());
  {
    const A = await openAdmin(b);
    const B = await openAdmin(b);
    await A.page.click('[data-tab="contact"]'); await A.page.waitForTimeout(300);
    await A.page.fill('[data-path="contact.phone"]', 'FROM-A');
    await A.page.click('#adSave'); await A.page.waitForTimeout(2500);
    await B.page.click('[data-tab="brand"]'); await B.page.waitForTimeout(400);
    await B.page.fill('[data-path="brand.en.a"]', 'FROM-B');
    await B.page.click('#adSave'); await B.page.waitForTimeout(2500);
    const s = readStore();
    check("B's save kept A's phone", s['content/site'].contact.phone === 'FROM-A', s['content/site'].contact.phone);
    check("B's own change saved",    s['content/site'].brand.en.a === 'FROM-B');
    await A.ctx.close(); await B.ctx.close();
  }

  // ---------------- Test 7: read-only account ----------------
  console.log('\n--- Test 7: an account without edit access ---');
  resetStore(seeded());
  {
    const t = await openPage(b, { mock:{ canEdit:false } });
    await t.page.evaluate(()=>{location.hash='#admin';}); await t.page.waitForTimeout(1600);
    const ui = await t.page.evaluate(()=>({
      pill: (document.querySelector('.ad-pill')||{}).textContent,
      disabled: [...document.querySelectorAll('.ad-field input')].every(i=>i.disabled)
    }));
    check('shown as read-only', /read-only/i.test(ui.pill), ui.pill);
    check('inputs disabled', ui.disabled);
    check('store untouched by a read-only viewer', readStore()['content/site'].contact.phone === 'stored-phone');
    await t.ctx.close();
  }

  console.log(fails === 0 ? '\n=== ALL CHECKS PASSED ===' : `\n=== ${fails} CHECK(S) FAILED ===`);
  await b.close();
  process.exit(fails ? 1 : 0);
})();
