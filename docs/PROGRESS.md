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

### Dilewati, tanpa ditebak

Tidak ada format atau tarif resmi yang tersentuh tugas ini, jadi tidak ada yang
perlu dilewati karena kurang sumber.
