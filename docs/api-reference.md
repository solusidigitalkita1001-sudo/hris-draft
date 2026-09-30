# Referensi API HRIS

Dibuat otomatis dari router yang berjalan pada 2026-09-30 — **423 path, 575 operasi**.

Dokumen ini tidak ditulis tangan. Sumbernya `GET /api/v1/meta/openapi.json`, yang dibangun dengan menyusuri stack Express: path, method, skema request (dikonversi dari skema zod yang benar-benar memvalidasi request), permission yang diminta `authorize()`, dan apakah route berada di balik autentikasi. Karena itu isinya tidak bisa menyimpang dari server — kalau sebuah endpoint berubah, dokumen ini berubah saat dibuat ulang.

Cara mengambil versi terbaru sendiri (butuh akun dengan `rbac:read`):

```bash
curl -H "Authorization: Bearer $TOKEN" \
  https://<host>/api/v1/meta/openapi.json > openapi.json
```

## Yang perlu dibaca lebih dulu

- **Bentuk response dan kode error**: `docs/api-contract.md`. Semua sukses memakai satu envelope (`success`, `message`, `data`, `meta` untuk daftar berhalaman); semua error memakai `code` dari katalog tertutup (`VALIDATION_ERROR`, `FORBIDDEN`, `CONFLICT`, …).
- **Autentikasi**: cookie `httpOnly` untuk web; klien mobile mengirim `X-Client-Type: mobile` saat login dan memakai `Authorization: Bearer` sesudahnya (lihat `docs/mobile-api.md`). Untuk SSO per perusahaan: `docs/sso-oidc.md`.
- **Konteks perusahaan**: hampir semua endpoint terikat perusahaan aktif; `companyId` dari klien divalidasi terhadap hak akses pengguna, bukan dipercaya.
- **Idempotency**: mutasi mobile menerima header `Idempotency-Key` (replay 24 jam).

Dua endpoint memakai kredensial yang **bukan** sesi pengguna, dan itu disengaja:

- `POST /attendance-devices/punches` — kredensial perangkat absensi (`docs/attendance-device-integration.md`).
- `GET /auth/sso/start` dan `/auth/sso/callback` — belum ada sesi saat dipanggil.

Kolom **Permission** di bawah adalah yang diminta `authorize()` pada route tersebut. Kosong berarti route hanya butuh sesi yang sah (atau, untuk beberapa endpoint publik seperti login dan callback SSO, tidak butuh apa pun).

## `auth` — 19 operasi

| Method & path | Permission | Auth | Body |
|---|---|---|---|
| `POST /api/v1/auth/change-password` | — | bearer/cookie | ya |
| `GET /api/v1/auth/csrf` | — | publik | — |
| `POST /api/v1/auth/forgot-password` | — | publik | ya |
| `POST /api/v1/auth/login` | — | publik | ya |
| `POST /api/v1/auth/logout` | — | publik | — |
| `GET /api/v1/auth/me` | — | bearer/cookie | — |
| `POST /api/v1/auth/mfa/disable` | — | bearer/cookie | ya |
| `POST /api/v1/auth/mfa/enable` | — | bearer/cookie | ya |
| `POST /api/v1/auth/mfa/setup` | — | bearer/cookie | — |
| `POST /api/v1/auth/refresh` | — | publik | ya |
| `POST /api/v1/auth/reset-password` | — | publik | ya |
| `GET /api/v1/auth/sessions` | — | bearer/cookie | — |
| `DELETE /api/v1/auth/sessions/{id}` | — | bearer/cookie | — |
| `GET /api/v1/auth/sso/callback` | — | publik | — |
| `GET /api/v1/auth/sso/providers` | `rbac:read` | bearer/cookie | — |
| `POST /api/v1/auth/sso/providers` | `rbac:create` | bearer/cookie | ya |
| `PATCH /api/v1/auth/sso/providers/{id}` | `rbac:update` | bearer/cookie | ya |
| `DELETE /api/v1/auth/sso/providers/{id}` | `rbac:delete` | bearer/cookie | — |
| `GET /api/v1/auth/sso/start` | — | publik | — |

## `employees` — 53 operasi

| Method & path | Permission | Auth | Body |
|---|---|---|---|
| `GET /api/v1/employees` | `employee:read` | bearer/cookie | — |
| `POST /api/v1/employees` | `employee:create` | bearer/cookie | ya |
| `GET /api/v1/employees/attendance-methods` | — | bearer/cookie | — |
| `PATCH /api/v1/employees/career-transactions/{transactionId}/workflow-action` | `employee:update` | bearer/cookie | ya |
| `GET /api/v1/employees/contracts` | `employee:read` | bearer/cookie | — |
| `POST /api/v1/employees/contracts` | `employee:update` | bearer/cookie | ya |
| `GET /api/v1/employees/contracts/expiring` | `employee:read` | bearer/cookie | — |
| `PATCH /api/v1/employees/contracts/{id}/status` | `employee:update` | bearer/cookie | ya |
| `GET /api/v1/employees/export` | `employee:read` | bearer/cookie | — |
| `POST /api/v1/employees/import` | `employee:create` | bearer/cookie | — |
| `GET /api/v1/employees/me/reporting-line` | — | bearer/cookie | — |
| `GET /api/v1/employees/{id}` | `employee:read` | bearer/cookie | — |
| `PUT /api/v1/employees/{id}` | `employee:update` | bearer/cookie | ya |
| `DELETE /api/v1/employees/{id}` | `employee:delete` | bearer/cookie | — |
| `GET /api/v1/employees/{id}/attachments` | `employee:read` | bearer/cookie | — |
| `POST /api/v1/employees/{id}/attachments` | `employee:update` | bearer/cookie | ya |
| `PUT /api/v1/employees/{id}/attachments/{attachmentId}` | `employee:update` | bearer/cookie | ya |
| `DELETE /api/v1/employees/{id}/attachments/{attachmentId}` | `employee:update` | bearer/cookie | — |
| `PATCH /api/v1/employees/{id}/attendance-methods` | — | bearer/cookie | ya |
| `GET /api/v1/employees/{id}/career-transactions` | `employee:read` | bearer/cookie | — |
| `POST /api/v1/employees/{id}/career-transactions` | `employee:update` | bearer/cookie | ya |
| `GET /api/v1/employees/{id}/company-assignments` | `employee:read` | bearer/cookie | — |
| `POST /api/v1/employees/{id}/company-assignments` | `employee:update` | bearer/cookie | ya |
| `PUT /api/v1/employees/{id}/company-assignments/{assignmentId}` | `employee:update` | bearer/cookie | ya |
| `DELETE /api/v1/employees/{id}/company-assignments/{assignmentId}` | `employee:update` | bearer/cookie | — |
| `GET /api/v1/employees/{id}/educations` | `employee:read` | bearer/cookie | — |
| `POST /api/v1/employees/{id}/educations` | `employee:update` | bearer/cookie | ya |
| `PUT /api/v1/employees/{id}/educations/{educationId}` | `employee:update` | bearer/cookie | ya |
| `DELETE /api/v1/employees/{id}/educations/{educationId}` | `employee:update` | bearer/cookie | — |
| `GET /api/v1/employees/{id}/emergency-contacts` | `employee:read` | bearer/cookie | — |
| `POST /api/v1/employees/{id}/emergency-contacts` | `employee:update` | bearer/cookie | ya |
| `PUT /api/v1/employees/{id}/emergency-contacts/{emergencyId}` | `employee:update` | bearer/cookie | ya |
| `DELETE /api/v1/employees/{id}/emergency-contacts/{emergencyId}` | `employee:update` | bearer/cookie | — |
| `GET /api/v1/employees/{id}/experiences` | `employee:read` | bearer/cookie | — |
| `POST /api/v1/employees/{id}/experiences` | `employee:update` | bearer/cookie | ya |
| `PUT /api/v1/employees/{id}/experiences/{experienceId}` | `employee:update` | bearer/cookie | ya |
| `DELETE /api/v1/employees/{id}/experiences/{experienceId}` | `employee:update` | bearer/cookie | — |
| `GET /api/v1/employees/{id}/face-profile` | `employee:read` | bearer/cookie | — |
| `POST /api/v1/employees/{id}/face-profile` | `employee:update` | bearer/cookie | — |
| `DELETE /api/v1/employees/{id}/face-profile` | `employee:update` | bearer/cookie | — |
| `GET /api/v1/employees/{id}/families` | `employee:read` | bearer/cookie | — |
| `POST /api/v1/employees/{id}/families` | `employee:update` | bearer/cookie | ya |
| `PUT /api/v1/employees/{id}/families/{familyId}` | `employee:update` | bearer/cookie | ya |
| `DELETE /api/v1/employees/{id}/families/{familyId}` | `employee:update` | bearer/cookie | — |
| `GET /api/v1/employees/{id}/skills` | `employee:read` | bearer/cookie | — |
| `POST /api/v1/employees/{id}/skills` | `employee:update` | bearer/cookie | ya |
| `PUT /api/v1/employees/{id}/skills/{skillId}` | `employee:update` | bearer/cookie | ya |
| `DELETE /api/v1/employees/{id}/skills/{skillId}` | `employee:update` | bearer/cookie | — |
| `PATCH /api/v1/employees/{id}/status` | `employee:update` | bearer/cookie | — |
| `GET /api/v1/employees/{id}/trainings` | `employee:read` | bearer/cookie | — |
| `POST /api/v1/employees/{id}/trainings` | `employee:update` | bearer/cookie | ya |
| `PUT /api/v1/employees/{id}/trainings/{trainingId}` | `employee:update` | bearer/cookie | ya |
| `DELETE /api/v1/employees/{id}/trainings/{trainingId}` | `employee:update` | bearer/cookie | — |

## `attendance` — 20 operasi

| Method & path | Permission | Auth | Body |
|---|---|---|---|
| `GET /api/v1/attendance` | `attendance:read` | bearer/cookie | — |
| `POST /api/v1/attendance` | `attendance:create` | bearer/cookie | ya |
| `GET /api/v1/attendance/context` | `attendance:read` | bearer/cookie | — |
| `GET /api/v1/attendance/me` | — | bearer/cookie | — |
| `POST /api/v1/attendance/me/check-in` | — | bearer/cookie | ya |
| `PATCH /api/v1/attendance/me/check-out` | — | bearer/cookie | ya |
| `GET /api/v1/attendance/me/today` | — | bearer/cookie | — |
| `GET /api/v1/attendance/overtime` | `attendance:read` | bearer/cookie | — |
| `POST /api/v1/attendance/overtime` | `attendance:create` | bearer/cookie | ya |
| `PATCH /api/v1/attendance/overtime/{id}/approve` | `attendance:approve` | bearer/cookie | — |
| `GET /api/v1/attendance/overtime/{id}/pay` | `attendance:read` | bearer/cookie | — |
| `PATCH /api/v1/attendance/overtime/{id}/reject` | `attendance:approve` | bearer/cookie | — |
| `GET /api/v1/attendance/overtime/{id}/workflow` | `attendance:read` | bearer/cookie | — |
| `PATCH /api/v1/attendance/overtime/{id}/workflow-action` | `attendance:approve` | bearer/cookie | ya |
| `GET /api/v1/attendance/report` | `attendance:read` | bearer/cookie | — |
| `GET /api/v1/attendance/summary` | `attendance:read` | bearer/cookie | — |
| `GET /api/v1/attendance/{id}` | `attendance:read` | bearer/cookie | — |
| `DELETE /api/v1/attendance/{id}` | `attendance:delete` | bearer/cookie | — |
| `PATCH /api/v1/attendance/{id}/checkout` | `attendance:update` | bearer/cookie | ya |
| `PATCH /api/v1/attendance/{id}/correction` | `attendance:update` | bearer/cookie | — |

## `attendance-devices` — 5 operasi

| Method & path | Permission | Auth | Body |
|---|---|---|---|
| `GET /api/v1/attendance-devices` | `attendance:read` | bearer/cookie | — |
| `POST /api/v1/attendance-devices` | `attendance:create` | bearer/cookie | ya |
| `POST /api/v1/attendance-devices/punches` | — | publik | ya |
| `PATCH /api/v1/attendance-devices/{id}` | `attendance:update` | bearer/cookie | ya |
| `GET /api/v1/attendance-devices/{id}/punches` | `attendance:read` | bearer/cookie | — |

## `attendance-corrections` — 8 operasi

| Method & path | Permission | Auth | Body |
|---|---|---|---|
| `GET /api/v1/attendance-corrections` | `attendance:read` | bearer/cookie | — |
| `POST /api/v1/attendance-corrections` | — | bearer/cookie | ya |
| `GET /api/v1/attendance-corrections/my` | — | bearer/cookie | — |
| `GET /api/v1/attendance-corrections/my/{id}` | — | bearer/cookie | — |
| `GET /api/v1/attendance-corrections/{id}` | `attendance:read` | bearer/cookie | — |
| `PUT /api/v1/attendance-corrections/{id}/approve` | `attendance:update` | bearer/cookie | — |
| `PUT /api/v1/attendance-corrections/{id}/reject` | `attendance:update` | bearer/cookie | ya |
| `PATCH /api/v1/attendance-corrections/{id}/workflow-action` | `attendance:update` | bearer/cookie | ya |

## `leave` — 24 operasi

| Method & path | Permission | Auth | Body |
|---|---|---|---|
| `GET /api/v1/leave` | `leave:read` | bearer/cookie | — |
| `POST /api/v1/leave` | `leave:create` | bearer/cookie | ya |
| `POST /api/v1/leave/attachments` | `leave:create` | bearer/cookie | — |
| `POST /api/v1/leave/balances` | `leave:create` | bearer/cookie | ya |
| `POST /api/v1/leave/balances/accrue` | `leave:create` | bearer/cookie | — |
| `GET /api/v1/leave/balances/employee` | `leave:read` | bearer/cookie | — |
| `GET /api/v1/leave/collective` | `leave:read` | bearer/cookie | — |
| `POST /api/v1/leave/collective` | `leave:create` | bearer/cookie | ya |
| `DELETE /api/v1/leave/collective/{id}` | `leave:update` | bearer/cookie | — |
| `POST /api/v1/leave/collective/{id}/apply` | `leave:approve` | bearer/cookie | — |
| `GET /api/v1/leave/collective/{id}/preview` | `leave:read` | bearer/cookie | — |
| `GET /api/v1/leave/encashment` | `leave:read` | bearer/cookie | — |
| `POST /api/v1/leave/encashment` | `leave:create` | bearer/cookie | ya |
| `GET /api/v1/leave/encashment/policy` | `leave:read` | bearer/cookie | — |
| `PATCH /api/v1/leave/encashment/{id}/approve` | `leave:approve` | bearer/cookie | — |
| `PATCH /api/v1/leave/encashment/{id}/reject` | `leave:approve` | bearer/cookie | ya |
| `GET /api/v1/leave/types` | `leave:read` | bearer/cookie | — |
| `POST /api/v1/leave/types` | `leave:create` | bearer/cookie | ya |
| `GET /api/v1/leave/{id}` | `leave:read` | bearer/cookie | — |
| `PATCH /api/v1/leave/{id}/approve` | `leave:approve` | bearer/cookie | — |
| `PATCH /api/v1/leave/{id}/cancel` | — | bearer/cookie | — |
| `PATCH /api/v1/leave/{id}/reject` | `leave:approve` | bearer/cookie | — |
| `GET /api/v1/leave/{id}/workflow` | `leave:read` | bearer/cookie | — |
| `PATCH /api/v1/leave/{id}/workflow-action` | `leave:approve` | bearer/cookie | ya |

## `permission-requests` — 9 operasi

| Method & path | Permission | Auth | Body |
|---|---|---|---|
| `GET /api/v1/permission-requests` | `permission-request:read` | bearer/cookie | — |
| `POST /api/v1/permission-requests` | — | bearer/cookie | ya |
| `POST /api/v1/permission-requests/attachments` | — | bearer/cookie | — |
| `GET /api/v1/permission-requests/my` | — | bearer/cookie | — |
| `GET /api/v1/permission-requests/{id}` | `permission-request:read` | bearer/cookie | — |
| `PATCH /api/v1/permission-requests/{id}/approve` | `permission-request:update` | bearer/cookie | ya |
| `PATCH /api/v1/permission-requests/{id}/cancel` | — | bearer/cookie | — |
| `PATCH /api/v1/permission-requests/{id}/reject` | `permission-request:update` | bearer/cookie | ya |
| `PATCH /api/v1/permission-requests/{id}/workflow-action` | `permission-request:update` | bearer/cookie | ya |

## `work-calendars` — 35 operasi

| Method & path | Permission | Auth | Body |
|---|---|---|---|
| `GET /api/v1/work-calendars` | `work-calendar:read` | bearer/cookie | — |
| `POST /api/v1/work-calendars` | `work-calendar:create` | bearer/cookie | ya |
| `GET /api/v1/work-calendars/employee/{employeeId}` | `work-calendar:read` | bearer/cookie | — |
| `GET /api/v1/work-calendars/employees/{employeeId}/shift-assignments` | `work-calendar:read` | bearer/cookie | — |
| `POST /api/v1/work-calendars/employees/{employeeId}/shift-assignments` | `work-calendar:update` | bearer/cookie | ya |
| `DELETE /api/v1/work-calendars/employees/{employeeId}/shift-assignments` | `work-calendar:update` | bearer/cookie | — |
| `POST /api/v1/work-calendars/holidays` | `work-calendar:create` | bearer/cookie | ya |
| `GET /api/v1/work-calendars/holidays/list` | — | bearer/cookie | — |
| `PUT /api/v1/work-calendars/holidays/{hid}` | `work-calendar:update` | bearer/cookie | ya |
| `DELETE /api/v1/work-calendars/holidays/{hid}` | `work-calendar:delete` | bearer/cookie | — |
| `GET /api/v1/work-calendars/me/next-shift` | — | bearer/cookie | — |
| `GET /api/v1/work-calendars/me/resolved` | — | bearer/cookie | — |
| `GET /api/v1/work-calendars/shift-formulas` | `work-calendar:read` | bearer/cookie | — |
| `POST /api/v1/work-calendars/shift-formulas` | `work-calendar:create` | bearer/cookie | ya |
| `GET /api/v1/work-calendars/shift-formulas/{sid}` | `work-calendar:read` | bearer/cookie | — |
| `PUT /api/v1/work-calendars/shift-formulas/{sid}` | `work-calendar:update` | bearer/cookie | ya |
| `DELETE /api/v1/work-calendars/shift-formulas/{sid}` | `work-calendar:delete` | bearer/cookie | — |
| `POST /api/v1/work-calendars/shift-swaps` | — | bearer/cookie | ya |
| `GET /api/v1/work-calendars/shift-swaps/approvals/my` | — | bearer/cookie | — |
| `GET /api/v1/work-calendars/shift-swaps/candidates/my` | — | bearer/cookie | — |
| `GET /api/v1/work-calendars/shift-swaps/my` | — | bearer/cookie | — |
| `PATCH /api/v1/work-calendars/shift-swaps/{requestId}/approve` | — | bearer/cookie | ya |
| `PATCH /api/v1/work-calendars/shift-swaps/{requestId}/cancel` | — | bearer/cookie | — |
| `PATCH /api/v1/work-calendars/shift-swaps/{requestId}/reject` | — | bearer/cookie | ya |
| `GET /api/v1/work-calendars/shift-swaps/{requestId}/workflow` | `work-calendar:read` | bearer/cookie | — |
| `PATCH /api/v1/work-calendars/shift-swaps/{requestId}/workflow-action` | `work-calendar:update` | bearer/cookie | ya |
| `GET /api/v1/work-calendars/team/{managerId}` | `work-calendar:read` | bearer/cookie | — |
| `GET /api/v1/work-calendars/{id}` | `work-calendar:read` | bearer/cookie | — |
| `PUT /api/v1/work-calendars/{id}` | `work-calendar:update` | bearer/cookie | ya |
| `DELETE /api/v1/work-calendars/{id}` | `work-calendar:delete` | bearer/cookie | — |
| `POST /api/v1/work-calendars/{id}/copy` | `work-calendar:create` | bearer/cookie | ya |
| `GET /api/v1/work-calendars/{id}/days` | `work-calendar:read` | bearer/cookie | — |
| `PUT /api/v1/work-calendars/{id}/days` | `work-calendar:update` | bearer/cookie | ya |
| `POST /api/v1/work-calendars/{id}/generate` | `work-calendar:update` | bearer/cookie | — |
| `GET /api/v1/work-calendars/{id}/working-days` | `work-calendar:read` | bearer/cookie | — |

## `payroll` — 55 operasi

| Method & path | Permission | Auth | Body |
|---|---|---|---|
| `GET /api/v1/payroll/annual-tax-recap` | `payroll:read` | bearer/cookie | — |
| `GET /api/v1/payroll/annual-tax-recap/{employeeId}` | `payroll:read` | bearer/cookie | — |
| `GET /api/v1/payroll/arrears` | `payroll:read` | bearer/cookie | — |
| `POST /api/v1/payroll/arrears` | `payroll:create` | bearer/cookie | ya |
| `DELETE /api/v1/payroll/arrears/{id}` | `payroll:update` | bearer/cookie | — |
| `GET /api/v1/payroll/bpjs-report` | `payroll:read` | bearer/cookie | — |
| `POST /api/v1/payroll/calculate-bpjs` | `payroll:read` | bearer/cookie | ya |
| `POST /api/v1/payroll/calculate-jkn` | `payroll:read` | bearer/cookie | ya |
| `POST /api/v1/payroll/calculate-pph21` | `payroll:read` | bearer/cookie | ya |
| `POST /api/v1/payroll/calculate-thr` | `payroll:read` | bearer/cookie | ya |
| `GET /api/v1/payroll/employee-salaries` | `payroll:read` | bearer/cookie | — |
| `POST /api/v1/payroll/employee-salaries` | `payroll:create` | bearer/cookie | ya |
| `GET /api/v1/payroll/employee-salaries/{id}` | `payroll:read` | bearer/cookie | — |
| `PATCH /api/v1/payroll/employee-salaries/{id}` | `payroll:update` | bearer/cookie | ya |
| `GET /api/v1/payroll/employees/{employeeId}/thr` | `payroll:read` | bearer/cookie | — |
| `GET /api/v1/payroll/formulas/{componentId}/versions` | `payroll:read` | bearer/cookie | — |
| `POST /api/v1/payroll/formulas/{componentId}/versions` | `payroll:update` | bearer/cookie | ya |
| `POST /api/v1/payroll/formulas/{componentId}/versions/{versionId}/preview` | — | bearer/cookie | ya |
| `POST /api/v1/payroll/formulas/{componentId}/versions/{versionId}/publish` | `payroll:approve` | bearer/cookie | — |
| `POST /api/v1/payroll/payment-batches` | `payroll:process` | bearer/cookie | ya |
| `GET /api/v1/payroll/payment-batches/run/{runId}` | `payroll:process` | bearer/cookie | — |
| `GET /api/v1/payroll/payment-batches/{id}` | `payroll:process` | bearer/cookie | — |
| `POST /api/v1/payroll/payment-batches/{id}/cancel` | `payroll:process` | bearer/cookie | ya |
| `POST /api/v1/payroll/payment-batches/{id}/export` | `payroll:process` | bearer/cookie | ya |
| `POST /api/v1/payroll/payment-batches/{id}/reconcile` | `payroll:process`, `payroll:disburse` | bearer/cookie | ya |
| `PATCH /api/v1/payroll/payment-batches/{id}/transactions/{transactionId}` | `payroll:process`, `payroll:disburse` | bearer/cookie | ya |
| `GET /api/v1/payroll/payslips` | `payroll:read` | bearer/cookie | — |
| `POST /api/v1/payroll/payslips/lock` | `payroll:read` | bearer/cookie | — |
| `POST /api/v1/payroll/payslips/my/unlock` | — | bearer/cookie | ya |
| `GET /api/v1/payroll/payslips/my/{id}` | — | bearer/cookie | — |
| `GET /api/v1/payroll/payslips/my/{id}/pdf` | — | bearer/cookie | — |
| `PUT /api/v1/payroll/payslips/pin` | — | bearer/cookie | ya |
| `GET /api/v1/payroll/payslips/pin/status` | — | bearer/cookie | — |
| `POST /api/v1/payroll/payslips/unlock` | `payroll:read` | bearer/cookie | ya |
| `GET /api/v1/payroll/payslips/{id}` | `payroll:read` | bearer/cookie | — |
| `GET /api/v1/payroll/payslips/{id}/pdf` | `payroll:read` | bearer/cookie | — |
| `GET /api/v1/payroll/periods` | `payroll:read` | bearer/cookie | — |
| `POST /api/v1/payroll/periods` | `payroll:create` | bearer/cookie | ya |
| `GET /api/v1/payroll/periods/{id}` | `payroll:read` | bearer/cookie | — |
| `PATCH /api/v1/payroll/periods/{id}` | `payroll:update` | bearer/cookie | ya |
| `GET /api/v1/payroll/periods/{id}/attendance-summary` | `payroll:read` | bearer/cookie | — |
| `PATCH /api/v1/payroll/periods/{id}/close` | `payroll:update` | bearer/cookie | — |
| `PUT /api/v1/payroll/periods/{id}/confirm-attendance` | `payroll:update` | bearer/cookie | — |
| `GET /api/v1/payroll/runs` | `payroll:read` | bearer/cookie | — |
| `POST /api/v1/payroll/runs` | `payroll:process` | bearer/cookie | ya |
| `GET /api/v1/payroll/runs/{id}` | `payroll:read` | bearer/cookie | — |
| `PATCH /api/v1/payroll/runs/{id}/approve` | `payroll:approve` | bearer/cookie | — |
| `PATCH /api/v1/payroll/runs/{id}/disburse` | `payroll:disburse` | bearer/cookie | — |
| `GET /api/v1/payroll/runs/{id}/disbursements` | `payroll:read` | bearer/cookie | — |
| `PATCH /api/v1/payroll/runs/{id}/void` | `payroll:approve` | bearer/cookie | — |
| `GET /api/v1/payroll/salary-components` | `payroll:read` | bearer/cookie | — |
| `POST /api/v1/payroll/salary-components` | `payroll:create` | bearer/cookie | ya |
| `GET /api/v1/payroll/salary-components/{id}` | `payroll:read` | bearer/cookie | — |
| `PATCH /api/v1/payroll/salary-components/{id}` | `payroll:update` | bearer/cookie | ya |
| `DELETE /api/v1/payroll/salary-components/{id}` | `payroll:delete` | bearer/cookie | — |

## `employee-loans` — 12 operasi

| Method & path | Permission | Auth | Body |
|---|---|---|---|
| `GET /api/v1/employee-loans` | `employee-loan:read` | bearer/cookie | — |
| `POST /api/v1/employee-loans` | — | bearer/cookie | ya |
| `GET /api/v1/employee-loans/my` | — | bearer/cookie | — |
| `GET /api/v1/employee-loans/types` | — | bearer/cookie | — |
| `GET /api/v1/employee-loans/{id}` | `employee-loan:read` | bearer/cookie | — |
| `GET /api/v1/employee-loans/{id}/amortization` | `employee-loan:read` | bearer/cookie | — |
| `PATCH /api/v1/employee-loans/{id}/approve` | `employee-loan:update` | bearer/cookie | ya |
| `PATCH /api/v1/employee-loans/{id}/cancel` | — | bearer/cookie | — |
| `GET /api/v1/employee-loans/{id}/installments` | `employee-loan:read` | bearer/cookie | — |
| `PATCH /api/v1/employee-loans/{id}/reject` | `employee-loan:update` | bearer/cookie | ya |
| `GET /api/v1/employee-loans/{id}/workflow` | `employee-loan:read` | bearer/cookie | — |
| `PATCH /api/v1/employee-loans/{id}/workflow-action` | `employee-loan:update` | bearer/cookie | ya |

## `ewa` — 9 operasi

| Method & path | Permission | Auth | Body |
|---|---|---|---|
| `GET /api/v1/ewa` | `ewa:read` | bearer/cookie | — |
| `POST /api/v1/ewa` | `ewa:create` | bearer/cookie | ya |
| `GET /api/v1/ewa/my` | — | bearer/cookie | — |
| `GET /api/v1/ewa/my/limit` | — | bearer/cookie | — |
| `GET /api/v1/ewa/{id}` | `ewa:read` | bearer/cookie | — |
| `POST /api/v1/ewa/{id}/approve` | `ewa:approve` | bearer/cookie | ya |
| `POST /api/v1/ewa/{id}/cancel` | `ewa:update` | bearer/cookie | — |
| `POST /api/v1/ewa/{id}/mark-paid` | `ewa:disburse` | bearer/cookie | ya |
| `POST /api/v1/ewa/{id}/reject` | `ewa:approve` | bearer/cookie | ya |

## `travel-expenses` — 20 operasi

| Method & path | Permission | Auth | Body |
|---|---|---|---|
| `GET /api/v1/travel-expenses/categories` | — | bearer/cookie | — |
| `GET /api/v1/travel-expenses/claims` | — | bearer/cookie | — |
| `POST /api/v1/travel-expenses/claims` | — | bearer/cookie | ya |
| `GET /api/v1/travel-expenses/claims/my` | — | bearer/cookie | — |
| `POST /api/v1/travel-expenses/claims/receipt-upload` | — | bearer/cookie | — |
| `GET /api/v1/travel-expenses/claims/{id}` | — | bearer/cookie | — |
| `PATCH /api/v1/travel-expenses/claims/{id}/approve` | — | bearer/cookie | ya |
| `POST /api/v1/travel-expenses/claims/{id}/reimburse` | — | bearer/cookie | ya |
| `PATCH /api/v1/travel-expenses/claims/{id}/reject` | — | bearer/cookie | ya |
| `GET /api/v1/travel-expenses/claims/{id}/workflow` | — | bearer/cookie | — |
| `PATCH /api/v1/travel-expenses/claims/{id}/workflow-action` | — | bearer/cookie | ya |
| `GET /api/v1/travel-expenses/trips` | — | bearer/cookie | — |
| `POST /api/v1/travel-expenses/trips` | — | bearer/cookie | ya |
| `GET /api/v1/travel-expenses/trips/my` | — | bearer/cookie | — |
| `GET /api/v1/travel-expenses/trips/{id}` | — | bearer/cookie | — |
| `POST /api/v1/travel-expenses/trips/{id}/advance` | — | bearer/cookie | ya |
| `PATCH /api/v1/travel-expenses/trips/{id}/approve` | — | bearer/cookie | ya |
| `PATCH /api/v1/travel-expenses/trips/{id}/reject` | — | bearer/cookie | ya |
| `GET /api/v1/travel-expenses/trips/{id}/workflow` | — | bearer/cookie | — |
| `PATCH /api/v1/travel-expenses/trips/{id}/workflow-action` | — | bearer/cookie | ya |

## `benefits` — 10 operasi

| Method & path | Permission | Auth | Body |
|---|---|---|---|
| `GET /api/v1/benefits/enrollments` | `benefit:read` | bearer/cookie | — |
| `POST /api/v1/benefits/enrollments` | `benefit:create` | bearer/cookie | ya |
| `GET /api/v1/benefits/enrollments/{id}` | `benefit:read` | bearer/cookie | — |
| `PATCH /api/v1/benefits/enrollments/{id}` | `benefit:update` | bearer/cookie | ya |
| `DELETE /api/v1/benefits/enrollments/{id}` | `benefit:delete` | bearer/cookie | — |
| `GET /api/v1/benefits/plans` | `benefit:read` | bearer/cookie | — |
| `POST /api/v1/benefits/plans` | `benefit:create` | bearer/cookie | ya |
| `GET /api/v1/benefits/plans/{id}` | `benefit:read` | bearer/cookie | — |
| `PATCH /api/v1/benefits/plans/{id}` | `benefit:update` | bearer/cookie | ya |
| `DELETE /api/v1/benefits/plans/{id}` | `benefit:delete` | bearer/cookie | — |

## `daily-activities` — 7 operasi

| Method & path | Permission | Auth | Body |
|---|---|---|---|
| `GET /api/v1/daily-activities` | `daily-activity:read` | bearer/cookie | — |
| `POST /api/v1/daily-activities` | `daily-activity:create` | bearer/cookie | ya |
| `GET /api/v1/daily-activities/my` | — | bearer/cookie | — |
| `GET /api/v1/daily-activities/{id}` | `daily-activity:read` | bearer/cookie | — |
| `PUT /api/v1/daily-activities/{id}` | `daily-activity:update` | bearer/cookie | ya |
| `DELETE /api/v1/daily-activities/{id}` | `daily-activity:delete` | bearer/cookie | — |
| `POST /api/v1/daily-activities/{id}/complete` | `daily-activity:update` | bearer/cookie | ya |

## `assets` — 7 operasi

| Method & path | Permission | Auth | Body |
|---|---|---|---|
| `GET /api/v1/assets` | `employee:read` | bearer/cookie | — |
| `POST /api/v1/assets` | `employee:create` | bearer/cookie | ya |
| `GET /api/v1/assets/my` | — | bearer/cookie | — |
| `GET /api/v1/assets/{id}` | `employee:read` | bearer/cookie | — |
| `POST /api/v1/assets/{id}/assign` | `employee:update` | bearer/cookie | ya |
| `GET /api/v1/assets/{id}/depreciation` | `employee:read` | bearer/cookie | — |
| `POST /api/v1/assets/{id}/return` | `employee:update` | bearer/cookie | — |

## `documents` — 13 operasi

| Method & path | Permission | Auth | Body |
|---|---|---|---|
| `GET /api/v1/documents` | `document:read` | bearer/cookie | — |
| `POST /api/v1/documents` | `document:create` | bearer/cookie | — |
| `GET /api/v1/documents/categories` | `document:read` | bearer/cookie | — |
| `POST /api/v1/documents/categories` | `document:create` | bearer/cookie | — |
| `GET /api/v1/documents/signatures/mine` | — | bearer/cookie | — |
| `GET /api/v1/documents/{id}` | `document:read` | bearer/cookie | — |
| `POST /api/v1/documents/{id}/decline` | — | bearer/cookie | ya |
| `GET /api/v1/documents/{id}/download` | `document:read` | bearer/cookie | — |
| `GET /api/v1/documents/{id}/file` | `document:read` | bearer/cookie | — |
| `POST /api/v1/documents/{id}/sign` | — | bearer/cookie | — |
| `GET /api/v1/documents/{id}/signed-url` | `document:read` | bearer/cookie | — |
| `GET /api/v1/documents/{id}/signers` | `document:read` | bearer/cookie | — |
| `POST /api/v1/documents/{id}/signers` | `document:update` | bearer/cookie | ya |

## `announcements` — 4 operasi

| Method & path | Permission | Auth | Body |
|---|---|---|---|
| `GET /api/v1/announcements` | — | bearer/cookie | — |
| `GET /api/v1/announcements/unread-count` | — | bearer/cookie | — |
| `GET /api/v1/announcements/{id}` | — | bearer/cookie | — |
| `PUT /api/v1/announcements/{id}/read` | — | bearer/cookie | — |

## `notifications` — 7 operasi

| Method & path | Permission | Auth | Body |
|---|---|---|---|
| `GET /api/v1/notifications` | — | bearer/cookie | — |
| `POST /api/v1/notifications/device-tokens` | — | bearer/cookie | ya |
| `DELETE /api/v1/notifications/device-tokens` | — | bearer/cookie | ya |
| `PUT /api/v1/notifications/read` | — | bearer/cookie | ya |
| `PUT /api/v1/notifications/read-all` | — | bearer/cookie | — |
| `GET /api/v1/notifications/unread-count` | — | bearer/cookie | — |
| `DELETE /api/v1/notifications/{id}` | — | bearer/cookie | — |

## `workflow-engine` — 14 operasi

| Method & path | Permission | Auth | Body |
|---|---|---|---|
| `GET /api/v1/workflow-engine/delegations` | — | bearer/cookie | — |
| `POST /api/v1/workflow-engine/delegations` | — | bearer/cookie | ya |
| `PATCH /api/v1/workflow-engine/delegations/{id}/revoke` | — | bearer/cookie | — |
| `GET /api/v1/workflow-engine/instances` | `workflow:read` | bearer/cookie | — |
| `POST /api/v1/workflow-engine/instances/bulk-approve` | `workflow:approve` | bearer/cookie | ya |
| `GET /api/v1/workflow-engine/instances/my-approvals` | `workflow:approve` | bearer/cookie | — |
| `POST /api/v1/workflow-engine/instances/start` | `workflow:create` | bearer/cookie | ya |
| `GET /api/v1/workflow-engine/instances/{id}` | `workflow:read` | bearer/cookie | — |
| `POST /api/v1/workflow-engine/instances/{id}/actions` | `workflow:approve` | bearer/cookie | ya |
| `GET /api/v1/workflow-engine/templates` | `workflow:read` | bearer/cookie | — |
| `POST /api/v1/workflow-engine/templates` | `workflow:create` | bearer/cookie | ya |
| `GET /api/v1/workflow-engine/templates/{id}` | `workflow:read` | bearer/cookie | — |
| `PUT /api/v1/workflow-engine/templates/{id}` | `workflow:update` | bearer/cookie | ya |
| `DELETE /api/v1/workflow-engine/templates/{id}` | `workflow:delete` | bearer/cookie | — |

## `performance` — 99 operasi

| Method & path | Permission | Auth | Body |
|---|---|---|---|
| `GET /api/v1/performance/approval-workflows` | `performance:read` | bearer/cookie | — |
| `POST /api/v1/performance/approval-workflows` | `performance:create` | bearer/cookie | ya |
| `GET /api/v1/performance/approval-workflows/{id}` | `performance:read` | bearer/cookie | — |
| `PUT /api/v1/performance/approval-workflows/{id}` | `performance:update` | bearer/cookie | ya |
| `POST /api/v1/performance/calibration-participants/{id}/decision` | `performance:approve` | bearer/cookie | ya |
| `POST /api/v1/performance/calibration-sessions/{id}/close` | `performance:approve` | bearer/cookie | — |
| `POST /api/v1/performance/calibration-sessions/{id}/finalize` | `performance:approve` | bearer/cookie | — |
| `POST /api/v1/performance/calibration-sessions/{id}/open` | `performance:approve` | bearer/cookie | — |
| `PUT /api/v1/performance/components/{id}` | `performance:update` | bearer/cookie | ya |
| `POST /api/v1/performance/development-recommendations/{id}/assign` | `performance:update` | bearer/cookie | ya |
| `GET /api/v1/performance/execution/approval-queue` | `performance:read` | bearer/cookie | — |
| `GET /api/v1/performance/execution/assignments/{id}` | `performance:read` | bearer/cookie | — |
| `GET /api/v1/performance/execution/my-assignments` | `performance:read` | bearer/cookie | — |
| `PATCH /api/v1/performance/execution/targets/{id}/comment` | `performance:update` | bearer/cookie | ya |
| `GET /api/v1/performance/feedback-requests` | `performance:read` | bearer/cookie | — |
| `POST /api/v1/performance/feedback-requests` | `performance:create` | bearer/cookie | ya |
| `POST /api/v1/performance/feedback-responses` | `performance:create` | bearer/cookie | ya |
| `GET /api/v1/performance/formulas` | `performance:read` | bearer/cookie | — |
| `POST /api/v1/performance/formulas` | `performance:create` | bearer/cookie | ya |
| `GET /api/v1/performance/formulas/{id}` | `performance:read` | bearer/cookie | — |
| `PUT /api/v1/performance/formulas/{id}` | `performance:update` | bearer/cookie | ya |
| `GET /api/v1/performance/goals` | `performance:read` | bearer/cookie | — |
| `POST /api/v1/performance/goals` | `performance:create` | bearer/cookie | ya |
| `GET /api/v1/performance/goals/{id}/chain` | `performance:read` | bearer/cookie | — |
| `GET /api/v1/performance/goals/{id}/children` | `performance:read` | bearer/cookie | — |
| `PATCH /api/v1/performance/goals/{id}/parent` | `performance:update` | bearer/cookie | ya |
| `PATCH /api/v1/performance/goals/{id}/progress` | `performance:update` | bearer/cookie | ya |
| `GET /api/v1/performance/grades` | `performance:read` | bearer/cookie | — |
| `POST /api/v1/performance/grades` | `performance:create` | bearer/cookie | ya |
| `GET /api/v1/performance/grades/{id}` | `performance:read` | bearer/cookie | — |
| `PUT /api/v1/performance/grades/{id}` | `performance:update` | bearer/cookie | ya |
| `GET /api/v1/performance/indicators` | `performance:read` | bearer/cookie | — |
| `POST /api/v1/performance/indicators` | `performance:create` | bearer/cookie | ya |
| `GET /api/v1/performance/indicators/{id}` | `performance:read` | bearer/cookie | — |
| `PUT /api/v1/performance/indicators/{id}` | `performance:update` | bearer/cookie | ya |
| `GET /api/v1/performance/method-versions/{id}` | `performance:read` | bearer/cookie | — |
| `PUT /api/v1/performance/method-versions/{id}` | `performance:update` | bearer/cookie | ya |
| `GET /api/v1/performance/method-versions/{id}/components` | `performance:read` | bearer/cookie | — |
| `POST /api/v1/performance/method-versions/{id}/components` | `performance:create` | bearer/cookie | ya |
| `POST /api/v1/performance/method-versions/{id}/publish` | `performance:update` | bearer/cookie | — |
| `GET /api/v1/performance/method-versions/{id}/readiness` | `performance:read` | bearer/cookie | — |
| `GET /api/v1/performance/methods` | `performance:read` | bearer/cookie | — |
| `POST /api/v1/performance/methods` | `performance:create` | bearer/cookie | ya |
| `GET /api/v1/performance/methods/{id}` | `performance:read` | bearer/cookie | — |
| `PUT /api/v1/performance/methods/{id}` | `performance:update` | bearer/cookie | ya |
| `POST /api/v1/performance/methods/{id}/version` | `performance:create` | bearer/cookie | ya |
| `GET /api/v1/performance/methods/{id}/versions` | `performance:read` | bearer/cookie | — |
| `GET /api/v1/performance/periods` | `performance:read` | bearer/cookie | — |
| `POST /api/v1/performance/periods` | `performance:create` | bearer/cookie | ya |
| `GET /api/v1/performance/periods/{id}` | `performance:read` | bearer/cookie | — |
| `PUT /api/v1/performance/periods/{id}` | `performance:update` | bearer/cookie | ya |
| `GET /api/v1/performance/periods/{id}/automation-schedules` | `performance:read` | bearer/cookie | — |
| `POST /api/v1/performance/periods/{id}/automation-schedules` | `performance:update` | bearer/cookie | ya |
| `GET /api/v1/performance/periods/{id}/calibrations` | `performance:read` | bearer/cookie | — |
| `POST /api/v1/performance/periods/{id}/calibrations` | `performance:create` | bearer/cookie | ya |
| `GET /api/v1/performance/periods/{id}/development-recommendations` | `performance:read` | bearer/cookie | — |
| `POST /api/v1/performance/periods/{id}/development-recommendations/sync` | `performance:update` | bearer/cookie | ya |
| `GET /api/v1/performance/periods/{id}/planning` | `performance:read` | bearer/cookie | — |
| `POST /api/v1/performance/periods/{id}/planning/assignments` | `performance:create` | bearer/cookie | ya |
| `POST /api/v1/performance/periods/{id}/planning/publish` | `performance:update` | bearer/cookie | — |
| `POST /api/v1/performance/periods/{id}/publish` | `performance:update` | bearer/cookie | — |
| `GET /api/v1/performance/periods/{id}/readiness` | `performance:read` | bearer/cookie | — |
| `GET /api/v1/performance/periods/{id}/results` | `performance:read` | bearer/cookie | — |
| `POST /api/v1/performance/periods/{id}/results/calculate` | `performance:update` | bearer/cookie | — |
| `GET /api/v1/performance/periods/{id}/results/dashboard` | `performance:read` | bearer/cookie | — |
| `POST /api/v1/performance/periods/{id}/results/final-approve` | `performance:approve` | bearer/cookie | ya |
| `POST /api/v1/performance/periods/{id}/results/publish` | `performance:approve` | bearer/cookie | ya |
| `POST /api/v1/performance/periods/{id}/results/reminders` | `performance:approve` | bearer/cookie | ya |
| `PUT /api/v1/performance/planning-assignments/{id}` | `performance:update` | bearer/cookie | ya |
| `DELETE /api/v1/performance/planning-assignments/{id}` | `performance:update` | bearer/cookie | — |
| `POST /api/v1/performance/planning-assignments/{id}/approve` | `performance:approve` | bearer/cookie | ya |
| `POST /api/v1/performance/planning-assignments/{id}/complete` | `performance:update` | bearer/cookie | ya |
| `POST /api/v1/performance/planning-assignments/{id}/reassign` | `performance:update` | bearer/cookie | ya |
| `POST /api/v1/performance/planning-assignments/{id}/reject` | `performance:approve` | bearer/cookie | ya |
| `POST /api/v1/performance/planning-assignments/{id}/revision` | `performance:approve` | bearer/cookie | ya |
| `POST /api/v1/performance/planning-assignments/{id}/submit` | `performance:update` | bearer/cookie | ya |
| `POST /api/v1/performance/planning-assignments/{id}/targets` | `performance:create` | bearer/cookie | ya |
| `PUT /api/v1/performance/planning-targets/{id}` | `performance:update` | bearer/cookie | ya |
| `DELETE /api/v1/performance/planning-targets/{id}` | `performance:update` | bearer/cookie | — |
| `POST /api/v1/performance/planning-targets/{id}/evidences` | `performance:update` | bearer/cookie | — |
| `POST /api/v1/performance/planning-targets/{id}/progress` | `performance:update` | bearer/cookie | ya |
| `POST /api/v1/performance/result-disputes/{id}/attachments` | `performance:read` | bearer/cookie | — |
| `POST /api/v1/performance/result-disputes/{id}/respond` | `performance:approve` | bearer/cookie | ya |
| `GET /api/v1/performance/results/me` | `performance:read` | bearer/cookie | — |
| `POST /api/v1/performance/results/{id}/acknowledge` | `performance:read` | bearer/cookie | ya |
| `POST /api/v1/performance/results/{id}/attachments` | `performance:read` | bearer/cookie | — |
| `POST /api/v1/performance/results/{id}/disputes` | `performance:read` | bearer/cookie | ya |
| `POST /api/v1/performance/results/{id}/reopen` | `performance:approve` | bearer/cookie | ya |
| `GET /api/v1/performance/review-cycles` | `performance:read` | bearer/cookie | — |
| `POST /api/v1/performance/review-cycles` | `performance:create` | bearer/cookie | ya |
| `GET /api/v1/performance/review-workflows` | `performance:read` | bearer/cookie | — |
| `POST /api/v1/performance/review-workflows` | `performance:create` | bearer/cookie | ya |
| `GET /api/v1/performance/review-workflows/{id}` | `performance:read` | bearer/cookie | — |
| `PUT /api/v1/performance/review-workflows/{id}` | `performance:update` | bearer/cookie | ya |
| `GET /api/v1/performance/reviews` | `performance:read` | bearer/cookie | — |
| `POST /api/v1/performance/reviews` | `performance:create` | bearer/cookie | ya |
| `GET /api/v1/performance/reviews/{id}` | `performance:read` | bearer/cookie | — |
| `PATCH /api/v1/performance/reviews/{id}/approve` | `performance:approve` | bearer/cookie | — |
| `PATCH /api/v1/performance/reviews/{id}/submit` | `performance:update` | bearer/cookie | — |

## `training` — 16 operasi

| Method & path | Permission | Auth | Body |
|---|---|---|---|
| `GET /api/v1/training/categories` | `training:read` | bearer/cookie | — |
| `POST /api/v1/training/categories` | `training:create` | bearer/cookie | ya |
| `GET /api/v1/training/courses` | `training:read` | bearer/cookie | — |
| `POST /api/v1/training/courses` | `training:create` | bearer/cookie | ya |
| `GET /api/v1/training/courses/{id}` | `training:read` | bearer/cookie | — |
| `PATCH /api/v1/training/courses/{id}` | `training:update` | bearer/cookie | ya |
| `POST /api/v1/training/courses/{id}/complete` | `training:update` | bearer/cookie | — |
| `POST /api/v1/training/courses/{id}/enroll` | `training:create` | bearer/cookie | — |
| `GET /api/v1/training/enrollments` | `training:read` | bearer/cookie | — |
| `POST /api/v1/training/enrollments` | `training:create` | bearer/cookie | ya |
| `PATCH /api/v1/training/enrollments/{id}/complete` | `training:update` | bearer/cookie | — |
| `GET /api/v1/training/enrollments/{id}/evaluation` | `training:read` | bearer/cookie | — |
| `POST /api/v1/training/enrollments/{id}/feedback` | — | bearer/cookie | ya |
| `PATCH /api/v1/training/enrollments/{id}/score` | `training:update` | bearer/cookie | ya |
| `GET /api/v1/training/sessions` | `training:read` | bearer/cookie | — |
| `POST /api/v1/training/sessions` | `training:create` | bearer/cookie | ya |

## `recruitment` — 24 operasi

| Method & path | Permission | Auth | Body |
|---|---|---|---|
| `GET /api/v1/recruitment/applications` | `recruitment:read` | bearer/cookie | — |
| `POST /api/v1/recruitment/applications` | `recruitment:create` | bearer/cookie | ya |
| `GET /api/v1/recruitment/applications/{id}/offers` | `recruitment:read` | bearer/cookie | — |
| `POST /api/v1/recruitment/applications/{id}/offers` | `recruitment:create` | bearer/cookie | ya |
| `PATCH /api/v1/recruitment/applications/{id}/status` | `recruitment:update` | bearer/cookie | ya |
| `GET /api/v1/recruitment/candidates` | `recruitment:read` | bearer/cookie | — |
| `POST /api/v1/recruitment/candidates` | `recruitment:create` | bearer/cookie | ya |
| `GET /api/v1/recruitment/candidates/{id}` | `recruitment:read` | bearer/cookie | — |
| `GET /api/v1/recruitment/interviews` | `recruitment:read` | bearer/cookie | — |
| `POST /api/v1/recruitment/interviews` | `recruitment:create` | bearer/cookie | ya |
| `POST /api/v1/recruitment/interviews/{id}/feedback` | `recruitment:create` | bearer/cookie | ya |
| `GET /api/v1/recruitment/job-postings` | `recruitment:read` | bearer/cookie | — |
| `POST /api/v1/recruitment/job-postings` | `recruitment:create` | bearer/cookie | ya |
| `GET /api/v1/recruitment/job-postings/{id}` | `recruitment:read` | bearer/cookie | — |
| `PATCH /api/v1/recruitment/job-postings/{id}/approve` | `recruitment:approve` | bearer/cookie | — |
| `PATCH /api/v1/recruitment/job-postings/{id}/close` | `recruitment:update` | bearer/cookie | — |
| `PATCH /api/v1/recruitment/offers/{id}/approve` | `recruitment:approve` | bearer/cookie | — |
| `PATCH /api/v1/recruitment/offers/{id}/respond` | `recruitment:update` | bearer/cookie | ya |
| `GET /api/v1/recruitment/requisitions` | `recruitment:read` | bearer/cookie | — |
| `POST /api/v1/recruitment/requisitions` | `recruitment:create` | bearer/cookie | ya |
| `PATCH /api/v1/recruitment/requisitions/{id}/approve` | `recruitment:approve` | bearer/cookie | — |
| `PATCH /api/v1/recruitment/requisitions/{id}/cancel` | `recruitment:update` | bearer/cookie | — |
| `PATCH /api/v1/recruitment/requisitions/{id}/reject` | `recruitment:approve` | bearer/cookie | ya |
| `PATCH /api/v1/recruitment/requisitions/{id}/submit` | `recruitment:update` | bearer/cookie | — |

## `onboarding` — 11 operasi

| Method & path | Permission | Auth | Body |
|---|---|---|---|
| `GET /api/v1/onboarding/checklists` | `employee:read` | bearer/cookie | — |
| `POST /api/v1/onboarding/checklists` | `employee:create` | bearer/cookie | ya |
| `PATCH /api/v1/onboarding/checklists/{id}` | `employee:update` | bearer/cookie | ya |
| `PATCH /api/v1/onboarding/clearances/{id}` | `employee:update` | bearer/cookie | — |
| `GET /api/v1/onboarding/resignations` | `employee:read` | bearer/cookie | — |
| `POST /api/v1/onboarding/resignations` | `employee:create` | bearer/cookie | ya |
| `GET /api/v1/onboarding/resignations/{id}` | `employee:read` | bearer/cookie | — |
| `PATCH /api/v1/onboarding/resignations/{id}/approve` | `employee:update` | bearer/cookie | — |
| `PATCH /api/v1/onboarding/resignations/{id}/complete` | `employee:update` | bearer/cookie | — |
| `POST /api/v1/onboarding/resignations/{id}/final-payroll` | `payroll:read` | bearer/cookie | ya |
| `PATCH /api/v1/onboarding/resignations/{id}/reject` | `employee:update` | bearer/cookie | — |

## `organization` — 37 operasi

| Method & path | Permission | Auth | Body |
|---|---|---|---|
| `GET /api/v1/organization/branches` | `organization:read` | bearer/cookie | — |
| `POST /api/v1/organization/branches` | `organization:create` | bearer/cookie | ya |
| `GET /api/v1/organization/branches/{id}` | `organization:read` | bearer/cookie | — |
| `PUT /api/v1/organization/branches/{id}` | `organization:update` | bearer/cookie | ya |
| `DELETE /api/v1/organization/branches/{id}` | `organization:delete` | bearer/cookie | — |
| `GET /api/v1/organization/branches/{id}/attendance-policy` | `organization:read` | bearer/cookie | — |
| `PUT /api/v1/organization/branches/{id}/attendance-policy` | `organization:update` | bearer/cookie | ya |
| `DELETE /api/v1/organization/branches/{id}/attendance-policy` | `organization:delete` | bearer/cookie | — |
| `GET /api/v1/organization/companies` | `organization:read` | bearer/cookie | — |
| `POST /api/v1/organization/companies` | `organization:create` | bearer/cookie | ya |
| `GET /api/v1/organization/companies/{id}` | `organization:read` | bearer/cookie | — |
| `PUT /api/v1/organization/companies/{id}` | `organization:update` | bearer/cookie | ya |
| `DELETE /api/v1/organization/companies/{id}` | `organization:delete` | bearer/cookie | — |
| `GET /api/v1/organization/companies/{id}/attendance-policy` | `organization:read` | bearer/cookie | — |
| `PUT /api/v1/organization/companies/{id}/attendance-policy` | `organization:update` | bearer/cookie | ya |
| `DELETE /api/v1/organization/companies/{id}/attendance-policy` | `organization:delete` | bearer/cookie | — |
| `GET /api/v1/organization/departments` | `organization:read` | bearer/cookie | — |
| `POST /api/v1/organization/departments` | `organization:create` | bearer/cookie | ya |
| `GET /api/v1/organization/departments/hierarchy/{companyId}` | `organization:read` | bearer/cookie | — |
| `GET /api/v1/organization/departments/{id}` | `organization:read` | bearer/cookie | — |
| `PUT /api/v1/organization/departments/{id}` | `organization:update` | bearer/cookie | ya |
| `DELETE /api/v1/organization/departments/{id}` | `organization:delete` | bearer/cookie | — |
| `GET /api/v1/organization/divisions` | `organization:read` | bearer/cookie | — |
| `POST /api/v1/organization/divisions` | `organization:create` | bearer/cookie | ya |
| `GET /api/v1/organization/divisions/{id}` | `organization:read` | bearer/cookie | — |
| `PUT /api/v1/organization/divisions/{id}` | `organization:update` | bearer/cookie | ya |
| `DELETE /api/v1/organization/divisions/{id}` | `organization:delete` | bearer/cookie | — |
| `GET /api/v1/organization/groups` | `organization:read` | bearer/cookie | — |
| `POST /api/v1/organization/groups` | `organization:create` | bearer/cookie | ya |
| `GET /api/v1/organization/groups/{id}` | `organization:read` | bearer/cookie | — |
| `PUT /api/v1/organization/groups/{id}` | `organization:update` | bearer/cookie | ya |
| `DELETE /api/v1/organization/groups/{id}` | `organization:delete` | bearer/cookie | — |
| `GET /api/v1/organization/positions` | `organization:read` | bearer/cookie | — |
| `POST /api/v1/organization/positions` | `organization:create` | bearer/cookie | ya |
| `GET /api/v1/organization/positions/{id}` | `organization:read` | bearer/cookie | — |
| `PUT /api/v1/organization/positions/{id}` | `organization:update` | bearer/cookie | ya |
| `DELETE /api/v1/organization/positions/{id}` | `organization:delete` | bearer/cookie | — |

## `company-settings` — 5 operasi

| Method & path | Permission | Auth | Body |
|---|---|---|---|
| `GET /api/v1/company-settings` | `settings:read` | bearer/cookie | — |
| `POST /api/v1/company-settings/bulk` | `settings:update` | bearer/cookie | ya |
| `GET /api/v1/company-settings/{key}` | `settings:read` | bearer/cookie | — |
| `PUT /api/v1/company-settings/{key}` | `settings:update` | bearer/cookie | ya |
| `DELETE /api/v1/company-settings/{key}` | `settings:update` | bearer/cookie | — |

## `administration` — 7 operasi

| Method & path | Permission | Auth | Body |
|---|---|---|---|
| `GET /api/v1/administration/role-data-scope` | `rbac:update` | bearer/cookie | — |
| `POST /api/v1/administration/role-data-scope` | `rbac:update` | bearer/cookie | ya |
| `GET /api/v1/administration/role-data-scope/my` | — | bearer/cookie | — |
| `GET /api/v1/administration/role-menu-access` | `rbac:update` | bearer/cookie | — |
| `POST /api/v1/administration/role-menu-access` | `rbac:update` | bearer/cookie | ya |
| `POST /api/v1/administration/role-menu-access/bulk-upsert` | `rbac:update` | bearer/cookie | ya |
| `GET /api/v1/administration/role-menu-access/my` | — | bearer/cookie | — |

## `users` — 11 operasi

| Method & path | Permission | Auth | Body |
|---|---|---|---|
| `GET /api/v1/users` | `user:read` | bearer/cookie | — |
| `POST /api/v1/users` | `user:create` | bearer/cookie | ya |
| `GET /api/v1/users/{id}` | `user:read` | bearer/cookie | — |
| `PUT /api/v1/users/{id}` | `user:update` | bearer/cookie | ya |
| `DELETE /api/v1/users/{id}` | `user:delete` | bearer/cookie | — |
| `GET /api/v1/users/{id}/company-access` | `user:read` | bearer/cookie | — |
| `POST /api/v1/users/{id}/company-access` | `user:update` | bearer/cookie | ya |
| `PUT /api/v1/users/{id}/company-access/{accessId}` | `user:update` | bearer/cookie | ya |
| `DELETE /api/v1/users/{id}/company-access/{accessId}` | `user:update` | bearer/cookie | — |
| `GET /api/v1/users/{id}/roles` | `rbac:read` | bearer/cookie | — |
| `PUT /api/v1/users/{id}/roles` | `rbac:update` | bearer/cookie | ya |

## `webhooks` — 6 operasi

| Method & path | Permission | Auth | Body |
|---|---|---|---|
| `GET /api/v1/webhooks` | `rbac:read` | bearer/cookie | — |
| `POST /api/v1/webhooks` | `rbac:create` | bearer/cookie | ya |
| `GET /api/v1/webhooks/deliveries` | `rbac:read` | bearer/cookie | — |
| `GET /api/v1/webhooks/events` | `rbac:read` | bearer/cookie | — |
| `PATCH /api/v1/webhooks/{id}` | `rbac:update` | bearer/cookie | ya |
| `DELETE /api/v1/webhooks/{id}` | `rbac:delete` | bearer/cookie | — |

## `reports` — 7 operasi

| Method & path | Permission | Auth | Body |
|---|---|---|---|
| `GET /api/v1/reports/attendance` | `report:read` | bearer/cookie | — |
| `GET /api/v1/reports/headcount` | `report:read` | bearer/cookie | — |
| `GET /api/v1/reports/leave` | `report:read` | bearer/cookie | — |
| `GET /api/v1/reports/payroll` | `report:read` | bearer/cookie | — |
| `GET /api/v1/reports/recruitment` | `report:read` | bearer/cookie | — |
| `GET /api/v1/reports/summary` | — | bearer/cookie | — |
| `GET /api/v1/reports/turnover` | `report:read` | bearer/cookie | — |

## `private-files` — 4 operasi

| Method & path | Permission | Auth | Body |
|---|---|---|---|
| `GET /api/v1/private-files/leave-attachments/{id}` | `leave:read` | bearer/cookie | — |
| `GET /api/v1/private-files/performance-evidence/{id}` | `performance:read` | bearer/cookie | — |
| `GET /api/v1/private-files/permission-attachments/{id}` | — | bearer/cookie | — |
| `GET /api/v1/private-files/receipts/{id}` | — | bearer/cookie | — |

## `meta` — 2 operasi

| Method & path | Permission | Auth | Body |
|---|---|---|---|
| `GET /api/v1/meta/endpoints` | `rbac:read` | bearer/cookie | — |
| `GET /api/v1/meta/openapi.json` | `rbac:read` | bearer/cookie | — |

## `health` — 3 operasi

| Method & path | Permission | Auth | Body |
|---|---|---|---|
| `GET /health` | — | publik | — |
| `GET /health/live` | — | publik | — |
| `GET /health/ready` | — | publik | — |

## `audit-logs` — 4 operasi

| Method & path | Permission | Auth | Body |
|---|---|---|---|
| `GET /api/v1/audit-logs` | `audit-log:read` | bearer/cookie | — |
| `GET /api/v1/audit-logs/export` | `audit-log:read` | bearer/cookie | — |
| `GET /api/v1/audit-logs/verify-integrity` | `audit-log:read` | bearer/cookie | — |
| `GET /api/v1/audit-logs/{id}` | `audit-log:read` | bearer/cookie | — |

## `roles` — 8 operasi

| Method & path | Permission | Auth | Body |
|---|---|---|---|
| `GET /api/v1/roles` | `rbac:read` | bearer/cookie | — |
| `POST /api/v1/roles` | `rbac:create` | bearer/cookie | ya |
| `GET /api/v1/roles/permissions/all` | `rbac:read` | bearer/cookie | — |
| `GET /api/v1/roles/{id}` | `rbac:read` | bearer/cookie | — |
| `PUT /api/v1/roles/{id}` | `rbac:update` | bearer/cookie | ya |
| `DELETE /api/v1/roles/{id}` | `rbac:delete` | bearer/cookie | — |
| `GET /api/v1/roles/{id}/permissions` | `rbac:read` | bearer/cookie | — |
| `PUT /api/v1/roles/{id}/permissions` | `rbac:update` | bearer/cookie | ya |

