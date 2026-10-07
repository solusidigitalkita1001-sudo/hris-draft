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

Rencana awal: PR bertumpu pada `feat/tenant-onboarding`, yang punya 3 commit
belum masuk `main`, supaya diff tiap PR hanya berisi tugasnya sendiri.

**Itu tidak bisa dilakukan.** `feat/tenant-onboarding` ternyata hanya ada di
lokal — GitHub menolak dengan `Base ref must be a branch`. Mendorong branch itu
lebih dulu berarti mempublikasikan tiga commit yang bukan bagian dari tugas ini,
jadi tidak dilakukan.

PR pertama (#96) karena itu diarahkan ke **`main`** dan memuat 4 commit. Yang
tidak dilakukan: push ke `main`, dan merge apa pun. Base sebuah PR bisa diganti
satu klik, jadi kalau `feat/tenant-onboarding` nanti didorong, PR #96 tinggal
diarahkan ulang.

PR tugas-tugas sesudahnya bertumpu pada branch tugas sebelumnya (yang sudah ada
di remote), jadi diff per PR kembali bersih satu tugas.

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

---

## D-005 — Sepuluh model membuang kode pelanggan: perbaiki sekaligus atau satu dulu?

**Konteks.** [tenant-scoped-codes-audit.md](tenant-scoped-codes-audit.md)
menemukan sepuluh model yang menerima `code` dari klien lalu membuangnya tanpa
pemberitahuan, dan kodenya unik di seluruh instalasi padahal modelnya
per-perusahaan. Tidak ada bug data di sana — `generateSystemCode` menempel
tanggal dan empat digit acak — yang rusak adalah pelanggan tidak bisa memakai
kodenya sendiri. Test tidak bisa dijalankan di mesin ini (lihat D-004).

| Opsi | Akibat |
|---|---|
| A. Sepuluh model dalam satu migrasi | Satu kali kerja, satu kali review. Tapi sepuluh jalur tulis berubah sekaligus sementara verifier satu-satunya adalah CI yang baru menjawab setelah push — kalau merah, sepuluh perubahan harus dibongkar untuk mencari yang mana. |
| **B. Satu model dulu sebagai pola** | `Asset.assetCode`: paling kecil, paling jelas milik pelanggan (nomor aset dicetak di stiker sebelum masuk sistem), dan tidak punya jalur masuk kedua seperti import CSV-nya karyawan. Polanya terbukti di CI, sembilan sisanya menyusul sebagai pekerjaan mekanis. |
| C. Biarkan, cukup didokumentasikan | Audit berhenti jadi laporan yang tidak pernah ditindaklanjuti. |

**Dipilih: B.** Dengan satu model, diff-nya cukup kecil untuk dibaca utuh, dan
kalau CI merah penyebabnya cuma bisa satu. Pelajaran dari tugas sebelumnya
membuat ini bukan kehati-hatian kosong: `@unique` yang dilepas memutus `upsert`
di seed yang lewat `(prisma as any)`, dan itu baru kelihatan di CI. Sepuluh model
berarti sepuluh kali kesempatan seperti itu dalam satu push.

**Yang ikut diputuskan:** `Asset.assetCode` tetap punya `@@index([assetCode])`
sesudah indeks unik globalnya dilepas, karena pencarian lintas-perusahaan di
layar admin platform memakai kode saja. `Role.code` **tidak** masuk daftar
sembilan sisanya — `companyId`-nya nullable, dan di MySQL beberapa baris dengan
`company_id IS NULL` tetap lolos indeks unik komposit, jadi keunikan role
platform justru hilang. Model itu butuh keputusan sendiri.

---

## D-006 — `Role.code`: ikut dibuat per perusahaan, atau tetap milik server?

**Konteks.** `Role` adalah satu-satunya sisa dari
[tenant-scoped-codes-audit.md](tenant-scoped-codes-audit.md). Modelnya berbeda
dari sepuluh model lain: `companyId` **nullable**, dan tujuh role tingkat-platform
(`companyId: null`, `isSystem: true`, kode `SUPER_ADMIN` … `EMPLOYEE` dari
`02-roles.seed.ts`) hidup di tabel yang sama dengan role milik tenant. Seed-nya
meng-`upsert` role itu dengan `where: { code }`.

| Opsi | Akibat |
|---|---|
| **A. Tetap unik global; tolak kode kiriman klien secara terang-terangan** | Keunikan role platform tetap dijaga database, seed tetap bisa `upsert` lewat `code`, dan `POST /rbac` berhenti menerima field yang diam-diam dibuang. Yang tidak didapat: pelanggan tidak bisa memilih kode role sendiri. |
| B. `@@unique([companyId, code])` seperti sepuluh model lain | Di MySQL beberapa baris dengan `company_id IS NULL` **semuanya lolos** indeks unik komposit, jadi keunikan role platform hilang dari database. Prisma juga tidak menerima `null` di dalam composite unique `where`, jadi `upsert` di seed dan setiap pencarian role platform lewat kode harus dibongkar. |
| C. Kolom generated `COALESCE(company_id, 'PLATFORM')` + indeks unik di `(kolom itu, code)` | Dua-duanya terjaga di database — ini jawaban paling benar secara SQL. Tapi Prisma tidak bisa memodelkan generated column, jadi `prisma migrate diff` akan selalu melaporkan drift (job-nya soft, jadi ia akan mengomel selamanya), dan tetap tidak ada composite key untuk `upsert`. |
| D. Pisahkan role platform ke tabelnya sendiri | Pemodelan yang paling jujur, tapi menyentuh setiap query RBAC dan setiap baris `user_roles`. Tidak sepadan untuk masalah yang belum pernah terjadi. |

**Dipilih: A.** Bukti bahwa kode role bukan data pelanggan ada di produknya
sendiri: form role di `RoleListPage.tsx` menampilkan field kode sebagai
`disabled` dengan placeholder "otomatis", dan payload yang dikirimnya memang tidak
pernah memuat `code`. Kode role adalah mesin internal — yang dipakai seed,
dipegang role platform, dan dirujuk RBAC — bukan sesuatu yang dibawa pelanggan
dari sistem lama seperti nomor karyawan atau nomor aset.

B ditolak karena menukar jaminan database dengan jaminan aplikasi; itu justru
jenis ketidaksepakatan kode-vs-database yang dibereskan tugas-tugas sebelumnya.
C disimpan sebagai jalan keluar **kalau** suatu hari pelanggan benar-benar perlu
memilih kode role sendiri; saat itu drift Prisma jadi harga yang masuk akal.

**Yang dikerjakan karena A:** `code` tidak lagi diterima
`createRoleSchema`/`updateRoleSchema` — dikirim pun ditolak 400 dengan alasannya,
bukan dibuang tanpa suara. Indeks unik global `roles.code` tidak disentuh, jadi
tugas ini tidak punya migrasi.

---

## D-007 — Komponen gaji sistem yang sudah di-soft-delete: hidupkan, gagalkan, atau biarkan?

**Konteks.** Dua belas helper `ensure*Component` di `payroll.service.ts` memakai
pola yang sama: cari komponen berdasarkan kode, kalau tidak ada buat baru.
Pencariannya menyaring `deletedAt: null`, sementara `@@unique([companyId, code])`
tidak tahu soal soft delete. Jadi kalau ada yang menghapus `EWA-DEDUCT` atau
`LATE_DEDUCTION_AUTO`, pencarian bilang "kosong", `INSERT` jalan, lalu **mati di
indeks unik — di dalam transaksi payroll run.** Bukan 409 di form, tapi
perhitungan payroll yang gagal.

| Opsi | Akibat |
|---|---|
| **A. Hidupkan kembali (`upsert` yang mengosongkan `deletedAt`)** | Run selesai. Komponen ini milik sistem, bukan milik pengguna — tuas untuk "jangan potong keterlambatan" adalah policy-nya, bukan menghapus baris masternya. Dan helper-nya hanya dipanggil ketika engine memang perlu memposting baris itu. |
| B. Gagalkan run dengan error yang jelas | Benar secara prinsip "jangan ubah data diam-diam", tapi payroll berhenti karena sesuatu yang **tidak bisa diperbaiki admin dari UI**: tidak ada layar untuk memulihkan komponen yang sudah dihapus. |
| C. Buat baris baru dengan kode lain (misal bersuffix) | Master komponen jadi berisi duplikat, dan laporan yang mengelompokkan per kode pecah. |
| D. Biarkan (status quo) | Payroll run mati dengan error constraint mentah. |

**Dipilih: A.** Hanya berlaku untuk dua belas kode milik sistem lewat
`reviveOrCreateSystemSalaryComponent`; komponen buatan pengguna tidak ikut
dihidupkan oleh jalur mana pun.

**Yang tidak diputuskan di sini:** untuk komponen **buatan pengguna**, membuat
komponen dengan kode yang masih dipegang komponen terhapus sekarang menjawab
**409**, bukan 500 seperti sebelumnya. Itu perbaikan, tapi menyisakan satu celah
UX: belum ada cara memulihkan komponen yang di-soft-delete, jadi kodenya terkunci.
Menambah endpoint restore adalah pekerjaan tersendiri, bukan tempelan di sini.

**Sudah ditutup.** Celah itu kini punya jalurnya sendiri:
`GET /payroll/salary-components/deleted` untuk melihat apa yang bisa dipulihkan,
dan `POST /payroll/salary-components/:id/restore` untuk memulihkannya —
`payroll:update`, beraudit, dan `companyId`-nya diambil dari konteks karena
endpoint itu hanya punya `:id`. Keunikan tidak perlu diperiksa saat restore:
`@@unique([companyId, code])` mencakup baris terhapus, jadi selama baris itu ada,
tidak mungkin ada baris lain di perusahaan yang sama dengan kode yang sama.
Dipilih dibanding "revive otomatis saat create" karena yang itu akan menghidupkan
baris lama dengan `id` yang sama secara diam-diam — payslip historis yang
mereferensikan id itu ikut berubah arti.
---

## D-008 — `Employee.email` unik se-instalasi: dibiarkan atau dipindah per perusahaan?

**Konteks.** Ini satu-satunya field unik global yang lolos audit
[tenant-scoped-codes-audit.md](tenant-scoped-codes-audit.md) **dengan sengaja**:
di sana kode dan database sepakat, karena `findByEmail(email)` juga tidak
discoped. Pertanyaannya tetap perlu dijawab eksplisit, karena konsekuensinya
nyata: satu orang tidak bisa jadi karyawan di dua tenant dengan email yang sama.

**Satu koreksi atas dugaan awal.** Sempat diduga memindahkannya akan menyentuh
autentikasi. Ternyata tidak: login, reset password, dan sesi semuanya memakai
model **`User`** (`auth.repository.ts` hanya menyentuh `prisma.user`), yang punya
kolom email sendiri. `Employee.email` murni data master karyawan, dan satu-satunya
pemakainya adalah dua pemeriksaan keunikan di `create` dan `update`. Jadi alasan
"ini jalur login" tidak berlaku, dan keputusan di bawah berdiri di atas alasan
lain.

| Opsi | Akibat |
|---|---|
| **A. Tetap unik global** | Satu email = satu orang di seluruh instalasi. Itu asumsi yang dipegang notifikasi dan pengiriman payslip: alamat tujuan dicari dari data karyawan, dan dua profil beremail sama membuat "payslip siapa yang dikirim ke alamat ini" jadi ambigu. Yang hilang: orang yang bekerja di dua tenant pelanggan harus memakai dua alamat. |
| B. `@@unique([companyId, email])` | Satu orang bisa punya profil di dua tenant. Tapi setiap pembaca email karyawan harus memutuskan tenant mana yang dimaksud, dan jalur pengiriman payslip/notifikasi adalah tempat keputusan itu paling mudah salah — ke-salahannya mengirim data gaji orang ke alamat yang benar tapi tenant yang salah. |
| C. Biarkan global, tapi bolehkan email kosong rangkap | Sudah berlaku: kolomnya nullable, jadi karyawan tanpa email tidak pernah bertabrakan. |

**Dipilih: A, dan dicatat sebagai keputusan, bukan sebagai temuan yang
tertinggal.** Kalau nanti ada pelanggan yang benar-benar perlu satu orang di dua
tenant, yang berubah bukan hanya indeksnya: setiap pembaca `Employee.email` harus
ikut discoped lebih dulu, terutama pengiriman payslip. Itu pekerjaan yang jauh
lebih besar dari sepuluh kode di PR #96, dan tidak boleh diambil hanya karena
polanya kelihatan mirip.

**Yang ikut diperbaiki saat memutuskan ini:** `findByEmail` menyaring
`deletedAt: null` padahal indeks uniknya mencakup baris terhapus — jadi email
milik karyawan yang sudah dihapus lolos pemeriksaan lalu gagal di indeks. 500,
bukan 409. Filternya dihapus; lubang yang sama persis dengan komponen gaji
(D-007) dan benefit plan.
