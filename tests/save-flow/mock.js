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
window.__MOCK = { canEdit: true, failWrites: false, latencyMs: 40, useDelayMs: 250, writeLog: [] };

(function () {
  var listeners = [];

  function clone(v) { return JSON.parse(JSON.stringify(v)); }
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

  function notify() {
    return readAll().then(function (all) {
      listeners.forEach(function (l) {
        if (l.type === 'doc') {
          var d = all[l.path];
          l.next({ exists: d !== undefined, id: l.path.split('/').pop(), data: function () { return clone(d || {}); } });
        }
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
              var d = all[path];
              res({ exists: d !== undefined, id: path.split('/').pop(), data: function () { return clone(d || {}); } });
            });
          }, window.__MOCK.latencyMs);
        });
      },
      set: function (data) {
        return new Promise(function (res, rej) {
          setTimeout(function () {
            if (!window.__MOCK.canEdit) { rej({ code: 'invalid_argument', message: 'below required level' }); return; }
            if (window.__MOCK.failWrites) { rej({ code: 'unavailable', message: 'transient' }); return; }
            window.__MOCK.writeLog.push({ path: path, at: Date.now() });
            mutate(function (all) { all[path] = clone(data); })
              .then(function () { return notify(); }).then(res);
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

  var ns = Object.freeze({ doc: docRef, collection: collRef });

  window.claude = {
    use: function (name) {
      // Deliberately asynchronous, exactly as the real contract promises.
      return new Promise(function (res) {
        setTimeout(function () { res(name === 'db' ? ns : null); }, window.__MOCK.useDelayMs);
      });
    }
  };
})();
