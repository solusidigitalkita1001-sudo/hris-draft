# Input kalender dan attendance payroll — 9 September 2026

Pembaruan akses 9 September 2026: run, period/review attendance dan seluruh endpoint payment batch memerlukan scope payroll seluruh company aktif, selain permission endpoint. Lihat [matriks scope run/payslip](payroll-run-payslip-access.md) untuk kontrak dan hasil verifikasi terbaru.

Review attendance dan pembuatan payroll sekarang memakai loader dan aturan hitungan yang sama. Sebelumnya, payroll hanya menghitung baris pengecualian `WorkCalendarDay`, mengabaikan aturan mingguan, dan memilih kalender company tahun terbaru untuk seluruh pegawai. Cuti yang bersinggungan dengan periode juga dijumlahkan memakai seluruh `totalDays` permohonan, sehingga hari di luar periode atau cuti tumpang tindih ikut terhitung.

## Tanggal dan pemilihan jadwal

Tanggal payroll dinormalisasi ke tanggal UTC tanpa komponen jam. Rentang bersifat inklusif, 1–366 hari kalender, dan tidak bergantung pada zona waktu server. Tanggal pertama dari date picker Jakarta yang tersimpan sebagai `05:00Z` tetap menyertakan attendance/leave/overtime `@db.Date` pada tanggal yang sama. Kalender dipilih untuk masing-masing tahun dalam rentang; kalender tahun mendatang tidak menggantikan kalender tahun yang hilang.

Urutan jadwal per pegawai dan tanggal:

1. Snapshot override tukar shift milik company dan pegawai tersebut. Parent request harus masih APPROVED, belum dihapus, memuat pegawai sebagai salah satu peserta, dan bertanggal sama. Source harus SHIFT_SWAP; `dayType` dan `isWorkingDay` harus valid dan konsisten. Metadata invalid menolak payroll.
2. Rotasi untuk pegawai FACTORY yang memiliki konfigurasi shift. Formula harus aktif, belum dihapus, milik company, mempunyai tanggal mulai, dan memiliki urutan hari 1 sampai `cycleLength` yang lengkap. Rotasi menggunakan selisih tanggal UTC, termasuk untuk tanggal sebelum anchor. FACTORY tanpa kedua field konfigurasi memakai kalender biasa; konfigurasi setengah lengkap ditolak.
3. Kalender aktif, belum dihapus, milik company dan tahun yang sesuai: department, lalu branch, lalu company. Jika kalender department mencantumkan branch, branch itu juga harus cocok. Tepat satu kalender pada tingkat terpilih diperlukan; beberapa kalender setara atau kalender yang hilang menyebabkan error.

Baris tanggal khusus mengalahkan aturan mingguan kalender terpilih. WD, WS, dan OT merupakan hari kerja; WE, NH, JL, CH, dan RH merupakan hari libur. Aturan mingguan menerima boolean atau object dengan `enabled` boolean; weekday yang tidak dicantumkan berarti libur. Kalender eksplisit dengan semua hari libur sah dan menghasilkan nol hari kerja. Formula yang membagi `WORK_DAYS` perlu menangani nol sendiri.

Pemilihan ini tidak menggabungkan pengecualian kalender company ke kalender department/branch, dan tidak menerapkan master `NationalHoliday` langsung. Libur tersebut harus tercatat pada kalender efektif melalui pengelolaan kalender yang ada. Shift FACTORY yang terkonfigurasi memakai rotasinya sendiri, sesuai prioritas jadwal.

## Kehadiran, cuti, lembur, dan potongan

Untuk setiap hari kerja terjadwal, hitungan memilih satu kategori:

| Kondisi | Hasil |
| --- | --- |
| Ada attendance PRESENT atau LATE yang belum dihapus | Hadir |
| Tidak hadir, tetapi tercakup permohonan cuti APPROVED yang belum dihapus | Cuti |
| Tidak memenuhi kedua kondisi di atas | Absen |

Satu tanggal dihitung sekali. Kehadiran mengalahkan cuti pada tanggal sama; permohonan cuti bertumpuk tidak menggandakan hari. Cuti hanya dihitung pada irisan tanggal permohonan, periode payroll, dan hari kerja pegawai, tanpa mempercayai `LeaveRequest.totalDays`. Kehadiran/cuti pada hari libur tidak mengurangi absen hari kerja lainnya. Hubungan `workDays = present + leave + absent` selalu berlaku.

Semua cuti APPROVED tetap dianggap sebagai hari berizin, termasuk leave type dengan `isPaid: false`, mempertahankan perilaku payroll sebelumnya. Fase ini **belum menambahkan kebijakan pemotongan khusus unpaid leave**. Field hari pada slip dan permohonan cuti masih integer; cuti setengah hari dan aturan izin/sakit terpisah belum diimplementasikan.

Jam lembur berasal dari request APPROVED dalam periode, termasuk hari libur, dijumlahkan menggunakan Decimal sebelum dipakai sebagai input formula dan slip. Contoh `0.1 + 0.2` menjadi `0.3`. Tarif, multiplier dan penggolongan lembur hari kerja/libur dalam mesin nominal lama belum diubah: payroll masih memanggil mesin lembur dengan WORKDAY. Ini perlu fase kebijakan lembur tersendiri.

Potongan keterlambatan hanya memakai attendance pada hari kerja hasil resolusi. Toleransi policy, tarif dan batas potongan harian tetap memakai konfigurasi lama. Potongan absen memakai hitungan absen yang sama dengan review dan slip, dengan tarif yang sudah ada. Batas periode yang dinormalisasi juga diteruskan ke pemilihan EWA, yang menyimpan tanggal periode sebagai `@db.Date`; aturan status dan nominal EWA tetap mengikuti [transaksi payroll](payroll-run-transactions.md).

## Kontrak API, konsistensi dan kompatibilitas

`GET /api/v1/payroll/periods/:id/attendance-summary` tetap mengembalikan `period`, `attendanceReviewedAt`, dan `summary` keyed by employee ID. Setiap entry sekarang memiliki `workDays` selain `present`, `absent`, `leave`, dan `overtime`. Daftar mengikuti pegawai dengan alokasi gaji aktif, termasuk pegawai tanpa record attendance; pegawai tanpa gaji aktif tidak masuk review payroll. Absen dihitung dari jadwal yang belum terpenuhi, bukan hanya jumlah record berstatus ABSENT.

Review memakai transaksi RepeatableRead. Pembuatan run memakai loader yang sama di dalam transaksi Serializable dari [fase transaksi](payroll-run-transactions.md). Pembacaan sumber dibatasi company dan ID pegawai payroll, dengan tujuh query batch untuk pegawai, kalender, shift, override, attendance, cuti, dan lembur; tidak ada query per pegawai/hari. Potongan telat memakai satu query tambahan saat diaktifkan. Kalender/shift yang hilang atau invalid menghasilkan 400 dan membatalkan seluruh penulisan run, slip, komponen sistem dan snapshot.

Aturan hitung konsisten antara review dan run, tetapi review **belum membekukan sumber data**. Perubahan jadwal/attendance/cuti di antara kedua request dapat mengubah hasil; timestamp review belum menjadi version check. Snapshot agregat pada slip serta input formula yang tersimpan tetap tidak berubah setelah run dibuat. Snapshot ID/versi sumber kalender, cuti dan attendance per hari belum tersedia.

Tidak ada perubahan schema, migration, UI, atau data aplikasi pada fase ini. Kalender legacy yang sebelumnya terlewat atau ambigu perlu diperbaiki sebelum payroll baru dapat berjalan. Slip lama tidak dihitung ulang. Pemilihan gaji masih memakai alokasi aktif, dan assignment organisasi/shift masih memakai record pegawai saat kalkulasi, bukan histori effective date. Proses pengajuan cuti, saldo cuti, endpoint kalender lain, correction payroll retroaktif, serta load test company besar tetap backlog.

## Pengujian

- `backend/src/shared/payroll/attendance-calendar.test.ts`: 18 tes aturan mingguan, pengecualian, scope, pergantian tahun, rotasi, validasi override, deduplikasi hadir/cuti, tahun kabisat dan tanggal invalid.
- `backend/src/modules/payroll/payroll-attendance.mysql.test.ts`: tujuh tes MySQL nyata dari review sampai slip/input formula, termasuk rollback dan retry sesudah kalender/approval diperbaiki. Fixture mencakup nullable calendar scope yang memungkinkan duplikasi pada schema MySQL, soft-delete, sumber berbeda company, cuti unpaid, batas tanggal, dan pecahan lembur.
- Suite formula MySQL sekarang memakai kalender nyata; mock kalender dihapus. Suite transaksi dan ledger tetap dijalankan untuk mendeteksi regresi payroll.
- Seluruh 18 tes kalender juga lulus dengan `TZ=America/Los_Angeles`, untuk memeriksa bahwa hasil tidak bergeser mengikuti tanggal lokal server.

Jalankan suite tambahan dari direktori backend menggunakan database lokal sintetis dengan nama persis `hris_payment_integration` dan schema repository:

```sh
PAYROLL_ATTENDANCE_DB_URL='mysql://root@127.0.0.1:13367/hris_payment_integration' npm test -- --runInBand payroll-attendance.mysql attendance-calendar
```

Tanpa environment tersebut, suite MySQL dilewati. Fixture hanya memakai UUID miliknya sendiri dan dibersihkan setelah pengujian. Hasil gabungan terbaru tersedia pada [status implementasi](checklist-implementation-status.md).
