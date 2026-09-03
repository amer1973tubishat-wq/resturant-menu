import { authenticator } from 'otplib';
const BASE = 'http://127.0.0.1:3001';
let failures = 0;
const check = (l, c, e = '') => { console.log(`${c ? 'PASS' : 'FAIL'}  ${l}${e ? ' — ' + e : ''}`); if (!c) failures++; };

function makeClient() {
  const jar = new Map();
  return {
    jar,
    async req(path, { method = 'GET', body, csrf = true } = {}) {
      const headers = { cookie: [...jar].map(([k, v]) => `${k}=${v}`).join('; ') };
      if (body) headers['content-type'] = 'application/json';
      if (csrf && method !== 'GET') headers['x-csrf-token'] = decodeURIComponent(jar.get('baytna_csrf') ?? '');
      const res = await fetch(BASE + path, { method, headers, body: body ? JSON.stringify(body) : undefined, redirect: 'manual' });
      for (const c of res.headers.getSetCookie?.() ?? []) {
        const [pair] = c.split(';'); const i = pair.indexOf('=');
        const k = pair.slice(0, i), v = pair.slice(i + 1);
        if (v === '') jar.delete(k); else jar.set(k, v);
      }
      let data = null; try { data = await res.json(); } catch {}
      return { status: res.status, data };
    },
  };
}

const ADMIN_PW = 'Amman-Grill-2026!x';
const admin = makeClient();
let r = await admin.req('/api/auth/login', { method: 'POST', body: { identifier: 'admin', password: ADMIN_PW } });
check('admin signs in with the new password', r.status === 200, `${r.status}`);

// ---------------------------------------------------------------- RBAC
r = await admin.req('/api/users', {
  method: 'POST',
  body: { name: 'Test Editor', email: 'editor@baytnaburger.jo', username: 'editor1', role: 'EDITOR' },
});
const editorPw = r.data?.temporaryPassword;
const editorId = r.data?.user?.id;
check('super admin can create a user', r.status === 201 && !!editorPw, `${r.status}`);

const editor = makeClient();
r = await editor.req('/api/auth/login', { method: 'POST', body: { identifier: 'editor1', password: editorPw } });
check('new user must change password at first sign-in', r.data?.mustChangePassword === true);

const EDITOR_PW = 'Rainbow-Street-77!q';
r = await editor.req('/api/auth/password/change', {
  method: 'POST', body: { currentPassword: editorPw, newPassword: EDITOR_PW, confirmPassword: EDITOR_PW },
});
check('editor completes the forced change', r.status === 200, `${r.status}`);

r = await editor.req('/api/menu/items');
check('EDITOR can read the menu (has menu:read)', r.status === 200, `${r.status}`);

r = await editor.req('/api/users');
check('EDITOR blocked from user management', r.status === 403 && r.data?.code === 'FORBIDDEN', `${r.status} ${r.data?.code}`);

r = await editor.req('/api/audit');
check('EDITOR blocked from the audit log', r.status === 403, `${r.status}`);

r = await editor.req('/api/settings', { method: 'PATCH', body: { phone: '000' } });
check('EDITOR blocked from writing settings', r.status === 403, `${r.status}`);

// ---------------------------------------------------------------- 2FA
r = await admin.req('/api/auth/2fa/setup', { method: 'POST' });
const secret = r.data?.secret;
check('2FA setup returns a secret and QR', r.status === 200 && !!secret && r.data?.qr?.startsWith('data:image'), `${r.status}`);

r = await admin.req('/api/auth/2fa/enable', { method: 'POST', body: { code: '000000' } });
check('2FA enable rejects a wrong code', r.status === 401, `${r.status}`);

r = await admin.req('/api/auth/2fa/enable', { method: 'POST', body: { code: authenticator.generate(secret) } });
const backupCodes = r.data?.backupCodes;
check('2FA enable accepts a valid TOTP', r.status === 200, `${r.status}`);
check('backup codes issued once', Array.isArray(backupCodes) && backupCodes.length === 10, `${backupCodes?.length}`);

// sign in again — now 2FA gates the session
const twofa = makeClient();
r = await twofa.req('/api/auth/login', { method: 'POST', body: { identifier: 'admin', password: ADMIN_PW } });
check('login now reports twoFactorRequired', r.data?.twoFactorRequired === true);

r = await twofa.req('/api/menu/items');
check('routes blocked while 2FA pending', r.status === 403 && r.data?.code === 'TWO_FACTOR_REQUIRED', `${r.status} ${r.data?.code}`);

r = await twofa.req('/api/auth/2fa/verify', { method: 'POST', body: { code: '123456' } });
check('2FA verify rejects a wrong code', r.status === 401, `${r.status}`);

r = await twofa.req('/api/auth/2fa/verify', { method: 'POST', body: { code: authenticator.generate(secret) } });
check('2FA verify accepts a valid code', r.status === 200, `${r.status}`);

r = await twofa.req('/api/menu/items');
check('routes reachable after 2FA', r.status === 200, `${r.status}`);

// a backup code works once, then never again
const backup = makeClient();
await backup.req('/api/auth/login', { method: 'POST', body: { identifier: 'admin', password: ADMIN_PW } });
r = await backup.req('/api/auth/2fa/verify', { method: 'POST', body: { code: backupCodes[0] } });
check('backup code is accepted', r.status === 200 && r.data?.usedBackupCode === true, `${r.status}`);

const backup2 = makeClient();
await backup2.req('/api/auth/login', { method: 'POST', body: { identifier: 'admin', password: ADMIN_PW } });
r = await backup2.req('/api/auth/2fa/verify', { method: 'POST', body: { code: backupCodes[0] } });
check('the same backup code is refused the second time', r.status === 401, `${r.status}`);

// ---------------------------------------------------------------- lockout
const attacker = makeClient();
let lockedAt = null;
for (let i = 1; i <= 7; i++) {
  const res = await attacker.req('/api/auth/login', {
    method: 'POST', body: { identifier: 'editor1', password: `guess-${i}-wrong` },
  });
  if (res.status === 423) { lockedAt = i; break; }
}
check('account locks after repeated failures', lockedAt !== null, `locked on attempt ${lockedAt}`);

const locked = makeClient();
r = await locked.req('/api/auth/login', { method: 'POST', body: { identifier: 'editor1', password: EDITOR_PW } });
check('correct password refused while locked', r.status === 423, `${r.status}`);

// ---------------------------------------------------------------- cleanup
if (editorId) await admin.req(`/api/users/${editorId}`, { method: 'DELETE' });

console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : failures + ' CHECK(S) FAILED'}`);
process.exit(failures ? 1 : 0);
