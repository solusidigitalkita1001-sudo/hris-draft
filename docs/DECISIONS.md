# Keputusan yang diambil tanpa menunggu konfirmasi

Aturan yang dipakai di seluruh dokumen ini: kalau sebuah tugas butuh keputusan,
opsinya ditulis di sini apa adanya, lalu yang dipilih adalah **yang paling aman
dan paling mudah dibalik**. Setiap entri menyebut cara membalikkannya, supaya
menolak keputusan ini tidak pernah lebih mahal dari satu commit revert.

Hal yang butuh angka atau format dari sumber resmi (tarif pajak, tarif BPJS,
format file lapor pemerintah) **tidak ditebak**. Itu dicatat sebagai dilewati,
bukan dikira-kira.

---

## D-001 — Nomor karyawan: boleh dibawa pelanggan atau selalu di-generate?

**Konteks.** `docs/tenant-onboarding.md` mencatat ini sebagai objection hari
pertama di setiap demo HRIS dan belum diperbaiki: `employeeNumber` selalu
di-generate (`EMP-SITI-261002-A3F1`), dan nilai yang dikirim klien dibuang
tanpa pemberitahuan — padahal DTO-nya menerima field itu sejak awal
(`employeeBaseSchema`, `employee.dto.ts:32`) dan import CSV sudah menghormatinya
(`employee.service.ts`, jalur `dto.employeeNumber || generateSystemCode(...)`).
Jadi dua jalur masuk yang sama berperilaku berbeda.

| Opsi | Akibat |
|---|---|
| **A. Pakai nomor yang dikirim kalau ada, generate kalau tidak** | Jalur create jadi sama dengan import CSV. Perusahaan yang pindah dari payroll lain bisa mempertahankan penomorannya. |
| B. Tetap selalu generate, hanya indeks database yang dibetulkan | Paling sedikit perubahan perilaku, tapi objection-nya tetap terbuka dan dua jalur masuk tetap berbeda. |
| C. Seperti A, plus boleh diganti lewat `update()` | **Tidak diambil.** Nomor karyawan dipakai sebagai rujukan di data historis; menggantinya setelah payroll jalan memutus jejak itu. `update()` sengaja menolaknya hari ini, dan itu tetap. |

**Dipilih: A.** Alasannya bukan sekadar lebih berguna, tapi karena perilaku ini
sudah ada di produk — di import CSV — jadi A menyamakan, bukan menambah
permukaan baru. Nilainya tetap lewat validasi zod yang sudah ada
(`min(1).max(50)`), dan kalau kosong/spasi saja, tetap jatuh ke generate.

**Cara membalikkan.** Hapus `requested ||` di `employeeService.create`. Satu
baris; indeks database tidak perlu ikut dibalik.

---

## D-002 — Unik per instalasi atau per perusahaan?

**Konteks.** `employees.employee_number` unik **global**, sementara **semua**
pemeriksaan di aplikasi sudah per perusahaan (`findByEmployeeNumber(companyId,
number)`, dan pemindaian duplikat di import CSV). Kode dan database tidak
sepakat: tenant kedua yang memakai nomor milik tenant pertama lolos validasi,
lalu mati di indeks dengan error constraint mentah — bukan 409 yang rapi.

| Opsi | Akibat |
|---|---|
| **A. Longgarkan ke `@@unique([companyId, employeeNumber])`** | Database jadi sepakat dengan logika yang sudah ada. Tidak bisa gagal pada data lama: kalau `(employee_number)` unik, `(company_id, employee_number)` pasti unik juga. |
| B. Biarkan global, ubah semua pemeriksaan aplikasi jadi global | Menutup ketidaksepakatannya dari arah sebaliknya, tapi menjadikan penomoran satu tenant sebagai batasan bagi tenant lain — persis masalah yang dilaporkan. |

**Dipilih: A**, dan ini mengikuti preseden yang sudah ada di repo: migrasi
`20261002100000_tenant_scoped_leave_and_benefit_codes` melakukan hal yang sama
untuk `LeaveType.code` dan `BenefitPlan.code`. Model `Employee` juga sudah
memakai pola ini untuk `@@unique([companyId, idNumber])` dan
`@@unique([companyId, phone])`.

**Cara membalikkan.** Migrasi turun: drop indeks komposit, buat ulang yang
single-column. Hanya mungkin kalau belum ada tenant yang memakai nomor kembar —
yang memang baru bisa terjadi setelah migrasi ini, jadi membalikkan lebih awal
selalu aman.

**Satu hal yang ikut diperbaiki, bukan keputusan.** `findByEmployeeNumber`
menyaring `deletedAt: null`, sedangkan indeks unik tidak tahu soal soft delete.
Jadi nomor milik karyawan yang sudah dihapus lolos pemeriksaan lalu gagal di
database. Pemeriksaan konflik di `create()` sekarang melihat baris yang
soft-deleted juga.

---

## D-003 — Basis PR: `main` atau branch berjalan?

Branch `feat/tenant-onboarding` punya 3 commit yang belum masuk `main`, dan
pekerjaan ini menumpuk di atasnya (migrasinya mengikuti preseden dari commit di
sana). PR diarahkan ke **`feat/tenant-onboarding`**, bukan `main`, supaya diff
tiap PR hanya berisi tugasnya sendiri. `main` tidak disentuh dan tidak ada
merge yang dijalankan.

---

## D-004 — Test tidak bisa jalan di mesin ini: siapa yang jadi verifier?

**Konteks.** Repo ada di dalam folder yang disinkronkan iCloud Drive dan isinya
sebagian `dataless`, jadi jest gagal tiga kali di lapisan I/O (`ECANCELED`,
`ETIMEDOUT errno -60` di `fs.readFileSync`). Rinciannya di
[PROGRESS.md](PROGRESS.md).

| Opsi | Akibat |
|---|---|
| **A. CI yang menjalankan test** | Nol perubahan di luar repo. `.github/workflows/ci.yml` berjalan pada `push: branches: ['**']`, jadi mendorong branch sudah memicu type-check + build + lint + test. Iterasi lebih lambat, dan test merah tidak bisa diperbaiki cepat. |
| B. Pindahkan repo ke luar `~/Documents` | Test lokal jalan normal, tapi mengubah lokasi kerja di mesin orang lain tanpa diminta. |
| C. Matikan sinkronisasi folder Documents | Memperbaiki akarnya, tapi itu pengaturan pribadi sistem, bukan bagian dari repo. |

**Dipilih: A.** Satu-satunya opsi yang tidak menyentuh apa pun di luar repo,
jadi satu-satunya yang tidak perlu dibalik kalau ditolak. B dan C tetap pilihan
pemilik mesin; begitu salah satunya diambil, verifikasi lokal langsung bisa
dipakai lagi tanpa membatalkan apa pun yang sudah dikerjakan.

**Konsekuensi yang harus dipegang:** tugas tidak boleh disebut selesai
berdasarkan pembacaan kode. Statusnya mengikuti hasil CI di branch tugas itu.
