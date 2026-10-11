# SEVERANCE run — rencana (GAP-42, sisa separuh)

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans.

**Goal:** Pesangon yang hari ini hanya DIKUTIP oleh `POST /resignations/:id/final-payroll` (tidak disimpan, tidak dibayar, tanpa maker-checker) bisa dibayar lewat run bertipe `SEVERANCE`.

**Arsitektur:** salin pola yang baru saja terbukti ketiga kalinya — daftar item berstatus (arrears, corrections) + run non-reguler mandiri (THR, corrections). Angka dihitung SEKALI saat pendaftaran lewat `onboarding.calculateFinalPayroll` (UU 13/2003 + PP 68/2009, pilihan reason/faktor oleh HR) lalu DIBEKUKAN; run hanya membayar. Pajak pesangon final — run tidak menghitung pajak apa pun.

**Keputusan:**
- Izin memakai `payroll:process` yang sudah ada — mendaftarkan pesangon = menyiapkan pembayaran, persis wilayah HR_MANAGER. Tidak ada izin baru.
- `@@unique([resignationId])`: satu pembayaran pesangon per resignation seumur hidup; baris CANCELLED dihidupkan kembali saat didaftar ulang (pola D-007, bukan duplikasi).
- Komponen `SEVERANCE_EARNING_AUTO` (isTaxable **false** — pajaknya final, sudah dipotong) dan `SEVERANCE_TAX_AUTO` (DEDUCTION).
- Resignation harus `APPROVED`/`COMPLETED`, milik perusahaan aktif; total 0 ditolak ("RESIGN murni tanpa hak tidak menghasilkan pembayaran").

### Task 1 — schema + migrasi + allowlist
`SeverancePayment` (companyId, employeeId, resignationId unique, grossAmount, taxAmount, netAmount, basis Json, status PENDING/APPLIED/CANCELLED, registeredBy, appliedRunId, payslipId, appliedAt) + back-relations + `COMPANY_SCOPED_MODELS` + migration SQL.

### Task 2 — register/list/cancel
`payroll-severance.service.ts` (register memanggil `onboardingService.calculateFinalPayroll`, menyimpan basis utuh; pendingByEmployee; markApplied kondisional), `payroll-severance.dto.ts` (= `finalPayrollSchema.extend({ resignationId })`), controller + routes `/payroll/severance-payments`. Unit test pola arrears/corrections.

### Task 3 — `calculateSeverancePayroll`
Cabang `runType === 'SEVERANCE'` di `calculatePayroll`. Periode CLOSED ditolak; tanpa item PENDING ditolak (run kosong tidak dibuat); payslip per karyawan: earning = gross beku, deduction = pajak beku, netPay = net beku; attendance nol; snapshot menyimpan paymentIds + taxIsFinal; klaim kondisional; notes ringkasan; totals + COMPLETED. Unit test + perbarui test penolakan SEVERANCE di `payroll-calculation.mysql.test.ts` (kini /No pending severance/).

### Task 4 — mysql test + docs + tutup gap
`payroll-severance.mysql.test.ts` (resignation APPROVED → register → run SEVERANCE → APPLIED + jejak). Update PROGRESS.md + gap doc (GAP-42 tertutup). Commit + push.
