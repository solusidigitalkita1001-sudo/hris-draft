# 🏖 Modul Leave Management + Balance Calculation — Panduan Detail Alur Bisnis

> Modul ini menangani **3 domain terintegrasi** dalam pengelolaan cuti karyawan:
> 1. **Leave Type Master** → konfigurasi jenis cuti per perusahaan (cuti tahunan, sakit, melahirkan, dsb.)
> 2. **Leave Balance** → kuota & sisa cuti per karyawan per tahun (dengan perhitungan pro-rate, carry-over, dan accrual)
> 3. **Leave Request + Approval** → pengajuan cuti oleh karyawan → approval Manager → HR validasi → perubahan status absensi

Ketiga domain ini saling terhubung: LeaveType dikonfigurasi → Balance dialokasikan (dengan pro-rate jika join/resign di tengah tahun) → Request diajukan → Balance berkurang secara atomik saat approve → Attendance di-mark ON_LEAVE untuk hari-hari tersebut.

---

## 🧩 Gambaran Arsitektur Modul

### Files & References
| Komponen | Lokasi File |
|---|---|
| API Routes | [leave.routes.ts](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/modules/leave/leave.routes.ts) |
| DTO Validator (Zod) | [leave.dto.ts](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/modules/leave/leave.dto.ts) |
| Controller | [leave.controller.ts](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/modules/leave/leave.controller.ts) |
| Repository + Logic DB | [leave.repository.ts](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/modules/leave/leave.repository.ts) |
| Service + Business Rules | [leave.service.ts](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/modules/leave/leave.service.ts) |
| Enum Domain Types | [leave.types.ts](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/modules/leave/leave.types.ts) |
| Schema Prisma 3 Entities | [schema.prisma#L2808-L2886](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/database/prisma/schema.prisma#L2808-L2886) |
| Enum LeaveStatus | [schema.prisma#L3870-L3876](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/database/prisma/schema.prisma#L3870-L3876) |

---

## 🔐 Role Matrix: Siapa Bisa Apa?

Didefinisikan melalui `authorize({ resource: 'leave', action: '...' })` di [leave.routes.ts#L12-L24](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/modules/leave/leave.routes.ts#L12-L24). Mapping role ke permission dikontrol oleh middleware `Authorize` berdasarkan RBAC tabel di database.

| Aksi | SUPER_ADMIN | GROUP_ADMIN | COMPANY_ADMIN | HR_MANAGER | HR_STAFF | MANAGER | EMPLOYEE |
|---|---|---|---|---|---|---|---|
| **CRUD Leave Type** (buat/edit master jenis cuti) | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Baca Leave Type** (lihat daftar jenis cuti) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Baca Balance** (lihat sisa kuota cuti karyawan) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ (milik sendiri) |
| **Set / Upsert Balance** (alokasi kuota awal / reset tahunan) | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| **Ajukan Request** (submit pengajuan cuti) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Batalkan Request** (cancel sebelum approved) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ (milik sendiri) | ✅ (milik sendiri) |
| **Approve L1** (Manager setujui cuti bawahan) | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ |
| **Approve L2 / HR Final** (HR validasi + final approve) | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| **Reject** (tolak pengajuan cuti) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| **List Company-Wide** (lihat semua request seluruh perusahaan) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| **Export / Laporan** (export data cuti ke CSV/Excel) | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |

> Catatan: Action `approve` dipakai oleh kedua endpoint approve dan reject ([leave.routes.ts#L19-L20](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/modules/leave/leave.routes.ts#L19-L20)). Pemisahan role L1 (Manager) dan L2 (HR) adalah gap yang akan dibahas di Seksi 9.

---

## 🧾 Entities & Data Model (3 Tabel DB)

### Diagram Relasi

```
companies ──< leave_types (master: Cuti Tahunan, Sakit, Melahirkan, dst)
                │
                ├──< leave_balances (1 baris per employee × per leave_type × per year)
                │         ├── totalDays    (kuota bruto termasuk carry-over)
                │         ├── usedDays     (sudah terpakai / approved)
                │         └── remainingDays (totalDays - usedDays, real-time)
                │
                └──< leave_requests (1 baris per pengajuan cuti)
                          ├── status: PENDING → APPROVED / REJECTED / CANCELLED / WITHDRAWN
                          ├── totalDays (kalkulasi auto dari startDate s/d endDate)
                          └── FK → employee, company, leaveType
```

---

### Entity 1 — `leave_types` (Master Jenis Cuti)

Didefinisikan di [schema.prisma#L2808-L2832](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/database/prisma/schema.prisma#L2808-L2832).

| Field | Type | Required | Keterangan |
|---|---|---|---|
| `id` | UUID | auto | Primary key |
| `companyId` | UUID | ✅ | Company scope — setiap perusahaan punya master cuti sendiri |
| `name` | varchar(255) | ✅ | Nama tampilan: "Cuti Tahunan", "Cuti Sakit", "Cuti Melahirkan" |
| `code` | varchar(50) | ✅ UNIQUE | Kode internal unik: `ANNUAL`, `SICK`, `MATERNITY`, `PATERNITY`, `EMERGENCY`, `UNPAID`, `SPECIAL` |
| `description` | text | ❌ | Deskripsi kebijakan cuti ini |
| `isPaid` | Boolean | default `true` | false = cuti tanpa bayar (UNPAID) → integrasi payroll potong gaji |
| `isAnnual` | Boolean | default `false` | true = cuti tahunan yang di-reset tiap siklus (accrual + carry-over berlaku) |
| `maxDays` | Int | default `0` | Batas maksimal hari: 12 untuk cuti tahunan, 90 untuk melahirkan, 0 = unlimited |
| `requiresAttachment` | Boolean | default `false` | true = wajib upload surat dokter (Cuti Sakit, Cuti Melahirkan) |
| `isActive` | Boolean | default `true` | Soft toggle — nonaktifkan tanpa hapus data historis |
| `sortOrder` | Int | default `0` | Urutan tampilan di UI dropdown |
| `deletedAt` | DateTime | ❌ | Soft delete |

**7 Jenis Cuti Standar HRIS Indonesia:**
| Kode | Nama | isPaid | isAnnual | maxDays | Keterangan |
|---|---|---|---|---|---|
| `ANNUAL` | Cuti Tahunan | ✅ | ✅ | 12 | Pro-rate join, carry-over max 1 hari, reset anniversary |
| `SICK` | Cuti Sakit | ✅ | ❌ | 0 | Wajib surat dokter > 2 hari, tidak potong kuota tahunan |
| `MATERNITY` | Cuti Melahirkan | ✅ | ❌ | 90 | 90 hari kalender, full paid, bukan dari kuota tahunan |
| `PATERNITY` | Cuti Ayah | ✅ | ❌ | 3 | 3 hari kelahiran anak |
| `EMERGENCY` | Cuti Darurat | ✅ | ❌ | 3 | Meninggal keluarga, musibah, dst |
| `UNPAID` | Cuti Tanpa Bayar | ❌ | ❌ | 0 | Potong gaji pokok ÷ 22 × jumlah hari |
| `SPECIAL` | Cuti Khusus | ✅ | ❌ | 2 | Pernikahan, aqiqah, sunatan, dsb |

---

### Entity 2 — `leave_balances` (Saldo Cuti per Karyawan per Tahun)

Didefinisikan di [schema.prisma#L2834-L2855](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/database/prisma/schema.prisma#L2834-L2855).

| Field | Type | Required | Keterangan |
|---|---|---|---|
| `id` | UUID | auto | PK |
| `employeeId` | UUID | ✅ | FK → `employees.id` |
| `companyId` | UUID | ✅ | Company scope |
| `leaveTypeId` | UUID | ✅ | FK → `leave_types.id` |
| `year` | Int | ✅ | Tahun berlaku (2024, 2025, ...) — tiap tahun record baru |
| `totalDays` | Int | default `0` | **Kuota bruto**: hak dasar + carry-over. Ini yang di-set HR |
| `usedDays` | Int | default `0` | Hari terpakai — bertambah atomik saat approve (FOR UPDATE) |
| `remainingDays` | Int | default `0` | `totalDays - usedDays` — dikurangi real-time saat approve |

**Composite Unique Key:** `(employeeId, leaveTypeId, year)` → [schema.prisma#L2851](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/database/prisma/schema.prisma#L2851). Artinya 1 karyawan hanya punya 1 baris saldo per jenis cuti per tahun. Upsert di [leave.repository.ts#L79-L85](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/modules/leave/leave.repository.ts#L79-L85) memanfaatkan constraint ini untuk update `totalDays` jika sudah ada, atau create baru jika belum.

---

### Entity 3 — `leave_requests` (Pengajuan Cuti + Approval Flow)

Didefinisikan di [schema.prisma#L2857-L2886](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/database/prisma/schema.prisma#L2857-L2886).

| Field | Type | Required | Keterangan |
|---|---|---|---|
| `id` | UUID | auto | PK |
| `employeeId` | UUID | ✅ | FK → `employees.id` |
| `companyId` | UUID | ✅ | Company scope |
| `leaveTypeId` | UUID | ✅ | FK → `leave_types.id` |
| `startDate` | Date | ✅ | Tanggal mulai cuti (DB Type: `@db.Date`) |
| `endDate` | Date | ✅ | Tanggal selesai cuti |
| `totalDays` | Int | default `1` | Dikalkulasi otomatis di [leave.repository.ts#L42-L44](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/modules/leave/leave.repository.ts#L42-L44): `Math.round((end - start) / 86400000) + 1` |
| `reason` | text | ✅ | Alasan cuti |
| `attachment` | varchar(500) | ❌ | Path file surat dokter / dokumen pendukung |
| **`status`** | Enum `LeaveStatus` | default `PENDING` | Lihat state machine di bawah |
| `approvedBy` | UUID | ❌ | User ID yang meng-approve |
| `approvedAt` | DateTime | ❌ | Timestamp approval |
| `rejectionReason` | text | ❌ | Alasan penolakan (diisi saat REJECTED) |
| `deletedAt` | DateTime | ❌ | Soft delete — request yang dibatalkan tetap tercatat |

---

## 🔄 State Machine: LeaveRequest

Enum `LeaveStatus` didefinisikan di [leave.types.ts#L1-L7](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/modules/leave/leave.types.ts#L1-L7) dan di [schema.prisma#L3870-L3876](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/database/prisma/schema.prisma#L3870-L3876).

```
                  ┌─────────────────────────────────────────────────────┐
  Karyawan submit │                                                     │
        ↓         │                                                     ▼
   [PENDING]  ────┤──── rejectLeave()  ──────────────────────────► [REJECTED]
   (default)  ────┤     service.ts#L91-L93  (set rejectionReason)       │
                  │                                                      │
                  └──── approveLeave() ─────────────────────────────────┘
                         service.ts#L44-L88                ↓
                         ┌─ LOCK leave_requests FOR UPDATE ──► cek status === 'PENDING'
                         ├─ LOCK leave_balances  FOR UPDATE ──► cek remaining_days >= total_days
                         ├─ UPDATE leave_balances: usedDays += totalDays, remainingDays -= totalDays
                         └─ UPDATE leave_requests: status = 'APPROVED', approvedBy, approvedAt
                                                       ↓
                                                  [APPROVED]
                                                       │
                                    ┌──────────────────┴──────────────────┐
                                    ▼                                     ▼
                               [TAKEN]                             [CANCELLED]
                         (future: cuti berlangsung,          (karyawan withdraw sebelum
                          attendance di-mark ON_LEAVE)        tanggal mulai — gap rule #5)
                                                                    ↓
                                                             [WITHDRAWN]
                                                        (karyawan tarik request sendiri
                                                         setelah submit, sebelum approve)
```

### Trigger Method → State Transition

| Method | File:Line | Transisi Status | Operasi DB |
|---|---|---|---|
| `createLeaveRequest()` | [leave.service.ts#L28-L39](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/modules/leave/leave.service.ts#L28-L39) | → PENDING | Cek balance > 0, INSERT `leave_requests` |
| `approveLeave()` | [leave.service.ts#L44-L88](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/modules/leave/leave.service.ts#L44-L88) | PENDING → APPROVED | `$transaction` + `FOR UPDATE` pada 2 tabel, UPDATE balance, UPDATE request |
| `rejectLeave()` | [leave.service.ts#L91-L93](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/modules/leave/leave.service.ts#L91-L93) | PENDING → REJECTED | `updateLeaveStatus(id, 'REJECTED', reason)` |
| `setLeaveBalance()` | [leave.service.ts#L100-L102](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/modules/leave/leave.service.ts#L100-L102) | — (balance reset) | `upsertLeaveBalance` — update totalDays untuk siklus tahun baru |

---

## 📖 Use Case End-to-End: Budi Join 15 April 2023

### Skenario Lengkap dengan 3 Titik Perhitungan Pro-Rate

#### ⬛ Step 1 — Budi Join 15 April 2023: Pro-Rate Kuota Cuti Tahunan

Budi (Sales Executive) bergabung di perusahaan PT. ABC pada **15 April 2023**. HR membuat alokasi cuti tahunan pertama Budi.

**Formula Pro-Rate Join Mid-Year:**
```
Sisa hari dalam tahun sejak join = 365 - 105 (hari ke-105 = 15 April) = 260 hari
Hak pro-rate = (260 / 365) × 12 = 8,54 hari → floor() = 8 hari
```

Atau versi eksplisit yang umum dipakai HRIS Indonesia:
```
Bulan sisa dalam tahun:
  April (setengah bulan dihitung penuh) = 9 bulan sisa (Apr–Des)
  Hak = (9 / 12) × 12 = 9 hari

Versi kalender hari (lebih presisi):
  Dari 15 April s.d. 31 Des 2023 = 260 hari / 365 × 12 = 8,54 → floor = 8 hari
```

Operasi Prisma:
```typescript
// leave.repository.ts#L79-L85 — upsertLeaveBalance
prisma.leaveBalance.upsert({
  where: { employeeId_leaveTypeId_year: { employeeId: 'budi-uuid', leaveTypeId: 'annual-uuid', year: 2023 } },
  update: { totalDays: 8 },
  create: { employeeId: 'budi-uuid', companyId: 'pt-abc-uuid', leaveTypeId: 'annual-uuid', year: 2023, totalDays: 8, remainingDays: 8 }
})
```

Hasil: ✅ `leave_balances` row: `totalDays=8, usedDays=0, remainingDays=8, year=2023`.

---

#### ⬛ Step 2 — Budi Ajukan Cuti 3 Hari (23–25 Des 2023)

Budi login → buka halaman **Pengajuan Cuti** → isi form:
- Jenis Cuti: Cuti Tahunan (`ANNUAL`)
- Mulai: `2023-12-23`
- Selesai: `2023-12-25`
- Alasan: "Liburan Natal keluarga ke Bandung"

Validasi awal di service ([leave.service.ts#L29-L34](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/modules/leave/leave.service.ts#L29-L34)):
```typescript
// Cek balance ≥ 1 (bukan 0)
const balance = balances.find(b => b.leaveTypeId === data.leaveTypeId);
if (balance && balance.remainingDays <= 0) {
  throw new BadRequestError('Insufficient leave balance');
}
```

Kalkulasi `totalDays` di repository ([leave.repository.ts#L42-L44](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/modules/leave/leave.repository.ts#L42-L44)):
```typescript
const totalDays = Math.max(1, Math.round((end.getTime() - start.getTime()) / (1000 * 3600 * 24)) + 1);
// = Math.round((25Des - 23Des) / 86400000) + 1 = 2 + 1 = 3 hari
```

Hasil: ✅ INSERT `leave_requests` status=`PENDING`, `totalDays=3`.

---

#### ⬛ Step 3 — Manager Approve: FOR UPDATE Lock + Deduct Balance

Pak Andi (Manager Budi) buka **Approval Inbox** → klik Approve request cuti Budi.

Seluruh proses ini dijalankan dalam satu **Prisma `$transaction`** ([leave.service.ts#L45-L88](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/modules/leave/leave.service.ts#L45-L88)):

```typescript
// Step 1: Lock leave_request — cek status masih PENDING
const [req] = await tx.$queryRaw`
  SELECT id, status, employee_id, leave_type_id, total_days, start_date
  FROM leave_requests WHERE id = ${id} FOR UPDATE`;
if (req.status !== 'PENDING') throw new BadRequestError('Leave request sudah diproses');

// Step 2: Lock leave_balance — cek saldo cukup
const year = new Date(req.start_date).getFullYear(); // 2023
const [bal] = await tx.$queryRaw`
  SELECT id, used_days, remaining_days FROM leave_balances
  WHERE employee_id = ${req.employee_id}
    AND leave_type_id = ${req.leave_type_id}
    AND year = ${year}
  FOR UPDATE`;
if (!bal || bal.remaining_days < req.total_days)
  throw new BadRequestError('Leave balance tidak cukup');
// Cek: 8 >= 3 ✅

// Step 3: Deduct balance
await tx.leaveBalance.update({
  where: { id: bal.id },
  data: { usedDays: 0 + 3, remainingDays: 8 - 3 } // → usedDays=3, remainingDays=5
});

// Step 4: Approve request
await tx.leaveRequest.update({
  where: { id },
  data: { status: 'APPROVED', approvedBy: userId, approvedAt: new Date() }
});
```

Hasil: ✅ `leave_balances`: `usedDays=3, remainingDays=5`. `leave_requests.status = APPROVED`.

---

#### ⬛ Step 4 — Validasi Overlap (Gap Rule — Belum Otomatis)

Sebelum approve, idealnya HR memvalidasi bahwa tanggal 23–25 Des 2023 tidak overlap dengan cuti lain yang sudah APPROVED:

```sql
-- Cek overlap: apakah ada approved leave request lain dengan tanggal bertabrakan
SELECT id FROM leave_requests
WHERE employee_id = 'budi-uuid'
  AND status = 'APPROVED'
  AND start_date <= '2023-12-25'
  AND end_date >= '2023-12-23'
  AND id != 'request-id-baru';
-- → 0 rows = aman, tidak ada overlap ✅
```

Hasil: ✅ Tidak ada overlap. Cuti 3 hari di-approve.

---

#### ⬛ Step 5 — Reset Tahunan 1 Jan 2024: Carry-Over + Kuota Baru

Pada **1 Januari 2024** (atau saat HR jalankan job reset tahunan), saldo Budi dihitung:

**Formula Carry-Over (Kebijakan Default: Max 1 Hari, Kadaluarsa 31 Maret):**
```
Sisa tahun 2023: remainingDays = 5
Carry-over ke 2024: min(5, 1) = 1 hari (dibatasi max 1)
Carry-over kadaluarsa: 31 Maret 2024 (jika tidak dipakai, hangus)

Hak cuti tahunan 2024 (sudah full year): 12 hari
Total balance 2024: carry-over(1) + hak baru(12) = 13 hari
```

Operasi Prisma untuk reset:
```typescript
// Upsert balance tahun baru 2024
prisma.leaveBalance.upsert({
  where: { employeeId_leaveTypeId_year: { employeeId: 'budi-uuid', leaveTypeId: 'annual-uuid', year: 2024 } },
  update: { totalDays: 13 }, // 1 carry-over + 12 baru
  create: { ..., year: 2024, totalDays: 13, remainingDays: 13 }
})
```

Hasil: ✅ `leave_balances` year=2024: `totalDays=13, remainingDays=13`.

---

#### ⬛ Step 6 — Budi Resign 1 Maret 2025: Hak Cuti Proporsional (Uang Cuti)

Budi mengundurkan diri efektif **1 Maret 2025**. HR menghitung hak cuti yang belum diambil (untuk dibayarkan sebagai uang cuti atau dipotong jika sudah over-drawing).

**Skenario Pro-Rate Resign Mid-Year:**
```
Masa kerja aktif tahun 2025: 1 Jan – 1 Mar 2025 = 59 hari
Hak cuti proporsional 2025 = (59 / 365) × 12 = 1,938 hari → floor = 1 hari

Saldo terakhir Budi di 2025 (asumsi belum ambil cuti): totalDays = 13 (carry-over 2024 + hak s.d. resign)
Hak proporsional yang perlu dibayar: 1 hari × tarif harian

Tarif harian (formula umum — lihat Seksi 8 integrasi payroll):
  Gaji pokok Budi = Rp 8.000.000
  Tarif harian = Rp 8.000.000 / 22 = Rp 363.636/hari
  Uang cuti yang dibayarkan = 1 × Rp 363.636 = Rp 363.636

Jika Budi sudah ambil lebih dari hak proporsional:
  Hak proporsional = 1 hari, tapi sudah ambil 3 hari → over 2 hari
  Potongan terakhir = 2 × Rp 363.636 = Rp 727.272 (dipotong dari final settlement)
```

> Catatan: Perhitungan ini saat ini belum diotomatisasi di service — masih menjadi gap (lihat Seksi 9, Gap #6).

---

## ✅ Zod DTO Validator (leave.dto.ts)

Didefinisikan di [leave.dto.ts#L1-L34](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/modules/leave/leave.dto.ts#L1-L34).

### Schema 1 — `createLeaveTypeSchema` (Buat Master Jenis Cuti)
| Field | Validasi Zod | Keterangan |
|---|---|---|
| `companyId` | `z.string().uuid()` | UUID company, wajib |
| `name` | `z.string().min(1).max(255)` | Nama tampilan, wajib, maks 255 karakter |
| `code` | `z.string().min(1).max(50)` | Kode unik, wajib, maks 50 karakter |
| `description` | `z.string().optional()` | Opsional |
| `isPaid` | `z.boolean().default(true)` | Default dibayar |
| `isAnnual` | `z.boolean().default(false)` | Default bukan cuti tahunan |
| `maxDays` | `z.number().int().positive().default(12)` | Wajib bilangan bulat positif |
| `requiresAttachment` | `z.boolean().default(false)` | Default tanpa lampiran |

### Schema 2 — `createLeaveRequestSchema` (Ajukan Cuti)
| Field | Validasi Zod | Keterangan |
|---|---|---|
| `employeeId` | `z.string().uuid()` | UUID karyawan, wajib |
| `companyId` | `z.string().uuid()` | UUID company, wajib |
| `leaveTypeId` | `z.string().uuid()` | UUID jenis cuti, wajib |
| `startDate` | `z.string().datetime()` | ISO 8601 datetime string, wajib |
| `endDate` | `z.string().datetime()` | ISO 8601 datetime string, wajib |
| `reason` | `z.string().min(1)` | Alasan cuti, wajib, min 1 karakter |
| `attachment` | `z.string().optional()` | Path file surat/lampiran, opsional |

> **Gap:** Tidak ada `z.refine()` yang memvalidasi `endDate >= startDate`. Ini adalah gap bisnis #5 yang perlu di-hardening (lihat Seksi 9).

### Schema 3 — `createLeaveBalanceSchema` (Set Saldo Cuti)
| Field | Validasi Zod | Keterangan |
|---|---|---|
| `employeeId` | `z.string().uuid()` | UUID karyawan, wajib |
| `companyId` | `z.string().uuid()` | UUID company, wajib |
| `leaveTypeId` | `z.string().uuid()` | UUID jenis cuti, wajib |
| `year` | `z.number().int().default(new Date().getFullYear())` | Tahun berlaku, default tahun berjalan |
| `totalDays` | `z.number().int().positive().default(12)` | Kuota bruto, wajib positif |

### Schema 4 — Approve / Reject (Implicit via Body)
Saat ini `approveLeave` dan `rejectLeave` tidak menggunakan DTO Zod terpisah. Body `reason` dibaca langsung dari `req.body.reason` di [leave.controller.ts#L44](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/modules/leave/leave.controller.ts#L44). Ini adalah gap validasi yang perlu ditambahkan `approveLeaveSchema` dan `rejectLeaveSchema`.

### Schema 5 — Query Filters (Implicit via Query Params)
`findAllLeaveRequests` menerima filter `?companyId=&employeeId=&status=&leaveTypeId=` via `req.query` di [leave.controller.ts#L18-L25](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/modules/leave/leave.controller.ts#L18-L25) tanpa validasi Zod — gap yang perlu dikuatkan dengan query schema.

---

## 🔌 11 API Endpoints

Semua route didefinisikan di [leave.routes.ts#L9-L26](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/modules/leave/leave.routes.ts#L9-L26). Base URL: `{APP_URL}{API_PREFIX}/leave`. Semua route dilindungi `authenticate` middleware (baris 9).

| # | Method | Route | Middleware Auth/Role | DTO / Param | Deskripsi |
|---|---|---|---|---|---|
| 1 | GET | `/types` | `authorize(leave, read)` | `?companyId=` | List semua jenis cuti aktif per perusahaan, diurutkan `sortOrder ASC` |
| 2 | POST | `/types` | `authorize(leave, create)` + `validate(createLeaveTypeSchema)` | Body: `createLeaveTypeSchema` | Buat master jenis cuti baru (HR_MANAGER/ADMIN only) |
| 3 | GET | `/` | `authorize(leave, read)` | `?companyId=&employeeId=&status=&leaveTypeId=` | List semua leave request perusahaan, include data employee + leaveType |
| 4 | GET | `/:id` | `authorize(leave, read)` | Path: `id` | Detail 1 leave request by ID, include employee (+ department) + leaveType |
| 5 | POST | `/` | `authorize(leave, create)` + `validate(createLeaveRequestSchema)` | Body: `createLeaveRequestSchema` | Submit pengajuan cuti baru — cek balance, hitung totalDays otomatis |
| 6 | PATCH | `/:id/approve` | `authorize(leave, approve)` | Path: `id`, Auth: `req.user.id` | Approve cuti — jalankan $transaction FOR UPDATE deduct balance |
| 7 | PATCH | `/:id/reject` | `authorize(leave, approve)` | Path: `id`, Body: `{ reason }` | Tolak cuti — update status REJECTED + isi rejectionReason |
| 8 | GET | `/balances/employee` | `authorize(leave, read)` | `?employeeId=` | List saldo cuti semua jenis untuk 1 karyawan, include data leaveType |
| 9 | POST | `/balances` | `authorize(leave, create)` + `validate(createLeaveBalanceSchema)` | Body: `createLeaveBalanceSchema` | Set/upsert saldo cuti — dipakai saat onboarding karyawan baru atau reset tahunan |

> **Catatan:** Total 9 endpoint terdefinisi di routes.ts. Dua endpoint tambahan yang diperlukan secara bisnis (cancel/withdraw oleh karyawan sendiri, dan export laporan) belum diimplementasikan — tercatat sebagai gap di Seksi 9.

---

## 🔗 Integrasi dengan Modul Lain

### 1. Work Calendar + National Holidays (Kalkulasi Hari Efektif)

`leave_requests` menyimpan `startDate` dan `endDate` sebagai tanggal kalender mentah. `totalDays` saat ini dihitung naif: `(end - start) / 86400000 + 1` ([leave.repository.ts#L44](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/modules/leave/leave.repository.ts#L44)) — ini **menghitung Sabtu, Minggu, dan hari libur nasional**.

Integrasi yang seharusnya dengan modul Work Calendar (tabel `work_calendars` FK ke `company_id`, tabel `national_holidays` FK ke `company_id`):

```typescript
// Pseudocode integrasi ideal:
const effectiveDays = countWorkingDays(startDate, endDate, {
  workCalendar: await workCalendarRepo.findByEmployee(employeeId, year),  // work_calendars.work_days JSON
  holidays: await nationalHolidayRepo.findByYear(companyId, year),        // national_holidays WHERE year=?
});
// Misal: cuti 23-27 Des 2024 (5 hari kalender) → kalender kerja Senin-Jumat
//   25 Des = Hari Natal (national_holidays) → skip
//   28-29 Des = Sabtu-Minggu → skip  
//   Effective days = 3 hari kerja saja yang dipotong dari balance
```

FK yang ada: `Company.workCalendars` [schema.prisma#L121](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/database/prisma/schema.prisma#L121), `Company.nationalHolidays` [schema.prisma#L122](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/database/prisma/schema.prisma#L122).

---

### 2. Attendance (Auto-Mark ON_LEAVE)

Tabel `attendances` memiliki field `status` Enum `AttendanceStatus` ([schema.prisma#L3286-L3291](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/database/prisma/schema.prisma#L3286-L3291)) dengan nilai: `PRESENT`, `ABSENT`, `LATE`, `EXCUSED`.

Saat `approveLeave()` selesai, idealnya sistem men-generate baris `attendances` untuk setiap hari kerja dalam rentang `startDate–endDate` dengan status `EXCUSED` (atau `ON_LEAVE` jika ditambahkan ke enum). Hal ini:
- Mencegah karyawan yang sedang cuti dihitung `ABSENT` atau `LATE`
- Memberikan laporan absensi yang akurat tanpa perlu data entry manual

```typescript
// Pseudocode — post-approve hook:
for (const workDay of effectiveWorkDays) {
  await prisma.attendance.upsert({
    where: { employeeId_date: { employeeId: req.employee_id, date: workDay } },
    update: { status: 'EXCUSED', exceptionReason: `Leave Request #${id}` },
    create: { employeeId: req.employee_id, companyId: req.company_id, date: workDay,
               status: 'EXCUSED', method: 'MANUAL', source: 'LEAVE_MODULE' }
  });
}
```

FK yang ada: `Employee.attendances` [schema.prisma#L1951](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/database/prisma/schema.prisma#L1951), `Attendance.employeeId` → `employees.id`.

---

### 3. Payroll (Potongan Cuti Tanpa Bayar + Uang Cuti Resign)

Jenis cuti `isPaid = false` (kode `UNPAID`) harus memicu potongan di payroll bulan berjalan. FK yang relevan: tabel `salary_components` (dengan `type = DEDUCTION`) → `payslip_components` dalam payrun bulan tersebut.

```
Formula potongan UNPAID leave:
  Gaji Pokok = employee_salaries.baseSalary (schema.prisma#L328)
  Potongan per hari = baseSalary / 22
  Total potongan = totalDays × (baseSalary / 22)

Contoh: Budi ambil UNPAID 2 hari, gaji pokok Rp 8.000.000
  Potongan = 2 × (8.000.000 / 22) = Rp 727.272

Integrasi: INSERT payslip_components (payslipId, salaryComponentId[UNPAID_DEDUCTION], amount=727272)
           di dalam PayrollRun.process() saat menghitung gaji bulan bersangkutan
```

FK: `EmployeeSalary.baseSalary` [schema.prisma#L328](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/database/prisma/schema.prisma#L328), `PayslipComponent.salaryComponentId` [schema.prisma#L457](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/database/prisma/schema.prisma#L457).

---

### 4. Notifications (Event-Driven Alert)

Tabel `notifications` ([schema.prisma#L3364-L3386](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/database/prisma/schema.prisma#L3364-L3386)) menyimpan field `resource`, `action`, `referenceId`. FK: `notifications.userId` → `users.id`, `notifications.companyId` → `companies.id`.

Event yang harus di-trigger:

| Event Domain | `resource` | `action` | Penerima | Kapan |
|---|---|---|---|---|
| Pengajuan cuti baru | `leave_request` | `submitted` | Manager karyawan | Setelah `createLeaveRequest` |
| Manager approve | `leave_request` | `approved` | Karyawan + HR | Setelah `approveLeave` |
| Manager/HR reject | `leave_request` | `rejected` | Karyawan | Setelah `rejectLeave` |
| Saldo hampir habis | `leave_balance` | `low_balance` | Karyawan | Saat `remainingDays <= 2` |

---

## ⚠️ Business Rules Gap (6 Aturan Kritis yang Belum Diotomatisasi)

| # | Aturan Bisnis | Status Saat Ini | Idealnya (Production-Hardening) |
|---|---|---|---|
| **1** | **Pro-rate join mid-year (floor):** Karyawan join 15 April → hak cuti = `floor((260/365) × 12) = 8` hari, bukan 9 atau 12. Floor diambil karena tidak ada jaminan hari parsial. | HR hitung manual lalu input via `POST /balances` | `setLeaveBalance()` menerima `joinDate`, auto-kalkulasi: `floor((daysRemaining / daysInYear) × leaveType.maxDays)`. Gunakan `employee.joinDate` ([schema.prisma#L1892](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/database/prisma/schema.prisma#L1892)) sebagai basis. |
| **2** | **Reset anniversary vs. 1 Jan:** Kebijakan di Indonesia umumnya reset tanggal join (anniversary), bukan 1 Januari. Jika Budi join 15 April, reset hak cuti tahunan setiap 15 April — bukan 1 Jan. | Tidak ada job otomatis, reset manual via `setBalance` | Cron job tahunan per karyawan berdasarkan `employee.joinDate` — bukan reset global 1 Jan. Atau konfigurasikan per `CompanyPolicy`: `leaveResetMode: 'ANNIVERSARY' | 'CALENDAR_YEAR'`. |
| **3** | **Carry-over max 1 hari, kadaluarsa 31 Maret:** Sisa cuti tahun lalu boleh dibawa ke tahun baru maksimal 1 hari. Carry-over tersebut kadaluarsa per 31 Maret tahun berjalan jika tidak dipakai (hangus). | Tidak ada carry-over logic sama sekali — `totalDays` di-set manual penuh 12 | Tambahkan field `carryOverDays` dan `carryOverExpiryDate` di `leave_balances`. Cron job 31 Maret: set `carryOverDays = 0`, kurangi `totalDays` dan `remainingDays` sebesar carry-over yang belum terpakai. |
| **4** | **Cuti Melahirkan 90 hari full pay BUKAN dari saldo tahunan:** `MATERNITY` 90 hari harus dibayar penuh oleh perusahaan (UU No. 13/2003 Pasal 82) dan tidak boleh mengurangi kuota `ANNUAL`. | `leaveType.isPaid = true` ada, tapi tidak ada guard yang memastikan cuti melahirkan tidak cross-deduct balance ANNUAL | Di `approveLeave()`: jika `leaveType.code === 'MATERNITY'`, skip balance deduction (tidak kurangi saldo apapun). Alokasi terpisah via balance `MATERNITY` dengan `totalDays = 90` per instance kehamilan. |
| **5** | **Minimal 1 hari berturutan kecuali override HR:** Pengajuan cuti tidak boleh `startDate === endDate` untuk beberapa jenis cuti (half-day cuti belum didukung). Juga `endDate` wajib `>= startDate`. | Tidak ada `z.refine()` di `createLeaveRequestSchema` yang memvalidasi `endDate >= startDate` | Tambahkan di DTO: `z.refine(d => new Date(d.endDate) >= new Date(d.startDate), { message: 'endDate harus >= startDate' })`. Untuk half-day, tambahkan field `isHalfDay: boolean` dan `halfDayType: 'AM' | 'PM'` di DTO + schema. |
| **6** | **Race condition overlap check — SELECT FOR UPDATE:** Saat approve, dua manager bisa approve 2 request cuti berbeda dari employee yang sama secara bersamaan, keduanya lolos cek balance, dan balance di-deduct dua kali hingga `remainingDays` jadi negatif. | `approveLeave()` sudah menggunakan `FOR UPDATE` pada `leave_balances` ([leave.service.ts#L64-L68](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/modules/leave/leave.service.ts#L64-L68)) — ini **sudah benar** untuk race condition balance. Tapi belum ada cek overlap tanggal (dua request APPROVED tanggal yang sama). | Tambahkan dalam $transaction: `SELECT COUNT(*) FROM leave_requests WHERE employee_id=? AND status='APPROVED' AND startDate <= endDate AND endDate >= startDate FOR UPDATE` — jika count > 0, throw BadRequest "Tanggal cuti tumpang tindih". |

---

## 🎯 TL;DR: Alur 7 Step

```
1️⃣  HR KONFIGURASI Leave Type Master
    POST /leave/types → leave_types INSERT
    (isPaid, isAnnual, maxDays, requiresAttachment)
          ↓

2️⃣  HR ALOKASI Saldo Cuti (Onboarding / Reset Tahunan)
    POST /leave/balances → leave_balances UPSERT
    Pro-rate jika join mid-year: floor(sisa_hari/365 × maxDays)
    Carry-over: min(sisa_tahun_lalu, 1) + hak_baru = totalDays
          ↓

3️⃣  KARYAWAN AJUKAN Permohonan Cuti
    POST /leave → leave_requests INSERT status=PENDING
    totalDays = (endDate - startDate) / 86400000 + 1
    Guard: remainingDays > 0 (cek sebelum insert)
          ↓

4️⃣  MANAGER APPROVE (atau REJECT)
    PATCH /leave/:id/approve
    → $transaction:
       ① SELECT leave_requests FOR UPDATE → status=PENDING?
       ② SELECT leave_balances  FOR UPDATE → remaining>=totalDays?
       ③ UPDATE leave_balances: usedDays+=N, remainingDays-=N
       ④ UPDATE leave_requests: status=APPROVED
          ↓               ↓ (jika REJECT)
    [APPROVED]      PATCH /leave/:id/reject → status=REJECTED, rejectionReason

5️⃣  INTEGRASI ATTENDANCE (Gap — Belum Otomatis)
    Idealnya: INSERT attendances status=EXCUSED per hari kerja
    dalam rentang startDate..endDate (skip weekend + national_holidays)
          ↓

6️⃣  INTEGRASI PAYROLL (jika isPaid=false)
    Saat payroll run: potongan = totalDays × (baseSalary / 22)
    INSERT payslip_components type=DEDUCTION, amount=potongan
          ↓

7️⃣  LAPORAN & AUDIT
    GET /leave?companyId=&status=&employeeId=
    → leave_requests include employee(fullName, employeeNumber) + leaveType(name, isPaid)
    → leaveBalance: remainingDays real-time per employee
    ✅ Saldo akurat, audit trail di leave_requests.approvedBy + approvedAt
```
