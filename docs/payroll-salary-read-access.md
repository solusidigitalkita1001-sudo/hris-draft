# Scope baca alokasi gaji dan THR — 9 September 2026

Jalur mutasi alokasi gaji sudah memeriksa company dan scope payroll, tetapi list/detail gaji serta kalkulasi THR sebelumnya masih menggunakan pembacaan yang tidak menerapkan scope pegawai pada query. Detail pegawai juga menyertakan gaji aktif meskipun pemanggil hanya memiliki permission membaca profil pegawai. Fase ini menutup jalur baca tersebut.

## Matriks endpoint dan akses

| Endpoint | Permission route | Batas pembacaan |
| --- | --- | --- |
| `GET /api/v1/payroll/employee-salaries` | `payroll:read` | Company aktif, scope pegawai resource payroll, serta filter `employeeId` jika diberikan |
| `GET /api/v1/payroll/employee-salaries/:id` | `payroll:read` | Salary dan parent employee harus berada dalam company serta scope payroll yang sama |
| `GET /api/v1/payroll/employees/:employeeId/thr` | `payroll:read` | Employee harus lolos scope payroll sebelum gaji aktif dibaca |
| `GET /api/v1/employees/:id` — bagian `employeeSalaries` | Permission profil yang ada; bagian gaji memerlukan `payroll:read`/`payroll:*` atau permission bypass SUPER_ADMIN | Salary tetap dibatasi company dan scope payroll, selain scope profil employee yang sudah berlaku |

Nama field, envelope dan bentuk array tetap sama. Daftar alokasi mencakup alokasi aktif dan nonaktif yang belum dihapus. Gaji yang dihapus atau terkait pegawai yang dihapus tidak tampil. Daftar berisi hanya record yang diperbolehkan; filter employee di luar scope menghasilkan array kosong. Detail salary dan THR untuk target di luar scope/berbeda company menghasilkan 404.

Company dipilih melalui middleware dari assignment yang diizinkan dan diteruskan ke request context. Body/query tidak menjadi sumber otorisasi scope pegawai. Service list menolak company yang berbeda dari active context, termasuk ketika aktor memiliki assignment ke kedua company tetapi belum mengganti konteks aktif. Pemilihan company yang tidak diizinkan ditolak 403 oleh middleware.

Scope BRANCH_ONLY, DEPARTMENT_ONLY, SUB_DEPARTMENT_ONLY dan EMPLOYEE_SELF dipasang sebagai predicate pada parent Employee dalam query database. Filter client tidak dapat memperluas predicate tersebut. Lookup memakai konfigurasi resource `payroll`, sehingga akses employee-module yang lebih luas tidak memperluas pembacaan gaji. Semantik konfigurasi yang sudah ada tetap berlaku: tanpa konfigurasi scope pembatas, permission payroll berlaku dalam company aktif. MANAGER_TEAM tetap 403; kegagalan menghitung scope tidak diteruskan sebagai query tanpa batas.

## Detail pegawai dan referensi legacy

Bagian `employeeSalaries` pada profil tetap berbentuk array. Tanpa permission payroll yang sesuai, atau ketika target profil berada di luar scope payroll, array itu kosong. Pengguna masih dapat membaca profil jika permission/scope employee mengizinkannya. Penolakan scope payroll tidak membuka data salary; kegagalan lookup selain ForbiddenError tetap menggagalkan request. System context eksplisit untuk pekerjaan internal tetap mengikuti jalur trusted yang ada dan tidak dapat dipilih dari request pengguna.

Salary pada profil dibaca dengan filter company/scope dan soft-delete di dalam query, sebelum data dikembalikan. Ini tidak sekadar menyembunyikan tab frontend. Komponen salary yang mereferensikan master component company lain juga dikecualikan dari nested query pada list, detail dan profil. Record legacy tersebut tidak diperbaiki otomatis; jalur mutasi/kalkulasi tetap memakai validasi integritas dari fase sebelumnya.

Employee yang disertakan pada respons list/detail salary dibatasi pada `id`, `fullName` dan `employeeNumber`. Tax ID dan konteks perpajakan yang diperlukan oleh kalkulasi internal tidak lagi ikut pada respons list salary. Pembacaan internal untuk kalkulasi payroll tetap terpisah dari pembacaan API ini; fase ini tidak mengubah himpunan pegawai dalam proses payroll.

## THR, validator dan cache

THR membaca employee dan gaji aktif dalam satu transaksi RepeatableRead dengan batas tunggu koneksi 10 detik dan timeout 60 detik. Beberapa alokasi aktif ditolak dengan 409, bukan memilih satu secara arbitrer. Salary non-IDR, nol/negatif atau invalid ditolak 422. Gaji aktif atau joinDate yang tidak tersedia tetap menghasilkan 400.

Rumus nominal THR yang sudah ada tidak diubah dan tidak divalidasi ulang terhadap peraturan pada fase ini. Parameter `date` menentukan tanggal referensi masa kerja, **bukan pemilihan gaji historis**: gaji yang digunakan masih alokasi aktif. Nominal THR/upah tidak lagi ditulis oleh log `THR calculated`; log itu hanya membawa employee ID. Sanitasi semua jalur log finansial lain masih backlog.

- List salary memvalidasi `companyId` dan `employeeId` sebagai UUID opsional; query employee berupa object/array ditolak. Endpoint tetap mengembalikan array tanpa kontrak pagination baru.
- Detail salary dan target employee THR memvalidasi UUID path.
- Tanggal THR menerima `YYYY-MM-DD` yang nyata atau ISO datetime berzona waktu; tanggal invalid, termasuk tanggal yang melampaui hari dalam bulan, ditolak 422 sebelum kalkulasi.
- Response list/detail salary dan THR memakai `Cache-Control: no-store`, termasuk respons error authentication/authorization/validation.

Permission HTTP tetap diperiksa oleh middleware; service baca juga memerlukan aktor serta company context dan memaksakan scope server. Query dari seed/worker yang menggunakan fungsi baca API tersebut tidak otomatis mendapat akses hanya karena berada di server.

## Pengujian dan batas tersisa

`employee-salary-read.mysql.test.ts` menambah 11 tes MySQL nyata untuk company, branch/department/sub-department/self, IDOR, soft-delete, relasi legacy lintas company, permission gaji pada profil pegawai, scope lookup gagal, nominal THR dan logging. Repository gaji, employee, dan konfigurasi scope memakai database nyata; event bus/logger dimock. Satu skenario kegagalan lookup scope diinjeksi melalui spy.

`employee-salary.routes.test.ts` menambah 13 tes HTTP; suite tersebut kini berisi 23 tes. Router, CompanyScope, Authorize dan validator nyata dipakai dengan authentication/audit/service mock. Tes memeriksa company context, permission, UUID, query berbentuk object, tanggal nyata, envelope error dan no-store.

Jalankan dari backend dengan schema repository pada database sintetis lokal:

```sh
PAYROLL_SALARY_DB_URL='mysql://root@127.0.0.1:13367/hris_payment_integration' npm test -- --runInBand employee-salary-read.mysql employee-salary.routes employee.scope
```

Fixture hanya memakai UUID miliknya sendiri dan dibersihkan setelah tes. Suite MySQL menolak host/database di luar database lokal tersebut, serta dilewati jika environment variable tidak diberikan. Hasil gabungan terbaru ada pada [status implementasi](checklist-implementation-status.md).

Tidak ada perubahan schema, migration, UI, atau database aplikasi. Run/period/payslip dan boundary HTTP ledger/export kini dilanjutkan pada [fase scope run dan payslip](payroll-run-payslip-access.md). Matriks seluruh payroll belum lengkap: konsumen gaji pada kalkulasi EWA/lembur/final payroll, konfigurasi/formula dan laporan masih memerlukan audit tersendiri. Histori gaji berdasarkan effective date perlu membedakan alokasi yang digantikan dari penonaktifan manual; perubahan ini tidak menebak makna record nonaktif legacy, menjadwalkan aktivasi, atau membuat correction run retroaktif.
