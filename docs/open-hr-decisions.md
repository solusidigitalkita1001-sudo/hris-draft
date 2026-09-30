# Keputusan HR yang masih terbuka

Sepuluh gap terakhir dari `docs/gap-analysis-vs-greatday.md` tidak tertahan oleh
pekerjaan teknis — bentuknya bergantung kebijakan yang hanya kamu yang bisa
tetapkan. Dokumen ini mengubahnya menjadi pilihan konkret: apa yang diputuskan,
opsinya apa, rekomendasi saya, dan seberapa besar implementasinya.

Ukuran implementasi memakai skala kasar: **S** ≈ setengah hari, **M** ≈ 1–2
hari, **L** ≈ lebih dari itu. Semua angka mengasumsikan test dan audit trail
ikut dikerjakan, sesuai standar yang berlaku di repo ini.

---

## 1. GAP-19 & GAP-20 — Monitoring kontrak PKWT dan probasi (M)

**Kenapa ini keputusan:** schema sama sekali tidak menyimpan tanggal akhir
kontrak maupun probasi per karyawan. Yang ada hanya `EmploymentType.CONTRACT`,
`EmploymentStatus.CONTRACT_END`, dan `Offer.probationMonths` di sisi rekrutmen.
Jadi pertanyaannya bukan "kapan mengingatkan", tapi "apa yang disimpan".

**Yang perlu diputuskan**

1. Satu tanggal per karyawan (`contractEndDate`, `probationEndDate`) — sederhana,
   tetapi riwayat perpanjangan hilang; atau
2. Tabel `EmploymentContract` (mulai, berakhir, tipe, nomor kontrak, status) —
   riwayat perpanjangan utuh dan bisa dilaporkan, biaya satu model baru.
3. Offset reminder: 30/14/7 hari sebelum berakhir? Dan penerimanya: HR saja,
   atau atasan langsung juga?

**Rekomendasi:** opsi 2. PKWT punya batas hukum jumlah dan total masa
perpanjangan; tanpa riwayat, sistem tidak bisa memperingatkan saat batas itu
terlampaui — dan itu justru risiko kepatuhan yang paling mahal.

## 2. GAP-08 — Cuti bersama (M)

**Yang perlu diputuskan:** cuti bersama memotong saldo cuti tahunan karyawan
(praktik umum di Indonesia) atau tidak memotong sama sekali? Lalu: berlaku ke
seluruh perusahaan, atau bisa per cabang/departemen? Bagaimana dengan karyawan
yang saldonya sudah habis — saldo minus, dianggap unpaid, atau dikecualikan?

**Rekomendasi:** memotong saldo, dideklarasikan per perusahaan dengan
pengecualian per cabang, dan saldo yang tidak cukup jatuh ke unpaid — bukan
saldo minus, karena saldo minus merembet ke perhitungan payroll dan pesangon.

## 3. GAP-09 — Leave encashment (M)

**Yang perlu diputuskan:** apakah perusahaan membolehkan sisa cuti ditukar uang?
Jika ya: batas hari per tahun, dasar perhitungan (gaji pokok ÷ 21? ÷ 30?), dan
apakah perlu approval terpisah dari atasan atau cukup HR.

**Rekomendasi:** tunda sampai kebijakan tertulis ada. Ini menyentuh uang dan
dasar perhitungannya berbeda antar perusahaan; menebak defaultnya berisiko.

## 4. GAP-13 — Distribusi slip gaji lewat email (S–M)

**Yang perlu diputuskan:** ini keputusan privasi, bukan teknis. Desain sekarang
sengaja memperketat: nominal hanya terbuka setelah PIN/reautentikasi, dan
notifikasi terbit pun sengaja tidak memuat angka. Mengirim PDF slip ke email
membalik arah itu.

**Opsi:** (a) tetap tarik-sendiri, notifikasi saja — sudah jalan sejak #12;
(b) email berisi tautan aman yang tetap meminta PIN; (c) email dengan PDF
terlampir, dilindungi kata sandi.

**Rekomendasi:** (b). Karyawan tetap mendapat dorongan aktif tanpa nominal
pernah meninggalkan sistem.

## 5. GAP-14 — Payroll susulan (M)

**Yang perlu diputuskan:** bila seorang karyawan terlewat di satu periode,
apakah dibayar lewat run tambahan untuk periode itu, atau sebagai komponen
rapel di periode berikutnya?

**Rekomendasi:** rapel di periode berikutnya. Run tambahan untuk periode yang
sudah ditutup mengacaukan pelaporan per periode dan rekonsiliasi bank; rapel
tetap memberi jejak yang jelas dan tidak membuka kembali periode tertutup.

## 6. GAP-16 — Rekonsiliasi PPh21 Desember (M)

**Konteks teknis:** perhitungan bulanan memakai metode annualized net (pajak
setahun dibagi 12), sehingga selisih akhir tahun biasanya kecil — muncul saat
ada bonus, THR, perubahan PTKP, atau karyawan masuk/keluar di tengah tahun.

**Yang perlu diputuskan:** selisih dikoreksi di slip Desember, atau dilaporkan
saja untuk diproses manual oleh HR/pajak?

**Rekomendasi:** koreksi otomatis di Desember dengan komponen terpisah yang
terlihat jelas di slip, supaya karyawan bisa melihat asal angkanya.

## 7. GAP-17 — Metode gross-up (M)

**Yang perlu diputuskan:** apakah ada perusahaan dalam grup yang menanggung
PPh21 karyawan? Kalau tidak ada, ini tidak perlu dibangun sama sekali.

**Rekomendasi:** tanya dulu ke perusahaan-perusahaan dalam grup; bangun hanya
jika benar dipakai, karena kalkulasi terbaliknya menambah cabang di jalur yang
paling sensitif di sistem.

## 8. GAP-21 — Alur proposal revisi gaji (M)

**Kondisi sekarang:** transaksi karier sudah bisa membawa `toBaseSalary` dengan
tanggal efektif dan melewati approval, lalu membuat `EmployeeSalary` baru.

**Yang perlu diputuskan:** apakah kenaikan gaji harus punya alurnya sendiri
(pengusul, justifikasi, budget, approval berjenjang) atau cukup memakai jalur
karier yang ada.

**Rekomendasi:** cukup jalur yang ada, tambahkan field alasan/justifikasi.
Menambah alur kedua untuk hal yang sama akan membelah riwayat karier.

## 9. GAP-22 — Man Power Planning / requisition (L)

**Yang perlu diputuskan:** apakah rekrutmen harus berangkat dari requisition
yang disetujui (kepala departemen mengajukan kebutuhan headcount, lalu approval
anggaran), atau job posting boleh langsung dibuat seperti sekarang?

**Rekomendasi:** wajibkan requisition hanya jika anggaran headcount memang
dikontrol terpusat. Kalau tidak, ini menambah birokrasi tanpa pengendalian yang
nyata.

## 10. GAP-25 — Evaluasi pasca-training (S–M)

**Konteks teknis:** `TrainingEnrollment.score` sudah ada di schema tetapi tidak
dipakai kode manapun.

**Yang perlu diputuskan:** cukup nilai dari trainer (Kirkpatrick level 2), atau
juga form reaksi peserta (level 1) dengan rekap efektivitas per course?

**Rekomendasi:** mulai dari mengaktifkan `score` yang sudah ada plus satu form
reaksi sederhana. Rekap efektivitas menyusul setelah ada datanya.

## 11. GAP-26 — Hierarki dan cascade goal (M)

**Konteks teknis:** model `Goal` tidak punya `parentGoalId` — klaim lama bahwa
field itu sudah ada tidak benar. Jadi hierarki harus dimodelkan dulu.

**Yang perlu diputuskan:** goal di-cascade dari perusahaan → divisi →
departemen → individu, atau cukup rujukan bebas antar goal tanpa hierarki
formal?

**Rekomendasi:** rujukan bebas (`parentGoalId` opsional) dulu. Cascade formal
menuntut struktur goal organisasi yang biasanya belum mapan saat sistemnya baru
dipakai.

## 12. GAP-27 — Urutan tanda tangan dokumen (M)

**Yang perlu diputuskan:** apakah dokumen perlu urutan penanda tangan (karyawan
dulu, lalu HR, lalu direktur) dengan tenggat per penanda tangan, atau semua
penanda tangan setara seperti sekarang?

**Rekomendasi:** tambahkan urutan opsional. Dokumen seperti kontrak dan surat
peringatan memang punya urutan yang mengikat, tetapi memaksakannya ke semua
dokumen akan memperlambat yang sederhana.

---

# Tambahan dari pemeriksaan 30 September

Enam gap baru (GAP-31…GAP-36) muncul saat perbandingan ulang dengan GreatDay.
Satu di antaranya — GAP-34, payroll mono-mata-uang — tidak perlu keputusan dan
sudah ditutup dengan mendokumentasikan batasannya di `docs/payroll-formulas.md`.
Lima sisanya bergantung padamu, dan urutannya di bawah ini adalah urutan
mendesaknya.

## 13. GAP-31 — Metode absensi FINGERPRINT (S kalau dihapus, L kalau diintegrasi)

**Kenapa ini paling mendesak:** ini satu-satunya gap yang menjanjikan keamanan
yang tidak dimilikinya. `FACE_RECOGNITION` diverifikasi server dan `MOBILE_GPS`
punya geofence plus deteksi mock location, tetapi `FINGERPRINT` sepenuhnya
pernyataan klien — tidak ada perangkat, kredensial mesin, maupun endpoint impor
punch. Cabang yang memilih fingerprint-only karena menganggapnya paling ketat
justru mendapat jalur paling lemah.

**Yang perlu diputuskan**

1. Integrasi perangkat sungguhan: mesin fingerprint mem-posting punch dengan
   kredensial perangkat, atau impor berkala dari mesin (**L**); atau
2. Hapus `FINGERPRINT` dari kebijakan dan DTO sampai integrasinya ada (**S**).

**Kenapa saya tidak memutuskannya sendiri:** saya sudah menulis perbaikan opsi 2
lalu membatalkannya setelah mengukur data yang berjalan — **Head Office Jakarta
memakai kebijakan FINGERPRINT untuk 24 karyawan**. Menolak metode itu hari ini
berarti 24 orang tidak bisa absen besok pagi. Jadi opsi 2 pun butuh langkah
migrasi: pindahkan cabang itu ke metode lain lebih dulu.

**Rekomendasi:** kalau mesin fingerprint memang terpasang di kantor, pilih opsi 1
dan beri tahu merek/modelnya — pola integrasinya berbeda antar vendor. Kalau
tidak ada mesinnya, pilih opsi 2 dan pindahkan Head Office ke `MOBILE_GPS` atau
`FACE_RECOGNITION` dalam satu migrasi, bukan dua rilis.

## 14. GAP-32 — Bukti potong PPh21 tahunan / 1721-A1 (M)

**Kenapa ini keputusan yang kecil:** bukti potong tahunan adalah kewajiban, jadi
pertanyaannya bukan "perlu atau tidak" melainkan "bentuk mana".

**Yang perlu diputuskan:** cetak 1721-A1 mengikuti format resmi DJP terbaru yang
kamu pakai tahun ini (formatnya berubah beberapa kali, dan saya tidak mau
menebak versinya), dan apakah karyawan bisa mengunduhnya sendiri atau HR yang
membagikan. Kalau bisa diunduh sendiri: ikut aturan PIN/reautentikasi seperti
slip gaji, karena isinya nominal setahun.

**Rekomendasi:** kirim satu contoh 1721-A1 yang benar-benar kamu pakai; saya
bangun generatornya dari data payroll yang sudah ada. Unduh sendiri di balik PIN.

## 15. GAP-33 — Ekspor pelaporan BPJS dan e-Bupot (M)

**Yang perlu diputuskan:** berkas mana yang benar-benar dipakai tim payroll
setiap bulan — laporan mutasi BPJS Kesehatan, BPJS Ketenagakerjaan, e-Bupot
bulanan, atau ketiganya? Masing-masing punya format dan siklus sendiri.

**Rekomendasi:** mulai dari yang paling sering dikerjakan manual sekarang. Sama
seperti di atas: satu contoh berkas asli jauh lebih berguna daripada spesifikasi,
karena yang menentukan diterima atau tidak adalah detail formatnya.

## 16. GAP-35 — Timesheet per proyek (L)

**Yang perlu diputuskan:** apakah ada perusahaan dalam grup yang menagih klien
berdasarkan jam kerja? Kalau tidak, ini tidak perlu dibangun sama sekali —
`DailyActivity` sudah mencatat aktivitas harian dengan bukti GPS dan foto.

**Rekomendasi:** lewati sampai ada perusahaan jasa yang benar-benar menagih per
jam. Membangun model proyek, jam billable, dan approval-nya tanpa pengguna nyata
adalah cara termahal untuk menebak kebutuhan.

## 17. GAP-36 — Pencairan lewat API bank (L)

**Kondisi sekarang:** GAP-12 ditutup dengan ekspor CSV per bank yang diunggah ke
internet banking. Ledger pembayaran dan status transaksinya sudah siap menampung
integrasi langsung.

**Yang perlu diputuskan:** bank mana, dan apakah perusahaan bersedia menaruh
kredensial pencairan di sistem ini. Itu pertanyaan kedua yang lebih berat
daripada yang pertama: pencairan otomatis memindahkan uang tanpa orang menekan
tombol di internet banking, jadi kontrol pengganti (dual approval, batas nominal
per run, kunci rekening tujuan) harus disepakati lebih dulu.

**Rekomendasi:** tetap di ekspor berkas untuk sekarang. Unggah manual memberi
satu titik kendali manusia di depan pemindahan uang, dan itu sepadan dengan
ketidaknyamanannya sampai volume run membuatnya tidak praktis.
