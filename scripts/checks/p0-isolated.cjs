// Dependency-light regression checks; supplements, never replaces, project tests.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const ts = require('../../backend/node_modules/typescript');
const root = path.resolve(__dirname, '../..');
class ForbiddenError extends Error {}
class NotFoundError extends Error {}
class BadRequestError extends Error {}
function load(relative, mocks) {
  const exports = {};
  const result = ts.transpileModule(fs.readFileSync(path.join(root, relative), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true }, reportDiagnostics: true,
  });
  assert.equal(result.diagnostics?.filter(d => d.category === ts.DiagnosticCategory.Error).length, 0);
  new Function('require', 'exports', result.outputText)((name) => {
    if (name in mocks) return mocks[name];
    if (['crypto', 'fs/promises', 'path'].includes(name)) return require(name);
    throw Error('Unexpected import ' + name);
  }, exports);
  return exports;
}
(async () => {
  const exceptions = { ForbiddenError, NotFoundError, BadRequestError };
  const csrf = load('backend/src/shared/middleware/CsrfProtection.ts', {
    '@/config': { csrf: { secret: 'isolated-test-only' }, cookies: { secure: false }, app: { env: 'test' }, cors: { origins: ['https://hris.example'] } },
    '@/shared/exceptions/AppError': exceptions,
  });
  let token;
  csrf.issueCsrfToken({ cookie: (_key, value) => { token = value; } });
  let passed = 0;
  const request = (origin, header = token) => ({ method: 'POST', cookies: { at: 'session', csrf: token }, get: name => name === 'origin' ? origin : header });
  csrf.csrfProtection(request('https://hris.example'), {}, () => passed++);
  assert.equal(passed, 1);
  assert.throws(() => csrf.csrfProtection(request('https://attacker.example'), {}, () => {}));
  assert.throws(() => csrf.csrfProtection(request(undefined, 'invalid'), {}, () => {}));
  const originalNow = Date.now;
  try { Date.now = () => originalNow() + 7200001; assert.throws(() => csrf.csrfProtection(request(), {}, () => {})); }
  finally { Date.now = originalNow; }
  const { validateFileMagicBytes } = load('backend/src/shared/middleware/FileValidation.ts', {
    '@/config': { upload: { allowedMimes: ['image/png'] } }, '@/shared/exceptions/AppError': exceptions,
  });
  const buffer = Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]);
  for (const [originalname, mimetype, rejected] of [['photo.png','image/png',false],['payload.html','image/png',true],['photo.png','text/html',true]]) {
    let error;
    await validateFileMagicBytes(['image/png'])({ file: { buffer, originalname, mimetype } }, {}, e => { error = e; });
    assert.equal(Boolean(error), rejected);
  }
  let query;
  const { DocumentManagementService } = load('backend/src/modules/document-management/document-management.service.ts', {
    '@/config': { app: { url: 'https://hris.example' } }, '@/shared/exceptions/AppError': exceptions,
    '@/shared/database/prisma': { prisma: {} },
    '@/modules/administration/administration.service': { administrationService: { findMyDataScopeByUser: async () => null, resolveEmployeeFilterForCurrentUser: () => ({}) } },
    './document-management.repository': { documentManagementRepository: { findDocumentById: async (id, access) => { query = access; return null; } } },
    '@/shared/security/signed-url': { verifyDocumentSignature: () => false },
  });
  await assert.rejects(new DocumentManagementService().getDownloadPayload('foreign', { id: 'u', companyId: 'A', employeeId: 'e' }), NotFoundError);
  assert.equal(query.companyId, 'A');
  assert.deepEqual(query.OR, [{ visibility: { not: 'RESTRICTED' }, employeeId: null }, { uploadedBy: 'u' }, { employeeId: 'e' }]);
  const { validateReceiptReference } = load('backend/src/shared/storage/receipt-reference.ts', {
    '@/shared/exceptions/AppError': exceptions,
  });
  const company = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  const employee = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';
  const filename = 'ffffffff-ffff-ffff-ffff-ffffffffffff.pdf';
  const prefix = `/uploads/travel-expenses/receipts/${company}/${employee}/`;
  validateReceiptReference(prefix + filename, company, employee);
  for (const reference of [prefix.replace(company, employee) + filename, prefix + '../' + filename, prefix + '%2e%2e%2f' + filename, prefix + filename + '.html']) {
    assert.throws(() => validateReceiptReference(reference, company, employee));
  }
  const { resolvePrivatePath } = load('backend/src/shared/storage/private-path.ts', { '@/shared/exceptions/AppError': exceptions });
  const temp = fs.mkdtempSync('/tmp/hris-file-path-');
  try {
    fs.mkdirSync(path.join(temp, 'uploads'));
    fs.writeFileSync(path.join(temp, 'uploads', 'valid.pdf'), 'test');
    fs.writeFileSync(path.join(temp, 'secret'), 'test');
    fs.symlinkSync(path.join(temp, 'secret'), path.join(temp, 'uploads', 'link'));
    assert.equal(await resolvePrivatePath(path.join(temp, 'uploads'), 'valid.pdf'), fs.realpathSync(path.join(temp, 'uploads', 'valid.pdf')));
    for (const name of ['../secret', 'link']) await assert.rejects(resolvePrivatePath(path.join(temp, 'uploads'), name));
  } finally { fs.rmSync(temp, { recursive: true }); }
  const storage = new Map();
  const listeners = {};
  global.localStorage = { setItem: (key, value) => storage.set(key, value), getItem: key => storage.get(key) ?? null, removeItem: key => storage.delete(key) };
  global.window = { addEventListener: (event, callback) => { listeners[event] = callback; } };
  let profileResolve;
  let profileCalls = 0;
  const authUser = { id: 'u', roles: ['EMPLOYEE'], permissions: [], companyId: 'A' };
  const { useAuthStore } = load('frontend/src/stores/auth.store.ts', {
    zustand: { create: () => (initializer) => {
      let state;
      const set = patch => { state = { ...state, ...patch }; };
      state = initializer(set, () => state);
      return { getState: () => state };
    } },
    '@/config/app': { appConfig: { companyKey: 'active-company' } },
    '@/services/auth.service': { authService: { getProfile: () => {
      profileCalls++; return new Promise(resolve => { profileResolve = resolve; });
    } } },
  });
  const first = useAuthStore.getState().loadProfile();
  const second = useAuthStore.getState().loadProfile();
  assert.equal(profileCalls, 1);
  useAuthStore.getState().reset();
  profileResolve(authUser);
  await Promise.all([first, second]);
  assert.equal(useAuthStore.getState().isAuthenticated, false);
  useAuthStore.getState().setUser(authUser);
  listeners.storage({ key: 'hrms-logout', newValue: '1' });
  assert.equal(useAuthStore.getState().user, null);
  assert.equal(storage.has('hrms-auth-store'), false);
  console.log('PASS: isolated CSRF valid/invalid/origin/expiry, upload spoofing, document company/ownership query checks, auth deduplication/logout races/multi-tab, receipt ownership, path traversal/symlink containment');
})().catch(error => { console.error(error); process.exitCode = 1; });
