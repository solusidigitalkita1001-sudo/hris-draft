# PRD — HRIS Draft (HRMS Enterprise)

| | |
|---|---|
| **Versi dokumen** | 1.0 |
| **Tanggal** | 2 Oktober 2026 |
| **Status** | Draft untuk review |
| **Pemilik produk** | Bale Inovasi Teknologi |
| **Benchmark pasar** | GreatDay HR, Talenta, Gadjian (pasar HRIS Indonesia) |

> Dokumen ini menggambarkan produk sebagaimana **dirancang untuk dijual**, bukan sebagai sistem internal satu perusahaan. Status implementasi aktual per modul ada di `docs/checklist-implementation-status.md`; gap terhadap benchmark ada di `docs/gap-analysis-vs-greatday.md`.

---

## 1. Ringkasan Produk

HRIS Draft adalah **Human Resource Information System multi-tenant** untuk perusahaan Indonesia, dijual sebagai produk (SaaS atau on-premise per pelanggan). Satu instalasi melayani **grup perusahaan**: beberapa badan hukum (company) di bawah satu group, masing-masing dengan cabang/office, struktur organisasi, kebijakan HR, dan payroll sendiri.

Produk menutup siklus hidup karyawan dari rekrutmen sampai offboarding, dengan tiga lapisan yang membedakannya dari sekadar aplikasi absensi:

1. **Payroll yang patuh regulasi Indonesia** — PPh21, BPJS Kesehatan & Ketenagakerjaan, THR, bukti potong 1721-A1, rekonsiliasi Desember. **Catatan akurasi: pemotongan bulanan masih memakai metode netto disetahunkan (UU HPP 2022), belum TER sesuai PMK 168/2023.** Lihat GAP-40.
2. **Kebijakan sebagai konfigurasi per perusahaan**, bukan konstanta di kode — tiap tenant mengatur aturan cuti, absensi, lembur, dan payroll-nya sendiri.
3. **Jejak audit dan isolasi tenant yang bisa diaudit** — setiap mutasi data karyawan tercatat; tidak ada query yang bisa menembus batas company.

### Masalah yang diselesaikan

| Masalah | Kondisi tanpa produk ini |
|---|---|
| Data karyawan tersebar | Spreadsheet per divisi, tidak ada satu sumber kebenaran, riwayat hilang saat mutasi |
| Absensi manual | Rekap Excel bulanan, tidak ada bukti lokasi/foto, keterlambatan tidak terhitung ke payroll |
| Cuti lewat chat/kertas | Saldo tidak akurat, approval tidak terlacak, carry-over dihitung manual |
| Payroll rawan salah | PPh21 dan BPJS dihitung manual, satu perubahan regulasi = ratusan baris dikoreksi tangan |
| Grup perusahaan | Satu aplikasi per PT, biaya berlipat, laporan konsolidasi tidak mungkin |
| Audit & compliance | Tidak bisa menjawab "siapa mengubah gaji ini, kapan, atas dasar apa" |

### Prinsip produk

- **Domain-first** — fitur mengikuti domain HR (Employee, Attendance, Leave, Payroll), bukan tabel generik.
- **Policy-driven** — keputusan HR jadi setting perusahaan yang bisa diubah tanpa deploy.
- **Historis utuh** — data lama tidak ditimpa; mutasi jabatan, gaji, dan kontrak menyimpan riwayat.
- **Netral vendor** — integrasi mesin absensi, SSO, dan bank memakai kontrak generik, bukan SDK satu merek.
- **Aman secara default** — setiap route mutasi wajib punya guard (ditegakkan oleh test di CI).

---

## 2. Target Pengguna & Persona

### Segmen pelanggan

| Segmen | Ukuran | Kebutuhan dominan |
|---|---|---|
| **Primer** | Grup perusahaan 100–2.000 karyawan, multi-PT/multi-cabang | Konsolidasi, payroll patuh, approval berjenjang |
| Sekunder | Perusahaan tunggal 50–500 karyawan | Absensi + cuti + payroll dalam satu alat |
| Tersier | Perusahaan jasa/proyek | Timesheet per proyek, klaim perjalanan, cost center |

### Persona

**P1 — HR Admin / HR Staff.** Pemakai harian terberat. Input karyawan baru, verifikasi absensi, proses cuti, jalankan payroll. Ukuran sukses: tutup payroll bulanan tanpa koreksi manual.

**P2 — HR Manager / HR Director.** Menyetujui, mengatur kebijakan, membaca laporan. Butuh ringkasan headcount, turnover, biaya tenaga kerja per perusahaan dan konsolidasi grup.

**P3 — Atasan langsung (Supervisor/Manager).** Menyetujui cuti, lembur, koreksi absensi, klaim, dan penilaian kinerja tim langsungnya. Tidak boleh melihat data di luar lingkupnya.

**P4 — Karyawan (ESS).** Check-in/out, ajukan cuti dan izin, lihat slip gaji, unduh dokumen, ajukan EWA/pinjaman. Mayoritas akses dari ponsel.

**P5 — Finance / Payroll Officer.** Memverifikasi hasil payroll, menerbitkan pembayaran, mencatat ledger, menyiapkan file transfer bank dan laporan BPJS/pajak.

**P6 — Group Admin / Super Admin.** Mengelola perusahaan, cabang, role & permission, integrasi, serta membaca audit log.

---

## 3. Cakupan Produk (Modul)

Backend terdiri dari 29 modul domain di atas ~168 model data. Tabel berikut adalah daftar kemampuan yang dijanjikan produk.

### 3.1 Fondasi

| Modul | Kemampuan inti |
|---|---|
| **Auth** | Login email/password, JWT access (15m) + refresh rotasi (7d), lockout anti-brute-force, reset password, SSO OIDC, CSRF, sesi per device |
| **RBAC** | Role & permission granular (`Create Employee`, `Approve Payroll`, …), scoping per group/company/organization, ABAC untuk data diri sendiri vs tim vs seluruh perusahaan |
| **Organization** | Group → Company → Office/Branch → Division → Department → Position/Job Level; hierarki pelaporan; riwayat perubahan struktur |
| **User** | Akun, pemetaan ke karyawan, status aktif/suspend, pergantian perusahaan aktif (company switching) |
| **Company Settings** | Kebijakan HR per perusahaan: aturan absensi, cuti, lembur, pembulatan, periode payroll, komponen gaji |
| **Audit Log** | Catatan siapa–kapan–apa untuk seluruh mutasi dan akses data sensitif (termasuk `auditView` untuk pembacaan payroll) |
| **Workflow Engine** | Template approval berjenjang per jenis pengajuan, delegasi, pencegahan self-approval, eskalasi |
| **Notification** | In-app + email; antrean via Redis/BullMQ; template per event (cuti disetujui, slip gaji terbit) |
| **Webhook** | Outbound event ke sistem eksternal dengan signing dan retry |

### 3.2 Employee Lifecycle

| Modul | Kemampuan inti |
|---|---|
| **Employee** | Master data karyawan: identitas, kontak, keluarga, pendidikan, pengalaman, dokumen, data bank, NPWP/BPJS; riwayat jabatan & mutasi; status kepegawaian; employment contract dengan monitoring kedaluwarsa |
| **Recruitment** | Job requisition dengan approval, kandidat, tahapan seleksi, offer, konversi kandidat → karyawan |
| **Onboarding** | Checklist tugas onboarding per role, penanggung jawab, progres, integrasi dokumen |
| **Document Management** | Repositori dokumen karyawan & perusahaan, kategori, masa berlaku, tanda tangan berurutan (signer order), kontrol akses per dokumen |
| **Performance** | Siklus review, template penilaian, goal/KPI, self & manager assessment, approval hasil |
| **Training** | Katalog kursus, pendaftaran, kehadiran, sertifikat, umpan balik peserta |
| **Asset** | Aset yang dipegang karyawan: serah terima, pengembalian, kondisi, penautan ke offboarding |
| **Announcement** | Pengumuman internal dengan audiens tertarget dan status baca |

### 3.3 Time & Attendance

| Modul | Kemampuan inti |
|---|---|
| **Attendance** | Check-in/out dengan GPS + foto, geofence per cabang, shift & jadwal kerja (termasuk rotasi regu), keterlambatan & pulang cepat, overtime, koreksi/regularisasi absensi dengan approval, rekap bulanan yang direview sebelum masuk payroll, integrasi punch dari mesin fingerprint lewat API device-credential |
| **Leave** | Jenis cuti per perusahaan (tahunan, sakit, melahirkan, duka, tanpa gaji), saldo & akrual, carry-over, cuti kolektif (cuti bersama), encashment saldo, pengecekan tumpang tindih, approval berjenjang |
| **Permission Request** | Izin jam-an / keluar kantor / lupa absen sebagai pengajuan terpisah dari cuti |
| **Work Calendar** | Kalender kerja per perusahaan/cabang, hari libur nasional & cuti bersama, generate tahunan tanpa menghapus libur yang sudah ada |
| **Daily Activity** | Laporan aktivitas harian / timesheet, dasar untuk perusahaan yang menagih per jam |
| **Travel Expense** | Pengajuan perjalanan dinas, uang muka, realisasi, lampiran bukti, approval dan pencairan |

### 3.4 Payroll & Compensation

| Modul | Kemampuan inti |
|---|---|
| **Payroll** | Komponen gaji (earning/deduction) berbasis formula, alokasi gaji per karyawan dengan riwayat, payroll run per periode dengan state machine (draft → calculated → approved → paid), input dari absensi & cuti & lembur, PPh21 (metode netto disetahunkan; TER PMK 168/2023 belum diimplementasikan — GAP-40) + rekonsiliasi Desember, BPJS Kesehatan & Ketenagakerjaan, THR, rapel/arrears, potongan sekali-jalan, payslip dengan unlock nominal sensitif, email payslip, ledger pembayaran, file transfer bank, laporan BPJS, rekap pajak tahunan & bukti potong |
| **Benefit** | Paket benefit, kepesertaan, nilai per karyawan, keterkaitan ke komponen gaji |
| **Employee Loan** | Pinjaman karyawan: pengajuan, approval, jadwal angsuran, potongan otomatis di payroll |
| **EWA** | Earned Wage Access — penarikan gaji yang sudah diperoleh lebih awal, batas kelayakan, approval, pemotongan di payroll berikutnya |

### 3.5 Insight

| Modul | Kemampuan inti |
|---|---|
| **Reports** | Laporan headcount, turnover, absensi, cuti, biaya payroll, kepatuhan BPJS/pajak; filter per perusahaan/cabang/periode; ekspor |
| **Administration** | Panel admin: integrasi, master data, rotasi kunci enkripsi, pemeliharaan |
| **Mobile API** | Kontrak API khusus aplikasi mobile ESS, dengan matriks permission dan fixture pengujian tersendiri (`docs/mobile-api.md`) |

---

## 4. Persyaratan Fungsional Kunci

Persyaratan di bawah adalah yang menentukan apakah produk layak dijual; detail per modul ada di `docs/modules/`.

### FR-1 — Multi-tenant yang tidak bisa ditembus
Setiap query data karyawan **wajib** terikat pada company scope pengguna. Pengguna lintas-perusahaan hanya melihat perusahaan yang eksplisit diberikan. Uji regresi isolasi tenant berjalan di CI (`docs/tenant-isolation-audit.md`).

### FR-2 — Kebijakan HR sebagai konfigurasi
Semua angka kebijakan (jam kerja, toleransi keterlambatan, batas carry-over, pembulatan lembur, metode PPh21, komponen gaji) disimpan sebagai setting perusahaan. Menambah pelanggan baru dengan kebijakan berbeda **tidak boleh** memerlukan perubahan kode.

### FR-3 — Approval berjenjang yang terkonfigurasi
Setiap pengajuan (cuti, izin, koreksi absensi, lembur, perjalanan, pinjaman, EWA, requisition, payroll) melewati template workflow per perusahaan. Self-approval ditolak di tingkat domain, bukan hanya UI.

### FR-4 — Rantai absensi → payroll utuh
Absensi mentah → rekap periode → **review & kunci oleh HR** → input payroll. Lembur, keterlambatan, cuti tanpa gaji, dan ketidakhadiran terbawa ke payslip dengan jejak perhitungan yang bisa dibuka ulang.

### FR-5 — Payroll yang dapat diaudit dan diulang
Payroll run menyimpan snapshot input dan formula yang dipakai. Menjalankan ulang periode yang sama menghasilkan angka yang sama. Potongan sekali-jalan tidak boleh terpakai dua kali. Setiap perubahan gaji menyimpan justifikasi.

### FR-6 — Kepatuhan regulasi Indonesia
PPh21 bulanan, rekonsiliasi Desember, bukti potong 1721-A1, BPJS Kesehatan
dan Ketenagakerjaan (JHT, JP, JKK, JKM) dengan batas upah, THR, dan ekspor
laporan dalam format yang diterima instansi.

> **Belum terpenuhi, dan ini syarat yang paling keras.** Pemotongan PPh21
> bulanan memakai metode **netto disetahunkan** (UU HPP 2022), bukan **TER**
> yang diwajibkan **PMK 168/2023** sejak 1 Januari 2024. Nol jejak `TER`,
> `tarif efektif`, atau `PMK 168` di `backend/src`; mesinnya ada di
> `shared/payroll/pph21.ts` dan header filenya menyebut metodenya sendiri.
> Konsultan pajak calon pembeli memeriksa hal ini lebih dulu dari apa pun.
> Dilacak sebagai GAP-40.

### FR-7 — Riwayat tidak dihapus
Mutasi jabatan, perubahan gaji, perubahan struktur organisasi, dan kontrak kerja menyimpan versi. Penghapusan karyawan adalah soft-delete/arsip; data payroll historis tetap terbaca.

### FR-8 — Kerahasiaan data payroll
Nominal payroll tersembunyi (`Rp ••••••`) sampai dibuka dengan unlock token server-side. Setiap pembacaan data gaji tercatat di audit log.

### FR-9 — ESS mobile-first
Karyawan dapat menyelesaikan check-in, pengajuan cuti, melihat payslip, dan membaca pengumuman dari ponsel tanpa fitur yang hilang dibanding web.

### FR-10 — Integrasi terbuka
SSO OIDC, webhook keluar, API punch untuk mesin absensi apa pun, dan API mobile berkontrak — semuanya tanpa ketergantungan pada satu vendor.

---

## 5. Persyaratan Non-Fungsional

| Kategori | Target |
|---|---|
| **Skala** | 2.000 karyawan aktif per tenant; payroll run 2.000 karyawan selesai < 5 menit; daftar karyawan dengan filter < 500 ms p95 |
| **Ketersediaan** | 99,5% jam kerja; deploy tanpa downtime; rollback tersedia |
| **Keamanan** | Semua route mutasi wajib punya guard (ditegakkan test di CI); bcrypt 12 rounds; rate limit per endpoint & IP; Helmet; CORS whitelist; validasi input Zod di seluruh boundary; enkripsi data sensitif dengan kunci yang bisa dirotasi |
| **Audit** | Seluruh mutasi dan pembacaan data sensitif tercatat; log tidak bisa diubah dari aplikasi |
| **Integritas data** | Operasi multi-tabel dalam transaksi; advisory lock untuk operasi yang rawan balapan (payroll run, overtime, saldo cuti) |
| **Internasionalisasi** | Bahasa Indonesia & Inggris; zona waktu per perusahaan; format mata uang Rupiah |
| **Aksesibilitas** | Kontras cukup, fokus keyboard, label form, status bukan hanya warna |
| **Pengujian** | Backend test hijau sebagai gate CI; migrasi harus bisa diterapkan dari database kosong; typecheck & build blocking |
| **Observabilitas** | Winston structured log; healthcheck eksplisit; error terkategori, bukan stack trace ke pengguna |

---

## 6. Arsitektur (ringkas)

```
Frontend  React 19 + Vite + TypeScript, Zustand, TanStack Query,
          Tailwind + Shadcn UI, Recharts
Backend   Node 20 + Express + TypeScript, Prisma ORM
Data      MySQL 8 (168 model), Redis (cache + BullMQ queue)
Auth      JWT access/refresh dengan rotasi, RBAC + ABAC, SSO OIDC
Deploy    Docker Compose + Nginx; CI gate di GitHub Actions
```

Pola internal: modul per domain (`backend/src/modules/<domain>`) dengan lapisan `shared/` untuk base class, Result pattern, security, middleware, event bus, dan hierarki exception. Aturan desain visual terpisah di `DESIGN.md`.

---

## 7. Pengalaman Pengguna

Identitas visual, token warna, tipografi, dan aturan komponen ditetapkan di **`DESIGN.md`** dan bersifat normatif. Poin yang berdampak pada produk:

- **App shell**: sidebar melayang (expand 246px / collapse 78px), topbar dengan chip perusahaan aktif, toggle tema, switch bahasa ID/EN, notifikasi berbadge.
- **Mobile < 1024px**: sidebar berubah menjadi bottom nav 5 ikon (Dashboard · Self · Pinjaman · Notifikasi · Profil).
- **Tabel** server-side seluruhnya (pagination, sort, search di server) — penting pada tenant dengan ribuan karyawan.
- **Status pengajuan** sebagai chip semantik (Menunggu/Disetujui/Ditolak), tidak pernah hanya warna.
- **Empty, loading, dan error state wajib** di setiap halaman; pesan error dari `apiErrorMessage`.

---

## 8. Metrik Keberhasilan

| Metrik | Target |
|---|---|
| Waktu tutup payroll bulanan | < 1 hari kerja, 0 koreksi manual |
| Pengajuan cuti yang diselesaikan di sistem | > 95% (bukan lewat chat) |
| Absensi harian via ESS | > 90% karyawan aktif |
| Selisih perhitungan PPh21 vs perhitungan manual auditor | 0 |
| Tiket support per 100 karyawan per bulan | < 3 |
| Waktu onboarding tenant baru (dari nol sampai payroll pertama) | < 10 hari kerja |

---

## 9. Rencana Rilis

Fase berikut mengikuti urutan nilai bagi pembeli, bukan urutan teknis.

**Fase 1 — Fondasi (selesai).** Auth, RBAC, organisasi grup, master karyawan, audit log, app shell, CI gate.

**Fase 2 — Operasional harian (selesai sebagian).** Absensi + shift + kalender kerja, cuti + saldo, workflow approval, notifikasi, ESS mobile.

**Fase 3 — Payroll patuh (fokus saat ini).** Komponen & formula, payroll run, **PPh21 TER (PMK 168/2023) — belum ada, blocker rilis komersial**, rekonsiliasi Desember, BPJS, THR, payslip, ledger pembayaran, file transfer bank, laporan BPJS & pajak tahunan.

**Fase 4 — Siklus talenta.** Rekrutmen + requisition, onboarding, performance, training, dokumen bertanda tangan, aset.

**Fase 5 — Kesiapan jual.** Timesheet proyek, laporan konsolidasi grup, SSO OIDC & webhook matang, integrasi mesin absensi, self-service tenant provisioning, dokumentasi implementasi untuk mitra.

Gap yang masih terbuka per fase terdaftar di `docs/gap-analysis-vs-greatday.md` dengan prioritas 🔴/🟠/🟡. Keputusan kebijakan HR yang masih menunggu pemilik produk ada di `docs/open-hr-decisions.md`.

---

## 10. Di Luar Cakupan

Yang **tidak** dibangun produk ini, agar batas jelas saat menjual:

- Akuntansi umum / general ledger lengkap — produk hanya menghasilkan jurnal payroll untuk diekspor.
- Core banking / disbursement langsung — produk menghasilkan file transfer, bank yang mengeksekusi.
- Penggajian lintas negara (payroll non-Indonesia).
- Applicant Tracking System tingkat agensi (job board publik, parsing CV massal).
- Learning Management System penuh (konten, kuis, pelacakan video) — hanya katalog dan pendaftaran.
- Pengelolaan perangkat mesin absensi (firmware, provisioning) — hanya menerima punch via API.
- Modul CRM, inventaris, atau ERP non-HR.

---

## 11. Risiko & Mitigasi

| Risiko | Dampak | Mitigasi |
|---|---|---|
| Regulasi pajak/BPJS berubah | Payroll salah untuk semua tenant | Tarif & batas sebagai data berversi tanggal efektif, bukan konstanta kode |
| Kebocoran lintas tenant | Fatal secara hukum dan komersial | Scope wajib di setiap query + uji isolasi tenant di CI |
| Payroll dijalankan dua kali / bersamaan | Pembayaran ganda | State machine payroll run + advisory lock + idempoten per periode |
| Data absensi mentah langsung ke payroll | Gaji salah, sengketa karyawan | Tahap review & kunci rekap sebelum payroll |
| Deploy tanpa gate | Produksi rusak | CI blocking (typecheck, build, migrasi dari kosong, test) + rilis lewat PR |
| Kebijakan HR di-hardcode | Tidak bisa jual ke pelanggan berikutnya | Kebijakan sebagai setting perusahaan (FR-2) |
| Ketergantungan satu vendor perangkat/SSO | Kehilangan calon pembeli | Kontrak integrasi generik (FR-10) |

---

## 12. Keputusan Terbuka

Pertanyaan yang perlu dijawab pemilik produk sebelum fase berikutnya dikunci:

1. **Model komersial** — SaaS multi-tenant satu instalasi, atau satu instalasi per pelanggan? Berdampak pada provisioning, backup, dan rotasi kunci.
2. **Penetapan harga** — per karyawan aktif per bulan, atau per modul? Berdampak pada metering dan laporan penggunaan.
3. **Batas dukungan versi** — apakah tenant boleh menahan versi lama? Berdampak pada strategi migrasi database.
4. **Default kebijakan HR** untuk tenant baru (lihat `docs/open-hr-decisions.md`) — nilai awal yang paling aman secara hukum.
5. **Cakupan aplikasi mobile native** — apakah dirilis sebagai aplikasi sendiri atau PWA.
