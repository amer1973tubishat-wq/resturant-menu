/* =========================================================
   شيف هاشم — static menu generator
   Chef Hashem — pre-renders the menu into index.html

   The site runs fine without this script: main.js can render
   the menu at runtime. This bakes the same markup into the
   HTML so the dishes are visible to search engines and to
   visitors with JavaScript disabled.

   Run it after changing assets/data/menu.js:

       node tools/build.mjs

   It rewrites only the regions between <!--build:x--> markers,
   plus the data-bind fields, the title and the JSON-LD block.
   Nothing else in index.html is touched.
   ========================================================= */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DATA = join(ROOT, 'assets/data/menu.js');
const PAGE = join(ROOT, 'index.html');

/* ---------- Load the data file ---------- */
const sandbox = { window: {} };
new Function('window', readFileSync(DATA, 'utf8'))(sandbox.window);
const data = sandbox.window.MENU_DATA;

if (!data?.items || !data?.categories || !data?.restaurant) {
  console.error('✗ assets/data/menu.js did not define a usable window.MENU_DATA');
  process.exit(1);
}

const R = data.restaurant;

/* ---------- Helpers ---------- */
const esc = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const digits = (value) => String(value ?? '').replace(/[^0-9]/g, '');

const imageUrl = (name) => {
  if (!name) return 'assets/img/thumb-burger.svg';
  // uploaded images are data: URIs, linked ones are paths or absolute URLs
  if (/^data:/.test(name) || /^(https?:)?\/\//.test(name) || name.includes('/')) return name;
  return 'assets/img/' + name;
};

const fillTemplate = (template, values) =>
  String(template ?? '').replace(/\{(\w+)\}/g, (m, key) => (key in values ? values[key] : m));

const LINKS = {
  tel: 'tel:+' + digits(R.phone),
  mail: 'mailto:' + (R.email || ''),
  map: R.mapUrl || '#',
  whatsapp: 'https://wa.me/' + digits(R.whatsapp || R.phone) +
            '?text=' + encodeURIComponent(fillTemplate(R.whatsappMessage, { name: R.name || '' })),
  instagram: R.instagram || '#',
  tiktok: R.tiktok || '#',
  x: R.x || '#'
};

const BADGE_CLASS = { veg: ' card__flag--veg', new: ' card__flag--new' };

/* ---------- Region builders ---------- */
const priceHtml = (item) =>
  `<p class="card__price">${esc(item.price)} <span>${esc(R.currency)}</span></p>`;

const badgeHtml = (item) =>
  item.badge
    ? ` <span class="card__flag${BADGE_CLASS[item.badgeStyle] || ''}">${esc(item.badge)}</span>`
    : '';

const tagsHtml = (item) =>
  item.tags?.length
    ? `\n            <ul class="tags">${item.tags.map((t) => `<li class="tag">${esc(t)}</li>`).join('')}</ul>`
    : '';

const menuHtml = () => data.items.map((item) => `
        <li class="card" data-category="${esc(item.category)}">
          <div class="card__media"><img src="${esc(imageUrl(item.image))}" alt="" loading="lazy" width="120" height="120"></div>
          <div class="card__body">
            <div class="card__head">
              <h3 class="card__title">${esc(item.name)}${badgeHtml(item)}</h3>
              ${priceHtml(item)}
            </div>
            <p class="card__desc">${esc(item.desc)}</p>${tagsHtml(item)}
          </div>
        </li>`).join('');

const featuredHtml = () => data.items.filter((i) => i.featured).slice(0, 3).map((item, i) => `
        <li class="feature-card reveal">
          <div class="feature-card__media">
            <img src="${esc(imageUrl(item.image))}" alt="${esc(item.name)}" loading="lazy">
            <span class="feature-card__rank" aria-hidden="true">${i + 1}</span>
          </div>
          <div class="feature-card__body">
            <div class="feature-card__head">
              <h3>${esc(item.name)}</h3>
              ${priceHtml(item)}
            </div>
            <p>${esc(item.desc)}</p>
          </div>
        </li>`).join('');

const filtersHtml = () => [
  `\n          <button type="button" class="chip is-active" aria-pressed="true" data-filter="all">الكل</button>`,
  ...data.categories.map((c) =>
    `\n          <button type="button" class="chip" aria-pressed="false" data-filter="${esc(c.id)}">${esc(c.name)}</button>`)
].join('');

const hoursHtml = () => (R.hours || []).map((row) =>
  `\n            <tr><th scope="row">${esc(row.day)}</th><td>${esc(row.time)}</td></tr>`).join('');

const footerCatsHtml = () => data.categories.map((c) =>
  `\n        <li><a href="#menu" data-jump="${esc(c.id)}">${esc(c.name)}</a></li>`).join('');

// The first tile is tall and the fifth spans two columns — that shape is the
// design, so it follows position rather than anything in the data.
const galleryHtml = () => (R.gallery || []).map((entry, i) => {
  const shape = i === 0 ? ' gallery__item--tall' : (i === 4 ? ' gallery__item--wide' : '');
  return `\n        <li class="gallery__item${shape} reveal">` +
         `<img src="${esc(imageUrl(entry.image))}" alt="${esc(entry.caption || '')}" loading="lazy">` +
         `<span class="gallery__cap">${esc(entry.caption || '')}</span></li>`;
}).join('');

/* ---------- Rewrite the page ---------- */
let page = readFileSync(PAGE, 'utf8');
const before = page;

function region(name, html) {
  const pattern = new RegExp(`(<!--build:${name}-->)[\\s\\S]*?(<!--/build:${name}-->)`);
  if (!pattern.test(page)) {
    console.error(`✗ marker <!--build:${name}--> not found in index.html`);
    process.exit(1);
  }
  page = page.replace(pattern, `$1${html}\n        $2`);
}

region('menu', menuHtml());
region('featured', featuredHtml());
region('filters', filtersHtml());
region('hours', hoursHtml());
region('footercats', footerCatsHtml());
region('gallery', galleryHtml());

// Text of every [data-bind] element (they all contain plain text)
for (const [key, value] of Object.entries(R)) {
  if (typeof value !== 'string') continue;
  page = page.replace(
    new RegExp(`(<(\\w+)[^>]*\\sdata-bind="${key}"[^>]*>)[^<]*(</\\2>)`, 'g'),
    (m, open, tag, close) => `${open}${esc(value)}${close}`
  );
}

// src of every [data-bind-img] element
for (const key of ['logo', 'heroImage']) {
  if (!R[key]) continue;
  page = page.replace(
    new RegExp(`(<img[^>]*\\sdata-bind-img="${key}"[^>]*>)`, 'g'),
    (tag) => tag.replace(/\ssrc="[^"]*"/, ` src="${esc(imageUrl(R[key]))}"`)
  );
}

// href of every [data-bind-href] element
for (const [key, href] of Object.entries(LINKS)) {
  page = page.replace(
    new RegExp(`(<a[^>]*\\sdata-bind-href="${key}"[^>]*>)`, 'g'),
    (tag) => tag.replace(/\shref="[^"]*"/, ` href="${esc(href)}"`)
  );
}

// <title> and the no-JS phone number
const titleTemplate = page.match(/data-title-template="([^"]*)"/)?.[1];
if (titleTemplate) {
  page = page.replace(/<title>[^<]*<\/title>/, `<title>${esc(fillTemplate(titleTemplate, { name: R.name }))}</title>`);
}
page = page.replace(
  /(<span class="ltr">)[^<]*(<\/span>)/,
  `$1${esc(R.phoneDisplay)}$2`
);

// Structured data
const ld = {
  '@context': 'https://schema.org',
  '@type': 'Restaurant',
  name: R.name,
  inLanguage: 'ar',
  servesCuisine: 'برجر',
  priceRange: '$$',
  telephone: R.phone,
  address: {
    '@type': 'PostalAddress',
    streetAddress: R.addressLine1 || '',
    addressLocality: R.addressLine2 || ''
  },
  hasMenu: data.categories.map((cat) => ({
    '@type': 'MenuSection',
    name: cat.name,
    hasMenuItem: data.items.filter((i) => i.category === cat.id).map((i) => ({
      '@type': 'MenuItem',
      name: i.name,
      description: i.desc,
      offers: { '@type': 'Offer', price: i.price, priceCurrency: 'SAR' }
    }))
  }))
};
if (R.mapUrl) ld.hasMap = R.mapUrl;

page = page.replace(
  /(<script type="application\/ld\+json" id="ldJson">)[\s\S]*?(<\/script>)/,
  `$1\n${JSON.stringify(ld, null, 2)}\n$2`
);

writeFileSync(PAGE, page);

console.log(
  page === before
    ? '· index.html already up to date'
    : `✓ index.html rebuilt — ${data.items.length} dishes, ${data.categories.length} categories`
);
