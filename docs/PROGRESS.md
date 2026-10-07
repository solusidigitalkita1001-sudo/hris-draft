# Progres pengerjaan

Satu bagian per tugas. Yang dicatat: apa yang berubah, apa yang membuktikannya
benar, dan apa yang sengaja dilewati. Keputusan beserta opsinya ada di
[DECISIONS.md](DECISIONS.md).

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
