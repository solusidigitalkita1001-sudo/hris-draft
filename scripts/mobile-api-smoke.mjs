#!/usr/bin/env node

import { chmod, writeFile } from 'node:fs/promises';

const required = ['MOBILE_API_BASE_URL', 'MOBILE_EMPLOYEE_EMAIL', 'MOBILE_EMPLOYEE_PASSWORD'];
const missing = required.filter((name) => !process.env[name]);
if (missing.length) {
  console.error(`Missing environment variables: ${missing.join(', ')}`);
  process.exit(2);
}

const baseUrl = process.env.MOBILE_API_BASE_URL.replace(/\/$/, '');
const parsedBase = new URL(baseUrl);
if (parsedBase.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(parsedBase.hostname)) {
  console.error('MOBILE_API_BASE_URL must use HTTPS unless it targets localhost.');
  process.exit(2);
}

const outputPath = process.env.MOBILE_SMOKE_OUTPUT?.trim();
const results = [];
const sessions = [];
let passed = 0;
let failed = 0;
let blocked = 0;

function statusLabel(status) {
  if (status === 'pass') return 'PASS';
  if (status === 'blocked') return 'BLOCKED';
  return 'FAIL';
}

function record(name, method, path, status, detail = {}) {
  if (status === 'pass') passed += 1;
  else if (status === 'blocked') blocked += 1;
  else failed += 1;
  const item = { name, method, path, status, ...detail };
  results.push(item);
  const suffix = detail.httpStatus ? `: HTTP ${detail.httpStatus}` : detail.reason ? `: ${detail.reason}` : '';
  const writer = status === 'pass' ? console.log : status === 'blocked' ? console.warn : console.error;
  writer(`[${statusLabel(status)}] ${name}${suffix}`);
  return item;
}

async function request(name, path, {
  method = 'GET', token, body, headers = {}, expect = [200], scope = 'core', recordResult = true,
} = {}) {
  let response;
  let payload;
  try {
    response = await fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        accept: 'application/json',
        ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const contentType = response.headers.get('content-type') ?? '';
    payload = contentType.includes('application/json')
      ? await response.json()
      : { byteLength: (await response.arrayBuffer()).byteLength, contentType };
  } catch (error) {
    if (recordResult) {
      record(name, method, path, 'fail', {
        scope,
        reason: error instanceof Error ? error.message : String(error),
      });
    }
    return { ok: false, payload: null };
  }

  const ok = expect.includes(response.status);
  if (recordResult) {
    record(name, method, path, ok ? 'pass' : 'fail', {
      scope,
      httpStatus: response.status,
      ...(ok ? {} : { errorCode: payload?.code ?? null, reason: payload?.message ?? 'Unexpected status' }),
    });
  }
  return { response, payload, ok };
}

function extractTokens(payload) {
  return payload?.data?.tokens ?? payload?.data ?? {};
}

async function login(label, email, password, totp, scope = 'core') {
  const result = await request(`${label} login`, '/auth/login', {
    method: 'POST',
    headers: { 'X-Client-Type': 'mobile' },
    body: { email, password, ...(totp ? { totp } : {}) },
    scope,
  });
  const tokens = extractTokens(result.payload);
  if (!result.ok || !tokens.accessToken || !tokens.refreshToken) {
    throw new Error(`${label} login returned no complete token pair`);
  }
  const session = { label, accessToken: tokens.accessToken, refreshToken: tokens.refreshToken, scope };
  sessions.push(session);
  return session;
}

async function rotate(session) {
  const oldAccess = session.accessToken;
  const oldRefresh = session.refreshToken;
  const result = await request('refresh token rotation', '/auth/refresh', {
    method: 'POST',
    headers: { 'X-Client-Type': 'mobile' },
    body: { refreshToken: oldRefresh },
  });
  const tokens = extractTokens(result.payload);
  if (!result.ok || !tokens.accessToken || !tokens.refreshToken) {
    throw new Error('Refresh returned no complete token pair');
  }
  if (tokens.accessToken === oldAccess || tokens.refreshToken === oldRefresh) {
    record('refresh tokens changed', 'POST', '/auth/refresh', 'fail', {
      scope: 'assertion',
      reason: 'Token rotation returned a reused token',
    });
  } else {
    record('refresh tokens changed', 'POST', '/auth/refresh', 'pass', { scope: 'assertion' });
  }
  session.accessToken = tokens.accessToken;
  session.refreshToken = tokens.refreshToken;
}

function firstArray(payload) {
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.data?.items)) return payload.data.items;
  return [];
}

async function runCore() {
  const employee = await login(
    'employee',
    process.env.MOBILE_EMPLOYEE_EMAIL,
    process.env.MOBILE_EMPLOYEE_PASSWORD,
    process.env.MOBILE_EMPLOYEE_TOTP,
  );
  await rotate(employee);

  const me = await request('employee session', '/auth/me', { token: employee.accessToken });
  const employeeId = me.payload?.data?.employeeId;
  if (!employeeId) throw new Error('Employee session has no employeeId');

  // Validation fails before the password service is called, so the password cannot change.
  await request('change-password invalid payload rejection', '/auth/change-password', {
    method: 'POST', token: employee.accessToken, body: {}, expect: [400, 422],
  });

  const now = new Date();
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth() + 1;
  const monthString = `${year}-${String(month).padStart(2, '0')}`;

  await request('attendance today', '/attendance/me/today', { token: employee.accessToken });
  await request('attendance history pagination', `/attendance/me?month=${monthString}&page=1&limit=20`, { token: employee.accessToken });
  await request('check-in invalid payload rejection', '/attendance/me/check-in', {
    method: 'POST', token: employee.accessToken, body: { method: 'INVALID' }, expect: [400, 422],
  });
  await request('check-out invalid payload rejection', '/attendance/me/check-out', {
    method: 'PATCH', token: employee.accessToken, body: { method: 'INVALID' }, expect: [400, 422],
  });

  await request('leave types', '/leave/types', { token: employee.accessToken });
  await request('leave balances', '/leave/balances/employee', { token: employee.accessToken });
  const leaves = await request('leave list', '/leave?page=1&limit=20', { token: employee.accessToken });
  const leaveId = firstArray(leaves.payload)[0]?.id;
  if (leaveId) {
    await request('leave detail', `/leave/${leaveId}`, { token: employee.accessToken });
  } else {
    record('leave detail', 'GET', '/leave/:id', 'blocked', {
      scope: 'core', reason: 'No leave request fixture is visible to the employee',
    });
  }
  await request('leave create invalid payload rejection', '/leave', {
    method: 'POST', token: employee.accessToken, body: {}, expect: [400, 422],
  });
  await request('leave cancel unknown ID rejection', '/leave/00000000-0000-4000-8000-000000000000/cancel', {
    method: 'PATCH', token: employee.accessToken, body: {}, expect: [400, 404, 409, 422],
  });

  await request('permission requests', '/permission-requests/my', { token: employee.accessToken });
  await request('permission create invalid payload rejection', '/permission-requests', {
    method: 'POST', token: employee.accessToken, body: {}, expect: [400, 422],
  });
  await request('permission cancel unknown ID rejection', '/permission-requests/00000000-0000-4000-8000-000000000000/cancel', {
    method: 'PATCH', token: employee.accessToken, body: {}, expect: [400, 404, 409, 422],
  });

  await request('resolved calendar', `/work-calendars/me/resolved?year=${year}&month=${month}`, { token: employee.accessToken });
  const notifications = await request('notification list pagination', '/notifications?page=1&limit=50', { token: employee.accessToken });
  await request('notification unread count', '/notifications/unread-count', { token: employee.accessToken });
  const notificationId = firstArray(notifications.payload)[0]?.id;
  if (notificationId) {
    await request('notification mark read', '/notifications/read', {
      method: 'PUT', token: employee.accessToken, body: { ids: [notificationId] },
    });
  } else {
    record('notification mark read', 'PUT', '/notifications/read', 'blocked', {
      scope: 'core', reason: 'No notification fixture is visible to the employee',
    });
  }
  await request('notification mark all read', '/notifications/read-all', {
    method: 'PUT', token: employee.accessToken,
  });
  await request('employee profile', `/employees/${employeeId}`, { token: employee.accessToken });

  if (process.env.MOBILE_MANAGER_EMAIL && process.env.MOBILE_MANAGER_PASSWORD) {
    const manager = await login(
      'manager',
      process.env.MOBILE_MANAGER_EMAIL,
      process.env.MOBILE_MANAGER_PASSWORD,
      process.env.MOBILE_MANAGER_TOTP,
      'supplemental',
    );
    const managerMe = await request('manager session', '/auth/me', {
      token: manager.accessToken, scope: 'supplemental',
    });
    await request('manager approval queue', '/workflow-engine/instances/my-approvals?page=1&limit=20', {
      token: manager.accessToken, scope: 'supplemental',
    });
    const managerEmployeeId = managerMe.payload?.data?.employeeId;
    if (managerEmployeeId) {
      await request('manager team calendar', `/work-calendars/team/${managerEmployeeId}?year=${year}&month=${month}`, {
        token: manager.accessToken, scope: 'supplemental',
      });
    }
  }
}

async function logoutAll() {
  for (const session of sessions.reverse()) {
    if (!session.refreshToken) continue;
    await request(`${session.label} logout`, '/auth/logout', {
      method: 'POST',
      headers: { 'X-Client-Type': 'mobile' },
      body: { refreshToken: session.refreshToken },
      expect: [200, 204],
      scope: session.scope,
    });
    session.accessToken = null;
    session.refreshToken = null;
  }
}

async function writeSanitizedArtifact(fatalError) {
  if (!outputPath) return;
  const artifact = {
    sanitized: true,
    generatedAt: new Date().toISOString(),
    target: { origin: parsedBase.origin, pathPrefix: parsedBase.pathname },
    summary: { passed, failed, blocked },
    results,
    fatalError: fatalError ? (fatalError instanceof Error ? fatalError.message : String(fatalError)) : null,
  };
  await writeFile(outputPath, `${JSON.stringify(artifact, null, 2)}\n`, { mode: 0o600 });
  await chmod(outputPath, 0o600);
  console.log(`Sanitized artifact written to ${outputPath}`);
}

let fatalError = null;
try {
  await runCore();
} catch (error) {
  fatalError = error;
  failed += 1;
  console.error(`[FATAL] ${error instanceof Error ? error.message : String(error)}`);
} finally {
  try {
    await logoutAll();
  } catch (error) {
    failed += 1;
    console.error(`[FAIL] logout cleanup: ${error instanceof Error ? error.message : String(error)}`);
  }
  await writeSanitizedArtifact(fatalError);
}

console.log(`Smoke result: ${passed} passed, ${failed} failed, ${blocked} blocked`);
process.exit(failed || blocked ? 1 : 0);
