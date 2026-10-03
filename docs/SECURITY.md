# Security

Two things live in this repository, and they have very different exposure.

| | `index.html` | `admin/` |
|---|---|---|
| What it is | The restaurant site and its dashboard, one file | A Next.js admin application |
| Deployed | Yes, as a Claude artifact | No — never has been |
| Authorisation | Enforced by the artifact platform | Its own, in code |

The live product is `index.html`. The `admin/` app was built earlier and
superseded by the dashboard inside the artifact; it is kept for its schema and
API design, and it is not running anywhere.

## Where authorisation actually happens

There is deliberately no password in `index.html`. A password checked in
browser JavaScript is visible in view-source and protects nothing.

The page declares the `db` capability with `{ read: "interact", write:
"admin" }`. The platform accepts writes only from viewers with edit access to
the artifact. Anyone with the link can open `#admin` and read the dashboard;
every save they attempt is refused by the server. The read-only state in the
interface is a courtesy, not the control — it tells an honest viewer what will
happen, and does nothing to stop a dishonest one, because it does not need to.

The three ways that can be checked:

- open the page as a viewer without edit access — the status pill reads
  "Read-only", and pressing Save answers with the refusal from the server;
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
- the WhatsApp number is reduced to digits before it is put in a link;
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
- Anyone with the link can read the dashboard's contents. The content is the
  public menu, so this costs nothing, but it is not a private admin area.
- `admin/` has not been run, built or penetration-tested in its upgraded form.
  It typechecks; that is all that is claimed.
