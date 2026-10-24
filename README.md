# resturant-menu

Baytna Burger runs as two pages, both built from `index.html`:

| Page | Address | Who opens it |
|---|---|---|
| Website | https://claude.ai/artifact/UTkA8CPyEyiqpLFmUvEikg | Customers. Has no dashboard in it at all. |
| Admin | https://claude.ai/artifact/UozoNEQNyZSkLSZ8jJ9vJj | The owner only. Opens straight into the dashboard. |

## Editing the site

Open the admin page (and sign in, once you have set a password in the Security
tab). Everything on the site is editable there, in both Arabic and English:

| Tab | What it covers |
|---|---|
| المنيو / Menu | Items: name, price, description, category, heat, badge, photo |
| الأقسام / Categories | The sections shown before the menu, with their images |
| الاسم / Brand | The restaurant name, in two parts, and the logo |
| الواجهة / Hero | The main photograph |
| النصوص / Text | Every string on the site — navigation, headlines, buttons, story, opening status, currency, footer — plus the ingredient chips |
| الموقع / Location | The Google Maps link the map and directions open, the name and address on the map, and a picture of the map (a screenshot) in place of the drawn one |
| الألوان / Colours | The four colours the whole site is built from |
| الأوقات / Hours | Opening and closing times, per day |
| التواصل / Contact | WhatsApp, phone, Instagram, Facebook, TikTok |
| الأمان / Security | The dashboard password: set, change or remove it |

Saving is automatic: a change is written about a second after you stop typing,
immediately when you leave a field, and again if the page is closed. The Save
button is still there, and means "save now".

`tests/save-flow/editable.js` fails if a string is added to the page without
being exposed here.

Saved changes reach customers when you press **Publish**. That starts a
background task (the "Baytna Burger — publish website" Routine in Claude Code)
which copies the saved content onto the website; it takes a few minutes, and
the status beside the button says when the website is up to date.

## Building

```bash
node scripts/build.js public              # dist/public/index.html — the website, dashboard removed
node scripts/build.js content <dump-dir>  # dist/public/content.json — from a dump of the admin database
node scripts/build.js admin               # dist/admin.html — the admin page
```

The website build fails if any dashboard code would reach it. See
`docs/SECURITY.md`.

## Cloudflare

The same site also runs as a Cloudflare Worker (`wrangler.jsonc`, `worker/`),
with the dashboard on the Worker's own server instead of claude.ai:

- `/` is the customer page; it loads `/content.json`, which the Worker builds
  live from Workers KV, so a save in the dashboard shows up at once.
- `/admin` is the dashboard. `worker/admin-shim.js` stands in for the Claude
  database and saves through the Worker's `/api`. Every write needs a session
  from `/api/login`, checked on the server.
- The password is the `ADMIN_PASSWORD` secret (Worker → Settings → Variables
  and Secrets → Secret). It is never in the repository. Changing it signs
  everyone out.
- Until the dashboard first saves, the menu and texts come from
  `published/content.json`.

Workers Builds settings: build command `node scripts/build.js all`, deploy
command `npx wrangler deploy`, version command `npx wrangler versions upload`.
The build sees `WORKERS_CI=1` and produces the standalone pages.
