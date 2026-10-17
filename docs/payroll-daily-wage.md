# Upah harian (GAP-49)

`EmployeeSalary.payBasis = DAILY` menyatakan `baseSalary` adalah **tarif
sehari**. Run reguler membayar `tarif × hari hadir` sebagai komponen sistem
`DAILY_WAGE_AUTO` — lewat mesin yang sama, jadi PPh 21 (TER bulanan/annualized,
PMK 168/2023 untuk upah harian yang diterima bulanan), BPJS, potongan pinjaman
dan EWA semuanya mengikuti upah yang benar-benar diperoleh bulan itu.

Perilaku yang disengaja:

- **Hari tidak hadir tidak dibayar, titik.** Potongan alpha dan potongan cuti
  tidak dibayar dilewati — memotong hari yang memang tidak diupah adalah
  hukuman ganda.
- **0 hari hadir → tidak ada payslip.** Payslip nol hanya jadi derau laporan.
- **Alokasi komponen bulanan ditolak** pada baris gaji DAILY (DTO dan mesin).
  Tunjangan untuk pekerja harian harus jadi keputusan sadar tersendiri.
- **Lembur** memakai upah sebulan ekuivalen Kepmenaker 102/2004: tarif × 21
  (workweek 5 hari) atau × 25 (6 hari).
- **`payslip.baseSalary` berisi upah bulan itu** (tarif × hadir), bukan tarif —
  supaya laporan yang membaca kolom itu sebagai angka bulanan tetap benar.
  Tarif dan jumlah hari ada di `employeeSnapshot.wage`.

Yang sengaja MENOLAK/MELEWATI pekerja harian (asumsi upah bulanan di rumusnya):

| Jalur | Perilaku |
|---|---|
| THR run | dilewati (THR pekerja harian = rata-rata upah 12 bulan, kebijakan tersendiri) |
| THR endpoint individual | 400 dengan pesan jelas |
| Rapel (arrears) | 400 — hari terlewat pekerja harian dibayar lewat koreksi |
| Pesangon (`calculateFinalPayroll`) | 400 — pesangon dihitung dari upah sebulan |

`HOURLY` sengaja belum ada: absensi belum mengukur jam kerja reguler (hanya
lembur), jadi menamakannya sekarang menjanjikan yang tidak bisa dihitung.
