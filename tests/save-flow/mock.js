/**
 * Faithful-enough mock of the artifact `db` capability, backed by a JSON file
 * on disk via two functions Playwright exposes. Persisting to disk is the
 * point: it makes "refresh", "new browser" and "another device" real tests.
 *
 * It mirrors the parts of the contract this page uses:
 *  - claude.use() resolves LATER, never synchronously (this is what exposes
 *    the ordering bug)
 *  - doc().get() -> {exists, data()}
 *  - doc().set() replaces the whole document
 *  - onSnapshot fires once soon after registration, then on every change
 *  - collection().get() -> snapshot with forEach
 */
/* hangWrites models the one failure a promise cannot report: a write that
   neither resolves nor rejects. The page has to time it out itself. The access
   probe is exempt, so the dashboard still opens as an editor. */
window.__MOCK = { canEdit: true, failWrites: false, hangWrites: false,
                  shareReads: false, failContentWrites: false, mcpMode: 'ok', mcpCalls: [],
    /* Fail the first call with this code, marked safe to repeat. */
    mcpFailFirst: null,
    /* The permissions surface: 'granted', 'prompt', 'denied', or 'absent'
       (no namespace). permAnswer is what a prompt resolves to. */
    permState: 'granted', permAnswer: 'granted', permRequests: 0, permManage: 0, latencyMs: 40, useDelayMs: 250, writeLog: [], attempts: [] };
/* Documents handed out by reference when shareReads is on. */
var cache = {};

(function () {
  var listeners = [];

  /* The real store returns object keys ALPHABETISED, not in the order they
     were written (verified against the live database: {o,c} came back as
     {c,o}). Reads mirror that, because an order-sensitive comparison in the
     page would otherwise pass here and fail in production. */
  function sortKeys(v) {
    if (Array.isArray(v)) return v.map(sortKeys);
    if (v && typeof v === 'object') {
      const out = {};
      Object.keys(v).sort().forEach(function (k) { out[k] = sortKeys(v[k]); });
      return out;
    }
    return v;
  }
  function clone(v) { return sortKeys(JSON.parse(JSON.stringify(v))); }
  function readAll() { return window.__storeRead().then(function (t) { return JSON.parse(t || '{}'); }); }
  function writeAll(o) { return window.__storeWrite(JSON.stringify(o)); }

  /* The real store writes per document, so two documents saved at once cannot
     clobber each other. This mock keeps one JSON file, so mutations are
     serialised through a queue to reproduce that same guarantee. */
  var queue = Promise.resolve();
  function mutate(fn) {
    queue = queue.then(function () {
      return readAll().then(function (all) { fn(all); return writeAll(all); });
    });
    return queue;
  }

  /* The real store delivers to the listeners of the document that changed.
     Notifying every listener made unrelated writes look like content updates. */
  /* How a document is handed to the page — the one place that decides, so a
     get() and an arriving snapshot behave identically.

     With shareReads on, every read of a path returns the SAME object, refreshed
     in place. That is the behaviour a store with a document cache has, and it
     is what made the page's edits vanish: the draft was built out of these
     objects, so a refresh overwrote the typing inside the draft itself. */
  function handOut(path, d) {
    if (!window.__MOCK.shareReads) {
      return { exists: d !== undefined, id: path.split('/').pop(), data: function () { return clone(d || {}); } };
    }
    var c = cache[path] = cache[path] || {};
    Object.keys(c).forEach(function (k) { delete c[k]; });
    var fresh = clone(d || {});
    Object.keys(fresh).forEach(function (k) { c[k] = fresh[k]; });
    return { exists: d !== undefined, id: path.split('/').pop(), data: function () { return c; } };
  }

  function notify(changedPath) {
    return readAll().then(function (all) {
      listeners.forEach(function (l) {
        if (changedPath && l.path !== changedPath) return;
        if (l.type === 'doc') l.next(handOut(l.path, all[l.path]));
      });
    });
  }

  function docRef(path) {
    if (path.split('/').length % 2 !== 0) throw new TypeError('document path needs an even segment count: ' + path);
    return {
      id: path.split('/').pop(),
      path: path,
      get: function () {
        return new Promise(function (res) {
          setTimeout(function () {
            readAll().then(function (all) {
              res(handOut(path, all[path]));
            });
          }, window.__MOCK.latencyMs);
        });
      },
      set: function (data) {
        /* Every attempt, including the refused ones. Logging only successful
           writes made a backoff indistinguishable from doing nothing. */
        window.__MOCK.attempts.push({ path: path, at: Date.now() });
        return new Promise(function (res, rej) {
          setTimeout(function () {
            if (!window.__MOCK.canEdit) { rej({ code: 'invalid_argument', message: 'below required level' }); return; }
            if (window.__MOCK.failWrites) { rej({ code: 'unavailable', message: 'transient' }); return; }
            /* Content writes fail while the access probe still succeeds — the
               shape of a document the store will not take, where the viewer's
               permission is fine. */
            if (window.__MOCK.failContentWrites && path.indexOf('content/') === 0) {
              rej({ code: 'unavailable', message: 'content refused' }); return;
            }
            if (window.__MOCK.hangWrites && path.indexOf('meta/') !== 0) return;   /* never settles */
            window.__MOCK.writeLog.push({ path: path, at: Date.now() });
            mutate(function (all) { all[path] = clone(data); })
              .then(function () { return notify(path); }).then(res);
          }, window.__MOCK.latencyMs);
        });
      },
      update: function (d) { return this.set(d); },
      delete: function () {
        return mutate(function (all) { delete all[path]; }).then(notify);
      },
      onSnapshot: function (next, err) {
        var l = { type: 'doc', path: path, next: next, error: err };
        listeners.push(l);
        setTimeout(function () { notify(); }, 30);
        return function () { listeners = listeners.filter(function (x) { return x !== l; }); };
      },
      collection: function (sub) { return collRef(path + '/' + sub); }
    };
  }

  function collRef(path) {
    return {
      path: path,
      doc: function (id) { return docRef(path + '/' + id); },
      get: function () {
        return new Promise(function (res) {
          setTimeout(function () {
            readAll().then(function (all) {
              var docs = Object.keys(all)
                .filter(function (k) { return k.indexOf(path + '/') === 0 && k.split('/').length === path.split('/').length + 1; })
                .map(function (k) { return { id: k.split('/').pop(), data: function () { return clone(all[k]); } }; });
              res({ forEach: function (fn) { docs.forEach(fn); }, size: docs.length, docs: docs });
            });
          }, window.__MOCK.latencyMs);
        });
      }
    };
  }

  /* The contract says delivery falls back to a periodic refresh (~30 s), which
     re-delivers the current state even when nothing changed. This exposes that. */
  window.__MOCK.forceNotify = function () { return notify(); };

  var ns = Object.freeze({ doc: docRef, collection: collRef });

  /* The mcp capability, for the admin page's Publish button. mcpMode picks
     what the connector does: 'ok' records the call and answers, an error code
     rejects with exactly that code, and 'absent' makes use('mcp') resolve
     null — the view cannot run connectors at all. */
  var mcpNs = {
    callTool: function (server, tool, input) {
      window.__MOCK.mcpCalls.push({ server: server, tool: tool, input: input, at: Date.now() });
      var mode = window.__MOCK.mcpMode;
      var first = window.__MOCK.mcpFailFirst;
      if (first) window.__MOCK.mcpFailFirst = null;
      return new Promise(function (res, rej) {
        setTimeout(function () {
          if (first) rej({ code: first, message: 'mock ' + first, retryable: true, retryAfterMs: 50 });
          else if (mode === 'ok') res({ content: [], payload: { ok: true } });
          else rej({ code: mode, message: 'mock ' + mode });
        }, 30);
      });
    },
    listTools: function () { return Promise.resolve({ servers: [] }); }
  };

  /* The built-in permissions capability, as far as the Publish button uses it. */
  var permNs = {
    state: function (name) {
      return Promise.resolve(window.__MOCK.permState);
    },
    request: function (names) {
      window.__MOCK.permRequests++;
      var out = {};
      (names || []).forEach(function (n) {
        out[n] = window.__MOCK.permState === 'prompt' ? window.__MOCK.permAnswer : window.__MOCK.permState;
      });
      if (window.__MOCK.permState === 'prompt') window.__MOCK.permState = window.__MOCK.permAnswer;
      return Promise.resolve(out);
    },
    manage: function () { window.__MOCK.permManage++; return Promise.resolve(); }
  };

  window.claude = {
    use: function (name) {
      // Deliberately asynchronous, exactly as the real contract promises.
      return new Promise(function (res) {
        setTimeout(function () {
          if (name === 'db') res(ns);
          else if (name === 'mcp') res(window.__MOCK.mcpMode === 'absent' ? null : mcpNs);
          else if (name === 'permissions') res(window.__MOCK.permState === 'absent' ? null : permNs);
          else res(null);
        }, window.__MOCK.useDelayMs);
      });
    }
  };
})();
