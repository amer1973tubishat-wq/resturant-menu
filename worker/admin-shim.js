/* Dashboard on Cloudflare: stands in for the Claude viewer's database so the
   dashboard code runs unchanged, saving through the Worker's /api instead.
   Signing in happens here, on the server's terms; until then the dashboard
   gets no database. Inlined into the page by scripts/build.js. */
(function () {
  'use strict';
  var POLL_MS = 20000;
  var listeners = [];

  function clone(v) { return v === undefined ? undefined : JSON.parse(JSON.stringify(v)); }

  function call(method, url, body) {
    var opts = { method: method, credentials: 'same-origin', headers: { 'X-Baytna': '1' } };
    if (body !== undefined) {
      opts.headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(body);
    }
    return fetch(url, opts).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (r.ok) return j;
        var e = new Error(j.error || ('HTTP ' + r.status));
        /* The dashboard reads these codes: invalid_argument is "no permission"
           (not retried), unavailable is a blip (retried). */
        e.code = (r.status === 401 || r.status === 403) ? 'invalid_argument'
               : (r.status >= 500 || r.status === 429) ? 'unavailable' : 'invalid_argument';
        if (r.status === 401) showLogin();
        throw e;
      });
    });
  }

  function snap(path, res) {
    var data = res && res.exists ? res.data : undefined;
    return { exists: data !== undefined, id: path.split('/').pop(), data: function () { return clone(data) || {}; } };
  }

  function refresh(path) {
    listeners.forEach(function (l) {
      if (path && l.path !== path) return;
      call('GET', '/api/doc?path=' + encodeURIComponent(l.path))
        .then(function (res) { l.next(snap(l.path, res)); })
        .catch(function (e) { if (l.error) l.error(e); });
    });
  }

  setInterval(function () { if (!document.hidden) refresh(); }, POLL_MS);
  document.addEventListener('visibilitychange', function () { if (!document.hidden) refresh(); });

  function docRef(path) {
    return {
      id: path.split('/').pop(),
      path: path,
      get: function () {
        return call('GET', '/api/doc?path=' + encodeURIComponent(path)).then(function (res) { return snap(path, res); });
      },
      set: function (data) {
        return call('PUT', '/api/doc?path=' + encodeURIComponent(path), { data: data })
          .then(function () { refresh(path); });
      },
      update: function (data) { return this.set(data); },
      delete: function () {
        return call('DELETE', '/api/doc?path=' + encodeURIComponent(path)).then(function () { refresh(path); });
      },
      onSnapshot: function (next, error) {
        var l = { path: path, next: next, error: error };
        listeners.push(l);
        setTimeout(function () { refresh(path); }, 0);
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
        return call('GET', '/api/list?path=' + encodeURIComponent(path)).then(function (res) {
          var docs = (res.docs || []).map(function (d) {
            return { id: d.id, exists: true, data: function () { return clone(d.data) || {}; } };
          });
          return { forEach: function (fn) { docs.forEach(fn); }, size: docs.length, docs: docs };
        });
      }
    };
  }

  var db = Object.freeze({ doc: docRef, collection: collRef });

  /* ---------------------------------------------------------- sign in */

  /* Both languages at once: the owner reads Arabic, the browser may not say so. */
  var T = {
    title: 'لوحة التحكم · Dashboard',
    sub: 'اكتب كلمة السر للدخول — Enter the password to sign in',
    ph: 'كلمة السر · Password', go: 'دخول · Sign in',
    wrong: 'كلمة السر غير صحيحة — Wrong password',
    many: 'محاولات كثيرة، انتظر قليلاً ثم حاول مجدداً — Too many attempts, wait a little.',
    unset: 'لم تُضبط كلمة السر بعد: أضف السر ADMIN_PASSWORD في إعدادات Cloudflare — No password is set: add the ADMIN_PASSWORD secret in Cloudflare.',
    net: 'تعذر الاتصال بالسيرفر، حاول مجدداً — Could not reach the server.',
    out: 'تسجيل الخروج · Sign out'
  };

  var waiting = [];
  var box = null;

  function style() {
    if (document.getElementById('cf-auth-style')) return;
    var s = document.createElement('style');
    s.id = 'cf-auth-style';
    /* body.admin-only hides everything but #admin-root; these must show. */
    s.textContent =
      'body.admin-only > #cfLogin, body.admin-only > #cfLogout{display:flex!important}' +
      /* The server sign-in protects this page; the in-page password prompt
         would only be a second, confusing lock. */
      '#admin-root .ad-lockbar{display:none!important}' +
      '#cfLogin{position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;justify-content:center;' +
      'background:#0A0A0B;padding:16px;font-family:inherit}' +
      '#cfLogin form{width:min(100%,360px);display:flex;flex-direction:column;gap:12px;background:#151517;' +
      'border:1px solid rgba(255,255,255,.1);border-radius:18px;padding:26px}' +
      '#cfLogin h1{margin:0;font-size:22px;color:#F5EFE6}#cfLogin p{margin:0;font-size:14px;color:#A8A29A}' +
      '#cfLogin input{font:inherit;font-size:16px;padding:12px 14px;border-radius:12px;border:1px solid rgba(255,255,255,.18);' +
      'background:#0A0A0B;color:#F5EFE6}' +
      '#cfLogin button{font:inherit;font-weight:700;font-size:15px;padding:12px;border:0;border-radius:12px;' +
      'background:#FF6A1A;color:#0A0A0B;cursor:pointer}#cfLogin button:disabled{opacity:.6}' +
      '#cfLogin .err{color:#FF8A80;font-size:13.5px;min-height:1em}' +
      '#cfLogout{position:fixed;bottom:84px;left:12px;z-index:2147482000;font:inherit;font-size:12px;' +
      'padding:6px 12px;border-radius:999px;border:1px solid rgba(255,255,255,.2);background:#151517;color:#F5EFE6;cursor:pointer}';
    document.head.appendChild(s);
  }

  function showLogin(message) {
    style();
    if (box) { if (message) box.querySelector('.err').textContent = message; return; }
    box = document.createElement('div');
    box.id = 'cfLogin';
    box.setAttribute('dir', 'rtl');
    box.innerHTML = '<form><h1></h1><p></p><input type="password" autocomplete="current-password" required>' +
      '<div class="err" role="alert"></div><button type="submit"></button></form>';
    box.querySelector('h1').textContent = T.title;
    box.querySelector('p').textContent = T.sub;
    box.querySelector('input').placeholder = T.ph;
    box.querySelector('button').textContent = T.go;
    if (message) box.querySelector('.err').textContent = message;
    document.body.appendChild(box);
    var form = box.querySelector('form');
    var input = box.querySelector('input');
    input.focus();
    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var btn = form.querySelector('button');
      var err = form.querySelector('.err');
      btn.disabled = true;
      err.textContent = '';
      fetch('/api/login', {
        method: 'POST', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', 'X-Baytna': '1' },
        body: JSON.stringify({ password: input.value })
      }).then(function (r) {
        btn.disabled = false;
        if (r.ok) { signedIn(); return; }
        input.value = '';
        err.textContent = r.status === 429 ? T.many : r.status === 503 ? T.unset : T.wrong;
      }).catch(function () { btn.disabled = false; err.textContent = T.net; });
    });
  }

  function signedIn() {
    if (box) { box.remove(); box = null; }
    style();
    if (!document.getElementById('cfLogout')) {
      var b = document.createElement('button');
      b.id = 'cfLogout';
      b.type = 'button';
      b.textContent = T.out;
      b.addEventListener('click', function () {
        call('POST', '/api/logout', {}).catch(function () {}).then(function () { location.reload(); });
      });
      document.body.appendChild(b);
    }
    var w = waiting; waiting = [];
    w.forEach(function (res) { res(db); });
    refresh();
  }

  var sessionChecked = null;
  function whenSignedIn() {
    return new Promise(function (res) {
      waiting.push(res);
      if (sessionChecked) return;
      sessionChecked = fetch('/api/session', { credentials: 'same-origin' })
        .then(function (r) { return r.json(); })
        .then(function (s) {
          if (s.authed) signedIn();
          else showLogin(s.configured ? '' : T.unset);
        })
        .catch(function () { showLogin(T.net); });
    });
  }

  function ready(fn) {
    if (document.body) fn(); else document.addEventListener('DOMContentLoaded', fn);
  }

  window.claude = {
    use: function (name) {
      if (name === 'db') return new Promise(function (res) { ready(function () { whenSignedIn().then(res); }); });
      /* No Claude connectors or permissions here: saving is publishing. */
      return Promise.resolve(null);
    }
  };
})();
