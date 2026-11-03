const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

const source = fs.readFileSync('src/services/http/apiClient.ts', 'utf8');
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
function client(fetch, { dev = true, env = {}, timers = {} } = {}) {
  const module = { exports: {} };
  vm.runInNewContext(code, {
    module, exports: module.exports, fetch, AbortController, __DEV__: dev,
    process: { env: { EXPO_PUBLIC_API_URL: 'http://test.invalid:3001/', EXPO_PUBLIC_DEV_COMPANY_SLUG: 'fictional-company', ...env } },
    setTimeout, clearTimeout, ...timers,
  });
  return module.exports;
}

test('POSTs all three login fields and returns only the user name', async () => {
  let request;
  const api = client(async (url, options) => {
    request = { url, options };
    return new Response(JSON.stringify({ token: 'fictional-token-never-returned', user: { fullName: 'Fictional Manager' } }));
  });
  assert.equal(await api.testLogin(' manager@example.invalid ', 'fictional-password'), 'Fictional Manager');
  assert.equal(request.url, 'http://test.invalid:3001/api/v1/auth/login');
  assert.equal(request.options.method, 'POST');
  assert.deepEqual(JSON.parse(request.options.body), { email: 'manager@example.invalid', password: 'fictional-password', companySlug: 'fictional-company' });
});
test('invalid credentials produce a safe and clear error', async () => {
  const api = client(async () => new Response(JSON.stringify({ error: 'private server details' }), { status: 401 }));
  await assert.rejects(api.testLogin('a@example.invalid', 'fictional-password'), (error) => error.status === 401 && error.message === 'Incorrect email, password or company.');
});
test('network failures do not expose request credentials or raw errors', async () => {
  const api = client(async () => { throw new Error('private transport details'); });
  await assert.rejects(api.testLogin('a@example.invalid', 'fictional-password'), /Cannot reach the server/);
});
test('the local company fallback is disabled in production', async () => {
  let called = false;
  const api = client(async () => { called = true; }, { dev: false });
  await assert.rejects(api.testLogin('a@example.invalid', 'fictional-password'), /company are required/);
  assert.equal(called, false);
});
test('an explicit company works without the development fallback', async () => {
  const api = client(async (_url, options) => {
    assert.equal(JSON.parse(options.body).companySlug, 'explicit-company');
    return new Response(JSON.stringify({ user: { firstName: 'Fictional', lastName: 'Manager' } }));
  }, { dev: false });
  assert.equal(await api.testLogin('a@example.invalid', 'fictional-password', 'explicit-company'), 'Fictional Manager');
});
test('timeout produces a retryable error and clears its timer', async () => {
  let cleared = false;
  const api = client(async () => { throw new Error('aborted'); }, { timers: { setTimeout: (callback) => { callback(); return 1; }, clearTimeout: () => { cleared = true; } } });
  await assert.rejects(api.testLogin('a@example.invalid', 'fictional-password'), /timed out/);
  assert.equal(cleared, true);
});
test('missing URL configuration fails without making a request', async () => {
  const api = client(async () => { throw new Error('must not fetch'); }, { env: { EXPO_PUBLIC_API_URL: '' } });
  await assert.rejects(api.testLogin('a@example.invalid', 'fictional-password'), /EXPO_PUBLIC_API_URL is not set/);
});
test('a response without a user does not report login success', async () => {
  const api = client(async () => new Response(JSON.stringify({ token: 'fictional-token' })));
  await assert.rejects(api.testLogin('a@example.invalid', 'fictional-password'), /unexpected login response/);
});
