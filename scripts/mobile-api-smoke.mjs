#!/usr/bin/env node

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

let passed = 0;
let failed = 0;

async function request(name, path, { method = 'GET', token, body, headers = {}, expect = [200] } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      accept: 'application/json',
      ...(body ? { 'content-type': 'application/json' } : {}),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const contentType = response.headers.get('content-type') ?? '';
  const payload = contentType.includes('application/json')
    ? await response.json()
    : { byteLength: (await response.arrayBuffer()).byteLength, contentType };
  if (!expect.includes(response.status)) {
    failed += 1;
    console.error(`[FAIL] ${name}: HTTP ${response.status} ${payload?.code ?? payload?.message ?? ''}`);
    return { response, payload, ok: false };
  }
  passed += 1;
  console.log(`[PASS] ${name}: HTTP ${response.status}`);
  return { response, payload, ok: true };
}

async function login(label, email, password, totp) {
  const result = await request(`${label} login`, '/auth/login', {
    method: 'POST',
    headers: { 'X-Client-Type': 'mobile' },
    body: { email, password, ...(totp ? { totp } : {}) },
  });
  const token = result.payload?.data?.tokens?.accessToken;
  if (!token) throw new Error(`${label} login returned no access token`);
  return token;
}

async function main() {
  const employeeToken = await login(
    'employee',
    process.env.MOBILE_EMPLOYEE_EMAIL,
    process.env.MOBILE_EMPLOYEE_PASSWORD,
    process.env.MOBILE_EMPLOYEE_TOTP,
  );
  const me = await request('employee session', '/auth/me', { token: employeeToken });
  const employeeId = me.payload?.data?.employeeId;
  if (!employeeId) throw new Error('Employee session has no employeeId');

  const now = new Date();
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth() + 1;
  const monthString = `${year}-${String(month).padStart(2, '0')}`;

  await request('attendance today', '/attendance/me/today', { token: employeeToken });
  await request('attendance history pagination', `/attendance/me?month=${monthString}&page=1&limit=20`, { token: employeeToken });
  await request('leave types', '/leave/types', { token: employeeToken });
  await request('leave balances', '/leave/balances/employee', { token: employeeToken });
  await request('leave list', '/leave?page=1&limit=20', { token: employeeToken });
  await request('permission requests', '/permission-requests/my', { token: employeeToken });
  await request('resolved calendar', `/work-calendars/me/resolved?year=${year}&month=${month}`, { token: employeeToken });
  await request('holidays', `/work-calendars/holidays/list?year=${year}`, { token: employeeToken });
  await request('notification list pagination', '/notifications?page=1&limit=20', { token: employeeToken });
  await request('notification unread count', '/notifications/unread-count', { token: employeeToken });
  await request('employee profile', `/employees/${employeeId}`, { token: employeeToken });
  await request('attendance correction history', '/attendance-corrections/my?page=1&limit=20', { token: employeeToken });
  await request('overtime history', '/attendance/overtime?page=1&limit=20', { token: employeeToken });
  await request('employee loans', '/employee-loans/my', { token: employeeToken });
  await request('EWA history', '/ewa/my', { token: employeeToken });
  await request('daily activities', `/daily-activities/my?startDate=${monthString}-01&endDate=${monthString}-28`, { token: employeeToken });
  await request('business trips', '/travel-expenses/trips/my', { token: employeeToken });
  await request('expense claims', '/travel-expenses/claims/my', { token: employeeToken });
  await request('payslip locked list', '/payroll/payslips', { token: employeeToken });

  const unlock = await request('payroll reauthentication', '/payroll/payslips/unlock', {
    method: 'POST',
    token: employeeToken,
    body: {
      password: process.env.MOBILE_EMPLOYEE_PASSWORD,
      ...(process.env.MOBILE_EMPLOYEE_TOTP ? { totp: process.env.MOBILE_EMPLOYEE_TOTP } : {}),
    },
  });
  const unlockToken = unlock.payload?.data?.unlockToken;
  if (unlockToken) {
    const payslips = await request('payslip periods for detail selection', '/payroll/payslips', { token: employeeToken });
    const payslipId = payslips.payload?.data?.[0]?.id;
    if (payslipId) {
      await request('protected payslip detail', `/payroll/payslips/${payslipId}`, {
        token: employeeToken,
        headers: { 'X-Payroll-Unlock-Token': unlockToken },
      });
      await request('protected payslip PDF', `/payroll/payslips/${payslipId}/pdf`, {
        token: employeeToken,
        headers: { 'X-Payroll-Unlock-Token': unlockToken },
      });
    }
    await request('payroll relock', '/payroll/payslips/lock', { method: 'POST', token: employeeToken });
  }

  if (process.env.MOBILE_FOREIGN_EMPLOYEE_ID) {
    await request('cross-tenant employee denial', `/employees/${process.env.MOBILE_FOREIGN_EMPLOYEE_ID}`, {
      token: employeeToken,
      expect: [403, 404],
    });
  }

  if (process.env.MOBILE_MANAGER_EMAIL && process.env.MOBILE_MANAGER_PASSWORD) {
    const managerToken = await login(
      'manager',
      process.env.MOBILE_MANAGER_EMAIL,
      process.env.MOBILE_MANAGER_PASSWORD,
      process.env.MOBILE_MANAGER_TOTP,
    );
    const managerMe = await request('manager session', '/auth/me', { token: managerToken });
    await request('manager approval queue', '/workflow-engine/instances/my-approvals?page=1&limit=20', { token: managerToken });
    const managerEmployeeId = managerMe.payload?.data?.employeeId;
    if (managerEmployeeId) {
      await request('manager team calendar', `/work-calendars/team/${managerEmployeeId}?year=${year}&month=${month}`, { token: managerToken });
    }
  }
}

main()
  .then(() => {
    console.log(`Smoke result: ${passed} passed, ${failed} failed`);
    process.exit(failed ? 1 : 0);
  })
  .catch((error) => {
    console.error(`[FATAL] ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  });
