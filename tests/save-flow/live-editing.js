const { resetStore, readStore, openPage, chromium, EXECUTABLE } = require('./harness');
let fails = 0;
const check = (n, ok, extra='') => { console.log(`${ok?'PASS':'FAIL'}  ${n}${extra?' — '+extra:''}`); if(!ok) fails++; };

const seeded = () => ({
  'content/menu': { categories:[{id:'burgers',icon:'burger',en:{n:'Burgers',t:''},ar:{n:'برجر',t:''}}],
    items:[{id:'a',cat:'burgers',price:5,spice:0,badge:null,img:'',en:{n:'Original',d:''},ar:{n:'أصلي',d:''}}], updatedAt:1 },
  'content/site': { hours:Array.from({length:7},()=>({o:600,c:1400})), text:{en:{},ar:{}},
    brand:{en:{a:'S',b:'B'},ar:{a:'س',b:'ب'},logo:''}, heroImage:'',
    contact:{whatsapp:'962700000000',phone:'stored'}, updatedAt:1 }
});

(async () => {
  const b = await chromium.launch({ executablePath: EXECUTABLE });

  console.log('=== typing, then a snapshot arrives (the ~30s refresh) ===');
  resetStore(seeded());
  const t = await openPage(b, { hash:'#admin' });
  await t.page.waitForTimeout(1400);

  const sel = '[data-path="items.0.en.n"]';
  await t.page.click(sel);
  await t.page.fill(sel, 'My New Name');
  await t.page.waitForTimeout(200);

  const before = await t.page.evaluate((s) => ({
    value: document.querySelector(s).value,
    focused: document.activeElement === document.querySelector(s),
    caret: document.querySelector(s).selectionStart,
  }), sel);
  console.log('  before the snapshot:', JSON.stringify(before));

  // the periodic refresh re-delivers the stored state
  await t.page.evaluate(() => window.__MOCK.forceNotify());
  await t.page.waitForTimeout(700);

  const after = await t.page.evaluate((s) => {
    const el = document.querySelector(s);
    return el ? {
      value: el.value,
      focused: document.activeElement === el,
      caret: el.selectionStart,
    } : { value: null, focused: false, caret: null };
  }, sel);
  console.log('  after  the snapshot:', JSON.stringify(after));

  check('the typed value survives a snapshot', after.value === 'My New Name', `now "${after.value}"`);
  check('focus is not stolen mid-edit', after.focused === true);
  check('caret position is kept', after.caret === before.caret, `${before.caret} -> ${after.caret}`);

  console.log('\n=== typing continuously while snapshots keep arriving ===');
  await t.page.click(sel);
  await t.page.evaluate((s) => { document.querySelector(s).value = ''; }, sel);
  const timer = await t.page.evaluateHandle(() => setInterval(() => window.__MOCK.forceNotify(), 220));
  await t.page.type(sel, 'Shawarma Deluxe', { delay: 90 });
  await t.page.waitForTimeout(400);
  await t.page.evaluate((h) => clearInterval(h), timer);
  const typed = await t.page.evaluate((s) => (document.querySelector(s)||{}).value, sel);
  console.log('  intended: "Shawarma Deluxe"');
  console.log('  actual  :', JSON.stringify(typed));
  check('text typed during snapshots is not mangled', typed === 'Shawarma Deluxe', JSON.stringify(typed));

  await t.ctx.close();
  console.log(fails === 0 ? '\n=== ALL CHECKS PASSED ===' : `\n=== ${fails} FAILED ===`);
  await b.close(); process.exit(fails?1:0);
})();
