# Checklist Migrasi API untuk Tim Mobile

Dokumen ini merangkum perubahan API backend HRIS yang **harus ditindaklanjuti
oleh klien mobile**. Ditulis untuk dibaca sekali, lalu dikerjakan baris per baris
dari bagian [Checklist](#checklist) di bawah.

## Jendela riwayat yang diperiksa

- Rentang commit: dari `51d37eb` (commit tertua pada 60 commit terakhir, *Merge
  pull request #20*) sampai `32dfc33` (HEAD saat pemeriksaan, *fix(organization):
  declare the bootstrap logger after its import*).
- Rentang tanggal menurut catatan dokumen di repo: **10 September 2026** (entri
  pertama `docs/checklist-implementation-status.md`) sampai **30 September 2026**
  (catatan keandalan dokumen terakhir di file yang sama). Perubahan envelope API
  tercatat **28 September 2026**.
- Dokumen sumber utama: `docs/api-contract.md`,
  `docs/checklist-implementation-status.md` (bagian *Dampak API dan
  kompatibilitas* dan *Backlog prioritas berikutnya*),
  `docs/api-mobile-integration.md`, `docs/mobile-permission-matrix.md`.

> **Batas verifikasi (penting).** Pada mesin tempat dokumen ini disusun, object
> store Git (`.git/objects/pack/*.pack`) dan sebagian besar file di
> `backend/src/**` **tidak dapat dibaca** (file ter-evict / *dataless*, ukuran
> stat > 0 tetapi isi terbaca 0 byte; `.git/HEAD` dan `.git/refs/heads/main`
> berisi NUL sehingga seluruh perintah `git show`/`git diff` gagal). Karena itu
> **tidak ada kutipan diff atau `file:line` dari kode sumber** di dokumen ini.
> Bukti yang dipakai adalah dokumen `docs/*.md` yang memang dirawat sebagai
> kontrak, ditambah subject commit dari satu kali keluaran `git log --oneline -60`
> yang masih berhasil. Lihat bagian [Belum terverifikasi](#belum-terverifikasi).

## Ringkasan

| Endpoint / Area | Jenis perubahan | Yang harus dilakukan klien mobile |
| --- | --- | --- |
| Envelope sukses & error: EWA, daily-activity, employee, company-settings | **BREAKING** | Berhenti memakai parser khusus per modul; pakai satu parser envelope `{ success, message, data, meta? }` / `{ success, code, message, errors? }`. |
| Modul **company-settings** — field `code: "OK"` pada respons sukses | **BREAKING** | Hapus semua pembacaan `code` pada respons **sukses**. `code` sekarang hanya ada pada respons gagal. |
| Error 400/403 yang dulu tanpa `code` | additive | Jadikan `code` sebagai satu-satunya basis percabangan error; `message` tidak boleh dijadikan kondisi. |
| Autentikasi: `sessionVersion` naik setiap perubahan otoritas | **perilaku** | Tangani 401 mendadak di tengah sesi dengan satu kali refresh lalu retry, lalu muat ulang roles/permissions. |
| Field sensitif pegawai (NIK, NPWP, rekening, BPJS) | **BREAKING** | Jangan tampilkan/validasi nilai mask last-4 sebagai data asli; sembunyikan field bila user tak punya `employee:read-sensitive`. |
| Header `X-Client-Type: mobile` pada login/refresh | **BREAKING** jika belum dikirim | Kirim header ini pada `POST /auth/login` dan `POST /auth/refresh`, ambil token dari body. |
| `companyId`/`employeeId` dari body/query | **BREAKING** | Hapus dari semua payload dan query self-service; server menurunkannya dari token. |
| `GET /payroll/payslips` + detail/PDF | **BREAKING** | Daftar tanpa nominal; detail dan PDF menuntut header baru `X-Payroll-Unlock-Token` dari `POST /payroll/payslips/unlock`. |
| `POST /attendance/me/check-in` — payload biometrik | **BREAKING** | Kirim hanya `faceRecognition.selfieImage`; field turunan (`isFaceMatch`, `similarityScore`, vektor, URL) → `400`. |
| Check-in/check-out — fake GPS & selfie policy | **BREAKING** | Kirim `deviceGps` pada **kedua** jalur; tangani `400` fake-GPS/selfie dan `429` rate-limit face. |
| Absensi offline | **BREAKING** (perilaku) | Hapus antrean punch offline; punch yang tak sampai server → `POST /attendance-corrections`. |
| `Idempotency-Key` | **BREAKING** | Satu key per percobaan kirim satu form; key sama + payload berbeda → `409`. |
| `/uploads/*`, `filePath`, signed URL dokumen | **BREAKING** | Unduh lewat endpoint ber-ID dengan `Authorization`; referensikan hanya `filePath` hasil upload baru. |
| Reject di Approval Center | **BREAKING** | Wajib menyertakan alasan; self-approval ditolak termasuk `SUPER_ADMIN`. |
| Riwayat cuti (cuti bersama) | perilaku | Terima baris `APPROVED` yang tidak diajukan user; jangan tawarkan cancel untuk baris ber-`collectiveLeaveId`. |
| Bagian gaji pada profil employee | perilaku | Array kosong = tidak berhak melihat, bukan "Rp 0". |
| `/health`, `/health/ready` | perilaku | Tangani `503` sebagai "server belum siap", bukan error auth. |
| `GET /attendance/overtime`, `GET /leave/balances/employee` | additive (perbaikan route) | Hapus workaround; keduanya sekarang dapat dicapai. |
| Endpoint baru: attendance self, koreksi, next-shift, shift-swap, announcement, reporting line, aset, device token, password recovery | additive | Pakai sesuai §14; terapkan migration yang disebut di §14. |
| Approval Center via `workflow-engine` | additive (route domain jadi kompatibilitas) | Arahkan aksi ke `POST /workflow-engine/instances/:id/actions`; jangan campur dua jalur. |
| SSO OIDC per company | additive — **web-only** | Jangan bangun tombol SSO di mobile; alurnya berbasis redirect browser + cookie. |

## 1. Satu envelope untuk semua modul

**Yang berubah.** Empat modul — **EWA**, **daily-activity**, **employee**, dan
**company-settings** — sebelumnya merakit envelope respons sendiri. Sekarang
semuanya melalui helper `Result` yang sama seperti modul lain.

**Mengapa.** Envelope buatan tangan menyimpang: beberapa tidak mengirim
`message` sama sekali, dan beberapa error 400/403 ditulis langsung oleh
controller tanpa field `code`, sehingga klien tidak punya apa pun yang bisa
dicabang.

**Bukti.**
- `docs/checklist-implementation-status.md`, bagian *Backlog prioritas
  berikutnya* butir 6: "Envelope & error code SUDAH distandarkan dan dikunci test
  (28 September 2026, `docs/api-contract.md` + `api-contract.test.ts`):
  EWA/daily-activity/employee/company-settings tadinya merakit envelope sendiri
  (tanpa `message`, dan company-settings menambah `code: 'OK'` yang tak ada di
  endpoint lain), beberapa error 400/403 ditulis tangan tanpa `code`".
- `docs/api-contract.md`, bagian *Success* dan *Errors*.
- Dikunci oleh test `backend/src/shared/core/api-contract.test.ts` (dirujuk oleh
  `docs/api-contract.md` baris pembuka: "`backend/src/shared/core/api-contract.test.ts`
  pins them"). Test tersebut punya kasus *"routes every response through Result"*
  dan *"never invents a success-side code field"*.

**Bentuk sekarang (sukses).**

```json
{ "success": true, "message": "Success", "data": { } }
```

- `message` **selalu ada** dan tidak kosong. Perlakukan sebagai teks untuk
  operator, bukan nilai untuk dicabang.
- `data` **selalu ada**; bernilai `null` untuk respons delete/no-content.
- Endpoint list yang berhalaman menambah `meta`:

```json
{
  "success": true,
  "message": "Success",
  "data": [],
  "meta": { "page": 2, "limit": 10, "total": 25, "totalPages": 3, "hasNextPage": true, "hasPreviousPage": true }
}
```

`totalPages` = `ceil(total / limit)` dan bernilai `0` untuk hasil kosong, jadi
**pakai `hasNextPage`/`hasPreviousPage`** untuk paging, bukan aritmetika sendiri.

**Bentuk sekarang (gagal).**

```json
{ "success": false, "code": "NOT_FOUND", "message": "Resource not found" }
```

`errors` hanya muncul pada kegagalan validasi:

```json
{
  "success": false,
  "code": "VALIDATION_ERROR",
  "message": "Validation failed",
  "errors": [{ "field": "email", "message": "required" }]
}
```

**Katalog kode error** (dari `docs/api-contract.md`, tabel bagian *Errors*):

| Status | `code` | Arti bagi klien |
|---|---|---|
| 400 | `BAD_REQUEST` | Input salah bentuk/kontradiktif; perbaiki lalu ulangi. |
| 401 | `AUTHENTICATION_FAILED` | Kredensial ditolak. Autentikasi ulang. |
| 401 | `TOKEN_EXPIRED` | Refresh access token, lalu ulangi request. |
| 403 | `FORBIDDEN` | Terautentikasi tapi tidak berhak (termasuk di luar company/employee scope). **Jangan** retry. |
| 404 | `NOT_FOUND` | Tidak ada, **atau** di luar tenant/scope — keduanya sengaja tidak dibedakan. |
| 409 | `CONFLICT` | Tabrakan state (duplikat, sudah disetujui, tanggal tumpang-tindih). |
| 422 | `VALIDATION_ERROR` | Validasi schema gagal; `errors` menyebut field. |
| 429 | `TOO_MANY_REQUESTS` | Rate limit atau akun terkunci; backoff. |
| 500 | `DATABASE_ERROR` | Kesalahan server, bukan kesalahan pemanggil. |
| 503 | `SERVICE_UNAVAILABLE` | Dependency mati; coba lagi nanti. |

Dua kode lain datang dari app shell, bukan dari exception class: route yang
tidak cocok menjawab `404 NOT_FOUND`, dan `500 INTERNAL_ERROR` adalah fallback
untuk throw tak terduga (`docs/api-contract.md`, paragraf setelah tabel).

**Respons biner.** Ekspor CSV dan setiap download file privat **tidak memakai
envelope** — body-nya adalah file itu sendiri, dengan `Content-Disposition` dan
`X-Content-Type-Options: nosniff`. Kegagalan pada route tersebut tetap memakai
envelope error (`docs/api-contract.md`, bagian *Binary responses*).

## 2. `code: "OK"` di company-settings hilang — BREAKING

**Yang berubah.** Respons **sukses** `company-settings` dulu membawa field
`code: "OK"` yang tidak ada di endpoint mana pun yang lain. Field itu dihapus.

**Mengapa.** Satu-satunya endpoint dengan bentuk sukses berbeda; tidak ada klien
yang tercatat membacanya.

**Bukti.** `docs/api-contract.md`, bagian *Success*: "There is no `code` field on
a success response. An earlier company-settings variant emitted `code: \"OK\"`;
no client read it and it is gone." Dikunci test
`backend/src/shared/core/api-contract.test.ts` pada kasus *"never invents a
success-side code field"*.

**Sebelum.** (`data` disingkat — yang berubah hanya envelope-nya)

```json
{ "success": true, "code": "OK", "data": { } }
```

**Sesudah.**

```json
{ "success": true, "message": "Success", "data": { } }
```

Catatan: path persis endpoint company-settings tidak dikutip di sini karena tidak
ada dokumen di repo yang menyebutnya; ambil dari `docs/api-reference.md` atau
`GET /api/v1/meta/endpoints`. Modulnya disebut namanya di
`docs/checklist-implementation-status.md` dan `docs/api-contract.md`.

Konsekuensi konkret: model/DTO mobile yang menandai `code` sebagai field
**wajib** pada respons sukses company-settings akan gagal parse. Kalau parser
memakai strict decoding (mis. `Codable` Swift tanpa optional, atau
`json_serializable` Dart dengan `required`), ini error runtime, bukan sekadar
nilai kosong.

## 3. Perubahan otoritas langsung mematikan access token (`sessionVersion`)

**Yang berubah.** Roles, permissions, dan company-scope dibaca dari klaim di
dalam access token. Dulu, pencabutan role baru terasa setelah token kedaluwarsa.
Sekarang **setiap perubahan otoritas menaikkan `sessionVersion`**, sehingga token
lama ditolak pada request berikutnya dan klien harus refresh untuk mendapat
otoritas terbaru.

Perubahan otoritas yang menaikkan `sessionVersion`, menurut dokumen: **assign
role**, **ubah permission sebuah role**, dan **grant/revoke company access**.
Selain itu, **deaktivasi user** dan **ganti password** sudah sejak sebelumnya
berlaku di setiap request lewat pemeriksaan `isCurrentSession`.

**Mengapa.** Tanpa ini, pencabutan hak akses tertunda sampai masa hidup access
token (15 menit) habis.

**Bukti.** `docs/checklist-implementation-status.md`, bagian *Backlog prioritas
berikutnya* butir 4: "Revocation server: deaktivasi user & ganti password memang
berlaku di setiap request lewat `isCurrentSession`, TAPI role/permission/
company-scope dibaca dari klaim access token, jadi pencabutan role dulu baru
berlaku saat token kedaluwarsa. Kini setiap perubahan otoritas (assign role,
ubah permission role, grant/revoke company access) menaikkan `sessionVersion`
sehingga token lama mati di request berikutnya dan klien refresh ke otoritas
terbaru."

Catatan tambahan dari bagian *Update mobile/auth — 21 September 2026* pada
dokumen yang sama: password recovery juga memakai "session version yang langsung
menolak access token sebelum perubahan password".

**Dampak untuk klien.** Jenis perubahan ini **perilaku**, bukan perubahan bentuk
payload — tapi ia memunculkan **401 pada request yang sebelumnya berhasil**,
tanpa ada aksi dari user. Alur yang harus ada di aplikasi:

1. Request biasa → `401`.
2. Satu kali `POST /auth/refresh` dengan refresh token tersimpan.
3. Retry request semula **sekali**. Antrekan request paralel selama refresh
   berjalan (`docs/api-mobile-integration.md`, *Catatan Keamanan*: "implementasikan
   auto-refresh pada 401 (sekali retry, antre request paralel selama refresh
   berlangsung)").
4. **Muat ulang `roles`/`permissions`** dari hasil refresh dan bangun ulang
   menu/guard di UI — otoritas bisa berubah, jadi cache permission lama tidak
   boleh dipakai lagi.
5. Kalau refresh juga `401` → logout dan arahkan ke layar login.

Peringatan penting: refresh token **dirotasi setiap kali**, dan memakai ulang
refresh token lama akan **me-revoke seluruh sesi** (deteksi replay) — jadi dua
refresh paralel dengan token yang sama akan melogout user
(`docs/api-mobile-integration.md`, langkah 3).

## 4. Mode autentikasi mobile: `X-Client-Type: mobile`, token di body, tanpa CSRF

**Yang berubah.** API punya dua mode autentikasi. Mobile **wajib** memakai mode
Bearer, yang ditandai dengan header `X-Client-Type: mobile` **pada login dan
refresh**. Tanpa header itu, server memakai mode web: token dikirim sebagai
cookie `httpOnly` (`at`/`rt`) dan setiap mutasi menuntut token CSRF
double-submit.

**Bukti.** `docs/mobile-api.md` §2 (baris 31–40) dan `docs/api-mobile-integration.md`
bagian *Mode Autentikasi* — tabel yang sama di kedua dokumen:

| | Web (browser) | Mobile (native) |
|---|---|---|
| Penanda | (default) | `X-Client-Type: mobile` saat login/refresh |
| Token disimpan | httpOnly cookie (`at`/`rt`) | Response body → secure storage |
| Kirim auth | Cookie otomatis | `Authorization: Bearer <accessToken>` |
| CSRF | Wajib (double-submit) | **Tidak perlu** (request tanpa cookie auth dibebaskan dari CSRF) |

**Bentuk respons login/refresh (mode mobile).**

```json
{
  "success": true,
  "data": {
    "user": { "id": "...", "email": "...", "employeeId": "...", "companyId": "...", "roles": ["..."], "permissions": ["..."] },
    "tokens": { "accessToken": "<JWT, 15 menit>", "refreshToken": "<opaque, 7 hari>", "expiresIn": 900 }
  }
}
```

**Yang harus diperhatikan.**

- Header hanya diperlukan di `POST /auth/login` dan `POST /auth/refresh`;
  request lain cukup `Authorization: Bearer <accessToken>`.
- `GET /auth/csrf` **web-only**; mobile tidak perlu memanggilnya
  (`docs/mobile-api.md` §2.4).
- Konsekuensi dari aturan CSRF: pembebasan berlaku karena request mobile
  **tidak membawa cookie auth**. Klien yang (karena memakai cookie jar HTTP
  bawaan) ikut mengirim cookie `at`/`rt` akan dianggap cookie-authenticated dan
  mutasinya ditolak CSRF. Matikan cookie jar di HTTP client mobile.
- Token CSRF server punya umur maksimum dua jam dan token lama tanpa timestamp
  sudah ditolak (`docs/checklist-implementation-status.md`, *Dampak API dan
  kompatibilitas*) — relevan hanya bila aplikasi masih memakai mode cookie.

## 5. `companyId` dan `employeeId` tidak lagi diambil dari body/query — BREAKING

**Yang berubah.** Server **menurunkan `companyId`/`employeeId` dari token/sesi**,
bukan dari body atau query string klien. Endpoint self-service (`/me`, `/my`)
memakai identitas pemanggil secara otomatis.

**Mengapa.** Identitas yang bisa dikirim klien berarti klien bisa membaca atau
menulis data pegawai lain.

**Bukti.**
- `docs/mobile-api.md` baris 142 (§3, *Company & employee context (PENTING)*):
  "Sejak hardening, server **menurunkan `companyId`/`employeeId` dari token/sesi**,
  bukan dari body/query client."
- `docs/mobile-api.md` baris 5 (blockquote pembuka): dokumen ini "Menggantikan
  `mobile-api-documentation.md` (versi lama, base URL `localhost:3000` dan
  konvensi `employeeId` via query yang sudah tidak berlaku)".
- `docs/mobile-api.md` §5 (*Aturan keras — server-authoritative*): "nilai
  identitas/waktu dari client tidak diterima pada endpoint `/me`".
- `docs/checklist-implementation-status.md`, *Lanjutan P1: kontrak API, approval,
  dan pembayaran payroll*: "DTO frontend tidak lagi memakai `Partial<Loan>` atau
  mengirim employeeId aktor"; "Kontrak trip/expense create dan self-list
  diselaraskan: identitas aktor ditentukan server… Contract tests mencakup
  payload aktor palsu dan employee context yang hilang."

**Sebelum (dokumentasi lama `mobile-api-documentation.md`).**

```http
GET /api/v1/attendance?employeeId=<uuid-saya>&month=2026-09
POST /api/v1/employee-loans
{ "employeeId": "<uuid-saya>", "loanTypeId": "...", "amount": "1000000" }
```

**Sesudah.**

```http
GET /api/v1/attendance/me?month=2026-09
Authorization: Bearer <accessToken>

POST /api/v1/employee-loans
{ "loanTypeId": "...", "amount": "1000000", "totalInstallments": 6, "installmentAmount": "166667", "reason": "..." }
```

Catatan: `?companyId=` masih diterima oleh **beberapa endpoint admin** untuk
memilih tenant (multi-company / super admin); sebagai employee biasa jangan
mengirimkannya (`docs/mobile-api.md` §3). `SUPER_ADMIN` **wajib** memilih active
company secara eksplisit — tidak ada mode tenant global
(`docs/mobile-permission-matrix.md`, *Data-scope expectations*).

Ketidakpastian yang perlu dicatat: dokumen menyatakan identitas dari klien
"tidak diterima", tetapi **tidak** menyebut apakah field identitas asing itu
menyebabkan `403`/`422` atau hanya **diabaikan** diam-diam. Lihat
[Belum terverifikasi](#belum-terverifikasi).

## 6. Field sensitif pegawai di-mask last-4 — BREAKING

**Yang berubah.** **NIK, NPWP, nomor rekening, dan BPJS** dikembalikan dalam
bentuk **mask last-4**, kecuali pemanggil punya role HR/admin atau permission
`employee:read-sensitive`.

**Mengapa.** Nilai penuh tidak boleh ikut setiap kali layar profil dibuka oleh
pengguna biasa.

**Bukti.** `docs/mobile-api.md` baris 145 (§3): "**Masking data sensitif:** NIK,
NPWP, rekening, BPJS di-mask **last-4** kecuali user punya role HR/admin atau
permission `employee:read-sensitive`." Hal yang sama di
`docs/api-mobile-integration.md`, bagian *Konvensi Respons*. Juga
`docs/mobile-api.md` §4.13: `GET /employees/:id` → "Detail karyawan (data
sensitif ter-mask sesuai izin)".

**Sebelum / sesudah (untuk user mobile biasa).** Nilai field yang sama berubah,
nama field tidak:

```jsonc
// sebelum — nilai penuh
{ "nik": "3174010101900001", "npwp": "09.254.294.3-407.000", "bankAccountNumber": "1234567890" }

// sesudah — untuk pemanggil tanpa employee:read-sensitive
{ "nik": "************0001", "npwp": "**************.000", "bankAccountNumber": "******7890" }
```

**Yang harus dilakukan klien.**

- Jangan memakai nilai ini sebagai input ke mana pun (prefill form, pencarian,
  pencocokan, atau pengiriman balik saat update) — mengirimkannya kembali akan
  menyimpan karakter mask sebagai data.
- Jangan memvalidasi panjang/format NIK atau NPWP pada nilai hasil baca.
- Lebih baik **sembunyikan field** ketika `permissions` dari `GET /auth/me`
  tidak memuat `employee:read-sensitive`, daripada menampilkan deretan bintang.

Ketidakpastian: **bentuk persis mask** (karakter, jumlah bintang, apakah
separator NPWP dipertahankan) tidak dinyatakan di dokumen mana pun; contoh di
atas adalah ilustrasi bentuk, bukan string yang dijamin server. Perlakukan
nilainya sebagai string opaque. Lihat [Belum terverifikasi](#belum-terverifikasi).

## 7. Payslip self-service: daftar tanpa nominal + grant unlock wajib — BREAKING

**Yang berubah.** Jalur payslip self-service dipecah menjadi daftar tanpa uang
dan detail yang terkunci:

| Method | Path | Catatan |
|---|---|---|
| GET | `/payroll/payslips` | Periode payslip sendiri **tanpa nominal**; hanya run `APPROVED`/`DISBURSED` |
| POST | `/payroll/payslips/unlock` | Reautentikasi `password` + `totp` (bila MFA aktif) → grant 5 menit |
| POST | `/payroll/payslips/lock` | Cabut seluruh grant aktif |
| GET | `/payroll/payslips/:id` | Detail nominal — **wajib** header grant |
| GET | `/payroll/payslips/:id/pdf` | PDF privat — **wajib** header grant |

Header yang baru diwajibkan:

```http
X-Payroll-Unlock-Token: <data.unlockToken dari /payslips/unlock>
```

**Mengapa.** Slip gaji adalah data paling sensitif di aplikasi; membukanya
menuntut bukti bahwa orang yang memegang perangkat adalah pemilik akun, bukan
sekadar sesi yang masih hidup.

**Bukti.** `docs/mobile-api.md` §4.12 (baris 441–471). Juga
`docs/GAP_API_MOBILE_IMPLEMENTATION.md`, *Selesai di backend*: "Payroll
self-service sekarang memakai list periode tanpa nominal, reautentikasi password
+ TOTP, grant 5 menit yang terikat user/employee/company, relock/revoke, lockout
5 kegagalan selama 15 menit, detail terlindungi, serta PDF privat on-demand
maksimum 5 MB." Migration pendukung: `20260918100000_payroll_unlock_sessions`
(dokumen yang sama, bagian *Migration*). Matriks acceptance-nya ada di
`docs/mobile-staging-acceptance.md` §3, baris *Payroll locked* / *Payroll unlock*
/ *Payroll lockout*.

**Aturan yang harus diikuti klien.**

- Simpan `unlockToken` **hanya di memori**, jangan di secure storage
  (`docs/mobile-api.md` §4.12: "Gunakan nilai `data.unlockToken` hanya di
  memory").
- Grant terikat ke user + employee + company aktif, kedaluwarsa **5 menit**, dan
  unlock baru otomatis mencabut grant lama — jadi dua layar yang unlock sendiri-
  sendiri akan saling membatalkan.
- **Lima kegagalan unlock dalam 15 menit → `429`** dan unlock terkunci 15 menit.
  Sesi login tetap hidup dan independen; jangan logout user karena ini.
- PDF maksimum 5 MB, tanpa URL publik, tanpa redirect, tanpa file sementara —
  jadi jangan mengandalkan URL yang bisa dibagikan atau dibuka di WebView tanpa
  header.
- `GET /payroll/payslips` hanya memuat run berstatus `APPROVED`/`DISBURSED`:
  periode yang masih diproses memang tidak muncul; itu bukan bug.

## 8. Payload absensi: hanya foto mentah, keputusan biometrik milik server — BREAKING

**Yang berubah.** Pada `POST /attendance/me/check-in` (dan field lokasi/method
pada `PATCH /attendance/me/check-out`), klien **hanya boleh** mengirim
`faceRecognition.selfieImage` berupa foto mentah. Mengirim vektor wajah, URL,
`similarityScore`, atau `isFaceMatch` **ditolak `400`**.

**Bukti.** `docs/mobile-api.md` §5 (baris 529–571), *Aturan keras
(server-authoritative)*: "Client **hanya boleh** kirim `selfieImage` (foto
mentah). Kirim vektor wajah, URL, `similarityScore`, atau `isFaceMatch` →
**ditolak 400**. Semua keputusan biometrik dihitung di server."

Pagar lain pada jalur yang sama, semuanya memunculkan 4xx baru:

| Kondisi | Hasil | Bukti |
|---|---|---|
| Face tidak cocok (cosine similarity < 0.6) | `400` + tercatat di audit | `docs/mobile-api.md` §5 |
| 5 kegagalan face / 15 menit per karyawan | `429` (HR dinotifikasi) | `docs/mobile-api.md` §5 |
| GPS palsu / mock location terkonfirmasi | `400`, tidak ada baris absensi | `docs/mobile-api.md` §5; `docs/GAP_API_MOBILE_IMPLEMENTATION.md` ("Fake-GPS yang dilaporkan perangkat sebagai confirmed fake ditolak pada check-in maupun check-out") |
| Policy `requiresSelfie=true` tapi check-in `MOBILE_GPS` tanpa selfie | `400`, tidak ada baris absensi | `docs/mobile-staging-acceptance.md` §6 |
| Foto galeri / tidak live | ditolak oleh policy liveness | `docs/mobile-api.md` §5; `docs/mobile-staging-acceptance.md` §3 |
| Di luar radius | sesuai policy branch: ditandai `requiresReview` **atau** ditolak | `docs/mobile-api.md` §5 |

**Perubahan perilaku penting — fake GPS kini juga diperiksa saat check-out.**
Menurut `docs/GAP_API_MOBILE_IMPLEMENTATION.md`, penolakan fake-GPS berlaku
"pada check-in **maupun** check-out", dan "evidence checkout ikut masuk policy
snapshot". Klien yang hanya mengirim `deviceGps` pada check-in akan melihat
check-out gagal di perangkat dengan mock location aktif.

Catatan: `docs/checklist-implementation-status.md` mencatat commit
`25a67cd fix(attendance): a fingerprint punch now says that nothing verified it`
dan `45604f3 feat(attendance): fingerprint punches that hardware actually
attests` — ini jalur **device/mesin fingerprint**, bukan aplikasi mobile; lihat
`docs/attendance-device-integration.md`. Tidak dimasukkan ke checklist mobile.

## 9. Absensi adalah live-only: tidak ada antrean punch offline — BREAKING (perilaku)

**Yang berubah.** Check-in/check-out ditetapkan sebagai operasi **online dan
live-only**. Klien **tidak boleh** mengantre punch offline atau mengirim waktu
capture perangkat; waktu final selalu waktu server saat request diterima.

**Bukti.** `docs/mobile-api.md` §5, butir terakhir *Aturan keras*. Diperkuat
`docs/GAP_API_MOBILE_IMPLEMENTATION.md`: "Kontrak attendance offline juga
diputuskan live-only: retry memakai idempotency key, sedangkan punch yang tidak
pernah mencapai server harus masuk melalui koreksi absensi."

**Yang harus dilakukan klien.**

1. Hapus/matikan antrean punch offline bila ada.
2. Bila jaringan gagal **setelah** request dikirim: retry request yang sama
   dengan `Idempotency-Key` yang sama.
3. Bila punch memang **tidak pernah** mencapai server: arahkan user ke
   pengajuan koreksi absensi (`POST /attendance-corrections`) setelah koneksi
   pulih, bukan mengirim punch dengan timestamp lama.
4. Waktu yang ditampilkan harus mengikuti `serverTime`/`serverDate`/`timezone`
   dari `GET /attendance/me/today`, bukan jam perangkat
   (`docs/mobile-staging-acceptance.md` §3, baris *Timezone boundary*:
   "`serverDate` follows office timezone, not device date").

## 10. Kontrak `Idempotency-Key`: `409` untuk key yang dipakai ulang dengan payload berbeda

**Yang berubah.** Mutasi mobile utama menerima header opsional
`Idempotency-Key` (16–128 karakter ASCII unik), dan kontraknya dipertegas:

- Key disimpan **24 jam**, di-scope ke company + user + method + path.
- Request ulang dengan **key dan payload sama** → response pertama diulang,
  disertai header `Idempotency-Replayed: true`.
- **Payload berbeda** dengan key yang sama, **atau** request yang masih
  diproses → **`409`**.
- **Hanya response `2xx` yang disimpan**; response validasi/permission/
  conflict/server-error melepas reservasi, sehingga request yang sudah
  diperbaiki boleh memakai key yang sama.
- Urutan key di object JSON tidak mengubah fingerprint request.

Cakupan: check-in, check-out, pengajuan cuti/izin, koreksi, lembur, loan, EWA,
aktivitas harian, trip/expense, dan registrasi device.

**Bukti.** `docs/mobile-api.md` §3, baris 108–113 dan paragraf sesudahnya.
`docs/GAP_API_MOBILE_IMPLEMENTATION.md`: "Mutasi mobile utama mendukung
`Idempotency-Key` selama 24 jam, dengan replay response yang sama dan `409`
untuk key yang dipakai dengan payload berbeda. Hanya response `2xx` yang
dipersist; error melepas key agar dapat dicoba ulang, fingerprint tidak
bergantung pada urutan key JSON". Kasus uji manual:
`docs/mobile-staging-acceptance.md` §3, baris *Idempotent retry* dan
*Changed replay*. `docs/checklist-implementation-status.md`, *Update
mobile/auth — 21 September 2026*: "Idempotency mobile diperluas ke loan, EWA,
daily activity, dan travel/expense; hanya respons 2xx disimpan dan fingerprint
JSON sudah canonical."

**Jenis perubahan.** `409` pada key yang dipakai ulang dengan payload berbeda
adalah **4xx baru pada request yang dulu diterima** → **BREAKING** untuk klien
yang memakai satu key per layar/sesi. Pola yang benar: satu key per **percobaan
pengiriman satu form**, dibuat ulang hanya ketika user mengubah isian.

Header `Idempotency-Key` sudah diizinkan di CORS untuk origin aplikasi
(`docs/checklist-implementation-status.md`, *Lanjutan P1: kontrak API…*).

## 11. File privat: `/uploads/*` ditutup, metadata tanpa `filePath` — BREAKING

**Yang berubah.**

- URL mentah `/uploads/*` **tidak lagi dapat diakses**.
- Kuitansi diunduh melalui `/api/v1/private-files/receipts/:claimId`.
- Bukti kinerja melalui `/api/v1/private-files/performance-evidence/:evidenceId`.
- **Metadata dokumen tidak lagi berisi `filePath`.** Hasil upload kuitansi
  mengembalikan *storage key* relatif pada `filePath`, bukan path filesystem
  internal.
- **Signed document URL** tetap berformat sama tetapi sekarang **memerlukan
  sesi dan permission aktif** — link anonim yang dibagikan tidak lagi berfungsi.
- Download memakai `Content-Disposition: attachment`, `no-store`, dan
  `X-Content-Type-Options: nosniff`.
- Pengajuan klaim baru **wajib** memakai referensi hasil upload baru yang
  terikat company/employee; path legacy bebas **tidak diterima** sebagai input
  baru.

**Bukti.** `docs/checklist-implementation-status.md`, bagian *Dampak API dan
kompatibilitas* (lima butir berurutan: "URL raw `/uploads/*` tidak lagi dapat
diakses…", "Signed document URL tetap memiliki format yang sama tetapi sekarang
memerlukan session dan permission aktif…", "Metadata dokumen tidak lagi berisi
`filePath`…", "Kuitansi legacy… path legacy bebas tidak diterima sebagai input
baru"). Kontrak upload kuitansi mobile: `docs/mobile-api.md` §4.9 — "Upload
receipt adalah `multipart/form-data` field `receipt`; response `data` berisi
`fileName`, `originalName`, `mimeType`, `size`, `filePath`, dan `url`. Hanya
`filePath` hasil upload milik sesi yang boleh direferensikan create." Endpoint
dokumen: `docs/mobile-api.md` §4.14 — `GET /documents/:id` "Detail metadata
tanpa membuka path storage", `GET /documents/:id/signed-url` "URL bertanda
tangan yang tetap memerlukan sesi aktif".

**Alur yang benar untuk klaim bermutlak lampiran.**

```
1. POST /api/v1/travel-expenses/claims/receipt-upload   (multipart, field "receipt")
   → data.filePath  ← storage key, bukan path filesystem
2. POST /api/v1/travel-expenses/claims
   { "category": "...", "amount": "...", "expenseDate": "...", "receiptFilePath": "<data.filePath dari langkah 1>" }
```

**Untuk menampilkan file**: panggil endpoint download dengan `Authorization`
(mis. `GET /documents/:id/download`, atau
`GET /private-files/receipts/:claimId`) dan render dari byte-nya. Jangan
menyuapkan URL ke komponen gambar/WebView yang tidak mengirim header auth —
itulah yang rusak ketika `/uploads/*` ditutup dan signed URL mulai menuntut
sesi.

Validasi upload juga diperketat: signature/magic-byte, MIME, dan ekstensi harus
cocok; nama file kuitansi/evidence dibuat acak; upload yang gagal dibersihkan
dari disk (`docs/checklist-implementation-status.md`, tabel *Hasil implementasi*
baris *Upload*, dan *Backlog prioritas berikutnya* butir 3 yang merujuk
`docs/file-consumer-audit.md`). Klien yang mengandalkan ekstensi yang tidak
sesuai isi file akan mulai ditolak.

## 12. Approval Center: `workflow-engine` jadi jalur utama, route domain hanya kompatibilitas

**Yang berubah.** Untuk Approval Center manager, aksi utama adalah
`POST /workflow-engine/instances/:id/actions`. Route domain seperti
`PATCH /leave/:id/approve|reject|workflow-action` **dipertahankan untuk
kompatibilitas**, tetapi klien baru **tidak boleh mencampur** kedua jalur untuk
satu aksi.

**Bukti.** `docs/mobile-api.md` §4.3: "Untuk manager Approval Center, action
utama leave adalah `POST /workflow-engine/instances/:id/actions`. Route domain
`PATCH /leave/:id/approve|reject|workflow-action` dipertahankan untuk
kompatibilitas, tetapi client baru tidak boleh mencampur kedua jalur untuk satu
aksi." Hal yang sama untuk izin di §4.4. Juga
`docs/GAP_API_MOBILE_IMPLEMENTATION.md`: "Approval Center memakai
workflow-engine action sebagai jalur utama; route action domain tetap
compatibility-only."

**Kontrak yang harus dipatuhi** (`docs/mobile-api.md` §4.11, baris 408–440):

- Queue `GET /workflow-engine/instances/my-approvals` berada **langsung pada
  `data`** dengan `meta` pagination standar; setiap item adalah
  `WorkflowInstanceStep` saat ini, dengan nested `instance` + `template`.
- Single action menerima `{ "action": "APPROVE|REJECT|ESCALATE", "comment"?: string }`.
  Untuk reference type yang dikenal, `data` adalah hasil **domain handler** —
  jadi bentuknya berbeda-beda per domain. Klien **wajib refresh queue/detail
  setelah sukses** dan **tidak boleh** bergantung pada satu shape generik.
- Bulk `POST /workflow-engine/instances/bulk-approve` menerima `instanceIds`
  (1–100); response `data` stabil `{ total, successful, failed, results: [{ instanceId, success, error? }] }`
  dan **boleh sukses parsial** — tangani `failed > 0` sebagai hasil normal,
  bukan error.
- Error: `400 BAD_REQUEST` untuk transisi/payload domain tidak berlaku, `409
  CONFLICT` untuk action stale/race, `422 VALIDATION_ERROR` dengan array
  `errors`.

**Aturan baru yang bisa memunculkan 4xx.** Self-approval ditolak **termasuk
untuk `SUPER_ADMIN`**, dan **reject wajib menyertakan alasan**
(`docs/checklist-implementation-status.md`, *Lanjutan P1: kontrak API, approval,
dan pembayaran payroll*: "Workflow tidak mengizinkan self-approval termasuk
SUPER_ADMIN; rejection memerlukan alasan."). Tombol *Reject* tanpa field alasan
akan gagal — kemungkinan `422`.

## 13. Route yang sebelumnya tidak dapat dicapai, kini bekerja (additive)

**Yang berubah.** Dua route tertangkap oleh pola `/:id` di atasnya dan karena
itu tidak pernah benar-benar dapat dipanggil. Urutannya diperbaiki:

| Route | Dulu | Sekarang |
|---|---|---|
| `GET /attendance/overtime` | tertangkap `GET /attendance/:id` | dapat dicapai |
| `GET /leave/balances/employee` | tertangkap `GET /leave/:id` | dapat dicapai |

**Bukti.** `docs/GAP_API_MOBILE_IMPLEMENTATION.md`, *Selesai di backend*: "Route
lembur dipindah sebelum `/:id` agar `GET /attendance/overtime` dapat dicapai"
dan "`GET /leave/balances/employee` dipindah sebelum `/leave/:id`, sehingga route
saldo tidak lagi tertangkap sebagai detail leave."

**Jenis perubahan: additive** — tidak ada klien yang bisa bergantung pada
perilaku lama (dulu endpoint-nya memang tidak berfungsi). Tapi ini berarti
*workaround* apa pun yang dibuat tim mobile untuk saldo cuti atau daftar lembur
sekarang bisa dihapus. `GET /leave/balances/employee` dipakai di dashboard
karyawan (`docs/mobile-api.md` §8 langkah 4).

## 14. Endpoint baru (additive)

Semua ini **tambahan**; tidak ada yang mengubah bentuk endpoint lama. Sumber:
`docs/GAP_API_MOBILE_IMPLEMENTATION.md` dan `docs/mobile-api.md` §4.

| Area | Endpoint | Catatan |
|---|---|---|
| Absensi self | `GET /attendance/me/today`, `GET /attendance/me`, `POST /attendance/me/check-in`, `PATCH /attendance/me/check-out` | `/me/today` membawa `serverTime`, `serverDate`, `timezone`, `record`, `context`, `canCheckIn`, `canCheckOut` (§4.1) |
| Koreksi absensi | `GET /attendance-corrections/my`, `GET /attendance-corrections/my/:id` | endpoint resmi milik sendiri (§4.2) |
| Shift berikutnya | `GET /work-calendars/me/next-shift?from=YYYY-MM-DD` | `from` inklusif, default tanggal server di timezone company, horizon 92 hari, `shift=null` bila tidak ada jadwal (§4.5) |
| Tukar shift | `GET /work-calendars/shift-swaps/candidates/my`, `/shift-swaps/my`, `/shift-swaps/approvals/my`, `POST /work-calendars/shift-swaps`, `PATCH /shift-swaps/:id/cancel\|approve\|reject` | self-service (§4.5) |
| Announcement | `GET /announcements`, `GET /announcements/unread-count`, `GET /announcements/:id`, `PUT /announcements/:id/read` | ID di luar audience → `404`; read-state idempotent (§4.16) |
| Reporting line | `GET /employees/me/reporting-line` | dari `Position.reportsToId`; primary holder deterministik, holder lain sebagai alternatif (§4.13) |
| Aset | `GET /assets/my?status=ACTIVE\|RETURNED\|ALL&page=&limit=` | pagination standar; nilai finansial & aset pegawai lain tidak pernah dikembalikan (§4.17) |
| Push token | `POST /notifications/device-tokens`, `DELETE /notifications/device-tokens` | payload `installationId`, `platform`, `provider`, `token`, `appVersion`, `deviceModel`; token provider tidak pernah dikembalikan lagi oleh API (§4.10) |
| Password recovery | `POST /auth/forgot-password`, `POST /auth/reset-password` | forgot selalu `202` (anti-enumeration); token sekali pakai, berlaku 15 menit; SMTP harus diaktifkan eksplisit (§2.4, §7) |

Pagination juga ditambahkan ke `GET /notifications`,
`GET /workflow-engine/instances/my-approvals`, dan riwayat absensi
(`GET /attendance/me`, `limit` maksimum 100). Metadata `meta` memakai bentuk
standar `page`, `limit`, `total`, `totalPages`, `hasNextPage`, `hasPreviousPage`
(`docs/mobile-api.md` §4.10, §4.11; `docs/api-contract.md` bagian *Success*).

Migration yang harus sudah diterapkan di environment tujuan sebelum endpoint
baru dipakai (`docs/GAP_API_MOBILE_IMPLEMENTATION.md`, bagian *Migration*):
`20260917120000_mobile_device_registrations`,
`20260918100000_payroll_unlock_sessions`,
`20260918110000_push_notification_deliveries`,
`20260918120000_mobile_permission_matrix`,
`20260920090000_password_reset_tokens`,
`20260920093000_auth_session_version`.

## 15. Riwayat cuti bisa memuat cuti yang tidak diajukan karyawan (perilaku)

**Yang berubah.** Cuti bersama (*collective leave*) diwujudkan sebagai
`LeaveRequest` berstatus **`APPROVED`** untuk setiap karyawan terdampak, dengan
field `collectiveLeaveId` yang menunjuk deklarasinya dan alasan
`Cuti bersama: <nama>`. Saldo cuti tahunan dipotong; karyawan yang saldonya
tidak cukup jatuh ke **unpaid**, **tidak pernah minus**.

**Bukti.** `docs/collective-leave.md`, bagian *Diwujudkan sebagai cuti, bukan
penanda kalender*: "Setiap karyawan yang terdampak mendapat satu `LeaveRequest`
berstatus **APPROVED** untuk hari itu, dengan `collectiveLeaveId` yang menunjuk
deklarasinya… **karyawan** melihatnya di riwayat cutinya sendiri, dengan alasan
yang jelas (`Cuti bersama: <nama>`)". Keputusan dan batasannya di paragraf
pembuka dokumen yang sama (GAP-08, 30 September 2026) dan commit
`54cd896 feat(leave): cuti bersama — deduct balance, fall to unpaid, never
below zero (GAP-08)`.

**Dampak untuk klien mobile.**

- Daftar `GET /leave` / riwayat cuti akan memuat baris yang **tidak dibuat oleh
  user**, langsung `APPROVED`. UI yang mengasumsikan "setiap cuti di daftar saya
  pernah saya ajukan" perlu disesuaikan.
- Jangan menawarkan **cancel** untuk baris cuti bersama. Dokumen menyatakan
  pembalikan hari yang sudah diterapkan "sengaja belum ada"; `DELETE` hanya
  menerima deklarasi yang belum diterapkan.
- Saldo di `GET /leave/balances/employee` bisa turun tanpa aksi user. Jangan
  cache saldo lintas sesi.
- `collectiveLeaveId` adalah field **tambahan** pada record cuti → additive;
  yang berubah adalah **isi daftar**, bukan bentuknya.

## 16. Bagian gaji pada profil pegawai bisa menjadi array kosong (perilaku)

**Yang berubah.** List/detail salary dan THR mengikuti scope payroll di level
query database. **Bagian gaji pada profil employee menjadi array kosong** bila
permission/scope payroll tidak mengizinkan. UUID/tanggal invalid ditolak, dan
endpoint baca salary/THR memakai `no-store`.

**Bukti.** `docs/checklist-implementation-status.md`, *Dampak API dan
kompatibilitas*: "List/detail salary dan THR kini mengikuti scope payroll di
query database. Bagian gaji pada profil employee menjadi array kosong jika
permission/scope payroll tidak mengizinkan. UUID/tanggal yang invalid ditolak
dan endpoint baca salary/THR memakai no-store; matriks lengkap ada di
`docs/payroll-salary-read-access.md`."

**Dampak.** Untuk user mobile biasa, bagian gaji di layar profil akan **kosong**,
bukan `403`, bukan `null`. UI harus menampilkan state kosong yang masuk akal,
dan **tidak** mengartikannya sebagai "gaji Rp 0". Jenis perubahan: **perilaku** —
nama dan tipe field tidak berubah, hanya isinya.

Catatan terkait, masih dari *Dampak API dan kompatibilitas*: seluruh respons
EWA, payslip, run/period, payment batch, dan baca salary/THR memakai `no-store`,
termasuk pada respons error. Jangan menyimpan hasilnya di HTTP cache atau cache
disk klien.

## 17. SSO OIDC per company: web-only, bukan jalur login mobile (additive)

**Yang berubah.** Ada jalur login baru: single sign-on OIDC per perusahaan
(commit `d407bed feat(auth): single sign-on per company, OIDC (GAP-37)`).

**Mengapa penting untuk tim mobile.** Alurnya **berbasis redirect browser dan
cookie**, bukan Bearer:

```
GET /api/v1/auth/sso/start?company=<kode perusahaan>&returnTo=/leave
    → 302 ke penyedia (response_type=code, PKCE S256, state, nonce)
penyedia → GET /api/v1/auth/sso/callback?state=...&code=...
    → 302 ke aplikasi web, dengan cookie sesi sudah terpasang
```

**Bukti.** `docs/sso-oidc.md`, bagian *Alur login*: "Sesi yang dihasilkan
**identik** dengan hasil login kata sandi: cookie `at`/`rt` httpOnly yang sama,
token CSRF yang sama, dicetak oleh helper yang sama." Dan: "Kegagalan tidak
mengembalikan JSON, karena URL ini dibuka penyedia di browser pengguna: ia
mendarat di halaman login dengan `?sso=failed` atau `?sso=denied`."

**Yang harus dilakukan klien mobile.** **Tidak ada**, selain tidak membangun
tombol SSO. Dua endpoint di atas tidak mengembalikan JSON dan tidak mengembalikan
token di body, jadi `X-Client-Type: mobile` tidak mengubah apa pun di sini.
Login mobile tetap `POST /auth/login`. Bila kelak tenant menuntut SSO di mobile,
itu **kontrak baru** yang harus diminta ke tim backend — jangan mencoba
membungkus alur redirect di WebView lalu memanen cookie: mode cookie menuntut
CSRF double-submit dan tidak dirancang untuk klien native (§4).

## 18. Catatan operasional yang perlu ditangani klien

| Hal | Perilaku | Bukti |
|---|---|---|
| Health check | `/health` dan `/health/ready` dapat menjawab **`503`** ketika database tidak tersedia; `/health/live` terpisah | `docs/checklist-implementation-status.md`, *Dampak API dan kompatibilitas* + tabel *Hasil implementasi* baris *Readiness* |
| Refresh token | **dirotasi setiap kali**; memakai ulang token lama **me-revoke seluruh sesi** (deteksi replay) | `docs/mobile-api.md` §2.2; `docs/api-mobile-integration.md` langkah 3 |
| Logout | tidak butuh access token yang masih hidup; seluruh keluarga refresh token sesi itu dicabut | `docs/mobile-api.md` §2.3 |
| Rate limit login | 10 gagal / 15 menit per IP **dan** per email; 5 gagal → akun terkunci 15 menit | `docs/mobile-api.md` §7 |
| Forgot password | 5 request / IP / 15 menit dan satu email / user / menit; `202` selalu (anti-enumeration) | `docs/mobile-api.md` §2.4, §7 |
| MFA | login pertama dapat `401` dengan kode `MFA_REQUIRED` → ulangi login dengan field `totp` | `docs/api-mobile-integration.md` bagian *MFA*; `docs/mobile-api.md` §2.1 |
| Nilai uang | Decimal **harus** diperlakukan sebagai decimal string, bukan floating-point | `docs/mobile-api.md` §4.6 |
| Production masih HTTP | token bisa disadap; HTTPS + certificate pinning wajib sebelum rilis publik | `docs/mobile-api.md` §7; `docs/mobile-staging-acceptance.md` §4 |
| Sumber kebenaran route | `GET /api/v1/meta/endpoints` (butuh `rbac:read`) dan `GET /api/v1/meta/openapi.json`; daftar ter-generate ada di `docs/api-reference.md` | `docs/mobile-api.md` §6; `docs/api-contract.md` bagian *Machine-readable description* dan *Referensi endpoint untuk dibagikan* |

Dokumen mana yang dipercaya: `docs/api-contract.md` menyatakan tiga dokumen
mobile yang lebih tua (`mobile-api.md`, `mobile-api-documentation.md`,
`mobile-api-screen-mapping.md`) "terakhir disentuh 8–21 September — jadi untuk
daftar endpoint, rujuk `api-reference.md`, bukan ketiganya".
`docs/mobile-api.md` sendiri menyatakan ia **menggantikan**
`mobile-api-documentation.md`. Urutan kepercayaan yang disarankan:
`GET /meta/endpoints` (runtime) → `docs/api-reference.md` (ter-generate) →
`docs/mobile-api.md` (kontrak per layar) → sisanya sebagai konteks.

## Capability yang sengaja TIDAK ada di rilis awal

Supaya tidak dikira endpoint-nya hilang: chat/messaging, Training/LMS,
Performance, onboarding/offboarding, pengelolaan MFA, daftar/revoke sesi, dan
delete notifikasi **di luar scope rilis mobile awal**. Klien harus menampilkan
state "belum tersedia" dan **tidak boleh** membuat data contoh atau menebak
endpoint (`docs/mobile-api.md` §1, *Scope rilis mobile awal*;
`docs/GAP_API_MOBILE_IMPLEMENTATION.md`, *Tetap memerlukan keputusan/konfigurasi
eksternal*).

## Checklist

### BREAKING — kerjakan dulu

- [ ] **Ganti parser respons jadi satu envelope bersama.** Hapus parser khusus
      untuk EWA, daily-activity, employee, dan company-settings. Verifikasi:
      panggil satu endpoint dari masing-masing keempat modul dan pastikan
      semuanya berhasil di-decode oleh satu tipe `ApiResponse<T>`
      (`{ success, message, data, meta? }`). (§1)
- [ ] **Hapus pembacaan `code` dari respons sukses company-settings.** Jadikan
      field itu tidak ada, bukan optional. Verifikasi: decode respons
      `GET company-settings` dengan model yang **tidak** punya `code` dan
      pastikan tidak ada error; grep kode klien untuk `"OK"` dan pastikan nol
      hasil pada jalur sukses. (§2)
- [ ] **Cabang error hanya berdasarkan `code`, bukan `message` atau status
      saja.** Implementasikan peta 10 kode dari tabel §1 plus `INTERNAL_ERROR`.
      Verifikasi: paksa satu `422` (payload kosong) dan satu `404` (UUID acak)
      dan pastikan aplikasi memilih cabang dari `code`. (§1)
- [ ] **Kirim `X-Client-Type: mobile` pada `POST /auth/login` dan
      `POST /auth/refresh`, lalu ambil token dari `data.tokens`.** Verifikasi:
      login tanpa header → tidak ada `data.tokens` di body (server memakai mode
      cookie); dengan header → `accessToken`, `refreshToken`, `expiresIn` ada. (§4)
- [ ] **Matikan cookie jar pada HTTP client.** Verifikasi: inspeksi request
      kedua setelah login — tidak boleh ada header `Cookie` berisi `at`/`rt`.
      Bila ada, mutasi akan ditolak CSRF. (§4)
- [ ] **Hapus semua `employeeId`/`companyId` dari body dan query pada endpoint
      self-service.** Verifikasi: grep kode klien untuk `employeeId=` dan
      `"employeeId":` pada pemanggilan `/me`, `/my`, create loan/EWA/
      daily-activity/trip/claim — harus nol. Lalu jalankan pengajuan loan dan
      cek record yang dibuat terikat ke employee pemilik token. (§5)
- [ ] **Berhenti memakai nilai field sensitif sebagai data.** NIK/NPWP/
      rekening/BPJS hanya untuk ditampilkan, dan disembunyikan bila
      `permissions` dari `GET /auth/me` tidak memuat `employee:read-sensitive`.
      Verifikasi: login sebagai employee biasa, buka layar profil, pastikan
      tidak ada validasi format yang gagal dan tidak ada nilai mask yang
      dikirim balik pada request update. (§6)
- [ ] **Implementasikan alur unlock payslip.** Daftar dari
      `GET /payroll/payslips` (tanpa nominal) → `POST /payroll/payslips/unlock`
      (`password` + `totp` bila MFA aktif) → simpan `data.unlockToken` **di
      memori** → kirim `X-Payroll-Unlock-Token` pada `GET /payroll/payslips/:id`
      dan `/pdf`. Verifikasi: panggil detail **tanpa** header → gagal; dengan
      header → berhasil; tunggu >5 menit → gagal lagi. (§7)
- [ ] **Tangani lockout unlock payslip tanpa melogout user.** Lima kegagalan /
      15 menit → `429` selama 15 menit, sementara sesi login tetap hidup.
      Verifikasi: lima unlock dengan password salah, lalu pastikan endpoint lain
      (`GET /auth/me`) masih `200`. (§7)
- [ ] **Buang semua field biometrik turunan dari payload check-in.** Kirim
      **hanya** `faceRecognition.selfieImage`. Verifikasi: grep klien untuk
      `similarityScore`, `isFaceMatch`, `faceVector`, `embedding` pada payload
      absensi — harus nol; lalu kirim satu payload yang sengaja memuat
      `isFaceMatch` dan pastikan server menjawab `400` (membuktikan pagar aktif). (§8)
- [ ] **Kirim `deviceGps` pada check-out juga, dan tangani `400` fake-GPS di
      kedua jalur.** Verifikasi: dengan mock location aktif, check-in **dan**
      check-out keduanya `400` dan tidak ada baris absensi/jam keluar baru. (§8)
- [ ] **Hapus antrean punch offline; arahkan punch yang gagal ke koreksi
      absensi.** Verifikasi: matikan jaringan, lakukan check-in, nyalakan
      jaringan — aplikasi tidak boleh mengirim punch dengan timestamp lama, dan
      harus menawarkan `POST /attendance-corrections`. (§9)
- [ ] **Satu `Idempotency-Key` per percobaan pengiriman satu form, dibuat ulang
      hanya saat isian berubah.** Verifikasi: kirim form yang sama dua kali
      dengan key sama → respons identik + header `Idempotency-Replayed: true`,
      satu baris di server; lalu ubah satu field dan kirim dengan key yang sama
      → `409`. (§10)
- [ ] **Hentikan pemakaian URL `/uploads/*` dan URL dari `filePath` lama.**
      Unduh lewat endpoint ber-ID dengan header `Authorization`, dan referensikan
      lampiran klaim hanya dengan `filePath` hasil
      `POST /travel-expenses/claims/receipt-upload`. Verifikasi: grep klien untuk
      `/uploads/` — harus nol; lalu buat satu klaim dengan lampiran dan buka
      kembali lampirannya dari daftar klaim. (§11)
- [ ] **Jangan merender file privat lewat komponen yang tidak mengirim header
      auth.** Verifikasi: tampilkan satu dokumen employee di UI dan pastikan
      request-nya membawa `Authorization` (signed URL kini tetap menuntut sesi). (§11)
- [ ] **Pastikan ekstensi, MIME, dan isi file upload konsisten.** Verifikasi:
      unggah JPEG yang di-rename `.pdf` dan pastikan server menolaknya —
      lalu pastikan aplikasi menampilkan pesan yang bisa dipahami user, bukan
      crash. (§11)
- [ ] **Wajibkan alasan pada aksi Reject di Approval Center.** Verifikasi: kirim
      `{ "action": "REJECT" }` tanpa `comment` → gagal (`422`/`400`); dengan
      `comment` → berhasil. (§12)

### Perilaku — harus ditangani, bentuk payload tidak berubah

- [ ] **Implementasikan 401 → satu kali refresh → satu kali retry, dengan
      antrean request paralel.** Verifikasi: jalankan tiga request bersamaan
      setelah memaksa `sessionVersion` naik (minta HR mengubah role akun uji) —
      hanya **satu** `POST /auth/refresh` boleh terkirim dan ketiga request
      harus berhasil setelahnya. (§3)
- [ ] **Muat ulang `roles`/`permissions` dan bangun ulang menu/guard setelah
      refresh.** Jangan memakai cache permission lama. Verifikasi: cabut satu
      permission akun uji, picu satu request, dan pastikan menu terkait hilang
      tanpa perlu logout. (§3)
- [ ] **Jangan pernah mengirim refresh token yang sudah dipakai.** Simpan hasil
      rotasi secara atomik. Verifikasi: dua refresh paralel dengan token sama
      harus tidak mungkin terjadi di kode; bila terjadi, seluruh sesi tercabut. (§3, §18)
- [ ] **Terima baris cuti berstatus `APPROVED` yang tidak diajukan user (cuti
      bersama) dan sembunyikan tombol cancel untuk baris ber-`collectiveLeaveId`.**
      Verifikasi: minta HR menerapkan satu deklarasi cuti bersama di environment
      uji, lalu buka riwayat cuti akun uji. (§15)
- [ ] **Jangan cache saldo cuti lintas sesi.** Ambil ulang
      `GET /leave/balances/employee` saat dashboard dibuka. (§15)
- [ ] **Tampilkan state kosong yang benar untuk bagian gaji di profil.** Array
      kosong berarti "tidak berhak melihat", bukan "Rp 0". Verifikasi: buka
      profil sebagai employee biasa. (§16)
- [ ] **Pakai `serverTime`/`serverDate`/`timezone` dari
      `GET /attendance/me/today` untuk seluruh tampilan tanggal absensi.**
      Verifikasi: ubah timezone perangkat, lakukan check-in di sekitar tengah
      malam, dan pastikan tanggal yang ditampilkan mengikuti timezone kantor. (§9)
- [ ] **Tangani `503` dari `/health` dan `/health/ready` sebagai "server belum
      siap", bukan error autentikasi.** (§18)
- [ ] **Tangani `MFA_REQUIRED` pada `401` login dengan meminta `totp`, bukan
      dengan menampilkan "password salah".** (§18)
- [ ] **Perlakukan semua nilai uang sebagai decimal string.** Verifikasi: grep
      klien untuk parsing `double`/`Number()` pada field uang. (§18)
- [ ] **Jangan simpan respons EWA/payslip/salary di cache disk** — semuanya
      `no-store`. (§16)

### Additive — manfaatkan, tidak merusak apa pun

- [ ] **Hapus workaround untuk `GET /attendance/overtime` dan
      `GET /leave/balances/employee`;** keduanya sekarang dapat dicapai. (§13)
- [ ] **Pakai `GET /attendance/me/today` sebagai sumber policy absensi**
      (metode yang diizinkan, wajib GPS/selfie, `canCheckIn`, `canCheckOut`)
      daripada menebak di klien. (§14)
- [ ] **Pasang pagination standar** (`page`, `limit`, `hasNextPage`) pada
      notifikasi, antrean approval, dan riwayat absensi; `limit` maksimum 100
      untuk riwayat absensi. (§14)
- [ ] **Register/unregister push token** lewat
      `POST`/`DELETE /notifications/device-tokens` dengan `installationId` yang
      stabil per instalasi; unregister saat logout. Token provider tidak pernah
      dikembalikan API lagi, jadi simpan sendiri bila perlu rotasi. (§14)
- [ ] **Tambahkan layar announcement** (`GET /announcements`,
      `/unread-count`, `/:id`, `PUT /:id/read`) dan tangani `404` untuk ID di
      luar audience sebagai "tidak tersedia", bukan error. (§14)
- [ ] **Tambahkan reporting line, next-shift, shift-swap, dan inbox aset**
      sesuai §14. (§14)
- [ ] **Tambahkan alur forgot/reset password.** `POST /auth/forgot-password`
      selalu `202` — jangan menyimpulkan apakah email terdaftar. (§14)
- [ ] **Arahkan aksi approval ke `POST /workflow-engine/instances/:id/actions`**
      dan jangan mencampur jalur domain untuk satu aksi; refresh queue setelah
      sukses, dan tangani sukses parsial pada bulk-approve. (§12)
- [ ] **Tampilkan state "belum tersedia"** untuk chat, Training/LMS,
      Performance, onboarding/offboarding, pengelolaan MFA, daftar sesi, dan
      delete notifikasi — jangan menebak endpoint. (lihat bagian *Capability
      yang sengaja TIDAK ada*)

### Verifikasi akhir

- [ ] **Jalankan smoke runner mobile** terhadap target staging:
      `node scripts/mobile-api-smoke.mjs` dengan `MOBILE_API_BASE_URL` HTTPS.
      Gate dianggap lulus hanya bila `0 failed, 0 blocked`
      (`docs/mobile-staging-acceptance.md` §2 dan §5).
- [ ] **Rekam tabel acceptance perangkat manual** (geofence, fake GPS, liveness,
      idempotent retry, changed replay, tenant isolation, timezone boundary,
      push delivery, invalid push token, payroll locked/unlock/lockout) —
      `docs/mobile-staging-acceptance.md` §3.
- [ ] **Pastikan base URL publik sudah HTTPS** sebelum rilis; smoke runner
      sengaja menolak target HTTP non-localhost
      (`docs/mobile-staging-acceptance.md` §4).
- [ ] **Bandingkan daftar route aplikasi dengan `GET /api/v1/meta/endpoints`**
      (atau `docs/api-reference.md`) sebagai pemeriksaan terakhir terhadap
      route yang hilang atau berubah nama. (§18)

## Belum terverifikasi

Dokumen ini **tidak eksahustif**. Hal-hal berikut dicurigai berubah atau belum
dapat dipastikan dengan bukti yang bisa dirujuk:

1. **Tidak ada satu pun diff yang bisa dibaca.** Object store Git tidak dapat
   dibuka pada mesin ini: `.git/objects/pack/*.pack` dan `*.idx` berukuran > 0
   menurut metadata tetapi menghasilkan 0 byte saat dibaca (salinannya kosong,
   dan `git` berhenti dengan SIGBUS), sementara `.git/HEAD` dan
   `.git/refs/heads/main` berisi NUL sehingga `git` menolak mengenali
   repository. Akibatnya **tidak ada** `git show`/`git diff`/`git log --follow`
   di balik dokumen ini. Satu-satunya keluaran Git yang berhasil adalah
   `git log --oneline -60` di awal sesi; SHA yang dikutip berasal dari sana dan
   **hanya** membuktikan subject commit, bukan isi perubahannya.
2. **Sebagian besar `backend/src/**` juga tidak dapat dibaca** dengan gejala
   yang sama (ukuran > 0, isi terbaca 0 byte), termasuk
   `backend/src/shared/core/Result.ts`,
   `backend/src/shared/middleware/Authenticate.ts`,
   `backend/src/shared/security/session-revocation.ts`, dan
   `backend/src/modules/mobile-routes.contract.test.ts`. Karena itu **tidak ada
   kutipan `file:line` dari kode sumber**. `backend/src/shared/core/api-contract.test.ts`
   sempat terbaca utuh satu kali di awal sesi — isi test yang dirujuk di §1 dan
   §2 berasal dari bacaan itu, tetapi tidak dapat dibaca ulang untuk memberi
   nomor baris.
3. **Perilaku persis `sessionVersion` belum dibaca dari kode.** Dokumen
   menyatakan token lama "mati di request berikutnya", tetapi **kode error yang
   dikembalikan belum dipastikan**: apakah `401 TOKEN_EXPIRED` (yang menurut
   `docs/api-contract.md` berarti "refresh lalu retry") atau
   `401 AUTHENTICATION_FAILED` (yang berarti "autentikasi ulang"). Perbedaan ini
   menentukan apakah klien harus refresh atau langsung melogout user.
   **Pastikan dengan percobaan nyata** sebelum mengunci logika retry.
4. **Bentuk persis mask field sensitif tidak terdokumentasi** — karakter mask,
   jumlah karakter yang ditampilkan, dan apakah separator (titik/strip pada
   NPWP) dipertahankan. Contoh di §6 adalah ilustrasi, bukan string yang
   dijamin.
5. **Nasib field identitas asing di payload belum pasti.** Dokumen menyatakan
   `employeeId`/`companyId` dari klien "tidak diterima", tetapi tidak menyatakan
   apakah request-nya ditolak (`403`/`422`) atau field-nya diabaikan. Dua
   kemungkinan itu menuntut penanganan klien yang berbeda.
6. **Daftar `/my` yang "mengembalikan array langsung".** `docs/mobile-api.md`
   menegaskan untuk loan, EWA, daily-activity, dan trip/claim bahwa `data`
   adalah array langsung, "bukan `data.items`". Penegasan itu **mengesankan**
   bentuk lama pernah `data.items`, tetapi tidak ada dokumen yang menyatakan
   perubahan tersebut — jadi tidak dimasukkan sebagai perubahan BREAKING.
   Periksa terhadap server yang berjalan.
7. **Daftar `/my` yang belum paginated.** `GET /daily-activities/my`,
   `GET /travel-expenses/trips/my`, dan `/claims/my` dinyatakan **belum**
   paginated. Apakah pagination akan ditambahkan (dan dengan itu mengubah
   `data` dari array menjadi array + `meta`) belum diputuskan di dokumen mana
   pun. Ini risiko BREAKING di masa depan.
8. **Permission self-service yang masih janggal.** `docs/mobile-api.md` sendiri
   menandai dua kandidat perbaikan: `POST /ewa` menuntut `ewa:create` dan
   sebagian endpoint cuti menuntut `leave:read/create`, sehingga employee biasa
   bisa mendapat `403` untuk data miliknya sendiri (§4.3 dan §4.7, keduanya
   berlabel "kandidat perbaikan"). Perilaku final bisa berubah; uji dengan akun
   employee nyata.
9. **Commit yang tidak dapat dinilai dampaknya ke mobile.** Dari
   `git log --oneline -60`, berikut menyentuh area yang mungkin terlihat klien,
   tetapi isi perubahannya tidak dapat dibaca:
   `a4b33a3 feat(organization): make a new company usable the moment it is
   created`, `70965d5 fix(work-calendar): derive a holiday's year from its
   date`, `9b2b999 fix(work-calendar): generating a year must not erase its
   holidays`, `56a5b0b feat(announcement): the write side…`,
   `3a88a5c feat(performance): goal hierarchy…`,
   `07cf60a feat(recruitment): headcount requisition…`,
   `d407bed feat(auth): single sign-on per company, OIDC (GAP-37)`,
   `516a671 feat(webhook): outbound events for external systems (GAP-38)`.
   Dua fix work-calendar berpotensi mengubah **nilai** hari libur yang dibaca
   `GET /work-calendars/holidays/list` dan kalender ter-resolve, tetapi arah
   perubahannya tidak dapat dipastikan — periksa ulang data hari libur tahun
   berjalan di environment uji. (SSO OIDC sudah diperiksa dan dicatat di §17;
   webhook adalah integrasi outbound ke sistem eksternal, bukan permukaan klien
   mobile — lihat `docs/webhooks.md`.)
10. **Isi `backend/src/modules/mobile-routes.contract.test.ts` tidak dapat
    dibaca**, padahal itulah yang memaku daftar route mobile. Bila daftar route
    di §14 perlu dipastikan, baca file tersebut di mesin lain atau pakai
    `GET /api/v1/meta/endpoints`.
11. **Tidak ada verifikasi eksekusi apa pun.** `tsc`, `jest`, dan `eslint` tidak
    dijalankan (dependency rusak di mesin ini), jadi tidak ada satu pun klaim di
    dokumen ini yang didukung test yang benar-benar dijalankan ulang. Angka
    test yang disebut berasal dari catatan di `docs/*.md`.

