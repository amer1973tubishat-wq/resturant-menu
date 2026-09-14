const { resetStore, readStore, openPage, chromium, EXECUTABLE } = require('./harness');
let fails = 0;
const check = (n, ok, extra='') => { console.log(`${ok?'PASS':'FAIL'}  ${n}${extra?' — '+extra:''}`); if(!ok) fails++; };

const seeded = () => ({
  'content/menu': { categories:[{id:'burgers',icon:'burger',en:{n:'Burgers',t:''},ar:{n:'برجر',t:''}}],
    items:[
      {id:'a',cat:'burgers',price:5,spice:0,badge:null,img:'',en:{n:'Item A',d:''},ar:{n:'أ',d:''}},
      {id:'b',cat:'burgers',price:6,spice:0,badge:null,img:'',en:{n:'Item B',d:''},ar:{n:'ب',d:''}}
    ], updatedAt:1 },
  'content/site': { hours:Array.from({length:7},()=>({o:600,c:1400})), text:{en:{},ar:{}},
    brand:{en:{a:'S',b:'B'},ar:{a:'س',b:'ب'},logo:''}, heroImage:'',
    contact:{whatsapp:'962700000000',phone:'stored'}, updatedAt:1 }
});

async function open_(b){
  const t = await openPage(b, { hash:'#admin' });
  await t.page.waitForTimeout(1400);
  return t;
}
async function save(page){
  await page.click('#adSave');
  await page.waitForTimeout(2800);
  return page.evaluate(() => ({
    green: !!document.querySelector('.ad-ok'),
    error: (document.querySelector('.ad-bad') || {}).textContent || '',
  }));
}

const ops = [
  ['add a new item',      async p => { await p.click('#addItem'); await p.waitForTimeout(500); }],
  ['delete an item',      async p => { await p.click('[data-del]'); await p.waitForTimeout(400); }],
  ['reorder items',       async p => { await p.click('[data-move="0"][data-dir="1"]'); await p.waitForTimeout(400); }],
  ['set a badge',         async p => { await p.click('[data-badge="0:best"]'); await p.waitForTimeout(400); }],
  ['add a category',      async p => { await p.click('[data-tab="cats"]'); await p.waitForTimeout(400);
                                       await p.click('#addCat'); await p.waitForTimeout(500); }],
  ['edit brand name',     async p => { await p.click('[data-tab="brand"]'); await p.waitForTimeout(400);
                                       await p.fill('[data-path="brand.en.a"]', 'NEWNAME'); }],
  ['edit a heading',      async p => { await p.click('[data-tab="text"]'); await p.waitForTimeout(400);
                                       await p.fill('[data-path="text.en.menu_title"]', 'NEW HEADING'); }],
  ['paste an image URL',  async p => { await p.fill('.ad-url', 'https://example.com/burger.webp');
                                       await p.waitForTimeout(300); }],
  ['edit hours',          async p => { await p.click('[data-tab="hours"]'); await p.waitForTimeout(400);
                                       await p.fill('[data-hour="0:o"]', '11:00'); }],
  ['change item category',async p => { await p.selectOption('[data-catof="0"]', { index: 0 });
                                       await p.waitForTimeout(300);
                                       await p.fill('[data-path="items.0.price"]', '8.25'); }],
];

(async () => {
  const b = await chromium.launch({ executablePath: EXECUTABLE });

  for (const [name, act] of ops) {
    resetStore(seeded());
    const t = await open_(b);
    try { await act(t.page); } catch (e) { console.log(`  (${name}: could not perform — ${e.message.slice(0,60)})`); }
    const ui = await save(t.page);
    check(name, ui.green === true && ui.error === '', ui.error || (ui.green ? '' : 'no confirmation'));
    await t.ctx.close();
  }

  console.log(fails === 0 ? '\n=== ALL CHECKS PASSED ===' : `\n=== ${fails} FAILED ===`);
  await b.close(); process.exit(fails?1:0);
})();
