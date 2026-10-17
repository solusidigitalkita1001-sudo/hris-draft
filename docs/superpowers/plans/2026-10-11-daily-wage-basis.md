# Dasar upah harian — rencana (GAP-49)

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans.

**Goal:** `EmployeeSalary` bisa menyatakan upah HARIAN; run reguler membayar tarif × hari hadir lewat mesin yang sudah ada.

**Keputusan (v1, sadar dan tercatat):**
- `payBasis` enum `MONTHLY | DAILY` di `EmployeeSalary`, default MONTHLY. Untuk DAILY, `baseSalary` BERARTI TARIF HARIAN. **HOURLY ditunda**: absensi belum mengukur jam kerja reguler (hanya lembur), jadi menamakannya sekarang menjanjikan yang tidak bisa dihitung.
- Upah masuk sebagai komponen sistem `DAILY_WAGE_AUTO` = tarif × `attd.present` (hari hadir; cuti dan absen tidak dibayar — itulah arti upah harian). 0 hari hadir → tidak ada payslip.
- Alokasi komponen bulanan DITOLAK pada baris gaji DAILY (DTO dan mesin): tunjangan bulanan untuk pekerja harian harus jadi keputusan sendiri, bukan kebetulan.
- Pajak: upah harian yang dibayarkan BULANAN memakai TER bulanan/annualized (PMK 168/2023 — upah harian diterima bulanan dihitung seperti pegawai dengan penghasilan bulanan), lewat `calculateEmployeePay` yang sudah ada; basis BPJS dan benefit% = upah bulan itu.
- Potongan alpha dan cuti-tidak-dibayar DILEWATI untuk DAILY (hari tidak hadir memang tidak dibayar — memotong lagi = hukuman ganda).
- Lembur DAILY: upah sebulan ekuivalen = tarif × 21 (workweek 5 hari) / × 25 (6 hari), Kepmenaker 102/2004.
- Jalur yang berasumsi bulanan MENOLAK/MELEWATI DAILY dengan pesan jelas: THR run melewati (kebijakan THR pekerja harian = pekerjaan sendiri), THR endpoint individual menolak, rapel menolak, pesangon menolak.

**Tasks:** (1) schema+migrasi `pay_basis`; (2) DTO+repository create/update; (3) cabang mesin reguler + komponen `DAILY_WAGE_AUTO` + guards THR/rapel/pesangon/koreksi; (4) test: DTO, guard unit, mysql end-to-end (2 hari hadir × tarif, komponen, pajak 0 di nominal kecil); docs + gap.
