# Baytna Burger — site notes

Single self-contained page at `index.html`. No build step, no framework, no
runtime dependencies: open the file or serve the folder.

```bash
python3 -m http.server 8000   # then open http://localhost:8000
```

## Before going live

| What | Where | Current value |
| --- | --- | --- |
| WhatsApp number | `WA_NUMBER` in the script | `962790000000` (placeholder) |
| Phone number | `tel:` link in the Visit section | `+962 7 9000 0000` (placeholder) |
| Social links | footer `.socials` | `#` |
| Map location | `#directions` link + the SVG pin | Rainbow St search query |
| Opening hours | `HOURS` array | Sun–Thu 12:00–01:00, Fri 13:00–02:00, Sat 12:00–02:00 |
| Menu, prices | `BURGERS` / `SIDES` arrays | JD, tax inclusive |

Burger art is inline SVG, so there are no image files to host. To use photos,
replace the `<use href="#burger"/>` in `.card-art` and `.hero-art` with `<img>`.

## The admin route

The footer's **Admin** link opens `#admin` — a dashboard built into the page for
editing the menu, hero text, opening hours and contact details. Saved changes
land in the artifact's database and appear on the public view immediately, for
every open tab.

**Authorisation is server-side.** The published page declares the `db`
capability with the rule `{ read: "interact", write: "admin" }`, so the platform
accepts writes only from viewers who have *edit* access to the artifact. Someone
with the link can open `#admin` and look, but every save is refused by the
server. On opening the panel the page performs one real write to
`meta/access-probe` to find out which side of that line the viewer is on, rather
than assuming.

There is deliberately **no password in this file**. A password checked in
client-side JavaScript is visible in view-source and protects nothing; access is
delegated to the platform's own sharing controls instead.

Content read back from the database is escaped before it reaches `innerHTML` —
the runtime contract treats shared data as untrusted, and so does this page.

Opened as a local file there is no database, so the panel reports that plainly,
disables every input, and the public page renders from the defaults in this file.

## How a few things work

**Open / closed indicator** is computed in Amman time via
`Intl.DateTimeFormat` with `timeZone: 'Asia/Amman'`, so it is correct for
visitors in any timezone. Hours that run past midnight are stored as minutes
over 1440 (01:00 = 1500) and the previous day's session is checked for the
after-midnight window. It refreshes every 30s.

**Bilingual EN/AR** swaps `lang`/`dir` on `<html>`, re-renders everything from
the `T` table, and remembers the choice in `localStorage`. Arabic switches the
display face to Cairo (Anton has no Arabic glyphs) and the currency to د.أ.

**Animation** is CSS transitions driven by an IntersectionObserver. Because an
instant jump can carry the viewport past an element without ever crossing an
observer threshold, a scroll sweep reveals anything left above the viewport —
without it, anchor navigation permanently hides sections.

**Fonts** load from Google Fonts with a condensed fallback stack. The hero is
sized so headlines fit their clip mask even when the webfont fails.

`prefers-reduced-motion` disables loops and long transitions; content stays
visible. Without JavaScript the loader is hidden and nothing is left at
`opacity: 0`.

## Verified

Chromium, at 320 / 390 / 768 / 1024 / 1440 px in both languages: no horizontal
overflow, no clipped headlines, all sections reveal, no console errors. Builder
totals check out (brioche 0 + double 5.50 + cheddar 0.50 + pickles 0.25 = 6.25).
