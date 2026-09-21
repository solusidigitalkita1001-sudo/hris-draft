#!/usr/bin/env node

import { readFile } from 'node:fs/promises';

const requiredManualCases = [
  'geofenceInside',
  'geofenceOutside',
  'fakeGps',
  'liveness',
  'galleryImage',
  'idempotentRetry',
  'changedReplay',
  'tenantIsolation',
  'timezoneBoundary',
  'pushDelivery',
  'invalidPushToken',
  'payrollLocked',
  'payrollUnlock',
  'payrollLockout',
];

const smokePath = process.argv[2] ?? process.env.MOBILE_SMOKE_OUTPUT;
const evidencePath = process.argv[3] ?? process.env.MOBILE_RELEASE_EVIDENCE;
const failures = [];

function fail(message) {
  failures.push(message);
}

async function readJson(path, label) {
  if (!path) {
    fail(`${label} path is required`);
    return null;
  }
  try {
    return JSON.parse(await readFile(path, 'utf8'));
  } catch (error) {
    fail(`${label} cannot be read as JSON: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

function nonEmpty(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function rejectSensitiveKeys(value, path = '$') {
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    const childPath = `${path}.${key}`;
    if (/password|access.?token|refresh.?token|provider.?token|private.?key|selfie|secret/i.test(key)) {
      fail(`release evidence contains forbidden sensitive field ${childPath}`);
    }
    rejectSensitiveKeys(child, childPath);
  }
}

function validateSmoke(smoke) {
  if (!smoke) return;
  if (smoke.sanitized !== true) fail('smoke artifact must declare sanitized=true');
  if (!smoke.summary || typeof smoke.summary !== 'object') {
    fail('smoke artifact summary is missing');
    return;
  }
  if (smoke.summary.failed !== 0) fail(`smoke artifact has ${smoke.summary.failed ?? 'unknown'} failed checks`);
  if (smoke.summary.blocked !== 0) fail(`smoke artifact has ${smoke.summary.blocked ?? 'unknown'} blocked checks`);
  if (!Number.isInteger(smoke.summary.passed) || smoke.summary.passed < 25) {
    fail('smoke artifact must contain at least 25 passing core checks');
  }
  if (!Array.isArray(smoke.results) || smoke.results.length < 24) {
    fail('smoke artifact must contain the per-operation results');
  } else if (smoke.results.some((result) => result?.status !== 'pass')) {
    fail('every recorded smoke operation must have pass status');
  }
  if (smoke.fatalError) fail('smoke artifact contains a fatal error');
}

function validateEvidence(evidence, smoke) {
  if (!evidence) return;
  rejectSensitiveKeys(evidence);
  if (evidence.schemaVersion !== 1) fail('release evidence schemaVersion must be 1');

  let targetUrl;
  try {
    targetUrl = new URL(evidence.targetBaseUrl);
    if (targetUrl.protocol !== 'https:') fail('targetBaseUrl must use HTTPS');
  } catch {
    fail('targetBaseUrl must be a valid URL');
  }

  if (targetUrl && smoke?.target) {
    const expected = `${smoke.target.origin}${smoke.target.pathPrefix}`.replace(/\/$/, '');
    if (targetUrl.toString().replace(/\/$/, '') !== expected) {
      fail('release evidence targetBaseUrl does not match the smoke artifact target');
    }
  }

  if (!nonEmpty(evidence.deployment?.apiVersion)) fail('deployment.apiVersion is required');
  if (!nonEmpty(evidence.deployment?.workerVersion)) fail('deployment.workerVersion is required');
  if (evidence.migration?.status !== 'APPLIED') fail('migration.status must be APPLIED');
  if (!nonEmpty(evidence.providerEnvironment)) fail('providerEnvironment is required');
  if (!nonEmpty(evidence.device?.os)) fail('device.os is required');
  if (!nonEmpty(evidence.device?.appVersion)) fail('device.appVersion is required');
  if (!Array.isArray(evidence.syntheticRecordIds) || evidence.syntheticRecordIds.length === 0) {
    fail('syntheticRecordIds must contain the fixture record IDs used for acceptance');
  } else if (evidence.syntheticRecordIds.some((id) => !nonEmpty(id))) {
    fail('syntheticRecordIds cannot contain empty values');
  }

  for (const name of requiredManualCases) {
    const item = evidence.manualCases?.[name];
    if (item?.status !== 'PASS') fail(`manualCases.${name}.status must be PASS`);
    if (!nonEmpty(item?.evidence)) fail(`manualCases.${name}.evidence is required`);
  }
}

const smoke = await readJson(smokePath, 'smoke artifact');
const evidence = await readJson(evidencePath, 'release evidence');
validateSmoke(smoke);
validateEvidence(evidence, smoke);

if (failures.length > 0) {
  console.error('Mobile release gate: FAIL');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Mobile release gate: PASS (${smoke.summary.passed} smoke checks, ${requiredManualCases.length} manual cases)`);
