const BASE = 'http://127.0.0.1:3001';
let jar = new Map();

function cookieHeader() { return [...jar].map(([k, v]) => `${k}=${v}`).join('; '); }
function store(res) {
  for (const c of res.headers.getSetCookie?.() ?? []) {
    const [pair] = c.split(';');
    const i = pair.indexOf('=');
    const k = pair.slice(0, i), v = pair.slice(i + 1);
    if (v === '') jar.delete(k); else jar.set(k, v);
  }
}
async function req(path, { method = 'GET', body, csrf = true } = {}) {
  const headers = { cookie: cookieHeader() };
  if (body) headers['content-type'] = 'application/json';
  if (csrf && method !== 'GET') headers['x-csrf-token'] = decodeURIComponent(jar.get('baytna_csrf') ?? '');
  const res = await fetch(BASE + path, { method, headers, body: body ? JSON.stringify(body) : undefined, redirect: 'manual' });
  store(res);
  let data = null;
  try { data = await res.json(); } catch {}
  return { status: res.status, data };
}
const ok = (label, cond, extra = '') =>
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${label}${extra ? ' — ' + extra : ''}`);

const PASSWORD = process.argv[2];
let failures = 0;
const check = (l, c, e) => { ok(l, c, e); if (!c) failures++; };

// 1. unauthenticated access is refused
let r = await req('/api/menu/items');
check('unauthenticated API returns 401', r.status === 401, `got ${r.status}`);

// 2. wrong password
r = await req('/api/auth/login', { method: 'POST', body: { identifier: 'admin', password: 'wrong-password-here' } });
check('wrong password returns 401', r.status === 401, r.data?.code);
check('failure message does not reveal whether the user exists',
  r.data?.error === 'Incorrect credentials', JSON.stringify(r.data?.error));

// 3. unknown user gives the identical message
r = await req('/api/auth/login', { method: 'POST', body: { identifier: 'nobody@nowhere.jo', password: 'whatever123' } });
check('unknown user gives the same message', r.data?.error === 'Incorrect credentials');

// 4. correct password
r = await req('/api/auth/login', { method: 'POST', body: { identifier: 'admin', password: PASSWORD } });
check('correct password returns 200', r.status === 200, JSON.stringify(r.data).slice(0, 90));
check('mustChangePassword is set for the seeded account', r.data?.mustChangePassword === true);
check('access cookie issued', jar.has('baytna_at'));
check('refresh cookie issued', jar.has('baytna_rt'));
check('csrf cookie issued', jar.has('baytna_csrf'));

// 5. forced password change blocks everything else
r = await req('/api/menu/items');
check('protected route blocked until password changed',
  r.status === 403 && r.data?.code === 'PASSWORD_CHANGE_REQUIRED', `${r.status} ${r.data?.code}`);

// 6. CSRF enforcement
const NEW_PASSWORD = 'Amman-Grill-2026!x';
r = await req('/api/auth/password/change', {
  method: 'POST', csrf: false,
  body: { currentPassword: PASSWORD, newPassword: NEW_PASSWORD, confirmPassword: NEW_PASSWORD },
});
check('mutation without CSRF token is rejected', r.status === 403 && r.data?.code === 'CSRF_FAILED', `${r.status} ${r.data?.code}`);

// 7. weak password rejected by policy
r = await req('/api/auth/password/change', {
  method: 'POST', body: { currentPassword: PASSWORD, newPassword: 'short1!', confirmPassword: 'short1!' },
});
check('weak password rejected', r.status === 422, `${r.status} ${r.data?.code}`);

// 8. real change
r = await req('/api/auth/password/change', {
  method: 'POST', body: { currentPassword: PASSWORD, newPassword: NEW_PASSWORD, confirmPassword: NEW_PASSWORD },
});
check('password change succeeds', r.status === 200, JSON.stringify(r.data).slice(0, 80));

// 9. now the dashboard is reachable
r = await req('/api/menu/items');
check('protected route reachable after change', r.status === 200, `${r.status}`);
check('menu items returned', Array.isArray(r.data?.items) && r.data.items.length > 0, `${r.data?.items?.length} items`);

// 10. RBAC surface
r = await req('/api/auth/me');
check('role is SUPER_ADMIN', r.data?.user?.role === 'SUPER_ADMIN');
check('permissions include users:write', r.data?.permissions?.includes('users:write'));

// 11. audit trail recorded the change, with the password redacted
r = await req('/api/audit?perPage=10');
const actions = (r.data?.logs ?? []).map((l) => l.action);
check('audit log records LOGIN', actions.includes('LOGIN'), actions.join(','));
check('audit log records PASSWORD_CHANGED', actions.includes('PASSWORD_CHANGED'));
const dump = JSON.stringify(r.data);
check('no password or hash leaked into the audit trail',
  !dump.includes(NEW_PASSWORD) && !dump.includes('$argon2'));

// 12. public API is readable without auth
const pub = await fetch(BASE + '/api/public/menu');
const pubData = await pub.json();
check('public menu API is open', pub.status === 200 && pubData.categories?.length > 0,
  `${pub.status}, ${pubData.categories?.length} categories`);
check('public API exposes no password fields', !JSON.stringify(pubData).includes('passwordHash'));

// 13. validation
r = await req('/api/menu/items', { method: 'POST', body: { nameEn: '', price: -5 } });
check('invalid item rejected', r.status === 422 || r.status === 400, `${r.status}`);

// 14. logout revokes the session
r = await req('/api/auth/logout', { method: 'POST' });
check('logout succeeds', r.status === 200);
r = await req('/api/menu/items');
check('session unusable after logout', r.status === 401, `${r.status}`);

console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : failures + ' CHECK(S) FAILED'}`);
process.exit(failures ? 1 : 0);
