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
| `manage/index.html` | The private dashboard, served at `/manage/` — not linked from the site, and marked `noindex` |

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
manage/index.html          Private dashboard (its own URL: /manage/)
assets/data/menu.js        ← all menu content lives here (single source of truth)
assets/css/styles.css      Site styling — tokens, layout, components, RTL, responsive, print
assets/css/admin.css       Dashboard styling
assets/js/main.js          Renders the menu; nav, search, filter, scroll-spy, reveals
assets/js/admin.js         Dashboard logic
tools/build.mjs            Pre-renders the menu into index.html (optional, Node)
CNAME                      Custom domain for GitHub Pages (chef-hashem.com)
robots.txt / sitemap.xml   Search-engine basics
DEPLOY.md                  Hosting, DNS records and protecting /manage/
assets/img/*.svg           13 vector placeholders: logo, favicon, hero burger, grill scene
                           and 9 dish thumbnails
```

## Running it

Open `index.html` directly, or serve the folder:

```bash
python3 -m http.server 8000   # then http://localhost:8000
```

The site is set up for **chef-hashem.com**: the `CNAME` file, the canonical URL, the
Open Graph tags, `robots.txt` and the JSON-LD `url` all point at it. Enabling hosting and
adding the DNS records are the two remaining steps — `DEPLOY.md` has them.

It deploys to any static host: GitHub Pages, Netlify, Vercel, Cloudflare Pages or plain
shared hosting.

---

## The dashboard

Open **`/manage/`** and enter the passcode. The default is `hashem2014`, and you can
change it from the dashboard's **كلمة المرور** tab.

You can:

- **Add, edit, delete and reorder dishes** — name, category, price, description, image,
  badge, tags, and whether the dish appears under "الأكثر طلباً" on the homepage. The
  order in the list is the order on the site.
- **Manage categories** — add, rename, reorder. A category that still has dishes in it
  cannot be deleted, so you can't orphan items by accident.
- **Upload images** — for each dish, the restaurant logo, the big homepage image, and the
  five gallery tiles. Pick a file, paste a path or URL, or choose a built-in illustration.
- **Edit restaurant details** — name, tagline, phone, WhatsApp number, email, address,
  map link, currency symbol, social links, and the opening-hours table.
- **Change the passcode.**

### How images are stored

There is no server to upload to, so an uploaded image is downscaled in the browser and
stored inside the menu data as a `data:` URI. Dishes are capped at 500px and re-encoded as
JPEG, the homepage image at 900px, gallery tiles at 700px, and the logo at 256px as PNG so
transparency survives. In practice a 1.4 MB phone photo lands around 30–60 KB.

The dashboard shows the total data size beside the save button and turns it amber past
about 3.5 MB, because browser storage runs out around 5 MB. A save that fails for that
reason says so rather than failing silently.

### How saving works

**حفظ (Save)** writes your changes to this browser's `localStorage`. The site reads that
immediately, so you see real changes on your own machine — a "معاينة محلية" flag appears
on the site while you're looking at local edits rather than the published file.

**استعادة الأصل (Reset)** discards those local edits and returns to whatever
`assets/data/menu.js` contains. It leaves your passcode alone.

> **What this does not do:** edits stay in the browser you made them in. They do **not**
> reach other visitors. To publish for everyone, edit `assets/data/menu.js`, run
> `node tools/build.mjs`, and re-upload — see `DEPLOY.md`. Publishing straight from the
> dashboard would need a server or a CMS, which a static site doesn't have.

### About the passcode — read this

The passcode can be changed from the dashboard. That change is stored in the browser you
made it in; the tab also shows the hash to paste into `PASS_HASH` in
`assets/js/admin.js` if you want it to apply everywhere.

Either way the gate is **client-side only, and it is not security.** It keeps the page from
being opened casually; it does not protect anything. The entire site — including
`admin.js` and the passcode hash — is downloaded by every visitor, so anyone determined
enough can read it and can also read the menu data directly.

That is acceptable here because a menu contains nothing secret. **Do not put anything
sensitive in the dashboard**, and do not treat it as an account system.

If you need genuine protection, put `/manage/` behind server-side auth — HTTP basic auth
on the directory, Netlify/Cloudflare Access, or a host-level password. `DEPLOY.md` has the
exact steps per host.

To change it for every browser at once, use the dashboard's password tab and paste the
hash it shows into `PASS_HASH` at the top of `assets/js/admin.js`.

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
- The canonical and Open Graph tags already point at `chef-hashem.com`; change them if
  the domain changes
- Fill in the social links
- Change the dashboard passcode, and ideally put `/manage/` behind real server auth
- Point a custom domain at the site — `DEPLOY.md` has the DNS records

## Accessibility

- Skip link, landmark elements and a single `<h1>`
- Visible focus rings on every interactive element
- The filter toolbar exposes state with `aria-pressed` and supports arrow-key navigation
- Search results are announced through `role="status"`
- Phone numbers and emails are isolated with `dir="ltr"` so they read correctly in Arabic
- All motion is disabled under `prefers-reduced-motion: reduce`

## The menu is in the HTML

The dishes are written into `index.html` as real markup, so search engines index them and
the menu still displays with JavaScript switched off. When JavaScript runs it re-renders
the same menu from `assets/data/menu.js`, which is what lets the dashboard's local edits
show up.

That means there are two copies of the menu, and a generator keeps them in step:

```bash
node tools/build.mjs        # after editing assets/data/menu.js
```

It rewrites only the regions between `<!--build:x-->` markers, plus the `data-bind`
fields, the `<title>` and the JSON-LD block. Nothing else in `index.html` is touched, and
running it twice changes nothing the second time. Node 18+ is needed, but only for this
script — the site itself has no build step and no dependencies.

If you skip it, the site still works: visitors with JavaScript (essentially everyone) see
the current menu either way. What goes stale is the copy that crawlers and no-JS visitors
read.

Without JavaScript the dishes, prices, tags, hours and contact links are all present; only
the search box and the category filter are unavailable, and they're hidden rather than
shown dead. The structured-data block lists every dish with its price, so the menu is
eligible for rich results.

## Browser support

Any current version of Chrome, Edge, Firefox or Safari. Uses CSS custom properties, grid,
logical properties and `IntersectionObserver`, with fallbacks in `main.js`.

## Printing

`Ctrl/Cmd + P` produces a clean two-column menu sheet: navigation, hero, gallery, contact
card and footer are hidden, and the type switches to black on white.
