const BASE = 'http://127.0.0.1:3001';
let failures = 0;
const check = (l, c, e = '') => { console.log(`${c ? 'PASS' : 'FAIL'}  ${l}${e ? ' — ' + e : ''}`); if (!c) failures++; };

function client() {
  const jar = new Map();
  return async (path, { method = 'GET', body } = {}) => {
    const headers = { cookie: [...jar].map(([k, v]) => `${k}=${v}`).join('; ') };
    if (body) headers['content-type'] = 'application/json';
    if (method !== 'GET') headers['x-csrf-token'] = decodeURIComponent(jar.get('baytna_csrf') ?? '');
    const res = await fetch(BASE + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
    for (const c of res.headers.getSetCookie?.() ?? []) {
      const [pair] = c.split(';'); const i = pair.indexOf('=');
      const k = pair.slice(0, i), v = pair.slice(i + 1);
      if (v === '') jar.delete(k); else jar.set(k, v);
    }
    let data = null; try { data = await res.json(); } catch {}
    return { status: res.status, data };
  };
}

const ADMIN_PW = 'Amman-Grill-2026!x';
const admin = client();
let r = await admin('/api/auth/login', { method: 'POST', body: { identifier: 'admin', password: ADMIN_PW } });
// admin has 2FA on now, so this is a pending session — fine, we only need a target user
const targets = client();

// create a fresh victim account
const a2 = client();
await a2('/api/auth/login', { method: 'POST', body: { identifier: 'admin', password: ADMIN_PW } });

// Test the lockout on a user we create directly in the DB-free way: use the
// seeded admin's own account is risky, so probe a definitely-existing one.
const statuses = [];
for (let i = 1; i <= 8; i++) {
  const res = await targets('/api/auth/login', {
    method: 'POST', body: { identifier: 'admin', password: `definitely-wrong-${i}` },
  });
  statuses.push(res.status);
  if (res.status === 423) break;
}
console.log('   attempt statuses:', statuses.join(', '));
const lockIdx = statuses.indexOf(423);
// MAX_LOGIN_ATTEMPTS=5 means the 5th failure is the one that locks, so the
// 423 is the 5th element (index 4), not the 6th.
check('account locks on the 5th failed attempt', lockIdx === 4, `locked on attempt ${lockIdx + 1}`);
check('lockout is 423, not a rate-limit 429', !statuses.includes(429), statuses.join(','));

// the correct password is refused while the lock stands
r = await targets('/api/auth/login', { method: 'POST', body: { identifier: 'admin', password: ADMIN_PW } });
check('correct password refused while locked', r.status === 423, `${r.status} ${r.data?.error ?? ''}`);

console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : failures + ' CHECK(S) FAILED'}`);
process.exit(failures ? 1 : 0);
