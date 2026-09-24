# Audit Gap Endpoint API HRIS Mobile

Tanggal audit: 16 September 2026
Ditujukan kepada: Backend Developer HRIS
Repository client: `hris-mobile-app`
Kontrak utama: `mobile-api.md`, baseline backend branch `main` per 12 September 2026

## Update Tahap 1 — 19 September 2026

Live smoke terhadap 24 pasangan method/path sudah dijalankan dengan akun uji
employee dan manager. Hasil unik: 13 respons sukses, 7 mutation menolak payload
invalid sesuai kontrak, 2 endpoint aktif tetapi belum mendapat positive fixture,
dan 2 endpoint gagal karena akun employee belum mempunyai kalender kerja aktif
atau formula shift. Login, `/auth/me`, refresh-token rotation, logout, dan profil
berhasil; native login dengan `X-Client-Type: mobile` tidak mengalami error
`Access token is missing`. Seluruh sesi sudah di-logout, password tidak diubah,
dan artefak tidak menyimpan credential/token.

Remediasi backend pada branch ini menambahkan:

- provisioner fixture staging tertarget dan idempotent untuk kalender, leave
  request, notifikasi, GPS policy opt-in, serta face enrollment opt-in;
- smoke runner 24 operasi dengan positive fixture selection, safe negative
  mutations, refresh rotation, cleanup logout, dan output JSON tersanitasi;
- test integrasi mock yang membuktikan tepat 24 request dan tidak ada secret di
  artefak;
- Compose override dan konfigurasi Nginx HTTPS tanpa menyimpan certificate/key.

Validasi lokal terisolasi setelah remediasi menghasilkan:

- seluruh 61 migration dan synthetic seed berhasil pada database baru;
- fixture calendar, leave, dan notification tetap satu record setelah apply
  kedua (idempotent), sedangkan perubahan GPS branch bersama ditolak tanpa
  acknowledgement eksplisit;
- smoke final lulus untuk 24/24 operasi inti, lima operasi manager tambahan,
  dan assertion rotasi token (`30 passed`, `0 failed`, `0 blocked`), dengan
  artefak mode `0600` dan tanpa credential/token;
- policy Bandung `requiresSelfie=true` kini menolak check-in `MOBILE_GPS` tanpa
  selfie (HTTP 400) dan tidak membuat row attendance; enforcement server-side
  telah diperbaiki agar face match serta liveness tidak dapat dilewati dengan
  memilih metode GPS;
- build TypeScript/API berhasil dan konfigurasi HTTPS lulus `nginx -t` memakai
  certificate sementara.

Pemeriksaan publik read-only pada 19 September 2026 masih menemukan HTTP health
port 8084 merespons 200, sementara TLS pada port 8083/8084 gagal saat handshake
dan port 443 timeout. Karena itu status tetap `PASS lokal`, `REVIEW live
deployment`, dan `PENDING real device` sampai perubahan ini dideploy, fixture
diterapkan ke akun sintetis, sertifikat/DNS/port 443 disiapkan, smoke live bersih,
dan tabel acceptance perangkat di `docs/mobile-staging-acceptance.md` selesai.

Bagian "batas audit" di bawah menjelaskan kondisi audit awal 16 September dan
dipertahankan sebagai riwayat, bukan status live terbaru.

## 1. Tujuan report

Report ini membandingkan kontrak API mobile terbaru dengan implementasi Flutter yang sedang berjalan. Tujuannya adalah menentukan:

1. endpoint yang sudah dipakai mobile;
2. endpoint yang sudah tertulis di kontrak tetapi belum diintegrasikan;
3. capability yang belum mempunyai kontrak backend memadai;
4. endpoint yang sudah diintegrasikan tetapi belum dapat dinyatakan bekerja pada deployment;
5. keputusan dan fixture yang dibutuhkan dari tim backend.

Istilah pada report ini:

- **Terintegrasi lokal**: request, mapping, state, dan contract test tersedia di client. Ini bukan bukti endpoint deployment berhasil.
- **Terdokumentasi, belum terintegrasi**: method/path ada di `mobile-api.md`, tetapi belum mempunyai alur mobile.
- **Belum ada dalam kontrak**: capability tidak tercantum secara memadai di `mobile-api.md`. Ini tidak otomatis berarti source backend tidak mempunyai route.
- **Live review**: implementasi lokal tersedia, tetapi belum diuji memakai deployment, akun uji, dan data tersanitasi.

Seluruh path pada tabel ditulis relatif terhadap base URL `/api/v1`. Contoh `/auth/login` berarti request final `/api/v1/auth/login`.

## 2. Sumber dan batas audit

Sumber yang digunakan:

- `mobile-api.md` yang dikirim backend developer;
- [API_INTEGRATION_REVISION.md](API_INTEGRATION_REVISION.md);
- seluruh datasource/repository produksi di `lib/features/`;
- konfigurasi network, refresh token, request context, dan route aplikasi;
- contract test lokal untuk auth, attendance, calendar, request, notification, profile, dan dashboard.

Batas audit:

- tidak tersedia akun employee/manager khusus uji;
- tidak dilakukan request ke server production atau staging;
- runtime discovery `GET /api/v1/meta/endpoints` tidak dapat dipanggil tanpa token admin dengan permission `rbac:read`;
- source backend lokal lama tidak digunakan untuk mengganti kontrak final;
- referensi endpoint pada checklist lama dianggap kandidat sampai dikonfirmasi kembali oleh backend.

## 3. Ringkasan eksekutif

Client saat ini menggunakan 24 pasangan method/path untuk auth, absensi
self-service, cuti, izin, kalender, notifikasi, dan profil. Seluruhnya memiliki
test lokal dan sudah menjalani smoke live. Dua operasi calendar-dependent masih
gagal karena fixture akun deployment, sehingga acceptance deployment belum final.

Gap paling penting:

1. HTTPS production belum tersedia dalam kontrak deployment.
2. Source Flutter/mobile tidak ada di repository backend ini, sehingga Approval
   Center, koreksi, lembur, payroll, push, loan, EWA, activity, dan travel yang
   sudah mempunyai kontrak backend masih perlu diintegrasikan di repository client.
3. Chat masih memerlukan keputusan produk/API; announcement dashboard, next
   shift, dan reporting line sudah mempunyai kontrak self-service.
4. SMTP, Firebase/APNs, akun staging, serta certificate/DNS belum tersedia di
   workspace dan secret manager deployment.
5. Mayoritas endpoint lanjutan masih memerlukan contoh response `data` dan
   fixture staging yang stabil untuk client.
6. Enforcement geofence, fake GPS, liveness, tenant scope, push provider, dan
   timezone boundary belum dibuktikan pada deployment/perangkat nyata.

## 4. Endpoint yang sudah digunakan mobile

Status seluruh item pada bagian ini adalah **terintegrasi lokal, perlu live review**.

### 4.1 Authentication dan session

| Method | Path | Pemakaian client | Catatan live review |
|---|---|---|---|
| POST | `/auth/login` | Login password dan challenge TOTP | Wajib mengembalikan user serta pasangan access/refresh token untuk client mobile |
| POST | `/auth/refresh` | Refresh satu kali dan retry protected request | Refresh token wajib berotasi dan pasangan token baru tidak boleh kosong |
| POST | `/auth/logout` | Revoke refresh-token family setelah local cleanup | Harus tetap menerima refresh token saat access token sudah mati |
| GET | `/auth/me` | Restore identity, role, permission, employee, company | Response harus mengganti snapshot sesi, termasuk ketika affiliation dicabut |
| POST | `/auth/change-password` | Mandatory password change | Client mengikuti body `currentPassword` dan `newPassword` |

### 4.2 Attendance self-service

| Method | Path | Pemakaian client | Catatan live review |
|---|---|---|---|
| GET | `/attendance/me/today` | Record hari ini dan policy/context | Bentuk `context`, allowed methods, lokasi, selfie, dan status belum mempunyai fixture final |
| GET | `/attendance/me?month=YYYY-MM&page=1&limit=20` | Riwayat bulanan | `page` dan `limit` sudah menjadi kontrak resmi dan response memakai meta pagination standar |
| POST | `/attendance/me/check-in` | GPS atau face check-in | Client mengirim raw selfie data URI, liveness, GPS metadata, dan `Idempotency-Key` |
| PATCH | `/attendance/me/check-out` | GPS check-out | Client tidak mengirim employee/company atau waktu device |

### 4.3 Leave dan permission request

| Method | Path | Pemakaian client | Catatan live review |
|---|---|---|---|
| GET | `/leave/types` | Pilihan jenis cuti | Perlu schema attachment requirement dan batas hari |
| GET | `/leave/balances/employee` | Saldo per tipe di Beranda | Client mengirim `employeeId` sesuai path kontrak saat ini |
| GET | `/leave` | Daftar cuti | Permission self-read perlu dipastikan untuk role employee |
| GET | `/leave/:id` | Detail cuti | Server harus menolak ID milik employee/company lain |
| POST | `/leave` | Pengajuan cuti | Attachment saat ini berupa field sesuai kontrak mobile, format final perlu dipastikan |
| PATCH | `/leave/:id/cancel` | Pembatalan cuti | Client hanya mengubah state sesudah response sukses |
| GET | `/permission-requests/my` | Daftar izin sendiri | Scope wajib berasal dari sesi |
| POST | `/permission-requests` | Pengajuan izin | Tipe izin dan date range perlu enum/schema final |
| PATCH | `/permission-requests/:id/cancel` | Pembatalan izin | Server harus menegakkan ownership dan status yang boleh dibatalkan |

### 4.4 Calendar, notification, dan profile

| Method | Path | Pemakaian client | Catatan live review |
|---|---|---|---|
| GET | `/work-calendars/me/resolved` | Kalender kerja bulanan | Client memerlukan `employee`, `period`, dan daftar `days` lengkap satu bulan |
| GET | `/notifications?page=1&limit=50&unreadOnly=false` | Inbox yang difilter | Pagination dan schema item sudah dicatat pada kontrak mobile |
| GET | `/notifications/unread-count` | Badge notifikasi | Client mengharapkan `data.count` integer nonnegatif |
| PUT | `/notifications/read` | Tandai ID tertentu dibaca | Body `{ids:[...]}` |
| PUT | `/notifications/read-all` | Tandai semua dibaca | Scope user/company harus diturunkan server |
| GET | `/employees/:id` | Detail profil employee | Hanya dipanggil jika sesi memiliki `employee:read`; data sensitif tidak diproyeksikan ke UI |

## 5. Endpoint terdokumentasi tetapi belum diintegrasikan

Bagian ini tidak meminta backend membuat ulang endpoint. Tim backend diminta memastikan route aktif, permission benar, dan menyediakan schema/fixture sebelum integrasi client dimulai.

### 5.1 Prioritas P1, dibutuhkan untuk alur manager dan attendance

#### Approval Center

| Method | Path | Kebutuhan mobile |
|---|---|---|
| GET | `/workflow-engine/instances/my-approvals` | Antrean approval, badge, pagination, filter, dan detail ringkas |
| POST | `/workflow-engine/instances/:id/actions` | Approve, reject, escalate, comment, conflict handling |
| POST | `/workflow-engine/instances/bulk-approve` | Hasil per item dan partial failure |
| GET | `/workflow-engine/delegations` | Daftar delegasi milik user |
| POST | `/workflow-engine/delegations` | Membuat delegasi |
| PATCH | `/workflow-engine/delegations/:id/revoke` | Mencabut delegasi |

Kebutuhan kontrak tambahan:

- jenis resource dan reference ID;
- current step dan approver chain;
- actor yang diperbolehkan melakukan action;
- status final/transisi yang valid;
- bentuk error stale action atau action ganda;
- pagination dan urutan antrean;
- hasil per ID untuk bulk approval.

#### Attendance correction

| Method | Path | Kebutuhan mobile |
|---|---|---|
| POST | `/attendance-corrections` | Ajukan tanggal, waktu koreksi, alasan, dan lampiran jika didukung |
| GET | `/attendance-corrections` | Riwayat sendiri atau daftar approver, scope perlu diperjelas |
| GET | `/attendance-corrections/:id` | Detail dan timeline |
| PUT | `/attendance-corrections/:id/approve` | Approval manager |
| PUT | `/attendance-corrections/:id/reject` | Reject dengan alasan |
| PATCH | `/attendance-corrections/:id/workflow-action` | Action melalui workflow engine |

Kontrak final belum menjelaskan endpoint list khusus milik employee. Bila `GET /attendance-corrections` tetap permission-only, mobile memerlukan cara resmi untuk membaca status koreksi yang dibuat sendiri.

#### Overtime

| Method | Path | Kebutuhan mobile |
|---|---|---|
| GET | `/attendance/overtime?employeeId=` | List milik sendiri dan pagination |
| POST | `/attendance/overtime` | Pengajuan lembur |
| GET | `/attendance/overtime/:id/pay` | Estimasi pembayaran dari server |
| PATCH | `/attendance/overtime/:id/approve` | Approval |
| PATCH | `/attendance/overtime/:id/reject` | Reject |
| PATCH | `/attendance/overtime/:id/workflow-action` | Workflow action |

Label auth `perm/self` pada endpoint list perlu dibuat eksplisit. Untuk employee biasa, sebaiknya identity tidak dapat diganti melalui query client.

#### Leave dan permission approval

- `PATCH /leave/:id/approve`
- `PATCH /leave/:id/reject`
- `GET /leave/:id/workflow`
- `PATCH /leave/:id/workflow-action`
- `GET /permission-requests`
- `GET /permission-requests/:id`
- `PATCH /permission-requests/:id/approve`
- `PATCH /permission-requests/:id/reject`
- `PATCH /permission-requests/:id/workflow-action`

Mobile memerlukan aturan apakah action domain dan action workflow boleh dipakai bersamaan, atau hanya salah satu yang menjadi kontrak utama.

### 5.2 Prioritas P2, ESS lanjutan

#### Employee loan

- `GET /employee-loans/types`
- `GET /employee-loans/my`
- `POST /employee-loans`
- `GET /employee-loans/:id/installments`
- `GET /employee-loans/:id/amortization`
- `PATCH /employee-loans/:id/cancel`
- approval/reject/workflow-action loan

#### Earned Wage Access

- `GET /ewa/my`
- `GET /ewa/my/limit`
- `POST /ewa`
- `GET /ewa/:id`
- `POST /ewa/:id/cancel`
- `POST /ewa/:id/approve`
- `POST /ewa/:id/reject`
- `POST /ewa/:id/mark-paid`

Employee role perlu dipastikan memiliki `ewa:create` bila fitur ini ditujukan untuk employee self-service.

#### Daily activity

- `GET /daily-activities/my`
- `POST /daily-activities`
- `GET /daily-activities/:id`
- `PUT /daily-activities/:id`
- `DELETE /daily-activities/:id`

#### Travel dan expense claim

- `GET /travel-expenses/trips/my`
- `POST /travel-expenses/trips`
- `GET /travel-expenses/claims/my`
- `POST /travel-expenses/claims`
- `GET /travel-expenses/categories`
- endpoint detail/approve/reject/settle yang saat ini masih ditulis sebagai pola wildcard dalam dokumen

Tim backend perlu menuliskan method/path exact untuk detail dan seluruh action approver. Client tidak akan membentuk endpoint berdasarkan pola wildcard.

### 5.3 Endpoint tersedia tetapi bukan blocker UI sekarang

- `GET /work-calendars/holidays/list`: resolved calendar sudah menjadi sumber kalender utama, tetapi endpoint ini belum dipakai.
- `DELETE /notifications/:id`: UI saat ini tidak mempunyai kontrol hapus notifikasi.
- `POST /auth/mfa/setup`, `/enable`, `/disable`: login challenge TOTP didukung, pengaturan MFA belum dibuat.
- `GET /auth/sessions` dan `DELETE /auth/sessions/:id`: belum ada layar sesi/perangkat aktif.
- attendance admin list/context/summary/manual create/checkout by ID: belum menjadi scope alur employee saat ini.
- `GET /api/v1/meta/endpoints`: hanya untuk discovery admin dan audit deployment, bukan fitur pengguna.
- `GET /auth/csrf`: web only, tidak boleh ditambahkan pada native Bearer flow.

## 6. Status capability kontrak backend

Bagian ini direkonsiliasi ulang dengan source dan `docs/mobile-api.md` pada 20
September 2026. Beberapa gap audit awal sudah ditutup di backend tetapi tetap
memerlukan integrasi client atau konfigurasi deployment.

### 6.1 Payroll terlindungi

**Selesai di backend.** List locked tidak mengirim nominal/components. Endpoint
unlock memakai reautentikasi password dan TOTP bila MFA aktif, grant terikat
user/employee/company selama lima menit, relock tersedia, lima kegagalan memicu
lockout 15 menit, detail dilindungi, dan PDF privat dibuat on-demand dengan batas
5 MB. Kontrak ada pada `docs/mobile-api.md`; acceptance live dan integrasi client
masih terbuka.

### 6.2 Push notification

**Selesai di backend, menunggu credential/provider.** Register/rotate dan
unregister tersedia pada `POST/DELETE /notifications/device-tokens`. Token
dienkripsi, diikat ke installation/user/company, payload membawa navigasi, worker
FCM/APNs memakai delivery outbox/retry, dan invalid token dinonaktifkan. Tanpa
credential provider, delivery berstatus `BLOCKED_CONFIG`, bukan sukses palsu.

### 6.3 Chat atau pesan

**Keputusan rilis awal: ditunda.** Chat tidak termasuk scope mobile release
pertama. Client menampilkan state tidak tersedia, tidak membuat percakapan
contoh, dan tidak mencoba path hasil tebakan. Ketika capability ini dibuka pada
versi berikutnya, kontraknya wajib mencakup:

- conversation list;
- message history dan pagination;
- unread count;
- send message;
- attachment;
- read receipt;
- realtime transport, reconnect, dan ordering;
- authorization antar-user/company.

Keputusan ini menutup ambiguitas scope rilis pertama, tetapi tidak mengklaim
bahwa backend chat sudah tersedia.

### 6.4 Dokumen employee dan relasi atasan

Dokumen employee sudah mempunyai list/detail/signed-url/download privat dan
tercatat pada kontrak mobile. `MANAGER_TEAM` juga sudah fungsional berdasarkan
kepala division/department/sub-department beserta subtree. Reporting line
self-service tersedia di `/employees/me/reporting-line`, memakai
`Position.reportsToId`, memilih primary holder secara deterministik, dan tetap
mengembalikan holder alternatif bila satu posisi ditempati lebih dari satu orang.

### 6.5 Password recovery

**Selesai di backend pada 20 September 2026.** `POST /auth/forgot-password`
selalu memberi response generik `202`; `POST /auth/reset-password` memakai token
acak 256-bit, digest-only, single-use, expiry 15 menit, rate limit, dan mencabut
seluruh refresh session. Delivery SMTP bersifat opt-in dan grant langsung
dinonaktifkan bila provider tidak aktif/gagal. Session version disertakan pada
JWT dan diperiksa terhadap database di setiap protected request, sehingga access
token yang terbit sebelum perubahan password langsung ditolak.

### 6.6 Dashboard, team, announcement, dan timezone

**Selesai di backend.** Attendance today/history mengembalikan `serverDate` dan
timezone kantor; kalender tim manager tersedia. `/announcements` menegakkan
status, publish window, target audience, pagination, unread count, detail, dan
read-state. `/work-calendars/me/next-shift` mencari jadwal lintas bulan memakai
timezone company dan melewati absence penuh. `/employees/me/reporting-line`
memberikan hierarchy posisi yang stabil. Model announcement saat ini tidak
memiliki category; client tidak boleh mengarang category sendiri.

### 6.7 Offline mutation dan idempotency

**Kontrak retry selesai di backend.** Key 16–128 ASCII dipertahankan 24 jam dan
di-scope ke company/user/method/path. Payload sama mereplay response `2xx` serta
header `Idempotency-Replayed`; payload berbeda/in-progress menghasilkan `409`.
Error tidak disimpan, fingerprint object stabil terhadap urutan key JSON, dan
response Redis baru dikirim setelah record selesai dipersist. Cakupan meliputi
attendance, leave/permission/correction/overtime, device token, loan, EWA, daily
activity, serta trip/expense dan action statusnya. Attendance punch diputuskan
live-only: waktu selalu berasal dari server, retry transport memakai key yang
sama, dan punch yang tidak pernah mencapai server diselesaikan melalui koreksi
absensi. Karena queue attendance offline tidak didukung, perubahan policy atau
session selama antre tidak menjadi state kontrak yang harus direkonsiliasi.

### 6.8 Status endpoint dari dokumen lama

Status berikut sudah dikonfirmasi dari router yang dipasang di `app.ts`:

| Capability lama | Status backend | Keputusan kontrak mobile |
|---|---|---|
| Shift swap | Aktif di `/work-calendars/shift-swaps/*` | Sudah masuk kontrak mobile |
| Asset | Aktif di `/assets`; permission admin masih memakai resource employee | `GET /assets/my` tersedia untuk assignment milik employee, terpaginasikan dan tanpa field finansial |
| Certification | Tidak ada router certification tersendiri | Record training employee ada di `/employees/:id/trainings`; jangan memakai path certification lama |
| Performance | Aktif di `/performance`, termasuk `/results/me` | Tersedia tetapi belum dirilis sebagai fitur mobile |
| Training/LMS | Aktif di `/training`, termasuk self-enroll/complete | Tersedia tetapi permission dan UX mobile belum diputuskan |
| Organization/directory | Aktif di `/organization` dan `/employees` | Mayoritas admin; reporting line self-service sudah dipisahkan |
| Onboarding/offboarding | Aktif bersama di `/onboarding` (checklist, resignation, clearance) | Belum ada kontrak self-service mobile khusus |
| Document management | Aktif di `/documents` | Sudah masuk kontrak mobile dengan file privat |
| Resolved RBAC | Tidak ada endpoint self-service terpisah | Gunakan role/permission dari auth session; jangan memakai path lama |

Nama singular lama seperti `permission-request`, `travel-expense`,
`employee-loan`, `daily-activity`, dan `work-calendar` tidak dipasang. Client
hanya boleh memakai path plural pada kontrak final.

## 7. Risiko pada endpoint yang sudah terintegrasi

### 7.1 Transport production

Dokumen masih mencantumkan production base URL HTTP. Build release mobile menolak HTTP dan memerlukan HTTPS. Backend/infra perlu menyediakan:

- domain HTTPS final;
- certificate chain valid;
- aturan rotasi sertifikat untuk pinning;
- CORS bila target web tetap dipakai;
- base URL staging dan production yang berbeda.

### 7.2 Permission employee

Kontrak menyebut beberapa risiko permission:

- `GET /leave` memerlukan `leave:read`;
- `POST /leave` memerlukan `leave:create`;
- payslip memerlukan `payroll:read`;
- `GET /employees/:id` memerlukan `employee:read`;
- `POST /ewa` memerlukan `ewa:create`.

Mohon sediakan matriks role employee/manager dan permissions final. Self-service harus tetap dibatasi server ke identity sendiri walaupun permission read diberikan.

### 7.3 Response schema dan pagination

Kontrak kini menjelaskan schema data untuk Approval Center, loan, EWA, daily
activity, travel/expense, notification, announcement, next shift, reporting
line, dan payroll self-service. Modul lain tetap mengikuti aturan umum berikut:

- apakah list berada langsung di `data` atau di `data.items`;
- field `meta.page`, `limit`, `total`, dan `totalPages`;
- filter dan sort yang didukung;
- date-only dibanding timestamp UTC;
- enum status, type, action, method, dayType, dan error code;
- nullable field dan backward compatibility.

Notifikasi mendukung `page`, `limit`, dan `unreadOnly`; client harus memakai
`meta.hasNextPage` dan tidak lagi mengambil ulang N item terbaru sebagai pseudo
pagination.

### 7.4 Server-authoritative attendance

Kontrak menyatakan server menangani identity, server time, geofence, fake GPS, face matching, liveness, dan rate limit. Acceptance belum dapat ditutup sebelum skenario berikut dibuktikan pada staging:

- employee/company ID yang dimanipulasi tidak mengubah target;
- timestamp device palsu tidak menjadi waktu final;
- lokasi di luar radius mengikuti policy server;
- `isMockLocation=false` dari payload client tidak dianggap bukti lokasi asli;
- selfie non-live, galeri, blur, atau payload face tambahan ditolak;
- lima kegagalan face menghasilkan rate limit sesuai kontrak;
- retry/idempotency tidak membuat attendance ganda;
- check-in/check-out lintas shift dan pergantian hari mengikuti timezone kantor.

## 8. Fixture response yang diminta dari backend

Semua fixture harus tersanitasi, memakai ID placeholder yang jelas, dan tetap mempertahankan struktur serta tipe data deployment.

### P0, sebelum smoke test fitur yang sudah ada

- login sukses employee;
- login sukses manager;
- `MFA_REQUIRED` dan login dengan `totp`;
- `/auth/me` untuk employee, manager, non-employee, dan affiliation yang dicabut;
- refresh sukses dengan token rotation;
- refresh expired/revoked/replay;
- attendance today sebelum check-in, setelah check-in, dan setelah check-out;
- attendance today dengan GPS wajib, selfie wajib, method tidak tersedia, holiday, dan non-working day;
- attendance history kosong, satu halaman, dan multi-page bila pagination didukung;
- leave types, balances, list, detail, create, cancel, serta insufficient balance;
- permission request list, create, cancel, serta status yang tidak bisa dibatalkan;
- resolved calendar bulan normal, tahun kabisat, shift swap, holiday, dan absence;
- notification list, unread count, read, read-all, resource supported/unsupported;
- employee detail normal, masked sensitive fields, permission denied, dan identity mismatch.

### P1, sebelum implementasi berikutnya

- my approvals kosong dan berisi berbagai resource;
- approve, reject, stale action, forbidden, dan bulk partial failure;
- correction create/detail/history/approve/reject;
- overtime list/create/pay/approve/reject;
- holiday list.

Session list/revoke, pengaturan MFA, dan delete notification ditunda dari rilis
mobile awal. Challenge TOTP saat login tetap bagian dari acceptance auth inti.

### P0 keamanan untuk payroll

- locked list tanpa nominal;
- PIN challenge/verify sukses;
- PIN salah dan lockout;
- unlock expired/revoked;
- detail sesudah unlock;
- PDF sukses, expired, forbidden, wrong employee, dan oversized file.

## 9. Matriks acceptance staging yang diminta

| Area | Skenario minimum | Hasil yang wajib dibuktikan |
|---|---|---|
| Auth | login, MFA, refresh rotation, logout, restore | Tidak ada sesi 200 tanpa token valid; token lama tidak dapat dipakai ulang |
| Tenant | request ID akun/company lain | 403/404; tidak ada data lintas tenant |
| Attendance | dalam/luar radius, fake GPS, face gagal, retry | Server menjadi sumber keputusan dan waktu; tidak ada sukses palsu/duplikat |
| Leave/Permission | create, cancel, invalid dates, insufficient balance | ID/status berasal server; ownership dan permission ditegakkan |
| Calendar | timezone berbeda, leap year, month boundary | Date-only dan Hari Ini konsisten dengan timezone kantor |
| Notification | read/read-all, akun berganti, unsupported resource | Count sinkron dan tidak bocor ke akun lain |
| Profile | employee biasa, manager, masked fields | Detail sendiri tersedia sesuai kebijakan tanpa membuka employee lain |
| Approval | employee vs manager, stale/double action | Hanya approver sah dapat action; conflict terlihat jelas |
| Payroll | locked, unlock, expiry, wrong employee | Nominal tidak pernah dikirim sebelum unlock dan file tetap berizin |

## 10. Keputusan yang diminta dari backend

### P0

- [ ] Berikan base URL HTTPS staging dan production.
- [ ] Berikan akun uji employee dan manager melalui secret manager atau konfigurasi lokal, bukan melalui chat/source repository.
- [x] Berikan fixture response tersanitasi untuk 24 operasi yang sudah dipakai client (`docs/mobile-api-fixtures.json`; OpenAPI penuh masih backlog).
- [x] Konfirmasi pagination riwayat attendance, leave, dan notification.
- [x] Konfirmasi dukungan serta semantics `Idempotency-Key`.
- [x] Berikan matriks permission employee/manager.
- [ ] Jalankan atau fasilitasi acceptance geofence, fake GPS, face/liveness, server time, tenant scope, dan replay.
- [x] Putuskan kontrak payroll unlock/reautentikasi/PDF.
- [x] Putuskan endpoint device-token push.

### P1

- [x] Berikan schema Approval Center dan seluruh action result/error.
- [x] Perjelas list riwayat koreksi milik employee.
- [x] Perjelas identity/scope endpoint overtime employee.
- [x] Action utama Approval Center untuk leave/permission adalah `POST /workflow-engine/instances/:id/actions`; route domain tetap compatibility-only.
- [x] Tambahkan timezone kantor/server date ke response yang relevan.
- [x] Berikan kontrak announcement, next shift, reporting line, kalender tim, dan dokumen employee.

### P2

- [x] Lengkapi schema employee loan, EWA, daily activity, dan travel expense.
- [x] Konfirmasi status endpoint lama untuk shift swap, asset, certification, performance, training, organization, onboarding, dan document management.
- [x] Delete notification UI, session management, dan MFA settings ditunda dari rilis mobile awal; endpoint backend tidak dihapus.

## 11. Urutan integrasi setelah backend merespons

1. Verifikasi 24 operasi aktif terhadap HTTPS staging dan fixture resmi.
2. Integrasikan kontrak permission, pagination, identity, timezone, dan idempotency yang sudah ditutup backend ke client.
3. Implementasikan Approval Center manager.
4. Implementasikan koreksi absensi dan lembur.
5. Integrasikan payroll memakai kontrak unlock/relock/PDF yang sudah tersedia.
6. Integrasikan push setelah credential Firebase/APNs staging tersedia.
7. Integrasikan dokumen dan password recovery; tunda chat sampai keputusan kontraknya final.
8. Lanjutkan loan, EWA, travel/claim, dan daily activity berdasarkan prioritas produk.

## 12. Kesimpulan

Mobile tidak lagi bergantung pada endpoint admin lama untuk auth atau attendance dasar. Jalur yang telah diintegrasikan sudah menggunakan Bearer token, self-service identity, server result, dan state error yang jujur. Blocker utama berikutnya berada pada kontrak backend/deployment, bukan desain UI.

Approval, correction, overtime, loan, EWA, daily activity, travel, payroll,
push, dokumen, password recovery, announcement, next shift, reporting line,
timezone, dan idempotency sudah mempunyai
kontrak backend. Integrasi client, response fixture lanjutan, credential provider,
serta acceptance staging tetap diperlukan. Chat ditunda eksplisit dari rilis
awal; attendance offline sudah ditutup sebagai live-only dengan jalur koreksi.

Status aplikasi tetap **REVIEW lokal**, belum **DONE staging/release**, sampai acceptance pada bagian 9 selesai dan bukti deployment dicatat.
