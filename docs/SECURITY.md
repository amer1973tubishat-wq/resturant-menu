# Security

Two things live in this repository, and they have very different exposure.

| | `index.html` | `admin/` |
|---|---|---|
| What it is | The restaurant site and its dashboard, one source file | A Next.js admin application |
| Deployed | Yes, as two Claude artifacts built from it | No — never has been |
| Authorisation | Enforced by the artifact platform | Its own, in code |

The live product is built from `index.html`. The `admin/` app was built earlier
and superseded by the dashboard; it is kept for its schema and API design, and
it is not running anywhere.

## Two pages: the customer site carries no dashboard

`scripts/build.js` turns `index.html` into two separate pages, each published
at its own address:

| | Customer page | Admin page |
|---|---|---|
| Address | `claude.ai/artifact/UTkA8CPyEyiqpLFmUvEikg` | `claude.ai/artifact/UozoNEQNyZSkLSZ8jJ9vJj` |
| Built by | `build.js public` | `build.js admin` |
| Contains | the menu site, and its content as `content.json` | the whole site plus the dashboard, which opens on load |
| Capabilities | none | `db` (read: interact, write: admin) and `mcp` (one tool) |
| Shared with | whoever the owner shares it with | the owner only |

The customer page is not the admin page with the dashboard hidden. The build
deletes every region of `index.html` marked `@admin-css`, `@admin-html` and
`@admin-js` — the dashboard's markup, styles and code, the database
connection and the access probe — and then refuses to write the file if any
dashboard-only name survives. There is no route to guess, no button to find and
no database to call: a customer who reads the page source finds a menu.

The customer page gets its content from `content.json`, a data file published
beside it. The page fetches it and reads it as JSON; nothing in it is ever run.
It is applied through the same rendering paths as before, so the protections
under "Stored content is untrusted" below cover it too.

The admin page declares the `mcp` capability, and the platform does not allow
a page with that capability to be shared publicly, so it cannot be opened by
"anyone with the link" by mistake.

`tests/save-flow/split.js` holds this: that the customer page's source has no
dashboard markup, styles or code and no database calls; that it renders
published content, hostile content safely, and a missing `content.json` without
breaking; and that the admin page opens straight into the dashboard.

## Publishing

The dashboard saves into the admin page's database, which customers never
touch. The Publish button copies saved content to the customer page:

1. it saves anything unsaved first;
2. it records `{status: "requested"}` in `meta/publish`;
3. if the page has not yet been allowed to use the Claude Code Remote
   connector, it asks, from the click itself; then, through the `mcp`
   capability, it calls `fire_trigger` — the only tool the page declares —
   with the id of the owner's "Baytna Burger — publish website" Routine. A
   failure the platform marks safe to repeat is retried once; any failure is
   shown with its own message, logged to the console, and recorded in
   `meta/publish` with the platform's error code;
4. that Routine starts a fresh Claude Code session which reads the database,
   runs `build.js content` and `build.js public`, republishes the customer page
   and sets `meta/publish` to `live` (or `failed`, with the reason). The page
   shows the status as it changes.

The Routine id is in the admin page's source. That is not a key: `mcp` calls
run with the viewer's own connector, and a Routine can only be fired by the
account that owns it. Anyone else's call is refused.

## The dashboard is gated, as well as private

The admin page is shared with no one. If it ever is — someone given access,
or a copy of `index.html` opened elsewhere — the gate still holds: the panel
renders only for a viewer the database accepts writes from. Anyone else gets a
short "not available" page — no form controls, and not even a read-only copy
of the content. The access question is asked again each time the dashboard is
opened, because access can be granted or withdrawn while a page sits open, and
a stale answer either locks the owner out or lets someone in.

`index.html` on its own (as the test suites drive it) still opens the
dashboard at an unlisted address, `#manage-` followed by sixteen hex
characters, behind the same gate. `tests/save-flow/private-route.js` holds
that: no link points at the route, `#admin` and other guesses open nothing,
the real address works for an editor, and it yields nothing to anyone else.

## Where authorisation actually happens

There is deliberately no password in `index.html`. A password checked in
browser JavaScript is visible in view-source and protects nothing.

The admin page declares the `db` capability with `{ read: "interact", write:
"admin" }`. The platform accepts writes only from viewers with edit access to
the artifact; every save anyone else attempts is refused by the server. The
gate and the read-only state in the interface are courtesies, not the control
— they tell an honest viewer what will happen, and do nothing to stop a
dishonest one, because they do not need to. (Checked against the live store:
a write at the `interact` level is refused.)

The three ways that can be checked:

- open the dashboard as a viewer without edit access — it shows "not
  available", and a forced Save answers with the refusal from the server;
- `tests/save-flow/button-answers.js` holds that behaviour;
- the stored content is unchanged afterwards, which that suite also asserts.

## Stored content is untrusted

Everything the page renders — item names, descriptions, category labels,
headings, the brand wordmark, image references, the WhatsApp number — comes out
of a database that is writable by the artifact's editors and readable by its
viewers. The runtime contract states that shared data is untrusted, and the
page treats it that way:

- every value interpolated into HTML passes through `esc()`, which escapes
  `& < > " '`, and every attribute it lands in is quoted;
- admin-supplied text goes into the public page as text nodes plus `<br>`,
  never as `innerHTML`, so a stored line break renders and stored markup does
  not;
- an image reference resolves through `safeImageUrl()`, which accepts only an
  `https://` URL or an inline `data:image/...;base64` payload. A `javascript:`
  URL, a `data:text/html` document, or a protocol-relative `//host` resolves to
  nothing and the built-in illustration is drawn instead. The same rule applies
  to a URL pasted into the dashboard and to one already in the store, because a
  stored media document is editable content too;
- the WhatsApp number is reduced to digits before it is put in a link, and a
  social or map link is accepted only as an `https://` URL — an empty one hides
  its button rather than leaving a dead `href="#"` on the page;
- a palette colour is accepted only as `#rrggbb`. Anything else is dropped
  before it reaches the style engine, so a stored value cannot become CSS;
- a lookup whose key is stored content (`badges[item.badge]`, `MEDIA[id]`) is an
  own-property read, so a value like `constructor` returns nothing rather than
  walking the prototype chain;
- a dotted path may not contain `__proto__`, `constructor` or `prototype`, so an
  edited field cannot become a change to every object on the page;
- arrays out of the store are filtered to objects before use — a malformed
  document must not throw inside a render and blank the site.

`tests/save-flow/content-safety.js` stores twelve payloads in every content
field, across both languages and all seven dashboard tabs, and requires that
nothing executes: no dialog, no thrown error, no flag set on `window`, no
element carrying a script URL or an event-handler attribute. It also asserts
the payloads are *visible as text*, so a passing run cannot mean the content
was silently dropped.

## Limits, so a mistake stays a mistake

A store document caps at 256 KiB. Without limits a single long paste puts a
document over, every save fails from then on, and the dashboard is stuck with
no explanation.

- each text control carries its own `maxlength`, enforced again in
  `applyControl()` whatever route the text arrived by;
- numbers are clamped where they are read and again where they are rendered, so
  a price out of the database cannot be negative, infinite, or a billion;
- a document is measured before it is written, and an oversized one is refused
  with a sentence naming what to do about it, rather than failing forever with
  the store's generic error;
- a failed save pauses automatic saving for fifteen seconds. Without that, the
  error redraws the panel, the redraw destroys the focused field, the resulting
  `focusout` flushes another save, and the loop runs a failing write every few
  milliseconds — measured at 55 attempts in 6 seconds before the hold existed;
- diagnostics are kept in memory and folded into the one save record, instead
  of a database write per button press. The write budget is shared with the
  saves themselves, and spending it on telemetry can get real saves refused.

## Dependencies

`index.html` has no dependencies. It loads fonts from Google and nothing else.

`admin/` was carrying Next.js 14, which has no patched release: every version
up to 15.5.23 is affected by 23 advisories including an unauthenticated remote
code execution in the image optimiser. It is now on Next 16 with React 19,
which clears every runtime advisory; `cookies()` became async in Next 15 and
the one call site was updated.

What remains is seven advisories in `braces`, reached only through
`tailwindcss → chokidar` and `eslint-config-next → fast-glob → micromatch`.
They are build-time dependencies, they never run in a process that handles a
request, the attack requires feeding a hostile glob pattern to your own build,
and no fixed version of `braces` has been published. `npm audit` will keep
reporting them until one is.

Re-check with:

    cd admin && npm audit        # runtime advisories: none
    cd admin && npx tsc --noEmit # clean

## Secrets

No credential is committed. `.mcp.json` reads its API key from
`${TWENTYFIRST_API_KEY}`; `.gitignore` covers `.env`, `.env.local` and
`.mcp.local.json`; `admin/.env.example` holds names and no values. The API key
that was pasted into a conversation during development never reached a commit —
verified across all 17 commits in the history.

## What this does not cover

- The artifact platform's own access control is trusted. If someone is given
  edit access to the artifact, they can change the menu; that is what edit
  access means.
- The customer page shows what was last published, not what was last saved.
  Publishing takes a few minutes and runs a Claude Code session on the owner's
  account; if the Claude Code Remote connector is unavailable, the dashboard
  says so and the customer page keeps its last published content.
- The source of the dashboard is in this repository, which is public. It holds
  no secrets, and knowing it gives no access: access is the platform's.
- `admin/` has not been run, built or penetration-tested in its upgraded form.
  It typechecks; that is all that is claimed.
