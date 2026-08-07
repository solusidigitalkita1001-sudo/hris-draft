# 🧭 Modul Onboarding + Exit Clearance + Career Transactions — Panduan Detail Alur Bisnis

> Modul ini menangani **3 proses bisnis terintegrasi** sepanjang siklus hidup karyawan di perusahaan:
> 1. **Onboarding** → persiapan checklist, perangkat, akses sistem, dan checkpoint masa percobaan
> 2. **Exit Clearance** → resignation, exit interview, clearance 4 departemen, final payroll
> 3. **Career Transactions** → promosi, mutasi, demosi, alih status, dengan audit trail dan SK digital

Ketiga proses ini saling berkaitan: Karyawan di-onboard melalui checklist → bekerja, bisa dipromosikan/dimutasi melalui career transaction → pada akhirnya keluar melalui resignation + exit clearance + final payroll.

---

## 📌 Section 1 — Overview, Referensi File, dan Entitas

### Files & References
| Komponen | Lokasi File |
|---|---|
| API Routes (Onboarding) | [onboarding.routes.ts](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/modules/onboarding/onboarding.routes.ts) |
| DTO Validator (Zod) | [onboarding.dto.ts](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/modules/onboarding/onboarding.dto.ts) |
| Controller | [onboarding.controller.ts](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/modules/onboarding/onboarding.controller.ts) |
| Repository + Logic | [onboarding.repository.ts](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/modules/onboarding/onboarding.repository.ts) |
| Service Layer | [onboarding.service.ts](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/modules/onboarding/onboarding.service.ts) |
| Career Transaction Routes | [employee.routes.ts#L28-L36](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/modules/employee/employee.routes.ts#L28-L36) |
| Career Transaction DTO | [employee.dto.ts#L106-L124](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/modules/employee/employee.dto.ts#L106-L124) |
| Schema Prisma — Onboarding | [schema.prisma#L2546-L2613](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/database/prisma/schema.prisma#L2546-L2613) |
| Schema Prisma — Career | [schema.prisma#L2035-L2072](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/database/prisma/schema.prisma#L2035-L2072) |
| Enum CareerTransactionType | [schema.prisma#L2958-L2966](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/database/prisma/schema.prisma#L2958-L2966) |

### Entitas Utama yang Terlibat
| Entitas | Tabel DB | Domain | Keterangan Singkat |
|---|---|---|---|
| `OnboardingChecklist` | `onboarding_checklists` | Onboarding | Checklist per karyawan baru per item (perangkat, akses, dll) |
| `Resignation` | `resignations` | Exit | Permohonan pengunduran diri karyawan |
| `ExitClearance` | `exit_clearances` | Exit | Clearance per departemen sebelum karyawan keluar |
| `EmployeeCareerTransaction` | `employee_career_transactions` | Career | Rekam jejak promosi/mutasi/demosi + pembaruan data employee |
| `EmployeeCompanyAssignment` | `employee_company_assignments` | Career/Multi-Company | Assignment karyawan lintas perusahaan dalam satu grup |
| `UserCompanyAccess` | `user_company_access` | Auth | Akses user akun ke company tertentu dalam grup |

---

## 🔐 Section 2 — Role Matrix: Siapa Bisa Apa?

Otorisasi didefinisikan via `authorize({ resource: 'employee', action: '...' })` di [onboarding.routes.ts#L9](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/modules/onboarding/onboarding.routes.ts#L9) dan [employee.routes.ts#L28-L36](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/modules/employee/employee.routes.ts#L28-L36).

| Aksi | SUPER_ADMIN | GROUP_ADMIN | COMPANY_ADMIN | HR_MANAGER | HR_STAFF | MANAGER | EMPLOYEE |
|---|---|---|---|---|---|---|---|
| CRUD Template Checklist per Dept (create/update/list) | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| Assign PIC ke checklist item | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| Complete/update task checklist (`status=DONE`) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| Lihat checklist onboarding karyawan sendiri | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Submit Resignation (ajukan pengunduran diri) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Conduct Exit Interview & update clearance item HR | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| Clearance Approve — Dept Head (GA/IT/Finance/HR) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| Approve/Reject Resignation (HR final) | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Final Payroll Approve (Finance) | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Lihat semua Resignation (difilter company) | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| Career Transaction CREATE (promosi/mutasi + SK) | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Lihat Career Transaction history (read) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Mutasi Lintas Company (company assignment) | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |

---

## 🧾 Section 3 — 6 Entitas, Relasi, dan Field Lengkap

### Diagram Relasi ASCII
```
companies ──────────────────────────────────────────────────────────────────────┐
    │                                                                            │
    ├─< employees (1 employee bisa banyak transaksi)                             │
    │       │                                                                   │
    │       ├─< onboarding_checklists (N item per karyawan baru)                │
    │       │       │ FK: employee_id, pic_id → employees.id                    │
    │       │                                                                   │
    │       ├─< resignations (1 per event resign)                               │
    │       │       │ FK: employee_id, company_id                               │
    │       │       └─< exit_clearances (N item clearance per resign)           │
    │       │               │ FK: resignation_id, pic_id → employees.id         │
    │       │               │ onDelete: Cascade (clearance ikut hapus resign)   │
    │       │                                                                   │
    │       ├─< employee_career_transactions (N transaksi karir per karyawan)   │
    │       │       FK: from/to branch_id, department_id, position_id           │
    │       │       Atomic: $transaction update employees + insert career row   │
    │       │                                                                   │
    │       └─< employee_company_assignments (N secondment/transfer lintas co.) │
    │               FK: approved_by → users.id                                 │
    │                                                                           │
    └─< user_company_access (access control multi-company per user)            │
            FK: user_id → users.id, company_id, group_id                       │
            UNIQUE: (user_id, company_id)                                      │
```

### Entity 1 — `onboarding_checklists` ([schema.prisma#L2546-L2567](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/database/prisma/schema.prisma#L2546-L2567))
| Field | Type | Required | Keterangan |
|---|---|---|---|
| `id` | UUID | auto | Primary key |
| `companyId` | UUID | ✅ | Company scope — row-level isolation |
| `employeeId` | UUID | ✅ | FK → `employees.id` (karyawan yang onboard) |
| `itemName` | varchar(150) | ✅ | Nama item: "Setup laptop MacBook M3", "Akses GitLab" |
| `category` | varchar(50) | default `Equipment` | Kelompok item: Equipment / System Access / Document / Training |
| `picId` | UUID | ❌ | FK → `employees.id` (siapa yang bertanggung jawab selesaikan) |
| `dueDate` | DateTime | ❌ | Target penyelesaian item — bisa overdue |
| `status` | varchar(20) | default `PENDING` | PENDING / IN_PROGRESS / DONE / OVERDUE |
| `notes` | text | ❌ | Catatan penyelesaian: "Laptop sudah dikirim ke alamat WFH" |
| `completedAt` | DateTime | ❌ | Di-set otomatis saat `status = DONE` via `updateChecklist()` |
| `createdAt` | DateTime | auto | |

### Entity 2 — `resignations` ([schema.prisma#L2571-L2592](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/database/prisma/schema.prisma#L2571-L2592))
| Field | Type | Required | Keterangan |
|---|---|---|---|
| `id` | UUID | auto | Primary key |
| `companyId` | UUID | ✅ | Company scope |
| `employeeId` | UUID | ✅ | FK → `employees.id` |
| `resignDate` | DateTime | ✅ | Tanggal surat resign diajukan |
| `lastWorkingDate` | DateTime | ✅ | Hari kerja terakhir = resignDate + noticePeriodDays |
| `reason` | text | ❌ | Alasan resign — bisa anonim untuk laporan attrition |
| `noticePeriodDays` | Int | default `30` | Masa notice sesuai kontrak / UU — min 14 hari PKWT |
| `status` | varchar(20) | default `SUBMITTED` | SUBMITTED / APPROVED / REJECTED |
| `approvedBy` | UUID | ❌ | FK → `users.id` — siapa yang approve HR |
| `approvedAt` | DateTime | ❌ | Waktu approval HR final |

### Entity 3 — `exit_clearances` ([schema.prisma#L2596-L2612](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/database/prisma/schema.prisma#L2596-L2612))
> Di-generate otomatis (8 item default) saat `createResignation()` dipanggil di [onboarding.service.ts#L30-L34](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/modules/onboarding/onboarding.service.ts#L30-L34).

| Field | Type | Required | Keterangan |
|---|---|---|---|
| `id` | UUID | auto | Primary key |
| `resignationId` | UUID | ✅ | FK → `resignations.id` onDelete: **Cascade** |
| `department` | varchar(50) | ✅ | IT / GA / Finance / HR (4 departemen wajib) |
| `checklistItem` | varchar(150) | ✅ | Item spesifik: "Return laptop & accessories" |
| `picId` | UUID | ❌ | FK → `employees.id` onDelete: SetNull |
| `status` | varchar(20) | default `PENDING` | PENDING / IN_PROGRESS / CLEARED |
| `notes` | text | ❌ | Catatan PIC: "Laptop Lenovo X1 serial SN-20240101 returned" |
| `clearedAt` | DateTime | ❌ | Di-set otomatis saat `status = CLEARED` |

### Entity 4 — `employee_career_transactions` ([schema.prisma#L2035-L2071](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/database/prisma/schema.prisma#L2035-L2071))
> Setiap career transaction **otomatis memperbarui data employee** (`branchId`, `departmentId`, `positionId`, `employmentType`) dalam satu Prisma `$transaction` atomik di [employee.repository.ts#L524-L573](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/modules/employee/employee.repository.ts#L524-L573).

| Field | Type | Required | Keterangan |
|---|---|---|---|
| `id` | UUID | auto | Primary key |
| `employeeId` | UUID | ✅ | FK → `employees.id` |
| `companyId` | UUID | ✅ | Company scope |
| `transactionType` | Enum | ✅ | PROMOTION / DEMOTION / MUTATION / TRANSFER / ROTATION / ACTING_ASSIGNMENT / STATUS_CHANGE |
| `effectiveDate` | DateTime | ✅ | Tanggal berlaku resmi perubahan |
| `fromBranchId` | UUID | ❌ | Snapshot: cabang asal (di-snapshot dari `employee.branchId` saat transaksi) |
| `toBranchId` | UUID | ❌ | Cabang tujuan |
| `fromDepartmentId` | UUID | ❌ | Departemen asal |
| `toDepartmentId` | UUID | ❌ | Departemen tujuan |
| `fromPositionId` | UUID | ❌ | Jabatan asal |
| `toPositionId` | UUID | ❌ | Jabatan tujuan |
| `fromEmploymentType` | Enum | ❌ | Status kepegawaian asal |
| `toEmploymentType` | Enum | ❌ | Status kepegawaian tujuan (PKWT → PKWTT dst.) |
| `referenceNumber` | varchar(100) | ❌ | Nomor SK: "SK/DIR/2024/089" |
| `reason` | text | ❌ | Alasan perubahan |
| `createdBy` | UUID | ❌ | FK → `users.id` — siapa yang input |
| `deletedAt` | DateTime | ❌ | Soft delete |

### Entity 5 — `employee_company_assignments` ([schema.prisma#L1991-L2011](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/database/prisma/schema.prisma#L1991-L2011))
| Field | Type | Keterangan |
|---|---|---|
| `employeeId` | UUID | FK → `employees.id` — karyawan yang di-assign |
| `companyId` | UUID | Company tujuan (bisa berbeda dari company asal) |
| `assignmentType` | Enum | PRIMARY / SECONDMENT / TRANSFER |
| `startDate` | DateTime | Tanggal mulai penugasan |
| `endDate` | DateTime | Tanggal selesai (nullable = ongoing) |
| `approvedBy` | UUID | FK → `users.id` |

### Entity 6 — `user_company_access` ([schema.prisma#L2014-L2032](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/database/prisma/schema.prisma#L2014-L2032))
| Field | Type | Keterangan |
|---|---|---|
| `userId` | UUID | FK → `users.id` |
| `companyId` | UUID | Company yang bisa diakses |
| `groupId` | UUID | Grup perusahaan (opsional) |
| `accessScope` | Enum | SINGLE_COMPANY / GROUP_WIDE |
| `roleOverride` | varchar(50) | Override role khusus di company ini |
| UNIQUE | (userId, companyId) | Satu user satu row per company |

---

## 🔄 Section 4 — State Machine

### State Machine Resignation

```
[SUBMITTED]
  Karyawan submit surat resign via POST /resignations
  → Auto-generate 8 exit clearance items (generateClearances @ repository.ts#L80-L94)
       │
       ├── HR approve → approveResignation() → updateResignationStatus('APPROVED', userId)
       │       ↓
       │   [APPROVED]
       │       │
       │       ├── IT Clearance: Return laptop+accessories → clearance status: CLEARED
       │       ├── IT Clearance: Deactivate accounts & email → clearance status: CLEARED
       │       ├── GA Clearance: Return ID card+access card → clearance status: CLEARED
       │       ├── Finance Clearance: Settlement outstanding loans → clearance status: CLEARED
       │       ├── Finance Clearance: Final salary calculation → clearance status: CLEARED
       │       ├── HR Clearance: Exit interview → clearance status: CLEARED
       │       ├── HR Clearance: Certificate of employment → clearance status: CLEARED
       │       └── HR Clearance: BPJS transfer letter → clearance status: CLEARED
       │                ↓ (semua 8 clearance = CLEARED)
       │          Proses Final Payroll (pro-rate + pesangon + sisa cuti - outstanding)
       │                ↓
       │          [COMPLETED] — karyawan non-aktif, PII dienkripsi, retensi 7 tahun
       │
       └── HR reject → rejectResignation() → updateResignationStatus('REJECTED')
               ↓
           [REJECTED] — karyawan tetap aktif, alasan dicatat

Trigger Methods (onboarding.service.ts):
  createResignation()  → SUBMITTED + auto-generate clearances
  approveResignation() → APPROVED  (updateResignationStatus @ repository.ts#L59-L63)
  rejectResignation()  → REJECTED  (updateResignationStatus @ repository.ts#L59-L63)
  updateClearance()    → per item PENDING → IN_PROGRESS → CLEARED
                         clearedAt di-set saat status=CLEARED @ repository.ts#L76
```

### State Machine Onboarding Checklist

```
[DRAFT_PRE_ONBOARD]
  HR create checklist item sebelum hari pertama karyawan
  → POST /checklists dengan dueDate + picId
       │
       ↓
  [PENDING]  ← default status saat checklist item dibuat
  (createChecklist @ repository.ts#L13-L17)
       │
       ├── PIC mulai kerjakan → updateChecklist(status: IN_PROGRESS)
       │         ↓
       │   [IN_PROGRESS]
       │         │
       │         ├── Selesai → updateChecklist(status: DONE)
       │         │       completedAt = new Date() (repository.ts#L24)
       │         │         ↓
       │         │   [DONE] ✅ — item selesai, completedAt tercatat
       │         │
       │         └── Lewat dueDate tanpa selesai → sistem/cron flag
       │                   ↓
       │             [OVERDUE] ⚠️ — perlu eskalasi ke HR Manager
       │
       └── Lewat dueDate tanpa progress → [OVERDUE]

Checkpoint onboarding (logical, bukan enum DB):
  Day-0  : semua item category=Equipment & System Access = DONE
  30-day : review percobaan 1 bulan (manual HR entry)
  60-day : review percobaan 2 bulan
  90-day : COMPLETED_PROBATION → SK Pengangkatan Karyawan Tetap
           Trigger CareerTransaction type=STATUS_CHANGE
           fromEmploymentType=PROBATION, toEmploymentType=PERMANENT
```

---

## 📖 Section 5 — Use Case: Siti Mengundurkan Diri (6 Langkah Detail)

**Konteks:** Siti Rahayu, Karyawan Tetap (PKWTT), masa kerja 3 tahun 2 bulan, Divisi Marketing, mengajukan pengunduran diri pada 10 Oktober 2024. Gaji pokok Rp 8.000.000/bulan.

---

### ⬛ Step 1 — Siti Submit Surat Resign (10 Oktober 2024)

Siti login → Profil Saya → Ajukan Pengunduran Diri:
- `resignDate`: `2024-10-10T00:00:00.000Z`
- `lastWorkingDate`: `2024-11-09T00:00:00.000Z` (30 hari notice period)
- `reason`: "Mendapatkan penawaran di perusahaan lain dengan kompensasi lebih baik" *(alasan disimpan, bisa di-anonimkan di laporan attrition)*
- `noticePeriodDays`: `30`

Yang terjadi di backend ([onboarding.service.ts#L29-L34](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/modules/onboarding/onboarding.service.ts#L29-L34)):

```typescript
// service.ts#L29-L34: createResignation — 2 langkah berurutan
const resignation = await onboardingRepository.createResignation(data);
// → INSERT INTO resignations (status='SUBMITTED', noticePeriodDays=30, ...)

await onboardingRepository.generateClearances(resignation.id, data.employeeId);
// → INSERT 8 rows ke exit_clearances (repository.ts#L80-L93):
//   IT: 'Return laptop & accessories'         → status PENDING
//   IT: 'Deactivate system accounts & email'  → status PENDING
//   GA: 'Return ID card & access card'        → status PENDING
//   Finance: 'Settlement of outstanding loans' → status PENDING
//   Finance: 'Final salary & benefit calculation' → status PENDING
//   HR: 'Exit interview'                       → status PENDING
//   HR: 'Certificate of employment'            → status PENDING
//   HR: 'BPJS transfer letter'                 → status PENDING
```

Hasil: ✅ 1 row di `resignations` status **SUBMITTED** + 8 baris otomatis di `exit_clearances`. Notifikasi masuk ke inbox HR Manager.

---

### ⬛ Step 2 — HR Approve + Conduct Exit Interview (Minggu Ke-3 Oktober)

HR Manager Pak Budi membuka resignation Siti:
1. Verifikasi: masa notice 30 hari terpenuhi (14 hari minimum kontrak ✅)
2. Klik Approve — endpoint `PATCH /resignations/:id/approve`

```typescript
// controller.ts#L31-L33: approveResignation
await onboardingService.approveResignation(req.params.id, req.user!.id);
// → updateResignationStatus(id, 'APPROVED', userId)
// → SET status='APPROVED', approvedBy=pakBudi.id, approvedAt=now()
```

**Exit Interview** — HR Staff Rina update clearance item "Exit interview":
```
PATCH /clearances/:id
body: { status: "CLEARED", notes: "Alasan resign: gaji lebih kompetitif. Siti puas dengan lingkungan kerja dan tim. Anonim di laporan attrition Q4." }
→ updateClearance: status=CLEARED, clearedAt=now()
```

---

### ⬛ Step 3 — IT Clearance (30 Oktober 2024)

Teknisi IT Dani menerima notifikasi exit clearance Siti. Buka halaman `GET /resignations/:id` → lihat 2 item IT:

**Item A — Return laptop & accessories:**
- Siti kembalikan: Laptop Lenovo ThinkPad X1 Carbon (SN: LN-X1-20241001) + charger + USB-C dongle ✅
- Update: `PATCH /clearances/:clearanceItemId` → `{ status: "CLEARED", notes: "Lenovo X1 SN:LN-X1-20241001 + charger + dongle returned. Kondisi baik, tidak ada kerusakan fisik." }`
- `clearedAt = 2024-10-30`

**Item B — Deactivate accounts:**
- Dani deactivate: akun GitLab, akun email @company.com, VPN access, Slack workspace
- Update: `PATCH /clearances/:clearanceItemId` → `{ status: "CLEARED", notes: "Email dinonaktifkan. GitLab removed from org. VPN cert revoked. Slack deactivated." }`
- `clearedAt = 2024-10-30`

---

### ⬛ Step 4 — GA & Finance Clearance (1-5 November 2024)

**GA Clearance — Return ID card:**
- Siti kembalikan: kartu ID karyawan #EMP-2021-0342, kunci laci meja, PIN akses pintu lantai 3
- Update clearance GA: `{ status: "CLEARED", notes: "ID card #EMP-2021-0342 returned. Kunci laci + PIN lantai 3 dikembalikan." }`

**Finance Clearance — Outstanding Loans & Salary:**
- Finance Staff Maya cek sistem: Siti memiliki **travel advance outstanding** dari trip Oktober yang belum dipertanggungjawabkan: **Rp 1.200.000**
- Update clearance Finance (Settlement): `{ status: "CLEARED", notes: "Outstanding travel advance Rp 1.200.000 akan dipotong dari final salary." }`

Hasil: ✅ Semua 8 exit clearance items = **CLEARED**. HR Manager dapat notifikasi: proses siap ke tahap Final Payroll.

---

### ⬛ Step 5 — Kalkulasi Final Payroll (November 2024)

**Data dasar:**
- Gaji pokok: **Rp 8.000.000/bulan**
- Hari kerja bulan November: 21 hari kerja
- Last working date: **9 November 2024** = **9 hari kerja** yang dijalani di November
- Sisa cuti tahunan: **2 hari** (kebijakan perusahaan: sisa cuti dibayar tunai)
- Outstanding travel advance: **Rp 1.200.000** (akan dipotong)
- Masa kerja: **3 tahun 2 bulan** (resign sukarela, bukan PHK)

**Kalkulasi detail:**

```
A. GAJI PRO-RATE NOVEMBER
   = (9 hari / 21 hari kerja) × Rp 8.000.000
   = 0,4286 × 8.000.000
   = Rp 3.428.571

B. SISA CUTI DIBAYAR (2 hari)
   = (2 / 21) × Rp 8.000.000
   = Rp 761.905

C. PESANGON (resign sukarela, masa kerja 3 thn 2 bln)
   → UU No.13/2003 Pasal 156: pesangon hanya untuk PHK, BUKAN resign sukarela
   → resign atas kemauan sendiri = Rp 0 pesangon
   (kecuali ada perjanjian perusahaan lebih baik dari UU)

D. DEDUCTION — Outstanding Travel Advance
   = - Rp 1.200.000

E. TOTAL FINAL PAYROLL BRUTO
   = Rp 3.428.571 + Rp 761.905 + Rp 0 - Rp 1.200.000
   = Rp 2.990.476

F. PPh21 Final (tarif progresif — diasumsikan penghasilan tahunan < 60jt)
   Annualized: 2.990.476 → pajak sangat kecil, estimasi nihil atau Rp ~0
   (HR hitung manual per PTKP/penghasilan sisa tahun — di luar scope kalkulasi ini)

G. BPJS Ketenagakerjaan:
   → Keanggotaan Siti di BPJS Ketenagakerjaan DIPINDAHKAN (bukan dibatalkan)
   → HR terbitkan surat pemindahan BPJS (clearance item HR: 'BPJS transfer letter')
   → JHT (Jaminan Hari Tua) bisa dicairkan Siti sesuai ketentuan BPJSTK

NET FINAL PAYROLL SITI: ± Rp 2.990.476
Transfer ke rekening Siti: 25 November 2024
```

---

### ⬛ Step 6 — Finalisasi Exit (25 November 2024)

- ✅ Siti terima THP bersih: **Rp 2.990.476** (transfer bank)
- ✅ BPJS Ketenagakerjaan: surat pemindahan diterbitkan oleh HR
- ✅ **Paklaring** (Certificate of Employment) diterbitkan oleh HR ([HR clearance item: 'Certificate of employment'])
- ✅ Status karyawan Siti di sistem: di-set non-aktif (`deletedAt` di-set / status TERMINATED)
- ✅ Data PII Siti: dienkripsi & diarsipkan — **retensi minimal 7 tahun** (lihat Business Rules Section 9)
- ✅ Akun login Siti: dinonaktifkan

---

## ✅ Section 6 — Zod DTO: 7 Schema Validator

Didefinisikan di [onboarding.dto.ts#L1-L36](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/modules/onboarding/onboarding.dto.ts) dan [employee.dto.ts#L106-L142](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/modules/employee/employee.dto.ts#L106-L142).

| DTO Schema | File | Kegunaan | Field Kritis |
|---|---|---|---|
| `createChecklistSchema` | onboarding.dto.ts#L3-L10 | Buat item checklist onboarding | `employeeId` UUID, `itemName` min 1 max 150, `category` default 'Equipment', `picId` UUID optional, `dueDate` datetime optional |
| `updateChecklistSchema` | onboarding.dto.ts#L12-L15 | Update status / catatan checklist | `status` ∈ [PENDING, IN_PROGRESS, DONE, OVERDUE], `notes` optional — jika DONE maka `completedAt=now()` otomatis di repository |
| `createResignationSchema` | onboarding.dto.ts#L17-L24 | Ajukan pengunduran diri | `employeeId` UUID, `resignDate` datetime, `lastWorkingDate` datetime, `noticePeriodDays` int default 30, `reason` optional |
| `createClearanceSchema` | onboarding.dto.ts#L26-L31 | Buat manual clearance item tambahan | `resignationId` UUID, `department` min 1 max 50, `checklistItem` min 1 max 150, `picId` UUID optional |
| `createCareerTransactionSchema` | employee.dto.ts#L106-L124 | Buat promosi/mutasi/demosi + update data employee | `transactionType` ∈ 7 enum, `effectiveDate` datetime, `toBranchId`/`toDepartmentId`/`toPositionId` UUID optional nullable, `toEmploymentType` ∈ 6 enum optional, `referenceNumber` max 100 (nomor SK) |
| `createEmployeeCompanyAssignmentSchema` | employee.dto.ts#L126-L133 | Assign karyawan ke company lain (mutasi lintas entity) | `companyId` UUID, `assignmentType` ∈ [PRIMARY, SECONDMENT, TRANSFER] default PRIMARY, `startDate` datetime, `endDate` optional nullable |
| `updateEmployeeCompanyAssignmentSchema` | employee.dto.ts#L135-L142 | Update assignment (perpanjang/akhiri secondment) | Semua field optional — `endDate` nullable untuk menutup assignment |

---

## 🔌 Section 7 — 16 API Endpoints

Endpoint onboarding di [onboarding.routes.ts#L11-L21](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/modules/onboarding/onboarding.routes.ts#L11-L21). Endpoint career transaction di [employee.routes.ts#L28-L55](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/modules/employee/employee.routes.ts#L28-L55). Base URL: `{APP_URL}{API_PREFIX}/`.

| # | Method | Route | Resource Auth | Deskripsi |
|---|---|---|---|---|
| 1 | GET | `/onboarding/checklists?employeeId=:id` | `employee:read` | List semua checklist item karyawan tertentu |
| 2 | POST | `/onboarding/checklists` | `employee:create` + validate | Buat item checklist onboarding baru |
| 3 | PATCH | `/onboarding/checklists/:id` | `employee:update` + validate | Update status/catatan checklist (DONE auto-set completedAt) |
| 4 | GET | `/onboarding/resignations?companyId=&status=` | `employee:read` | List semua resignation difilter company + status opsional |
| 5 | GET | `/onboarding/resignations/:id` | `employee:read` | Detail resignation + employee info + semua clearance items |
| 6 | POST | `/onboarding/resignations` | `employee:create` + validate | Ajukan resignation → auto-generate 8 clearance items |
| 7 | PATCH | `/onboarding/resignations/:id/approve` | `employee:update` | HR approve resignation → APPROVED + approvedBy + approvedAt |
| 8 | PATCH | `/onboarding/resignations/:id/reject` | `employee:update` | HR reject resignation → REJECTED |
| 9 | PATCH | `/onboarding/clearances/:id` | `employee:update` | Update status clearance item (PENDING → IN_PROGRESS → CLEARED) |
| 10 | GET | `/employees/:id/career-transactions` | `employee:read` | Riwayat career transaction karyawan (seluruh promosi/mutasi) |
| 11 | POST | `/employees/:id/career-transactions` | `employee:update` + validate | Buat career transaction → atomik update data employee sekaligus |
| 12 | GET | `/employees/:id/company-assignments` | `employee:read` | List semua company assignment karyawan |
| 13 | POST | `/employees/:id/company-assignments` | `employee:update` + validate | Assign karyawan ke company lain (secondment/transfer) |
| 14 | PUT | `/employees/:id/company-assignments/:assignmentId` | `employee:update` + validate | Update assignment (ubah tipe/tanggal selesai) |
| 15 | DELETE | `/employees/:id/company-assignments/:assignmentId` | `employee:update` | Hapus assignment (akhiri penugasan lintas company) |
| 16 | PATCH | `/employees/:id/status` | `employee:update` | Update status karyawan (aktif/non-aktif/terminasi) |

**Total: 16 endpoint** (9 onboarding + 7 career/employee)

---

## 🔗 Section 8 — Integrasi Antar Modul (Minimum 4)

### 8.1 Recruitment → Onboarding (Auto-Generate Checklist)

Saat kandidat di-hire dari modul Recruitment dan status berubah menjadi `HIRED`, sistem seharusnya (dan dapat dikonfigurasi untuk) otomatis memanggil `POST /onboarding/checklists` per item template perusahaan.

**FK yang menghubungkan:**
- `onboarding_checklists.employee_id` → `employees.id`
- `employees.id` di-create saat proses onboarding recruitment selesai
- Template default checklist per company bisa di-seed dari modul konfigurasi HR

**Alur integrasi:**
```
Recruitment: status kandidat = HIRED
  → buat employee record baru
  → trigger: createChecklist() × N items (berdasarkan template dept/jabatan)
  → assign PIC per kategori (IT untuk Equipment, HR untuk Document)
  → karyawan baru lihat checklist Day-0 mereka
```

### 8.2 Asset Management → Exit Clearance Stage IT

Saat exit clearance item IT "Return laptop & accessories" dibuat, modul Asset Management perlu dikonsultasi untuk daftar aset yang dipinjamkan karyawan.

**FK yang menghubungkan:**
- `assets.assigned_to_employee_id` → `employees.id` (di modul asset management)
- `exit_clearances.resignation_id` → link ke `resignations.employee_id`

**Alur integrasi:**
```
ExitClearance IT stage dibuat → query Asset Management:
  SELECT * FROM asset_assignments
  WHERE employee_id = :employeeId AND returned_at IS NULL
→ Tampilkan daftar aset belum dikembalikan di form clearance IT
→ Setelah return: update asset_assignments.returned_at + exit_clearance.status = CLEARED
```

### 8.3 Travel & Expense → Finance Clearance (Outstanding Advance)

Finance clearance item "Settlement of outstanding loans" memerlukan data dari modul Travel Expense untuk mengetahui sisa travel advance yang belum dipertanggungjawabkan.

**FK yang menghubungkan:**
- `travel_advances.reconciled = false` WHERE `employee_id` terkait
- Jumlah outstanding dijumlahkan → menjadi **deduction** di final payroll

**Query di Finance clearance:**
```typescript
// Finance staff cek outstanding travel advance karyawan yang resign
const outstanding = await prisma.travelAdvance.aggregate({
  where: {
    trip: { employeeId: resignation.employeeId },
    reconciled: false
  },
  _sum: { amount: true }
});
// → outstanding._sum.amount = Rp 1.200.000 (dikurangkan dari final payroll)
```

### 8.4 Payroll → Final Payroll Processing

Setelah seluruh clearance selesai (semua 8 item `CLEARED`), data resignation digunakan modul Payroll untuk menghitung **final salary run**.

**FK yang menghubungkan:**
- `resignations.employee_id` → `employees.id`
- `resignations.last_working_date` → batas pro-rate calculation
- Deduction component: outstanding travel advance FK ke `travel_advances`
- Addition component: sisa cuti (dari modul Leave balance `employee_leave_balances`)

**Komponen Final Payroll:**
```
+ Gaji Pro-Rate (last_working_date / total hari kerja bulan tersebut × gaji pokok)
+ Sisa Cuti Dibayar (dari employee_leave_balances.remaining_days)
+ Pesangon (jika PHK — lihat Business Rules Section 9)
- Outstanding Travel Advance (travel_advances WHERE reconciled=false)
- Sisa Pinjaman Karyawan (jika ada, dari modul loan)
= NET FINAL PAYROLL
```

---

## ⚠️ Section 9 — Business Rules & Kepatuhan Hukum

### 9.1 Kalkulasi Pesangon (UU No.13/2003 Pasal 156)

> **PENTING:** Pesangon **hanya berlaku untuk PHK (Pemutusan Hubungan Kerja) oleh perusahaan**, BUKAN untuk resign sukarela karyawan.

#### Uang Pesangon (Pasal 156 ayat 2)
| Masa Kerja | Uang Pesangon |
|---|---|
| < 1 tahun | 1 bulan upah |
| 1 – 2 tahun | 2 bulan upah |
| 2 – 3 tahun | 3 bulan upah |
| 3 – 4 tahun | 4 bulan upah |
| 4 – 5 tahun | 5 bulan upah |
| 5 – 6 tahun | 6 bulan upah |
| 6 – 7 tahun | 7 bulan upah |
| 7 – 8 tahun | 8 bulan upah |
| ≥ 8 tahun | 9 bulan upah |

#### Uang Penghargaan Masa Kerja/UPMK (Pasal 156 ayat 3)
| Masa Kerja | UPMK |
|---|---|
| 3 – 6 tahun | 2 bulan upah |
| 6 – 9 tahun | 3 bulan upah |
| 9 – 12 tahun | 4 bulan upah |
| 12 – 15 tahun | 5 bulan upah |
| 15 – 18 tahun | 6 bulan upah |
| 18 – 21 tahun | 7 bulan upah |
| 21 – 24 tahun | 8 bulan upah |
| ≥ 24 tahun | 10 bulan upah |

#### Uang Penggantian Hak (Pasal 156 ayat 4)
- Sisa cuti tahunan yang belum diambil → dibayar tunai
- Biaya ongkos pulang kampung (untuk PKWT) jika diperjanjikan
- Biaya pengobatan dan perumahan (jika diperjanjikan)

---

### Skenario Kalkulasi Pesangon — 3 Kasus Riil

**Asumsi:** Gaji pokok Rp 10.000.000/bulan untuk semua skenario.

#### Skenario A — PHK oleh Perusahaan, Masa Kerja 10 Tahun
```
Masa kerja: 10 tahun (≥ 8 tahun)

1. Uang Pesangon (Pasal 156 ayat 2):
   Masa kerja ≥ 8 tahun → 9 bulan upah
   = 9 × Rp 10.000.000
   = Rp 90.000.000

2. UPMK (Pasal 156 ayat 3):
   Masa kerja 9-12 tahun → 4 bulan upah
   = 4 × Rp 10.000.000
   = Rp 40.000.000

3. Penggantian Hak:
   Sisa cuti 5 hari: (5/21) × 10.000.000 = Rp 2.380.952

TOTAL PESANGON + UPMK + HAK:
= Rp 90.000.000 + Rp 40.000.000 + Rp 2.380.952
= Rp 132.380.952
```

#### Skenario B — Resign Sukarela, Masa Kerja 2 Tahun
```
Masa kerja: 2 tahun (resign kemauan sendiri)

1. Uang Pesangon:
   TIDAK ADA — resign sukarela tidak berhak pesangon
   = Rp 0

2. UPMK:
   TIDAK ADA — UPMK hanya untuk PHK
   = Rp 0

3. Penggantian Hak (sisa cuti):
   Sisa cuti 3 hari: (3/21) × 10.000.000 = Rp 1.428.571
   → Dibayar berdasarkan kebijakan perusahaan (bukan kewajiban UU untuk resign)
   → Jika perusahaan memiliki kebijakan bayar sisa cuti = Rp 1.428.571

Pro-rate gaji bulan terakhir (misal 15 hari kerja dari 22):
= (15/22) × Rp 10.000.000 = Rp 6.818.182

TOTAL FINAL PAYROLL (tanpa pesangon):
= Rp 6.818.182 + Rp 1.428.571 = Rp 8.246.753
```

#### Skenario C — PKWT Tidak Diperpanjang (Kontrak Berakhir)
```
Kontrak PKWT 1 tahun, tidak diperpanjang oleh perusahaan.
Masa kerja total PKWT: 1 tahun penuh.

1. Uang Pesangon:
   Berdasarkan UU Cipta Kerja (PP 35/2021): PKWT tidak diperpanjang
   → BERHAK Uang Kompensasi (bukan pesangon konvensional)
   = (masa kerja / 12) × 1 bulan upah
   = (12/12) × Rp 10.000.000
   = Rp 10.000.000

2. UPMK: TIDAK berlaku untuk PKWT

3. Penggantian Hak:
   Sisa cuti PKWT (jika ada): sesuai perjanjian
   Biaya pulang kampung: jika diperjanjikan di kontrak

4. Gaji bulan terakhir (full bulan): Rp 10.000.000

TOTAL:
= Rp 10.000.000 (uang kompensasi) + Rp 10.000.000 (gaji bulan terakhir)
= Rp 20.000.000
+ sisa cuti jika ada (per perjanjian)
```

---

### 9.2 Notice Period Minimum
- **PKWTT (Karyawan Tetap):** notice period sesuai perjanjian kerja, lazim 30 hari
- **PKWT (Kontrak):** minimal **14 hari** (`noticePeriodDays` default 30 di DTO, tapi minimum enforcement perlu ditambahkan sebagai Zod `.refine()`)
- Karyawan yang tidak memenuhi notice period dapat dikenakan pemotongan gaji sesuai perjanjian kerja

### 9.3 Mutasi Lintas Company (Multi-Entity Group)
- Mutasi karyawan ke perusahaan lain dalam grup menggunakan **`employee_company_assignments`** ([schema.prisma#L1991](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/database/prisma/schema.prisma#L1991))
- Akses sistem karyawan yang dimutasi ditambah via **`user_company_access`** ([schema.prisma#L2014](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/database/prisma/schema.prisma#L2014)) dengan `UNIQUE (user_id, company_id)` constraint
- Career transaction type `TRANSFER` + `assignmentType = TRANSFER` dipakai bersamaan untuk membangun jejak audit yang lengkap

### 9.4 Retensi Data Exit — 7 Tahun PII
- Data karyawan yang keluar (resignation, clearance, final payroll) **diarsipkan**, bukan dihapus
- PII (NIK, nomor rekening, alamat) harus **dienkripsi** setelah karyawan non-aktif
- Retensi minimal **7 tahun** (kepatuhan perpajakan dan ketenagakerjaan Indonesia)
- Field `deletedAt` pada `employees` dan `employee_career_transactions` mengimplementasikan **soft delete** — data tetap ada di DB, tidak muncul di query normal

### 9.5 Career Transaction Atomik
- Setiap career transaction **tidak boleh partial** — jika update data employee gagal, insert career transaction juga dibatalkan
- Dijamin oleh `prisma.$transaction()` di [employee.repository.ts#L524](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/modules/employee/employee.repository.ts#L524)
- Snapshot `from*` fields di-ambil dari state employee **saat transaksi dibuat** — bukan saat efektif (future-date transaction perlu pertimbangan lebih lanjut)

### 9.6 Integritas Clearance
- `exit_clearances.resignationId` memiliki `onDelete: Cascade` ([schema.prisma#L2607](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/database/prisma/schema.prisma#L2607)) — jika resignation dibatalkan/dihapus, semua clearance items ikut terhapus
- Clearance boleh di-update status-nya berulang (PENDING → IN_PROGRESS → CLEARED), namun setelah CLEARED idealnya dikunci (validasi perlu ditambahkan di service layer)
- Seluruh final payroll baru boleh diproses setelah **semua exit clearance berstatus CLEARED** — validasi ini perlu diimplementasikan sebagai pre-condition di service

---

## 🎯 Section 10 — TL;DR: 7 Step Alur Terintegrasi

```
1. ONBOARD
   ┌─────────────────────────────────────────────────────────┐
   │ Recruitment HIRED → buat employee → generate N checklist│
   │ POST /onboarding/checklists × N (Equipment + Akses + Doc│
   │ PIC assigned per kategori, dueDate per item             │
   └─────────────────────────────────────────────────────────┘
              ↓ status: PENDING → IN_PROGRESS → DONE

2. PROBATION CHECKPOINT
   ┌─────────────────────────────────────────────────────────┐
   │ 30/60/90 hari → HR review → Day-90: semua DONE         │
   │ Trigger CareerTransaction (STATUS_CHANGE)               │
   │ PROBATION → PERMANENT + nomor SK pengangkatan           │
   └─────────────────────────────────────────────────────────┘
              ↓ career transaction: $transaction atomik

3. CAREER TRANSACTION (saat aktif bekerja)
   ┌─────────────────────────────────────────────────────────┐
   │ Promosi/Mutasi/Demosi → POST /employees/:id/career-txn  │
   │ Snapshot from* → update employee data (to*)            │
   │ referenceNumber = nomor SK, audit trail permanen        │
   └─────────────────────────────────────────────────────────┘
              ↓ employee.positionId/departmentId diperbarui

4. RESIGNATION SUBMIT
   ┌─────────────────────────────────────────────────────────┐
   │ Karyawan POST /onboarding/resignations                  │
   │ noticePeriodDays = 30 (min 14 PKWT)                    │
   │ Auto-generate 8 exit clearance items (IT×2, GA, Fin×2, │
   │ HR×3) → status semua PENDING                           │
   └─────────────────────────────────────────────────────────┘
              ↓ resignations.status: SUBMITTED

5. 4-STAGE EXIT CLEARANCE
   ┌─────────────────────────────────────────────────────────┐
   │ Stage 1 — HR: Approve resignation + exit interview     │
   │ Stage 2 — IT: Return laptop/aksesoris + revoke akses   │
   │ Stage 3 — GA: Return ID card + kunci + PIN             │
   │ Stage 4 — Finance: Settlement outstanding + calc final  │
   │ → PATCH /onboarding/clearances/:id per item            │
   │ → semua status: CLEARED                                 │
   └─────────────────────────────────────────────────────────┘
              ↓ resignations.status: APPROVED

6. FINAL PAYROLL
   ┌─────────────────────────────────────────────────────────┐
   │ Pro-rate gaji (hari kerja/total hari × gaji pokok)     │
   │ + Sisa cuti dibayar (jika kebijakan perusahaan)        │
   │ + Pesangon (HANYA jika PHK — per UU 13/2003 ps.156)   │
   │ - Outstanding travel advance (reconciled=false)         │
   │ - Sisa pinjaman karyawan                               │
   │ = Net final salary → transfer + slip gaji final        │
   └─────────────────────────────────────────────────────────┘
              ↓ resignations.status: COMPLETED

7. ARCHIVE & COMPLIANCE
   ┌─────────────────────────────────────────────────────────┐
   │ employees.deletedAt = now() (soft delete)              │
   │ PII dienkripsi → arsip 7 tahun                        │
   │ Paklaring + BPJS transfer letter diterbitkan           │
   │ Audit log lengkap di semua 6 entitas                   │
   │ user account dinonaktifkan                             │
   └─────────────────────────────────────────────────────────┘
              ✅ FLOW SELESAI. Data lengkap, audit ready.
```
