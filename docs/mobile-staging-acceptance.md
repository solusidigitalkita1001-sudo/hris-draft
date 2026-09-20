# Mobile staging acceptance

## 1. Provision synthetic fixtures

Do not run the general database seed against an existing deployment: it also
updates the passwords of its demo users. The targeted provisioner below only
touches the selected synthetic employee's calendar fixture, leave request,
notification, and explicitly requested attendance/biometric setup.

Start with a dry run from the backend directory:

```bash
export MOBILE_FIXTURE_EMPLOYEE_EMAIL=employee-smoke@example.test
export MOBILE_FIXTURE_YEAR=2026
npm run fixtures:mobile
```

Apply the calendar, leave-request, and unread-notification fixtures only after
checking the resolved company and employee printed by the dry run. Copy the
printed company ID into the explicit apply guard:

```bash
export MOBILE_FIXTURE_APPLY=staging-synthetic-only
export MOBILE_FIXTURE_EXPECT_COMPANY_ID=copy-from-dry-run
npm run fixtures:mobile
```

GPS policy changes are opt-in because a branch policy can affect other workers
in the same branch. The provisioner refuses a branch with multiple active
employees unless `MOBILE_FIXTURE_ALLOW_SHARED_BRANCH=true` is explicitly set.
Prefer a dedicated staging branch/account and use real coordinates:

```bash
export MOBILE_FIXTURE_CONFIGURE_GPS=true
export MOBILE_FIXTURE_GPS_LATITUDE=-6.200000
export MOBILE_FIXTURE_GPS_LONGITUDE=106.816666
export MOBILE_FIXTURE_GPS_RADIUS_METERS=150
export MOBILE_FIXTURE_REQUIRE_SELFIE=true
export MOBILE_FIXTURE_EXPECT_BRANCH_ID=copy-from-dry-run
npm run fixtures:mobile
```

Face enrollment is also opt-in. Point to a consented synthetic-test-person
JPEG/PNG of at most 5 MB. The provisioner extracts and encrypts the embedding,
then clears its in-memory photo buffer; it does not copy the source image into
uploads or the database.

```bash
export MOBILE_FIXTURE_FACE_IMAGE_PATH=/secure/local/path/test-person.jpg
npm run fixtures:mobile
```

Dry-run remains read-only in every environment. Applying changes refuses
`NODE_ENV=production` unless `MOBILE_FIXTURE_ALLOW_PRODUCTION=true` is also
explicitly set. Never use a real employee identity, selfie, leave record, or
notification as a fixture.

## 2. Run the 24-operation smoke test

The automated smoke runner only performs intentional, reversible session and
notification mutations: refresh rotation, mark-read/read-all, and logout. It
refuses non-HTTPS URLs unless the host is localhost and never prints passwords,
tokens, or response bodies. The core run covers the 24 mobile method/path pairs,
including positive leave-detail and notification-read checks plus safe
invalid-payload checks for other mutations. Manager approval/calendar checks
are supplemental when manager credentials are present.

```bash
export MOBILE_API_BASE_URL=https://staging.example.test/api/v1
export MOBILE_EMPLOYEE_EMAIL=employee-smoke@example.test
export MOBILE_EMPLOYEE_PASSWORD='from-secret-manager'
export MOBILE_EMPLOYEE_TOTP='123456' # only when MFA is enabled
export MOBILE_MANAGER_EMAIL=manager-smoke@example.test
export MOBILE_MANAGER_PASSWORD='from-secret-manager'
export MOBILE_MANAGER_TOTP='123456' # optional
export MOBILE_SMOKE_OUTPUT=/tmp/hris-mobile-smoke-results.json
node scripts/mobile-api-smoke.mjs
```

Do not commit the exported values or place them in `.env.example`. Use accounts
created only for staging, with synthetic employee data. The optional output is
created with mode `0600` and contains statuses, paths, HTTP statuses, and error
codes only—never tokens, credentials, or response bodies. A missing leave or
notification fixture is reported as `BLOCKED`, not as a false pass.

## 3. Manual device acceptance

These cases require a physical/emulated device, provider credentials, or a
known branch policy and therefore are not fabricated by the HTTP smoke runner.

| Area | Setup | Required result |
|---|---|---|
| Geofence inside | Device at configured branch coordinate | Check-in succeeds using server time |
| Geofence outside | Coordinate beyond branch radius | Request rejected; no attendance row |
| Fake GPS | Android mock-location evidence set true | Request rejected with no attendance row |
| Liveness | Fresh camera capture | Accepted only when branch policy permits the method |
| Gallery/non-live image | Uploaded/gallery image | Rejected by liveness policy |
| Idempotent retry | Repeat identical mutation with same `Idempotency-Key` | Same response plus `Idempotency-Replayed: true`; one database row |
| Changed replay | Reuse key with different payload | HTTP 409 |
| Tenant isolation | Employee requests a foreign tenant ID | HTTP 403/404 with no foreign fields |
| Timezone boundary | Check around office midnight | `serverDate` follows office timezone, not device date |
| Push delivery | Register FCM/APNs token and create inbox notification | Device receives payload with notification/resource/action/reference IDs |
| Invalid push token | Revoke provider token then notify | Registration becomes inactive and delivery is `INVALID_TOKEN` |
| Payroll locked | Read list before unlock | Period metadata only; no salary/component values |
| Payroll unlock | Correct password + TOTP, then detail/PDF | Detail/PDF available for 5 minutes only |
| Payroll lockout | Five incorrect unlocks | HTTP 429 for 15 minutes; login session remains independent |

For the selfie scenarios, enroll the test person's reference image first and
capture a fresh camera image of the same consenting tester on-device. A gallery
image is useful only as the negative liveness case; it must not be accepted as a
substitute for the real-device positive case.

## 4. HTTPS gate

The smoke runner intentionally blocks a non-local HTTP base URL. Before profile
or release acceptance, terminate TLS at the public reverse proxy, redirect HTTP
to HTTPS, configure the API/app public URLs and CORS origins with `https://`, and
verify the certificate chain from the device network. Do not bypass this check
with an insecure client build.

## 5. Release evidence

Attach the smoke output, API/worker deployment version, migration status,
provider environment name, device OS/app version, and the IDs of synthetic
records used. Do not attach access tokens, provider tokens, selfies, or real
employee payroll data.

The release gate is complete only when the sanitized smoke artifact has zero
`failed` and zero `blocked`, the manual device table has recorded evidence, and
the public base URL is HTTPS. Local success alone remains `PASS lokal`; it does
not promote live deployment or real-device status.

## 6. Local verification record — 19 September 2026

The remediation was exercised against a fresh, isolated MySQL database rather
than the developer database. All 61 migrations and the synthetic seed completed,
and the targeted fixture provisioner was applied twice to confirm idempotency.
The final local smoke artifact reported 24/24 core operations, five supplemental
manager operations, and one token-rotation assertion passing (`30 passed`, zero
failed, zero blocked). The artifact was created with mode `0600` and contains no
credential or token values.

A real HTTP check against the rebuilt API also confirmed that a Bandung policy
with `requiresSelfie=true` rejects `MOBILE_GPS` check-in without a selfie with
HTTP 400, creates no attendance row, and still permits logout cleanup. The
server now runs the trusted face-profile match and liveness checks whenever the
resolved policy requires a selfie, independent of the selected capture method.
Positive selfie acceptance is deliberately left to the consented real-device
case above; no synthetic image was used to manufacture a biometric pass.

The HTTPS Nginx configuration passed `nginx -t` with a disposable certificate.
This validates syntax and mounts only—it is not evidence of public DNS,
certificate-chain, firewall, or port-443 readiness.
