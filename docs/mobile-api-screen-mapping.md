# Mobile API Screen Mapping

## Purpose

Dokumen ini adalah handoff praktis untuk tim mobile.
Fokusnya bukan daftar semua route, tapi mapping per screen: data apa yang dibutuhkan, endpoint apa yang dipanggil, parameter apa yang wajib dikirim, dan state apa yang harus disimpan di client.

Dokumen API lengkap tetap ada di [mobile-api-documentation.md](file:///Users/f/Documents/sdk-project/hrms/hris-draft/docs/mobile-api-documentation.md).

## Shared Client State

State minimum yang perlu disimpan setelah login:

- `accessToken`
- `refreshToken`
- `expiresIn`
- `userId`
- `employeeId`
- `companyId` aktif
- `companyScope`
- `groupId`
- `roles`
- `permissions`

Aturan client:

1. Selalu kirim `Authorization: Bearer <accessToken>` untuk protected endpoint.
2. Selalu kirim `companyId` eksplisit untuk request yang company-aware.
3. Untuk fitur self-service tertentu, simpan juga `employeeId` karena beberapa endpoint masih meminta `employeeId` explicit.
4. Saat `401`, coba refresh token satu kali lewat `/auth/refresh`.
5. Jika refresh gagal, hapus seluruh session lokal lalu arahkan ke login.

## Auth Flow

### Screen: Login

Tujuan:

- autentikasi user
- bootstrap session awal

Primary request:

- `POST /api/v1/auth/login`

Request body:

```json
{
  "email": "user@company.com",
  "password": "Secret123!"
}
```

Success handling:

1. Simpan `tokens.accessToken`
2. Simpan `tokens.refreshToken`
3. Simpan `user.companyId`
4. Simpan `user.companyScope`
5. Simpan `user.employeeId`
6. Simpan `roles` dan `permissions`

Follow-up request setelah login:

- `GET /api/v1/auth/me`
- `GET /api/v1/organization/companies`

UI decision:

- kalau `mustChangePassword = true`, arahkan ke change password flow
- kalau user punya lebih dari satu `companyScope`, tampilkan company selector atau pakai company default

### Screen: Session / Splash Bootstrap

Tujuan:

- restore session saat app dibuka
- validasi token lama

Flow:

1. cek access token
2. jika access token expired, panggil `POST /api/v1/auth/refresh`
3. jika refresh berhasil, panggil `GET /api/v1/auth/me`
4. jika refresh gagal, logout lokal

Primary requests:

- `POST /api/v1/auth/refresh`
- `GET /api/v1/auth/me`

### Screen: Profile / Account

Primary requests:

- `GET /api/v1/auth/me`
- `POST /api/v1/auth/change-password`
- `GET /api/v1/auth/sessions`
- `DELETE /api/v1/auth/sessions/:id`
- `POST /api/v1/auth/logout`

Notes:

- session list cocok untuk device management
- logout saat ini tetap mengirim `refreshToken` di body

## App Bootstrap

### Screen: Company Switcher

Tujuan:

- tampilkan company yang boleh diakses user
- ubah company aktif untuk screen lain

Primary request:

- `GET /api/v1/organization/companies`

Optional request:

- `GET /api/v1/organization/companies/:id`

Important params:

- `groupId` optional di list companies

Client rule:

- hanya izinkan pilih company yang ada di `companyScope`
- setelah company aktif berubah, invalidasi cache query yang company-dependent

## Employee App

### Screen: Home Dashboard Employee

Tujuan:

- tampilkan ringkasan cepat untuk employee aktif

Recommended requests:

- `GET /api/v1/auth/me`
- `GET /api/v1/notifications/unread-count`
- `GET /api/v1/attendance/summary?companyId={companyId}&month={month}&year={year}`
- `GET /api/v1/leave/balances/employee?employeeId={employeeId}`
- `GET /api/v1/employee-loans/my?employeeId={employeeId}`
- `GET /api/v1/travel-expenses/trips/my?employeeId={employeeId}`
- `GET /api/v1/travel-expenses/claims/my?employeeId={employeeId}`

Minimum local dependencies:

- `companyId`
- `employeeId`

Recommended loading priority:

1. unread notifications
2. attendance summary
3. leave balance
4. open loans and claims

### Screen: Notifications

Primary requests:

- `GET /api/v1/notifications`
- `GET /api/v1/notifications/unread-count`
- `PUT /api/v1/notifications/read`
- `PUT /api/v1/notifications/read-all`
- `DELETE /api/v1/notifications/:id`

Query params:

- `unreadOnly` optional
- `limit` optional

Recommended behavior:

- fetch unread count untuk badge global
- mark as read per batch setelah user membuka inbox atau detail

### Screen: Attendance History

Primary requests:

- `GET /api/v1/attendance?companyId={companyId}&employeeId={employeeId}&month={month}`
- `GET /api/v1/attendance/summary?companyId={companyId}&month={month}&year={year}`
- `GET /api/v1/attendance/:id`

Optional action requests:

- `POST /api/v1/attendance`
- `PATCH /api/v1/attendance/:id/checkout`
- `PATCH /api/v1/attendance/:id/correction`

Use cases:

- list riwayat kehadiran
- detail attendance harian
- correction request bila flow ini dibuka ke mobile

### Screen: Overtime

Employee action:

- `POST /api/v1/attendance/overtime`

History:

- `GET /api/v1/attendance/overtime?companyId={companyId}&employeeId={employeeId}`

Approval screen:

- `PATCH /api/v1/attendance/overtime/:id/approve`
- `PATCH /api/v1/attendance/overtime/:id/reject`

### Screen: Leave List

Primary requests:

- `GET /api/v1/leave?companyId={companyId}&employeeId={employeeId}`
- `GET /api/v1/leave/types?companyId={companyId}`
- `GET /api/v1/leave/balances/employee?employeeId={employeeId}`

Detail:

- `GET /api/v1/leave/:id`

Create:

- `POST /api/v1/leave`

Body minimum:

```json
{
  "employeeId": "uuid",
  "companyId": "uuid",
  "leaveTypeId": "uuid",
  "startDate": "2026-07-10T00:00:00.000Z",
  "endDate": "2026-07-12T00:00:00.000Z",
  "reason": "Family event"
}
```

### Screen: Employee Loans

Primary requests:

- `GET /api/v1/employee-loans/my?employeeId={employeeId}`
- `GET /api/v1/employee-loans/:id`
- `GET /api/v1/employee-loans/:id/installments`
- `GET /api/v1/employee-loans/types?companyId={companyId}`

Create:

- `POST /api/v1/employee-loans`

Important warning:

- endpoint create loan masih punya mismatch backend antara validator dan controller
- jangan dijadikan contract final untuk production sebelum backend dirapikan

### Screen: Travel Requests

Trip list:

- `GET /api/v1/travel-expenses/trips/my?employeeId={employeeId}`

Claim list:

- `GET /api/v1/travel-expenses/claims/my?employeeId={employeeId}`

Create trip:

- `POST /api/v1/travel-expenses/trips`

Create claim:

- `POST /api/v1/travel-expenses/claims`

Reimburse biasanya bukan flow employee, tapi approver/admin:

- `POST /api/v1/travel-expenses/claims/:id/reimburse`

### Screen: Employee Profile

Primary requests:

- `GET /api/v1/employees/:id`
- `GET /api/v1/employees/:id/families`
- `GET /api/v1/employees/:id/educations`
- `GET /api/v1/employees/:id/emergency-contacts`
- `GET /api/v1/employees/:id/trainings`
- `GET /api/v1/employees/:id/skills`
- `GET /api/v1/employees/:id/experiences`
- `GET /api/v1/employees/:id/attachments`
- `GET /api/v1/employees/:id/career-transactions`
- `GET /api/v1/employees/:id/company-assignments`

Recommended tabs:

1. overview
2. personal data
3. career
4. documents

## Manager / Admin App

### Screen: Team Dashboard

Recommended requests:

- `GET /api/v1/attendance/summary?companyId={companyId}&month={month}&year={year}`
- `GET /api/v1/leave?companyId={companyId}&status=PENDING`
- `GET /api/v1/attendance/overtime?companyId={companyId}&status=PENDING`
- `GET /api/v1/employee-loans?companyId={companyId}&status=PENDING`
- `GET /api/v1/travel-expenses/trips?companyId={companyId}&status=PENDING`
- `GET /api/v1/travel-expenses/claims?companyId={companyId}&status=PENDING`

### Screen: Employee Directory

Primary request:

- `GET /api/v1/employees?companyId={companyId}&page=1&limit=20`

Common filters:

- `search`
- `departmentId`
- `positionId`
- `status`

Detail flow:

- `GET /api/v1/employees/:id`

### Screen: Employee Detail Admin

Primary requests:

- `GET /api/v1/employees/:id`
- `GET /api/v1/employees/:id/career-transactions`
- `GET /api/v1/employees/:id/company-assignments`

Mutation actions:

- `PUT /api/v1/employees/:id`
- `PATCH /api/v1/employees/:id/status`
- `POST /api/v1/employees/:id/career-transactions`
- `POST /api/v1/employees/:id/company-assignments`
- `PUT /api/v1/employees/:id/company-assignments/:assignmentId`
- `DELETE /api/v1/employees/:id/company-assignments/:assignmentId`

### Screen: Leave Approval

List pending:

- `GET /api/v1/leave?companyId={companyId}&status=PENDING`

Actions:

- `PATCH /api/v1/leave/:id/approve`
- `PATCH /api/v1/leave/:id/reject`

### Screen: Overtime Approval

List pending:

- `GET /api/v1/attendance/overtime?companyId={companyId}&status=PENDING`

Actions:

- `PATCH /api/v1/attendance/overtime/:id/approve`
- `PATCH /api/v1/attendance/overtime/:id/reject`

### Screen: Loan Approval

List pending:

- `GET /api/v1/employee-loans?companyId={companyId}&status=PENDING`

Actions:

- `PATCH /api/v1/employee-loans/:id/approve`
- `PATCH /api/v1/employee-loans/:id/reject`

### Screen: Travel Approval

Trip approvals:

- `GET /api/v1/travel-expenses/trips?companyId={companyId}&status=PENDING`
- `PATCH /api/v1/travel-expenses/trips/:id/approve`
- `PATCH /api/v1/travel-expenses/trips/:id/reject`

Claim approvals:

- `GET /api/v1/travel-expenses/claims?companyId={companyId}&status=PENDING`
- `PATCH /api/v1/travel-expenses/claims/:id/approve`
- `PATCH /api/v1/travel-expenses/claims/:id/reject`
- `POST /api/v1/travel-expenses/claims/:id/reimburse`

### Screen: Work Calendar

Primary requests:

- `GET /api/v1/work-calendars?companyId={companyId}`
- `GET /api/v1/work-calendars/:id`
- `GET /api/v1/work-calendars/:id/days?year={year}&month={month}`
- `GET /api/v1/work-calendars/holidays/list?companyId={companyId}&year={year}`

Mutation requests:

- `POST /api/v1/work-calendars`
- `PUT /api/v1/work-calendars/:id`
- `PUT /api/v1/work-calendars/:id/days`
- `POST /api/v1/work-calendars/:id/generate`
- `POST /api/v1/work-calendars/:id/copy`
- `POST /api/v1/work-calendars/holidays`
- `PUT /api/v1/work-calendars/holidays/:hid`
- `DELETE /api/v1/work-calendars/holidays/:hid`

Known caveat:

- endpoint `GET /api/v1/work-calendars/:id/working-days` saat ini lebih aman dipanggil dengan query `calendarId`, `start`, dan `end`

### Screen: User Access Management

Primary requests:

- `GET /api/v1/users?page=1&limit=20`
- `GET /api/v1/users/:id`
- `GET /api/v1/users/:id/roles`
- `PUT /api/v1/users/:id/roles`
- `GET /api/v1/users/:id/company-access`
- `POST /api/v1/users/:id/company-access`
- `PUT /api/v1/users/:id/company-access/:accessId`
- `DELETE /api/v1/users/:id/company-access/:accessId`

Use case:

- admin assign user ke beberapa company
- admin audit role dan access scope

## Recommended Query Keys

Supaya caching mobile rapi, gunakan key berbasis company dan employee:

- `me`
- `companies`
- `notifications`
- `attendance-summary:{companyId}:{month}:{year}`
- `attendance-list:{companyId}:{employeeId}:{month}`
- `leave-list:{companyId}:{employeeId}:{status}`
- `leave-balance:{employeeId}`
- `employee-loans-my:{employeeId}:{status}`
- `travel-trips-my:{employeeId}:{status}`
- `travel-claims-my:{employeeId}:{status}`
- `employees:{companyId}:{page}:{search}:{departmentId}:{positionId}:{status}`

## Handoff Notes

- Dokumen ini cocok dipakai untuk planning screen API integration.
- Untuk kontrak field detail dan sample payload, rujuk [mobile-api-documentation.md](file:///Users/f/Documents/sdk-project/hrms/hris-draft/docs/mobile-api-documentation.md).
- Sebelum mobile production kickoff, backend sebaiknya merapikan dua gap yang sudah teridentifikasi:
  - create employee loan request
  - working days calendar query contract
