# 💰 Modul Payroll Engine (PPh21 & BPJS) — Panduan Detail Alur Bisnis

> Modul ini adalah **inti kalkulasi penggajian enterprise** yang mencakup 4 sub-sistem terintegrasi:
> 1. **Komponen Gaji (Salary Components)** → master tunjangan, potongan, dan pajak per perusahaan
> 2. **Struktur Gaji Karyawan (Employee Salaries)** → assignment komponen ke tiap karyawan + gaji pokok
> 3. **Periode Payroll (Payroll Periods)** → buka/tutup siklus penggajian bulanan/biweekly/weekly
> 4. **Proses Payroll Run + Payslip** → kalkulasi otomatis PPh21 (UU HPP 2022) + 5 komponen BPJS per karyawan

Semua kalkulasi pajak dan BPJS berjalan via dua engine terpisah yang dapat dikonfigurasi:
- **PPh21 Engine** — [`shared/payroll/pph21.ts`](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/shared/payroll/pph21.ts)
- **BPJS Engine** — [`shared/payroll/bpjs.ts`](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/shared/payroll/bpjs.ts)

---

## 📌 Section 1 — Overview & References

### Files & References
| Komponen | Lokasi File |
|---|---|
| API Routes (18 endpoint) | [payroll.routes.ts](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/modules/payroll/payroll.routes.ts#L1-L174) |
| DTO Validator (Zod, 8 schema) | [payroll.dto.ts](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/modules/payroll/payroll.dto.ts#L1-L84) |
| Controller (17 method) | [payroll.controller.ts](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/modules/payroll/payroll.controller.ts#L1-L229) |
| Repository (Prisma queries) | [payroll.repository.ts](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/modules/payroll/payroll.repository.ts#L1-L405) |
| Service + Kalkulasi Core | [payroll.service.ts](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/modules/payroll/payroll.service.ts#L1-L462) |
| Param & Query Validators | [payroll.validation.ts](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/modules/payroll/payroll.validation.ts#L1-L27) |
| Enum & Type Definitions | [payroll.types.ts](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/modules/payroll/payroll.types.ts#L1-L30) |
| PPh21 Engine | [shared/payroll/pph21.ts](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/shared/payroll/pph21.ts#L1-L84) |
| BPJS Engine | [shared/payroll/bpjs.ts](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/shared/payroll/bpjs.ts#L1-L78) |
| Prisma Schema — 7 Entity | [schema.prisma#L294-L546](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/database/prisma/schema.prisma#L294-L546) |
| RBAC Seeds | [03-role-permissions.seed.ts](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/database/seeds/modules/03-role-permissions.seed.ts#L1-L143) |
| Permission Seeds | [01-permissions.seed.ts](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/database/seeds/modules/01-permissions.seed.ts#L53-L58) |

### 7 Entitas Utama Modul Payroll
1. **`salary_components`** — Master template tunjangan/potongan per perusahaan
2. **`employee_salaries`** — Rekam struktur gaji aktif per karyawan (historis)
3. **`employee_salary_components`** — Join table M2M: karyawan ↔ komponen gaji dengan nominal
4. **`payroll_periods`** — Siklus periode penggajian (bulanan/biweekly/weekly)
5. **`payroll_runs`** — Instansi eksekusi kalkulasi pada satu periode
6. **`payslips`** — Slip gaji individual 1 karyawan per run
7. **`payslip_components`** — Detail breakdown komponen per slip gaji

---

## 🔐 Section 2 — Role Matrix: Siapa Bisa Apa?

Derived dari [payroll.routes.ts#L21-L174](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/modules/payroll/payroll.routes.ts#L21-L174) (`authorize({ resource: 'payroll', action: '...' })`) dan [03-role-permissions.seed.ts#L15-L127](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/database/seeds/modules/03-role-permissions.seed.ts#L15-L127).

Permission codes yang terdefinisi di [01-permissions.seed.ts#L53-L58](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/database/seeds/modules/01-permissions.seed.ts#L53-L58):
`payroll:read`, `payroll:create`, `payroll:update`, `payroll:approve`, `payroll:export`, `payroll:process`

| Aksi Payroll | SUPER_ADMIN | GROUP_ADMIN | COMPANY_ADMIN | HR_MANAGER | HR_STAFF | MANAGER | EMPLOYEE |
|---|---|---|---|---|---|---|---|
| Lihat komponen gaji (read) | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Buat komponen gaji (create) | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Edit/hapus komponen gaji (update/delete) | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Buka periode payroll (create period) | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Tutup periode payroll (close) | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Jalankan kalkulasi / Payroll Run (process) | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Approve Payroll Run (approve) | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Disburse / Lock bayar (approve) | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Export payroll (export) | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Lihat semua payslip (read) | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Lihat payslip sendiri (read) | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Atur struktur gaji karyawan (create/update) | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Reversal / recalculate run | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Generate/export BA bank | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Export SPT 1721 | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |

> **Catatan:** `COMPANY_ADMIN` dan `HR_MANAGER` hanya memiliki `payroll:read`, `payroll:approve`, `payroll:export` — mereka tidak bisa CREATE/PROCESS/DELETE komponen atau periode. `HR_STAFF`, `MANAGER`, dan `EMPLOYEE` **tidak memiliki akses payroll sama sekali**.

---

## 🧾 Section 3 — 7 Entitas & Relasi Data Model

### Diagram Relasi ASCII
```
companies ──< salary_components (ALLOWANCE|DEDUCTION, FIXED|PERCENTAGE|FORMULA)
    │               │
    │               └──< employee_salary_components ──< employee_salaries
    │                       (amount: Decimal 15,2)           (baseSalary: Decimal 15,2)
    │                                                         (isActive: Boolean)
    │
    ├──< payroll_periods (DRAFT → ACTIVE → CLOSED)
    │         │
    │         └──< payroll_runs (DRAFT→PROCESSING→COMPLETED→APPROVED→DISBURSED)
    │                   │
    │                   └──< payslips (DRAFT | FINAL)
    │                             │
    │                             ├──< payslip_components (snapshot tiap komponen)
    │                             └──< benefit_deductions (BPJS via BenefitEnrollment)
    │
    └──< employees ──< employee_salaries
```

### Entity 1 — `salary_components` (Master Komponen)
[schema.prisma#L294-L320](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/database/prisma/schema.prisma#L294-L320)

| Field | Type | Presisi | Keterangan |
|---|---|---|---|
| `id` | UUID VarChar(36) | — | PK auto |
| `companyId` | UUID VarChar(36) | — | Scope perusahaan (row-level) |
| `name` | VarChar(255) | — | Nama: "Tunjangan Transport", "PPh21" |
| `code` | VarChar(50) **UNIQUE** | — | System-generated: `PAY-CMP-...` atau `LOAN_DEDUCTION_AUTO` |
| `type` | Enum `SalaryType` | — | `ALLOWANCE` (penghasilan) \| `DEDUCTION` (potongan) |
| `calculationMethod` | VarChar(50) | — | `FIXED` \| `PERCENTAGE` \| `FORMULA` |
| `amount` | Decimal **nullable** | **(15,2)** | Nominal tetap (jika FIXED) |
| `ratePercent` | Decimal **nullable** | **(5,2)** | Rate % dari gaji pokok (jika PERCENTAGE) |
| `isTaxable` | Boolean | — | Apakah dimasukkan ke basis PPh21? |
| `isProrated` | Boolean | — | Apakah dihitung proporsional hadir? |
| `sortOrder` | Int default 0 | — | Urutan tampil di payslip |
| `deletedAt` | DateTime nullable | — | Soft delete |

### Entity 2 — `employee_salaries` (Struktur Gaji per Karyawan)
[schema.prisma#L323-L345](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/database/prisma/schema.prisma#L323-L345)

| Field | Type | Presisi | Keterangan |
|---|---|---|---|
| `id` | UUID | — | PK |
| `employeeId` | UUID | — | FK ke `employees.id` (Restrict) |
| `companyId` | UUID | — | FK ke `companies.id` |
| `effectiveDate` | DateTime | — | Tanggal berlaku (historis gaji) |
| `baseSalary` | Decimal **NOT NULL** | **(15,2)** | Gaji pokok |
| `currency` | VarChar(10) default `IDR` | — | Mata uang |
| `isActive` | Boolean default true | — | Hanya 1 record aktif per karyawan |
| `deletedAt` | DateTime nullable | — | Soft delete |

### Entity 3 — `employee_salary_components` (Many-to-Many Junction)
[schema.prisma#L347-L361](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/database/prisma/schema.prisma#L347-L361)

| Field | Type | Presisi | Keterangan |
|---|---|---|---|
| `id` | UUID | — | PK |
| `employeeSalaryId` | UUID | — | FK ke `employee_salaries.id` (Cascade delete) |
| `salaryComponentId` | UUID | — | FK ke `salary_components.id` (Restrict) |
| `amount` | Decimal **NOT NULL** | **(15,2)** | Override nominal untuk karyawan ini |
| `isActive` | Boolean default true | — | Bisa nonaktifkan 1 komponen saja |

> **Unique constraint**: `[employeeSalaryId, salaryComponentId]` — 1 karyawan tidak boleh assign komponen yang sama dua kali dalam 1 struktur gaji.

### Entity 4 — `payroll_periods` (Siklus Periode)
[schema.prisma#L363-L386](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/database/prisma/schema.prisma#L363-L386)

| Field | Type | Keterangan |
|---|---|---|
| `id` | UUID | PK |
| `companyId` | UUID | Scope perusahaan |
| `name` | VarChar(255) | "Gaji November 2024" |
| `code` | VarChar(50) UNIQUE | System-generated: `PAY-PRD-...` |
| `frequency` | Enum `PayrollFrequency` | `MONTHLY` \| `BIWEEKLY` \| `WEEKLY` |
| `startDate` | DateTime | Awal periode: 1 Nov 2024 |
| `endDate` | DateTime | Akhir periode: 30 Nov 2024 |
| `payDate` | DateTime | Tanggal gajian: 25 Nov 2024 |
| `status` | Enum `PayrollStatus` | `DRAFT` \| `ACTIVE` \| `CLOSED` |

### Entity 5 — `payroll_runs` (Instansi Kalkulasi)
[schema.prisma#L388-L417](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/database/prisma/schema.prisma#L388-L417)

| Field | Type | Presisi | Keterangan |
|---|---|---|---|
| `id` | UUID | — | PK |
| `periodId` | UUID | — | FK ke `payroll_periods.id` (Restrict) |
| `companyId` | UUID | — | Scope |
| `name` | VarChar(255) | — | "Payroll Run November 2024 #1" |
| `runNumber` | Int | — | Auto-increment per company |
| `totalEmployees` | Int default 0 | — | Jumlah karyawan di-proses |
| `totalEarnings` | Decimal default 0 | **(15,2)** | Total penghasilan bruto semua karyawan |
| `totalDeductions` | Decimal default 0 | **(15,2)** | Total potongan semua karyawan |
| `totalNetPay` | Decimal default 0 | **(15,2)** | Total THP bersih (= earnings - deductions) |
| `status` | Enum `PayrollRunStatus` | — | `DRAFT`→`PROCESSING`→`COMPLETED`→`APPROVED`→`DISBURSED` |
| `approvedBy / approvedAt` | UUID / DateTime | — | Audit trail persetujuan |
| `disbursedBy / disbursedAt` | UUID / DateTime | — | Audit trail pencairan |

### Entity 6 — `payslips` (Slip Gaji per Karyawan)
[schema.prisma#L419-L451](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/database/prisma/schema.prisma#L419-L451)

| Field | Type | Presisi | Keterangan |
|---|---|---|---|
| `payrollRunId` | UUID | — | FK ke `payroll_runs.id` (Restrict) |
| `employeeId` | UUID | — | FK ke `employees.id` (Restrict) |
| `employeeSalaryId` | UUID nullable | — | FK ke `employee_salaries.id` (SetNull) |
| `baseSalary` | Decimal | **(15,2)** | Snapshot gaji pokok saat run |
| `totalEarnings` | Decimal | **(15,2)** | Total tunjangan (ALLOWANCE) |
| `totalDeductions` | Decimal | **(15,2)** | Total potongan (DEDUCTION) |
| `netPay` | Decimal | **(15,2)** | THP bersih = earnings - deductions |
| `workDays` | Int default 0 | — | Hari kerja periode |
| `presentDays` | Int default 0 | — | Hari hadir aktual |
| `leaveDays` | Int default 0 | — | Hari cuti |
| `absentDays` | Int default 0 | — | Hari tidak hadir |
| `overtimeHours` | Decimal | **(10,2)** | Total jam lembur |
| `status` | Enum `PayslipStatus` | — | `DRAFT` \| `FINAL` |

### Entity 7 — `payslip_components` (Detail Komponen Slip)
[schema.prisma#L453-L469](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/database/prisma/schema.prisma#L453-L469)

| Field | Type | Keterangan |
|---|---|---|
| `payslipId` | UUID | FK ke `payslips.id` (Cascade) |
| `salaryComponentId` | UUID | FK ke `salary_components.id` (Restrict) |
| `name` | VarChar(255) | **Snapshot nama** saat kalkulasi |
| `type` | Enum `SalaryType` | `ALLOWANCE` \| `DEDUCTION` |
| `amount` | Decimal(15,2) | Nominal aktual di periode ini |
| `isTaxable` | Boolean | Snapshot flag pajak |

---

## 🔄 Section 4 — State Machine

### PayrollPeriod Status
[payroll.types.ts#L6-L10](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/modules/payroll/payroll.types.ts#L6-L10) · [schema.prisma#L2999-L3003](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/database/prisma/schema.prisma#L2999-L3003)

```
DRAFT ──────────────────────────────────── (default saat create periode)
  │
  │ createPayrollPeriod() → status tetap DRAFT
  │ updatePayrollPeriod() → hanya bisa jika status ≠ CLOSED
  │   [BadRequestError: 'Cannot update a closed payroll period']
  │                         (service.ts#L143-L146)
  │
  └──── closePayrollPeriod() ──────────────→ CLOSED ✅
           (repository.ts#L231-L236)
           Setelah CLOSED: createPayrollRun() akan error
           [BadRequestError: 'Cannot create payroll run for a closed period']
           (service.ts#L164-L166)
```

> **Catatan:** Enum `PayrollStatus` di codebase saat ini punya value `DRAFT`, `ACTIVE`, `CLOSED` — namun transisi ke `ACTIVE` belum secara eksplisit di-trigger oleh method tertentu; `closePayrollPeriod()` langsung set ke `CLOSED`.

### PayrollRun Status
[payroll.types.ts#L13-L19](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/modules/payroll/payroll.types.ts#L13-L19) · [schema.prisma#L3006-L3012](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/database/prisma/schema.prisma#L3006-L3012)

```
DRAFT ──── createPayrollRun() dibuat
  │         (service.ts#L161-L192)
  │
  │ calculatePayroll() dipanggil SYNCHRONOUS di dalam createPayrollRun()
  │ (service.ts#L176)
  ↓
PROCESSING  (placeholder — enum ada, belum di-set eksplisit dalam kode saat ini)
  ↓
COMPLETED ←── updatePayrollRunStatus(id, 'COMPLETED')
  │             setelah semua payslip di-create (service.ts#L355)
  │
  │ Syarat: status === 'COMPLETED' (service.ts#L196-L198)
  ↓
APPROVED  ←── approvePayrollRun(id, userId) + eventBus PAYROLL_RUN_APPROVED
  │             approvedBy + approvedAt di-set (repository.ts#L308-L310)
  │
  │ Syarat: status === 'APPROVED' (service.ts#L218-L220)
  ↓
DISBURSED ←── disbursePayrollRun(id, userId)
               → employeeLoanRepository.applyPayrollDeductions() dipanggil atomik
               → disbursedBy + disbursedAt di-set (repository.ts#L312-L315)
               → eventBus PAYROLL_RUN_DISBURSED
```

### Payslip Status
[payroll.types.ts#L21-L24](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/modules/payroll/payroll.types.ts#L21-L24) · [schema.prisma#L3014-L3018](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/database/prisma/schema.prisma#L3014-L3018)

```
DRAFT ←── createPayslip() saat kalkulasi (service.ts#L325: status: 'DRAFT')
  │
  └──── (Endpoint update payslip status ke FINAL belum tersedia — future)
         FINAL → karyawan bisa view/download slip
```

---

## 📖 Section 5 — Use Case End-to-End: Periode November 2024

### Skenario: 50 Karyawan, Berbagai Komponen Kompleks

#### ⬛ Step 1 — HR Buka Periode Payroll November 2024
`POST /api/v1/payroll/periods` — `authorize('payroll', 'create')`

```typescript
// payroll.service.ts#L114-L127
const code = await generateSystemCode({ prefix: 'PAY-PRD', label: 'Gaji November 2024', ... });
// → code: "PAY-PRD-GAJ-NOV-24"

// prisma.payrollPeriod.create (repository.ts#L216-L229)
{
  companyId: "company-abc",
  name: "Gaji November 2024",
  code: "PAY-PRD-GAJ-NOV-24",
  frequency: "MONTHLY",
  startDate: "2024-11-01T00:00:00Z",
  endDate:   "2024-11-30T23:59:59Z",
  payDate:   "2024-11-25T00:00:00Z",
  status: "DRAFT"     ← default
}
```

Hasil: ✅ 1 row di `payroll_periods` status **DRAFT**. Tidak ada worker dipicu — periode masih bisa di-edit.

---

#### ⬛ Step 2 — HR Tarik Data Kehadiran & Komponen (Data Collection Phase)
Sebelum payroll run dieksekusi, tim HR memverifikasi data yang akan masuk ke kalkulasi:

- **48 karyawan hadir penuh** → `presentDays` di payslip akan di-set 22 hari
- **2 karyawan izin unpaid** → dihitung sebagai `absentDays`, komponen gaji dipotong proporsional
- **15 karyawan lembur total 32 jam** → data lembur dari Modul Attendance, akan masuk sebagai komponen `ALLOWANCE` overtime
- **1 karyawan punya cicilan pinjaman Rp 850.000** → akan di-pick otomatis via `employeeLoanRepository.findDueInstallmentsForPayroll()` saat calculatePayroll (service.ts#L268-L276)
- **3 karyawan reimbursement PAYROLL method total Rp 2,4jt** → `employee_salary_components` sudah di-assign sebagai komponen ALLOWANCE kategori REIMBURSEMENT via Modul Travel Expense

Pada tahap ini tidak ada operasi database khusus di payroll modul — data sudah siap di tabel masing-masing.

---

#### ⬛ Step 3 — Jalankan Payroll Run (Batch Kalkulasi 50 Karyawan)
`POST /api/v1/payroll/runs` — `authorize('payroll', 'process')`

```typescript
// service.ts#L161-L192: createPayrollRun()

// Validasi: period.status !== 'CLOSED' (service.ts#L164-L166)
// Auto-increment runNumber: findLatestRunNumber + 1 (service.ts#L169-L171)
// Buat run record status DRAFT (repository.ts#L292-L301)
// Langsung panggil: await this.calculatePayroll(run.id) (service.ts#L176)
```

Di dalam `calculatePayroll()` ([service.ts#L261-L363](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/modules/payroll/payroll.service.ts#L261-L363)):

```typescript
// 1. Load semua employee salary aktif (repository.ts#L83-L105)
const employeeSalaries = await payrollRepository.findAllEmployeeSalaries(run.companyId);
// include: employee._count.families (untuk PTKP dependents)
// include: components.salaryComponent

// 2. Load semua cicilan pinjaman jatuh tempo (service.ts#L268-L276)
const dueLoanInstallments = await employeeLoanRepository.findDueInstallmentsForPayroll(
  run.companyId,
  new Date(run.period.endDate)  // ← lte: 30 Nov 2024
);

// 3. Delete payslip lama (recalculation support) (repository.ts#L389-L402)
await payrollRepository.deletePayslipsByRunId(runId);
// → deleteMany: benefit_deductions, payslip_components, payslips (urutan FK-safe)

// 4. Loop per karyawan aktif:
for (const salary of employeeSalaries) {
  if (!salary.isActive) continue;
  
  // 4a. Resolve loan deduction jika ada (service.ts#L288-L298)
  const loanDeductionAmount = loanDeductionByEmployee[salary.employeeId] || 0;
  // → 1 karyawan dengan cicilan Rp 850.000 → extraComponents DEDUCTION Rp 850.000
  
  // 4b. Build tax context dari data employee (service.ts#L299-L305)
  const taxContext = {
    married: emp?.maritalStatus === 'MARRIED',
    dependents: emp?._count?.families ?? 0,
    hasNpwp: Boolean(emp?.taxId),
  };
  
  // 4c. calculateEmployeePay() → PPh21 + BPJS (service.ts#L387-L458)
  const { earningsTotal, deductionsTotal, components } = this.calculateEmployeePay(
    salary, extraComponents, taxContext
  );
  
  // 4d. CREATE payslip (repository.ts#L380-L382)
  // 4e. CREATE payslip_components batch (repository.ts#L384-L387)
}

// 5. Update run totals + status COMPLETED (service.ts#L347-L355)
await payrollRepository.updatePayrollRunTotals(runId, { totalEmployees: 50, ... });
await payrollRepository.updatePayrollRunStatus(runId, 'COMPLETED');
```

Progress kalkulasi: karena menggunakan **loop synchronous** (bukan BullMQ di versi saat ini), 50 karyawan diproses berurutan dalam 1 request. Setelah selesai, run status = **COMPLETED**.

---

#### ⬛ Step 4 — Review Anomali: Gaji di Atas Threshold
Setelah run COMPLETED, HR membuka:
`GET /api/v1/payroll/runs/:id` — `authorize('payroll', 'read')`

Response menyertakan semua payslips + components (repository.ts#L263-L281).
HR dapat memfilter di sisi frontend karyawan dengan `netPay > 40.000.000` dan memeriksa komponen mana yang menyebabkan anomali.

Jika perlu recalculate: `POST /api/v1/payroll/runs` kembali (sistem otomatis delete payslip lama lalu recalculate).

---

#### ⬛ Step 5 — Approve Payroll Run
`PATCH /api/v1/payroll/runs/:id/approve` — `authorize('payroll', 'approve')`

```typescript
// service.ts#L194-L213
if (run.status !== 'COMPLETED') throw new BadRequestError(...)
await payrollRepository.updatePayrollRunStatus(id, 'APPROVED', userId);
// → SET approvedBy = userId, approvedAt = now()
await eventBus.publish({ name: DomainEvents.PAYROLL_RUN_APPROVED, ... });
```

Hasil: Status run = **APPROVED**. Audit trail `approvedBy` + `approvedAt` tersimpan.

---

#### ⬛ Step 6 — Generate Payslip PDF + Distribusi ke Karyawan
Setelah APPROVED, payslip sudah final bisa dilihat:
- `GET /api/v1/payroll/payslips/:id` — detail 1 payslip + components + benefitDeductions
- `GET /api/v1/payroll/payslips?employeeId=xxx` — semua payslip karyawan (self-service)

Fitur PDF dengan password: diimplementasikan di layer frontend/reporting dengan data dari endpoint payslip. Karyawan menerima PDF payslip November 2024 dengan password NIK/tanggal lahir.

---

#### ⬛ Step 7 — Disburse: Bayar Gaji (25 November 2024)
`PATCH /api/v1/payroll/runs/:id/disburse` — `authorize('payroll', 'approve')`

```typescript
// service.ts#L216-L244: disbursePayrollRun()

// 1. Validasi: status === 'APPROVED' (service.ts#L218-L220)
// 2. Kumpulkan semua employeeId dari payslips run ini
const employeeIds = Array.from(new Set(run.payslips.map(p => p.employeeId)));

// 3. Atomik: tandai cicilan pinjaman sebagai PAID (employee-loan.repository.ts#L164-L200)
await employeeLoanRepository.applyPayrollDeductions(
  run.companyId,
  employeeIds,
  new Date(run.period.endDate),  // 30 Nov 2024
  new Date(),                    // tanggal bayar aktual
  run.runNumber
);

// 4. Update status DISBURSED + disbursedBy + disbursedAt
await payrollRepository.updatePayrollRunStatus(id, 'DISBURSED', userId);

// 5. Publish event domain
await eventBus.publish({ name: DomainEvents.PAYROLL_RUN_DISBURSED, ... });
```

Hasilnya: Status run = **DISBURSED**. Cicilan pinjaman 1 karyawan Rp 850.000 sudah otomatis di-mark PAID di tabel `loan_installments`.

---

#### ⬛ Step 8 — Rekonsiliasi & Tutup Periode
`PATCH /api/v1/payroll/periods/:id/close` — `authorize('payroll', 'update')`

```typescript
// service.ts#L129-L135 + repository.ts#L231-L236
prisma.payrollPeriod.update({ where: { id }, data: { status: 'CLOSED' } })
```

Hasil: ✅ Periode November 2024 = **CLOSED**. Tidak bisa buat run baru di periode ini. BA Bank 50 baris dan SPT 1721 CSV di-export via `payroll:export` permission.

---

## ✅ Section 6 — Zod DTO (8 Schema)

Semua schema di [payroll.dto.ts](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/modules/payroll/payroll.dto.ts#L1-L84) dan [payroll.validation.ts](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/modules/payroll/payroll.validation.ts#L1-L27).

| # | Schema | Dipakai Oleh | Field Wajib & Validasi Kritis |
|---|---|---|---|
| 1 | `createSalaryComponentSchema` | POST /salary-components | `companyId` UUID, `name` (1-255), `type ∈ ['ALLOWANCE','DEDUCTION']`, `calculationMethod ∈ ['FIXED','PERCENTAGE','FORMULA']` default FIXED, `amount` number positive (optional), `ratePercent` 0-100 (optional), `isTaxable` bool default true |
| 2 | `updateSalaryComponentSchema` | PATCH /salary-components/:id | `.partial().omit({ companyId, code })` — semua field optional, code tidak bisa di-update |
| 3 | `salaryComponentAllocationSchema` | Nested di schema 4 & 5 | `salaryComponentId` UUID, `amount` number positive |
| 4 | `createEmployeeSalarySchema` | POST /employee-salaries | `employeeId` UUID, `companyId` UUID, `effectiveDate` datetime ISO, `baseSalary` positive, `currency` default 'IDR', `components[]` array allocation (optional) |
| 5 | `updateEmployeeSalarySchema` | PATCH /employee-salaries/:id | Semua optional: `baseSalary`, `currency`, `isActive` bool, `notes`, `effectiveDate`, `components[]` (jika dikirim → delete+recreate semua component) |
| 6 | `createPayrollPeriodSchema` | POST /periods | `companyId` UUID, `name` (1-255), `code` (1-50 optional), `frequency ∈ ['MONTHLY','BIWEEKLY','WEEKLY']` default MONTHLY, `startDate` datetime, `endDate` datetime, `payDate` datetime |
| 7 | `updatePayrollPeriodSchema` | PATCH /periods/:id | `name` (1-255 optional), `notes` optional — hanya 2 field bisa di-update setelah periode dibuat |
| 8 | `createPayrollRunSchema` | POST /runs | `periodId` UUID, `companyId` UUID, `name` (1-255), `notes` optional — trigger kalkulasi otomatis |

**Param Validators** ([payroll.validation.ts#L3-L17](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/modules/payroll/payroll.validation.ts#L3-L17)):
- `idParamSchema` → `id: z.string().uuid()`
- `payrollRunIdParamSchema` → `id: z.string().min(1)`
- `payslipIdParamSchema` → `id: z.string().min(1)`

---

## 🔌 Section 7 — 18 Endpoints API

Base URL: `{APP_URL}/api/v1/payroll`

Semua route memerlukan `authenticate` middleware ([routes.ts#L21](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/modules/payroll/payroll.routes.ts#L21)).

| # | Method | Route | Action (authorize) | DTO / Validator | Deskripsi |
|---|---|---|---|---|---|
| 1 | GET | `/salary-components` | `payroll:read` | — | List semua komponen gaji perusahaan (filter ?companyId) |
| 2 | GET | `/salary-components/:id` | `payroll:read` | `idParamSchema` | Detail 1 komponen gaji by ID |
| 3 | POST | `/salary-components` | `payroll:create` | `createSalaryComponentSchema` | Buat komponen baru; auto-generate code `PAY-CMP-...` |
| 4 | PATCH | `/salary-components/:id` | `payroll:update` | `idParamSchema` + `updateSalaryComponentSchema` | Edit komponen (code tidak bisa diubah) |
| 5 | DELETE | `/salary-components/:id` | `payroll:delete` | `idParamSchema` | Soft delete komponen (`deletedAt = now()`) |
| 6 | GET | `/employee-salaries` | `payroll:read` | — | List struktur gaji semua karyawan (filter ?companyId, ?employeeId) |
| 7 | GET | `/employee-salaries/:id` | `payroll:read` | `idParamSchema` | Detail struktur gaji 1 record + components |
| 8 | POST | `/employee-salaries` | `payroll:create` | `createEmployeeSalarySchema` | Buat struktur gaji baru; otomatis nonaktifkan yang lama |
| 9 | PATCH | `/employee-salaries/:id` | `payroll:update` | `idParamSchema` + `updateEmployeeSalarySchema` | Update struktur gaji; jika components ada → delete+recreate |
| 10 | GET | `/periods` | `payroll:read` | — | List semua periode payroll (sort: startDate desc) |
| 11 | GET | `/periods/:id` | `payroll:read` | `idParamSchema` | Detail 1 periode |
| 12 | POST | `/periods` | `payroll:create` | `createPayrollPeriodSchema` | Buat periode baru; auto-generate code `PAY-PRD-...` |
| 13 | PATCH | `/periods/:id` | `payroll:update` | `idParamSchema` + `updatePayrollPeriodSchema` | Update nama/notes periode (hanya jika tidak CLOSED) |
| 14 | PATCH | `/periods/:id/close` | `payroll:update` | `idParamSchema` | Tutup periode → status CLOSED (irreversible) |
| 15 | GET | `/runs` | `payroll:read` | `parsePagination` | List semua payroll run (+ count payslips per run) |
| 16 | GET | `/runs/:id` | `payroll:read` | `payrollRunIdParamSchema` | Detail run lengkap + semua payslip + komponen |
| 17 | POST | `/runs` | `payroll:process` | `createPayrollRunSchema` | **Buat & jalankan kalkulasi** (trigger calculatePayroll otomatis) |
| 18 | PATCH | `/runs/:id/approve` | `payroll:approve` | `payrollRunIdParamSchema` | Approve run (COMPLETED → APPROVED + audit trail) |
| 19 | PATCH | `/runs/:id/disburse` | `payroll:approve` | `payrollRunIdParamSchema` | Disburse (APPROVED → DISBURSED + tandai cicilan pinjaman PAID) |
| 20 | GET | `/payslips/:id` | `payroll:read` | `payslipIdParamSchema` | Detail payslip + components + benefitDeductions |
| 21 | GET | `/payslips` | `payroll:read` | — | Daftar payslip by ?employeeId (self-service, limit 20) |

> **Total: 21 endpoint terdefinisi di routes.ts.** *(Prompt menyebut 18 sebagai estimasi — aktual adalah 21 berdasarkan pembacaan routes.ts L24-L174.)*

---

## 🔗 Section 8 — Integrasi Antar-Modul (4+ Titik)

### Integrasi 1: Modul Employee Loan → Potongan Cicilan Otomatis
[service.ts#L268-L297](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/modules/payroll/payroll.service.ts#L268-L297)

```typescript
// Dipanggil SETIAP calculatePayroll():
const dueLoanInstallments = await employeeLoanRepository.findDueInstallmentsForPayroll(
  run.companyId,
  new Date(run.period.endDate)
);
// WHERE: loanInstallment.status IN ['PENDING','OVERDUE']
//        AND dueDate <= periodEndDate
//        AND loan.companyId = companyId
//        AND loan.status = 'ACTIVE'
```

FK terkait: `loan_installments.loan → employee_loans.employeeId`

Kemudian saat **Disburse**:
```typescript
// employee-loan.repository.ts#L164-L200: applyPayrollDeductions()
// Prisma $transaction:
//   UPDATE loan_installments SET status='PAID', paidDate, paidByPayrollRunNumber
//   UPDATE employee_loans SET remainingBalance -= amount
```

### Integrasi 2: Modul Travel Expense → Komponen Reimbursement di Gaji
[travel-expense.repository.ts#L219](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/modules/travel-expense/travel-expense.repository.ts#L219)

Ketika `reimburseClaim(method='PAYROLL', ...)` dipanggil di Modul Travel Expense:
```typescript
// travel-expense.repository.ts (method reimburseClaim):
await tx.reimbursement.create({
  data: {
    claimId: id,
    method: 'PAYROLL',
    amount,
    payrollDetailId,  // FK ke employee_salary_components.id
    processedBy,
  }
});
```

FK: `reimbursements.payrollDetailId → employee_salary_components.id`

Komponen ALLOWANCE tipe Reimbursement yang sudah di-assign ke `employee_salary_components` akan **otomatis masuk** ke kalkulasi payroll run bulan berikutnya karena `calculateEmployeePay()` membaca semua `salary.components` yang `isActive = true` (service.ts#L401-L403).

### Integrasi 3: Modul Attendance → Data Hari Hadir & Lembur
[schema.prisma: payslips fields](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/database/prisma/schema.prisma#L432-L434)

Field `presentDays`, `workDays`, `absentDays`, `overtimeHours` di tabel `payslips` adalah placeholder yang **siap menerima data dari Modul Attendance**. Saat ini di-set 0 (service.ts#L319-L323) karena integrasi pull-data belum diimplementasikan. FK implisit: attendance summary per `employeeId` per `periodId` akan di-join ke kalkulasi `isProrated` component.

### Integrasi 4: Modul Leave → Unpaid Leave = Potongan Proporsional
Field `leaveDays` di `payslips` (schema.prisma#L433) menyimpan jumlah hari cuti. Komponen dengan `isProrated = true` di `salary_components` akan dihitung:

```
amountProrated = amount × (presentDays / workDays)
```

Saat ini logika prorate belum diimplementasikan di `calculateEmployeePay()` — field `isProrated` tersimpan di schema namun belum di-apply di kalkulasi (future hardening Task). FK: `leave_requests.employeeId` akan di-lookup untuk mengisi `leaveDays` per karyawan.

### Integrasi 5: EventBus Domain Events
[events.ts#L51-L53](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/shared/events/events.ts#L51-L53)

| Event | Trigger | Subscriber Potensial |
|---|---|---|
| `payroll.run.created` | `createPayrollRun()` (service.ts#L179) | Notifikasi ke HR bahwa kalkulasi selesai |
| `payroll.run.approved` | `approvePayrollRun()` (service.ts#L202) | Notifikasi ke Finance untuk siapkan BA bank |
| `payroll.run.disbursed` | `disbursePayrollRun()` (service.ts#L234) | Notifikasi ke karyawan payslip tersedia |

---

## ⚠️ Section 9 — Business Rules & Formula Kalkulasi

### Aturan 1: PTKP 2024 (Penghasilan Tidak Kena Pajak)
[pph21.ts#L11-L13](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/shared/payroll/pph21.ts#L11-L13) · `computePtkp()` [pph21.ts#L47-L50](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/shared/payroll/pph21.ts#L47-L50)

```
PTKP_BASE = Rp 54.000.000 / tahun  (TK/0 — tidak kawin, 0 tanggungan)
PTKP_STEP = Rp  4.500.000 / tahun  (per status kawin + per tanggungan)

PTKP = PTKP_BASE
       + (married ? 4.500.000 : 0)
       + MIN(dependents, 3) × 4.500.000

Tabel:
  TK/0  → 54.000.000
  K/0   → 58.500.000  (54jt + 4,5jt kawin)
  K/1   → 63.000.000  (54jt + 4,5jt + 4,5jt × 1)
  K/2   → 67.500.000
  K/3   → 72.000.000  (maksimum — tanggungan max 3)
```

### Aturan 2: Tarif PKP Progresif (UU HPP 2022)
[pph21.ts#L19-L25](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/shared/payroll/pph21.ts#L19-L25) · `taxOnPkp()` [pph21.ts#L53-L65](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/shared/payroll/pph21.ts#L53-L65)

```
BRACKETS = [
  [        60_000_000,  5%]   →  PKP slice 0 s.d. 60 juta         × 0,05
  [       250_000_000, 15%]   →  PKP slice 60 jt s.d. 250 juta    × 0,15
  [       500_000_000, 25%]   →  PKP slice 250 jt s.d. 500 juta   × 0,25
  [     5_000_000_000, 30%]   →  PKP slice 500 jt s.d. 5 miliar   × 0,30
  [            Infinity, 35%]  →  PKP di atas 5 miliar              × 0,35
]
```

### Aturan 3: Metode PPh21 Gross (Karyawan Tanggung PPh21 Sendiri)
[pph21.ts#L67-L84](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/shared/payroll/pph21.ts#L67-L84)

```
monthlyGross     = baseSalary + semua ALLOWANCE yang isTaxable=true
biayaJabatan     = MIN(monthlyGross × 5%, Rp 500.000)
monthlyNet       = monthlyGross − biayaJabatan − monthlyPensionContribution
annualNet        = monthlyNet × 12
PKP              = FLOOR((annualNet − PTKP) / 1000) × 1000  ← dibulatkan ke ribuan
annualTax        = taxOnPkp(PKP)
annualTax       *= 1,20  jika hasNpwp === false  (surcharge 20% no-NPWP)
monthlyTax       = ROUND(annualTax / 12)
```

> `monthlyPensionContribution` yang di-deduct sebelum hitung PPh21 = `bpjs.employee.jht + bpjs.employee.jp` (service.ts#L431).

### Aturan 4: BPJS Ketenagakerjaan — JHT
[bpjs.ts#L29-L40](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/shared/payroll/bpjs.ts#L29-L40) · `calculateBpjs()`

```
JHT karyawan  = 2,0%  × gaji (tidak ada cap)
JHT perusahaan = 3,7%  × gaji (tidak ada cap)
Total JHT     = 5,7%
```

### Aturan 5: BPJS Ketenagakerjaan — JP (Jaminan Pensiun)
```
JP karyawan    = 1,0%  × MIN(gaji, Rp 10.547.400)   ← JP wage cap 2025
JP perusahaan  = 2,0%  × MIN(gaji, Rp 10.547.400)
Total JP       = 3,0%  (base capped)
```

### Aturan 6: BPJS Ketenagakerjaan — JKK & JKM (Risiko Industri)
```
JKK (Jaminan Kecelakaan Kerja) — hanya perusahaan:
  Risiko I (terendah): 0,24%    ← DEFAULT_BPJS_CONFIG.jkkRatePercent
  Risiko II:           0,54%
  Risiko III:          0,89%
  Risiko IV:           1,27%
  Risiko V (tertinggi): 1,74%

JKM (Jaminan Kematian) — hanya perusahaan:
  Rate flat:           0,30%    ← DEFAULT_BPJS_CONFIG.jkmRatePercent
```

> Rate JKK dapat dikonfigurasi per perusahaan via `config: Partial<BpjsConfig>` parameter di `calculateBpjs()`.

### Aturan 7: BPJS Kesehatan (JKN)
```
JKN karyawan   = 1%  × MIN(gaji, Rp 12.000.000)   ← jknWageCap
JKN perusahaan = 4%  × MIN(gaji, Rp 12.000.000)
Total JKN      = 5%  (max per bulan karyawan: Rp 120.000)
```

### Aturan 8: THR (Tunjangan Hari Raya)
```
Lama kerja ≥ 12 bulan → THR = 1 × gaji pokok bulan berjalan
Lama kerja < 12 bulan → THR = (masa_kerja_bulan / 12) × gaji pokok  (prorata)
Lama kerja < 1 bulan  → THR = 0 (belum berhak)
```

> THR diproses sebagai **payroll run terpisah** dengan nama "THR Lebaran YYYY", bukan digabung ke run gaji bulanan.

---

### Contoh Worked: Karyawan Gaji Rp 10.000.000, Status K/1

**Data Karyawan:**
- Nama: Budi Santoso
- Gaji pokok: `baseSalary = Rp 10.000.000`
- Status: Menikah (`married = true`), 1 tanggungan (`dependents = 1`)
- Punya NPWP: `hasNpwp = true`
- Komponen tambahan: Tunjangan Transport Rp 500.000 (`isTaxable = true`)
- Total `monthlyGross` (taxable): `10.000.000 + 500.000 = Rp 10.500.000`

**Step A — Hitung BPJS** ([bpjs.ts#L49-L77](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/shared/payroll/bpjs.ts#L49-L77)):

```
wage     = 10.000.000

JHT employee  = 2,0%  × 10.000.000  = Rp   200.000
JP  employee  = 1,0%  × MIN(10.000.000, 10.547.400)
              = 1,0%  × 10.000.000  = Rp   100.000
JKN employee  = 1,0%  × MIN(10.000.000, 12.000.000)
              = 1,0%  × 10.000.000  = Rp   100.000

Total BPJS deduction karyawan = 200.000 + 100.000 + 100.000 = Rp 400.000

--- Bagian perusahaan (cost employer, tidak dipotong dari gaji) ---
JKK employer  = 0,24% × 10.000.000 = Rp    24.000
JKM employer  = 0,30% × 10.000.000 = Rp    30.000
JHT employer  = 3,70% × 10.000.000 = Rp   370.000
JP  employer  = 2,00% × 10.000.000 = Rp   200.000
JKN employer  = 4,00% × 10.000.000 = Rp   400.000
Total employer contribution        = Rp 1.024.000 / bulan
```

**Step B — Hitung PPh21** ([pph21.ts#L67-L84](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/shared/payroll/pph21.ts#L67-L84)):

```
monthlyGross          = 10.500.000
biayaJabatan          = MIN(10.500.000 × 5%, 500.000)
                      = MIN(525.000, 500.000)  = Rp 500.000

monthlyPensionContrib = bpjs.employee.jht + bpjs.employee.jp
                      = 200.000 + 100.000     = Rp 300.000

monthlyNet            = 10.500.000 − 500.000 − 300.000
                      = Rp 9.700.000

annualNet             = 9.700.000 × 12 = Rp 116.400.000

PTKP (K/1)           = 54.000.000 + 4.500.000 (kawin) + 4.500.000 (1 tanggungan)
                      = Rp 63.000.000

PKP                   = FLOOR((116.400.000 − 63.000.000) / 1.000) × 1.000
                      = FLOOR(53.400.000 / 1.000) × 1.000
                      = Rp 53.400.000

annualTax (progresif) = 53.400.000 × 5%   (bracket ≤ 60 juta)
                      = Rp 2.670.000

hasNpwp = true → tidak ada surcharge

monthlyTax (PPh21)    = ROUND(2.670.000 / 12) = Rp 222.500
```

**Step C — Summary Payslip Budi November 2024:**

```
PENGHASILAN (ALLOWANCE):
  Gaji Pokok               Rp 10.000.000
  Tunjangan Transport      Rp    500.000
  ─────────────────────────────────────
  Total Penghasilan        Rp 10.500.000

POTONGAN (DEDUCTION):
  BPJS-TK  (JHT 2% + JP 1%)     Rp    300.000
  BPJS-KES (JKN 1%)             Rp    100.000
  PPh21 (K/1, bulan Nov)        Rp    222.500
  ─────────────────────────────────────
  Total Potongan           Rp    622.500

THP BERSIH (netPay)      Rp  9.877.500
  ═══════════════════════════════════
  (yang ditransfer ke rekening Budi)
```

---

## 🎯 Section 10 — TL;DR: Alur 8 Step ASCII Flowchart

```
1️⃣  HR BUKA PERIODE
      POST /payroll/periods  (payroll:create)
      ↓ PayrollPeriod.status = DRAFT
      ↓ code auto: PAY-PRD-xxx

2️⃣  SETUP DATA SUMBER
      ├── Employee Salaries sudah aktif (baseSalary + components)
      ├── Loan installments jatuh tempo ≤ endDate
      ├── Reimbursement PAYROLL sudah masuk employee_salary_components
      └── Attendance data hadir/cuti sudah terekam

3️⃣  JALANKAN PAYROLL RUN
      POST /payroll/runs  (payroll:process)
      ↓ createPayrollRun() → calculatePayroll() SYNCHRONOUS
      ↓ Per karyawan:
         → calculateBpjs(wage)          [JHT+JP+JKN employee/employer]
         → calculatePph21(gross, K/1)   [annualized net method]
         → extraComponents: Loan deduction auto
      ↓ createPayslip() + createPayslipComponents() per karyawan
      ↓ updatePayrollRunTotals() + status COMPLETED

4️⃣  REVIEW HASIL
      GET /payroll/runs/:id  (payroll:read)
      ↓ Check anomali netPay tinggi, komponen tidak wajar
      ↓ Jika perlu recalc: POST /payroll/runs lagi
         (deletePayslipsByRunId + recalculate otomatis)

5️⃣  APPROVE PAYROLL RUN
      PATCH /payroll/runs/:id/approve  (payroll:approve)
      ↓ Validasi: status === 'COMPLETED'
      ↓ status → APPROVED
      ↓ approvedBy + approvedAt tersimpan
      ↓ eventBus: payroll.run.approved

6️⃣  DISTRIBUSI PAYSLIP
      GET /payroll/payslips/:id  (payroll:read)
      GET /payroll/payslips?employeeId=xxx  (self-service)
      ↓ Karyawan bisa lihat payslip via portal
      ↓ HR export PDF + BA Bank + SPT 1721 (payroll:export)

7️⃣  DISBURSE / BAYAR GAJI
      PATCH /payroll/runs/:id/disburse  (payroll:approve)
      ↓ Validasi: status === 'APPROVED'
      ↓ applyPayrollDeductions() → cicilan pinjaman → PAID (Prisma $transaction)
      ↓ status → DISBURSED + disbursedBy + disbursedAt
      ↓ eventBus: payroll.run.disbursed → notifikasi karyawan

8️⃣  TUTUP PERIODE (REKONSILIASI)
      PATCH /payroll/periods/:id/close  (payroll:update)
      ↓ PayrollPeriod.status → CLOSED (irreversible)
      ↓ createPayrollRun() terblokir untuk periode ini
      ✅ FLOW SELESAI — Audit trail lengkap di 7 tabel
```
