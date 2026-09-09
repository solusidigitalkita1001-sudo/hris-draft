# Integritas perubahan alokasi gaji — 9 September 2026

Pembuatan alokasi gaji sebelumnya menonaktifkan gaji lama sebelum menyimpan gaji baru, melalui operasi terpisah. Update juga menghapus/membuat ulang komponen sebelum menyimpan perubahan parent salary. Kegagalan penyimpanan dapat meninggalkan pegawai tanpa gaji aktif atau komponen yang hanya berubah sebagian. Referensi employee/component belum divalidasi eksplisit terhadap company dan data scope di jalur mutasi tersebut.

Fase ini membuat kedua mutasi atomik, memvalidasi nominal serta referensi, dan melindungi field finansial alokasi yang sudah digunakan pada slip. Pemilihan histori gaji berdasarkan effective date belum ditambahkan.

## Kontrak API

Endpoint dan envelope respons tetap sama:

| Endpoint | Permission | Hasil |
| --- | --- | --- |
| `POST /api/v1/payroll/employee-salaries` | `payroll:create` | 201, alokasi baru aktif |
| `PATCH /api/v1/payroll/employee-salaries/:id` | `payroll:update` | 200, alokasi diperbarui |

Company berasal dari konteks server yang telah divalidasi. `companyId` pada create sekarang opsional. Client lama tetap boleh mengirimnya untuk memilih company yang memang ditugaskan kepada aktor; middleware memvalidasi pilihan dan meneruskannya ke konteks request. Service menolak company yang berbeda dari konteks tersebut. `employeeId` adalah target pegawai, bukan identitas aktor, sehingga tetap diperlukan saat create dan harus berada dalam scope payroll aktor.

Create menerima `employeeId`, `effectiveDate` ISO datetime, `baseSalary`, `currency` (default IDR), `notes` dan `components`. Update menerima `baseSalary`, `currency`, `effectiveDate`, `notes`, `isActive` dan `components`. Field identitas aktor/status/server yang tidak dikenal dihapus validator; update tidak dapat memindahkan alokasi ke employee/company lain. Patch kosong atau hanya berisi field yang tidak dikenal ditolak.

- `baseSalary` dan setiap `components[].amount` harus number finite, lebih besar dari nol, maksimal `9999999999999.99`, dan maksimal dua desimal. Nilai tidak dibulatkan diam-diam oleh database. Nol, negatif, null, pecahan berlebih dan overflow ditolak dengan 422.
- Currency baru/yang diedit dibatasi IDR, sesuai kemampuan kalkulasi payroll saat ini.
- Maksimal 512 komponen per alokasi; ID komponen harus unik. Seluruh komponen yang diserahkan harus aktif, belum dihapus, dan milik company yang sama.
- `effectiveDate` harus tanggal nyata dalam ISO datetime. Service menolak alokasi lain milik employee/company yang sama pada tanggal UTC yang sama, meskipun jam berbeda. Guard berlaku pada create dan perubahan tanggal; record soft-delete dikecualikan. Duplikasi menghasilkan 409.
- Update tanpa `components` mempertahankan daftar sebelumnya; `components: []` secara eksplisit mengosongkannya. Gaji pokok tidak otomatis membuat komponen allowance baru—perilaku mesin kalkulasi yang ada tetap berlaku.

Validasi dijalankan di HTTP dan di service, sehingga pemanggil internal juga tidak dapat memasukkan payload finansial invalid. Service mutasi memerlukan aktor dan company context; seed/worker tidak dianggap otomatis mendapat otorisasi mutasi tersebut.

## Transaksi, konkurensi dan gaji lama

Seluruh pembacaan/penulisan mutasi berjalan dalam transaksi Serializable, dengan lock row company yang sama dengan kalkulasi payroll dan publikasi formula. Batas tunggu koneksi 10 detik, timeout transaksi 60 detik; konflik `P2034` dicoba ulang maksimal dua kali.

Create memeriksa target pegawai dan komponen, mendeteksi tanggal duplikat serta beberapa gaji aktif legacy, menonaktifkan gaji aktif sebelumnya, kemudian menyimpan alokasi baru beserta komponennya dalam transaksi yang sama. Kegagalan pada tahap mana pun mengembalikan kondisi sebelumnya. Beberapa alokasi aktif legacy menghasilkan 409 untuk ditinjau; service tidak memilih salah satunya secara acak.

Update mengganti komponen dan parent salary dalam satu transaksi. Aktivasi alokasi ditolak jika ada alokasi lain yang aktif untuk pegawai tersebut. Saat aktivasi, nominal/currency dan komponen tersimpan juga divalidasi jika tidak diganti oleh request, untuk mencegah pengaktifan ulang referensi legacy yang invalid.

Request create bersamaan pada tanggal efektif yang sama menghasilkan satu alokasi dan satu conflict. Aktivasi bersamaan menghasilkan maksimal satu alokasi aktif. Guard ini berlaku pada jalur service aplikasi; tidak ada unique constraint atau migration baru yang melindungi penulisan SQL langsung di luar aplikasi.

Jika suatu payslip sudah menunjuk `employeeSalaryId`, patch `baseSalary`, `currency`, `effectiveDate` atau `components` ditolak dengan 409, termasuk payload dengan nominal yang kebetulan sama. Buat alokasi baru untuk perubahan finansial. Catatan administratif dan status aktif tetap dapat diubah; pembuatan alokasi berikutnya juga boleh menonaktifkan alokasi lama. Slip yang sudah tersimpan tidak dihitung ulang.

Kalkulasi dan mutasi salary memakai lock yang sama. Jika payroll lebih dahulu memakai alokasi dan commit, update finansial berikutnya melihat payslip tersebut dan ditolak. Jika update lebih dahulu commit, kalkulasi membaca alokasi yang sudah diperbarui. Tidak ada kondisi edit finansial menyusup setelah slip dibuat di dalam transaksi payroll.

## Scope dan audit

Target employee pada create dan parent employee pada update diperiksa langsung dalam query database, menggunakan company dan konfigurasi data scope resource `payroll`. Scope employee-module yang lebih luas tidak memperluas mutasi payroll. Filter branch, department, sub-department dan self memakai resolver server yang sama; MANAGER_TEAM tetap fail-closed. Pegawai di luar scope, pegawai dihapus, atau salary lintas company menghasilkan 404 tanpa mutasi. Payload company di luar assignment ditolak 403.

Fase ini mencakup mutasi alokasi gaji. List/detail salary, THR dan nested salary pada profil pegawai kini ditangani pada [fase scope baca](payroll-salary-read-access.md). Run/period/payslip dan boundary HTTP ledger/export dilanjutkan pada [fase scope run/payslip](payroll-run-payslip-access.md); konsumen gaji lain tetap membutuhkan audit. Permission tetap diperiksa middleware route; service bukan pengganti pemeriksaan permission HTTP.

Audit route tetap menggunakan mekanisme hash-chain yang ada. Untuk EmployeeSalary, nilai `baseSalary`, `components`, `notes` dan nested `employee` disamarkan sebagai `[redacted]`; nama field yang berubah tetap tercatat. Audit create sekarang dapat mengambil entity ID dari respons ketika tidak ada ID di path. PII masking default pada modul lain tetap berlaku.

Audit tersebut masih ditulis setelah respons selesai dan bersifat best-effort, terpisah dari transaksi salary. Belum ada jaminan durable audit jika proses mati setelah commit, snapshot komponen lama yang lengkap, atau entry terpisah bagi setiap alokasi lama yang otomatis dinonaktifkan. Audit historis yang sudah menyimpan nilai sensitif tidak diubah otomatis. Penyelesaian audit atomik/redaction seluruh modul tetap backlog.

## Batas effective date dan data legacy

`isActive` masih menentukan alokasi yang dipakai kalkulasi. Membuat gaji dengan tanggal mendatang tetap langsung menonaktifkan gaji sebelumnya; tanggal itu belum menjadwalkan aktivasi atau memilih histori payroll. Jangan menganggap fase ini telah menyediakan payroll historis, penjadwalan kenaikan gaji, prorata perubahan di tengah periode, atau correction retroaktif. Histori assignment pegawai, pembekuan sumber attendance saat review, dan kebijakan unpaid/partial-day leave juga belum berubah.

Alokasi legacy non-IDR, duplikasi tanggal, komponen lintas company dan beberapa gaji aktif tidak dimigrasikan atau diperbaiki otomatis. Metadata/deaktivasi tetap tersedia untuk penanganan administratif; aktivasi dan perubahan finansial mengikuti guard baru. Master salary component yang direferensikan mempunyai lifecycle sendiri; perlindungan field alokasi bukan versioning semua metadata master.

Tidak ada perubahan schema, migration, UI, atau data pada database aplikasi. Empat migration formula/ledger dari fase sebelumnya tetap diperlukan bagi schema aplikasi yang sudah ada.

## Pengujian

- `employee-salary.mysql.test.ts`: 13 tes MySQL nyata untuk transaksi, rollback setelah insert/replace, retry, duplicate create dan activation bersamaan, perlindungan alokasi yang dipakai payroll, company/scope, data legacy, dan komponen kosong. Repository salary, payroll, scope dan sumber kalkulasi memakai database; event bus/logger dimock.
- `employee-salary.dto.test.ts`: 17 tes validasi nominal besar/pecahan/negatif/null/currency, tanggal nyata, duplikasi komponen, field server dan patch kosong.
- `employee-salary.routes.test.ts`: 10 tes mutasi HTTP memakai router, CompanyScope, Authorize dan validator nyata; authentication, audit serta service dimock. Tes memeriksa permission, company yang diperbolehkan/dilarang, context propagation dan bentuk payload. Fase scope baca menambah 13 tes, sehingga suite sekarang berisi 23 tes.
- `AuditLog.redaction.test.ts`: tiga tes masking create/update/delete dan kompatibilitas diff default.

Jalankan dari backend menggunakan schema repository pada database lokal sintetis:

```sh
PAYROLL_SALARY_DB_URL='mysql://root@127.0.0.1:13367/hris_payment_integration' npm test -- --runInBand employee-salary AuditLog.redaction
```

Suite MySQL hanya menerima host localhost/127.0.0.1 dan nama database tersebut; tanpa environment variable, suite dilewati. Fixture menggunakan UUID miliknya sendiri dan dibersihkan setelah tes. Hasil gabungan ada di [status implementasi](checklist-implementation-status.md).
