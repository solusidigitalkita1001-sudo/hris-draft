const assert = require('node:assert/strict');
const { mkdtemp, writeFile } = require('node:fs/promises');
const { spawn } = require('node:child_process');
const os = require('node:os');
const path = require('node:path');

const manualCaseNames = [
  'geofenceInside', 'geofenceOutside', 'fakeGps', 'liveness', 'galleryImage',
  'idempotentRetry', 'changedReplay', 'tenantIsolation', 'timezoneBoundary',
  'pushDelivery', 'invalidPushToken', 'payrollLocked', 'payrollUnlock', 'payrollLockout',
];

function validSmoke() {
  return {
    sanitized: true,
    target: { origin: 'https://staging.example.test', pathPrefix: '/api/v1' },
    summary: { passed: 30, failed: 0, blocked: 0 },
    results: Array.from({ length: 29 }, (_, index) => ({ name: `check-${index}`, status: 'pass' })),
    fatalError: null,
  };
}

function validEvidence() {
  return {
    schemaVersion: 1,
    targetBaseUrl: 'https://staging.example.test/api/v1',
    deployment: { apiVersion: 'commit-abc', workerVersion: 'commit-abc' },
    migration: { status: 'APPLIED' },
    providerEnvironment: 'staging',
    device: { os: 'Android 15', appVersion: '1.0.0-rc.1' },
    syntheticRecordIds: ['employee-smoke-1', 'notification-smoke-1'],
    manualCases: Object.fromEntries(manualCaseNames.map((name) => [
      name,
      { status: 'PASS', evidence: `ticket://${name}` },
    ])),
  };
}

async function execute(smoke, evidence) {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'mobile-release-gate-'));
  const smokePath = path.join(directory, 'smoke.json');
  const evidencePath = path.join(directory, 'evidence.json');
  await Promise.all([
    writeFile(smokePath, JSON.stringify(smoke)),
    writeFile(evidencePath, JSON.stringify(evidence)),
  ]);
  const script = path.join(__dirname, 'mobile-release-gate.mjs');
  const child = spawn(process.execPath, [script, smokePath, evidencePath], {
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let stdout = '';
  let stderr = '';
  child.stdout.on('data', (chunk) => { stdout += chunk; });
  child.stderr.on('data', (chunk) => { stderr += chunk; });
  const code = await new Promise((resolve) => child.on('close', resolve));
  return { code, stdout, stderr };
}

async function run() {
  const pass = await execute(validSmoke(), validEvidence());
  assert.equal(pass.code, 0, pass.stderr);
  assert.match(pass.stdout, /Mobile release gate: PASS/);

  const blockedSmoke = validSmoke();
  blockedSmoke.summary.blocked = 1;
  blockedSmoke.results[0].status = 'blocked';
  const blocked = await execute(blockedSmoke, validEvidence());
  assert.equal(blocked.code, 1);
  assert.match(blocked.stderr, /blocked checks/);

  const incompleteEvidence = validEvidence();
  incompleteEvidence.targetBaseUrl = 'http://staging.example.test/api/v1';
  incompleteEvidence.manualCases.liveness.status = 'PENDING';
  const incomplete = await execute(validSmoke(), incompleteEvidence);
  assert.equal(incomplete.code, 1);
  assert.match(incomplete.stderr, /must use HTTPS/);
  assert.match(incomplete.stderr, /manualCases\.liveness\.status must be PASS/);

  const unsafeEvidence = validEvidence();
  unsafeEvidence.accessToken = 'must-never-be-recorded';
  const unsafe = await execute(validSmoke(), unsafeEvidence);
  assert.equal(unsafe.code, 1);
  assert.match(unsafe.stderr, /forbidden sensitive field/);

  console.log('mobile release gate checks: PASS');
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
