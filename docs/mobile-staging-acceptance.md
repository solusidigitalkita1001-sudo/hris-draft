# Mobile staging acceptance

The automated smoke runner is read-only except for payroll unlock/relock. It
refuses non-HTTPS URLs unless the host is localhost and never prints passwords,
tokens, or response bodies.

```bash
export MOBILE_API_BASE_URL=https://staging.example.test/api/v1
export MOBILE_EMPLOYEE_EMAIL=employee-smoke@example.test
export MOBILE_EMPLOYEE_PASSWORD='from-secret-manager'
export MOBILE_EMPLOYEE_TOTP='123456' # only when MFA is enabled
export MOBILE_MANAGER_EMAIL=manager-smoke@example.test
export MOBILE_MANAGER_PASSWORD='from-secret-manager'
export MOBILE_MANAGER_TOTP='123456' # optional
export MOBILE_FOREIGN_EMPLOYEE_ID=00000000-0000-4000-8000-000000000099 # optional negative test
node scripts/mobile-api-smoke.mjs
```

Do not commit the exported values or place them in `.env.example`. Use accounts
created only for staging, with synthetic employee data.

## Manual device acceptance

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

## Release evidence

Attach the smoke output, API/worker deployment version, migration status,
provider environment name, device OS/app version, and the IDs of synthetic
records used. Do not attach access tokens, provider tokens, selfies, or real
employee payroll data.
