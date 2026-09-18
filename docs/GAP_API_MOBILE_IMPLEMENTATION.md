# Implementasi Gap API Mobile

Tanggal implementasi: 17 September 2026
Verifikasi terakhir: 18 September 2026

Dokumen ini mencatat bagian `gap_api_mobile.md` yang dapat ditutup langsung
di source backend tanpa menebak keputusan produk, credential, atau konfigurasi
deployment.

## Selesai di backend

- Empat endpoint attendance self-service tersedia: `GET /attendance/me/today`,
  `GET /attendance/me`, `POST /attendance/me/check-in`, dan
  `PATCH /attendance/me/check-out`.
- Identity, company, tanggal, check-in, dan check-out pada endpoint `/me`
  diturunkan dari sesi dan waktu server. Response today menyertakan timezone,
  server date/time, policy/context, record, dan capability check-in/out.
- Riwayat attendance mendukung `month`, `page`, dan `limit` dengan metadata
  pagination standar.
- Route lembur dipindah sebelum `/:id` agar `GET /attendance/overtime` dapat
  dicapai. Employee biasa dipaksa ke identity sendiri; actor elevated tetap
  dapat memilih employee dalam tenant aktif.
- Koreksi attendance mempunyai endpoint resmi milik sendiri:
  `GET /attendance-corrections/my` dan `GET /attendance-corrections/my/:id`.
  Create selalu memakai employee/company dari sesi dan payload divalidasi.
- `GET /leave/balances/employee` dipindah sebelum `/leave/:id`, sehingga route
  saldo tidak lagi tertangkap sebagai detail leave.
- Approval Center `my-approvals` mendukung pagination deterministik.
- Notifikasi mendukung pagination dan seluruh read/update/delete di-scope ke
  user serta company aktif.
- Registrasi/rotasi dan unregister token push tersedia melalui
  `POST/DELETE /notifications/device-tokens`. Token disimpan terenkripsi dan
  hash unik mencegah satu token tetap terikat ke dua akun.
- Mutasi mobile utama mendukung `Idempotency-Key` selama 24 jam, dengan replay
  response yang sama dan `409` untuk key yang dipakai dengan payload berbeda.
- Fake-GPS yang dilaporkan perangkat sebagai confirmed fake ditolak pada
  check-in maupun check-out; evidence checkout ikut masuk policy snapshot.
- Payroll self-service sekarang memakai list periode tanpa nominal,
  reautentikasi password + TOTP, grant 5 menit yang terikat user/employee/company,
  relock/revoke, lockout 5 kegagalan selama 15 menit, detail terlindungi, serta
  PDF privat on-demand maksimum 5 MB.
- Worker push native tersedia untuk FCM HTTP v1 dan APNs. Delivery memakai
  outbox per notification/device, retry eksponensial, payload navigasi, dan
  otomatis menonaktifkan provider token invalid. Tanpa credential, delivery
  disimpan sebagai `BLOCKED_CONFIG` dan tidak dianggap berhasil.
- Seed permission menutup permission yang sebelumnya tidak pernah dibuat untuk
  work calendar, permission request, employee loan, `leave:create` employee,
  dan `payroll:read` employee. Matriks final dicatat di
  `docs/mobile-permission-matrix.md`.
- Fixture tersanitasi untuk operasi mobile tersedia di
  `docs/mobile-api-fixtures.json`, sedangkan runner serta matriks acceptance
  staging tersedia di `scripts/mobile-api-smoke.mjs` dan
  `docs/mobile-staging-acceptance.md`.
- Kontrak `docs/mobile-api.md` sudah diperbarui agar sesuai implementasi.

## Migration

Jalankan migration berikut pada environment tujuan sebelum memakai endpoint
baru:

- `20260917120000_mobile_device_registrations`;
- `20260918100000_payroll_unlock_sessions`;
- `20260918110000_push_notification_deliveries`;
- `20260918120000_mobile_permission_matrix`.

## Tetap memerlukan keputusan/konfigurasi eksternal

- HTTPS staging/production, certificate policy, akun uji, dan smoke test live.
- Credential Firebase/APNs masih harus disuntikkan oleh secret manager pada
  environment deployment. Kode provider/worker sudah tersedia.
- Source Flutter/mobile tidak ada di repository ini, sehingga pemanggilan API
  dari aplikasi mobile tetap harus dikerjakan di repository client.
- Kontrak produk baru untuk chat, password recovery, dan announcement dashboard
  belum dapat diputuskan dari source backend. Employee document dan kalender
  tim yang ternyata sudah tersedia kini dicatat dalam kontrak mobile.
- Acceptance live untuk geofence, liveness, tenant isolation, token replay,
  push provider, dan timezone boundary tetap memerlukan deployment, akun
  sintetis, serta perangkat; runner dan checklist sudah disediakan.

## Verifikasi lokal

- `npm run check`
- `npx prisma validate`
- Seluruh 96 suite Jest lulus: 904 test lulus dan 89 test dilewati sesuai
  konfigurasi integrasi opsional.
- Seluruh migration berhasil diterapkan dari nol pada MySQL temporer dan
  `prisma migrate status` melaporkan schema terbaru.
- `npm audit --omit=dev` melaporkan 0 vulnerability.
- Fixture JSON dan syntax runner smoke test tervalidasi. Smoke test live belum
  dijalankan karena URL HTTPS, akun staging, credential provider, dan perangkat
  belum tersedia di workspace ini.
