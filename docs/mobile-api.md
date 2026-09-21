# HRIS — Mobile API Reference (Final)

> Dokumen ini adalah acuan **resmi & terkini** untuk integrasi mobile app.
> Menggantikan `mobile-api-documentation.md` (versi lama, base URL `localhost:3000`
> dan konvensi `employeeId` via query yang sudah tidak berlaku).
> Panduan auth ringkas juga ada di `api-mobile-integration.md`.
>
> Baseline: branch `feat/mobile-api-gap`, per 21 September 2026.

---

## 1. Base URL & Prefix

```
Prefix API   : /api/v1
Production    : http://srv540825.hstgr.cloud:8084/api/v1   (masih HTTP — lihat Catatan Keamanan)
Local dev     : http://localhost:3000/api/v1
```

Semua path di dokumen ini sudah termasuk prefix `/api/v1`.

---

## 2. Autentikasi (Mobile = mode Bearer)

API punya dua mode. **Mobile wajib pakai Bearer**, ditandai header `X-Client-Type: mobile` saat login/refresh.

| | Web (browser) | Mobile (native) |
|---|---|---|
| Penanda | (default) | `X-Client-Type: mobile` saat login/refresh |
| Token disimpan | httpOnly cookie (`at`/`rt`) | Response body → **secure storage** (Keychain/Keystore) |
| Kirim auth | Cookie otomatis | `Authorization: Bearer <accessToken>` |
| CSRF | Wajib (double-submit) | **Tidak perlu** (request tanpa cookie auth dibebaskan dari CSRF) |

### 2.1 Login
```
POST /api/v1/auth/login
X-Client-Type: mobile
Content-Type: application/json

{ "email": "user@company.com", "password": "..." }
```
Respons `200`:
```json
{
  "success": true,
  "data": {
    "user": { "id": "...", "email": "...", "employeeId": "...", "companyId": "...", "roles": ["..."], "permissions": ["..."] },
    "tokens": { "accessToken": "<JWT, 15 menit>", "refreshToken": "<opaque, 7 hari>", "expiresIn": 900 }
  }
}
```
- `422` validasi, `401` kredensial salah, `401 MFA_REQUIRED` → kirim ulang dengan field `totp`, `429` rate limit / akun terkunci 15 menit.
- Simpan **kedua** token di secure storage. Jangan di storage polos.

### 2.2 Refresh (saat access token expired / dapat 401)
```
POST /api/v1/auth/refresh
X-Client-Type: mobile

{ "refreshToken": "<refreshToken>" }
```
Respons sama seperti login. **Refresh token dirotasi tiap kali** — selalu ganti simpanan. Memakai ulang refresh token lama akan me-revoke seluruh sesi (deteksi replay).

### 2.3 Logout
```
POST /api/v1/auth/logout
{ "refreshToken": "<refreshToken>" }
```
Tidak butuh access token hidup. Seluruh keluarga refresh token sesi itu di-revoke.

### 2.4 Endpoint auth lain
| Method | Path | Auth | Fungsi |
|---|---|---|---|
| GET | `/auth/me` | Bearer | Profil user + roles/permissions saat ini |
| POST | `/auth/change-password` | Bearer | Ganti password (`currentPassword`, `newPassword`) |
| POST | `/auth/forgot-password` | — | Minta email reset (`email`); selalu `202` agar akun tidak dapat dienumerasi |
| POST | `/auth/reset-password` | — | Pakai grant sekali pakai (`token`, `password`) dalam 15 menit |
| POST | `/auth/mfa/setup` | Bearer | Mulai setup TOTP (balas QR/secret) |
| POST | `/auth/mfa/enable` | Bearer | Aktifkan MFA (`code`) |
| POST | `/auth/mfa/disable` | Bearer | Nonaktifkan MFA (`code`) |
| GET | `/auth/sessions` | Bearer | Daftar sesi aktif |
| DELETE | `/auth/sessions/:id` | Bearer | Revoke satu sesi |
| GET | `/auth/csrf` | — | (Web only) ambil CSRF token; mobile tidak perlu |

---

## 3. Konvensi

**Headers wajib (setelah login):**
```
Authorization: Bearer <accessToken>
Content-Type: application/json
```

Untuk mutasi yang aman di-retry (check-in, check-out, pengajuan cuti/izin,
koreksi, lembur, loan, EWA, aktivitas harian, trip/expense, dan registrasi
device), kirim header opsional:

```text
Idempotency-Key: <16-128 karakter ASCII unik>
```

Key disimpan 24 jam dan di-scope ke company, user, method, dan path. Request
ulang dengan key dan payload yang sama mengembalikan response pertama serta
header `Idempotency-Replayed: true`; payload berbeda atau request yang masih
diproses menghasilkan `409`. Hanya response sukses `2xx` yang disimpan;
response validasi/permission/conflict/server-error melepas reservation sehingga
request yang sudah diperbaiki dapat memakai key yang sama. Urutan key object JSON
tidak mengubah fingerprint request.

**Envelope sukses:**
```json
{ "success": true, "message": "…", "data": …, "meta": { "page": 1, "limit": 20, "total": 100, "totalPages": 5 } }
```
`meta` hanya muncul di endpoint list paginated.

**Envelope error:**
```json
{ "success": false, "code": "VALIDATION_ERROR", "message": "…", "errors": [ … ] }
```

**Kode status:**

| Status | Arti |
|---|---|
| 401 | Belum auth / token invalid / expired → lakukan refresh |
| 403 | Tidak punya izin / di luar company scope |
| 404 | Tidak ditemukan atau di luar tenant kamu |
| 409 | Konflik / data sudah berubah (stale) / duplikat |
| 422 | Validasi payload gagal |
| 429 | Rate limit (login, face-match, dll) |

**Company & employee context (PENTING):**
- Sejak hardening, server **menurunkan `companyId`/`employeeId` dari token/sesi**, bukan dari body/query client. Endpoint self-service (`/me`, `/my`) otomatis pakai identitas pemanggil.
- Beberapa endpoint admin masih menerima `?companyId=` untuk memilih tenant (khusus multi-company/super admin). Sebagai employee biasa, cukup andalkan token.

**Masking data sensitif:** NIK, NPWP, rekening, BPJS di-mask **last-4** kecuali user punya role HR/admin atau permission `employee:read-sensitive`.

---

## 4. Endpoint per Domain (fokus mobile)

Legenda auth: **self** = cukup login (dipaksa ke identitas sendiri) · **perm** = butuh permission tertentu (biasanya role HR/manager) · **approver** = untuk yang meng-approve.

### 4.1 Absensi / Kehadiran — `/api/v1/attendance`

Endpoint **self-service** untuk karyawan absen sendiri (tidak butuh permission admin — `employeeId` dipaksa dari token):

| Method | Path | Auth | Fungsi |
|---|---|---|---|
| GET | `/attendance/me/today` | self | Status absen hari ini + policy (metode diizinkan, wajib GPS/selfie, sudah check-in/out?) |
| GET | `/attendance/me?month=YYYY-MM` | self | Riwayat absensi sendiri (default bulan berjalan) |
| POST | `/attendance/me/check-in` | self | Clock-in (lihat **§5 payload capture**) |
| PATCH | `/attendance/me/check-out` | self | Clock-out hari ini (server isi waktu kalau tidak dikirim) |

`/attendance/me/today` mengembalikan `serverTime`, `serverDate`, `timezone`,
`record`, `context`, `canCheckIn`, dan `canCheckOut`. Riwayat menerima `page`
dan `limit` (maksimum 100), serta mengembalikan envelope paginated standar.

Endpoint admin/HR (butuh `attendance:read/create/update`):

| Method | Path | Fungsi |
|---|---|---|
| GET | `/attendance?companyId=&employeeId=&month=` | List absensi (perm) |
| GET | `/attendance/context?employeeId=&date=` | Resolusi shift/policy untuk tanggal (perm) |
| GET | `/attendance/summary?companyId=&month=&year=` | Ringkasan (perm) |
| POST | `/attendance` | Buat absensi manual untuk karyawan (perm) |
| PATCH | `/attendance/:id/checkout` | Checkout by id (perm) |

**Lembur** (di bawah `/attendance/overtime`):

| Method | Path | Auth | Fungsi |
|---|---|---|---|
| GET | `/attendance/overtime?employeeId=` | perm/self | List lembur |
| POST | `/attendance/overtime` | self | Ajukan lembur |
| GET | `/attendance/overtime/:id/pay` | perm | Hitung bayaran lembur |
| PATCH | `/attendance/overtime/:id/approve` \| `/reject` | approver | Approve/tolak |
| PATCH | `/attendance/overtime/:id/workflow-action` | approver | Aksi via workflow engine |

### 4.2 Koreksi Absensi — `/api/v1/attendance-corrections`

| Method | Path | Auth | Fungsi |
|---|---|---|---|
| POST | `/attendance-corrections` | self/perm | Ajukan koreksi (`date`, `requestedCheckIn?`, `requestedCheckOut?`, `reason`) |
| GET | `/attendance-corrections/my?status=` | self | Riwayat koreksi milik sendiri |
| GET | `/attendance-corrections/my/:id` | self | Detail koreksi milik sendiri |
| GET | `/attendance-corrections` | perm | List koreksi |
| GET | `/attendance-corrections/:id` | perm | Detail |
| PUT | `/attendance-corrections/:id/approve` \| `/reject` | approver | Approve/tolak |
| PATCH | `/attendance-corrections/:id/workflow-action` | approver | Aksi via workflow engine |

### 4.3 Cuti — `/api/v1/leave`

| Method | Path | Auth | Fungsi |
|---|---|---|---|
| GET | `/leave/types` | read | Daftar tipe cuti |
| POST | `/leave` | create | Ajukan cuti (`leaveTypeId`, `startDate`, `endDate`, `reason`, `attachment?`) |
| GET | `/leave` | read | List pengajuan cuti |
| GET | `/leave/:id` | read | Detail |
| PATCH | `/leave/:id/cancel` | self | Batalkan pengajuan (saldo dikembalikan) |
| GET | `/leave/balances/employee?employeeId=` | read | Saldo cuti |
| PATCH | `/leave/:id/approve` \| `/reject` | approver | Approve/tolak |
| GET | `/leave/:id/workflow` · PATCH `…/workflow-action` | approver | Workflow engine |

> Catatan: sebagian endpoint cuti masih pakai permission `leave:read/create`. Untuk employee self-service, pastikan role employee punya izin baca cuti miliknya; kalau di lapangan ketemu 403 buat "cuti saya", itu kandidat perbaikan (pola sama seperti `/me` di modul lain).

### 4.4 Izin — `/api/v1/permission-requests`

| Method | Path | Auth | Fungsi |
|---|---|---|---|
| GET | `/permission-requests/my` | self | Izin milik sendiri |
| POST | `/permission-requests` | self | Ajukan izin (`type`, `startDate`, `endDate`, `reason`) |
| PATCH | `/permission-requests/:id/cancel` | self | Batalkan |
| GET | `/permission-requests` · `/:id` | perm | List/detail (approver) |
| PATCH | `/permission-requests/:id/approve` \| `/reject` \| `/workflow-action` | approver | Proses |

### 4.5 Kalender Kerja / Shift — `/api/v1/work-calendars`

| Method | Path | Auth | Fungsi |
|---|---|---|---|
| GET | `/work-calendars/me/resolved?year=YYYY&month=M` | self | Kalender kerja + shift + absence milik sendiri (untuk tampilan jadwal) |
| GET | `/work-calendars/me/next-shift?from=YYYY-MM-DD` | self | Shift kerja berikutnya pada/selepas tanggal `from`, menyeberang bulan dan melewati cuti/izin penuh |
| GET | `/work-calendars/holidays/list` | read | Daftar hari libur |

`from` bersifat inklusif dan default-nya adalah tanggal server pada timezone
company. Pencarian dibatasi 92 hari. Response membawa `timezone`, `serverDate`,
`fromDate`, `throughDate`, `employee`, dan `shift`; `shift=null` berarti tidak ada
jadwal kerja dalam horizon tersebut.

**Tukar shift (shift swap) — self-service:**

| Method | Path | Auth | Fungsi |
|---|---|---|---|
| GET | `/work-calendars/shift-swaps/candidates/my` | self | Kandidat rekan yang bisa ditukar shift |
| GET | `/work-calendars/shift-swaps/my` | self | Pengajuan tukar shift saya |
| GET | `/work-calendars/shift-swaps/approvals/my` | self | Tukar shift yang menunggu persetujuan saya |
| POST | `/work-calendars/shift-swaps` | self | Ajukan tukar (`targetEmployeeId`, `shiftDate`, `reason`) |
| PATCH | `/work-calendars/shift-swaps/:id/cancel` \| `/approve` \| `/reject` | self | Batal / setujui / tolak |

### 4.6 Pinjaman — `/api/v1/employee-loans`

| Method | Path | Auth | Fungsi |
|---|---|---|---|
| GET | `/employee-loans/types` | self | Tipe pinjaman |
| GET | `/employee-loans/my` | self | Pinjaman milik sendiri |
| POST | `/employee-loans` | self | Ajukan pinjaman (`loanTypeId`, `amount`, `tenorMonths`, …) |
| GET | `/employee-loans/:id/installments` · `/amortization` | read | Jadwal cicilan / amortisasi |
| PATCH | `/employee-loans/:id/cancel` | self | Batalkan (PENDING) |
| PATCH | `/employee-loans/:id/approve` \| `/reject` \| `/workflow-action` | approver | Proses |

### 4.7 Tarik Gaji Awal (EWA) — `/api/v1/ewa`

| Method | Path | Auth | Fungsi |
|---|---|---|---|
| GET | `/ewa/my?status=` | self | Riwayat pengajuan EWA sendiri |
| GET | `/ewa/my/limit?percent=` | self | Limit yang boleh ditarik (dihitung server dari attendance+salary; **jangan** kirim `earnedGross`) |
| POST | `/ewa` | `ewa:create` | Ajukan penarikan (`amountRequested`, `adminFee?`, `reason?`) |
| GET | `/ewa/:id` | `ewa:read` | Detail |
| POST | `/ewa/:id/cancel` | `ewa:update` | Batalkan |
| POST | `/ewa/:id/approve` \| `/reject` | `ewa:approve` | Approve / tolak (`rejectReason` wajib saat reject) |
| POST | `/ewa/:id/mark-paid` | `ewa:disburse` | Tandai sudah dicairkan (`amountPaidOut`, `disbursementReference`) |

> Catatan: `POST /ewa` (ajukan) butuh permission `ewa:create`. Kalau role employee belum punya izin itu dan dapat 403 saat mengajukan, itu kandidat perbaikan (samakan dengan pola self-service `/my`).

### 4.8 Aktivitas Harian — `/api/v1/daily-activities`

| Method | Path | Auth | Fungsi |
|---|---|---|---|
| GET | `/daily-activities/my?startDate=&endDate=` | self | Aktivitas milik sendiri |
| POST | `/daily-activities` | self | Catat aktivitas (`title`, `activityType`, `startTime`, `endTime`, GPS opsional) — divalidasi geo-radius & overlap jam |
| GET | `/daily-activities/:id` · PUT `/:id` · DELETE `/:id` | self/perm | Detail/ubah/hapus |

### 4.9 Perjalanan & Klaim — `/api/v1/travel-expenses`

| Method | Path | Auth | Fungsi |
|---|---|---|---|
| GET | `/travel-expenses/trips/my` | self | Perjalanan dinas milik sendiri |
| POST | `/travel-expenses/trips` | self | Ajukan perjalanan dinas |
| GET | `/travel-expenses/claims/my` | self | Klaim/reimbursement milik sendiri |
| POST | `/travel-expenses/claims` | self | Ajukan klaim (dengan lampiran) |
| POST | `/travel-expenses/claims/receipt-upload` | self | Upload receipt dengan validasi tipe dan magic bytes |
| GET | `/travel-expenses/categories` | self | Kategori klaim |
| GET | `/travel-expenses/trips/:id` | approver | Detail perjalanan |
| PATCH | `/travel-expenses/trips/:id/approve` | approver | Setujui perjalanan |
| PATCH | `/travel-expenses/trips/:id/reject` | approver | Tolak perjalanan |
| GET | `/travel-expenses/trips/:id/workflow` | approver | Timeline workflow perjalanan |
| PATCH | `/travel-expenses/trips/:id/workflow-action` | approver | Aksi workflow perjalanan |
| POST | `/travel-expenses/trips/:id/advance` | approver | Buat uang muka perjalanan |
| GET | `/travel-expenses/claims/:id` | approver | Detail klaim |
| PATCH | `/travel-expenses/claims/:id/approve` | approver | Setujui klaim |
| PATCH | `/travel-expenses/claims/:id/reject` | approver | Tolak klaim |
| GET | `/travel-expenses/claims/:id/workflow` | approver | Timeline workflow klaim |
| PATCH | `/travel-expenses/claims/:id/workflow-action` | approver | Aksi workflow klaim |
| POST | `/travel-expenses/claims/:id/reimburse` | approver | Catat pembayaran reimbursement |

### 4.10 Notifikasi — `/api/v1/notifications`

| Method | Path | Auth | Fungsi |
|---|---|---|---|
| GET | `/notifications?page=1&limit=50&unreadOnly=false` | self | List notifikasi paginated |
| GET | `/notifications/unread-count` | self | Jumlah belum dibaca (badge) |
| PUT | `/notifications/read` | self | Tandai dibaca (`ids: [...]`) |
| PUT | `/notifications/read-all` | self | Tandai semua dibaca |
| DELETE | `/notifications/:id` | self | Hapus |
| POST | `/notifications/device-tokens` | self | Register/rotate token FCM/APNs untuk instalasi |
| DELETE | `/notifications/device-tokens` | self | Unregister instalasi saat logout |

Payload register device:

```json
{
  "installationId": "uuid-stabil-per-install",
  "platform": "ANDROID",
  "provider": "FCM",
  "token": "provider-device-token",
  "appVersion": "1.4.0",
  "deviceModel": "Pixel 9"
}
```

Untuk unregister kirim `{ "installationId": "..." }`. Token provider tidak
pernah dikembalikan lagi oleh API setelah registrasi.

Notifikasi inbox baru difan-out oleh worker ke seluruh instalasi aktif. Payload
push selalu menyertakan string `notificationId` dan, bila tersedia, `resource`,
`action`, serta `referenceId`. Delivery provider memakai retry eksponensial
(maksimum 5 percobaan). Respons `UNREGISTERED`/`BadDeviceToken`/`Unregistered`
menonaktifkan token agar tidak dicoba terus. FCM memakai HTTP v1; APNs memakai
token authentication. Credential provider wajib disuplai lewat environment
worker dan tidak pernah disimpan di database.

### 4.11 Approval (untuk Manager/Approver) — `/api/v1/workflow-engine`

| Method | Path | Auth | Fungsi |
|---|---|---|---|
| GET | `/workflow-engine/instances/my-approvals?page=1&limit=20` | approver | Antrean approval paginated (termasuk delegasi) |
| POST | `/workflow-engine/instances/:id/actions` | approver | Approve/Reject/Escalate (`{ action, comment? }`) |
| POST | `/workflow-engine/instances/bulk-approve` | approver | Approve massal |
| GET/POST | `/workflow-engine/delegations` | self | Lihat/buat delegasi approval (out-of-office) |
| PATCH | `/workflow-engine/delegations/:id/revoke` | self | Cabut delegasi |

### 4.12 Payslip / Payroll (self) — `/api/v1/payroll`

| Method | Path | Auth | Fungsi |
|---|---|---|---|
| GET | `/payroll/payslips` | `payroll:read` | Periode payslip milik sendiri tanpa nominal (hanya run `APPROVED`/`DISBURSED`) |
| POST | `/payroll/payslips/unlock` | `payroll:read` | Reautentikasi password dan `totp` bila MFA aktif; menghasilkan grant 5 menit |
| POST | `/payroll/payslips/lock` | `payroll:read` | Revoke seluruh grant payroll aktif |
| GET | `/payroll/payslips/:id` | `payroll:read` | Detail nominal; wajib header grant untuk self-service |
| GET | `/payroll/payslips/:id/pdf` | `payroll:read` | PDF privat on-demand; wajib header grant untuk self-service |

Role `EMPLOYEE` mendapat permission `payroll:read`, tetapi data tetap di-scope
ke employee dari sesi. Untuk unlock:

```http
POST /api/v1/payroll/payslips/unlock
Content-Type: application/json

{ "password": "password-akun", "totp": "123456" }
```

Gunakan nilai `data.unlockToken` hanya di memory dan kirim pada detail/PDF:

```http
X-Payroll-Unlock-Token: <grant>
```

Grant terikat ke user, employee, serta company aktif; kedaluwarsa setelah 5
menit dan grant lama otomatis dicabut saat unlock baru. Lima kegagalan dalam
15 menit mengunci proses unlock selama 15 menit. PDF tidak memakai URL publik,
redirect, atau file sementara dan dibatasi maksimum 5 MB.

### 4.13 Profil & Employee — `/api/v1/employees`

| Method | Path | Auth | Fungsi |
|---|---|---|---|
| GET | `/auth/me` | self | Cara termudah ambil profil ringkas (id, roles, permissions, employeeId, companyId) |
| GET | `/employees/me/reporting-line` | self | Posisi atasan, supervisor utama, dan supervisor alternatif berdasarkan `Position.reportsToId` |
| GET | `/employees/:id` | perm | Detail karyawan (data sensitif ter-mask sesuai izin) |
| GET | `/employees/:id/attachments` | perm/self-scope | Metadata lampiran employee |

### 4.14 Dokumen Employee — `/api/v1/documents`

| Method | Path | Auth | Fungsi |
|---|---|---|---|
| GET | `/documents?employeeId=` | `document:read` | Daftar metadata dokumen sesuai data scope |
| GET | `/documents/:id` | `document:read` | Detail metadata tanpa membuka path storage |
| GET | `/documents/:id/signed-url` | `document:read` | URL bertanda tangan yang tetap memerlukan sesi aktif |
| GET | `/documents/:id/download` | `document:read` | Streaming file privat dan access log |

### 4.15 Kalender Tim — `/api/v1/work-calendars`

| Method | Path | Auth | Fungsi |
|---|---|---|---|
| GET | `/work-calendars/team/:managerId?year=&month=` | `work-calendar:read` | Status kalender tim yang dibatasi data scope manager |
| GET | `/work-calendars/employee/:employeeId?year=&month=` | `work-calendar:read` | Kalender employee yang berada dalam data scope pemanggil |

### 4.16 Announcement — `/api/v1/announcements`

| Method | Path | Auth | Fungsi |
|---|---|---|---|
| GET | `/announcements?page=1&limit=20&unreadOnly=false` | self | Announcement visible untuk company/audience pemanggil |
| GET | `/announcements/unread-count` | self | Jumlah announcement visible yang belum dibaca |
| GET | `/announcements/:id` | self | Detail announcement; ID di luar audience menghasilkan 404 |
| PUT | `/announcements/:id/read` | self | Tandai dibaca secara idempotent |

Audience resmi: `ALL`, `COMPANY_WIDE`, `DEPARTMENT_ONLY`, `BRANCH_ONLY`,
`POSITION_ONLY`, dan `EMPLOYEE_SPECIFIC`. Hanya status `PUBLISHED` dalam jendela
`publishFrom`/`publishUntil` yang muncul. Pin aktif berada di atas; pin kedaluwarsa
kembali ke urutan normal. List mengembalikan `contentPreview`, author minimal,
`isRead`, dan `readAt`; detail menambahkan `content`, `allowComment`, dan
`totalViews`. Announcement platform `companyId=null` dapat dibaca semua tenant,
tetapi announcement tenant lain tetap tidak terlihat.

---

## 5. Payload Capture Absensi (GPS / Face / Liveness)

Dipakai di `POST /attendance/me/check-in` (dan `PATCH /me/check-out` untuk field lokasi/method). Field yang dikirim tergantung **metode yang diizinkan branch** (didapat dari `/attendance/me/today`).

```jsonc
POST /api/v1/attendance/me/check-in
{
  "method": "FACE_RECOGNITION",        // MANUAL | MOBILE_GPS | FINGERPRINT | FACE_RECOGNITION
  "notes": "…",                          // opsional

  // Wajib jika policy requiresLocation / method MOBILE_GPS:
  "checkInLatitude": -6.200000,
  "checkInLongitude": 106.816666,

  // Wajib jika method FACE_RECOGNITION:
  "faceRecognition": {
    "selfieImage": "data:image/jpeg;base64,…"   // HANYA foto mentah. Maks ~5MB.
  },

  // Opsional — metadata anti-spoof (server yang memutuskan, bukan client):
  "liveness":  { "isLiveCapture": true, "clientSource": "camera" },
  "deviceGps": { "isMockLocation": false, "accuracyMeters": 8 }
}
```

**Aturan keras (server-authoritative):**
- `companyId`, `employeeId`, tanggal absensi, waktu check-in, dan waktu
  check-out diambil dari sesi/waktu server; nilai identitas/waktu dari client
  tidak diterima pada endpoint `/me`.
- Client **hanya boleh** kirim `selfieImage` (foto mentah). Kirim vektor wajah, URL, `similarityScore`, atau `isFaceMatch` → **ditolak 400**. Semua keputusan biometrik dihitung di server.
- Face: server ekstrak embedding 256-dim (`@vladmandic/human`), dekripsi profil (AES-256-GCM, terikat company+employee), cosine similarity **threshold 0.6**. Gagal → `400` + tercatat di audit.
- **Rate limit face:** 5x gagal / 15 menit per karyawan → `429` (HR dinotifikasi). Tampilkan sisa waktu retry ke user.
- Liveness menolak foto galeri/manipulasi/blur; GPS palsu (mock location) → `400`.
- Di luar radius: sesuai policy branch → bisa ditandai `requiresReview` (tetap tercatat) atau ditolak.

---

## 6. Penemuan Endpoint (discovery)

Daftar **lengkap** semua route (method + path) tersedia runtime:
```
GET /api/v1/meta/endpoints
Authorization: Bearer <accessToken admin>   (butuh permission rbac:read)
```
Pakai ini sebagai sumber kebenaran mutlak kalau ada perbedaan versi.

---

## 7. Catatan Keamanan

- **Production masih HTTP polos.** Sampai HTTPS terpasang, token bisa disadap. Pasang HTTPS + certificate pinning sebelum rilis mobile publik.
- Access token 15 menit → implementasi auto-refresh saat `401` (retry sekali, antrekan request paralel selama refresh).
- Rate limit login: 10 gagal / 15 menit per IP & per email; 5 gagal → akun terkunci 15 menit.
- Forgot-password dibatasi 5 request/IP/15 menit dan satu email/user/menit.
  Token reset 256-bit hanya disimpan sebagai SHA-256, sekali pakai, dan seluruh
  refresh session user dicabut setelah reset. Access token membawa session
  version yang diperiksa pada setiap protected request, sehingga token sebelum
  perubahan password langsung ditolak. SMTP harus diaktifkan eksplisit.
- Simpan token di Keychain (iOS) / Keystore/EncryptedSharedPreferences (Android), bukan storage polos.

---

## 8. Alur Umum Mobile (ringkas)

1. `POST /auth/login` (header `X-Client-Type: mobile`) → simpan `accessToken` + `refreshToken`.
2. Semua request berikut: `Authorization: Bearer <accessToken>`.
3. `GET /auth/me` → tahu roles/permissions untuk atur menu.
4. Dashboard karyawan: `GET /attendance/me/today`, `GET /work-calendars/me/next-shift`, `GET /notifications/unread-count`, `GET /announcements`, `GET /announcements/unread-count`, `GET /leave/balances/employee`, `GET /ewa/my/limit`.
5. Absen: `GET /attendance/me/today` → tampilkan metode yang diizinkan → `POST /attendance/me/check-in` → nanti `PATCH /attendance/me/check-out`.
6. Saat dapat `401`: `POST /auth/refresh` → ganti token → ulangi request. Gagal refresh → paksa login ulang.
</content>
