# Audit kelengkapan vs benchmark — apa yang daftar GAP-01..39 tidak pernah sebut

Tanggal: 5 Oktober 2026. Repo: `/Users/f/dev/hris-draft` @ `5d9a99f`.
Metode: inventaris kapabilitas yang **diiklankan publik** oleh GreatDay HR,
Mekari Talenta, dan Gadjian → disaring terhadap `docs/gap-analysis-vs-greatday.md`
(GAP-01..39, apa pun yang sudah ada di sana **di luar lingkup**) → dicek ke kode.

**HASIL: 12 gap baru diusulkan, GAP-40 s/d GAP-51.** Di samping itu 11
kapabilitas benchmark dinamai dan **sengaja tidak dihitung** (Bagian 4), dan 36
kapabilitas benchmark diperiksa lalu **ternyata sudah ada** di kode (Bagian 5).

Dua kandidat dicabut setelah dicek ke dokumen asal dan ternyata **sudah
disebut** di sana: survei/polling (baris 712, tabel parity P2 "Engagement Portal
(Announcement/Survey) — pure logic not wired, PENDING") dan bagan organisasi
(baris 1169, sudah dicatat ada sebagai `OrganizationChartPage`).

---

## Bagian 1 — Inventaris benchmark (sumber publik)

### GreatDay HR — halaman fitur
Sumber: https://greatdayhr.com/id-id/fitur/

| Kelompok | Fitur yang diiklankan |
|---|---|
| Core | Manajemen Data Perusahaan dan Karyawan |
| Absensi | Solusi Absensi Karyawan; Cuti & Lembur; ITCS (Intelligent Temperature Checking System); **GreatDay Kiosk — sistem absensi tanpa sentuh** |
| Aktivitas | Basic Operational (pantau tugas/aktivitas); Outsource (keamanan aset / patroli); Daily Activity |
| Finance | Payroll; **Benefits — Earned Wage Access**; **Claim with Balance**; Loan Management; **Multibank Salary** |
| Strategic | **Engagement**; Performance; Recruitment |

### GreatDay HR — indeks help centre (kategori → artikel)
Sumber: https://help.greatdayhr.com/id/

- **Absensi/Kehadiran**: absensi saat app force close; gagal kirim rekaman ke server; menambahkan hari libur; **reproses kehadiran**; **mengubah zona waktu**; lokasi absensi tidak sesuai; status kehadiran karyawan; **merekam kehadiran mode offline**; mengajukan koreksi kehadiran; riwayat kehadiran; mengunduh laporan kehadiran; **Pro: mengunggah data kehadiran karyawan**
- **Acara**: **membuat acara** (kalender acara perusahaan)
- **Aktivitas**: merekam Daily Activity
- **Bahasa**: **mengubah Bahasa** (UI bilingual ID/EN)
- **Chat**: **membuat obrolan grup; memulai obrolan**
- **Cuti**: mengajukan cuti; **mengubah leave balance** (penyesuaian saldo manual); memeriksa saldo; menambah/mengubah tipe cuti; membatalkan cuti
- **Dokumen**: **mengunggah template dokumen**; **letter template**; **membuat kolom tandatangan**; **header & footer**; membuat dokumen baru; mengunduh dokumen
- **Feeds**: **menulis post; melihat post** (social feed)
- **Karyawan**: **menyembunyikan nomor HP dan email karyawan**; **melihat tracking karyawan**; mengundang anggota; **mengunggah anggota baru menggunakan template**; mengganti email; mengubah profil; **menambah data karyawan dalam dokumen** (merge field); **mengunduh daftar karyawan**; **melihat Laporan Karir Karyawan**; menghapus karyawan
- **Kata Sandi**: atur PIN perangkat; ubah password
- **Kinerja**: melihat kinerja
- **Klaim**: mengajukan klaim; **menambah tipe klaim**; Pro: tipe klaim; Pro: mengajukan klaim
- **Lembur**: **reproses lembur**; membatalkan permohonan lembur
- **Login**: **biometric log in (quick log in)**; log in/out
- **Pemungutan Suara**: **membuat voting**
- **Penggajian**: tambah/ubah data penggajian karyawan; **menghapus data karyawan resign di Payroll**; komponen penggajian di Payroll Master Setup; data perusahaan di Payroll Master Setup; memeriksa slip gaji; lupa kata sandi slip gaji; **upload slip gaji**; **upload komponen gaji**; proses penggajian; **mengunggah riwayat penggajian**; **mengunggah data gaji karyawan**
- **Perjalanan Bisnis**: deklarasi; pengajuan; pembatalan
- **Perusahaan**: **menambah/mengedit cost center**; melihat riwayat pengajuan; **membuat ID Card**; profil perusahaan; **mengubah peraturan flow approver**; mengubah supervisor; menambah posisi/jabatan; mengatur admin; **melihat struktur organisasi perusahaan**; menambahkan/mengubah kebijakan; membuat pengumuman
- **Recruitment**: membuat lowongan pekerjaan
- **Saran**: **memberikan saran dan evaluasi** (survei/feedback)
- **Shift**: tambah/ubah shift; **membuat pola shift**; mengubah jadwal shift; **mengunggah jadwal shift**
- **Tugas dan Timbal Balik**: **mengirimkan tugas; memberikan tugas**

### Mekari Talenta — daftar fitur
Sumber: https://www.talenta.co/en/features/

- Attendance: Absence Mgmt, **Timesheet**, Talenta Portal, Liveness Validation, Overtime, Shift, Leave, **Live Tracking**
- Payroll/Benefit: Payroll Calculation, Payroll Report, Payroll Disbursement, Payslip Distribution, **Reimbursement Management**, **Compensation Management**, **Expense Management**, **Employee benefits**, Payroll Service, **Publish e-Bupot**
- Administration HR: ESS, **Request Management & Survey**, **Task & Project Management**, **Internal Communication**, **Asset & Access Management**, **Onboarding & Offboarding**, Database Mgmt, **HR Helpdesk**
- Talent Acquisition: Recruitment, **Candidate assessment**, Manpower Planning
- Talent Development: Performance, **Talent Management**, **LMS**
- AI & Analytics: HR Analytics, Talenta AI
- Integration: **ERP Integration**, **Digital Sign**

### Payroll Indonesia — kapabilitas yang diiklankan Talenta & Gadjian
Sumber: https://www.talenta.co/en/features/payroll-software/payroll-app-calculator/ ;
https://help-center.talenta.co/hc/en-us/articles/11354139669145-How-to-Calculate-the-THR-Tax-on-Talenta ;
https://www.gadjian.com/blog/2024/03/01/perhitungan-pph-21-thr-dan-bonus-dengan-tarif-efektif/ ;
https://www.gadjian.com/blog/2023/02/26/perhitungan-pajak-pesangon-pensiun/

- **THR** (Tunjangan Hari Raya) sebagai run tersendiri, dengan opsi taxable / non-taxable
- **Pesangon / UPMK / uang pisah / uang penggantian hak** + **PPh21 final pesangon**
- **PPh21 TER** (tarif efektif rata-rata, PMK 168/2023) untuk pemotongan bulanan
- Metode **gross / gross-up / nett**
- **Prorata** gaji join/resign tengah bulan
- **PPh26** untuk WNA
- Bonus/komisi/gratifikasi sebagai penghasilan tidak teratur
- Laporan: slip, **1721-A1**, **SIPP (BPJS TK)**, **Edabu (BPJS Kesehatan)**, e-Bupot
- **Multibank salary** — distribusi gaji dari/ke beberapa bank

---

## Bagian 2 — Penyaringan terhadap daftar GAP-01..39 (di luar lingkup)

Sudah tercatat, **tidak dihitung lagi**: koreksi absensi (GAP-01), review absensi
pra-payroll (02), policy company (03), shift per karyawan (04), hari kerja cuti
(05), carry-over/expiry (06), self-approval (07), cuti bersama (08), encashment
(09), lembur→payslip (10), potongan telat (11), file transfer bank (12),
distribusi payslip (13), rapel (14), maker-checker (15), rekonsiliasi PPh21
tahunan (16), gross-up (17 — **diputuskan tidak dibangun**), mutasi (18), PKWT
(19), probasi (20), revisi gaji (21), MPP/headcount (22), workflow engine (23),
company settings (24), evaluasi training (25), goal cascade (26), e-signature
order (27), notifikasi (28), reports (29), self-service portal (30), mesin
absensi (31), 1721-A1 (32), BPJS/e-Bupot (33), mata uang tunggal (34), timesheet
proyek (35 — dilewati sadar), API bank (36 — dilewati sadar), SSO (37), webhook
(38), custom field (39). Succession/career path/9-box tercatat di P2 §47.

Sisa kandidat untuk diverifikasi ke kode (lihat Bagian 3).

---

## Bagian 3 — Temuan (GAP-40 ke atas)

Severity dibaca dari sudut **calon pembeli**: *walk away* = pembeli batal atau
menolak go-live; *negotiate* = jadi butir tawar-menawar / permintaan roadmap;
*not notice* = jarang ditanya di demo.

---

### 🔴 GAP-40 — Pemotongan PPh21 bulanan masih metode lama (annualized net), belum TER

**Apa ini.** Sejak Januari 2024 (PMK 168/2023) pemotongan PPh21 Masa Pajak
Januari–November wajib memakai **Tarif Efektif Rata-rata (TER)** — tarif
persen yang dikalikan langsung ke **penghasilan bruto bulanan**, dengan kategori
TER A/B/C ditentukan status PTKP. Perhitungan progresif setahun hanya dipakai di
Masa Pajak Desember. HR yang memeriksa slip gaji akan langsung melihat angka
PPh21 kita berbeda dari kalkulator TER mana pun.

**Bukti diharapkan.** Gadjian: "Pemotongan PPh 21 bulanan menggunakan tarif TER
yang dikenakan atas penghasilan bruto" —
https://www.gadjian.com/blog/2024/03/01/perhitungan-pph-21-thr-dan-bonus-dengan-tarif-efektif/
dan template kalkulator TER mereka
https://www.gadjian.com/blog/2024/06/19/download-template-kalkulator-pph-21-ter-excel/ .
Talenta memasarkan PPh21 otomatis sesuai ketentuan berjalan:
https://www.talenta.co/blog/ketentuan-tarif-pph-21/ .

**Keadaan kita.** `backend/src/shared/payroll/pph21.ts:1-15` menyatakan sendiri:
"Uses the annualized net method (UU HPP 2022 brackets)". Tabel referensinya
hanya `TaxBracket` (bracket PKP progresif, `schema.prisma` model `TaxBracket`)
dan `PtkpTable` — **tidak ada tabel kategori/tarif TER**. Pencarian
`rtk proxy grep -rIn -w TER`, `-i "pmk 168" "tarif efektif" terCategory
"effective tax rate" monthlyEffectiveRate` di `backend/src` → **0 hasil**.

**Catatan lingkup.** Ini **bukan** GAP-16. GAP-16 menambahkan penyesuaian
Desember di atas metode bulanan yang ada; dokumen itu bahkan menuliskan
"PPh21 memakai metode annualized net" sebagai keadaan yang benar. Yang belum
pernah disebut adalah bahwa **metode bulanannya sendiri sudah bukan metode yang
berlaku**.

**Severity: walk away.** Ini kewajiban pemotong pajak, bukan preferensi. Satu
pertanyaan "ini sudah TER?" dari calon pembeli cukup untuk menghentikan demo.

**Ukuran: M.** Butuh schema (tabel kategori TER + baris tarif per lapisan bruto,
pola yang sama dengan `TaxBracket` sehingga bisa di-override per perusahaan +
di-snapshot ke `PayrollRun.policySnapshot`), lalu switch di jalur bulanan dan
biarkan Desember memakai jalur progresif yang sudah ada (GAP-16).

---

### 🔴 GAP-41 — THR hanya bisa dihitung, tidak bisa dibayarkan

**Apa ini.** THR wajib dibayar setiap tahun H-7 hari raya untuk semua karyawan,
dengan slip tersendiri dan perlakuan pajak tersendiri. Di sistem kita THR adalah
**kalkulator**: ada endpoint yang mengembalikan angka, tidak ada yang mencatat,
memotong pajak, menerbitkan slip, atau memasukkannya ke batch transfer bank.

**Bukti diharapkan.** Talenta punya "Run THR" dengan opsi taxable / non-taxable:
https://help-center.talenta.co/hc/en-us/articles/11354139669145-How-to-Calculate-the-THR-Tax-on-Talenta .
Gadjian menerbitkan slip THR tersendiri:
https://www.gadjian.com/blog/2022/03/30/contoh-slip-gaji-thr/ . Keduanya
menyebut THR sebagai komponen payroll, bukan kalkulator.

**Keadaan kita.**
- Rumus Permenaker 6/2016 lengkap dan teruji: `backend/src/shared/payroll/thr.ts:44`,
  `backend/src/shared/payroll/thr.test.ts`.
- Jalur satu-satunya: `POST /payroll/calculate-thr`
  (`backend/src/modules/payroll/payroll.routes.ts:133-138`) → controller
  `payroll.controller.ts:464` → `payroll.service.ts:148-172`, yang
  **mengembalikan objek dan menulis satu baris log** (`logger.info('THR
  calculated')`, `payroll.service.ts:165`) — tidak ada `create`/`update` apa pun.
- `PayrollRun` tidak punya penanda jenis run (model `PayrollRun` di
  `schema.prisma`: tidak ada `runType`/`type`), jadi tidak ada tempat untuk
  "run THR" di samping run gaji bulanan.
- Komentar di `payroll.service.ts:1361-1362` mengakuinya: "hitung also PPh 21
  untuk THR (aturan khusus THR: PPh dihitung tersendiri nanti) — Saat ini return
  amount THR saja".
- Satu-satunya jejak THR di payslip adalah **pengenal nama komponen manual**:
  `backend/src/shared/payroll/payslip-breakdown.ts:75` mencocokkan
  `/THR|Hari Raya|Lebaran/i` pada nama komponen yang **diisi tangan**.

Jadi THR tetap mungkin dibayar — dengan membuat `SalaryComponent` bernama "THR"
dan mengisi nominalnya satu per satu per karyawan. Angka dari kalkulator harus
disalin manual, dan tidak ada yang menghubungkan keduanya.

**Severity: walk away / negotiate keras.** THR bukan fitur opsional di Indonesia.

**Ukuran: M.** `runType` pada `PayrollRun` + pembuatan komponen THR otomatis dari
`calculateThr` (pola `ensureArrearsEarningComponent` sudah ada) + flag taxable
per perusahaan (pola `CompanySetting`) + ikut ke batch pembayaran.

---

### 🔴 GAP-42 — Pesangon/hak akhir PHK hanya dihitung, tidak dibayarkan dan tidak dipajaki

**Apa ini.** Saat karyawan berhenti, perusahaan membayar uang pesangon (UP),
UPMK, uang penggantian hak, dan uang pisah — dan atas uang itu berlaku **PPh21
final pesangon** dengan lapisan tarifnya sendiri (0% / 5% / 15% / 25%), bukan
tarif gaji bulanan. Di sistem kita hak akhir bisa **ditampilkan**, tidak bisa
dibayarkan, dan pajaknya tidak dihitung sama sekali.

**Bukti diharapkan.** Gadjian: "dapat menghitung pajak penghasilan bersifat
final seperti uang pesangon, uang penghargaan masa kerja, uang pisah, dan uang
penggantian hak" —
https://www.gadjian.com/blog/2023/02/26/perhitungan-pajak-pesangon-pensiun/ .
Talenta memasukkan "severance pay" ke komponen perhitungan payroll-nya:
https://www.talenta.co/en/features/payroll-software/payroll-app-calculator/ .

**Keadaan kita.**
- Rumus UU 13/2003 Pasal 156 + faktor PP 35/2021 lengkap dan teruji:
  `backend/src/shared/payroll/severance.ts:115` (`calculateSeverance`),
  `severance.test.ts`.
- Jalur satu-satunya: `POST /onboarding/resignations/:id/final-payroll`
  (`backend/src/modules/onboarding/onboarding.routes.ts:24`) — perhatikan
  izinnya: **`payroll:read`**, bukan `payroll:create`. Service-nya
  (`backend/src/modules/onboarding/onboarding.service.ts:198-240`) memanggil
  `calculateSeverance`, menulis `logger.info('Final payroll calculated')`, dan
  `return` — **tidak ada tulisan ke database, tidak ada payslip, tidak ada
  transaksi pembayaran**.
- Pajak: pencarian `-i "pesangon" "severance"` di `backend/src/shared/payroll/`
  hanya mengenai `severance.ts` dan testnya; **tidak ada lapisan tarif final
  pesangon** di `pph21.ts` maupun `pph21-annual.ts`.

**Catatan lingkup.** Kata "pesangon" muncul sekali di dokumen asal
(`docs/gap-analysis-vs-greatday.md:174`) — tetapi hanya sebagai *alasan* untuk
tidak mengizinkan saldo cuti minus ("angka negatif itu merembet ke payroll dan
pesangon"). Pembayaran dan pajaknya tidak pernah dibahas.

**Severity: negotiate → walk away bila pembeli pernah mem-PHK.** Angka pesangon
adalah angka yang paling sering disengketakan karyawan; HR tidak mau
menghitungnya di Excel lalu membayar lewat jalur lain tanpa jejak.

**Ukuran: M–L.** Perlu: lapisan PPh21 final pesangon (tabel referensi, pola
`TaxBracket`), pembayaran hak akhir sebagai run/slip tersendiri agar masuk ledger
pembayaran dan 1721-A1, dan keputusan kebijakan siapa yang menyetujui faktor
pengali PP 35/2021.

---

### 🟢 GAP-43 — Gaji tidak diprorata untuk karyawan masuk/berhenti di tengah periode — **DITUTUP 5 Okt (PR #50)**

> Ditutup beberapa jam setelah temuan ini ditulis. `shared/payroll/employment-window.ts`
> menghitung potongan periode yang benar-benar dijalani, jalur arrears memakai
> helper yang sama supaya tidak ada dua jawaban, dan flag `isProrated` — yang
> sebelumnya dikumpulkan lalu tidak dibaca siapa pun — kini menentukan komponen
> mana yang diskala. Karyawan resign tengah bulan tidak lagi dilewati total.
> Opt-in per komponen, jadi tenant lama tidak berubah; perusahaan baru dapat
> `Gaji Pokok` bertanda prorata dari bootstrap. Isi di bawah adalah temuan aslinya.

**Apa ini.** Karyawan yang masuk tanggal 20 dibayar gaji sebulan penuh;
karyawan yang berhenti tanggal 10 — begitu statusnya diubah — tidak dibayar
sama sekali untuk 10 hari yang sudah dikerjakannya. Tidak ada prorata hari
kerja pada gaji pokok.

**Bukti diharapkan.** Talenta menyebut "prorated salary" sebagai salah satu hal
yang dihitung otomatis:
https://www.talenta.co/en/features/payroll-software/payroll-app-calculator/
(dan artikel pendukungnya https://www.talenta.co/blog/4-alasan-beralih-ke-aplikasi-payroll-dan-pph-21/ ).

**Keadaan kita.**
- Payslip memakai gaji pokok mentah: `backend/src/modules/payroll/payroll.service.ts:993`
  → `baseSalary: salary.baseSalary` (nilai bulanan utuh dari `EmployeeSalary`).
- Pemilihan karyawan untuk sebuah run hanya melihat tanggal efektif baris gaji,
  **bukan `joinDate`**: `payroll.service.ts:530-568`. Di seluruh
  `modules/payroll/` `joinDate` hanya muncul di jalur THR
  (`payroll.service.ts:152-161`, `:1358-1366`) dan di rapel
  (`payroll-arrears.service.ts:89`) — **tidak di `calculatePayroll`**.
- Sebaliknya, `payroll.service.ts:783` — `if (salary.employee.status !==
  'ACTIVE') continue;` — artinya begitu status karyawan berubah jadi
  resign/terminated, periode terakhirnya **hilang sepenuhnya**, bukan diprorata.
- Yang mungkin menutupi sebagian: potongan alpha (`payroll.service.ts:822-827`)
  bisa memotong hari-hari tanpa absensi — tetapi itu hanya aktif kalau
  `absence_deduction_daily_basic_percent` disetel, besarannya kebijakan potongan
  (bisa 100% atau 50% atau 0), dan ia memotong **tanpa tahu** bahwa penyebabnya
  karyawan belum masuk kerja. Itu bukan prorata, dan untuk karyawan baru hasilnya
  bisa kebetulan mirip atau jauh melenceng.
- `isProrated` ada sebagai flag di DTO (`payroll.dto.ts:14`) tetapi selalu
  di-set `false` di setiap komponen yang dibuat run
  (`payroll.service.ts:1147,1167,1187,1205,1227,1245,1263,1281,1301,1319,1337`).

**Severity: walk away.** Setiap perusahaan merekrut dan kehilangan orang di
tengah bulan. Ini kesalahan yang terlihat di bulan pertama pemakaian, dan
arahnya merugikan karyawan (yang berhenti tidak dibayar) sekaligus merugikan
perusahaan (yang baru masuk dibayar penuh).

**Bukan duplikat GAP-14.** Dokumen asal justru memperkuat temuan ini: GAP-14
(rapel) menuliskan bahwa nominal rapel "diprorata untuk karyawan yang masuk di
tengah bulan" (`docs/gap-analysis-vs-greatday.md:327`). Jadi prorata **sudah
ditulis sekali** — di `payroll-arrears.service.ts:89` untuk karyawan yang
*terlewat* di periode tertutup — dan tetap tidak ada di run normal yang membayar
semua orang. Satu-satunya jalan prorata saat ini adalah "lupakan dulu karyawan
baru, lalu bayar dia sebagai rapel bulan depan", yang berarti karyawan baru
telat menerima gaji pertamanya.

**Ukuran: S–M.** Tidak perlu schema baru: `Employee.joinDate` dan
`Resignation.lastWorkingDate` sudah ada dan sudah dipakai `payroll-arrears`
untuk tujuan yang mirip — rumusnya bisa dipakai ulang. Yang perlu diputuskan adalah dasar proratanya (hari
kalender vs hari kerja) — itu keputusan kebijakan, jadi `CompanySetting`.

---

### 🟠 GAP-44 — Migrasi data: hanya master karyawan yang bisa diunggah

**Apa ini.** Pembeli datang dengan 300 karyawan, data gaji, saldo cuti, jadwal
shift, dan **riwayat penggajian tahun berjalan**. Kita hanya bisa menerima satu
berkas: master karyawan. Sisanya harus diketik.

**Bukti diharapkan.** Indeks help centre GreatDay berisi artikel unggah
tersendiri untuk hampir setiap master — "Mengunggah anggota baru menggunakan
template", "Mengunggah data gaji karyawan", "Upload komponen gaji", "Mengunggah
riwayat penggajian", "Upload slip gaji", "Mengunggah jadwal shift", "Pro:
Mengunggah data kehadiran karyawan" — https://help.greatdayhr.com/id/ .

**Keadaan kita.**
- Ada: `POST /employees/import` (`backend/src/modules/employee/employee.routes.ts:111`,
  `employee.controller.ts:223` → `employeeService.importCsv`) plus export CSV
  (`employee.controller.ts:244`, dengan masking data sensitif).
- Tidak ada yang lain. `rtk proxy grep -rIn "'/import|\"/import|/upload'"
  --include='*.routes.ts' backend/src/modules` mengembalikan **satu baris saja**
  (baris 111 di atas). `multer` dipakai di empat tempat
  (`travel-expense.routes.ts:46`, `permission-request.routes.ts:41`,
  `document-management.routes.ts:44`, dan employee import) — tiga di antaranya
  untuk lampiran, bukan impor data.
- Tidak ada rute POST unggah di `payroll/*.routes.ts` (hanya run, formula,
  payment), tidak ada di `work-calendar.routes.ts` (jadwal shift hanya per
  entri/`bulkUpdateDays` lewat JSON), tidak ada impor riwayat absensi di
  `attendance/*.routes.ts` (hanya check-in sendiri, entri manual per baris, dan
  punch perangkat dari GAP-31).

**Mengapa ini lebih dari kenyamanan.** "Riwayat penggajian" bukan kemudahan:
tanpa angka periode sebelumnya dari sistem lama, **rekonsiliasi PPh21 Desember
(GAP-16) dan bukti potong 1721-A1 (GAP-32) salah** untuk setiap perusahaan yang
go-live di tengah tahun — dan hampir semua go-live di tengah tahun.

**Severity: walk away pada tahap implementasi.** Bukan pembeli yang menolak di
demo, tapi proyek yang mandek di minggu pertama onboarding.

**Ukuran: M.** Pola impornya sudah ada satu dan bisa ditiru (`importCsv` +
laporan baris gagal). Yang paling berharga lebih dulu: data gaji + komponen
gaji, riwayat penggajian, dan saldo cuti.

---

### 🟠 GAP-45 — Plafon klaim (Claim with Balance) ada di schema dan rumusnya, tidak pernah ditegakkan

**Apa ini.** Tiap karyawan punya plafon klaim per kategori per periode (mis.
transport Rp 500rb/bulan, kesehatan Rp 5jt/tahun). Saat mengajukan, sisa plafon
terlihat dan pengajuan di atas plafon ditolak atau diberi peringatan. Di sistem
kita semua bagiannya ada — **kecuali yang memanggilnya.**

**Bukti diharapkan.** GreatDay menjual ini sebagai fitur Finance bernama
**"Claim with Balance — Penggantian Pengeluaran Karyawan"**:
https://greatdayhr.com/id-id/fitur/ . Help centre-nya punya "Menambah tipe
klaim" / "Pro: Menambah tipe klaim": https://help.greatdayhr.com/id/ .

**Keadaan kita.**
- Tabel ada: `backend/src/database/prisma/schema.prisma:4552` model
  `ClaimCategoryLimit`.
- Rumusnya ada dan teruji: `backend/src/shared/claims/claim-limit.ts:54,62,87,105`
  (`periodIsActive`, `samePeriodBucket`, `sumSubmittedInPeriod`,
  `checkCategoryLimit`) — lengkap dengan `violationAction: 'WARN' | 'BLOCK'`.
- **Tidak ada yang memakainya.** `rtk proxy grep -rIln
  "claims/claim-limit|claim-limit|checkCategoryLimit"` di `backend/src` dan
  `frontend/src` hanya mengembalikan `claim-limit.test.ts` — **file test-nya
  sendiri**. Dan `rtk proxy grep -rIln "claimCategoryLimit"` di `backend/src`
  (selain `shared/database/prisma.ts` yang menyebut semua model) → **0**: tabelnya
  tidak pernah dibaca maupun ditulis.
- `modules/travel-expense/` tidak menyebut limit/plafon/kuota sama sekali
  (satu-satunya "limits" di sana adalah `limits: { fileSize }` milik multer,
  `travel-expense.routes.ts:48`).
- Tidak ada CRUD untuk menyetel plafon: tidak ada rute `claim-limit`/`claim-category`
  di modul mana pun.

**Severity: negotiate.** Ini butir yang ditanyakan tim finance di demo ("bisa
batasi plafon per orang?"), dan jawaban "tabelnya ada tapi belum dipakai" lebih
buruk daripada "belum ada".

**Ukuran: S.** Tidak ada schema baru. Yang perlu: CRUD plafon + satu pemanggilan
`checkCategoryLimit` di jalur submit klaim + menampilkan sisa plafon di
self-service.

---

### 🟠 GAP-46 — Tidak ada generator surat dari template (surat keterangan kerja, SK, ID card)

**Apa ini.** HR paling sering diminta **surat**: surat keterangan kerja, surat
keterangan penghasilan untuk bank/visa, SK pengangkatan, SK mutasi, surat
peringatan. Pola kerjanya: satu template dengan placeholder data karyawan, pilih
karyawan, surat jadi — bernomor, bisa diteken, tersimpan di arsipnya. Kita hanya
punya **unggah berkas yang sudah jadi**.

**Bukti diharapkan.** GreatDay help centre, kategori Dokumen: **"Mengunggah
template dokumen"**, **"Letter template"**, **"Membuat kolom tandatangan"**,
**"Menggunakan Header dan Footer"**, dan di kategori Karyawan: **"Menambah data
karyawan dalam dokumen"** (merge field) serta di kategori Perusahaan:
**"Membuat ID Card"** — https://help.greatdayhr.com/id/ .

**Keadaan kita.**
- `Document` adalah berkas yang diunggah, bukan dokumen yang dihasilkan: model
  `Document` di `schema.prisma` wajib punya `fileName`, `filePath`, `mimeType`,
  `fileSize` dan tidak punya field template/konten/placeholder.
- Tidak ada model template surat: `rtk proxy grep -nE 'model (Letter|Template|
  DocumentTemplate)[A-Za-z]*'` → 0; dan `LetterTemplate`/`letterTemplate`/
  `mergeField`/`generateLetter`/`idCard` → **0 file** di `backend/src` dan
  `frontend/src`.
- Modul dokumen hanya punya unggah + kategori + tanda tangan:
  `ls backend/src/modules/document-management/` → controller/dto/repository/
  routes/service + `document-signing.service.ts`; multer-nya di
  `document-management.routes.ts:44`.
- Tanda tangan dan urutan signer memang sudah ada (`DocumentSigner`, GAP-27) —
  jadi yang hilang persisnya adalah **pembuatan isinya**, bukan penekenannya.

**Severity: negotiate.** Ini pekerjaan harian HR admin, dan sering jadi alasan
mereka tetap memakai Word di samping HRIS — yang melemahkan nilai jual "semua
di satu tempat".

**Ukuran: M.** Butuh schema (template + daftar placeholder yang diizinkan +
penomoran surat) dan satu renderer. Risiko yang harus dijaga: placeholder tidak
boleh bisa menarik field karyawan di luar hak akses pembuatnya.

---

### 🟡 GAP-47 — Tidak ada ekspor jurnal gaji / alokasi biaya untuk akuntansi

**Apa ini.** Setelah payroll selesai, finance butuh **jurnal gaji**: total beban
gaji, tunjangan, BPJS perusahaan, dan utang PPh21, dipecah per cost center /
departemen, dalam bentuk yang bisa diunggah ke sistem akuntansi. Kita berhenti
di file transfer bank.

**Bukti diharapkan.** Talenta memasarkan **"ERP Integration"** sebagai fitur
tersendiri (https://www.talenta.co/en/features/). GreatDay menyediakan **cost
center** di level perusahaan: "Menambah/mengedit cost center",
https://help.greatdayhr.com/id/ .

**Keadaan kita.**
- `costCenter` ada, tapi hanya sebagai label pada departemen:
  `backend/src/database/prisma/schema.prisma:276` (`costCenter String?` pada
  `Department`), `organization.dto.ts:98`, UI-nya di
  `frontend/src/modules/organization/pages/DepartmentListPage.tsx:47`.
  **Tidak ada apa pun di payroll yang membacanya** — `costCenter` tidak muncul
  sekali pun di `backend/src/modules/payroll/` atau `backend/src/shared/payroll/`.
- Tidak ada konsep jurnal: `rtk proxy grep -rIn -i "journal|general.ledger|
  accounting|akuntansi|jurnal"` di `backend/src` hanya mengenai nama departemen
  seed ("Finance & Accounting") dan komentar metode penyusutan aset.
- Laporan yang ada tidak termasuk ini: tujuh endpoint di
  `backend/src/modules/reports/reports.routes.ts:22-28` (`summary`, `headcount`,
  `attendance`, `leave`, `payroll`, `turnover`, `recruitment`) — `payroll` adalah
  rekap, bukan jurnal per akun/cost center.

**Severity: negotiate.** Yang menolak biasanya bukan HR tapi finance, dan
biasanya bisa ditunda dengan ekspor manual — tapi untuk grup perusahaan ini
sering jadi syarat.

**Ukuran: M.** Sebagian besar datanya sudah ada di `Payslip`/`PayslipComponent`
plus `employeeSnapshot` (yang sudah membekukan departemen). Yang perlu
diputuskan: pemetaan komponen → akun, dan apakah cost center ikut di level
karyawan (sekarang hanya di departemen).

---

### 🟡 GAP-48 — Rekrutmen tidak punya halaman karier publik / pelamar tidak bisa melamar sendiri

**Apa ini.** Lowongan dipublikasikan, pelamar mengisi formulir sendiri dan
mengunggah CV, lamarannya langsung masuk ke pipeline. Di sistem kita **semua
pelamar harus diketik oleh HR**.

**Bukti diharapkan.** GreatDay menjual Recruitment sebagai "Kelola Data Lowongan
dan **Pelamar**" (https://greatdayhr.com/id-id/fitur/) dengan panduan "Membuat
lowongan pekerjaan" (https://help.greatdayhr.com/id/); Talenta memisahkan
"Recruitment" dan **"Candidate assessment"**
(https://www.talenta.co/en/features/).

**Keadaan kita.** `backend/src/modules/recruitment/recruitment.routes.ts:15-16`
memasang `router.use(authenticate)` dan `router.use(requireCompanyAccess())`
untuk **seluruh** router, dan setiap rute di bawahnya meminta izin
`recruitment:*` — termasuk `POST /candidates` (`:63`) dan `POST /applications`
(`:66`). Tidak ada rute publik/tanpa autentikasi di modul ini, dan tidak ada
jejak halaman karier: `careerSite` → 0 file; `assessment` → 1 file (bukan
rekrutmen). `Candidate` dibuat hanya oleh pengguna internal
(`recruitment.service.ts:287` bahkan mengisi `nationality: 'Indonesia'` sebagai
default saat mengangkat kandidat).

Pipeline internalnya sendiri lengkap: posting → kandidat → lamaran → interview →
feedback → offer (`recruitment.routes.ts:55-77`), lengkap dengan approval
posting dan offer. Yang hilang hanya **pintu masuk dari luar**.

**Severity: negotiate.** Pembeli yang merekrut banyak akan membandingkannya
dengan ATS yang punya halaman karier; yang merekrut sedikit tidak akan sadar.

**Ukuran: M.** Butuh rute publik dengan permukaan terbatas (rate limit, captcha,
unggah CV, tanpa kebocoran daftar lowongan perusahaan lain) — keamanannya lebih
mahal daripada fiturnya.

---

### 🟡 GAP-49 — Tidak ada dasar upah harian/jam (pekerja harian lepas, borongan)

**Apa ini.** Banyak pembeli di manufaktur, retail, F&B, dan konstruksi punya
pekerja dengan **upah harian** atau per jam, bukan gaji bulanan. Di sistem kita
upah selalu bulanan.

**Bukti diharapkan.** Talenta menyebut dukungan "pegawai tetap dan tidak tetap"
sebagai pembeda produknya:
https://www.talenta.co/blog/serba-serbi-pph-21-pegawai-tetap-yang-lengkap/
(dan PPh21 pegawai tidak tetap punya aturannya sendiri).

**Keadaan kita.**
- `enum EmploymentType` hanya `PERMANENT | CONTRACT | INTERN | PROBATION |
  FREELANCE | OUTSOURCING` — tidak ada `DAILY`/`HOURLY`.
- `model EmployeeSalary` hanya punya `baseSalary Decimal` tanpa penanda dasar
  upah (tidak ada `salaryBasis`/`payBasis`/`rateType`), dan seluruh payroll
  memperlakukannya sebagai nilai bulanan: lembur
  (`payroll.service.ts:803-806` → `monthlyWage`), potongan alpha
  (`:823` → `baseMonthlyWage / defaultWorkingDaysPerMonth`), THR
  (`thr.ts` → `monthlyWage`), pesangon (`severance.ts` → `monthlyWage`).
- `HOURLY` → 0 file; `DAILY` muncul hanya sebagai `ClaimPeriodType`
  (`claim-limit.ts:1`) dan periode serupa, bukan dasar upah.

**Severity: negotiate, dan walk away untuk sektor tertentu.** Pembeli
manufaktur/konstruksi akan menanyakan ini di menit pertama; pembeli kantoran
tidak akan menanyakannya sama sekali.

**Ukuran: M.** Perlu schema (`payBasis` + rate) dan cabang perhitungan, dan
menyentuh jalur uang — jadi harus diputuskan sadar, bukan ditambal.

---

### 🟡 GAP-50 — Tidak ada HR helpdesk / tiket permintaan ke HR

**Apa ini.** Karyawan punya satu tempat mengajukan pertanyaan atau permintaan ke
HR ("slip gaji saya beda", "minta surat keterangan", "ubah data rekening"), dan
HR melihatnya sebagai tiket dengan status dan penanggung jawab. Sekarang ini
terjadi di WhatsApp.

**Bukti diharapkan.** Talenta: **"HR Helpdesk"** sebagai fitur Administration HR
tersendiri, https://www.talenta.co/en/features/ . GreatDay mendekatinya lewat
Chat + "Saran", https://help.greatdayhr.com/id/ .

**Keadaan kita.** `helpdesk` → 0 file; `ticket` → 0 file di `backend/src/modules`
dan `frontend/src/modules`; tidak ada model tiket di schema (daftar 168 model
tidak memuat Ticket/Request/Inquiry apa pun selain `PermissionRequest`, yang
adalah izin tidak masuk kerja, bukan tiket ke HR). `WorkflowEngine` bisa
menampung alurnya, tapi tidak ada entitas tiket yang dilewatkan ke sana.

**Severity: negotiate / sebagian tidak diperhatikan.** Perusahaan besar
menanyakannya; perusahaan kecil tidak.

**Ukuran: M.** Entitas tiket + kategori + SLA. `workflow-sla.scheduler.ts` sudah
ada dan bisa dipakai ulang.

---

### 🟡 GAP-51 — Pilar Engagement (feed, kudos, chat, acara) tidak ada sama sekali

**Apa ini.** Beranda sosial tempat karyawan menulis dan menyukai postingan,
apresiasi antar-rekan (kudos), obrolan internal, dan kalender acara perusahaan.
Ini **satu dari lima pilar** yang dipasarkan GreatDay, dan alasan utama
karyawan membuka aplikasinya tiap hari.

**Bukti diharapkan.** GreatDay: pilar **Engagement — "Pengelolaan Keterlibatan
Karyawan"** (https://greatdayhr.com/id-id/fitur/), halaman portal karyawan
(https://greatdayhr.com/id-id/fitur/portal-karyawan/), dan kategori help centre
**Feeds** ("Menulis post", "Melihat post"), **Chat** ("Membuat obrolan grup",
"Memulai obrolan"), **Acara** ("Membuat acara") —
https://help.greatdayhr.com/id/ . Talenta: **"Internal Communication"**,
https://www.talenta.co/en/features/ .

**Lingkup yang dipotong.** Survei/polling — bagian lain dari pilar yang sama —
**tidak** dihitung di sini karena dokumen asal sudah menyebutnya
(`docs/gap-analysis-vs-greatday.md:712`). Yang belum pernah disebut adalah
feed/kudos, chat, dan kalender acara.

**Keadaan kita.** Tidak ada model Post/Feed/Reaction/Comment/Message/Thread/
Event di 168 model schema; `chat` → 0 file, `kudos` → 0 file, `socialFeed` → 0
file. Yang terdekat adalah `Announcement` + `AnnouncementRead` — komunikasi
**satu arah dari HR**, tanpa reaksi, komentar, atau postingan karyawan.

**Severity: negotiate.** Pembeli yang membandingkan dengan GreatDay akan melihat
kolom ini kosong. Tapi jujur: ini juga bagian yang paling sering tidak dipakai
setelah dibeli, dan yang paling mahal dibangun benar (notifikasi, moderasi,
retensi).

**Ukuran: L.** Rekomendasi: jangan bangun semuanya. Yang paling murah dan paling
sering benar-benar dipakai adalah **komentar/reaksi pada Announcement** dan
**kalender acara perusahaan** di atas `WorkCalendar` yang sudah ada; chat
sebaiknya ditolak secara sadar (kompetisi dengan WhatsApp/Slack yang sudah
dipakai, dan menyeret kewajiban retensi & moderasi).

---

## Bagian 4 — Diperiksa, dinamai, dan **tidak dihitung** sebagai gap

Supaya daftar ini tidak dipadati:

| Kapabilitas benchmark | Kenyataan & alasan tidak dihitung |
|---|---|
| **Endpoint `TaskAssignment` dan `AssetPatrolLog`** (GreatDay "Basic Operational", "Outsource/Patrol") | Model ada (`schema.prisma:4677`, `:4746`), endpoint tidak (`taskAssignment`/`assetPatrolLog` → 0 file di kode). **Sudah tercatat** di tabel "Pemeriksaan checklist 15-siklus" di `docs/gap-analysis-vs-greatday.md` — bukan temuan baru |
| **Reminder dokumen kedaluwarsa** (sertifikat, SIM, KITAS, MCU) | `Document.expiresAt` ada **dan diindeks** (`@@index([expiresAt])`), tetapi tidak ada scheduler yang menyapunya (`ls backend/src/modules/*/*scheduler*` → 7 scheduler (career-transaction, employment-contract, leave, push-delivery, offboarding, webhook, workflow-sla), tidak satu pun untuk dokumen). Tidak dihitung karena **tidak menemukan halaman benchmark publik** yang menjualnya; ukurannya kecil (satu scheduler di atas indeks yang sudah ada) dan layak dikerjakan bersama GAP-19/EmploymentContract |
| **PPh26 untuk WNA** | `Employee.nationality` ada (`schema.prisma:2325`), tarif PPh26 tidak. Talenta menyebutnya, tetapi ini relevan hanya untuk pembeli dengan ekspatriat — **niche**, dan segaris dengan GAP-17 gross-up yang sudah diputuskan tidak dibangun karena alasan yang sama |
| **Live tracking / jejak GPS karyawan** (GreatDay "Melihat tracking karyawan") | `DailyActivity` sudah merekam aktivitas dengan GPS + foto dan punya endpoint penuh. Pelacakan posisi terus-menerus adalah produk yang berbeda (sales/kurir), berat secara privasi, dan sebaiknya keputusan sadar — **niche** |
| **ITCS / cek suhu** | Peninggalan 2020–2021. Tidak relevan untuk pembeli 2026 |
| **GreatDay Kiosk** (absensi tablet bersama) | Pada dasarnya varian perangkat dari **GAP-31** yang sudah ditutup (`AttendanceDevice` + `AttendanceDevicePunch` dengan kredensial perangkat) — di luar lingkup |
| **Survei & polling karyawan** (GreatDay "Pemungutan Suara", "Saran"; Talenta "Request Management & Survey") | Empat tabel ada (`schema.prisma:4832` `Survey`, `:4861` `SurveyQuestion`, `:4881` `SurveyResponse`, `:4898` `SurveyAnswer`) dan logikanya ada sebagai fungsi murni (`backend/src/shared/engagement/survey-poll.ts:106,142`), tetapi **tidak ada modul/rute/controller sama sekali** (`rtk proxy grep -rIln "surveyResponse"` → 0; tidak ada `modules/survey/` di antara 29 modul). **Dicabut sebagai temuan baru**: `docs/gap-analysis-vs-greatday.md:712` sudah mencatatnya persis begitu — "Engagement Portal (Announcement/Survey) … pure logic not wired … PENDING Optional Next Step". Tetap pekerjaan paling murah yang tersisa (schema sudah berdiri, ukuran S) |
| **Bagan organisasi** | **Sudah ada** — `OrganizationChartPage` di frontend, dan `docs/gap-analysis-vs-greatday.md:1169` sudah mencatatnya sebagai dugaan-kurang yang ternyata ada. Endpoint hirarkinya `organization.routes.ts:90` |
| **LMS penuh (progres per materi, kuis, sertifikat)** | `TrainingCourse` + `TrainingMaterial` + self-enroll + self-complete sudah ada (`training.routes.ts:41-53`). Yang belum: progres per materi dan kuis — **penghalusan**, bukan ketiadaan |
| **Succession planning / career path / 9-box** | Sudah tercatat di P2 §47 dan disebut di `docs/gap-analysis-vs-greatday.md` — di luar lingkup |
| **Timesheet proyek, API bank** | GAP-35 dan GAP-36 — **dilewati dengan sadar** |

---

## Bagian 5 — Kapabilitas benchmark yang diperiksa dan **ternyata sudah ada**

Ini bagian yang menjaga audit ini jujur: 36 kapabilitas yang diiklankan
benchmark dicari di kode dan **ditemukan**, beberapa di antaranya di tempat yang
tidak diduga (sebab itulah dokumen asalnya punya riwayat verdict "hilang" yang
salah).

| Kapabilitas benchmark | Bukti di kode |
|---|---|
| Impor massal karyawan dari berkas *(sudah dicatat di dok. asal baris 1169)* | `backend/src/modules/employee/employee.routes.ts:111` → `employee.controller.ts:223` |
| Ekspor daftar karyawan (dengan masking data sensitif) | `backend/src/modules/employee/employee.controller.ts:244-248` (`maskSensitive: !canReadSensitiveEmployeeData()`) |
| **Delegasi approval** saat approver cuti | `backend/src/modules/workflow-engine/workflow-engine.routes.ts:38-40` (list/create/revoke, delegator = pemanggil), repository `:361-411`, dan dihormati saat memutuskan `:732` |
| Penyesuaian saldo cuti manual oleh HR | `backend/src/modules/leave/leave.routes.ts:138` (`POST /balances`, audit `SET_BALANCE`) |
| Accrual cuti tahunan terjadwal | `backend/src/modules/leave/leave.scheduler.ts`, endpoint manual `leave.routes.ts:139` |
| **Multibank salary** — satu run, banyak bank | `backend/src/shared/payroll/disbursement.ts:69-120` (resolusi per `bankCode`, rekening primer, fallback legacy) + ekspor CSV per bank (GAP-12) |
| Beberapa rekening bank per karyawan | model `EmployeeBankAccount` (`schema.prisma:838`), dibaca di `disbursement.ts:112` |
| Kalkulator THR sesuai Permenaker 6/2016 | `backend/src/shared/payroll/thr.ts:44` + `thr.test.ts` (pembayarannya → GAP-41) |
| Kalkulator pesangon UU 13/2003 + faktor PP 35/2021 | `backend/src/shared/payroll/severance.ts:71-115` (pembayarannya → GAP-42) |
| Offboarding: resign → approval → clearance → selesai | model `Resignation` (`schema.prisma:3098`) + `ExitClearance` (`:3125`), rute `onboarding.routes.ts:17-26`, scheduler `onboarding/offboarding.scheduler.ts` |
| Onboarding checklist | `onboarding.routes.ts:13-15` |
| UI dua bahasa (ID/EN) *(sudah dicatat di dok. asal baris 1169 sebagai `LanguageSwitcher`)* | `frontend/src/i18n/dictionaries/*` — mis. `workforce.ts:405` (ID) vs `:1048` (EN) |
| Cost center pada unit organisasi | `schema.prisma:276`, `organization.dto.ts:98`, UI `DepartmentListPage.tsx:47` (jurnalnya → GAP-48) |
| Zona waktu per perusahaan dan per cabang | `schema.prisma:60` (Company), `:219` (Branch) |
| Hirarki/struktur organisasi + bagan | `backend/src/modules/organization/organization.routes.ts:90`; `OrganizationChartPage` di frontend |
| Pola shift & formula shift | model `ShiftFormula` + `ShiftFormulaDay`; rute `work-calendar.routes.ts:37-39` |
| Tukar shift dengan approval | `work-calendar.routes.ts:74-79` |
| Shift override per karyawan | model `EmployeeShiftOverride` (GAP-04) |
| Klaim & reimbursement dengan lampiran bukti | modul `travel-expense` (`ExpenseClaim`, `ExpenseApproval`, `Reimbursement`), unggah `travel-expense.routes.ts:46` (plafonnya → GAP-45) |
| Perjalanan dinas + uang muka | model `BusinessTrip`, `TravelAdvance` |
| Manajemen pinjaman karyawan + angsuran | modul `employee-loan` (`LoanType`, `Loan`, `LoanInstallment`), potongan otomatis di run (`ensureLoanDeductionComponent`) |
| Earned Wage Access (tarik gaji lebih awal) | modul `ewa`, model `EarnedWageAccess`, potongan di run |
| Manajemen aset + serah terima + penyusutan | modul `asset`, `backend/src/shared/asset/depreciation.ts` |
| Aktivitas harian dengan bukti GPS + foto | modul `daily-activity` (rute lengkap), model `DailyActivity` |
| Face matching / liveness pada absensi | `EmployeeFaceProfile`, `AttendanceFaceLog`, `runRateLimitedFaceMatch` di jalur check-in |
| Tanda tangan digital berurutan + jejak akses | `DocumentSigner`, `document-signing.service.ts`, `DocumentAccessLog` (GAP-27) |
| Pengumuman bertarget + bukti baca | `Announcement` + `AnnouncementRead`, `/announcements/manage` |
| ATS internal: posting → kandidat → lamaran → interview → feedback → offer, dengan approval | `recruitment.routes.ts:55-77` (pintu publiknya → GAP-49) |
| Performance: metode/formula/indikator, periode, kalibrasi, sengketa, 360 feedback | `PerformanceMethod*`, `PerformanceCalibration*`, `FeedbackRequest`/`FeedbackResponse`, `ReviewCycle` |
| Training: kategori, kursus, materi, sesi, pendaftaran sendiri, penyelesaian, umpan balik | `training.routes.ts:16-53`, model `TrainingFeedback` (GAP-25) |
| Slip gaji terlindungi PIN + notifikasi penerbitan | `backend/src/shared/payroll/payslip-pin.ts`, `payslip-breakdown.ts` (GAP-13) |
| Push notification ke perangkat mobile | `MobileDeviceRegistration`, `PushNotificationDelivery`, `notification/push-delivery.scheduler.ts` |
| Data keluarga/tanggungan untuk PTKP | model `EmployeeFamily`, dipakai `employee.repository.ts`/`employee.service.ts` |
| BPJS dua sisi dengan cap | `backend/src/shared/payroll/bpjs.ts`, `bpjs-jkn.ts`, model `BpjsReference` |
| Lembur dengan band statutori workday/holiday | `calculateOvertimePay` dipakai di `payroll.service.ts:803-806` |
| Audit trail + log login | `AuditLog`, `LoginLog`, `LoginAttempt`, modul `audit-log` |

