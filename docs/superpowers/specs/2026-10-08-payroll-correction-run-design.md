# Payroll correction run — desain

**Tanggal:** 8 Oktober 2026
**Gap:** GAP-14 / GAP-21b (lihat [gap-analysis-vs-greatday.md](../../gap-analysis-vs-greatday.md))
**Status:** desain disetujui, menunggu rencana implementasi

---

## Masalahnya

Nominal yang salah pada payslip yang sudah dibayar **tidak punya jalur apa pun**
di sistem ini. `payroll.service.ts:799-805` menolak run bertipe `CORRECTION`
secara eksplisit, dengan alasan yang benar: engine tidak tahu periode mana yang
dikoreksi dan apa yang sudah dibayar.

Dua jalur yang ada tidak menutupi kasus ini:

| Jalur | Untuk apa | Kenapa tidak cukup |
|---|---|---|
| `voidPayrollRun` (`payroll.service.ts:456`) | membatalkan run yang **belum** di-approve | hanya menerima status `COMPLETED`; sesudah `APPROVED`/`DISBURSED` tidak ada jalan |
| `PayrollArrears` | karyawan yang **tidak terbayar** di periode tertutup | `payroll-arrears.service.ts:144` menolak kalau payslip-nya sudah ada, dengan pesannya sendiri: *"a wrong amount is a correction, not arrears"* |

Jadi kodenya sudah menamai celah ini dua kali. Yang kurang adalah jalur ketiga.

## Keputusan yang diambil

| Pertanyaan | Pilihan | Alasan |
|---|---|---|
| Dari mana angka koreksi datang | **Daftar koreksi eksplisit** yang didaftarkan manusia | hitung-ulang-periode akan memunculkan setiap perubahan data referensi sejak periode itu (tarif BPJS, komponen, kebijakan) sebagai "selisih" yang bukan koreksi — itu salah bayar dengan percaya diri |
| Kelebihan bayar | **Potongan, netto tidak boleh negatif** | payslip tidak pernah menagih karyawan, dan bank transfer file tidak pernah menerima nominal negatif |
| Pajak | **Dipajaki di periode pembayaran** | konsisten dengan `PayrollArrears` yang schema-nya menyatakan ini eksplisit; TER/annualized sudah memperhitungkan kumulatif tahun berjalan |
| Izin | **`payroll:correct` baru + alasan wajib** | mendaftarkan koreksi mengubah uang yang sudah dibayar; pantas punya izin sendiri dan alasan yang masuk audit log |

## Arsitektur

Dua pola yang sudah ada di repo ini disalin, bukan ditemukan ulang:

1. **`PayrollArrears`** — daftar item berstatus `PENDING`/`APPLIED`/`CANCELLED`
   yang diterapkan oleh sebuah run, dengan jejak `appliedRunId`/`payslipId`.
2. **`calculateThrPayroll`** (`payroll.service.ts:796`) — run non-reguler yang
   punya perhitungannya sendiri dan tidak menyentuh mesin absensi, lembur,
   pinjaman, atau BPJS.

### 1. Model `PayrollCorrection`

```prisma
model PayrollCorrection {
  id              String   @id @default(uuid()) @db.VarChar(36)
  companyId       String   @map("company_id") @db.VarChar(36)
  employeeId      String   @map("employee_id") @db.VarChar(36)
  /// Payslip yang nominalnya salah. Koreksi melekat pada PEMBAYARAN, bukan pada
  /// periode: dari payslip kita dapat periode, run, dan nominal yang sudah
  /// dibayar sekaligus. (Rapel memakai periode justru karena di sana payslip
  /// tidak ada.)
  sourcePayslipId String   @map("source_payslip_id") @db.VarChar(36)
  /// Positif = kurang bayar, negatif = kelebihan bayar. Nol ditolak DTO.
  amount          Decimal  @db.Decimal(15, 2)
  /// Bagian `amount` yang belum tertutup run mana pun. Awalnya = amount.
  remainingAmount Decimal  @map("remaining_amount") @db.Decimal(15, 2)
  reason          String   @db.Text
  status          PayrollCorrectionStatus @default(PENDING)
  registeredBy    String?  @map("registered_by") @db.VarChar(36)
  appliedRunId    String?  @map("applied_run_id") @db.VarChar(36)
  payslipId       String?  @map("payslip_id") @db.VarChar(36)
  appliedAt       DateTime? @map("applied_at")
  createdAt       DateTime @default(now()) @map("created_at")
  updatedAt       DateTime @updatedAt @map("updated_at")

  company       Company  @relation(fields: [companyId], references: [id], onDelete: Restrict)
  employee      Employee @relation(fields: [employeeId], references: [id], onDelete: Restrict)
  sourcePayslip Payslip  @relation("CorrectionSource", fields: [sourcePayslipId], references: [id], onDelete: Restrict)

  @@index([companyId, status])
  @@index([employeeId])
  @@index([sourcePayslipId])
  @@map("payroll_corrections")
}

enum PayrollCorrectionStatus {
  PENDING
  APPLIED
  CANCELLED
}
```

`PayrollCorrection` harus masuk `COMPANY_SCOPED_MODELS`
(`shared/database/prisma.ts`) — ia punya `companyId`, jadi middleware tenant
wajib menjaganya. Tanpa itu ia jadi satu-satunya model baru di luar jaring
(lihat re-audit allowlist di [tenant-isolation-audit.md](../../tenant-isolation-audit.md)).

### 2. Pendaftaran koreksi

`POST /payroll/corrections` — izin `payroll:correct`, `auditLog({ action: 'CREATE', entity: 'PayrollCorrection' })`.

DTO:

```ts
{
  sourcePayslipId: z.string().uuid(),
  amount: z.number().refine(v => v !== 0, 'amount tidak boleh nol'),
  reason: z.string().trim().min(10),   // alasan sepanjang "typo" tidak menjelaskan apa pun
}
```

`companyId` **tidak** diterima dari klien; diambil dari konteks permintaan
seperti endpoint restore komponen gaji.

Validasi, berurutan:

1. payslip ada, milik perusahaan aktif, dan `status = FINAL`
2. run pemilik payslip berstatus `APPROVED` atau `DISBURSED` — kalau masih
   `COMPLETED`, tolak dengan pesan yang mengarahkan ke `POST /runs/:id/void`.
   Satu masalah tidak boleh punya dua jalur.
3. `assertEmployeeInScope(employeeId, 'payroll')` — sama seperti `arrears.register`
4. tidak ada `PayrollCorrection` lain berstatus `PENDING` untuk payslip itu.
   Koreksi kedua atas payslip yang sama boleh, **setelah** yang pertama `APPLIED`.

`GET /payroll/corrections?status=&employeeId=` (`payroll:read`) dan
`POST /payroll/corrections/:id/cancel` (`payroll:correct`, hanya `PENDING`),
meniru `arrears.list` dan `arrears.cancel`.

### 3. `calculateCorrectionPayroll(runId, database)`

Dipanggil dari `calculatePayroll` sejajar cabang THR:

```ts
if (run.runType === 'THR') return this.calculateThrPayroll(runId, database);
if (run.runType === 'CORRECTION') return this.calculateCorrectionPayroll(runId, database);
if (run.runType !== 'REGULAR') throw new ConflictError(...);   // SEVERANCE tetap ditolak
```

Algoritmanya:

1. Periode run harus berstatus `ACTIVE`. Kalau `CLOSED` → `ConflictError`.
2. Ambil `PayrollCorrection` berstatus `PENDING` milik perusahaan itu. Kosong →
   `ConflictError`; run kosong tidak dibuat.
3. Tolak **seluruh run** kalau ada satu saja koreksi yang
   `sourcePayslip.payrollRun.periodId`-nya sama dengan periode run ini: koreksi
   tidak boleh dibayar di periode yang ia koreksi. Dipilih menolak run alih-alih
   melewati koreksi itu, supaya keadaan ini tidak lewat tanpa ada yang
   memperhatikan — periode yang dikoreksi semestinya sudah lewat.
4. Kelompokkan per karyawan. Untuk setiap karyawan:
   - `earning` = Σ `remainingAmount` yang positif
   - `deduction` = Σ |`remainingAmount`| yang negatif
   - **`applied_deduction = min(deduction, earning)`** — netto tidak pernah negatif
   - **earning selalu dibayar penuh.** Tidak ada alasan menahan kurang bayar;
     yang bisa tertahan hanya potongan. Jadi baris positif selalu langsung
     `APPLIED`, baris negatif bisa `PENDING` sebagian.
   - kalau `earning = 0`: payslip **tidak dibuat**, seluruh koreksi karyawan itu
     tetap `PENDING`, dan karyawan masuk daftar `skipped` yang dikembalikan run
   - kalau `applied_deduction < deduction`: sisanya mengurangi `remainingAmount`
     baris-baris negatif (urut `createdAt`), statusnya tetap `PENDING`
5. Pajak: PPh21 atas `earning` dihitung di periode run ini dengan metode
   `pph21_method` perusahaan (TER atau annualized), lewat jalur yang sama dengan
   rapel.
6. Komponen payslip memakai komponen sistem `CORRECTION_EARNING_AUTO` dan
   `CORRECTION_DEDUCTION_AUTO`, dibuat lewat
   `reviveOrCreateSystemSalaryComponent` — jadi komponen yang pernah dihapus
   dihidupkan, bukan menabrak indeks unik (lihat D-007).
7. Baris koreksi yang tertutup penuh: `status = APPLIED`, `appliedRunId`,
   `payslipId`, `appliedAt` terisi, `remainingAmount = 0`.
8. `updatePayrollRunTotals` + status `COMPLETED`. Approve dan disburse memakai
   jalur maker-checker yang sudah ada, tanpa perubahan.

### 4. Jejak

- Baris koreksi → payslip yang membayarnya (`payslipId`, `appliedRunId`, `appliedAt`)
- Payslip koreksi → payslip asal, lewat `PayrollCorrection.sourcePayslipId`
- Audit log pada pendaftaran dan pembatalan; `reason` tidak pernah kosong
- `notes` payroll run menyebut jumlah koreksi yang diterapkan dan yang dilewati

### 5. Penanganan kesalahan

| Keadaan | Jawaban |
|---|---|
| Payslip masih `DRAFT`, atau run-nya `COMPLETED` | 409 dengan arahan ke `void` |
| Payslip milik tenant lain | 404 (filter `companyId` eksplisit + middleware) |
| Sudah ada koreksi `PENDING` untuk payslip itu | 400 |
| `amount = 0`, atau `reason` < 10 karakter | 400 dari DTO |
| Run `CORRECTION` tanpa koreksi `PENDING` | 409 |
| Periode run `CLOSED`, atau sama dengan periode asal | 409 |
| Karyawan hanya punya koreksi negatif | bukan error: dilewati, dilaporkan, tetap `PENDING` |

### 6. Test

**Unit** (`payroll-correction.service.test.ts`, mock repository):
- agregasi positif + negatif per karyawan
- netto tidak pernah negatif; `applied_deduction = min(deduction, earning)`
- sisa potongan mengurangi `remainingAmount` dan statusnya tetap `PENDING`
- karyawan tanpa earning: tidak ada payslip, masuk daftar `skipped`
- pajak dihitung atas earning koreksi, bukan atas gaji bulanan

**Repository** (`payroll-correction.repository.test.ts`, mock prisma):
- lookup koreksi `PENDING` discoped `companyId`
- `markApplied` menulis keempat kolom jejak

**Real-DB** (`payroll-correction.mysql.test.ts`):
- daftar → run `CORRECTION` → approve → disburse; koreksi jadi `APPLIED`,
  payslip terbit, totals run benar
- koreksi negatif yang melebihi earning: netto 0, sisa tetap `PENDING`

**DTO** (`payroll-correction.dto.test.ts`): `amount ≠ 0`, `reason` wajib.

## Di luar lingkup

- **Pembetulan 1721-A1.** Koreksi dipajaki di periode pembayaran, jadi bukti
  potong tahun berjalan ikut benar dengan sendirinya. Koreksi yang melintasi
  tahun pajak butuh pembetulan formulir — pekerjaan tersendiri.
- **Piutang karyawan** untuk kelebihan bayar yang tidak tertutup satu run.
  Sisanya menunggu run berikutnya; mengubahnya jadi tagihan menyentuh modul
  `employee-loan` dan butuh keputusan soal cicilan.
- **UI frontend.** API dulu.
- **Koreksi otomatis dari hitung-ulang.** Ditolak di tahap desain, dengan
  alasannya di tabel keputusan.
- **`SEVERANCE` run.** Tetap ditolak; pesangon punya jalur exit sendiri.

## Risiko yang diketahui

1. **Koreksi berantai.** Payslip boleh dikoreksi lebih dari sekali (berurutan).
   Kalau koreksi kedua salah arah, tidak ada "pembatalan koreksi" selain
   mendaftarkan koreksi ketiga. Diterima: itu jejak yang benar secara akuntansi,
   bukan penghapusan.
2. **Kelebihan bayar yang tidak pernah tertutup.** Karyawan yang berhenti dan
   masih punya koreksi negatif `PENDING` tidak akan punya earning lagi. Baris itu
   akan menggantung dan terlihat di `GET /payroll/corrections?status=PENDING` —
   penyelesaiannya di luar sistem, dan itu memang keputusan HR.
3. **Pajak periode pembayaran.** Konsisten dengan rapel, tapi artinya koreksi
   besar atas Januari yang dibayar Desember akan menaikkan pajak Desember.
   Itu perilaku yang benar untuk TER dan annualized, dan perlu dijelaskan ke HR
   di dokumentasi endpoint-nya.
