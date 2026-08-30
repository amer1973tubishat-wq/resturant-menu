# شيف هاشم · Chef Hashem — Arabic burger menu website

A complete, professional **menu website** for an Arabic burger restaurant: right-to-left,
mobile-first, and driven by a single data file that a private dashboard can edit.

Plain HTML, CSS and JavaScript — no build step, no dependencies, no framework. Open
`index.html` in a browser and it runs.

This is a **menu site, not an ordering system**. There is no cart, no checkout and no
booking form. Guests browse the menu and then order through the WhatsApp or call buttons,
which are present on every screen.

## Pages

| File | What it is |
| --- | --- |
| `index.html` | The public menu site |
| `admin.html` | The private dashboard — not linked from the site, and marked `noindex` |

## What's on the site

| Section | Notes |
| --- | --- |
| Top bar | Tagline, phone number, address |
| Sticky header | Logo, anchor nav with scroll-spy, mobile drawer, WhatsApp order button |
| Hero | Headline, lede, two CTAs, three proof points, illustrated burger |
| Marquee | Scrolling strip of selling points (mirrors direction in RTL) |
| Why us | Four icon cards — grilling, freshness, delivery, local sourcing |
| Most ordered | Three ranked highlight cards, picked in the dashboard |
| **Menu** | 30 dishes in 6 categories with **live search**, category filter, prices, tags, empty state, allergen note |
| Offer | Happy-hour band with before/after pricing |
| Story | Copy plus a four-figure stats row |
| Gallery | Responsive masonry-style grid |
| Reviews | Three guest quotes |
| Contact | Address, opening-hours table, perks, and a card with WhatsApp / call / map buttons |
| Fixed bar | WhatsApp and call, pinned to the bottom of every phone screen |
| Footer | Category links, contact links, social links, auto-updating copyright year |

## Files

```
index.html                 Public menu site
admin.html                 Private dashboard
assets/data/menu.js        ← all menu content lives here (single source of truth)
assets/css/styles.css      Site styling — tokens, layout, components, RTL, responsive, print
assets/css/admin.css       Dashboard styling
assets/js/main.js          Renders the menu; nav, search, filter, scroll-spy, reveals
assets/js/admin.js         Dashboard logic
assets/img/*.svg           13 vector placeholders: logo, favicon, hero burger, grill scene
                           and 9 dish thumbnails
```

## Running it

Open `index.html` directly, or serve the folder:

```bash
python3 -m http.server 8000   # then http://localhost:8000
```

Deploy by uploading the folder to any static host — GitHub Pages, Netlify, Vercel,
Cloudflare Pages or plain shared hosting.

---

## The dashboard

Open **`admin.html`** and enter the passcode. The default is `hashem2014`.

You can:

- **Add, edit, delete and reorder dishes** — name, category, price, description, image,
  badge, tags, and whether the dish appears under "الأكثر طلباً" on the homepage. The
  order in the list is the order on the site.
- **Manage categories** — add, rename, reorder. A category that still has dishes in it
  cannot be deleted, so you can't orphan items by accident.
- **Edit restaurant details** — name, tagline, phone, WhatsApp number, email, address,
  map link, currency symbol, social links, and the opening-hours table.

### How saving works

There is no server, so the dashboard uses a two-step flow:

1. **حفظ (Save)** writes your changes to this browser's `localStorage`. The public site
   reads that immediately, so you can preview real changes on your own machine — a
   "معاينة محلية" flag appears on the site while you're seeing local edits rather than
   the published file.
2. **تنزيل menu.js (Download)** gives you the updated data file. Replace
   `assets/data/menu.js` with it and re-upload to publish the changes **for everyone
   else**.

Until you do step 2, your edits exist only in your own browser. The other buttons:
**استيراد** loads a `menu.js` or JSON file back in, and **استعادة الأصل** discards the
local edits and returns to whatever `assets/data/menu.js` contains.

### About the passcode — read this

The passcode gate is **client-side only, and it is not security.** It keeps the page from
being opened casually; it does not protect anything. The entire site — including
`admin.js` and the passcode hash — is downloaded by every visitor, so anyone determined
enough can read it and can also read the menu data directly.

That is acceptable here because a menu contains nothing secret. **Do not put anything
sensitive in the dashboard**, and do not treat it as an account system.

If you need genuine protection, put `admin.html` behind server-side auth — HTTP basic auth
on the directory, Netlify/Cloudflare Access, or a host-level password.

To change the passcode: open the browser console on `admin.html`, run
`hash('your-new-code')`, and paste the result into `PASS_HASH` at the top of
`assets/js/admin.js`.

---

## Editing the menu by hand

`assets/data/menu.js` is the single source of truth. It is a plain JavaScript file rather
than JSON on purpose: it loads through a `<script>` tag, so the site also works when
opened straight from disk (`file://` blocks `fetch`).

```js
{
  "id": "beef-double",          // unique; used internally
  "category": "beef",           // must match a category id
  "featured": true,             // shows under "الأكثر طلباً" (first 3 only)
  "name": "برجر هاشم المزدوج",
  "desc": "قطعتا لحم مشويتان على الفحم…",
  "price": 45,
  "image": "thumb-burger.svg",  // file in assets/img/, or any path/URL
  "badge": "الأكثر مبيعاً",      // optional pill next to the name
  "badgeStyle": "hot",          // hot (red) | veg (green) | new (gold)
  "tags": ["حار قليلاً", "مزدوج"]
}
```

Adding a category is just another entry in `categories`; the filter buttons, the footer
links and the dashboard's category dropdown all build themselves from that list.

### Photos

The images in `assets/img/` are SVG placeholders so the template ships without binary
assets. To use real photography, drop the files into `assets/img/` and either pick them in
the dashboard's "مسار صورة مخصّص" field or set `image` to the path. Also replace the
`og:image` meta tag with a JPEG or PNG — most social networks don't render SVG previews.

### Prices and currency

Prices are numbers; the currency symbol comes from `restaurant.currency` and is rendered
beside each one, so changing `ر.س` to anything else is a single edit (or one field in the
dashboard). Digits are Western (`45`) rather than Arabic-Indic (`٤٥`), which is the common
convention on Arabic restaurant sites; nothing in the code depends on the digit form.

---

## How right-to-left works

`index.html` sets `<html lang="ar" dir="rtl">`, and that is the only switch. The
stylesheet contains **no `left`/`right` rules** — every directional property is logical
(`margin-inline-start`, `inset-inline-end`, `padding-inline`, `text-align: start`,
`border-inline-start`), so the whole layout mirrors from the `dir` attribute. There is no
separate RTL stylesheet to keep in sync.

Three things needed handling beyond that, and they're commented in the source:

- **The marquee** animates on `translateX`, a physical transform, so a `[dir="rtl"]` rule
  swaps in a mirrored keyframe.
- **Arabic typography.** Arabic is a connected script, so `letter-spacing` breaks the
  joins between letters — it is reset to `normal` across the page.
- **Arrow keys** on the category filter follow visual direction, so <kbd>→</kbd> moves
  toward the start of the row.

## Mobile-first

The base stylesheet **is** the phone layout — single-column grids, a nav drawer, a fixed
contact bar, and a category row that scrolls sideways instead of wrapping into a tall
block. Three `min-width` breakpoints add complexity from there:

| Breakpoint | What changes |
| --- | --- |
| base | 1 column, nav drawer, fixed WhatsApp/call bar |
| `560px` | 2-column grids, wider gutters, top bar shows contact details |
| `900px` | 3-column menu, horizontal nav, side-by-side sections, fixed bar hidden |
| `1200px` | Final type scale |

There are **zero `max-width` media queries** in the stylesheet.

## Search

The search box and the category chips combine. Each card is indexed from its full text, so
**names, descriptions and tags are all searchable**.

Arabic input is normalised before matching: diacritics (tashkeel) and tatweel are stripped,
and alef (أ إ آ), yaa (ى ي), taa marbuta (ة/ه) and hamza forms are unified — so `دجاج`
matches `الدَّجاج` and `دجـــاج`, and `افوكادو` matches `أفوكادو`. <kbd>Esc</kbd> clears the
field.

## Translating without touching JavaScript

`main.js` contains no user-facing text. Messages come from `data-msg-*` attributes with
`{placeholder}` substitution:

```html
<p class="menu-count" id="menuCount"
   data-msg-all="عرض جميع الأطباق ({n} طبقاً)"
   data-msg-category="عرض {n} من أطباق «{category}»"
   data-msg-search="{n} نتيجة للبحث عن «{q}»"></p>
```

Placeholders: `{n}`, `{category}`, `{q}`. Any missing attribute falls back to English.

## Theming

Every colour is a custom property at the top of `assets/css/styles.css`:

```css
--ink:    #100e0c;   /* page background */
--ink-2:  #1a1613;   /* cards */
--ink-3:  #292320;   /* borders */
--cream:  #f8f3ea;   /* light text */
--gold:   #e8b04b;   /* primary accent */
--ember:  #d1462f;   /* badges */
--green:  #4a8a5a;   /* vegetarian */
```

Fonts are [Cairo](https://fonts.google.com/specimen/Cairo) for headings and
[Tajawal](https://fonts.google.com/specimen/Tajawal) for body text, both with system
fallbacks so the page still reads correctly if the webfont fails to load.

## Before going live

- Replace the name, tagline and all body copy
- Replace the phone `+966 55 123 4567`, the WhatsApp number, the email and the Riyadh
  address (dashboard → معلومات المطعم)
- Update the opening hours
- Point `<link rel="canonical">` and the Open Graph tags at your real domain
- Fill in the social links
- Change the dashboard passcode, and ideally put `admin.html` behind real server auth

## Accessibility

- Skip link, landmark elements and a single `<h1>`
- Visible focus rings on every interactive element
- The filter toolbar exposes state with `aria-pressed` and supports arrow-key navigation
- Search results are announced through `role="status"`
- Phone numbers and emails are isolated with `dir="ltr"` so they read correctly in Arabic
- All motion is disabled under `prefers-reduced-motion: reduce`

## Known limitation

Because the menu renders from `menu.js`, **JavaScript is required to see the dishes**. A
`<noscript>` block shows the phone number instead. This is the trade-off that makes the
dashboard possible; if you need the dish names in the HTML for SEO, paste the rendered
markup into `index.html` and drop the renderer.

## Browser support

Any current version of Chrome, Edge, Firefox or Safari. Uses CSS custom properties, grid,
logical properties and `IntersectionObserver`, with fallbacks in `main.js`.

## Printing

`Ctrl/Cmd + P` produces a clean two-column menu sheet: navigation, hero, gallery, contact
card and footer are hidden, and the type switches to black on white.
