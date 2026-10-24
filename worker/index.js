/**
 * Baytna Burger on Cloudflare: one Worker serves the customer page and the
 * dashboard (static files in dist/public) and keeps the dashboard's content in
 * Workers KV.
 *
 *   GET    /content.json        the live content the customer page applies
 *   GET    /api/session         { authed, configured }
 *   POST   /api/login           { password } → session cookie
 *   POST   /api/logout
 *   GET    /api/doc?path=a/b    one document
 *   PUT    /api/doc?path=a/b    { data } — signed in only
 *   DELETE /api/doc?path=a/b    signed in only
 *   GET    /api/list?path=a     the documents of a collection
 *
 * Every write needs a session from /api/login, checked here on the server.
 * The password is the ADMIN_PASSWORD secret; without it nobody can sign in.
 * Content is public anyway (it is the website), so content/, media/ and meta/
 * are readable by anyone; secure/ only when signed in.
 */
import seed from '../published/content.json';

const SEGMENT = /^(?!\.\.?$)[A-Za-z0-9_\-.~:@+]{1,200}$/;
const READ_PUBLIC = ['content', 'media', 'meta'];
const WRITABLE = ['content', 'media', 'meta', 'secure'];
const MAX_BODY = 2 * 1024 * 1024;           /* an inline image is ~190 KB */
const SESSION_SECONDS = 12 * 60 * 60;
const COOKIE = 'baytna_session';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    try {
      if (url.pathname === '/content.json') return await liveContent(env);
      if (url.pathname.startsWith('/api/')) return await api(request, env, url);
      return env.ASSETS.fetch(request);
    } catch (e) {
      console.error('worker error', e && e.stack || e);
      return json({ error: 'server_error' }, 500);
    }
  },
};

/* ------------------------------------------------------------------ API */

async function api(request, env, url) {
  const route = url.pathname.slice('/api/'.length);
  const method = request.method;

  if (method !== 'GET' && method !== 'HEAD') {
    /* A page on another site cannot set this header without a preflight the
       Worker never answers, and the cookie is SameSite=Strict as well. */
    if (request.headers.get('X-Baytna') !== '1') return json({ error: 'forbidden' }, 403);
    const origin = request.headers.get('Origin');
    if (origin && origin !== url.origin) return json({ error: 'forbidden' }, 403);
  }

  if (route === 'session' && method === 'GET') {
    return json({ authed: await authed(request, env), configured: !!env.ADMIN_PASSWORD });
  }
  if (route === 'login' && method === 'POST') return login(request, env);
  if (route === 'logout' && method === 'POST') {
    return json({ ok: true }, 200, { 'Set-Cookie': `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0` });
  }

  const path = url.searchParams.get('path') || '';
  const segs = path.split('/');
  if (!segs.every(s => SEGMENT.test(s))) return json({ error: 'bad_path' }, 400);
  const top = segs[0];
  const signedIn = await authed(request, env);

  if (route === 'doc') {
    if (segs.length % 2 !== 0) return json({ error: 'bad_path' }, 400);
    if (method === 'GET') {
      if (!READ_PUBLIC.includes(top) && !signedIn) return json({ error: 'unauthorized' }, 401);
      const data = await readDoc(env, path);
      return json(data === undefined ? { exists: false } : { exists: true, data });
    }
    if (!signedIn) return json({ error: 'unauthorized' }, 401);
    if (!WRITABLE.includes(top)) return json({ error: 'forbidden' }, 403);
    if (method === 'PUT') {
      const text = await request.text();
      if (text.length > MAX_BODY) return json({ error: 'too_large' }, 413);
      let body;
      try { body = JSON.parse(text); } catch (e) { return json({ error: 'bad_json' }, 400); }
      const data = body && body.data;
      if (!data || typeof data !== 'object' || Array.isArray(data)) return json({ error: 'bad_data' }, 400);
      await env.DB.put('doc:' + path, JSON.stringify(data));
      return json({ ok: true });
    }
    if (method === 'DELETE') {
      await env.DB.delete('doc:' + path);
      return json({ ok: true });
    }
    return json({ error: 'method' }, 405);
  }

  if (route === 'list' && method === 'GET') {
    if (segs.length % 2 !== 1) return json({ error: 'bad_path' }, 400);
    if (!READ_PUBLIC.includes(top) && !signedIn) return json({ error: 'unauthorized' }, 401);
    return json({ docs: await listDocs(env, path) });
  }

  return json({ error: 'not_found' }, 404);
}

/* --------------------------------------------------------------- storage */

/* Until the dashboard first saves, the menu and site texts are the content
   last published from the Claude dashboard (published/content.json). */
async function readDoc(env, path) {
  const raw = await env.DB.get('doc:' + path);
  if (raw !== null) {
    try { return JSON.parse(raw); } catch (e) { return undefined; }
  }
  if (path === 'content/menu' && seed && seed.menu) return seed.menu;
  if (path === 'content/site' && seed && seed.site) return seed.site;
  return undefined;
}

async function listDocs(env, coll) {
  const depth = coll.split('/').length + 1;
  const keys = [];
  let cursor;
  do {
    const page = await env.DB.list({ prefix: 'doc:' + coll + '/', cursor });
    page.keys.forEach(k => {
      const p = k.name.slice(4);
      if (p.split('/').length === depth) keys.push(p);
    });
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor);
  const docs = await Promise.all(keys.map(async p => ({ id: p.split('/').pop(), data: await readDoc(env, p) })));
  return docs.filter(d => d.data !== undefined);
}

/* The same shape scripts/build.js writes into content.json: the menu, the
   site texts, and only the images the content points at. */
async function liveContent(env) {
  const menu = Object.assign({}, await readDoc(env, 'content/menu') || {});
  const site = Object.assign({}, await readDoc(env, 'content/site') || {});
  delete menu.updatedAt; delete site.updatedAt; delete site.steps;
  const media = {};
  const ids = referencedIds(menu, site);
  await Promise.all([...ids].map(async id => {
    if (!SEGMENT.test(id)) return;
    const d = await readDoc(env, 'media/' + id);
    if (d && typeof d.url === 'string' && /^data:image\//i.test(d.url)) media[id] = d.url;
  }));
  return json({ menu, site, media, publishedAt: Date.now() });
}

function referencedIds(menu, site) {
  const ids = new Set();
  const add = (v) => { if (typeof v === 'string' && v && !/^(https?:|data:)/i.test(v)) ids.add(v); };
  (Array.isArray(menu.categories) ? menu.categories : []).forEach(c => c && add(c.img));
  (Array.isArray(menu.items) ? menu.items : []).forEach(i => i && add(i.img));
  add(site.heroImage);
  add(site.mapImage);
  if (site.brand) add(site.brand.logo);
  return ids;
}

/* ------------------------------------------------------------------ auth */

async function login(request, env) {
  if (!env.ADMIN_PASSWORD) return json({ error: 'not_configured' }, 503);
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const rlKey = 'rl:' + ip;
  const rl = JSON.parse(await env.DB.get(rlKey) || '{"n":0,"until":0}');
  const now = Date.now();
  if (rl.until > now) return json({ error: 'too_many', retryAfterMs: rl.until - now }, 429);

  let password = '';
  try { password = String((await request.json()).password || ''); } catch (e) {}
  if (!(await sameSecret(password, env.ADMIN_PASSWORD))) {
    rl.n += 1;
    /* Five free tries, then a wait that doubles: 1, 2, 4 … 15 minutes. */
    if (rl.n >= 5) rl.until = now + Math.min(15 * 60000, 60000 * Math.pow(2, rl.n - 5));
    await env.DB.put(rlKey, JSON.stringify(rl), { expirationTtl: 24 * 3600 });
    return json({ error: 'wrong_password' }, 401);
  }
  if (rl.n) await env.DB.delete(rlKey);
  const exp = Math.floor(now / 1000) + SESSION_SECONDS;
  const token = exp + '.' + await sign(env.ADMIN_PASSWORD, 'session:' + exp);
  return json({ ok: true }, 200, {
    'Set-Cookie': `${COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${SESSION_SECONDS}`,
  });
}

/* A session is an expiry signed with the password itself, so changing the
   ADMIN_PASSWORD secret signs everybody out. */
async function authed(request, env) {
  if (!env.ADMIN_PASSWORD) return false;
  const cookie = request.headers.get('Cookie') || '';
  const m = cookie.match(new RegExp('(?:^|;\\s*)' + COOKIE + '=([0-9]+)\\.([A-Za-z0-9_-]+)'));
  if (!m) return false;
  if (Number(m[1]) < Date.now() / 1000) return false;
  return sameSecret(m[2], await sign(env.ADMIN_PASSWORD, 'session:' + m[1]));
}

async function sign(secret, msg) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(msg)));
  return btoa(String.fromCharCode(...sig)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/* Compared as fixed-length digests, in constant time. */
async function sameSecret(a, b) {
  const h = async (s) => new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(s))));
  const x = await h(a), y = await h(b);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}

function json(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: Object.assign({
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    }, headers),
  });
}
