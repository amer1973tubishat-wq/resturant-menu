# Save-flow tests

These exercise the dashboard's save path the way a browser does: real DOM, real
clicks, real cookies-free page loads. The artifact `db` capability is replaced
by a mock in `mock.js` that stores documents in a JSON file on disk, so
"refresh", "another browser" and "another device" are genuine tests of
persistence rather than of in-memory state.

The mock mirrors the parts of the contract the page depends on:

- `claude.use()` resolves **asynchronously**, never during the first
  synchronous run — this is what exposed the original bug.
- `doc().set()` replaces a whole document; writes are serialised so two
  documents saved together cannot clobber each other, as in the real store.
- `onSnapshot` fires once shortly after registration, then on every change.
- Writes can be made to fail (`__MOCK.failWrites`) or to be refused for lack of
  edit access (`__MOCK.canEdit`).
- `__MOCK.forceNotify()` re-delivers the current state without a change, which
  is what the contract's ~30 s periodic refresh does. This is what exposed the
  panel rebuilding itself under the user's hands.
- A write notifies only the listeners of the document that changed, as the
  live store does.
- Reads return object keys **alphabetised**, because the live store does
  (verified against it: `{o,c}` came back as `{c,o}`). Without this the mock
  let an order-sensitive comparison pass here and fail in production.

## Running

Needs Playwright and a Chromium build:

```bash
npm i -D playwright
node tests/save-flow/suite.js         # persistence
node tests/save-flow/save-button.js   # the save control itself
node tests/save-flow/live-editing.js  # edits survive database snapshots
node tests/save-flow/operations.js    # every edit reports success honestly
node tests/save-flow/resilience.js    # a save survives a lost change log
```

The runner uses a preinstalled Chromium at `/opt/pw-browsers/...` when present;
otherwise set `CHROMIUM_PATH` to the binary. The store file is written under
`$TMPDIR`, never into the repository.

Exit code is non-zero if any check fails.

## What is covered

| Scenario | Asserts |
| --- | --- |
| Land directly on `#admin` | the editor loads stored content, not built-in defaults |
| Save one field | untouched items, headings and branding all survive |
| Save then refresh | the value is still there |
| Reopen in a separate browser context | another session reads the stored value |
| Several fields in one save | every field lands |
| Delete every item | an empty menu persists instead of reverting to defaults |
| Hammer the save button | six clicks do not fan out into many writes |
| A failing write | no false success, a clear error, the unsaved bar stays, input preserved, store untouched, and a retry succeeds |
| Two sessions | one save does not overwrite the other's untouched fields |
| An account without edit access | read-only, inputs disabled, store untouched |

`save-button.js` covers the control itself, at desktop and phone width: both
save buttons are on screen, fully opaque, unobstructed and clickable the moment
the dashboard opens; an unsaved-changes dot appears on both when a field
changes and clears once the write is confirmed; the top button saves; and
clicking with nothing pending answers "Nothing to save" rather than sitting
silent. The button is deliberately never disabled — a dimmed one reads as an
absent one.

`live-editing.js` guards the case that made saving feel broken in practice: a
snapshot arriving mid-edit. It checks that a typed value, the focus and the
caret position all survive one, and that a name typed while snapshots keep
arriving is not truncated. Before the fix, typing "Shawarma Deluxe" through a
stream of snapshots left "Sha" in the field.

`operations.js` runs every editing action a person actually performs — add,
delete, reorder, badge, category change, brand, headings, hours, image URL —
and asserts each one reports success honestly, with no error and a
confirmation. This is the suite that caught adding an item reporting "The
database did not keep: items" while having saved perfectly well.

`resilience.js` covers the failure the live database pointed to: saves that
wrote nothing at all while reporting no error. What to write is now derived by
comparing the draft against the copy that was loaded, so a save still works
when the change log is empty; every attempt is recorded in `meta/last-save`,
and pressing save with genuinely nothing changed leaves the store untouched.

## form-truth.js

Added after the live database recorded six consecutive save attempts as
`outcome: "nothing"`, `detail: "no field differed from the loaded copy"`, with
`dirty: false` and nothing touched. The dashboard was describing its own model
accurately; the model simply never received the typing, because the only route
from a keystroke to the draft was one delegated listener on `document`.

Every test here begins from an edit that exists **only in the DOM** — the state
the database caught — and requires that a save still write it. That is the
guarantee: what is on screen is what gets saved.

Run it after any change to the dashboard's rendering, event handling or save
path:

    node tests/save-flow/form-truth.js
