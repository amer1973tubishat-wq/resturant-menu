const { STORE, resetStore, readStore, chromium, EXECUTABLE } = require('./harness');
const fs = require('fs');
const path = require('path');
const PAGE = 'file://' + path.resolve(__dirname, '..', '..', 'index.html');
let fails = 0;
const check = (n, ok, extra='') => { console.log(`${ok?'PASS':'FAIL'}  ${n}${extra?' — '+extra:''}`); if(!ok) fails++; };

const seeded = () => ({
  'content/menu': { categories:[{id:'burgers',icon:'burger',en:{n:'Burgers',t:''},ar:{n:'برجر',t:''}}],
    items:[{id:'a',cat:'burgers',price:5,spice:0,badge:null,img:'',en:{n:'Item A',d:''},ar:{n:'أ',d:''}}], updatedAt:1 },
  'content/site': { hours:Array.from({length:7},()=>({o:600,c:1400})), text:{en:{},ar:{}},
    brand:{en:{a:'S',b:'B'},ar:{a:'س',b:'ب'},logo:''}, heroImage:'',
    contact:{whatsapp:'962700000000',phone:'stored'}, updatedAt:1 }
});

/* Visibility judged the way a person judges it: on screen, opaque, clickable. */
async function btnState(page, sel){
  return page.evaluate((s) => {
    const el = document.querySelector(s);
    if(!el) return { present:false };
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return {
      present:true,
      onScreen: r.top >= 0 && r.bottom <= window.innerHeight && r.left >= 0 && r.right <= window.innerWidth,
      width: Math.round(r.width), height: Math.round(r.height),
      opacity: Number(cs.opacity),
      disabled: el.disabled,
      text: el.textContent.trim(),
      hasDot: !!el.querySelector('.ad-dot'),
      // is it the topmost element at its own centre?
      topmost: document.elementFromPoint(r.left + r.width/2, r.top + r.height/2) === el
               || el.contains(document.elementFromPoint(r.left + r.width/2, r.top + r.height/2)),
    };
  }, sel);
}

(async () => {
  const b = await chromium.launch({ executablePath: EXECUTABLE });

  for (const [w,h,label] of [[1400,900,'desktop'],[390,844,'mobile']]) {
    console.log(`\n=== ${label} (${w}x${h}) ===`);
    resetStore(seeded());
    const ctx = await b.newContext({ viewport:{width:w,height:h} });
    const page = await ctx.newPage();
    await page.exposeFunction('__storeRead', async () => { try { return fs.readFileSync(STORE,'utf8'); } catch { return '{}'; } });
    await page.exposeFunction('__storeWrite', async (t) => { fs.writeFileSync(STORE, t); return true; });
    await page.addInitScript(fs.readFileSync(path.join(__dirname,'mock.js'),'utf8'));
    await page.goto(PAGE + '#admin');
    await page.waitForTimeout(4000);

    const top = await btnState(page, '#adSaveTop');
    const bottom = await btnState(page, '#adSave');
    console.log('  top   :', JSON.stringify(top));
    console.log('  bottom:', JSON.stringify(bottom));

    check(`${label}: top save button is on screen`, top.present && top.onScreen);
    check(`${label}: it is fully opaque`, top.opacity === 1, String(top.opacity));
    /* Deliberately never disabled: a dimmed save button reads as an absent
       one, which is the whole reason this test exists. It answers "nothing to
       save" instead of refusing the click. */
    check(`${label}: it is clickable, not disabled`, top.disabled === false);
    check(`${label}: nothing is covering it`, top.topmost === true);
    check(`${label}: bottom save button also on screen`, bottom.present && bottom.onScreen);
    check(`${label}: bottom is enabled`, bottom.disabled === false);

    // no unsaved marker before editing
    check(`${label}: no unsaved dot before editing`, top.hasDot === false && bottom.hasDot === false);

    // edit -> dot appears on both
    await page.fill('[data-path="items.0.en.n"]', 'Changed');
    await page.waitForTimeout(500);
    const top2 = await btnState(page, '#adSaveTop');
    const bot2 = await btnState(page, '#adSave');
    check(`${label}: unsaved dot appears on both`, top2.hasDot && bot2.hasDot);

    // the TOP button saves
    await page.click('#adSaveTop');
    await page.waitForTimeout(2600);
    check(`${label}: top button saved to the store`, readStore()['content/menu'].items[0].en.n === 'Changed');
    const top3 = await btnState(page, '#adSaveTop');
    check(`${label}: dot cleared after saving`, top3.hasDot === false);

    // clicking with nothing pending answers instead of sitting silent
    await page.click('#adSaveTop'); await page.waitForTimeout(900);
    const msg = await page.evaluate(()=> (document.querySelector('.ad-save p')||{}).textContent );
    check(`${label}: idle click gives feedback`, /Nothing to save/i.test(msg||''), msg);

    await page.screenshot({ path: `${__dirname}/vis-${label}.png` });
    await ctx.close();
  }

  console.log(fails === 0 ? '\n=== ALL CHECKS PASSED ===' : `\n=== ${fails} FAILED ===`);
  await b.close(); process.exit(fails?1:0);
})();
