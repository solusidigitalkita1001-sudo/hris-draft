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
