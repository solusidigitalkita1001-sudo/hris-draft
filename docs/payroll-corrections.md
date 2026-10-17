# Payroll correction run (GAP-14/21b)

Jalur ketiga untuk nominal yang salah pada payslip yang **sudah dibayar**.
Dua jalur lama tidak menutupinya: `voidPayrollRun` hanya menerima run yang
belum di-approve, dan rapel (`PayrollArrears`) menolak kalau payslip-nya sudah
ada. Desain lengkap beserta alasan tiap keputusan:
[spec 2026-10-08](superpowers/specs/2026-10-08-payroll-correction-run-design.md).

## Alur

1. **Daftarkan koreksi** — `POST /payroll/corrections` (izin `payroll:correct`,
   masuk audit log):

   ```json
   { "sourcePayslipId": "…", "amount": 250000, "reason": "Lembur 12 jam Oktober tidak terbayar" }
   ```

   - `amount` positif = kurang bayar, negatif = kelebihan bayar; nol ditolak.
   - `reason` wajib ≥ 10 karakter — alasannya ikut diaudit.
   - Payslip sumber harus `FINAL` pada run `APPROVED`/`DISBURSED`. Run yang
     masih `COMPLETED` diarahkan ke `PATCH /payroll/runs/:id/void` — satu
     masalah tidak punya dua jalur.
   - Satu koreksi `PENDING` per payslip; koreksi kedua boleh setelah yang
     pertama `APPLIED` (koreksi berantai tercatat berurutan).

2. **Lihat / batalkan** — `GET /payroll/corrections?status=&employeeId=`
   (`payroll:read`) dan `POST /payroll/corrections/:id/cancel`
   (`payroll:correct`, hanya `PENDING`).

3. **Bayar** — buat run bertipe `CORRECTION` (`POST /payroll/runs`,
   `runType: "CORRECTION"`) pada periode **lain** dari periode yang dikoreksi.
   Perhitungannya mandiri — tanpa mesin absensi, lembur, pinjaman, BPJS:
   - per karyawan: seluruh kurang bayar dibayar penuh sebagai satu earning
     (`CORRECTION_EARNING_AUTO`);
   - kelebihan bayar jadi potongan (`CORRECTION_DEDUCTION_AUTO`) yang dibatasi
     agar **netto tidak pernah negatif** — payslip tidak menagih karyawan, dan
     bank file tidak menerima angka negatif;
   - sisa potongan yang tidak tertampung mengecilkan `remainingAmount` dan
     tetap `PENDING` menunggu earning koreksi berikutnya;
   - karyawan yang hanya punya koreksi negatif **dilewati** (tanpa payslip) dan
     disebut di `notes` run;
   - approve dan disburse memakai maker-checker yang sudah ada.

## Pajak: di periode pembayaran

Konsisten dengan rapel: earning koreksi dipajaki PPh 21 pada periode run
CORRECTION, sebagai selisih marginal di atas gaji bulanan as-of karyawan,
dengan metode perusahaan (`pph21_method`: TER atau ANNUALIZED) lewat helper
yang sama dengan THR. **Catatan untuk HR:** koreksi besar atas periode Januari
yang dibayar Desember menaikkan pajak Desember — itu perilaku yang benar untuk
TER maupun annualized, bukan bug.

## Jejak

- Baris koreksi menunjuk payslip yang salah (`sourcePayslipId`) dan payslip
  yang membayarnya (`payslipId`, `appliedRunId`, `appliedAt`).
- Snapshot payslip koreksi menyimpan baris mana saja yang ia tutup dan dasar
  pajaknya.
- Audit log pada pendaftaran dan pembatalan; `reason` tidak pernah kosong.

## Di luar lingkup (dicatat di spec)

Pembetulan 1721-A1 lintas tahun, piutang karyawan untuk kelebihan bayar
menggantung, UI frontend, koreksi otomatis dari hitung-ulang, run SEVERANCE.
