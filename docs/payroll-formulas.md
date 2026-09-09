# Formula payroll — versi, simulasi, dan bukti perhitungan

Implementasi P1, 8 September 2026. Formula terhubung ke komponen gaji, proses payroll, dan detail slip. Dukungan saat ini untuk IDR. Koreksi retroaktif melalui adjustment payroll terpisah belum tersedia.

## Alur penggunaan

1. Buat komponen dengan metode dasar `FIXED` atau `PERCENTAGE`, lalu alokasikan kepada pegawai.
2. Pada daftar komponen gaji, pilih **Formula**, isi ekspresi dan tanggal efektif, lalu simpan draft.
3. Jalankan simulasi dengan input contoh. Nominal referensi dapat diisi untuk simulasi; jika kosong, server memakai nominal master. Nominal ini tidak mewakili alokasi gaji pegawai tertentu.
4. Pengguna lain dengan izin persetujuan payroll meninjau ekspresi, menjalankan simulasi, dan mengonfirmasi publikasi. Pembuat draft tidak boleh memublikasikan draft sendiri, termasuk SUPER_ADMIN.
5. Payroll memilih versi terpublikasi berdasarkan **tanggal awal periode**, bukan tanggal eksekusi atau tanggal pembayaran. Semua pegawai dalam satu run memakai kumpulan versi yang dibaca sekali.
6. Detail slip menyediakan **Jejak perhitungan formula** berisi ekspresi, input, dependensi, dan hasil yang disimpan saat kalkulasi.

Metode dasar tetap berlaku sebelum tanggal efektif pertama. Versi baru harus bertanggal setelah versi terakhir yang dipublikasikan untuk komponen tersebut. Tanggal yang mencakup run payroll yang sudah ada ditolak. Publikasi berikutnya tidak memperbarui slip lama.

Draft dan versi terpublikasi tidak memiliki endpoint edit. Perubahan dilakukan dengan membuat revisi baru. Publikasi berulang mengembalikan versi yang sama, tanpa menggandakan audit publikasi. Pembuatan draft belum memiliki idempotency key; setelah respons simpan hilang, muat ulang daftar untuk memeriksa apakah draft sudah tersimpan.

## Bahasa formula dan nominal

Grammar hanya menerima literal desimal, variabel berikut, `+`, `-`, `*`, `/`, tanda kurung, `min(a,b)`, `max(a,b)`, `round(a)` atau `round(a,0|1|2)`, serta `component("KODE")`. `round(a)` menggunakan dua desimal. Tidak ada `eval`, JavaScript, akses properti, array, I/O, waktu, random, percabangan, maupun fungsi tambahan.

| Variabel | Sumber saat payroll |
| --- | --- |
| `BASE_SALARY` | Gaji pokok dari alokasi gaji pegawai |
| `WORK_DAYS` | Hitungan hari kerja kalender company; nol jika kalender tidak tersedia |
| `PRESENT_DAYS` | Jumlah record kehadiran PRESENT/LATE dalam periode |
| `LEAVE_DAYS` | Rekap cuti disetujui dari proses payroll yang ada |
| `ABSENT_DAYS` | Maksimum nol atau hari kerja dikurangi hadir dan cuti |
| `OVERTIME_HOURS` | Jam lembur disetujui dalam periode |

Contoh prorata eksplisit:

```text
BASE_SALARY * PRESENT_DAYS / WORK_DAYS
```

Contoh batas tunjangan dan referensi komponen:

```text
min(BASE_SALARY / 10, 500000) + component("MEAL")
```

Referensi harus aktif, berada dalam company yang sama, dan dialokasikan pada pegawai saat payroll dihitung. Nominal referensi berasal dari hasil komponen tersebut, termasuk formula terpublikasi yang efektif. Ketergantungan pada BPJS-TK, BPJS-KES, PPH21, LOAN_DEDUCTION_AUTO, OVERTIME_EARNING_AUTO, LATE_DEDUCTION_AUTO, ABSENCE_DEDUCTION_AUTO, dan EWA-DEDUCT ditolak. Komponen sistem itu tetap memakai mesin khususnya; formula juga tidak dapat dipasang pada komponen tersebut.

Hitungan formula menggunakan Decimal berpresisi 40 digit, terisolasi dari konfigurasi Decimal global. Setiap hasil komponen dibulatkan dua desimal dengan HALF_UP **sebelum** digunakan sebagai dependensi. Misalnya `0.105` menjadi `0.11`; komponen lain yang mengalikannya dengan tiga menghasilkan `0.33`. Hasil wajib nonnegatif dan tidak melebihi `9999999999999.99` (Decimal 15,2). Nilai antara dibatasi hingga absolut 10^26. Pembagian nol, hasil negatif/overflow, input invalid, metode tanpa versi efektif, dan engine version yang tidak didukung ditolak.

Batas ekspresi: 2.048 karakter, 256 token, 128 node, kedalaman parser/dependensi 32, dan 512 ekspresi pada graph company. Literal maksimal 13 digit utuh dan enam desimal. Input dikirim sebagai string numerik; hari kerja/hadir berupa bilangan bulat, cuti/absen/lembur boleh pecahan. Semua input selain gaji dibatasi 10.000.

Formula menentukan nominal komponen. Flag `isTaxable` tetap menentukan partisipasi allowance dalam gross pajak pada mesin PPh21 yang ada. Flag `isProrated` tidak menambahkan pengali tersembunyi ke formula; tulis prorata dalam ekspresi. Simulasi nominal komponen bukan simulasi seluruh slip/pajak.

## Kontrak HTTP

Prefix relatif terhadap `/api/v1/payroll/formulas`:

| Method dan path | Permission |
| --- | --- |
| `GET /:componentId/versions` | `payroll:read` |
| `POST /:componentId/versions` | `payroll:update` |
| `POST /:componentId/versions/:versionId/preview` | `payroll:update` **atau** `payroll:approve` |
| `POST /:componentId/versions/:versionId/publish` | `payroll:approve`, aktor berbeda dari pembuat |

UI daftar tetap memerlukan `payroll:read`; reviewer dapat memiliki read+approve tanpa update. Semua endpoint memerlukan session dan company yang telah divalidasi. Company/aktor berasal dari konteks server; body tidak dapat menetapkan pembuat, publisher, nomor versi, atau status. Wildcard permission dan SUPER_ADMIN mengikuti middleware standar, tetapi larangan self-publication tetap berlaku di service. Respons memakai envelope `Result.success` dan `Cache-Control: no-store`, termasuk kegagalan autentikasi.

Body draft:

```json
{"expression":"BASE_SALARY / 10","effectiveFrom":"2026-10-01"}
```

Body simulasi:

```json
{
  "inputs": {
    "BASE_SALARY": "10000000",
    "WORK_DAYS": "20",
    "PRESENT_DAYS": "17",
    "LEAVE_DAYS": "0.5",
    "ABSENT_DAYS": "2.5",
    "OVERTIME_HOURS": "0"
  },
  "componentAmounts": {"MEAL":"25000"}
}
```

`componentAmounts` opsional; input tambahan di dalam `inputs` ditolak. Body publish kosong. Respons preview berisi `versionId`, `amount` string dua desimal, `effectiveFrom`, `engineVersion`, `rounding`, dan hasil komponen dependensi. Error validasi DTO menggunakan 422; formula invalid 400; izin/self-publication 403; company/versi tidak ditemukan 404; konflik preview/tanggal efektif 409.

## Penyimpanan dan konkurensi

- `PayrollFormulaVersion`: ekspresi, hash SHA-256, nomor revisi, engine version, tanggal efektif, pembuat, preview timestamp, status, publisher dan timestamp publikasi.
- `PayrollFormulaAudit`: event DRAFT_CREATED, PREVIEW_SUCCEEDED, PUBLISHED, identitas aktor/company/versi, hash ekspresi, IP dan request ID jika tersedia. Input contoh atau nilai gaji tidak dimasukkan ke audit ini.
- `PayrollFormulaCalculation`: company/run/slip/component/version, ekspresi, nominal Decimal, input JSON, nominal dependensi JSON, dan engine version. Bukti dibuat bersama slip lewat nested create; pembacaan mengikuti akses detail slip yang ada.

Ketiga model masuk daftar model berscope company di middleware Prisma. Service tetap memvalidasi kepemilikan komponen/versi secara eksplisit. Penulisan formula mengunci row company sampai commit, memakai transaksi Serializable dan retry konflik serialisasi terbatas. Graph diperiksa pada tanggal kandidat serta setiap batas tanggal versi mendatang. Penghapusan komponen terpublikasi atau dependensinya ditolak dan menggunakan lock company yang sama.

## Migration dan rollback

Migration: `backend/src/database/prisma/migrations/20260908150000_payroll_formula_versions/migration.sql`.

Rollback manual: [20260908150000_payroll_formula_versions.rollback.sql](migrations/20260908150000_payroll_formula_versions.rollback.sql).

Migration dan rollback telah dijalankan pada MySQL sementara localhost:13367 dengan data sintetis. Setelah fixture dibersihkan, rollback lalu migration ulang menghasilkan schema identik dengan datamodel Prisma. Belum diterapkan ke database aplikasi. Rollback produksi memerlukan penghentian penulisan dan pengarsipan revisi/audit/bukti terlebih dahulu; forward fix lebih sesuai jika formula sudah dipakai. SQL rollback tidak mengoreksi slip atau membalik pembayaran.

## Verifikasi dan batas yang tersisa

Tes deterministik mencakup precedence, desimal/pembulatan, prorata, gross pajak, snapshot dependensi, pemilihan versi historis, input/sintaks terlarang, batas kompleksitas, nol, nilai negatif/overflow, referensi hilang, dan cycle. HTTP tests memakai permission/company middleware nyata dengan autentikasi/service mock. UI tests mencakup reviewer tanpa update, self-publication, konfirmasi, perubahan input setelah simulasi, pemulihan error tanpa kehilangan draft, serta penutupan panel dan pemuatan ulang komponen saat berganti company.

Tes MySQL menguji konkurensi nomor revisi/publikasi, self-publication, preview gagal, cross-company, cycle pada jadwal mendatang, dua publikasi bersamaan yang membentuk cycle, penolakan backdating, perlindungan penghapusan dependensi, serta pembuatan payroll/slip nyata yang menyimpan snapshot dan tetap memakai baseline sebelum tanggal efektif. Kalender, konfigurasi potongan, EWA, dan event bus pada fixture kalkulasi disederhanakan; ini bukan E2E seluruh aplikasi.

Jalankan tes MySQL hanya dengan database lokal sintetis bernama `hris_payment_integration`:

```sh
PAYROLL_FORMULA_DB_URL='mysql://root@127.0.0.1:13367/hris_payment_integration' npm test -- --runInBand payroll-formula.mysql
```

Batas fase ini:

- Retroactive adjustment/correction run belum dibuat; perubahan yang mencakup run lama ditolak dan diuji sebagai conflict. Checklist pengujian retroactive adjustment tetap partial.
- Mulai 9 September, pembuatan run dan seluruh slip/snapshot bersifat atomik; kegagalan kalkulasi membatalkan penulisan. Run parsial legacy tidak diperbaiki otomatis. Lihat [payroll-run-transactions.md](payroll-run-transactions.md).
- Agregasi kalender/kehadiran/cuti tetap mengikuti proses yang ada. Audit sumber data seluruh variasi kalender dan cuti lintas periode belum selesai. Simulasi yang berhasil tidak menjamin seluruh input pegawai valid saat payroll berjalan.
- Belum ada currency selain IDR untuk formula, pembatalan publikasi, rollback otomatis, atau eksekusi pembayaran bank.
- E2E aplikasi lengkap, lint frontend keseluruhan, quality gate CI, serta restore drill produksi masih terbuka. Hasil gabungan ada di [checklist-implementation-status.md](checklist-implementation-status.md).
