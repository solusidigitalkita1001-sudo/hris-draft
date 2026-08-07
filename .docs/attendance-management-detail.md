# ⏱ Modul Attendance Management — Panduan Detail Alur Bisnis

> Modul ini menangani **3 proses bisnis terintegrasi** dalam pengelolaan kehadiran karyawan:
> 1. **Clock In / Clock Out GPS + Fingerprint** → pencatatan kehadiran harian dengan evaluasi lokasi dan jadwal
> 2. **Shift Formula & Shift Swap** → definisi jadwal rotasi pabrik + mekanisme tukar shift antar karyawan
> 3. **Overtime Request** → pengajuan, approval, dan formula perhitungan lembur sesuai UU Ketenagakerjaan

Ketiga proses ini saling terhubung: Context attendance di-resolve dari ShiftFormula → Attendance dicreate dengan evaluasi GPS + late detection → Overtime di-ajukan jika melampaui jam kerja → Payroll modul mengambil data OT + potongan keterlambatan → Slip gaji final.

---

## 📌 1. Overview & References

### Files & References
| Komponen | Lokasi File |
|---|---|
| API Routes (13 endpoint) | [attendance.routes.ts](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/modules/attendance/attendance.routes.ts#L1-L34) |
| DTO Validator (Zod) | [attendance.dto.ts](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/modules/attendance/attendance.dto.ts#L1-L93) |
| Controller | [attendance.controller.ts](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/modules/attendance/attendance.controller.ts#L1-L103) |
| Service (business logic) | [attendance.service.ts](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/modules/attendance/attendance.service.ts#L1-L459) |
| Repository (Prisma queries) | [attendance.repository.ts](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/modules/attendance/attendance.repository.ts#L1-L255) |
| Context Resolver (jadwal + policy) | [attendance-context.service.ts](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/modules/attendance/attendance-context.service.ts#L1-L214) |
| Types/Enums lokal | [attendance.types.ts](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/modules/attendance/attendance.types.ts#L1-L14) |
| Schema Prisma 7 Entities | [schema.prisma#L2691-L2802](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/database/prisma/schema.prisma#L2691-L2802) |

### 7 Entitas Utama
1. `attendances` — rekaman kehadiran harian per karyawan
2. `branch_attendance_policies` — kebijakan absensi per branch (GPS radius, metode, toleransi)
3. `shift_formulas` — definisi formula shift rotasi (pabrik / factory)
4. `shift_formula_days` — hari-hari dalam satu siklus shift formula
5. `employee_shift_overrides` — override jadwal harian karyawan hasil swap atau manual
6. `shift_swap_requests` — permohonan tukar shift antar karyawan
7. `overtime_requests` — permohonan lembur + status approval + multiplier

---

## 🔐 2. Role Matrix: Siapa Bisa Apa?

Otorisasi menggunakan middleware `authorize({ resource: 'attendance', action })` yang didefinisikan di [attendance.routes.ts#L18-L32](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/modules/attendance/attendance.routes.ts#L18-L32). Mapping role ke action dikendalikan oleh RBAC engine.

| Aksi | SUPER_ADMIN | GROUP_ADMIN | COMPANY_ADMIN | HR_MANAGER | HR_STAFF | MANAGER | EMPLOYEE |
|---|---|---|---|---|---|---|---|
| **Clock In** (create attendance) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Clock Out** (patch/:id/checkout) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Import Mesin CSV** (via report/create manual) | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| **Shift CRUD per Company** (shift_formulas) | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Swap Request** (ajukan shift swap) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Approve Shift Swap** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| **Attendance Edit / Koreksi Admin** (correction) | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| **Export Rekap Bulanan** (report CSV) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| **Policy Per Branch** (branch_attendance_policies) | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Lihat Summary Kehadiran** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| **Lihat Attendance Sendiri** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Ajukan Overtime** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Approve Overtime** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| **Hapus Record Attendance** | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |

---

## 🧾 3. 7 Entities & Data Model

### Diagram Relasi
```
companies ──< branches
               │
               ├──── branch_attendance_policies (1 branch → 1 policy GPS/method/toleransi)
               │              │
               │              └──< attendances (setiap clock-in menempel policySnapshot)
               │
companies ──< shift_formulas ──< shift_formula_days (siklus rotasi shift)
               │
employees ──< employee_shift_overrides (override jadwal 1 hari, sumber: SHIFT_SWAP)
               │
shift_swap_requests (requester ↔ target ↔ approver) ──< employee_shift_overrides
               │
employees ──< overtime_requests (per karyawan, per tanggal, status PENDING/APPROVED)
```

### Entity 1 — `attendances` ([schema.prisma#L2691-L2740](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/database/prisma/schema.prisma#L2691-L2740))
| Field | Type | Keterangan |
|---|---|---|
| `id` | UUID | Primary key |
| `employeeId` | UUID | FK ke `employees.id` |
| `companyId` | UUID | Company scope |
| `branchId` | UUID? | FK ke `branches.id` — ditentukan dari career transaction terbaru |
| `attendancePolicyId` | UUID? | FK ke `branch_attendance_policies.id` — di-set saat create |
| `resolvedCalendarId` | UUID? | FK ke work calendar yang dipakai resolve jadwal |
| `date` | Date | Tanggal kehadiran (unique per employeeId+date) |
| `checkIn` | DateTime? | Timestamp clock in |
| `checkOut` | DateTime? | Timestamp clock out (diisi via PATCH /:id/checkout) |
| `method` | Enum `AttendanceCaptureMethod` | `FINGERPRINT` / `MOBILE_GPS` / `MANUAL` |
| `checkInLatitude/Longitude` | Float? | Koordinat GPS saat clock in |
| `checkOutLatitude/Longitude` | Float? | Koordinat GPS saat clock out |
| `distanceMeters` | Int? | Jarak dari titik branch (haversine formula) |
| `isWithinRadius` | Boolean? | true = dalam radius GPS yang dikonfigurasi policy |
| `status` | Enum `AttendanceStatus` | `PRESENT` / `ABSENT` / `LATE` / `EXCUSED` |
| `workDuration` | Int? | Total menit kerja (checkOut - checkIn) |
| `lateMinutes` | Int? | Menit terlambat dari scheduled workStart + toleransi |
| `earlyLeaveMinutes` | Int? | Menit pulang lebih cepat dari scheduled workEnd |
| `scheduledWorkStart/End` | VarChar(5)? | Jam jadwal ("08:00", "23:00") dari ShiftFormula atau WorkCalendar |
| `isException` | Boolean | true = ada anomali (di luar radius, OFF_DAY, dll.) |
| `exceptionType` | Enum `AttendanceExceptionType`? | `OUT_OF_RADIUS` / `OFF_DAY_ATTENDANCE` / `MISSING_POLICY` / `MISSING_GPS` / `METHOD_NOT_ALLOWED` / `INVALID_BRANCH_CONTEXT` |
| `requiresReview` | Boolean | Flag untuk antrian review HR |
| `policySnapshot` | Json? | Snapshot lengkap policy + schedule saat create (immutable audit) |

### Entity 2 — `branch_attendance_policies` ([schema.prisma#L2742-L2774](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/database/prisma/schema.prisma#L2742-L2774))
| Field | Type | Keterangan |
|---|---|---|
| `attendanceMethod` | Enum `AttendancePolicyMethod` | `FINGERPRINT` / `MOBILE_GPS` / `BOTH` / `MANUAL` |
| `gpsLatitude/Longitude` | Float? | Titik pusat GPS office/pabrik |
| `gpsRadiusMeters` | Int? | Radius yang diizinkan (contoh: 100 meter) |
| `allowOutsideRadius` | Boolean | false = REJECT langsung; true = lihat `outsideRadiusAction` |
| `outsideRadiusAction` | Enum `OutsideRadiusAction` | `REJECT` / `FLAG` / `REVIEW` |
| `lateToleranceMinutes` | Int | Toleransi keterlambatan dalam menit (default 0) |
| `earlyCheckoutToleranceMinutes` | Int | Toleransi pulang cepat (default 0) |
| `allowHolidayAttendance` | Boolean | Apakah boleh clock in di hari libur nasional |
| `allowWeekendAttendance` | Boolean | Apakah boleh clock in di hari Minggu/WE |
| `autoAbsentEnabled` | Boolean | Jika jam kerja berlalu tanpa clock in → otomatis ABSENT |
| `autoCheckoutEnabled` | Boolean | Auto clock out di jam akhir shift |
| `requiresSelfie` | Boolean | Wajib selfie saat clock in (untuk integrasi face recognition) |
| `requiresLocation` | Boolean | Wajib kirim GPS meskipun method FINGERPRINT |

### Entity 3 — `shift_formulas` ([schema.prisma#L1730-L1750](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/database/prisma/schema.prisma#L1730-L1750))
| Field | Type | Keterangan |
|---|---|---|
| `code` | VarChar(50) | Kode unik per company (contoh: `SHIFT-3M-PABRIK`) |
| `name` | VarChar(150) | Nama formula (contoh: "Shift 3 Malam Pabrik Cikarang") |
| `cycleLength` | Int | Panjang siklus dalam hari (contoh: 7 untuk Senin-Minggu) |
| `isActive` | Boolean | Soft-toggle aktif/nonaktif |

### Entity 4 — `shift_formula_days` ([schema.prisma#L1752-L1768](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/database/prisma/schema.prisma#L1752-L1768))
| Field | Type | Keterangan |
|---|---|---|
| `sequence` | Int | Urutan dalam siklus (1 = hari pertama, unique per formula) |
| `dayType` | VarChar(2) | Kode tipe hari: `WD` (working day), `WE` (weekend), `NH` (national holiday), `OF` (off) |
| `workStart` | VarChar(5)? | Jam mulai kerja: `"23:00"` untuk shift malam |
| `workEnd` | VarChar(5)? | Jam selesai kerja: `"07:00"` (lintas tengah malam) |
| `crossesMidnight` | Boolean | true = shift lintas tengah malam (23:00-07:00) |

### Entity 5 — `employee_shift_overrides` ([schema.prisma#L1800-L1823](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/database/prisma/schema.prisma#L1800-L1823))
| Field | Type | Keterangan |
|---|---|---|
| `employeeId` | UUID | Karyawan yang jadwalnya di-override |
| `shiftSwapRequestId` | UUID? | FK ke `shift_swap_requests.id` — null jika override manual admin |
| `date` | Date | Tanggal spesifik yang di-override (unique per employeeId+date) |
| `source` | VarChar(50) | Default `"SHIFT_SWAP"` — bisa juga `"ADMIN"` |
| `originalSchedule` | Json | Snapshot jadwal asli sebelum swap |
| `overrideSchedule` | Json | Jadwal baru hasil swap (format `ResolvedEmployeeDaySchedule`) |

### Entity 6 — `shift_swap_requests` ([schema.prisma#L1770-L1797](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/database/prisma/schema.prisma#L1770-L1797))
| Field | Type | Keterangan |
|---|---|---|
| `requesterEmployeeId` | UUID | Karyawan yang mengajukan tukar shift |
| `targetEmployeeId` | UUID | Karyawan yang diajak tukar |
| `approverEmployeeId` | UUID | Manager / HR yang akan approve |
| `shiftDate` | Date | Tanggal shift yang akan ditukar |
| `reason` | Text | Alasan tukar shift |
| `status` | Enum `RequestStatus` | `PENDING` / `APPROVED` / `REJECTED` / `CANCELLED` |
| `approvalNotes` | Text? | Catatan dari approver |
| `reviewedAt` | DateTime? | Timestamp saat di-review |

### Entity 7 — `overtime_requests` ([schema.prisma#L2777-L2802](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/database/prisma/schema.prisma#L2777-L2802))
| Field | Type | Keterangan |
|---|---|---|
| `date` | Date | Tanggal lembur |
| `startTime` / `endTime` | DateTime | Waktu mulai dan selesai lembur |
| `durationHours` | Decimal(5,2) | Total jam lembur yang diajukan |
| `reason` | Text | Alasan lembur |
| `multiplier` | Decimal(3,1) | Default `1.5` — bisa di-override: 2.0 untuk hari libur |
| `status` | Enum `OvertimeStatus` | `PENDING` / `APPROVED` / `REJECTED` / `CANCELLED` |
| `approvedBy` | VarChar(36)? | User ID yang approve (diisi via `approveOvertime`) |
| `approvedAt` | DateTime? | Timestamp approval |

---

## 🔄 4. State Machine

### State Machine Attendance
```
[CREATE via POST /attendance]
         │
         ▼
   Resolve context:
   ShiftFormula? → overrideSchedule? → WorkCalendar?
         │
         ▼
   Check checkIn vs scheduledWorkStart + lateToleranceMinutes
         │
         ├─── checkIn ≤ scheduledStart + toleransi  ──→  PRESENT
         │     (service.ts#L253-L260)
         │
         ├─── checkIn > scheduledStart + toleransi  ──→  LATE
         │     lateMinutes = checkIn - scheduledStart (dalam menit)
         │
         ├─── schedule.isWorkingDay = false ──────────→  (blocker: BadRequestError)
         │     kecuali allowWeekendAttendance / allowHolidayAttendance = true
         │
         └─── tanpa checkIn, status = ABSENT ────────→  ABSENT
               (bulk auto-absent by cron / import)

[PATCH /:id/checkout]
         │
         ▼
   Hitung earlyLeaveMinutes = scheduledEnd - checkOut (jika < toleransi)
   Hitung workDuration = checkOut - checkIn (menit)
         │
         ├─── earlyLeaveMinutes > 0  ──→  status tetap (PRESENT/LATE) + flag earlyLeave
         │
         └─── earlyLeaveMinutes = 0  ──→  status tetap, workDuration normal

[PATCH /:id/correction] — koreksi manual admin (service.ts#L409-L413)
         │
         └─── dapat set status = EXCUSED (izin) / ABSENT / PRESENT
```

**Status Override Eksternal:**
| Status Logis | Trigger |
|---|---|
| `EXCUSED` | Admin koreksi via `correction()` / Leave approved → manual sync |
| `ABSENT` | Auto-absent cron / import mesin fingerprint tanpa record |
| `LATE` | service.ts#L258-L261: `checkIn > toleratedStart` |
| `PRESENT` | Default jika checkIn dalam toleransi |

### State Machine ShiftSwap ([schema.prisma#L1770-L1797](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/database/prisma/schema.prisma#L1770-L1797))
```
[POST shift_swap_requests]
         │
         ▼
      PENDING  (status default, menunggu review approver)
         │
         ├─── approveShiftSwap()  ──→  APPROVED
         │     Efek: INSERT 2 rows ke employee_shift_overrides
         │       - requester: date = shiftDate, overrideSchedule = jadwal target
         │       - target: date = shiftDate, overrideSchedule = jadwal requester
         │       (shiftSwapRequestId diisi ke kedua override rows)
         │
         ├─── rejectShiftSwap()   ──→  REJECTED
         │     Tidak ada override dibuat
         │
         └─── cancelSwap()        ──→  CANCELLED
               (requester cancel sebelum di-review)

[Saat clock in pada shiftDate yang sudah di-approve]
         │
         ▼
   attendance-context.service.ts#L174:
   findEmployeeShiftOverrideSchedule(employeeId, date)
   → override ditemukan (source='SHIFT_SWAP')
   → schedule dari overrideSchedule JSON dipakai
   → policySnapshot.scheduleSource = 'SHIFT_FORMULA' dengan overrideSource='SHIFT_SWAP'
```

---

## 📖 5. Use Case End-to-End — Joko di Pabrik Cikarang

### Skenario: Shift 3 Malam (23:00–07:00), Joko Terlambat + Lembur + Tukar Shift Sabtu

**Setup:**
- Karyawan: Joko Santoso, `employeeCategory = FACTORY`
- `shiftFormulaId` = SF-CIKARANG-3MALAM, `shiftStartDate` = 2024-09-02
- Formula cycleLength = 7: Senin-Jumat `workStart="23:00"`, `workEnd="07:00"`, `crossesMidnight=true`; Sabtu `workStart="23:00"`, `workEnd="03:00"` (½ hari); Minggu `dayType="WE"` (off)
- `BranchAttendancePolicy`: method=`MOBILE_GPS`, gpsRadiusMeters=150, lateToleranceMinutes=15
- Gaji pokok Joko: Rp 5.000.000/bulan

---

#### ⬛ Step 1 — Context Resolution (Senin 4 Nov 2024, shift mulai 23:00)

Backend memanggil `attendanceContextService.resolve(jokoId, '2024-11-04')` ([attendance-context.service.ts#L88-L211](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/modules/attendance/attendance-context.service.ts#L88-L211)):

```typescript
// 1. Ambil employee + shiftFormulaId (context.service.ts#L89-L100)
// 2. Resolve branch dari latestCareer transaction
// 3. findEmployeeShiftOverrideSchedule(jokoId, 2024-11-04) → null (tidak ada swap)
// 4. resolveShiftFormulaSchedule(jokoId, 2024-11-04):
//    diffDays = (2024-11-04 - 2024-09-02) = 63 hari
//    rotationIndex = 63 % 7 = 0 → sequence=1 (Senin)
//    dayType='WD', workStart='23:00', workEnd='07:00', crossesMidnight=true
// 5. Ambil BranchAttendancePolicy untuk branch Cikarang
```

Hasil context: `schedule.workStart='23:00'`, `schedule.workEnd='07:00'`, `crossesMidnight=true`

---

#### ⬛ Step 2 — Joko Clock In Terlambat 18 Menit (23:18)

```
POST /api/v1/attendance
Body: {
  employeeId: "joko-uuid",
  companyId: "pt-cikarang-uuid",
  date: "2024-11-04T00:00:00.000Z",
  checkIn: "2024-11-04T23:18:00.000Z",
  method: "MOBILE_GPS",
  checkInLatitude: -6.3584,
  checkInLongitude: 107.1480
}
```

Di `attendanceService.create()` ([attendance.service.ts#L253-L261](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/modules/attendance/attendance.service.ts#L253-L261)):

```typescript
const scheduledStart = buildScheduledTime(2024-11-04, '23:00') // 23:00:00
const toleratedStart = scheduledStart + 15 menit              // 23:15:00
checkIn = 23:18 > toleratedStart 23:15  →  status = LATE
lateMinutes = 23:18 - 23:00 = 18 menit
```

Hasil: **1 row INSERT ke `attendances`**, status=`LATE`, lateMinutes=18, isWithinRadius=true (Joko di dalam 150m), policySnapshot menyimpan snapshot lengkap jadwal dan policy.

**Potongan keterlambatan 18 menit (tier 16–30 menit):**
Sesuai aturan bisnis 4 tier (Bagian 9):
- 16–30 menit → potong **½ uang makan harian**
- Misal uang makan = Rp 30.000/hari → potongan = **Rp 15.000**

---

#### ⬛ Step 3 — Joko Clock Out (Selasa 05 Nov 2024 07:05)

```
PATCH /api/v1/attendance/{attendanceId}/checkout
Body: { checkOut: "2024-11-05T07:05:00.000Z", method: "MOBILE_GPS",
        checkOutLatitude: -6.3584, checkOutLongitude: 107.1480 }
```

Di `attendanceService.checkOut()` ([attendance.service.ts#L315-L407](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/modules/attendance/attendance.service.ts#L315-L407)):

```typescript
scheduledEnd = buildScheduledEndTime(2024-11-04, '23:00', '07:00')
// crossesMidnight → scheduledEnd = 2024-11-05T07:00:00
earlyLeaveMinutes = 0 (07:05 > 07:00 – masih sesuai)
workDuration = (07:05 - 23:18) = 467 menit ≈ 7 jam 47 menit
```

---

#### ⬛ Step 4 — Joko Ajukan Lembur Jumat 3 Jam

Setelah shift Jumat selesai (08 Nov 2024), Joko lembur 3 jam tambahan (07:00–10:00):

```
POST /api/v1/attendance/overtime
Body: {
  employeeId: "joko-uuid",
  companyId: "pt-cikarang-uuid",
  date: "2024-11-08T00:00:00.000Z",
  startTime: "2024-11-08T07:00:00.000Z",
  endTime: "2024-11-08T10:00:00.000Z",
  durationHours: 3,
  reason: "Penyelesaian produksi batch akhir minggu",
  multiplier: 1.5
}
```

Prisma: INSERT ke `overtime_requests`, status=`PENDING` ([attendance.repository.ts#L105-L119](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/modules/attendance/attendance.repository.ts#L105-L119)).

**Perhitungan OT (sesuai UU Ketenagakerjaan Pasal 78):**

```
Upah per jam = Gaji Pokok / 173
             = Rp 5.000.000 / 173
             = Rp 28.902 (dibulatkan)

Jam ke-1 lembur  = 1 jam × 1,5 × Rp 28.902 = Rp 43.353
Jam ke-2 lembur  = 1 jam × 2,0 × Rp 28.902 = Rp 57.804
Jam ke-3 lembur  = 1 jam × 2,0 × Rp 28.902 = Rp 57.804

Total OT = Rp 43.353 + Rp 57.804 + Rp 57.804 = Rp 158.961
```

> **Total tunjangan lembur Joko: Rp 158.961**
> (perbedaan Rp 1 dari estimasi awal karena pembulatan Rp 28.902 × 5,5 = 158.961)

---

#### ⬛ Step 5 — Manager Approve Overtime

```
PATCH /api/v1/attendance/overtime/{overtimeId}/approve
```

Di `attendanceService.approveOvertime()` ([attendance.service.ts#L449-L452](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/modules/attendance/attendance.service.ts#L449-L452)):
```typescript
attendanceRepository.updateOvertimeStatus(id, 'APPROVED', userId)
// Prisma: UPDATE overtime_requests SET status='APPROVED', approvedBy=managerId, approvedAt=now()
```

---

#### ⬛ Step 6 — Joko Ajukan Tukar Shift Sabtu ke Budi

Sabtu 9 Nov 2024, Joko ingin tukar shift dengan Budi (keduanya karyawan FACTORY pabrik yang sama):

```
POST /api/v1/shift-swap-requests  (modul shift swap)
Body: {
  requesterEmployeeId: "joko-uuid",
  targetEmployeeId: "budi-uuid",
  approverEmployeeId: "manager-uuid",
  shiftDate: "2024-11-09",
  reason: "Ada acara keluarga, izin tukar shift Sabtu"
}
```

Prisma: INSERT ke `shift_swap_requests`, status=`PENDING` ([schema.prisma#L1770-L1797](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/database/prisma/schema.prisma#L1770-L1797)).

---

#### ⬛ Step 7 — Manager Approve Swap → Sabtu Auto Override

Manager approve swap request. Backend INSERT 2 rows ke `employee_shift_overrides`:

```typescript
// Row 1: Joko pada 2024-11-09
prisma.employeeShiftOverride.create({
  employeeId: "joko-uuid",
  shiftSwapRequestId: swapReqId,
  date: "2024-11-09",
  source: "SHIFT_SWAP",
  originalSchedule: { workStart: "23:00", workEnd: "03:00", dayType: "WD" },
  overrideSchedule: budiJadwalSabtu   // jadwal Budi pada tanggal itu
})

// Row 2: Budi pada 2024-11-09
prisma.employeeShiftOverride.create({
  employeeId: "budi-uuid",
  shiftSwapRequestId: swapReqId,
  date: "2024-11-09",
  source: "SHIFT_SWAP",
  originalSchedule: budiJadwalSabtu,
  overrideSchedule: { workStart: "23:00", workEnd: "03:00", dayType: "WD" }
})
// shift_swap_requests status → APPROVED, reviewedAt = now()
```

Saat Joko clock in Sabtu → `findEmployeeShiftOverrideSchedule` menemukan override → jadwal pakai `overrideSchedule` (jadwal Budi) → `policySnapshot.scheduleSource='SHIFT_FORMULA'`, `overrideSource='SHIFT_SWAP'`.

**Hasil: Sabtu Joko otomatis menggunakan jadwal Budi (misalnya libur / dayType='WE' = tidak perlu hadir).**

---

## ✅ 6. Zod DTO — 8 Schema Validator

Didefinisikan di [attendance.dto.ts#L1-L93](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/modules/attendance/attendance.dto.ts#L1-L93):

| Schema | Kegunaan | Field Kritis |
|---|---|---|
| `createAttendanceSchema` | Clock in (create attendance) | `employeeId` UUID, `companyId` UUID, `date` datetime, `method ∈ ['FINGERPRINT','MOBILE_GPS','MANUAL']`, `checkInLatitude/Longitude` float optional, `status ∈ ['PRESENT','ABSENT','LATE','EXCUSED']` default PRESENT |
| `checkoutAttendanceSchema` | Clock out (PATCH /:id/checkout) | `checkOut` datetime **required**, `method` optional enum, `checkOutLatitude/Longitude` float optional, `notes` string optional |
| `updateAttendanceSchema` | Update / koreksi admin internal | Semua field optional: checkIn, checkOut, method, GPS coords, workDuration, earlyLeaveMinutes, distanceMeters, isWithinRadius, isException, exceptionType (6 enum values), exceptionReason, requiresReview, policySnapshot (JSON), status, notes |
| `attendanceQuerySchema` | Filter list kehadiran (GET /) | `companyId` UUID required; `employeeId`, `date`, `month`, `status` optional |
| `attendanceContextQuerySchema` | Resolve context jadwal karyawan (GET /context) | `employeeId` UUID required, `date` string min(1) required, `companyId` UUID optional |
| `createOvertimeSchema` | Ajukan lembur | `employeeId` + `companyId` UUID, `date` datetime, `startTime` + `endTime` datetime, `durationHours` positive number, `reason` min(1), `multiplier` default 1.5 |
| `overtimeQuerySchema` | Filter list overtime | `companyId` UUID required; `employeeId`, `status`, `startDate`, `endDate` optional |
| `updateAttendanceSchema` (reuse untuk koreksi) | Manual admin correction (:id/correction) | `status` enum (PRESENT/ABSENT/LATE/EXCUSED), `notes` optional |

**Catatan:** Schema untuk shift CRUD (`createShiftFormulaSchema`) dan shift swap (`createShiftSwapSchema`) didefinisikan di modul work-calendar/shift terpisah, bukan di attendance.dto.ts.

---

## 🔌 7. 13 API Endpoints

Semua route di [attendance.routes.ts#L18-L32](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/modules/attendance/attendance.routes.ts#L18-L32). Base URL: `{APP_URL}{API_PREFIX}/attendance`

| # | Method | Route | Resource Action | Deskripsi |
|---|---|---|---|---|
| 1 | GET | `/` | attendance:read | List semua attendance + filter companyId/employeeId/date/month/status |
| 2 | GET | `/context` | attendance:read | Resolve context jadwal + policy karyawan untuk tanggal tertentu (pre-clock-in check) |
| 3 | GET | `/summary` | attendance:read | Ringkasan PRESENT/LATE/ABSENT/EXCUSED total + persentase per bulan |
| 4 | GET | `/report` | attendance:read | Export rekap kehadiran → response CSV `attachment; filename="attendance-report-{month}-{year}.csv"` |
| 5 | GET | `/:id` | attendance:read | Detail 1 record attendance + include employee + branch + policy |
| 6 | POST | `/` | attendance:create | Clock in karyawan — validasi context, GPS, method, duplikasi tanggal |
| 7 | PATCH | `/:id/checkout` | attendance:update | Clock out — hitung workDuration + earlyLeaveMinutes + GPS eval |
| 8 | PATCH | `/:id/correction` | attendance:update | Koreksi manual admin: update status/notes |
| 9 | DELETE | `/:id` | attendance:delete | Soft delete attendance record (set deletedAt) |
| 10 | GET | `/overtime` | attendance:read | List semua overtime requests per company + filter |
| 11 | POST | `/overtime` | attendance:create | Ajukan overtime request baru → status PENDING |
| 12 | PATCH | `/overtime/:id/approve` | attendance:approve | Approve overtime → status APPROVED + approvedBy + approvedAt |
| 13 | PATCH | `/overtime/:id/reject` | attendance:approve | Reject overtime → status REJECTED |

**Total: 13 endpoint** sesuai routes.ts#L18-L32.

---

## 🔗 8. Integrasi Antar-Modul

### 8.1 Work Calendar → HOLIDAY_AUTO & Jadwal Harian
`attendanceContextService.resolve()` ([attendance-context.service.ts#L174-L176](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/modules/attendance/attendance-context.service.ts#L174-L176)) memanggil 3 lapis resolusi jadwal:

```typescript
const overrideSchedule = await workCalendarRepository.findEmployeeShiftOverrideSchedule(...)
const shiftSchedule    = overrideSchedule ?? await workCalendarRepository.resolveShiftFormulaSchedule(...)
const schedule         = shiftSchedule   ?? await workCalendarRepository.findDayScheduleForContext(...)
```

Jika Work Calendar menandai tanggal sebagai libur nasional (`dayType='NH'`), `schedule.isWorkingDay=false`. Attendance dengan status **auto-ABSENT** atau tidak dibuat jika `allowHolidayAttendance=false` di policy. Kalender nasional terintegrasi via FK `resolvedCalendarId` → `work_calendars.id`.

### 8.2 Leave Management → Status ON_LEAVE / EXCUSED
Saat Leave Request karyawan diapprove (status `APPROVED`), modul Leave menandai range tanggal cuti. Di rekap bulanan / export CSV, tanggal-tanggal cuti tersebut dapat dikategorikan sebagai `EXCUSED` melalui:
- Admin koreksi manual via `PATCH /:id/correction` dengan `status='EXCUSED'`
- Atau saat attendance record dibuat via import mesin, record yang tanggalnya overlap dengan approved leave otomatis di-flag EXCUSED

FK integrasi: `leave_requests` → `employeeId` = `attendances.employeeId`, range tanggal dicocokkan.

### 8.3 Payroll → Komponen OT Allowance + Potongan Keterlambatan + Uang Makan
Modul Payroll membaca data dari:
- `overtime_requests` WHERE `employeeId = X AND status = 'APPROVED' AND date BETWEEN payroll_period`
  - Hitung: `(gajiPokok / 173) × Σ(durationHours × multiplier)` per jam lembur
  - FK: `overtime_requests.employeeId` → `employees.id` → `employee_salary_components`
- `attendances` WHERE `lateMinutes > 0` → kalkulasi potongan tier keterlambatan
  - FK: `attendances.employeeId` → `employees.id`
- Summary `earlyLeaveMinutes` untuk komponen deduksi
- `workDuration` aggregated per bulan untuk validasi jam kerja minimum

### 8.4 Notifikasi → Shift Swap Events
Saat `shift_swap_requests.status` berubah ke `APPROVED` atau `REJECTED`, sistem notifikasi mengirimkan event ke:
- Requester employee: "Tukar shift kamu dengan Budi pada [tanggal] telah [disetujui/ditolak]"
- Target employee: "Joko mengajak kamu tukar shift pada [tanggal] → [status]"

FK: `shift_swap_requests.requesterEmployeeId` + `targetEmployeeId` → `employees.userId` → `notifications`.

---

## ⚠️ 9. Business Rules — UU Ketenagakerjaan

### Rule 1 — Batas Maksimum Lembur (UU No. 13/2003 Pasal 78 ayat 1)
> **Maksimum lembur: 4 jam per hari, 18 jam per minggu.**

Sistem perlu memvalidasi di `createOvertime()`:
```
if (durationHours > 4) → throw BadRequestError("Lembur max 4 jam per hari")
if (totalOvertimeThisWeek + durationHours > 18) → throw BadRequestError("Lembur max 18 jam per minggu")
```
Field `durationHours` di `overtime_requests` menyimpan durasi yang diajukan ([schema.prisma#L2784](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/database/prisma/schema.prisma#L2784)).

### Rule 2 — Formula 173 Jam/Bulan
> **Upah per jam = Gaji Pokok / 173**

Angka 173 adalah standar KemenakertranS (rata-rata jam kerja sebulan): 40 jam/minggu × 52 minggu / 12 bulan = 173,33 ≈ **173**.
```
Gaji Pokok Rp 5.000.000 → Upah per jam = Rp 28.902 (dibulatkan ke bawah)
```
Formula ini digunakan sebagai base rate untuk perhitungan semua komponen OT.

### Rule 3 — Tarif Lembur (UU Pasal 78 juncto Kepmenaker No. 102/2004)
> **Jam ke-1: 1,5× | Jam ke-2 dst: 2× | Hari libur penuh: 2× semua jam**

| Kondisi | Jam ke-1 | Jam ke-2 | Jam ke-3 | Jam ke-4 |
|---|---|---|---|---|
| Hari kerja biasa | 1,5× | 2,0× | 2,0× | 2,0× |
| Hari libur/minggu (≤8 jam) | 2,0× | 2,0× | 2,0× | 2,0× |
| Hari libur/minggu (>8 jam, jam 9+) | 3,0× | 3,0× | - | - |

Field `multiplier` di `overtime_requests` ([schema.prisma#L2786](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/database/prisma/schema.prisma#L2786)) menyimpan multiplier yang diajukan (default 1.5). Untuk hari libur, HR perlu set `multiplier=2.0` saat submit.

**Contoh Joko 3 jam lembur hari kerja (Jumat):**
```
Upah/jam  = Rp 5.000.000 / 173 = Rp 28.902
Jam ke-1  = 1 × 1,5 × 28.902   = Rp 43.353
Jam ke-2  = 1 × 2,0 × 28.902   = Rp 57.804
Jam ke-3  = 1 × 2,0 × 28.902   = Rp 57.804
─────────────────────────────────────────────
TOTAL OT  =                        Rp 158.961
```

### Rule 4 — 4 Tier Keterlambatan
> Keterlambatan berdampak pada potongan uang makan / gaji, diimplementasikan dari data `lateMinutes` di `attendances`.

| Tier | Rentang `lateMinutes` | Konsekuensi | Contoh (uang makan Rp 30.000/hari) |
|---|---|---|---|
| **Tier 0** | 0–15 menit | Warning saja, tidak ada potongan | Tidak ada potongan |
| **Tier 1** | 16–30 menit | Potong **½ uang makan** harian | Potongan **Rp 15.000** |
| **Tier 2** | 31–60 menit | Potong **1× uang makan** + **½ hari unpaid** | Rp 30.000 + setengah hari |
| **Tier 3** | > 60 menit | **1 hari unpaid** (tidak dibayar untuk hari tersebut) | Gaji hari itu hangus |

Contoh Joko lateMinutes=18 → Tier 1 → **Potongan uang makan Rp 15.000**. Data `lateMinutes=18` tersimpan di `attendances.lateMinutes` ([schema.prisma#L2711](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/database/prisma/schema.prisma#L2711)) dan dibaca modul Payroll saat run gaji.

### Rule 5 — WFH: Validasi IP Range + GPS + Selfie
Untuk kehadiran WFH, `BranchAttendancePolicy` mengkonfigurasi:
- `requiresLocation=true` + `gpsLatitude/Longitude/RadiusMeters` → sistem wajib validasi koordinat GPS meskipun method=FINGERPRINT
- `requiresSelfie=true` → aplikasi mobile wajib upload foto selfie untuk anti-spoofing
- `allowOutsideRadius=true` + `outsideRadiusAction=REVIEW` → WFH tercatat sebagai exception `OUT_OF_RADIUS` dengan `requiresReview=true` untuk review HR

Validasi GPS via haversine formula di `calculateDistanceMeters()` ([attendance.service.ts#L44-L65](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/modules/attendance/attendance.service.ts#L44-L65)).

### Rule 6 — Shift Malam Allowance 10% (00:00–05:00)
> Karyawan yang bekerja pada rentang waktu 00:00–05:00 berhak atas **tunjangan shift malam sebesar 10% dari upah per jam**.

Field `crossesMidnight=true` di `shift_formula_days` ([schema.prisma#L1760](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/database/prisma/schema.prisma#L1760)) menandai shift yang melewati tengah malam. Modul Payroll menghitung:
```
Jam kerja dalam window 00:00-05:00 = X jam
Tunjangan malam = X × (gajiPokok / 173) × 10%

Contoh Joko shift 23:00-07:00 → 5 jam dalam window malam
Tunjangan = 5 × Rp 28.902 × 10% = Rp 14.451/malam
```
`policySnapshot.crossesMidnight` disimpan di record attendance sebagai referensi kalkulasi payroll.

---

## 🎯 10. TL;DR — Alur 6 Step Attendance Lengkap

```
1️⃣  RESOLVE CONTEXT (GET /context)
    attendanceContextService.resolve(employeeId, date)
    ├─ ShiftFormula rotasi? (FACTORY category + shiftFormulaId)
    ├─ Override aktif? (shift_swap_requests APPROVED → employee_shift_overrides)
    └─ WorkCalendar fallback? (branch/department calendar)
           ↓ Hasil: workStart, workEnd, dayType, policy (GPS radius, method, toleransi)

2️⃣  CLOCK IN (POST /attendance)
    Validasi: method diizinkan policy? | GPS dalam radius? | hari kerja?
    Hitung: lateMinutes = checkIn - (workStart + lateToleranceMins)
    Status: PRESENT / LATE (jika lateMinutes > toleransi)
    INSERT attendances + policySnapshot (immutable audit)
           ↓

3️⃣  CLOCK OUT (PATCH /:id/checkout)
    Hitung: earlyLeaveMinutes = workEnd - checkOut (jika keluar awal)
    Hitung: workDuration = checkOut - checkIn (menit)
    UPDATE attendances.checkOut + workDuration + earlyLeaveMinutes
           ↓

4️⃣  LEMBUR (POST /overtime → PATCH /overtime/:id/approve)
    INSERT overtime_requests (PENDING) → Manager approve (APPROVED)
    Formula OT: upah/jam = gajiPokok / 173
      Jam-1: ×1.5 | Jam-2+: ×2.0 | Hari libur: ×2.0 semua
    Batas: max 4 jam/hari, 18 jam/minggu (UU 13/2003 Pasal 78)
           ↓

5️⃣  SHIFT SWAP (POST shift_swap_requests → PATCH approve)
    PENDING → APPROVED → INSERT 2× employee_shift_overrides (requester + target)
    Clock in berikutnya: override ditemukan → jadwal tukar dipakai otomatis
           ↓

6️⃣  REKAP BULANAN (GET /summary + GET /report)
    Summary: PRESENT/LATE/ABSENT/EXCUSED count per bulan
    Report CSV: download per employee + department + posisi
    Payroll module baca: lateMinutes (potongan tier) + OT approved (tunjangan)
    Total slip gaji = gajiPokok - potonganTerlambat - potonganUangMakan + OT + tunjanganMalam
```
