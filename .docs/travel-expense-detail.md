# 🧳 Modul Travel & Expenses — Panduan Detail Alur Bisnis

> Modul ini menangani **3 proses bisnis terintegrasi** dalam pengeluaran karyawan untuk keperluan perusahaan:
> 1. **Perjalanan Dinas (Business Trip)** → permohonan izin & alokasi biaya
> 2. **Uang Muka Perjalanan (Travel Advance)** → pencairan dana sebelum berangkat
> 3. **Reimbursement / Pertanggungjawaban Biaya (Expense Claim)** → klaim pengeluaran + bukti kuitansi

Semua 3 tahap ini saling berkaitan: Trip disetujui → Advance dicairkan → Karyawan pulang → buat Expense Claim → di-approve → di-reimburse, lalu finalisasi (advance settlement).

---

## 🧩 Gambaran Arsitektur Modul

### Files & References
| Komponen | Lokasi File |
|---|---|
| API Routes | [travel-expense.routes.ts](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/modules/travel-expense/travel-expense.routes.ts) |
| DTO Validator (Zod) | [travel-expense.dto.ts](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/modules/travel-expense/travel-expense.dto.ts) |
| Controller | [travel-expense.controller.ts](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/modules/travel-expense/travel-expense.controller.ts) |
| Repository + Logic | [travel-expense.repository.ts](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/modules/travel-expense/travel-expense.repository.ts) |
| Schema Prisma 5 Entities | [schema.prisma#3707-3825](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/database/prisma/schema.prisma#L3707-L3825) |

---

## 🔐 Role Matrix: Siapa Bisa Apa?

Didefinisikan di [travel-expense.routes.ts#L49-L50](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/modules/travel-expense/travel-expense.routes.ts#L49-L50):

| Aksi | SUPER_ADMIN | GROUP_ADMIN | COMPANY_ADMIN | HR_MANAGER | HR_STAFF | MANAGER | EMPLOYEE |
|---|---|---|---|---|---|---|---|
| Lihat semua Trip (difilter company) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| Lihat trip sendiri (**my trips**) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Create** Trip (ajukan perjalanan dinas) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Approve / Reject Trip | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| **Create Travel Advance** (uang muka) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| Lihat semua Expense Claim | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| Lihat claim sendiri (**my claims**) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Upload bukti kuitansi (receipt) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Buat Expense Claim** (pertanggungjawaban) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Approve / Reject Claim | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| **Reimburse** Claim (bayar ke karyawan) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |

---

## 📌 5 Kategori Biaya (Expense Categories)

Didefinisikan sebagai const `EXPENSE_CATEGORIES` di [repository.ts#L12-L18](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/modules/travel-expense/travel-expense.repository.ts#L12-L18) + schema enum `ExpenseCategory` di Prisma.

| Enum Value | Label Indonesia | Contoh Kasus |
|---|---|---|
| `TRANSPORTATION` | 🚗 Transportasi | Tiket pesawat, travel bandara, tol, bensin, parkir, ojek online, taksi |
| `HOTEL` | 🏨 Hotel / Penginapan | Tagihan hotel 3 malam saat perjalanan dinas luar kota |
| `MEAL` | 🍽 Makan | Uang makan harian, makan dengan client saat rapat luar kantor |
| `ENTERTAINMENT` | 🎫 Entertainment | Tiket nonton bareng klien, coffee meeting, venue gathering klien |
| `OPERATIONAL` | 🖨 Operasional Lain-lain | Print dokumen tender, sewa ruang meeting, kurir, alat tulis saat di luar |

---

## 🧾 Entities & Data Model (5 Tabel DB)

### Diagram Relasi
```
company_groups ──< companies
                     │
                     ├─< business_trips 1──N travel_advances (1 Trip bisa banyak kali pencairan advance)
                     │                      │
                     │                      └── N expense_claims (1 Trip bisa banyak claim item)
                     │                              │
                     │                              ├─< expense_approvals (1 Claim bisa punya log approval ber level)
                     │                              └─< reimbursements (1 Claim di-bayar bisa dibagi beberapa kali / 1x)
                     └─< employees
```

### Entity 1 — `business_trips` (Permohonan Perjalanan Dinas)
| Field | Type | Required | Keterangan |
|---|---|---|---|
| `id` | UUID | auto | Primary key |
| `companyId` | UUID | ✅ | Company scope (row-level security) |
| `employeeId` | UUID | ✅ | Siapa yang akan pergi |
| `destination` | varchar(255) | ✅ | Kota tujuan: "Jakarta - Kota Kasablanka" |
| `purpose` | text | ✅ | Tujuan: "Rapat kickoff project Q4 dengan client ABC" |
| `startDate` | DateTime | ✅ | Tanggal berangkat |
| `endDate` | DateTime | ✅ | Tanggal kembali ke kantor |
| `estimatedCost` | Decimal(15,2) | ✅ | Perkiraan total biaya = transport + hotel + makan + opsional |
| `notes` | text | ❌ | Catatan tambahan, misal "Pesan hotel dekat stasiun Gambir" |
| **`status`** | Enum `BusinessTripStatus` | default `REQUESTED` | Lihat state machine dibawah |
| `approvedBy` | UUID | ❌ | User ID approver |
| `approvedAt` | DateTime | ❌ | Waktu approval |

### Enum BusinessTripStatus (5 Status)
```
REQUESTED  →  Permohonan diajukan, menunggu approval manager
   │
   ├─ approveTrip()  → APPROVED ✅ (bisa cairkan advance)
   ├─ rejectTrip()   → REJECTED ❌ (selesai, flow berhenti)
   └─ (dibatalkan)   → CANCELLED
                                              │
         ExpenseClaims all reimbursed ────────┴────────→ COMPLETED (final)
```

---

### Entity 2 — `travel_advances` (Uang Muka Perjalanan Dinas)
> **1 BusinessTrip bisa punya BANYAK TravelAdvance** — jika trip 2 minggu, bisa dicairkan bertahap 70% dulu sebelum berangkat, sisanya ditengah jika butuh tambahan.

| Field | Type | Keterangan |
|---|---|---|
| `id` | UUID | PK |
| `tripId` | UUID | FK ke `business_trips.id` — uang muka untuk trip mana |
| `companyId` | UUID | Company scope |
| `amount` | Decimal(15,2) | **Jumlah yang dicairkan ke karyawan** — biasanya max 70% dari `estimatedCost` trip |
| `disbursedAt` | DateTime | Tanggal pencairan transfer ke rekening karyawan |
| `reconciled` | Boolean (default false) | **Flag settlement:** true = total advance sudah di-offset dengan ExpenseClaims trip ini (lunas / karyawan mengembalikan sisa / ditagih ke payroll) |
| `notes` | text | "Cair tahap 1, 70% sebelum berangkat" |

---

### Entity 3 — `expense_claims` (Item Pertanggungjawaban Biaya)
> 1 BusinessTrip bisa punya **BANYAK item claim** (1 baris per kuitansi / 1 item biaya). Karyawan yang sama juga bisa buat claim TANPA trip (contoh: claim uang makan lembur kantor terdekat `tripId = NULL`).

| Field | Type | Keterangan |
|---|---|---|
| `id` | UUID | PK |
| `companyId, employeeId` | UUID | Scope owner + company |
| `tripId` | UUID **nullable** | Kalau di-set = claim dari perjalanan dinas trip ini. Kalau NULL = claim non-trip (biaya lokal) |
| `category` | Enum `ExpenseCategory` | 5 kategori (transport/hotel/meal/entertainment/operational) |
| `amount` | Decimal(15,2) | Jumlah nominal di kuitansi |
| `description` | text | Detail: "Taxi Bandara Soekarno-Hatta → Hotel Grand Mercure" |
| `expenseDate` | DateTime | Tanggal pengeluaran terjadi |
| `receiptFilePath` | varchar(500) | Path file kuitansi yang di-upload (image/JPG/PNG/PDF) |
| `ocrExtractedAmount` | Decimal | **OCR placeholder**: hasil scan nominal dari gambar kuitansi (akan di-compare dengan `amount` yang user input — deteksi manipulasi) |
| **`status`** | Enum `ExpenseClaimStatus` | Default `SUBMITTED` — lihat state machine dibawah |
| `notes` | text | "Lampiran 3 dari 12 bukti perjalanan Surabaya tgl 12 Nov" |

#### Enum ExpenseClaimStatus (5 Status + Transactional Flow)
```
 SUBMITTED   (user submit claim dengan bukti)
      │
      ├──── approveClaim()  →  APPROVED ✅  — Manager/HR setuju nominal + bukti valid
      │       (Prisma $transaction: update status claim + INSERT row ke expense_approvals)
      │
      ├──── rejectClaim()   →  REJECTED ❌  — Bukti kurang jelas / bukan kepentingan perusahaan
      │
      └──── (user cancel)   →  CANCELLED

 APPROVED
      │
      └──── reimburseClaim() → REIMBURSED 💰  — HR/Finance sudah transfer ganti uang ke karyawan
             (Prisma $transaction: INSERT reimbursement record + update status)
```

---

### Entity 4 — `expense_approvals` (Audit Trail Approval per Claim)
> Setiap action approve/reject **menambah 1 baris baru ke tabel ini** (dijalankan dalam Prisma transaction `approveClaim/rejectClaim` di repository.ts L153-L201). Karena nantinya bisa multi-level approval, field `level` dipakai sebagai nomor urut stage approval.

| Field | Type | Keterangan |
|---|---|---|
| `claimId` | UUID | FK ke claim |
| `approverId` | UUID | Siapa yang approve/reject |
| `level` | Int (default `1`) | Stage 1 = Atasan langsung, Stage 2 = Manager L2, Stage 3 = Finance (future-ready) |
| `status` | Enum `ExpenseApprovalStatus` | PENDING / APPROVED / REJECTED |
| `notes` | text | Komentar approver: "Tolong lampirkan boarding pass juga ya" |
| `approvedAt` | DateTime | Timestamp |

---

### Entity 5 — `reimbursements` (Pencatatan Pembayaran Sudah Cair)
> Hasil dari method `reimburseClaim`. Tabel ini nanti jadi **source data untuk sinkron ke Modul Payroll**.

| Field | Type | Keterangan |
|---|---|---|
| `claimId` | UUID | FK ke claim yang dibayar |
| `companyId` | UUID | Company scope |
| **`method`** | Enum `ReimbursementMethod` | **Dua pilihan pembayaran:** <br>• `TRANSFER` = Bayar via Bank Transfer batch (generate file BA Bank)<br>• `PAYROLL` = **GABUNG KE GAJI** bulan berikutnya (dijadikan salary component addition di employee payroll detail) |
| `amount` | Decimal(15,2) | Jumlah yang benar-benar dibayar — **bisa KURANG** dari nominal claim (misal: klaim 1.200.000 tapi policy max meal hanya 1.000.000 — sisanya 200.000 ditolak). Default = claim amount. |
| `processedBy` | UUID | User HR/Finance yang memproses pembayaran |
| **`payrollDetailId`** | UUID (nullable) | **FK ke `employee_salary_components.id`** (payroll module table). Jika method = PAYROLL maka ini link ke row component gaji karyawan bulan bersangkutan |
| `processedAt` | DateTime | Default now() |
| `notes` | text | "Cair bersamaan payroll period 2024-11, component Reimbursement-Meeting-Client" |

---

## 🚀 ALUR END-TO-END (Contoh Kasus Riil)

### 📖 Use Case: Budi Sales Mau ke Surabaya 3 Hari Rapat Client

#### ⬛ Step 1 — Budi Submit Business Trip
Budi (Sales Executive / role EMPLOYEE) buka halaman **My Trips** → tombol **Ajukan Perjalanan Dinas**:
- Destination: `Surabaya, Jawa Timur`
- Purpose: `Kickoff project building automation di PT. XYZ — menandatangani MoU + gathering 2 hari workshop dengan client`
- Start Date: `12 Nov 2024`
- End Date: `14 Nov 2024`
- Estimated Cost: `Rp 3.250.000` (Tiket PP: 1.800.000 + Hotel 2 malam: 900.000 + Transport lokal 250.000 + Meal 3 hari 300.000)
- Notes: `Bawa sample produk ke Surabaya via kargo, booking tiket via Trip.com`

Hasil: ✅ **1 row created di `business_trips`** dengan status **`REQUESTED`**. Notifikasi masuk ke inbox Manager Budi — Pak Rudi (Sales Manager).

---

#### ⬛ Step 2 — Pak Rudi Approve Trip
Pak Rudi login role MANAGER → buka **Approval Inbox → Trip Approval**:
- Check tanggal trip tidak bentrok dengan event client lain
- Check estimated cost sesuai budget travel per Kategori Jabatan Sales Grade B — Max 4jt per trip → ✅ Masih di bawah
- **Klik Approve** dengan catatan notes: `Approved. Hotel pilih Mercure Tunjungan Plaza ya, dekat client office. Jangan lupa laporan hasil rapat hari Senin depan.`

Yang terjadi di backend:
```js
// travel-expense.repository.ts#L69-L79: approveTrip
prisma.businessTrip.update({
  where: id,
  data: {
    status: 'APPROVED',      // ← REQUESTED → APPROVED
    approvedBy: approverId,  // pakRudi.id
    approvedAt: now()
  }
})
```
Hasil: ✅ Status Trip Budi = **`APPROVED`**. Notifikasi ke Budi: "Trip kamu disetujui Pak Rudi, silakan cairkan uang muka ke HR Staff 1x24 jam."

---

#### ⬛ Step 3 — HR Staff Cairkan Uang Muka (Travel Advance)
Mbak Siti (HR_STAFF) menerima permintaan Budi → buka Trip APPROVED → tombol **Cairkan Uang Muka**:
- Amount: `Rp 2.275.000` (**70%** × 3.250.000 — policy default perusahaan)
- Disbursed At: `10 Nov 2024` (2 hari sebelum berangkat)
- Notes: `Transfer ke BCA 123xxxxxxx Budi Santoso — uang muka 70%`

Hasil: ✅ **INSERT 1 row ke `travel_advances`**. Column `reconciled = false` (belum dipertanggungjawabkan). Budi dapat notifikasi WA+Email: Uang muka Rp 2.275jt sudah ditransfer, cek rekening.

---

#### ⬛ Step 4 — Budi Pulang, Upload Semua Kuitansi + Buat Expense Claim Batch
16 Nov 2024. Budi pulang & kumpulkan semua bukti struk:
| No | Tgl | Kategori | Kuitansi | Nominal |
|---|---|---|---|---|
| 1 | 12-Nov | TRANSPORT | 📸 E-ticket Lion Air JT-123 CGK-SUB | Rp 875.000 |
| 2 | 12-Nov | HOTEL | 📄 Invoice 2 malam Mercure + slip deposit | Rp 900.000 |
| 3 | 12-Nov | MEAL | 📸 Struk warung soto Surabaya | Rp 45.000 |
| 4 | 13-Nov | ENTERTAINMENT | 📸 Receipt coffee meeting dengan Pak Bambang Client | Rp 125.000 |
| 5 | 13-Nov | TRANSPORT | 📸 Struk taksi Blue Bird | Rp 85.000 |
| 6 | 14-Nov | TRANSPORT | 📸 E-ticket Citilink QZ-456 SUB-CGK | Rp 925.000 |
| 7 | 14-Nov | MEAL | 📸 Struk makan airport lounge | Rp 68.000 |

Setiap struk di-upload via endpoint:
```
POST /api/v1/travel-expenses/claims/receipt-upload
Content-Type: multipart/form-data; field name = "receipt"
File: JPG/PNG/PDF, max 5 MB (sesuai .env UPLOAD_MAX_FILE_SIZE)
Mime yang diijinkan: image/jpeg, image/png, image/gif, application/pdf (sesuai travel-expense.routes.ts#L38-L42)

→ Response: { fileName: "173123xxx-struk_mercedes.jpg", url: "http://localhost:3000/uploads/travel-expenses/receipts/173123xxx-struk_mercedes.jpg" }
```
Semua 7 bukti di-upload → **simpan file di folder `uploads/travel-expenses/receipts/`**, dengan nama prefix timestamp + sanitize filename (hapus karakter non-alphanumeric: repository.ts#L29-L33).

Kemudian Budi **buat 7 Expense Claim rows** (satu per struk), semuanya `tripId` di-set ke ID trip Surabaya:
- Category + Amount + Expense Date + receiptFilePath (dari hasil upload) + Description
- Semua claim otomatis status **`SUBMITTED`**, menunggu approval Manager.

---

#### ⬛ Step 5 — Pak Rudi (Manager) Approve 7 Claim Item
Buka Approval Inbox:
1. Cek 1 per 1 item: bukti kuitansi valid ✅, jumlah sesuai struk (nomor struk terlihat di gambar).
2. Item **No. 4 ENTERTAINMENT Rp 125.000**: di notes Budi tertulis "Meeting dengan client XYZ". ✅ Valid
3. Item **No. 7 MEAL Rp 68.000 Lounge**: policy perusahaan max Rp 50.000 per meal — **TOLAK? Atau lanjut?**

Misal: Pak Rudi APPROVE SEMUA (karena masih dalam budget reasonable & di bawah estimasi). Klik Approve Batch.

Yang terjadi di backend per 1 claim:
```typescript
// repository.ts L153-L175 approveClaim → DIJALANKAN DALAM PRISMA $TRANSACTION
const claim = await tx.expenseClaim.update({
  where: { id },
  data: { status: 'APPROVED', notes }
});
await tx.expenseApproval.create({
  data: {
    claimId: id,
    approverId,
    level: 1,                 // stage = Manager
    status: 'APPROVED',
    approvedAt: new Date()
  }
});
```

Hasil: ✅ **7 claims status = APPROVED**, 7 rows baru di `expense_approvals` level=1 APPROVED.

> **Kalau ada claim yang di-REJECT** (contoh: claim membeli souvenir untuk keluarga): Status claim jadi `REJECTED`, expense_approval.create status=REJECTED + notes: "Souvenir bukan kepentingan perusahaan, tolong hapus item ini ya". Flow claim berhenti, tidak bisa lanjut ke reimburse.

---

#### ⬛ Step 6 — Mbak Siti Finance Reimburse Semua Approved Claims
Mbak Siti buka halaman **Expense Claims → Approved Tab**.

**Total yang harus di-reimburse ke Budi = Rp 3.023.000** (jumlah 7 claim items). Tapi **Budi sudah dapat advance Rp 2.275.000**, jadi **sisa hak Budi = 3.023.000 - 2.275.000 = Rp 748.000**.

**Pilihan Metode Pembayaran:**
##### Opsi A. ✅ **Via Transfer Langsung**
- Method: `TRANSFER`
- Amount: `748000` (sisa kurang bayar)
- PayrollDetailId: `NULL`
- Catatan: "Sisa pertanggungjawaban perjalanan Surabaya"

Tindakan Mbak Siti: Generate file transfer Bank BCA untuk 10 claim + sisa trip Budi → Upload ke Corporate Internet Banking → cair.

##### Opsi B. ✅ **Gabung ke Gaji Bulan Depan** (jika nominal kecil & mau dibayar 2 minggu lagi)
- Method: `PAYROLL`
- Amount: `748000`
- PayrollDetailId: (nanti diisi link ke row `employee_salary_components` type `ALLOWANCE`, category `REIMBURSEMENT` pada employee salary record Budi period Nov 2024)
- Payroll run bulan November nanti otomatis include Rp 748.000 sebagai penambah gaji kotor (pro-rated PPh21).

Yang terjadi di method `reimburseClaim` (L203-L234):
```typescript
// $transaction: 2 langkah atomik
1. INSERT reimbursement record (method + amount + who processed + payrollDetailId?)
2. UPDATE expenseClaim SET status = 'REIMBURSED'
```

Hasil: ✅ Status 7 claims = **`REIMBURSED`**. **TravelAdvance** cairan Rp 2.275.000 di-flag `reconciled = true` (settled). Business Trip status = **`COMPLETED`** (semua claim sudah di-reimburse, total balance trip nol).

---

#### ⬛ Step 7 — Finalisasi
- Budi dapat notifikasi: "✅ Selamat! Pertanggungjawaban perjalanan Surabaya telah selesai. Sisa Rp 748.000 akan masuk di gaji periode November 2024. Terima kasih!"
- Di Dashboard Finance: Expense Report bulan November bertambah item biaya perjalanan dinas: Transportasi 1.885.000 + Hotel 900.000 + Meal 113.000 + Entertainment 125.000 = TOTAL Rp 3.023.000 — masuk cost center Dept Sales.
- Modul Payroll otomatis generate component allowance Reimbursement 748.000 ke Budi gaji bulan November.

**🎉 FLOW SELESAI END-TO-END.**

---

## 🗺 Ringkasan State Machine + Validasi Otomatis

### Aksi Yang Hanya Bisa Di-call Jika Status Tepat (Best Practice Validasi Dicek di Service / Repository)
| Operasi | Syarat Status Sebelum | Status Sesudah |
|---|---|---|
| `approveTrip()` | REQUESTED | APPROVED |
| `rejectTrip()` | REQUESTED | REJECTED |
| `createAdvance()` trip dicairkan uang muka | **hanya trip dengan status = APPROVED** (jika masih REQUESTED tidak boleh!) | Advance row dibuat |
| `uploadReceipt()` | N/A (bisa kapan saja) | File tersimpan + URL kembali |
| `createClaim()` | N/A | SUBMITTED |
| `approveClaim()` | SUBMITTED | APPROVED + 1 row ExpenseApproval level=1 |
| `rejectClaim()` | SUBMITTED | REJECTED + 1 row ExpenseApproval level=1 REJECTED |
| `reimburseClaim(method, amount?, payrollDetailId?)` | **APPROVED** (bisa langsung cair jika sudah approve) | REIMBURSED + 1 row Reimbursement terbuat |

---

## 🧾 7 DTO + Validator Zod (travel-expense.dto.ts L3-L48)
| DTO | Kegunaan | Required Field Penting |
|---|---|---|
| `createBusinessTripSchema` | Ajukan perjalanan | destination(1-255), purpose(1-2000), startDate, endDate, estimatedCost ≥ 0 |
| `approveBusinessTripSchema` | Approve/Reject trip | notes optional (max 1000 karakter) |
| `createTravelAdvanceSchema` | Cairkan uang muka | amount > 0, disbursedAt opsional, notes |
| `createExpenseClaimSchema` | Submit item claim | category ∈ 5 enum, amount > 0, expenseDate, receiptFilePath opsional 500 karakter, ocrExtractedAmount optional |
| `approveExpenseClaimSchema` | Approve/reject claim | notes ≤ 1000 |
| `reimburseExpenseClaimSchema` | Bayar ganti rugi ke karyawan | **`method ∈ ['TRANSFER','PAYROLL']`** — ini WAJIB dipilih! Amount opsional (jika tidak diisi = default claim amount), payrollDetailId conditional required jika PAYROLL |

---

## 🔌 List 15 API Endpoints
Semua route di [travel-expense.routes.ts](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/modules/travel-expense/travel-expense.routes.ts#L52-L112). Base URL: `{APP_URL}{API_PREFIX}/travel-expenses`

| Method | Route | Middleware Auth & Role | Deskripsi |
|---|---|---|---|
| GET | `/categories` | `authenticate` + semua role | List 5 kategori biaya |
| GET | `/trips` | Approver roles | List semua trips difilter company (filter status via query `?status=APPROVED`) |
| GET | `/trips/my` | Employee roles | List trip milik user yang login sendiri |
| **POST** | `/trips` | Employee roles + `validate(createBusinessTripSchema)` | Submit perjalanan baru |
| PATCH | `/trips/:id/approve` | Approver roles + `validate(approveBusinessTripSchema)` | Setujui perjalanan |
| PATCH | `/trips/:id/reject` | Approver roles + `validate(approveBusinessTripSchema)` | Tolak perjalanan |
| **POST** | `/trips/:id/advance` | Approver roles + `validate(createTravelAdvanceSchema)` | Cairkan uang muka ke trip ID tersebut |
| GET | `/claims` | Approver roles | Semua claim company |
| GET | `/claims/my` | Employee roles | Claim sendiri |
| **POST** | `/claims/receipt-upload` | Employee roles + `multer upload.single('receipt')` | Upload file kuitansi → kembali file URL |
| **POST** | `/claims` | Employee roles + `validate(createExpenseClaimSchema)` | Submit 1 item pertanggungjawaban |
| PATCH | `/claims/:id/approve` | Approver roles + `validate(approveExpenseClaimSchema)` | Approve 1 claim item + audit approval |
| PATCH | `/claims/:id/reject` | Approver roles + `validate(approveExpenseClaimSchema)` | Reject 1 claim item + audit approval |
| **POST** | `/claims/:id/reimburse` | Approver roles + `validate(reimburseExpenseClaimSchema)` | Proses pembayaran ganti rugi (TRANSFER / PAYROLL) |

---

## 📊 Data Flow Antar-Module Integration

### Hubungan Modul Travel-Expense ↔ Modul Lain
| Modul Target | Data Apa Yang Dikirim | Kapan Trigger |
|---|---|---|
| **Module Employee** | Employee ID lookup + nama lengkap di list response (`findTrips` include employee: select fullName, employeeNumber) | Saat list query semua route |
| **Module Workflow Engine** | (Future-ready) → Stage approval trip multi-level (Saat ini level approval cuma 1, nanti bisa pindahkan ke no-code workflow engine) | Buat trip / claim SUBMITTED |
| **Module Notification (Notification Center)** | Event domain: `TravelRequested`, `TripApproved`, `TripRejected`, `ExpenseClaimSubmitted`, `ExpenseClaimApproved`, `ExpenseReimbursed` | Status change |
| 🔜 **Module Payroll (employee_salary_components)** | ✅ **Method `PAYROLL`**: insert baris `component_type = ALLOWANCE`, `category = REIMBURSEMENT` ke table `employee_salary_components` milik karyawan pada `payroll_period` aktif → `payrollDetailId` diisi kembali ke reimbursement. | Saat method = PAYROLL di call `reimburseClaim()` |
| 🔜 **Module Reports** | Headcount biaya perjalanan per departemen, summary per category, total advance outstanding (belum di-reconcile per karyawan) | Laporan bulanan |
| 🔜 **Module Audit Log** | Otomatis semua PATCH/POST endpoint tercatat di audit_logs tabel (old/new values, IP, actor) | Middleware global |

---

## 🚨 Important Business Rules (Belum Semua Dicek Otomatis — Saat Ini Masih Manual Check Di UI Approver)

Ada **6 aturan bisnis kritis** yang sekarang logic-nya masih diandalkan dari judgment manusia (Manager/HR) saat approve — next step bisa ditambahkan sebagai hard validation di `service` layer:

| # | Aturan Bisnis | Validasi Saat Ini | Idealnya (Hardening / Production) |
|---|---|---|---|
| 1 | **Travel Advance max 70%** dari `estimatedCost` trip | HR hitung manual | Repository `createAdvance()` validasi SUM(all advance per trip) ≤ 0.7 × estimatedCost |
| 2 | Tanggal `endDate` trip harus **> `startDate`** | Zod string date no validate | Zod refine: endDate >= startDate + 0 hari (bisa 1 hari trip yang sama) |
| 3 | `expenseDate` claim **harus di dalam range tanggal trip** (jika claim memiliki tripId) | Manager cek manual | Repository createClaim() jika tripId ada maka validasi: expenseDate BETWEEN trip.startDate AND trip.endDate + 2 hari tolerance |
| 4 | Trip yang **status REJECTED / CANCELLED** **tidak bisa create claim / advance** | Manager tau dari UI | Validasi di repository: throw BadRequest jika trip.status ∉ [APPROVED, COMPLETED] |
| 5 | Claim yang **APPROVED amount TIDAK BOLEH > SUM advance belum settle** — jika over, sisa di tagih ke payroll deduction | Manual cek spreadsheet | Business rule flag: advanceOverCollection=true, auto create loan / deduction component di payroll bulan berikutnya |
| 6 | **OCR validation** — jika `ocrExtractedAmount` di-set, harusnya match ±5% dengan amount user input (deteksi stempel kuitansi & nominal di-edit) | Belum ada OCR integrated | Integrasi OCR.ai / Google Vision untuk auto extract amount & compare. Deviasi >10% → claim auto flag "Need Manager Review 2x" + warn user |

---

## 🎯 TL;DR: Alur 8 Step Semua Terintegrasi

```
1️⃣ Karyawan BUAT permohonan perjalanan dinas (Trip)
      ↓ status: REQUESTED
2️⃣ Manager APPROVE Trip
      ↓ status: APPROVED
3️⃣ HR CAIRKAN Travel Advance (uang muka 70% via transfer)
      ↓ travel_advances.reconciled = false
4️⃣ Karyawan BERANGKAT → selesai trip → PULANG
      ↓
5️⃣ Karyawan UPLOAD 7 struk → BUAT 7 Expense Claim rows
      ↓ status: SUBMITTED × 7
6️⃣ Manager APPROVE 7 claim (ada yang REJECT jika tidak valid)
      ↓ status APPROVED × 6 + REJECTED ×1
      ↓ terbentuk 7 row expense_approvals level 1
7️⃣ Finance REIMBURSE claim approved:
   Rp 2.898.000 (6 claim) - Rp 2.275.000 (advance) = Rp 623.000 sisa
     └─> Method: TRANSFER / PAYROLL
     └─> terbentuk row reimbursements method=xxx, payrollDetailId?=....
8️⃣ TRIP status = COMPLETED. Travel advance reconciled=true.
     ✅ FLOW SELESAI. Audit log lengkap di 5 tabel.
```
