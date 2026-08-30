# برجر الجمر · Ember & Bun — burger restaurant website template

A professional, responsive restaurant website template shipped in two languages from one
codebase: **Arabic (RTL)** at `index.html` and **English (LTR)** at `index-en.html`.
Plain HTML, CSS and JavaScript — no build step, no dependencies, no framework. Open
`index.html` in a browser and it runs.

The Arabic page is the primary site; the English page is the same design mirrored, kept
so the template works for bilingual venues. Both share one stylesheet and one script.

## What's included

| Section | Notes |
| --- | --- |
| Top bar | Today's closing time, phone number, address |
| Sticky header | Logo, anchor nav with scroll-spy, mobile drawer, language switcher, booking CTA |
| Hero | Headline, lede, two CTAs, three proof points, illustrated burger |
| Marquee | Scrolling strip of selling points (mirrors direction in RTL) |
| Why us | Four icon cards — grilling, freshness, delivery, local sourcing |
| Most ordered | Three ranked highlight cards for first-time visitors |
| **Menu** | 25 dishes in 6 categories, **live search + category filter**, prices, dietary tags, empty state, allergen note |
| Deal band | Happy-hour offer with before/after pricing |
| Story | Copy plus a four-figure stats row |
| Gallery | Responsive masonry-style grid |
| Testimonials | Three review cards |
| Visit | Address, opening-hours table, perks |
| Booking form | Client-side validated reservation request |
| Footer | Link columns, newsletter sign-up, social links, auto-updating copyright year |

## Files

```
index.html              Arabic (RTL) site — the primary page
index-en.html           English (LTR) site
assets/css/styles.css   All styling — tokens, layout, components, RTL, responsive, print
assets/js/main.js       Nav, search, menu filter, scroll-spy, reveals, form validation
assets/img/*.svg        Logo, favicon and nine food illustrations (vector placeholders)
```

## Running it

Open `index.html` directly, or serve the folder:

```bash
python3 -m http.server 8000   # then visit http://localhost:8000
```

Deploy by uploading the folder to any static host — GitHub Pages, Netlify, Vercel,
Cloudflare Pages or plain shared hosting.

## How right-to-left works

`index.html` sets `<html lang="ar" dir="rtl">`, and that is the only switch. The
stylesheet contains **no `left`/`right` rules** — every directional property is logical
(`margin-inline-start`, `inset-inline-end`, `padding-inline`, `text-align: start`,
`border-inline-start`, `border-start-end-radius`), so the entire layout mirrors from the
`dir` attribute alone. There is no separate RTL stylesheet to keep in sync.

Three things needed explicit handling beyond that, and they are commented in the source:

- **The marquee** animates on `translateX`, which is a physical transform. A
  `[dir="rtl"]` rule swaps in a mirrored keyframe so the strip still scrolls into view.
- **Arabic typography.** Arabic is a connected script, so `letter-spacing` breaks the
  joins between letters — it is reset to `normal` on every component that tracks out its
  Latin text. `text-transform: uppercase` is also dropped, since Arabic has no letter
  case, and headings get more line-height for the taller glyphs.
- **Arrow keys** on the category filter follow visual direction, so <kbd>→</kbd> moves
  toward the start of the row in RTL.

To add a third language, copy `index.html`, change `lang`/`dir`, translate the markup,
and add the font stack under a `html[lang="xx"]` block. No JavaScript changes are needed
— see the next section.

## Translating without touching JavaScript

`assets/js/main.js` contains **no user-facing text**. Every message is read from a
`data-msg-*` attribute on the element that owns it, with `{placeholders}` filled at
runtime:

```html
<p class="menu-count" id="menuCount" role="status"
   data-msg-all="عرض جميع الأطباق ({n} طبقاً)"
   data-msg-category="عرض {n} من أطباق «{category}»"
   data-msg-search="{n} نتيجة للبحث عن «{q}»"></p>

<form id="reserveForm"
      data-msg-required="هذا الحقل مطلوب."
      data-msg-email="أدخل بريداً إلكترونياً صحيحاً."
      data-msg-past="اختر تاريخ اليوم أو تاريخاً لاحقاً."
      data-msg-fix="يُرجى تصحيح الحقول المحدّدة."
      data-msg-success="شكراً {name}، سنؤكد حجزك لـ {guests} أشخاص عبر البريد الإلكتروني.">
```

Available placeholders: `{n}` (result count), `{category}`, `{q}` (search term),
`{name}`, `{guests}`. Any missing attribute falls back to English.

## Customising

### Brand colours

Every colour comes from a handful of custom properties at the top of
`assets/css/styles.css`. Change these and the whole site follows:

```css
:root {
  --ink:    #141210;  /* page background */
  --ink-2:  #1e1a17;  /* cards and raised surfaces */
  --ink-3:  #2a2421;  /* borders */
  --cream:  #f7f1e8;  /* light text and surfaces */
  --amber:  #f0a72c;  /* primary accent — buttons, prices, links */
  --tomato: #d1462f;  /* secondary accent — badges */
}
```

Spacing, radii, shadows, container width, header height and the font stacks are tokens
in the same block.

### Fonts

- **Arabic:** [Cairo](https://fonts.google.com/specimen/Cairo) for headings,
  [Tajawal](https://fonts.google.com/specimen/Tajawal) for body text.
- **English:** [Bebas Neue](https://fonts.google.com/specimen/Bebas+Neue) for headings,
  [Inter](https://fonts.google.com/specimen/Inter) for body text.

Each page loads only the faces it needs. Swap the `<link>` in the page and the
`--font-display` / `--font-body` tokens (Arabic overrides live in the
`html[lang="ar"]` block). Every stack ends in a system fallback, so the page still looks
right if the webfont fails to load.

### Prices and currency

Prices are plain markup — the number and the currency are separate so the currency can
be styled smaller:

```html
<p class="card__price">45 <span>ر.س</span></p>
```

The Arabic page is priced in **Saudi riyals (ر.س)** and the English page in US dollars,
both as placeholders. To change currency, search the page for `ر.س` (or `$`) and replace.
Also update `currenciesAccepted` in the JSON-LD block at the top of `<head>`.

Digits are Western (`45`), not Arabic-Indic (`٤٥`), throughout — that is the common
convention on Arabic restaurant sites and keeps prices legible to every visitor. If you
prefer Arabic-Indic numerals, replace them in the markup; nothing in the CSS or JS
depends on the digit form.

### Menu items

Each dish is one `<li class="card">` in `#menuGrid`. Copy a block and edit it:

```html
<li class="card" data-category="beef">
  <div class="card__media"><img src="assets/img/thumb-burger.svg" alt="" loading="lazy" width="120" height="120"></div>
  <div class="card__body">
    <div class="card__head">
      <h3 class="card__title">اسم الطبق <span class="card__flag">الأكثر مبيعاً</span></h3>
      <p class="card__price">45 <span>ر.س</span></p>
    </div>
    <p class="card__desc">وصف قصير للمكوّنات.</p>
    <ul class="tags"><li class="tag">حار</li></ul>
  </div>
</li>
```

- `data-category` must match a `data-filter` value on one of the filter buttons. The
  Arabic page uses `beef`, `chicken`, `combo`, `sides`, `drinks`, `sweets`.
- To add a category, add one `<button class="chip" data-filter="yourkey">` to
  `.menu-filters` and use `data-category="yourkey"` on the dishes. The JavaScript picks
  it up automatically — no code changes needed.
- `card__flag` is the small pill next to the title; add `card__flag--green` for a green
  one (used for "نباتي" / "Vegan").

### How search works

The search box filters the same grid as the category chips, and the two combine. Each
card is indexed once from its full text, so **title, description and tags are all
searchable**.

Arabic input is normalised before matching: diacritics (tashkeel) and tatweel are
stripped, and alef (أ إ آ), yaa (ى ي), taa marbuta (ة/ه) and hamza forms are unified. So
searching `دجاج` matches `الدَّجاج`, and `شاورما` matches `شورما`. Latin text is simply
lower-cased. <kbd>Esc</kbd> clears the field.

### Photos

The illustrations in `assets/img/` are SVG placeholders so the template ships without
binary assets: burger, chicken burger, fries, onion rings, salad, soda, shake, dessert,
combo, plus a hero burger, a grill scene and the logo. Replace them with real
photography — the markup already sets `width`, `height` and `loading="lazy"`, so point
the `src` at your images and keep the dimensions proportional. If you use photos, also
replace the `og:image` meta tag with a JPEG or PNG: most social networks do not render
SVG previews.

### Wiring up the booking form

The form validates in the browser and then shows a confirmation without sending
anything. Replace the marked block in `assets/js/main.js` with a real request:

```js
fetch('/api/reservations', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(Object.fromEntries(new FormData(form)))
});
```

The same applies to the newsletter form in the footer.

### Real business details

Search both pages for these and replace them:

- The name برجر الجمر / "Ember & Bun", the tagline and all body copy
- Phone `+966 55 123 4567`, email, and the Riyadh address (English page: a US placeholder)
- The opening-hours table and the top-bar closing time
- The `application/ld+json` block near the top of `<head>` — this is
  [schema.org Restaurant](https://schema.org/Restaurant) data that search engines use for
  rich results, so keep it in sync with the visible hours and address
- `<link rel="canonical">` and the Open Graph tags
- The `#` placeholders on the social and legal links

The `hreflang` alternates already cross-link the two languages; update the URLs when you
deploy to a real domain.

## Accessibility

- Skip link, landmark elements and a single `<h1>` per page
- Visible focus rings on every interactive element
- The filter toolbar exposes state with `aria-pressed` and supports arrow-key navigation
- Search results and form errors are announced through `role="status"`; errors are tied
  to their fields with `aria-invalid`
- Colour pairings meet WCAG AA contrast on both the dark and amber surfaces
- Phone numbers and email addresses are isolated with `dir="ltr"` so they read correctly
  inside Arabic text
- All motion — the floating hero, the marquee, the scroll reveals — is disabled under
  `prefers-reduced-motion: reduce`

## Progressive enhancement

With JavaScript disabled the full menu stays visible (nothing is hidden by default), all
anchors work, and the forms fall back to native browser validation.

## Browser support

Any current version of Chrome, Edge, Firefox or Safari. Uses CSS custom properties,
grid, logical properties, `clamp()` and `IntersectionObserver`, all of which have
feature-detection or graceful fallbacks in `main.js`.

## Printing

`Ctrl/Cmd + P` produces a clean two-column menu sheet: navigation, hero, gallery, forms
and footer are hidden, and the type switches to black on white. Handy for in-house menus.
