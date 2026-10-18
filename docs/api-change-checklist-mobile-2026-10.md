# Checklist Migrasi API Mobile — Oktober 2026

Lanjutan dari [`api-change-checklist-mobile.md`](api-change-checklist-mobile.md),
yang jendelanya berhenti di **30 September 2026**. Dokumen ini menutup celah itu.

Kontrak dasar (base URL, envelope, mode Bearer, payload capture absensi) tetap
seperti di [`mobile-api.md`](mobile-api.md) — yang berubah hanya yang ditulis di sini.

## Jendela yang diperiksa

| | |
|---|---|
| Dari | `58aa2f4` — 30 Sep 2026 (*Merge PR #33, fix/bullmq-key-prefix*) |
| Sampai | `30d9f37` — 18 Okt 2026 (HEAD `fix/prod-infra`) |
| Jumlah commit | 89 (tanpa merge) |
| Endpoint dihapus | **0** — tidak ada yang hilang, semua perubahan bersifat tambah atau perketat |

---

## 1. WAJIB ditangani (breaking)

### 1.1 403 `PASSWORD_CHANGE_REQUIRED` pada akun berpassword awal

Dipaksa di server sejak `39de8bf`, bukan lagi kepercayaan pada klien.
`backend/src/shared/middleware/Authenticate.ts:72`.

Akun dengan `mustChangePassword: true` (password dari admin/seed) **login tetap
berhasil**, tapi setiap request lain dijawab:

```json
{ "success": false, "code": "PASSWORD_CHANGE_REQUIRED",
  "message": "Password awal harus diganti sebelum memakai aplikasi (POST /auth/change-password)" }
```

Hanya rute ini yang lolos: `/auth/change-password`, `/auth/logout`, `/auth/me`,
`/auth/refresh`, `/auth/csrf`.

**Aksi mobile:** baca `data.user.mustChangePassword` dari respons login (field ini
sudah ada sejak dulu, sekarang wajib dipakai) → paksa layar ganti password sebelum
masuk home. Tambahan: interceptor harus kenal `403 PASSWORD_CHANGE_REQUIRED` dan
mengarahkan ke layar yang sama, bukan ke layar error generik atau logout.

### 1.2 Satu periode gaji bisa punya lebih dari satu payslip

Sejak `e67d9a9` kunci unik payroll run berubah dari *satu run per periode* menjadi
*satu run per periode per jenis*. Jenisnya: `REGULAR`, `THR`, `SEVERANCE`,
`CORRECTION` (enum `PayrollRunType`).

Artinya `GET /payroll/payslips/my` untuk bulan yang sama bisa mengembalikan 2–3
baris: gaji reguler, THR, dan/atau koreksi.

**Aksi mobile:** hapus asumsi "satu slip per bulan". Jangan kunci list pada
`period.code` sebagai key unik — pakai `payslip.id`.

**Catatan untuk backend (bukan mobile):** `runType` sengaja **tidak** diekspos di
shape payslip self-service (`backend/src/modules/payroll/payroll.repository.ts:15`,
komentar `payslipRunSelect`). Jadi mobile belum punya cara bersih membedakan slip
THR dari slip reguler selain membaca `payrollRun.name` / `runNumber`. Kalau UI
mobile perlu label jenis slip, minta backend menambah `runType` ke
`payslipRunSelect` — keputusan ini dicatat sebagai "Fase 1" dan memang menunggu
kebutuhan klien.

### 1.3 Nomor karyawan & kode aset tidak lagi unik global

`487021e` mengubah `employeeNumber`, `assetCode`, dan `leaveType.code` dari unik
global menjadi **unik per tenant** (`@@unique([companyId, …])`).

**Aksi mobile:** jangan pakai `employeeNumber` sebagai identitas global (cache key,
dedup, deep link). Pakai `employee.id`. Perilaku error duplikat sekarang hanya
berlaku dalam satu company.

### 1.4 Rute admin aset pindah resource permission

`e5f6095` mengganti guard semua rute `/assets` admin dari `employee:*` menjadi
`asset:*` (`read`/`create`/`update`/`delete`).

- `GET /assets/my` (self-service) **tidak berubah** — tetap tanpa permission.
- Kalau app mobile punya fitur admin aset, token yang dulu cukup sekarang kena 403
  sampai role-nya diberi permission `asset`.
- `mobile-api.md` §4.17 yang berbunyi *"Route admin `/assets` tetap memerlukan
  permission employee yang sesuai"* sekarang **salah** dan perlu diperbarui.

### 1.5 Perketatan guard lain (cek kalau app menyentuhnya)

| Endpoint | Perubahan | Commit |
|---|---|---|
| `GET /reports/summary` | dulu tanpa guard, sekarang butuh `report:read` | `2c10c3c` |
| `POST /leave/balances`, `POST /leave/balances/accrue` | permission `leave:create` → `leave:update`; `/accrue` kini memvalidasi body | `cce5e8a` |
| `POST /assets/:id/return` | body kini divalidasi (400 kalau tak sesuai skema) | `cce5e8a` |
| `/permission-requests/:id/approve\|reject` | tidak boleh diselesaikan di luar rantai approval yang dikonfigurasi (409/403, bukan 200) | `5f2be50` |

### 1.6 Format tanggal dipin ke `YYYY-MM-DD`

Tanggal izin (`startDate`, `endDate` pada `POST /permission-requests`) dan
`shiftDate` pada tukar shift dulu `z.string()` tanpa format. Sekarang kontrak
resminya **`YYYY-MM-DD`** (`backend/src/shared/validators/calendar-date.ts`).

ISO instant masih diterima sebagai jalur kompatibilitas untuk web lama dan
dinormalkan ke hari yang dimaksud, tapi jangan dipakai dari mobile. Tanggal
yang tidak valid dijawab `422 VALIDATION_ERROR` — "Tanggal harus YYYY-MM-DD".

Satuan `duration` pada izin: **hari**, pecahan diizinkan (`0.5` = setengah hari).

---

## 2. Field baru pada response lama (aditif — aman, tapi berguna)

Parser mobile harus **toleran terhadap field tak dikenal** dan **nilai enum tak
dikenal** (jangan crash; fallback ke "lainnya").

| Model / endpoint | Field baru | Catatan |
|---|---|---|
| Saldo cuti (`GET /leave/balances/employee`) | `carryOverDays`, `carryOverExpiredAt` | sisa cuti bawaan tahun lalu + tanggal hangusnya; layar saldo cuti sebaiknya menampilkan ini |
| `EmployeeSalary` | `payBasis`: `MONTHLY` \| `DAILY` | dasar upah harian (`a94d8c2`) |
| `SalaryComponent` | `isFixedAllowance: boolean` | memisahkan tunjangan tetap vs tidak tetap (`887024f`) |
| `PayrollRun` (endpoint admin) | `runType` | lihat §1.2 |

**Enum baru yang mungkin muncul:** `PayrollRunType`, `PayrollCorrectionStatus`,
`SeverancePaymentStatus`, `TimesheetStatus`, `HrTicketStatus`, `HrTicketPriority`,
`CustomFieldEntity`, `TerCategory`.

**Enum dihapus:** `AssetConditionRating` (fitur patrol aset dibuang). Field
`conditionAtAssign` / `conditionAtReturn` di aset **tidak berubah** — tetap string
bebas, bukan enum.

---

## 3. Endpoint baru yang layak masuk app (self-service)

Semua butuh Bearer + company aktif. Prefix: `/api/v1`.

### 3.1 HR Helpdesk — `/helpdesk` (`5cc2cbc`)

| Method | Path | Body |
|---|---|---|
| POST | `/helpdesk/my` | `{ category, subject, description, priority? }` — `priority`: `LOW\|MEDIUM\|HIGH` |
| GET | `/helpdesk/my` | — |
| POST | `/helpdesk/my/:id/comments` | `{ body }` (1–5000 char) |
| POST | `/helpdesk/my/:id/close` | — |

Rute `/helpdesk/queue`, `/helpdesk/:id`, `PATCH /helpdesk/:id` khusus agent HR
(`helpdesk:read` / `helpdesk:update`).

### 3.2 Feed & Kudos — `/engagement` (`1289b27`)

| Method | Path | Body / Query |
|---|---|---|
| GET | `/engagement/posts` | `?before=<ISO8601>&limit=20` (maks 100) |
| POST | `/engagement/posts` | `{ content }` (1–2000 char) |
| DELETE | `/engagement/posts/:id` | hanya post sendiri |
| GET | `/engagement/kudos` | `?employeeId=&limit=20` |
| POST | `/engagement/kudos` | `{ toEmployeeId, badge, message }` |

`DELETE /engagement/posts/:id/moderate` butuh `announcement:approve`.

### 3.3 Timesheet per proyek — `/timesheets` (`1a7a7db`)

| Method | Path | Body / Query |
|---|---|---|
| GET | `/timesheets/projects` | semua user terautentikasi |
| POST | `/timesheets/entries` | `{ projectId, date: YYYY-MM-DD, hours, notes? }` — `hours` kelipatan 0.25, 0.25–24 |
| GET | `/timesheets/entries/my` | `?from=YYYY-MM-DD&to=YYYY-MM-DD` |
| PATCH | `/timesheets/entries/:id` | `{ hours?, notes? }` — hanya milik sendiri |
| DELETE | `/timesheets/entries/:id` | hanya milik sendiri |

Approve/reject (`POST /timesheets/entries/:id/approve|reject`), list semua, dan
report hanya untuk approver.

### 3.4 Halaman karier publik — `/careers` (`34dda66`, tanpa auth)

`GET /careers/:companyCode/postings`, `GET /careers/:companyCode/postings/:postingCode`,
`POST /careers/:companyCode/postings/:postingCode/apply`. Hanya hidup untuk tenant
yang menyalakannya; punya rate limit sendiri. Berguna kalau app punya mode
"lowongan" tanpa login.

### Konvensi pagination berbeda

Helpdesk dan timesheet (rute approver) memakai **cursor**: `?limit=&cursor=<uuid>`,
bukan `page`/`limit` seperti modul lama. Jangan paksakan satu model pagination.

---

## 4. Endpoint baru admin-only (tidak perlu dikerjakan mobile)

Payroll: `GET/POST /payroll/corrections`, `POST /payroll/corrections/:id/cancel`,
`GET/POST /payroll/severance-payments`, `POST /payroll/severance-payments/:id/cancel`,
`GET /payroll/bukti-potong-1721-a1/:employeeId`, `GET /payroll/bukti-potong-1721-viii`,
`GET /payroll/bukti-potong-1721-vii/:severancePaymentId`, `GET /payroll/runs/:id/journal`,
`GET /payroll/sipp-wage-export`, `POST /payroll/salaries/import`,
`GET /payroll/salary-components/deleted`, `POST /payroll/salary-components/:id/restore`,
`POST /payroll/payments/:id/disburse-api`.

Lain-lain: `POST /attendance/import`, `POST /leave/balances/import`,
`POST /employees/contracts/:id/probation-decision`, `GET /company-settings/catalog`,
`POST /organization/companies/:id/bootstrap`, `GET /reports/leave-balance`,
`GET /training/effectiveness`, `GET|PUT /travel-expenses/claim-limits`,
`/letters/*` (template surat), `/custom-fields/*`, `/assets/categories*`,
`/assets/outstanding/:employeeId`, `/assets/:id/transfer`.

> Catatan: nilai custom field karyawan (`GET /custom-fields/employees/:id/values`)
> butuh permission `employee:read` — **belum ada rute self-service**. Kalau app
> mau menampilkan custom field milik user sendiri, itu permintaan baru ke backend.

---

## 5. Header

| Header | Status | Fungsi |
|---|---|---|
| `X-Client-Type: mobile` | tetap wajib | menukar respons auth ke token di body, bukan cookie |
| `X-Payslip-Unlock` | tetap | token unlock slip gaji (15 menit) dari `POST /payroll/payslips/my/unlock` |
| `Idempotency-Key` | tetap | request mutasi yang boleh di-retry |
| `X-Request-Id`, `X-Correlation-Id` | **baru diizinkan** (`3feeecf`) | dibaca ErrorHandler untuk mengorelasikan log klien ↔ server; kirim UUID per request supaya bug report bisa dilacak |

---

## Checklist

Mobile:

- [ ] Tangani `403 PASSWORD_CHANGE_REQUIRED` → layar ganti password (§1.1)
- [ ] Baca `user.mustChangePassword` pada respons login, gate masuk home (§1.1)
- [ ] List payslip: key pakai `payslip.id`, izinkan >1 slip per periode (§1.2)
- [ ] Hapus pemakaian `employeeNumber` sebagai identitas global (§1.3)
- [ ] Cek fitur admin aset di app — butuh permission `asset:*` sekarang (§1.4)
- [ ] Parser JSON/enum dibuat toleran nilai tak dikenal (§2)
- [ ] Tampilkan `carryOverDays` / `carryOverExpiredAt` di layar saldo cuti (§2)
- [ ] Kirim tanggal sebagai `YYYY-MM-DD`, bukan ISO instant (§1.6)
- [ ] Kirim `X-Request-Id` per request (§5)
- [ ] Putuskan adopsi: helpdesk, feed/kudos, timesheet (§3)
- [ ] Dukung pagination cursor untuk modul baru (§3)

Backend (kalau mobile butuh):

- [ ] Ekspos `runType` di `payslipRunSelect` supaya slip THR/koreksi bisa dilabeli (§1.2)
- [ ] Rute self-service nilai custom field milik sendiri (§4)
- [ ] Perbaiki `mobile-api.md` §4.17 soal permission aset (§1.4)
