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

## Running

Needs Playwright and a Chromium build:

```bash
npm i -D playwright
node tests/save-flow/suite.js
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
