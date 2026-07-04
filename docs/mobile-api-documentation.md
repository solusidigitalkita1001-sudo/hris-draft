# Mobile API Documentation

## Overview

Dokumen ini merangkum endpoint backend HRMS yang paling relevan untuk konsumsi mobile app.
Semua endpoint API utama menggunakan prefix:

```text
/api/v1
```

Default local base URL:

```text
http://localhost:3000/api/v1
```

Production base URL mengikuti environment `APP_URL` dan `API_PREFIX`.

## Request Conventions

- Content type: `application/json`
- Authentication: `Authorization: Bearer <accessToken>`
- Protected endpoint wajib memakai access token hasil login.
- Untuk endpoint yang berhubungan dengan data company, mobile disarankan selalu mengirim `companyId` secara eksplisit pada query atau body walaupun backend kadang bisa fallback ke `req.user.companyId`.
- Beberapa endpoint employee-self memakai `employeeId` sebagai query/body parameter.

Contoh header:

```http
Authorization: Bearer eyJhbGciOi...
Content-Type: application/json
```

## Response Format

Semua endpoint mengikuti envelope umum berikut:

```json
{
  "success": true,
  "message": "Success",
  "data": {},
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "totalPages": 5,
    "hasNextPage": true,
    "hasPreviousPage": false
  }
}
```

Catatan:

- `meta` hanya muncul pada endpoint paginated/list tertentu.
- `message` bisa berbeda tergantung aksi, misalnya `Login successful`, `Created successfully`, `Updated successfully`.

## Error Format

Format error standar:

```json
{
  "success": false,
  "code": "VALIDATION_ERROR",
  "message": "Validation failed",
  "errors": [
    {
      "field": "email",
      "message": "Invalid email format"
    }
  ]
}
```

Error code yang umum:

- `AUTHENTICATION_FAILED`
- `TOKEN_EXPIRED`
- `FORBIDDEN`
- `NOT_FOUND`
- `CONFLICT`
- `VALIDATION_ERROR`
- `TOO_MANY_REQUESTS`
- `INTERNAL_ERROR`

## Multi-Company Rules

Backend memakai model akses multi-company berbasis `companyScope` dari JWT.

Aturan penting untuk mobile:

1. Login akan mengembalikan `user.companyId` dan `user.companyScope`.
2. Mobile harus menyimpan company aktif di local state sendiri.
3. Untuk request list/detail yang company-aware, selalu kirim `companyId` aktif.
4. Jika `companyId` yang dikirim tidak termasuk ke dalam `companyScope`, backend akan mengembalikan `403 FORBIDDEN`.
5. `companyId` bisa dibaca backend dari `params`, `query`, atau `body`, tapi best practice untuk mobile adalah kirim eksplisit dan konsisten.

## Recommended Mobile Bootstrap Flow

Urutan bootstrap yang direkomendasikan:

1. `POST /auth/login`
2. Simpan `accessToken`, `refreshToken`, `expiresIn`, `user.companyScope`, `user.companyId`, `user.employeeId`
3. `GET /auth/me`
4. `GET /organization/companies`
5. Tentukan company aktif dari `companyScope`
6. Load screen awal sesuai role:
   - employee app: notifications, attendance summary, leave balance, my loans, my trips/claims
   - manager/admin app: employee list, attendance report, leave approvals

## Authentication

### POST `/auth/login`

Authenticate user memakai email dan password.

Request body:

```json
{
  "email": "admin@company.com",
  "password": "Secret123!"
}
```

Success response:

```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {
      "id": "uuid",
      "email": "admin@company.com",
      "employeeId": "uuid",
      "name": "John Doe",
      "roles": ["COMPANY_ADMIN"],
      "permissions": ["employee:read", "attendance:read"],
      "companyId": "uuid",
      "companyScope": ["uuid-company-a", "uuid-company-b"],
      "groupId": "uuid",
      "mustChangePassword": false
    },
    "tokens": {
      "accessToken": "jwt-access-token",
      "refreshToken": "jwt-refresh-token",
      "expiresIn": 900
    }
  }
}
```

### POST `/auth/refresh`

Refresh access token.

Request body:

```json
{
  "refreshToken": "jwt-refresh-token"
}
```

### POST `/auth/logout`

Protected endpoint untuk revoke refresh token aktif.

Request body:

```json
{
  "refreshToken": "jwt-refresh-token"
}
```

### GET `/auth/me`

Ambil profil user aktif, roles, permissions, dan company context.

### GET `/auth/sessions`

Ambil daftar sesi aktif user saat ini.

### DELETE `/auth/sessions/:id`

Revoke sesi tertentu.

### POST `/auth/change-password`

Request body:

```json
{
  "currentPassword": "OldSecret123!",
  "newPassword": "NewSecret123!"
}
```

## Organization

Dipakai untuk bootstrap master data struktur organisasi dan company switcher.

### GET `/organization/companies`

Mengembalikan daftar company yang visible sesuai `companyScope`.

Query params:

- `groupId` optional

### GET `/organization/companies/:id`

Detail company.

### GET `/organization/groups`

List company group.

### GET `/organization/branches`

List branch.

### GET `/organization/divisions`

List division.

### GET `/organization/departments`

List department.

### GET `/organization/departments/hierarchy/:companyId`

Tree hierarchy department per company.

### GET `/organization/positions`

List position.

## Employees

Modul utama untuk employee directory, employee detail, career, dan assignment lintas company.

### GET `/employees`

List employee dengan pagination.

Query params:

- `companyId` required secara praktis
- `departmentId` optional
- `positionId` optional
- `status` optional
- `search` optional
- `page` optional, default `1`
- `limit` optional, default `20`

Contoh:

```http
GET /api/v1/employees?companyId=uuid&page=1&limit=20&search=andi
```

### GET `/employees/:id`

Detail employee.

### POST `/employees`

Create employee baru.

Body minimum yang penting:

```json
{
  "companyId": "uuid",
  "employeeNumber": "EMP-0001",
  "firstName": "Andi",
  "lastName": "Saputra",
  "email": "andi@company.com",
  "joinDate": "2026-07-01T00:00:00.000Z",
  "employmentType": "PERMANENT"
}
```

### PUT `/employees/:id`

Update employee.

### PATCH `/employees/:id/status`

Update status employee.

### GET `/employees/:id/career-transactions`

List riwayat career transaction.

### POST `/employees/:id/career-transactions`

Create career transaction.

Body:

```json
{
  "effectiveDate": "2026-07-01T00:00:00.000Z",
  "transactionType": "PROMOTION",
  "toDepartmentId": "uuid",
  "toPositionId": "uuid",
  "referenceNumber": "SK-001",
  "reason": "Annual promotion",
  "notes": "Promoted to senior role"
}
```

### GET `/employees/:id/company-assignments`

List assignment employee lintas company.

### POST `/employees/:id/company-assignments`

Body:

```json
{
  "companyId": "uuid",
  "assignmentType": "SECONDMENT",
  "startDate": "2026-07-01T00:00:00.000Z",
  "endDate": "2026-12-31T00:00:00.000Z",
  "reason": "Temporary assignment"
}
```

### PUT `/employees/:id/company-assignments/:assignmentId`

Update company assignment.

### DELETE `/employees/:id/company-assignments/:assignmentId`

Delete company assignment.

### Employee Detail Sub-Entities

Semua endpoint berikut berada di bawah prefix `/employees/:id/*`:

- `GET|POST|PUT|DELETE /families`
- `GET|POST|PUT|DELETE /educations`
- `GET|POST|PUT|DELETE /emergency-contacts`
- `GET|POST|PUT|DELETE /trainings`
- `GET|POST|PUT|DELETE /skills`
- `GET|POST|PUT|DELETE /experiences`
- `GET|POST|PUT|DELETE /attachments`

Catatan:

- Modul ini cocok untuk screen detail profile pada mobile.
- Attachment saat ini masih berupa metadata/path, belum ada flow upload file khusus yang terdokumentasi untuk mobile.
- Endpoint `GET /employees/:id/attachments` mendukung query optional `category`.

## Attendance

### GET `/attendance`

List attendance records.

Query params:

- `companyId` required secara praktis
- `employeeId` optional
- `month` optional
- `status` optional

### GET `/attendance/summary`

Ringkasan attendance.

Query params:

- `companyId` required
- `month` required
- `year` required

### GET `/attendance/report`

Report attendance.

### POST `/attendance`

Create attendance.

Body:

```json
{
  "employeeId": "uuid",
  "companyId": "uuid",
  "date": "2026-07-04T00:00:00.000Z",
  "checkIn": "2026-07-04T08:00:00.000Z",
  "status": "PRESENT",
  "notes": "On time"
}
```

### PATCH `/attendance/:id/checkout`

Body:

```json
{
  "checkOut": "2026-07-04T17:00:00.000Z"
}
```

### PATCH `/attendance/:id/correction`

Digunakan untuk koreksi attendance record.

### Overtime

- `GET /attendance/overtime`
- `POST /attendance/overtime`
- `PATCH /attendance/overtime/:id/approve`
- `PATCH /attendance/overtime/:id/reject`

Body create overtime:

```json
{
  "employeeId": "uuid",
  "companyId": "uuid",
  "date": "2026-07-04T00:00:00.000Z",
  "startTime": "2026-07-04T18:00:00.000Z",
  "endTime": "2026-07-04T21:00:00.000Z",
  "durationHours": 3,
  "reason": "Production deployment",
  "multiplier": 1.5
}
```

## Leave

### GET `/leave/types`

List leave type per company.

Query params:

- `companyId` required

### POST `/leave/types`

Create leave type.

### GET `/leave`

List leave request.

Query params:

- `companyId` required
- `employeeId` optional
- `status` optional
- `leaveTypeId` optional

### GET `/leave/:id`

Detail leave request.

### POST `/leave`

Create leave request.

Body:

```json
{
  "employeeId": "uuid",
  "companyId": "uuid",
  "leaveTypeId": "uuid",
  "startDate": "2026-07-10T00:00:00.000Z",
  "endDate": "2026-07-12T00:00:00.000Z",
  "reason": "Family event",
  "attachment": "https://cdn.example.com/leave/proof.pdf"
}
```

### PATCH `/leave/:id/approve`

Approve leave request.

### PATCH `/leave/:id/reject`

Reject leave request.

Body:

```json
{
  "reason": "Quota exceeded"
}
```

### GET `/leave/balances/employee`

Query params:

- `employeeId` required

### POST `/leave/balances`

Set leave balance.

## Notifications

Notification API fokus ke inbox user aktif.

### GET `/notifications`

Query params:

- `unreadOnly` optional, `true|false`
- `limit` optional, default `50`

### GET `/notifications/unread-count`

Return total unread notification.

### PUT `/notifications/read`

Mark multiple notifications as read.

Body:

```json
{
  "ids": ["uuid-1", "uuid-2"]
}
```

### PUT `/notifications/read-all`

Mark semua notifikasi milik user aktif sebagai read.

### DELETE `/notifications/:id`

Delete satu notifikasi.

## Work Calendars

### GET `/work-calendars`

List calendar per company.

Query params:

- `companyId` required

### GET `/work-calendars/:id`

Detail calendar.

### GET `/work-calendars/:id/days`

Query params:

- `year` optional
- `month` optional

### PUT `/work-calendars/:id/days`

Bulk update hari kerja.

### POST `/work-calendars/:id/generate`

Generate default calendar days.

### POST `/work-calendars/:id/copy`

Body:

```json
{
  "targetYear": 2027,
  "name": "Calendar 2027"
}
```

### GET `/work-calendars/:id/working-days`

Query params:

- `calendarId` required
- `start` required
- `end` required

Catatan:

- Walaupun route memakai `/:id/working-days`, implementasi controller saat ini membaca `calendarId` dari query, bukan dari path param.
- Untuk aman, kirim keduanya dengan nilai yang sama sampai backend dirapikan.

### GET `/work-calendars/holidays/list`

Query params:

- `companyId` required
- `year` optional

### POST `/work-calendars/holidays`

Create holiday.

### PUT `/work-calendars/holidays/:hid`

Update holiday.

### DELETE `/work-calendars/holidays/:hid`

Delete holiday.

### GET `/work-calendars/employee/:employeeId`

Get effective calendar untuk employee tertentu.

### GET `/work-calendars/team/:managerId`

Query params:

- `companyId` required
- `year` optional
- `month` optional

## Employee Loans

Cocok untuk employee self-service dan manager approval.

### GET `/employee-loans/types`

Query params:

- `companyId` required

### GET `/employee-loans`

List semua loan by company.

Query params:

- `companyId` required
- `status` optional

### GET `/employee-loans/my`

List loan milik employee.

Query params:

- `employeeId` required
- `status` optional

### GET `/employee-loans/:id`

Detail loan.

### POST `/employee-loans`

Body:

```json
{
  "employeeId": "uuid",
  "companyId": "uuid",
  "loanTypeId": "uuid",
  "amount": 5000000,
  "totalInstallments": 10,
  "installmentAmount": 500000,
  "reason": "Medical support"
}
```

Catatan implementasi saat ini:

- Validator route saat ini hanya mendefinisikan `loanTypeId`, `amount`, `totalInstallments`, `installmentAmount`, dan `reason`.
- `employeeId` dan `companyId` dipakai oleh controller, tetapi belum masuk schema validator route.
- Sebelum dipakai penuh oleh mobile production, endpoint ini sebaiknya diselaraskan dulu di backend.

### PATCH `/employee-loans/:id/approve`

Approve loan.

Body:

```json
{
  "notes": "Approved by manager"
}
```

### PATCH `/employee-loans/:id/reject`

Reject loan.

### GET `/employee-loans/:id/installments`

List installment schedule.

## Travel Expenses

Modul ini mencakup business trip, travel advance, dan expense claim.

### GET `/travel-expenses/categories`

List kategori expense statis.

### Business Trips

- `GET /travel-expenses/trips`
- `GET /travel-expenses/trips/my`
- `POST /travel-expenses/trips`
- `PATCH /travel-expenses/trips/:id/approve`
- `PATCH /travel-expenses/trips/:id/reject`
- `POST /travel-expenses/trips/:id/advance`

Query params untuk list:

- approver list `/trips`: `companyId` required secara praktis, `status` optional
- self list `/trips/my`: `employeeId` required, `status` optional

Create trip body:

```json
{
  "employeeId": "uuid",
  "companyId": "uuid",
  "destination": "Singapore",
  "purpose": "Client meeting",
  "startDate": "2026-08-10T00:00:00.000Z",
  "endDate": "2026-08-12T00:00:00.000Z",
  "estimatedCost": 7500000,
  "notes": "Need hotel near venue"
}
```

Create advance body:

```json
{
  "companyId": "uuid",
  "amount": 3000000,
  "disbursedAt": "2026-08-08T00:00:00.000Z",
  "notes": "Initial travel cash advance"
}
```

### Expense Claims

- `GET /travel-expenses/claims`
- `GET /travel-expenses/claims/my`
- `POST /travel-expenses/claims`
- `PATCH /travel-expenses/claims/:id/approve`
- `PATCH /travel-expenses/claims/:id/reject`
- `POST /travel-expenses/claims/:id/reimburse`

Query params untuk list:

- approver list `/claims`: `companyId` required secara praktis, `status` optional
- self list `/claims/my`: `employeeId` required, `status` optional

Create claim body:

```json
{
  "employeeId": "uuid",
  "companyId": "uuid",
  "tripId": "uuid",
  "category": "HOTEL",
  "amount": 1250000,
  "description": "Hotel reimbursement",
  "expenseDate": "2026-08-12T00:00:00.000Z",
  "receiptFilePath": "https://cdn.example.com/receipts/hotel-001.jpg",
  "notes": "Paid personally"
}
```

Reimburse claim body:

```json
{
  "companyId": "uuid",
  "method": "TRANSFER",
  "amount": 1250000,
  "notes": "Transferred to employee account"
}
```

## Users and Company Access

Modul ini biasanya dipakai admin app, bukan employee self-service app.

### GET `/users`

List user dengan pagination.

Query params:

- `page` optional
- `limit` optional

### GET `/users/:id`

Detail user.

### PUT `/users/:id/roles`

Assign role ke user.

### GET `/users/:id/roles`

List role user.

### GET `/users/:id/company-access`

List akses company tambahan milik user.

### POST `/users/:id/company-access`

Create akses company user.

### PUT `/users/:id/company-access/:accessId`

Update akses company user.

### DELETE `/users/:id/company-access/:accessId`

Delete akses company user.

## Status Code Guide

- `200` success
- `201` created
- `400` bad request
- `401` invalid or missing token
- `403` forbidden or company scope mismatch
- `404` resource not found
- `409` conflict
- `422` validation error
- `429` rate limited
- `500` internal server error

## Mobile Integration Notes

1. Simpan `accessToken`, `refreshToken`, `companyId`, `companyScope`, `employeeId`, dan `groupId` setelah login.
2. Saat menerima `401`, lakukan `POST /auth/refresh` sekali. Jika refresh gagal, clear seluruh session lokal lalu arahkan user ke login.
3. Saat screen bergantung pada company aktif, jangan mengandalkan fallback backend. Selalu kirim `companyId`.
4. Untuk employee app, prioritaskan endpoint self-service berikut:
   - `/auth/me`
   - `/notifications`
   - `/attendance/summary`
   - `/leave/balances/employee`
   - `/employee-loans/my`
   - `/travel-expenses/trips/my`
   - `/travel-expenses/claims/my`
5. Untuk manager/admin mobile app, tambahkan endpoint approval berikut:
   - `/leave/:id/approve`
   - `/attendance/overtime/:id/approve`
   - `/employee-loans/:id/approve`
   - `/travel-expenses/trips/:id/approve`
   - `/travel-expenses/claims/:id/approve`

## Known Gaps

- Belum ada Swagger/OpenAPI JSON yang digenerate otomatis.
- Belum ada Postman collection resmi.
- `POST /employee-loans` masih punya mismatch antara request validator dan controller.
- `GET /work-calendars/:id/working-days` masih membaca `calendarId` dari query, bukan path param.
- Beberapa endpoint internal admin lain masih tersedia di backend tetapi belum diprioritaskan di dokumen ini karena fokusnya konsumsi mobile app.
