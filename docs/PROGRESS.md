# Progres pengerjaan

Satu bagian per tugas. Yang dicatat: apa yang berubah, apa yang membuktikannya
benar, dan apa yang sengaja dilewati. Keputusan beserta opsinya ada di
[DECISIONS.md](DECISIONS.md).

**Soal SHA di dokumen ini.** Setiap commit yang disebut di bawah (`77c6206`,
`d4ed5be`, `62f6366`, `e40c919`, dan seterusnya) adalah commit di
[PR #96](https://github.com/solusidigitalkita1001-sudo/hris-draft/pull/96), bukan
commit di `main`. PR itu di-squash saat merge — jadi di `main` semuanya menjadi
satu commit, `487021e`. SHA-nya tetap ditulis apa adanya karena justru itu yang
bisa diperiksa: tiap angka merujuk ke satu run CI yang berdiri sendiri, dan
daftar commit beserta run-nya tetap ada di PR tersebut. Run hijau terakhir
sebelum merge adalah `4a7e536`, commit merge `origin/main` ke dalam branch itu.

---

## Hambatan lingkungan yang berlaku untuk semua tugas

**Repo ini ada di dalam folder yang disinkronkan iCloud Drive**
(`/Users/f/Documents/...`), dan isinya sebagian masih `dataless` — tercatat ada
di disk tapi isinya harus diunduh saat dibaca. Ini bukan dugaan:

```
$ ls -lO backend/node_modules/.package-lock.json
-rw-r--r--  1 f  staff  hidden,compressed,dataless  333582 ...
                               ^^^^^^^^
```

Akibatnya **jest tidak bisa dijalankan sampai selesai di mesin ini.** Tiga
percobaan, tiga kegagalan yang semuanya di lapisan I/O, bukan di kode:

| Percobaan | Hasil |
|---|---|
| 1 | menggantung 63 menit pada 0% CPU, tidak pernah mencetak apa pun |
| 2 | `Error: ECANCELED: operation canceled, read` di `fs.readFileSync` saat memuat modul |
| 3 | `Error: ETIMEDOUT: connection timed out, read` (`errno -60`) di `fs.readFileSync` |

`ETIMEDOUT` pada pembacaan file lokal tidak mungkin terjadi di disk biasa; itu
tanda volume yang dilayani jaringan. `brctl download backend/node_modules`
sempat menghilangkan flag `dataless`, tapi percobaan berikutnya tetap berhenti
di I/O pada 0% CPU — iCloud mengusir isinya lagi.

Gejala lain dari penyebab yang sama, yang sudah terlihat sebelum ini:
`git status` memunculkan `docker/nginx/Dockerfile 2`, `Dockerfile 3`,
`docker-compose.prod 2.yml` — itu berkas konflik sinkronisasi, bukan berkas yang
ditulis siapa pun. Begitu juga `.git/index 5.lock` dan `.git/HEAD 2.lock`, yang
berbahaya karena nama aslinya (`index.lock`) adalah lock sungguhan milik git.

**Yang dipakai sebagai verifier sementara:** CI. `.github/workflows/ci.yml`
berjalan pada `push: branches: ['**']`, jadi mendorong branch sudah memicu
type-check + build (blocking) serta lint + test. Itu mesin yang filesystem-nya
sehat, dan itu yang menjalankan test untuk tugas-tugas di bawah.

**Belum dikerjakan karena butuh keputusan pemilik mesin:** memindahkan repo ke
luar iCloud, atau mematikan sinkronisasi folder Documents. Dua-duanya menyentuh
pengaturan pribadi di luar repo, jadi tidak diambil sendiri.

---

## Tugas — nomor karyawan: per perusahaan, dan boleh dibawa pelanggan

Diambil dari daftar "yang masih dikerjakan tangan saat onboarding" di
[tenant-onboarding.md](tenant-onboarding.md), satu-satunya butir di sana yang
ditandai eksplisit **"belum diperbaiki"**.

### Masalahnya ada dua, dan yang pertama adalah bug

`employees.employee_number` unik **di seluruh instalasi**, sementara **semua**
pemeriksaan di aplikasi sudah per perusahaan:

- `employeeRepository.findByEmployeeNumber(companyId, number)`
- pemindaian duplikat di import CSV, yang juga discoped per `companyId`
- pencarian karyawan dari punch mesin absensi
  (`attendance-device.service.ts:200`), yang sudah menyertakan `companyId`

Jadi kode dan database tidak sepakat. Tenant kedua yang memakai nomor milik
tenant pertama **lolos validasi**, lalu mati di indeks unik dengan error
constraint mentah — bukan 409. Tidak ada satu pun pemanggil yang bergantung pada
keunikan global; yang ada hanyalah indeks yang lebih ketat dari yang
dibutuhkan.

Yang kedua: `create()` membuang `employeeNumber` kiriman klien tanpa
pemberitahuan, padahal DTO-nya menerima field itu sejak awal
(`employee.dto.ts:32`) **dan import CSV sudah menghormatinya**. Dua jalur masuk
yang sama berperilaku berbeda.

### Yang berubah

| Berkas | Perubahan |
|---|---|
| `schema.prisma` | `employeeNumber` tidak lagi `@unique`; ditambah `@@unique([companyId, employeeNumber])` |
| `migrations/20261007100000_tenant_scoped_employee_number/` | drop indeks unik single-column, buat indeks komposit |
| `employee.service.ts` | `create()` memakai nomor kiriman klien kalau ada; pemeriksaan konflik kini melihat baris soft-deleted juga |
| `employee-number.test.ts` | baru |

Migrasinya **mencari indeks lama berdasarkan kolom, bukan berdasarkan nama.**
Preseden di repo (`20261002100000_tenant_scoped_leave_and_benefit_codes`) memakai
nama default Prisma di dalam guard `information_schema`; kalau nama di database
ternyata berbeda, guard semacam itu membuat migrasi **sukses tanpa melakukan
apa-apa** dan constraint global tetap terpasang. Versi di sini tidak punya mode
gagal itu.

Melonggarkan indeks unik global ke komposit tidak bisa gagal pada data lama:
kalau `(employee_number)` unik, `(company_id, employee_number)` pasti unik juga.

### Satu hal yang ikut ketemu

`findByEmployeeNumber` menyaring `deletedAt: null`, sedangkan indeks unik tidak
tahu soal soft delete. Nomor milik karyawan yang sudah dihapus karena itu lolos
pemeriksaan aplikasi lalu gagal di database — 500, bukan 409. Pemeriksaan
konflik di `create()` sekarang tidak menyaring `deletedAt`, dan ada test yang
menegaskan itu (`expect(where).not.toHaveProperty('deletedAt')`).

### Yang tidak diubah

`update()` tetap menolak penggantian nomor karyawan. Nomor itu dipakai sebagai
rujukan di data historis; menggantinya setelah payroll berjalan memutus jejak
itu. Lihat D-001 opsi C.

### Status verifikasi

`employee-number.test.ts` berisi 6 kasus, dan yang paling berarti ada tiga:
perusahaan kedua boleh memakai nomor yang dipegang perusahaan pertama (ini
**gagal pada skema sebelum migrasi di atas**), karyawan soft-deleted tetap
dihitung memegang nomornya, dan nomor kiriman klien benar-benar tersimpan.

**Belum dijalankan di mesin ini** — lihat hambatan lingkungan di atas. Hasil
yang berlaku adalah hasil CI pada branch `feat/portable-employee-number`. Jangan
anggap tugas ini selesai sebelum job `Backend (type-check + build [blocking],
lint + test [soft])` di branch itu hijau.

Satu hal yang **hanya CI yang bisa buktikan** dan memang perlu dibuktikan:
`schema.prisma` berubah tapi Prisma Client belum di-generate di mesin ini. Kalau
masih ada pemanggil yang menulis
`prisma.employee.findUnique({ where: { employeeNumber } })`, kode itu **berhenti
mengompilasi** setelah field tersebut bukan unik lagi. Job type-check di CI yang
akan menangkapnya. Pembacaan manual tidak menemukan pemanggil seperti itu, tapi
pembacaan manual bukan bukti.

### Apa yang CI tangkap, dan apa yang lolos dari type-check

Job type-check hijau, jadi dugaan di atas benar untuk pemanggil **bertipe**:
`EmployeeWhereUniqueInput` menolak `where: { employeeNumber }` begitu `@unique`
tingkat-field dilepas, dan tidak ada satu pun yang gagal kompilasi.

Yang lolos adalah seed. `05-test-data.seed.ts` memanggil lewat
`(prisma as any).employee.upsert(...)`, dan `as any` mematikan satu-satunya alat
yang bisa menangkap perubahan ini. Dua job gagal di langkah seed —
`Migration rehearsal (soft)` dan `Browser E2E (Playwright, soft)` — dengan pesan
yang sama:

```
Argument `where` of type EmployeeWhereUniqueInput needs at least one of
`id`, `email`, `companyId_employeeNumber`, `companyId_idNumber` or `companyId_phone`
```

Dua upsert diperbaiki ke
`where: { companyId_employeeNumber: { companyId, employeeNumber } }` — satu untuk
perusahaan utama, satu untuk tenant kedua (`companyDigi`). Pelajarannya bukan
"pembacaan manual kurang teliti": `(prisma as any)` menyembunyikan perubahan
skema dari compiler, jadi setiap perubahan `@unique` harus diperiksa langsung di
seed, bukan diserahkan ke type-check.

**Hasilnya: hijau.** Run CI pada commit `77c6206` lulus kesepuluh job, termasuk
dua yang tadi gagal (`Migration rehearsal`, `Browser E2E`) dan dua yang blocking
(`Backend type-check + build`, `Real-database integration suites`). Syarat
"jangan anggap selesai sebelum CI hijau" di atas sudah terpenuhi.

### Dilewati, tanpa ditebak

Tidak ada format atau tarif resmi yang tersentuh tugas ini, jadi tidak ada yang
perlu dilewati karena kurang sumber.

---

## Tugas — audit: di mana lagi pola nomor karyawan ada?

Hasilnya: [tenant-scoped-codes-audit.md](tenant-scoped-codes-audit.md).

Perbaikan nomor karyawan memunculkan pertanyaan yang tidak boleh dibiarkan
menggantung: kalau satu field unik global ternyata salah, di mana lagi? Caranya
mekanis — ambil setiap model di `schema.prisma` yang punya `companyId` **dan**
`@unique` tingkat-field. Dapat 24 model, lalu ditriase satu-satu.

### Yang ditemukan

**Sepuluh model membuang kode kiriman klien tanpa pemberitahuan**, pola yang
sama dengan `employeeNumber`: `Branch.code`, `Division.code`, `Department.code`,
`SubDepartment.code`, `Position.code`, `Asset.assetCode`, `PayrollPeriod.code`,
`SalaryComponent.code`, `TrainingCategory.code`, `TrainingCourse.code`,
`Role.code`.

DTO-nya bahkan jelas dirancang untuk nilai buatan manusia —
`z.string().min(2).max(50).toUpperCase().optional()`. `.toUpperCase()` tidak ada
gunanya untuk nilai yang dihasilkan mesin.

**Yang tidak ditemukan, dan ini kabar baik:** tidak ada satu pun tabrakan
antar-tenant seperti `LeaveType`. `generateSystemCode` menempelkan tanggal dan
empat digit acak, jadi indeks unik global praktis tidak pernah kena. Jadi daftar
di atas **bukan** bug data; yang rusak adalah pelanggan tidak bisa membawa
kodenya sendiri dan permintaannya ditolak tanpa suara.

**Sembilan field lain memang benar global** (token dan relasi satu-ke-satu), dan
`Employee.email` global **dengan sengaja** — di sana kode dan database sepakat.

### Yang hampir jadi temuan serius

`Role.code` sempat terlihat paling berbahaya: `companyId` nullable, role
tingkat-platform hidup di tabel yang sama dengan role tenant, dan tenant
**memang** bisa membuat role sendiri lewat `POST /rbac` dengan `code` kiriman
klien (`rbac.dto.ts:4,7`). Kalau kode itu dipakai, dua tenant yang sama-sama
ingin `SUPERVISOR` bertabrakan — persis bug `LeaveType`.

Ternyata `rbac.service.ts:51` juga generate dan membuang kode kiriman klien.
Jadi masuk kelas yang sama, bukan kelas tabrakan.

Satu catatan yang tersisa: `Role` **tidak** bisa langsung ikut pola
`@@unique([companyId, code])`. Di MySQL beberapa baris dengan
`company_id IS NULL` tetap lolos indeks unik komposit, jadi keunikan role
platform justru hilang. Model itu butuh pertimbangan sendiri.

### Kenapa ini laporan, bukan patch

Memperbaiki sepuluh model berarti satu migrasi dan perubahan perilaku di sepuluh
endpoint, sementara test tidak bisa dijalankan di mesin ini. Mengubah sepuluh
jalur tulis sekaligus tanpa bisa menjalankan satu test pun bukan keberanian,
itu kelalaian. Urutan yang masuk akal: satu model dulu sebagai pola
(`Asset.assetCode` — paling kecil, dan paling jelas milik pelanggan), buktikan
di CI, baru sisanya menyusul.

### Verifikasi

Tidak ada kode yang berubah, jadi tidak ada yang perlu dijalankan. Yang bisa
diperiksa adalah klaim-klaimnya, dan setiap klaim di dokumen itu menyebut berkas
dan nomor barisnya.

---

## Tugas — nomor aset: per perusahaan, dan boleh dibawa pelanggan

Butir pertama dari [tenant-scoped-codes-audit.md](tenant-scoped-codes-audit.md),
dipilih sebagai pola untuk sembilan model sisanya. Alasan pemilihannya ada di
D-005.

### Masalahnya

`assets.asset_code` unik di seluruh instalasi, padahal setiap pencarian aset di
aplikasi sudah difilter `companyId` dan nomor aset adalah hal yang dicetak
pelanggan di stikernya sendiri. Dua tenant yang sama-sama menamai laptop
pertamanya `AST-LAP-001` bukan konflik; itu dua perusahaan dengan daftar aset
masing-masing.

Dan seperti `employeeNumber`: `asset.dto.ts:6` menerima `assetCode` dari klien,
`asset.service.ts:33` membuangnya tanpa pemberitahuan lalu memakai
`generateSystemCode`. Nomor yang sudah tertempel di barangnya hilang tanpa 400,
tanpa peringatan.

### Yang berubah

| Berkas | Perubahan |
|---|---|
| `schema.prisma` | `assetCode` tidak lagi `@unique`; ditambah `@@unique([companyId, assetCode])` |
| `migrations/20261007110000_tenant_scoped_asset_code/` | drop indeks unik single-column (dicari berdasarkan kolom, bukan nama), buat indeks komposit, pastikan `@@index([assetCode])` ada |
| `asset.repository.ts` | `findByAssetCode(companyId, assetCode)` — `findUnique` jadi `findFirst` yang discoped perusahaan dan tidak menyaring `deletedAt` |
| `asset.service.ts` | `create()` memakai kode kiriman klien kalau ada |
| `05-test-data.seed.ts` | `upsert` dan dua `findUnique` aset pindah ke kunci komposit |
| `asset-code.test.ts` | baru |

Seed-nya **sengaja diperiksa lebih dulu kali ini** — pelajaran dari tugas
sebelumnya. Bedanya: tiga pemanggil aset di seed semuanya bertipe (bukan
`prisma as any`), jadi type-check CI akan menangkapnya kalau ada yang terlewat.

`deletedAt` tidak disaring di `findByAssetCode` dengan sengaja: indeks unik tidak
tahu soal soft delete, jadi aset yang sudah dihapus tetap memegang kodenya.
Menyaringnya berarti pemeriksaan lolos di aplikasi lalu gagal di database — 500,
bukan 409. Sama seperti `employeeNumber`.

### Yang tidak diubah

Sembilan model sisanya dari audit (`Branch.code`, `Division.code`,
`Department.code`, `SubDepartment.code`, `Position.code`, `PayrollPeriod.code`,
`SalaryComponent.code`, `TrainingCategory.code`, `TrainingCourse.code`). Pola di
atas sekarang jadi contohnya. `Role.code` tetap di luar daftar — alasannya di
D-005.

`update()` aset tidak disentuh; tugas ini hanya tentang jalur `create`.

### Status verifikasi

`asset-code.test.ts` berisi 5 kasus; yang paling berarti dua: perusahaan kedua
boleh memakai kode yang dipegang perusahaan pertama (ini **gagal pada skema
sebelum migrasi di atas**), dan kode kiriman klien benar-benar tersimpan.

**Belum dijalankan di mesin ini** — lihat hambatan lingkungan di atas. Yang
berlaku adalah hasil CI pada branch ini.

---

## Tugas — sembilan model sisanya: kode per perusahaan, dan boleh dibawa pelanggan

Sisa daftar di [tenant-scoped-codes-audit.md](tenant-scoped-codes-audit.md),
dikerjakan sesudah polanya hijau di CI pada `Asset.assetCode` (D-005).

### Yang berubah

Delapan model kehilangan `@unique` tingkat-field dan mendapat
`@@unique([companyId, code])`: `Branch`, `Division`, `Department`,
`SubDepartment`, `Position`, `PayrollPeriod`, `TrainingCategory`,
`TrainingCourse`. Satu migrasi,
`20261007120000_tenant_scoped_org_payroll_training_codes`, delapan blok dengan
bentuk yang sama seperti dua migrasi sebelumnya: cari indeks lama **berdasarkan
kolom, bukan nama**, buat indeks komposit, pastikan `@@index([code])` ada.

**`SalaryComponent` ternyata sudah punya `@@unique([companyId, code])`** —
audit mencatatnya di daftar yang salah. Yang tersisa untuk model itu hanya
perilaku `create`, dan itu yang diperbaiki.

Sembilan jalur `create` sekarang memakai kode kiriman klien kalau ada, dan
pemeriksaan konfliknya discoped per perusahaan:

| Service | Lookup |
|---|---|
| `branch`, `division`, `department`, `position` | `findByCode(companyId, code)` — `findUnique` jadi `findFirst` |
| `sub-department` | sama, tapi `companyId`-nya diambil dari departemen induk: DTO-nya tidak punya `companyId`, dan `repository.create()` yang biasanya menurunkannya baru jalan sesudah pemeriksaan kode |
| `training` kategori + kursus | `findCategoryByCode/findCourseByCode(companyId, code)`, plus pemeriksaan konflik yang sebelumnya **tidak ada sama sekali** |
| `payroll` periode | `findPayrollPeriodByCode(companyId, code)` baru, menggantikan pemindaian `findAllPayrollPeriods().some(...)` |
| `payroll` komponen gaji | sudah discoped; hanya kode kiriman klien yang dihormati |

36 pemanggil di `05-test-data.seed.ts` pindah ke kunci komposit — diperiksa
lebih dulu, bukan menunggu CI seperti pada tugas `employeeNumber`.

Pesan `update()` yang menolak penggantian kode ikut dikoreksi dari "is generated
by system and cannot be changed" menjadi "cannot be changed after creation" di
sembilan model itu dan di `employeeNumber`. Kodenya tidak lagi selalu dibuat
sistem, jadi kalimat lamanya sudah bohong. Perilakunya tidak berubah: kode tetap
tidak boleh diganti sesudah dibuat, karena dipakai sebagai rujukan di data
historis.

### Yang tidak diubah, dan satu sisa yang diketahui

`findSalaryComponentByCode` menyaring `deletedAt: null`, sementara indeks unik
tidak tahu soal soft delete — jadi komponen gaji yang sudah dihapus tetap
memegang kodenya dan `create` bisa gagal di database, 500 bukan 409. Itu bukan
dibuat oleh tugas ini. Lookup itu dipakai 12 tempat lain (termasuk jalur
bootstrap yang memang perlu mengabaikan baris terhapus), jadi mengubahnya adalah
perubahan tersendiri dengan risikonya sendiri, bukan tempelan di tugas ini.

`Role.code` tetap di luar — alasannya di D-005 dan di audit.

### Status verifikasi

- `org-unit-codes.test.ts` — 5 service × 5 kasus, satu tabel, supaya satu
  service yang keluar dari pola langsung gagal
- `training-code.test.ts` — kategori dan kursus
- `payroll-period-code.test.ts` — lookup periode: discoped per perusahaan dan
  **tidak** menyaring `deletedAt`

`createPayrollPeriod` dan `createSalaryComponent` tidak dapat test unit baru:
graf impor `payroll.service` terlalu besar untuk dimock dengan jujur. Jalur itu
dijaga `*.mysql.test.ts` yang jalan di job `Real-database integration suites
(blocking)`.

**Belum dijalankan di mesin ini** — lihat hambatan lingkungan di atas. Yang
berlaku adalah hasil CI pada branch ini: run pada commit `d4ed5be` lulus
kesepuluh job, termasuk `Real-database integration suites (blocking)`,
`Migration validation`, dan `Migration rehearsal` yang menjalankan seed.

---

## Tugas — `Role.code`: butir terakhir audit, dan satu-satunya yang tidak diubah skemanya

Keputusannya ada di D-006. Ringkasnya: `Role.companyId` nullable dan role
platform hidup di tabel yang sama, jadi `@@unique([companyId, code])` akan
**menghapus** jaminan keunikan role platform di MySQL alih-alih menambah jaminan
baru. Kode role juga bukan data pelanggan — form role di frontend sudah
menampilkannya sebagai field `disabled` yang terisi otomatis, dan payload-nya
tidak pernah memuat `code`.

### Yang berubah

| Berkas | Perubahan |
|---|---|
| `rbac.dto.ts` | `code` tidak lagi diterima: `z.undefined()` dengan pesan "Role code is generated by the system and cannot be set" — dikirim pun ditolak 400, bukan dibuang diam-diam |
| `rbac.service.ts` | dua cabang `dto.code` di `update()` dihapus (tidak bisa tercapai lagi), plus komentar kenapa keunikannya global |
| `rbac.dto.test.ts` | baru |

Tidak ada migrasi, tidak ada perubahan `schema.prisma`. Itu inti keputusannya.

### Status verifikasi

`rbac.dto.test.ts` menguji kontraknya langsung: payload tanpa `code` lolos,
payload dengan `code` gagal dengan pesan yang tepat, dan `update` tetap lolos
kalau tidak menyentuh kode.

Perilaku zod-nya **diverifikasi di mesin ini**, bukan ditebak — jalur ini tidak
butuh jest, cukup zod yang sudah terpasang:

```
$ node -e "... z.undefined({ invalid_type_error: '...' }) ..."
no code   -> {"success":true,"data":{"name":"x"}}
with code -> false [{"code":"invalid_type","expected":"undefined",...,
             "message":"Role code is generated by the system and cannot be set"}]
zod 3.25.76
```

Sisanya mengikuti hasil CI pada branch ini: **hijau di commit `e40c919`**,
kesepuluh job.

Commit pertama tugas ini (`62f6366`) merah, dan penyebabnya layak dicatat karena
bukan kebetulan: begitu DTO menolak `code`, tipe `CreateRoleDTO['code']` menjadi
`undefined`, dan `CreateRoleDTO & { code: string }` di repository membuat field
itu `undefined & string` — yaitu `never`. Satu error TS2322 menjatuhkan dua job
sekaligus (type-check, dan `administration-access.test.ts` yang mengimpor service
itu). Pelajarannya: menyempitkan tipe sebuah field di DTO **mengubah aljabar
setiap intersection yang memakainya**; `Omit` dulu, baru intersect.

---

## Tugas — audit soft delete pada komponen gaji

Sisa yang dicatat di tugas sembilan model: `findSalaryComponentByCode` menyaring
`deletedAt: null` padahal indeks uniknya tidak. Auditnya menemukan tiga hal, dan
yang paling besar bukan yang dicatat.

### Temuan 1 — payroll run bisa mati, bukan cuma salah kode status

Dua belas helper `ensure*Component` memakai pola cari-lalu-insert, dan
pencariannya menyaring baris terhapus. Kalau ada yang menghapus satu komponen
sistem (`EWA-DEDUCT`, `LATE_DEDUCTION_AUTO`, `THR_EARNING_AUTO`, …), pencarian
bilang kosong, `INSERT` jalan, dan **transaksi payroll run mati di indeks unik.**
Ini bukan 500 di form admin; ini perhitungan payroll yang gagal di tengah jalan.

Perbaikannya `reviveOrCreateSystemSalaryComponent` — `upsert` pada
`companyId_code` yang mengosongkan `deletedAt` dan mengaktifkan kembali. Dua belas
helper itu sekarang satu pemanggilan, dan dua baris cari-lalu-insert hilang dari
masing-masing. Alasan memilih "hidupkan" dan opsi yang ditolak ada di D-007.

### Temuan 2 — `isFixedAllowance` diterima DTO, tidak pernah ditulis

Ini yang paling serius, dan ketemu tanpa dicari. `createSalaryComponentSchema`
menerima `isFixedAllowance` (dengan komentar yang menjelaskan maksudnya), tapi
**`createSalaryComponent` dan `updateSalaryComponent` di repository tidak
memetakannya.** Jadi nilainya selalu jatuh ke `@default(false)`.

Field itu bukan kosmetik: `shared/payroll/statutory-wage.ts` memakai
`isFixedAllowance === true` untuk menyusun "upah sebulan", yang jadi basis **THR
(Permenaker 6/2016)** dan tarif harian pencairan cuti. Perusahaan yang menandai
tunjangan jabatannya sebagai tunjangan tetap tetap mendapat THR yang dihitung
dari basis lebih kecil — tanpa error, tanpa peringatan. Satu-satunya cara field
itu pernah bernilai `true` adalah backfill langsung di database, dan
`leave-encashment.service.ts` memang menyebut backfill itu.

Sekarang dipetakan di `create`, `update`, dan di jalur revive.

### Temuan 3 — yang memang sudah dicatat

Pemeriksaan konflik di `createSalaryComponent` memakai pencarian yang menyaring
`deletedAt`, jadi kode yang masih dipegang komponen terhapus lolos pemeriksaan
lalu mati di indeks — 500, bukan 409. Sekarang ada dua pertanyaan yang berbeda dan
dua method yang berbeda:

| Method | Untuk |
|---|---|
| `findSalaryComponentByCode` | pertanyaan bisnis: komponen yang sudah dihapus **tidak boleh** muncul di payslip |
| `findSalaryComponentByCodeIncludingDeleted` | pertanyaan keunikan: indeks unik tidak tahu soal soft delete, jadi komponen terhapus **masih memegang** kodenya |

### Yang tidak diubah

Pencarian `'PPH21'` di dua tempat (posting pajak) tetap memakai pencarian yang
menyaring baris terhapus — itu pertanyaan bisnis, dan memang benar begitu. Celah
UX "tidak ada cara memulihkan komponen yang dihapus" dicatat di D-007, tidak
ditambal di sini.

### Status verifikasi

`salary-component-code.test.ts` (baru, level repository seperti preseden
`payroll.maker-checker.test.ts`) menguji lima hal: `isFixedAllowance` benar-benar
ditulis di `create` dan di `update`, pencarian bisnis tetap menyaring
`deletedAt`, pencarian keunikan tidak, dan jalur revive memakai kunci komposit
plus mengosongkan `deletedAt` tanpa pernah memanggil `create`.

Jalur service-nya sendiri tidak dapat test unit baru: graf impor `payroll.service`
terlalu besar untuk dimock dengan jujur. Jalur itu dijaga `*.mysql.test.ts` di job
`Real-database integration suites (blocking)`.

---

## Tugas — indeks unik leave/benefit: cari berdasarkan kolom, bukan nama

Risiko yang dicatat sejak tugas nomor karyawan dan belum pernah ditutup.

### Masalahnya

`20261002100000_tenant_scoped_leave_and_benefit_codes` memindahkan
`leave_types.code` dan `benefit_plans.code` ke indeks unik per perusahaan. Tapi
DROP indeks lamanya dijaga **berdasarkan nama**:

```sql
SET @drop_leave := IF(
  (SELECT COUNT(*) ... AND index_name = 'leave_types_code_key') > 0,
  'DROP INDEX `leave_types_code_key` ON `leave_types`', 'DO 0');
```

Kalau di sebuah database nama indeksnya ternyata bukan itu, DROP-nya jadi `DO 0`
sementara `CREATE UNIQUE INDEX` kompositnya tetap sukses. Migrasinya **hijau di
atas database yang masih memaksa kode unik se-instalasi** — dan tenant kedua tetap
tertolak saat membuat katalog cutinya sendiri, tepat bug yang migrasi itu niat
perbaiki.

**CI tidak bisa menangkap ini.** Semua job CI memulai dari database kosong, di mana
nama indeksnya memang nama default Prisma. Hanya database yang sudah hidup yang
bisa menyimpang, dan di sana tidak ada yang memeriksanya.

### Yang berubah

Satu migrasi, `20261007130000_leave_benefit_unique_index_by_column`, dengan bentuk
yang sama seperti tiga migrasi sesudah migrasi bermasalah itu: cari indeks unik
single-column di kolom `code` **berdasarkan kolom**, drop apa pun namanya,
pastikan indeks komposit dan `@@index([code])` ada.

Tidak ada perubahan `schema.prisma` — bentuk akhirnya sudah benar sejak dulu. Yang
diperbaiki adalah database yang mungkin tidak sampai ke bentuk itu.

Aman di tiga keadaan: database yang sudah benar (tidak ada indeks single-column →
`DO 0`), database yang namanya beda (ketemu, di-drop), dan data lama (kalau
`(code)` unik maka `(company_id, code)` pasti unik — dan saat migrasi ini jalan,
indeks global itulah yang masih memaksa keunikannya).

### Cara memeriksa database yang sudah hidup

Migrasi di atas memperbaiki tanpa perlu tahu jawabannya lebih dulu, tapi kalau
ingin tahu apakah suatu database memang terkena, ini query baca-saja-nya:

```sql
SELECT table_name, index_name, GROUP_CONCAT(column_name ORDER BY seq_in_index) AS cols
  FROM information_schema.statistics
 WHERE table_schema = DATABASE()
   AND table_name IN ('leave_types', 'benefit_plans')
   AND non_unique = 0
 GROUP BY table_name, index_name;
```

Yang sehat hanya menampilkan `PRIMARY` (kolom `id`) dan
`*_company_id_code_key` (`company_id,code`). Baris unik apa pun yang kolomnya
hanya `code` adalah indeks lama yang lolos dari guard berbasis nama.

### Status verifikasi

Tidak ada kode aplikasi yang berubah. Yang bisa dibuktikan CI adalah
replay-safety-nya: job `Migration rehearsal` dan `Migration validation`
menjalankan seluruh rantai migrasi dari database kosong, jadi blok guard-nya harus
melewati keadaan "indeksnya sudah tidak ada" tanpa error. Skenario "nama indeksnya
beda" tidak bisa direproduksi di CI — itu sebabnya ia tidak pernah tertangkap.

---

## Tugas — jenis cuti dan benefit plan: konflik kode yang tidak pernah diperiksa

Dua model yang tidak tersentuh PR #96 karena indeks kompositnya sudah benar sejak
`20261002100000`. Yang belum diperiksa adalah jalur `create`-nya, dan dua-duanya
bermasalah.

### `LeaveType.create` sama sekali tidak memeriksa konflik

```ts
async createLeaveType(data: CreateLeaveTypeDTO) {
  const type = await leaveRepository.createLeaveType(data);   // langsung INSERT
```

Tidak ada pemeriksaan apa pun. DTO-nya **mewajibkan** `code` (dan itu benar —
kode jenis cuti memang dipilih pelanggan), jadi `ANNUAL`, `SICK`, `UNPAID` adalah
kode yang setiap tenant mau. Membuatnya dua kali, atau membuat ulang sesudah
menghapus, berarti `INSERT` mati di indeks unik dan pemanggil melihat **500**,
bukan 409. Ini jalur yang disentuh setiap pelanggan baru saat menyusun katalog
cutinya.

Sekarang ada `findLeaveTypeByCode(companyId, code)` yang **tidak** menyaring
`deletedAt` — indeks uniknya juga tidak — dan `createLeaveType` menjawab 409.

### `BenefitPlan` — dua hal

1. `findPlanByCode` menyaring `deletedAt: null`, padahal satu-satunya pemakainya
   adalah pemeriksaan keunikan di `createPlan`. Jadi filternya salah di
   satu-satunya tempat ia dipakai: plan yang sudah dihapus masih memegang
   kodenya, pemeriksaan lolos, lalu gagal di database. Filternya dihapus, bukan
   ditambah method kedua, karena tidak ada pemakaian bisnis yang perlu dijaga.
2. DTO-nya menerima `code` lalu membuangnya tanpa pemberitahuan — pola yang sama
   yang ditutup untuk sepuluh model di PR #96. BenefitPlan terlewat di sana
   karena auditnya menandai model ini "sudah komposit" dan berhenti di situ.
   Sekarang kode kiriman klien dipakai kalau ada.

### Yang diperiksa dan ternyata aman

`company-bootstrap.service.ts` memakai pola cari-lalu-create untuk leave type dan
komponen gaji default, tapi pencariannya `findUnique` pada kunci komposit — dan
`findUnique` komposit tidak bisa menyaring `deletedAt`, jadi baris terhapus
**ikut** ketemu dan bootstrap melewatinya alih-alih menabrak indeks. Tidak seperti
dua belas helper `ensure*Component` di payroll, yang memakai `findFirst` dengan
filter.

Pemetaan field di `createLeaveType` (spread seluruh DTO) dan `createPlan`
(dipetakan satu per satu) dua-duanya lengkap — tidak ada ulangan temuan
`isFixedAllowance` di sini.

### Status verifikasi

`leave-type-code.test.ts` dan `benefit-plan-code.test.ts` (baru): kode bebas →
tersimpan, kode terpakai → `ConflictError` tanpa pernah memanggil repository
create, pencarian discoped per perusahaan, dan untuk benefit plan kode kiriman
klien benar-benar dipakai sementara yang kosong/spasi tetap di-generate.
