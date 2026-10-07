# Kode unik global di model yang per-perusahaan

Audit ini lahir dari satu perbaikan: `employees.employee_number` ternyata unik
di seluruh instalasi padahal semua pemeriksaan di aplikasi sudah per perusahaan.
Pertanyaan yang wajar sesudahnya: **di mana lagi pola ini ada?**

Caranya: ambil setiap model yang punya `companyId` **dan** punya `@unique`
tingkat-field (bukan `@@unique` komposit) dari `schema.prisma`. Hasilnya 24
model. Yang di bawah ini triase-nya, bukan daftar mentahnya.

## Yang memang benar global — jangan disentuh

**Token dan hubungan satu-ke-satu.** Nilainya acak atau memang hanya boleh ada
satu baris per induk, jadi unik global adalah artinya yang tepat:

`PayrollUnlockSession.tokenHash`, `MobileDeviceRegistration.tokenHash`,
`SsoLoginAttempt.state`, `EarnedWageAccess.requestCode`,
`PayrollPaymentBatch.payrollRunId`, `PerformanceResult.assignmentId`,
`PerformanceResultAttachment.documentId`, `EmployeeFaceProfile.employeeId`,
`TrainingFeedback.enrollmentId`.

**`Employee.email`.** Ini global **dengan sengaja**, dan di sini kode dan
database sepakat: `findByEmail(email)` juga tidak discoped per perusahaan. Kalau
nanti satu orang harus bisa bekerja di dua tenant dengan email yang sama, ini
berubah jadi keputusan produk — bukan bug, dan bukan bagian audit ini.

## Pola yang sama dengan nomor karyawan

Di model-model ini, DTO-nya **menerima** `code` dari klien, lalu service-nya
**membuangnya tanpa pemberitahuan** dan memakai `generateSystemCode`:

| Model | Bukti |
|---|---|
| `Branch.code` | `organization.dto.ts:38` menerima, `branch.service.ts` generate |
| `Division.code` | `organization.dto.ts:82` menerima, `division.service.ts` generate |
| `Department.code` | `organization.dto.ts:95` menerima, `department.service.ts:22` generate |
| `SubDepartment.code` | `organization.dto.ts:107` menerima, `sub-department.service.ts` generate |
| `Position.code` | `organization.dto.ts:119` menerima, `position.service.ts` generate |
| `Asset.assetCode` | `asset.dto.ts:6` menerima, `asset.service.ts:33` generate |
| `PayrollPeriod.code` | `payroll.service.ts:191` generate |
| `SalaryComponent.code` | `payroll.service.ts:81` generate |
| `TrainingCategory.code`, `TrainingCourse.code` | `training.service.ts:13,36` generate |

DTO-nya bahkan jelas-jelas dirancang untuk nilai buatan manusia — `code:
z.string().min(2).max(50).toUpperCase().optional()`. `.toUpperCase()` tidak ada
gunanya untuk nilai yang dihasilkan mesin.

**Yang penting dibedakan:** ini **bukan** risiko tabrakan antar-tenant.
`generateSystemCode` menempelkan tanggal dan empat digit acak
(`DEPT-HR-261002-A3F1`), jadi indeks unik global praktis tidak pernah kena. Jadi
jangan diperlakukan sebagai bug data. Yang rusak adalah hal lain: **pelanggan
tidak bisa membawa kodenya sendiri**, dan permintaannya ditolak tanpa suara —
tidak ada 400, tidak ada peringatan, hanya nilai yang hilang. Perusahaan yang
departemennya sudah dipanggil `HR` dan `FIN` selama sepuluh tahun akan menemukan
sistem ini memanggilnya `DEPT-HR-261002-A3F1`.

Seed-nya sendiri memperlihatkan kode yang diharapkan manusia:
`05-test-data.seed.ts` menulis `code: 'HR'`, `'HR-MGR'`, `'HRSP'` — dan
meng-`upsert` dengan `where: { code }` **tanpa `companyId`**, pola yang sama yang
membuat seed `LeaveType` hanya pernah benar untuk satu perusahaan.

### Satu sudah diperbaiki, sembilan menyusul

Memperbaiki sepuluh model sekaligus berarti satu migrasi dan perubahan perilaku
di sepuluh endpoint — sementara **test tidak bisa dijalankan di mesin ini**
(lihat [PROGRESS.md](PROGRESS.md)). Mengubah sepuluh jalur tulis sekaligus tanpa
bisa menjalankan satu test pun bukan keberanian, itu kelalaian.

Jadi **`Asset.assetCode` dikerjakan lebih dulu sebagai pola** — paling kecil dan
paling jelas milik pelanggan. Hasilnya ada di
[PROGRESS.md](PROGRESS.md) ("nomor aset"), keputusannya di
[DECISIONS.md](DECISIONS.md) D-005, dan bentuknya:

- `@unique` tingkat-field dilepas, `@@unique([companyId, code])` ditambahkan
- migrasi mencari indeks lama **berdasarkan kolom, bukan nama**
- lookup-nya jadi `findFirst` yang discoped perusahaan dan **tidak** menyaring
  `deletedAt` (indeks unik tidak tahu soal soft delete)
- `create()` memakai kode kiriman klien kalau ada
- setiap `upsert`/`findUnique` di seed yang memakai kode itu ikut pindah ke kunci
  komposit — ini yang terlewat di tugas `employeeNumber` dan baru tertangkap CI

Sembilan sisanya menyusul dengan bentuk yang sama, di migrasi
`20261007120000_tenant_scoped_org_payroll_training_codes` — rinciannya di
[PROGRESS.md](PROGRESS.md) ("sembilan model sisanya").

Dua koreksi atas audit ini yang muncul saat mengerjakannya:

- **`SalaryComponent` sudah punya `@@unique([companyId, code])`** sejak sebelum
  ini, jadi ia tidak pernah termasuk kelas "unik global". Yang benar untuk model
  itu hanya keluhan kedua: kode kiriman klien dibuang.
- **`SubDepartment` tidak punya `companyId` di DTO-nya.** Nilainya diturunkan
  dari departemen induk di dalam `repository.create()`, jadi pemeriksaan kode
  per perusahaan harus menyelesaikan induknya lebih dulu. Model-model lain tidak
  punya langkah ini.

## `Role.code` — sempat terlihat lebih buruk, ternyata tidak

**`Role.code`.** Modelnya tidak sesederhana yang lain:

```prisma
model Role {
  companyId String?   @map("company_id")   // <- nullable
  code      String    @unique
  scope     RoleScope @default(COMPANY)
  isSystem  Boolean   @default(false)
}
```

`companyId` nullable dan ada `scope` serta `isSystem`, yang artinya role
tingkat-platform (`companyId: null`, kode seperti `HR_MANAGER`, `HR_STAFF` dari
`02-roles.seed.ts`) hidup di tabel yang sama dengan role milik tenant. Untuk
role platform, unik global **benar**.

Tenant **memang** bisa membuat role sendiri: `POST /rbac` dengan
`createRoleSchema` yang menerima `companyId` dan `code`
(`rbac.dto.ts:4,7`). Kalau kode kiriman klien dipakai, dua tenant yang
sama-sama ingin role berkode `SUPERVISOR` akan bertabrakan — persis bug
`LeaveType` yang sudah diperbaiki, dan ini akan jadi temuan paling serius di
dokumen ini.

Ternyata tidak. `rbac.service.ts:51` juga memanggil `generateSystemCode` dan
membuang kode kiriman klien, sama seperti sembilan model di atas. Jadi
`Role.code` masuk kelas "kode pelanggan dibuang diam-diam", bukan kelas
tabrakan. Role bawaan (`isSystem: true`, `companyId: null`, kode `HR_MANAGER`
dkk dari `02-roles.seed.ts`) tetap benar sebagai unik global.

Satu catatan yang tersisa untuk `Role`: karena `companyId` nullable dan role
platform hidup di tabel yang sama, membuat `code` jadi
`@@unique([companyId, code])` **tidak** bisa langsung menyalin pola model lain —
di MySQL beberapa baris dengan `company_id IS NULL` tetap lolos indeks unik
komposit, jadi keunikan role platform justru hilang. Model ini butuh
pertimbangan sendiri, bukan perlakuan yang sama.
