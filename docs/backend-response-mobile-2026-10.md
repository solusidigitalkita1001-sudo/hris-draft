# Jawaban Backend atas "Rekap Task Tertunda dan Kebutuhan Backend HRIS Mobile"

Menjawab rekap mobile tertanggal 18 Oktober 2026, per ID BE-01 s/d BE-09 dan
pertanyaan kontrak di §3.1–§3.3 rekap tersebut.

Basis jawaban: commit `ca08ed5` (branch `fix/prod-infra`), dibaca dari kode,
bukan dari ingatan dokumen. Setiap klaim menyertakan lokasi filenya supaya bisa
diverifikasi sendiri.

Baca bersama [`api-change-checklist-mobile-2026-10.md`](api-change-checklist-mobile-2026-10.md)
— ada 4 breaking change sejak baseline mobile yang belum masuk rekap kalian.

PIC dan target penyelesaian sengaja dikosongkan; itu keputusan pemilik proyek,
bukan keputusan yang bisa diambil dari kode.

---

## Ringkasan status per ID

| ID | Status backend | Sisa pekerjaan |
|---|---|---|
| BE-01 | Jalur dipilih: **subdomain + Let's Encrypt di VPS**; runbook siap | eksekusi di server: DNS, certbot, env |
| BE-02 | Skrip fixture **ada**, belum dijalankan di staging | jalankan + serahkan kredensial lewat kanal aman |
| BE-03 | Kontrak **sudah ada di kode**, dijawab lengkap di bawah | selesai — satuan `duration` dan format tanggal sudah diputuskan & di-merge |
| BE-04 | Dijawab di bawah (envelope, pagination, identity, `shiftDate`, upload) | selesai — format tanggal sudah dipin di schema |
| BE-05 | Tooling **ada** (fixture GPS/shift/face), server face match jalan | jalankan fixture + sediakan foto enrollment |
| BE-06 | Endpoint **sudah ada**, role EMPLOYEE sudah punya izinnya | tidak ada pekerjaan backend — mobile tinggal integrasi |
| BE-07 | Register/delete token + pengiriman FCM/APNs **sudah ada** | kredensial FCM/APNs per environment + uji e2e |
| BE-08 | **Diputuskan 18 Okt: chat DI LUAR scope rilis** | tidak ada — mobile tetap menampilkan unavailable |
| BE-09 | **Ditunda** atas keputusan pemilik proyek | blocker submit store; harus selesai sebelum rilis |

---

## BE-01 — HTTPS staging & production

Status: **siap dipasang, belum terpasang.**

- Override TLS sudah di-version-control: `compose-https.override.yml` +
  `docker/nginx-https/`. Nginx terminasi TLS, redirect HTTP→HTTPS, forward
  `X-Forwarded-Proto: https`, HSTS aktif.
- Prosedur lengkap: [`docs/https-deployment.md`](https-deployment.md).
- Production **saat ini masih HTTP** di `http://srv540825.hstgr.cloud:8084`
  (API) dan `:8083` (web). Itu host demo, bukan rilis.

**Keputusan 18 Okt 2026:** subdomain diarahkan ke VPS yang sudah ada,
sertifikat dari Let's Encrypt, perpanjangan otomatis. Langkah per langkah —
DNS, `certbot certonly --standalone`, isi `backend/.env`, dan renewal hook yang
me-reload nginx di dalam container — sudah ditulis di
[`docs/https-deployment.md`](https-deployment.md) bagian *Issuing the
certificate on this VPS*.

Yang masih dibutuhkan dari pemilik proyek: nama subdomain dan akses DNS-nya.
Frontend wajib di-build ulang dengan `VITE_API_URL` versi HTTPS, kalau tidak
halaman HTTPS akan memanggil API HTTP dan diblokir browser.

Catatan untuk mobile: begitu HTTPS hidup, tidak perlu pengecualian cleartext.
Sampai itu terjadi, jangan jadikan host demo sebagai basis acceptance.

## BE-02 — Akun dan fixture acceptance

Status: **skrip penyedia fixture sudah ada**, tinggal dijalankan.

`backend/src/database/scripts/provision-mobile-smoke-fixtures.ts`
(`npm run fixtures:mobile`). Default-nya **dry run** — mencetak rencana JSON dan
tidak menulis apa pun sampai `MOBILE_FIXTURE_APPLY=staging-synthetic-only`.

Env yang dibaca:

```
MOBILE_FIXTURE_EMPLOYEE_EMAIL     MOBILE_FIXTURE_YEAR
MOBILE_FIXTURE_EXPECT_COMPANY_ID  MOBILE_FIXTURE_EXPECT_BRANCH_ID
MOBILE_FIXTURE_CONFIGURE_GPS      MOBILE_FIXTURE_GPS_LATITUDE
MOBILE_FIXTURE_GPS_LONGITUDE      MOBILE_FIXTURE_GPS_RADIUS_METERS
MOBILE_FIXTURE_REQUIRE_SELFIE     MOBILE_FIXTURE_FACE_IMAGE_PATH
MOBILE_FIXTURE_ALLOW_SHARED_BRANCH MOBILE_FIXTURE_ALLOW_PRODUCTION
```

Yang disiapkan: jadwal kerja Sen–Jum 09:00–18:00, branch + geofence, kebijakan
selfie, dan enrollment wajah dari foto yang ditunjuk.

Untuk uji isolasi dua company: jalankan skrip dua kali dengan
`MOBILE_FIXTURE_EXPECT_COMPANY_ID` berbeda. Role manager memakai permission
seed standar (`SUPER_ADMIN`, `HR_MANAGER`, `MANAGER`, `FINANCE`, `EMPLOYEE`) —
lihat `backend/src/database/seeds/modules/03-role-permissions.seed.ts`.

Kredensial akun uji akan dikirim lewat kanal aman, tidak di dokumen.

## BE-03 — Kontrak create izin dan upload lampiran

Status: **kontraknya sudah ada di kode**, selama ini belum didokumentasikan.
Referensi: `backend/src/modules/permission-request/permission-request.routes.ts`,
`permission-request.dto.ts`, `permission-request.controller.ts`.

### Alurnya dua langkah, bukan satu multipart

**1. Upload lampiran dulu** — `POST /api/v1/permission-requests/attachments`

- `multipart/form-data`, nama field: **`attachment`** (single file).
- Auth: Bearer, tanpa permission tambahan (self-service karyawan).
- Batas: **5 MB** (`UPLOAD_MAX_FILE_SIZE=5242880`).
- Tipe diizinkan: **`image/jpeg`, `image/png`, `image/gif`, `application/pdf`**
  (`UPLOAD_ALLOWED_MIMES`). MIME diperiksa **dan** magic bytes-nya divalidasi —
  file yang di-rename tetap ditolak.
- Response `201`:

```json
{ "success": true, "message": "Lampiran izin berhasil diunggah",
  "data": { "fileName": "<uuid>.jpg", "originalName": "surat-dokter.jpg",
            "mimeType": "image/jpeg", "size": 184320,
            "url": "https://<APP_URL>/api/v1/private-files/permission-attachments/<company>/<employee>/<uuid>.jpg" } }
```

**2. Baru buat izinnya** — `POST /api/v1/permission-requests` (JSON, bukan multipart)

```json
{ "type": "SICK", "startDate": "2026-11-02", "endDate": "2026-11-02",
  "duration": 1, "reason": "Periksa ke dokter",
  "attachment": "<data.url dari langkah 1>" }
```

- `type`: `SICK` \| `PERSONAL` \| `LATE` \| `EARLY_LEAVE` \| `LEAVE_OFFICE` \|
  `BUSINESS_TRIP` \| `WORK_FROM_HOME` \| `OTHER`.
- `reason`: 1–1000 karakter.
- `attachment`: **wajib**. Izin selalu butuh lampiran — beda dari cuti yang
  hanya meminta dokumen di dalam H-7 atau kalau tipe cutinya menuntut. Aturan ini
  dipagari test (`attachment-policy.test.ts`): tanpa lampiran, request ditolak
  `400` sebelum apa pun ditulis.
- Endpoint ini **idempotent** — kirim header `Idempotency-Key`; retry dengan key
  sama tidak membuat izin ganda (respons ulangan ditandai `Idempotency-Replayed`).

**3. Unduh lampiran** — `GET /api/v1/private-files/permission-attachments/:id`,
Bearer + role (`GROUP_ADMIN`, `COMPANY_ADMIN`, `HR_MANAGER`, `HR_STAFF`,
`MANAGER`, `EMPLOYEE`). File disimpan privat per `<companyId>/<employeeId>`
dengan nama acak; direktori `uploads/` tidak pernah di-serve statis.

### Dua hal yang sebelumnya menggantung — sudah diputuskan dan sudah di-merge

| Hal | Keputusan | Implementasi |
|---|---|---|
| Satuan `duration` | **hari**, pecahan diizinkan (`0.5` = setengah hari) | sudah jadi kontrak de-facto: form web memberi label "durasi (hari)" dan validasinya membatasi `duration` <= rentang tanggal. Sekarang dicatat di schema |
| Format `startDate`/`endDate` dan `shiftDate` | kontrak resmi **`YYYY-MM-DD`** | `shared/validators/calendar-date.ts` — ISO instant tetap diterima demi klien lama, lalu dinormalkan ke hari yang dimaksud |

Normalisasinya: `YYYY-MM-DD` disimpan sebagai tengah hari UTC, jadi tidak ada
rendering zona waktu yang menggeser harinya. Instant (mis.
`2026-11-01T17:00:00.000Z`, yang di WIB berarti 2 November pukul 00:00)
dibulatkan ke hari UTC terdekat sehingga tetap tercatat **2 November**.

**Untuk mobile: kirim `YYYY-MM-DD`.** Jangan kirim ISO instant — itu jalur
kompatibilitas untuk web lama, bukan kontrak yang didukung ke depan. Tanggal
yang tidak valid dijawab `422 VALIDATION_ERROR` dengan pesan
"Tanggal harus YYYY-MM-DD".


### Contoh error

| Kasus | HTTP | `code` |
|---|---|---|
| Field tidak lolos schema | `422` | `VALIDATION_ERROR` (+ array `errors`) |
| Tanpa lampiran | `400` | `BAD_REQUEST` |
| Tipe file tidak didukung / bukan file asli | `400` | `BAD_REQUEST` |
| File > 5 MB | `400` | `UPLOAD_ERROR` |
| Bukan pemilik / beda company | `403` | `FORBIDDEN` |
| Izin sudah diproses saat cancel | `409` | `CONFLICT` |

## BE-04 — Kontrak API yang masih terbuka

**Error envelope — `code` selalu ada.**
`backend/src/shared/middleware/ErrorHandler.ts`: setiap cabang mengirim `code`
(`VALIDATION_ERROR`, `CONFLICT`, `UPLOAD_ERROR`, `INTERNAL_ERROR`, atau
`err.code` milik AppError). Tidak ada jalur error yang mengirim body tanpa
`code`. Flutter boleh menganggapnya non-null; `code` nullable di klien tidak
merusak apa pun dan boleh dipertahankan sebagai jaring pengaman.

**Identity create cuti — ambil dari sesi, itu benar.**
`leave.controller.ts:50` menimpa `req.body.employeeId` dengan
`req.user.employeeId` sebelum masuk service. Jadi walau schema masih meminta
`employeeId` dan `companyId`, server tidak mempercayainya untuk user yang
tertaut ke karyawan. Praktik Flutter sekarang (isi dari sesi) sudah sesuai dan
aman dari IDOR.

**Route di luar OpenAPI — pakai discovery, jangan daftar manual.**
`GET /api/v1/meta/endpoints` dan `GET /api/v1/meta/openapi.json` hidup
(`backend/src/app.ts:266`, `:281`). Jadikan itu sumber kebenaran untuk matriks
kontrak, dan diff-kan di CI mobile — bukan daftar yang disalin tangan.

**Pagination — ada dua konvensi, dan itu disengaja.**

- Modul lama: `?page=&limit=`, response berisi meta pagination standar.
- Modul baru (helpdesk, timesheet rute approver): **cursor** — `?limit=&cursor=<uuid>`.
- Beberapa list self-service tidak berpaginasi sama sekali dan dibatasi
  server (mis. `GET /payroll/payslips/my` ambil 20 terbaru).

Klien perlu mendukung ketiganya; jangan paksakan satu model.

**`shiftDate`** — sudah dipin ke **`YYYY-MM-DD`**, lewat validator yang sama
dengan tanggal izin (lihat BE-03). Kirim date-only.

**Batas upload** — seragam dari config, bukan per endpoint: **5 MB**,
`image/jpeg`, `image/png`, `image/gif`, `application/pdf`, plus validasi magic
bytes. Satu pengecualian: import CSV absensi memakai batas 5 MB sendiri di
memory storage (`attendance.routes.ts:24`), dan itu rute admin.

**Receipt claim** — benar, referensinya `data.url`. Tidak ada rencana mengubah
itu; `filePath` memang kontrak lama.

## BE-05 — Kesiapan absensi dan verifikasi wajah

Status: **server-side siap, tinggal datanya.**

Face match dikerjakan server (`shared/attendance/face-extractor`), enrollment
disimpan per employee dengan `enrollmentConfidence`. Skrip BE-02 sekaligus
menyiapkan: shift, branch, geofence (lat/long/radius), kebijakan wajib selfie,
dan enrollment wajah dari `MOBILE_FIXTURE_FACE_IMAGE_PATH`. Tanpa foto itu,
status fixture akan berbunyi `enrollment-required`.

Fixture negatif (mismatch, rate limit, fake GPS, luar geofence, shift malam)
belum ada skripnya. Kalau QA mau, sebutkan kasusnya — menambah varian ke skrip
yang sama jauh lebih murah daripada menyiapkan manual tiap rilis.

## BE-06 — Download attachment employee

Status: **tidak ada pekerjaan backend. Endpointnya sudah ada.**

- `GET /api/v1/document-management/:id/download` — unduh langsung.
- `GET /api/v1/document-management/:id/file` — inline.
- `GET /api/v1/document-management/:id/signed-url` — URL bertanda tangan
  berumur pendek, kalau butuh dibuka di luar klien.

Guard `document:read`, dan **role EMPLOYEE sudah memilikinya** di seed. Scoping
dikerjakan server: company + kepemilikan + visibility; dokumen milik orang lain
dijawab "Document not found", dipagari test
(`document-management.access.test.ts`). Response download memakai
`Cache-Control: private, no-store` dan `X-Content-Type-Options: nosniff`.

Jadi tidak perlu kontrak baru — silakan integrasikan. Keputusan kalian untuk
tidak membuka `/uploads/*` langsung itu benar: direktori itu memang tidak
di-serve.

## BE-07 — Registrasi token dan push

Status: **backend sudah jadi**, tinggal kredensial dan bukti e2e.

- `POST /api/v1/notifications/device-tokens` — body:
  `{ installationId (8–200), platform: ANDROID|IOS, provider: FCM|APNS,
  token (20–4096), appVersion?, deviceModel? }`. `APNS` hanya sah untuk `IOS`.
- `DELETE /api/v1/notifications/device-tokens` — body `{ installationId }`.
- Keduanya **idempotent** (`idempotency()` di route) — reinstall/rotation yang
  memakai `installationId` sama tidak menggandakan baris.
- Pengiriman betulan sudah ada, bukan stub: `push-provider.ts` memanggil FCM
  HTTP v1 (`/v1/projects/<id>/messages:send`, OAuth service account) dan APNs
  (JWT). `push-delivery.service.ts` yang mengantre.

Sisa: isi `FCM_*`/APNs env per environment, lalu uji foreground/background/
terminated, pergantian akun, dan logout. Soal "payload pakai ID resource stabil,
bukan URL route" — setuju, itu kontrak yang benar; kirim daftar
notification/resource ID yang kalian butuhkan dan kami sesuaikan payload-nya.

## BE-08 — Chat

Status: **tidak ada modul chat di backend.** Tidak ada route, model, atau tabel.

**Keputusan pemilik proyek, 18 Oktober 2026: chat dikeluarkan dari scope
rilis.** Mobile tetap menampilkannya unavailable — persis seperti yang sudah
kalian lakukan. Tidak ada pekerjaan backend, dan rilis tidak menunggu ini.

Kalau yang dibutuhkan sebenarnya "tempat ngobrol internal" dan bukan pesan
pribadi 1-on-1, modul engagement sudah hidup dan tinggal dipakai: feed
perusahaan (`/engagement/posts`) dan kudos antar karyawan (`/engagement/kudos`)
— lihat §3.2 di checklist.

## BE-09 — Kebijakan data dan operasional

Bukan ranah kode. Yang sudah ada dari sisi backend:

- Backup MySQL terjadwal: [`docs/backup.md`](backup.md).
- Audit trail aktif untuk aksi mutasi (approve/reject/workflow).
- File sensitif tidak pernah di-serve statis; lampiran lewat endpoint
  terotorisasi.

Consent, retensi/penghapusan, privacy policy, Data Safety, App Privacy,
monitoring, dan rollback **belum punya keputusan tertulis**, dan per 18 Oktober
2026 pemilik proyek memutuskan menundanya ke Product.

Dicatat terbuka supaya tidak mengagetkan di akhir: Google Play (Data Safety) dan
App Store (App Privacy) menolak submit tanpa deklarasi ini, dan aplikasi ini
mengumpulkan selfie, lokasi, NIK, NPWP, serta data payroll. Jadi ini bukan item
yang bisa dilewati, hanya ditunda — dan ia akan menjadi blocker tepat di saat
rilis mau jalan.

---

## Yang perlu dikerjakan mobile tapi belum ada di rekap kalian

Empat breaking change sejak baseline 21 September — detail di
[`api-change-checklist-mobile-2026-10.md`](api-change-checklist-mobile-2026-10.md):

1. **403 `PASSWORD_CHANGE_REQUIRED`** — akun berpassword awal diblokir server
   di semua route kecuali `/auth/change-password|logout|me|refresh|csrf`.
   Interceptor wajib mengenali ini, kalau tidak akun baru terlihat "rusak".
2. **Satu periode bisa punya >1 payslip** (REGULAR/THR/SEVERANCE/CORRECTION).
   Key list harus `payslip.id`.
3. **`employeeNumber` tidak lagi unik global** — unik per company.
4. **Rute admin `/assets` pindah** dari permission `employee:*` ke `asset:*`.
   `GET /assets/my` tidak terpengaruh.

## Pekerjaan yang backend ambil dari dokumen ini

- [x] Pin format `startDate`/`endDate` izin dan `shiftDate` ke `YYYY-MM-DD` di schema
- [x] Putuskan & dokumentasikan satuan `duration` izin — **hari**, pecahan boleh
- [ ] Dokumentasikan alur lampiran izin dua langkah di `mobile-api.md` + OpenAPI
- [ ] Ekspos `runType` di payslip self-service kalau mobile perlu melabeli slip THR
- [ ] Tambah varian fixture negatif (face mismatch, luar geofence, shift malam) bila QA minta
- [ ] Sesuaikan payload push ke ID resource stabil sesuai daftar dari mobile
