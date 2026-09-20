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

Client saat ini menggunakan 24 pasangan method/path untuk auth, absensi self-service, cuti, izin, kalender, notifikasi, dan profil. Seluruhnya telah memiliki test lokal, tetapi belum mempunyai bukti smoke test terhadap deployment final.

Gap paling penting:

1. HTTPS production belum tersedia dalam kontrak deployment.
2. Approval Center sudah mempunyai endpoint, tetapi belum ada schema detail dan belum diintegrasikan mobile.
3. Koreksi absensi dan lembur sudah mempunyai endpoint, tetapi belum diintegrasikan mobile.
4. Payroll hanya mempunyai list/detail payslip. Kontrak PIN, unlock server, expiry, dan PDF belum tersedia.
5. Push notification belum mempunyai endpoint registrasi token perangkat.
6. Chat, dokumen employee, supervisor, dan password recovery belum mempunyai kontrak mobile final.
7. Mayoritas endpoint hanya mempunyai tabel method/path tanpa contoh response `data` yang stabil.
8. Enforcement geofence, fake GPS, liveness, server time, idempotency, dan tenant scope belum dibuktikan pada deployment.

## 4. Endpoint yang sudah digunakan mobile

Status seluruh item pada bagian ini adalah **terintegrasi lokal, perlu live review**.

### 4.1 Authentication dan session

| Method | Path | Pemakaian client | Catatan live review |
|---|---|---|---|
| POST | `/auth/login` | Login password dan challenge TOTP | Wajib mengembalikan user serta pasangan access/refresh token untuk client mobile |
| POST | `/auth/refresh` | Refresh satu kali dan retry protected request | Refresh token wajib berotasi dan pasangan token baru tidak boleh kosong |
| POST | `/auth/logout` | Revoke refresh-token family setelah local cleanup | Harus tetap menerima refresh token saat access token sudah mati |
| GET | `/auth/me` | Restore identity, role, permission, employee, company | Response harus mengganti snapshot sesi, termasuk ketika affiliation dicabut |
| POST | `/auth/change-password` | Mandatory password change | Client mengikuti body `oldPassword` dan `newPassword` |

### 4.2 Attendance self-service

| Method | Path | Pemakaian client | Catatan live review |
|---|---|---|---|
| GET | `/attendance/me/today` | Record hari ini dan policy/context | Bentuk `context`, allowed methods, lokasi, selfie, dan status belum mempunyai fixture final |
| GET | `/attendance/me?month=YYYY-MM` | Riwayat bulanan | Client juga mengirim `page` dan `limit`, tetapi keduanya belum disebut pada kontrak endpoint |
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
| GET | `/notifications?limit=N` | Inbox dan announcement yang difilter | Kontrak hanya menjelaskan `limit`, belum page/cursor dan schema item |
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

## 6. Capability yang belum mempunyai kontrak backend memadai

Status bagian ini adalah **tidak tersedia dalam kontrak mobile final**, bukan pernyataan bahwa route pasti tidak ada di source backend.

### 6.1 Payroll terlindungi

Kontrak saat ini hanya menyediakan:

- `GET /payroll/payslips`;
- `GET /payroll/payslips/:id`.

Mobile belum dapat mengimplementasikan slip gaji aman sampai tersedia keputusan berikut:

1. list periode sebelum unlock tidak boleh memuat nominal atau components;
2. endpoint PIN setup atau kebijakan PIN yang sudah ada;
3. challenge dan verify PIN atau reauthentication server;
4. bukti unlock yang terikat session, employee, company, dan device bila diperlukan;
5. expiry, revoke, relock, rate limit, dan lockout;
6. detail payslip hanya setelah unlock berhasil;
7. PDF/download dengan content type, batas ukuran, expiry, redirect policy, dan authorization;
8. status THR dan komponen payroll;
9. error code untuk PIN salah, lockout, unlock expired, periode terlarang, dan akses employee lain.

Menyembunyikan nominal di UI setelah client menerima response tidak memenuhi kebutuhan keamanan. Server harus mencegah nominal dikirim sebelum unlock.

### 6.2 Push notification

Kontrak berikut belum tersedia:

- register token FCM/APNs;
- update atau rotate token;
- unregister token saat logout;
- identitas device/install;
- binding token ke user dan company;
- payload resource/action/reference ID;
- invalid token handling;
- konfigurasi Firebase/APNs untuk environment development, staging, dan production.

Endpoint inbox notifikasi tidak menggantikan kontrak push device.

### 6.3 Chat atau pesan

Belum ada kontrak untuk:

- conversation list;
- message history dan pagination;
- unread count;
- send message;
- attachment;
- read receipt;
- realtime transport, reconnect, dan ordering;
- authorization antar-user/company.

Mobile saat ini hanya memberi keterangan bahwa chat belum tersedia dan tidak membuat percakapan contoh.

### 6.4 Dokumen employee dan relasi atasan

Belum ada kontrak mobile final untuk:

- daftar dokumen employee;
- metadata dokumen, tipe, periode, dan expiry;
- preview/download berizin;
- temporary URL atau streaming file;
- supervisor/manager langsung;
- reporting line atau approver hierarchy pada Profil.

`GET /employees/:id` belum mendokumentasikan field supervisor dan bukan pengganti kontrak file pribadi.

### 6.5 Password recovery

Daftar endpoint auth final tidak memuat forgot-password, reset-password, OTP recovery, expiry token, atau invalidation session setelah reset. Mobile tidak menampilkan kontrol lupa kata sandi sampai kontrak tersedia.

### 6.6 Dashboard, team, announcement, dan timezone

Belum ada kontrak khusus untuk:

- announcement resmi beserta category dan target audience;
- status `Tim Hari Ini`;
- jadwal/cuti tim yang boleh dilihat manager;
- next shift yang stabil lintas batas bulan;
- timezone kantor dan tanggal server saat ini.

Dashboard sekarang menyaring item `/notifications` yang mempunyai category announcement. Field tersebut belum dijelaskan dalam schema response final. Kalender memakai tanggal device untuk label Hari Ini karena response belum mendokumentasikan timezone kantor atau server date.

### 6.7 Offline mutation dan idempotency

Client sudah mengirim `Idempotency-Key` pada check-in, check-out, dan pengajuan tertentu, tetapi kontrak belum menyatakan:

- endpoint mana yang mendukung key;
- lama retensi key;
- scope key terhadap user/company/route;
- response ketika key yang sama dikirim ulang;
- response bila key sama dipakai dengan payload berbeda;
- aturan timestamp capture offline;
- konflik saat shift, policy, atau sesi berubah;
- apakah antrean offline attendance didukung.

Tanpa kontrak ini, mobile tidak dapat membuat offline queue dengan aman.

### 6.8 Endpoint dari dokumen lama yang belum dikonfirmasi

Checklist lama menyebut beberapa capability berikut, tetapi nama/path tersebut tidak ada dalam `mobile-api.md` final:

- resolved RBAC terpisah;
- shift swap;
- asset employee;
- certification;
- performance;
- training/LMS;
- organization chart dan employee directory;
- onboarding checklist;
- document management;
- sebagian nama path lama berbentuk singular seperti `permission-request`, `travel-expense`, `employee-loan`, `daily-activity`, dan `work-calendar`.

Mohon backend mengonfirmasi apakah modul tersebut:

1. masih aktif dengan path baru;
2. tersedia tetapi belum dimasukkan ke kontrak mobile;
3. hanya untuk web/admin;
4. deprecated atau belum siap.

Client hanya akan menggunakan path plural yang tercantum dalam kontrak final sampai ada revisi resmi.

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

Kontrak baru menjelaskan envelope umum, tetapi belum memberikan schema `data` lengkap pada mayoritas endpoint. Hal yang perlu dipastikan:

- apakah list berada langsung di `data` atau di `data.items`;
- field `meta.page`, `limit`, `total`, dan `totalPages`;
- filter dan sort yang didukung;
- date-only dibanding timestamp UTC;
- enum status, type, action, method, dayType, dan error code;
- nullable field dan backward compatibility.

Khusus notifikasi, kontrak saat ini hanya mendukung `limit`. Client tidak mengirim page/cursor dan fitur muat lebih banyak mengambil ulang N item terbaru. Bila backend mendukung pagination, contract perlu menyebut parameter dan metadata secara eksplisit.

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
- session list/revoke dan MFA management;
- holiday list.

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
- [ ] Berikan OpenAPI atau fixture response tersanitasi untuk 24 operasi yang sudah dipakai client.
- [ ] Konfirmasi pagination riwayat attendance, leave, dan notification.
- [ ] Konfirmasi dukungan serta semantics `Idempotency-Key`.
- [ ] Berikan matriks permission employee/manager.
- [ ] Jalankan atau fasilitasi acceptance geofence, fake GPS, face/liveness, server time, tenant scope, dan replay.
- [ ] Putuskan kontrak payroll unlock/PIN/PDF atau keluarkan payslip dari scope rilis.
- [ ] Putuskan endpoint device-token push atau keluarkan push dari scope rilis.

### P1

- [ ] Berikan schema Approval Center dan seluruh action result/error.
- [ ] Perjelas list riwayat koreksi milik employee.
- [ ] Perjelas identity/scope endpoint overtime employee.
- [ ] Tentukan action utama untuk leave/permission: domain action atau workflow-engine action.
- [ ] Tambahkan timezone kantor/server date ke response yang relevan.
- [ ] Berikan kontrak announcement, team status, next shift, supervisor, dan dokumen employee bila tetap masuk scope.

### P2

- [ ] Lengkapi schema employee loan, EWA, daily activity, dan travel expense.
- [ ] Konfirmasi status endpoint lama untuk shift swap, asset, certification, performance, training, organization, onboarding, dan document management.
- [ ] Tentukan apakah delete notification, session management, dan MFA settings akan dirilis pada mobile.

## 11. Urutan integrasi setelah backend merespons

1. Verifikasi 24 operasi aktif terhadap HTTPS staging dan fixture resmi.
2. Tutup gap permission, pagination, identity, timezone, idempotency, dan response schema.
3. Implementasikan Approval Center manager.
4. Implementasikan koreksi absensi dan lembur.
5. Implementasikan payroll hanya setelah kontrak keamanan lengkap.
6. Implementasikan push hanya setelah device-token contract dan konfigurasi Firebase/APNs tersedia.
7. Implementasikan chat, dokumen, supervisor, dan password recovery setelah contract ditambahkan.
8. Lanjutkan loan, EWA, travel/claim, dan daily activity berdasarkan prioritas produk.

## 12. Kesimpulan

Mobile tidak lagi bergantung pada endpoint admin lama untuk auth atau attendance dasar. Jalur yang telah diintegrasikan sudah menggunakan Bearer token, self-service identity, server result, dan state error yang jujur. Blocker utama berikutnya berada pada kontrak backend/deployment, bukan desain UI.

Approval, correction, overtime, loan, EWA, daily activity, dan travel sudah mempunyai kandidat endpoint dalam kontrak, tetapi masih membutuhkan response schema dan fixture sebelum client integration dapat dinyatakan stabil. Payroll, push, chat, dokumen, supervisor, recovery password, timezone, dan idempotency masih memerlukan keputusan kontrak backend yang eksplisit.

Status aplikasi tetap **REVIEW lokal**, belum **DONE staging/release**, sampai acceptance pada bagian 9 selesai dan bukti deployment dicatat.
