const assert = require('node:assert/strict');
const { mkdtemp, readFile, stat } = require('node:fs/promises');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');

const employeeId = '20000000-0000-4000-8000-000000000001';
const leaveId = '60000000-0000-4000-8000-000000000001';
const notificationId = '80000000-0000-4000-8000-000000000001';
const secretValues = ['smoke-password', 'access-token-1', 'access-token-2', 'refresh-token-1', 'refresh-token-2'];
const seen = [];

function send(res, status, data = null) {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify({ success: status < 400, data }));
}

const server = http.createServer(async (req, res) => {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const rawBody = Buffer.concat(chunks).toString('utf8');
  const body = rawBody ? JSON.parse(rawBody) : undefined;
  const requestPath = new URL(req.url, 'http://127.0.0.1').pathname;
  seen.push(`${req.method} ${requestPath}`);

  if (requestPath === '/api/v1/auth/login') {
    assert.equal(req.headers['x-client-type'], 'mobile');
    return send(res, 200, {
      tokens: { accessToken: 'access-token-1', refreshToken: 'refresh-token-1', expiresIn: 900 },
    });
  }
  if (requestPath === '/api/v1/auth/refresh') {
    assert.equal(body.refreshToken, 'refresh-token-1');
    return send(res, 200, {
      tokens: { accessToken: 'access-token-2', refreshToken: 'refresh-token-2', expiresIn: 900 },
    });
  }
  if (requestPath === '/api/v1/auth/logout') {
    assert.equal(body.refreshToken, 'refresh-token-2');
    return send(res, 200, null);
  }

  assert.equal(req.headers.authorization, 'Bearer access-token-2');
  if (requestPath === '/api/v1/auth/me') return send(res, 200, { employeeId });
  if (requestPath === '/api/v1/leave' && req.method === 'GET') return send(res, 200, [{ id: leaveId }]);
  if (requestPath === '/api/v1/notifications' && req.method === 'GET') return send(res, 200, [{ id: notificationId }]);
  if (requestPath === '/api/v1/notifications/read' && req.method === 'PUT') {
    assert.deepEqual(body, { ids: [notificationId] });
    return send(res, 200, null);
  }

  const safeNegative = (
    requestPath === '/api/v1/auth/change-password'
    || requestPath === '/api/v1/attendance/me/check-in'
    || requestPath === '/api/v1/attendance/me/check-out'
    || (requestPath === '/api/v1/leave' && req.method === 'POST')
    || (requestPath === '/api/v1/permission-requests' && req.method === 'POST')
  );
  if (safeNegative) return send(res, 400, null);
  if (requestPath.endsWith('/cancel')) return send(res, 404, null);
  return send(res, 200, []);
});

async function run() {
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'mobile-smoke-test-'));
  const artifactPath = path.join(tempDir, 'result.json');
  const runnerPath = path.resolve(__dirname, '..', 'mobile-api-smoke.mjs');

  const child = spawn(process.execPath, [runnerPath], {
    env: {
      ...process.env,
      MOBILE_API_BASE_URL: `http://127.0.0.1:${address.port}/api/v1`,
      MOBILE_EMPLOYEE_EMAIL: 'employee@example.test',
      MOBILE_EMPLOYEE_PASSWORD: 'smoke-password',
      MOBILE_SMOKE_OUTPUT: artifactPath,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let stdout = '';
  let stderr = '';
  child.stdout.on('data', (chunk) => { stdout += chunk; });
  child.stderr.on('data', (chunk) => { stderr += chunk; });
  const exitCode = await new Promise((resolve) => child.on('close', resolve));
  assert.equal(exitCode, 0, `${stdout}\n${stderr}`);

  const artifactText = await readFile(artifactPath, 'utf8');
  const artifact = JSON.parse(artifactText);
  assert.equal(artifact.sanitized, true);
  assert.equal((await stat(artifactPath)).mode & 0o777, 0o600);
  // 24 HTTP operations plus one explicit token-rotation assertion.
  assert.deepEqual(artifact.summary, { passed: 25, failed: 0, blocked: 0 });
  assert.equal(artifact.fatalError, null);
  for (const secret of secretValues) assert.equal(artifactText.includes(secret), false);

  assert.equal(seen.length, 24);
  assert.equal(seen.at(-1), 'POST /api/v1/auth/logout');
  console.log('mobile-api-smoke mock acceptance: PASS (24 operations, sanitized artifact, logout cleanup)');
}

run()
  .finally(() => new Promise((resolve) => server.close(resolve)))
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
