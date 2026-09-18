const { resetStore, readStore, openPage, chromium, EXECUTABLE } = require('./harness');
let fails = 0;
const check = (n, ok, extra='') => { console.log(`${ok?'PASS':'FAIL'}  ${n}${extra?' — '+extra:''}`); if(!ok) fails++; };

const seeded = () => ({
  'content/menu': { categories:[{id:'burgers',icon:'burger',en:{n:'Burgers',t:''},ar:{n:'برجر',t:''}}],
    items:[{id:'a',cat:'burgers',price:5,spice:0,badge:null,img:'',en:{n:'Item A',d:''},ar:{n:'أ',d:''}}], updatedAt:1 },
  'content/site': { hours:Array.from({length:7},()=>({o:600,c:1400})), text:{en:{},ar:{}},
    brand:{en:{a:'S',b:'B'},ar:{a:'س',b:'ب'},logo:''}, heroImage:'',
    contact:{whatsapp:'962700000000',phone:'stored'}, updatedAt:1 }
});

(async () => {
  const b = await chromium.launch({ executablePath: EXECUTABLE });

  // ---- the live database points at this: the change log is empty at save time ----
  console.log('=== the change log is wiped after editing (what the live DB implies) ===');
  resetStore(seeded());
  {
    const t = await openPage(b, { hash:'#admin' });
    await t.page.waitForTimeout(1400);
    await t.page.fill('[data-path="items.0.en.n"]', 'Should Still Save');
    await t.page.waitForTimeout(300);

    // simulate whatever loses the log in the real runtime
    const before = await t.page.evaluate(() => {
      const w = window;
      return { note: 'clearing the change log from outside' };
    });
    await t.page.evaluate(() => {
      // reach the closure through a save click? no — emulate by dispatching
      // a snapshot that resets bookkeeping, the closest available lever
      window.__MOCK.forceNotify();
    });
    await t.page.waitForTimeout(600);

    await t.page.click('#adSave');
    await t.page.waitForTimeout(3000);
    const stored = readStore()['content/menu'].items[0].en.n;
    const ui = await t.page.evaluate(() => ({
      green: !!document.querySelector('.ad-ok'),
      err: (document.querySelector('.ad-bad')||{}).textContent || '',
      msg: (document.querySelector('.ad-save p')||{}).textContent || '',
    }));
    console.log('  stored value:', JSON.stringify(stored), '| ui:', JSON.stringify(ui));
    check('the edit reached the database', stored === 'Should Still Save', stored);
    check('success confirmed', ui.green === true, ui.err || ui.msg);
    await t.ctx.close();
  }

  // ---- a save attempt is always recorded ----
  console.log('\n=== every attempt is recorded for diagnosis ===');
  resetStore(seeded());
  {
    const t = await openPage(b, { hash:'#admin' });
    await t.page.waitForTimeout(1400);
    await t.page.fill('[data-path="items.0.en.n"]', 'Logged');
    await t.page.click('#adSave');
    await t.page.waitForTimeout(3000);
    const log = readStore()['meta/last-save'];
    console.log('  meta/last-save =', JSON.stringify(log));
    check('an attempt record exists', !!log);
    check('it names the outcome', log && log.outcome === 'ok', log && log.outcome);
    check('it names what changed', log && /items/.test(log.changed + log.detail), log && log.detail);
    await t.ctx.close();
  }

  // ---- pressing save with genuinely nothing changed ----
  console.log('\n=== save with nothing actually changed ===');
  resetStore(seeded());
  {
    const t = await openPage(b, { hash:'#admin' });
    await t.page.waitForTimeout(1400);
    await t.page.click('#adSave');
    await t.page.waitForTimeout(2500);
    const log = readStore()['meta/last-save'];
    check('reports nothing to save', log && log.outcome === 'nothing', log && log.outcome);
    check('the store was not rewritten', readStore()['content/menu'].updatedAt === 1);
    await t.ctx.close();
  }

  console.log(fails === 0 ? '\n=== ALL CHECKS PASSED ===' : `\n=== ${fails} FAILED ===`);
  await b.close(); process.exit(fails?1:0);
})();
