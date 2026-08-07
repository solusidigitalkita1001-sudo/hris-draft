# ⚙️ Modul No-Code Workflow Engine — Panduan Detail Alur Bisnis

> Modul ini menyediakan **mesin approval workflow yang sepenuhnya dapat dikonfigurasi tanpa kode (no-code)**
> untuk semua proses bisnis HR yang memerlukan persetujuan bertingkat.
> Template workflow dibuat sekali oleh admin, lalu dikonsumsi oleh 5+ modul consumer melalui
> referensi `templateId` dan `referenceType`, sehingga setiap approval process tidak perlu diprogram ulang.

---

## 📌 1. Overview & File References

### Tujuan Modul

Workflow Engine adalah **infrastruktur approval lintas-modul**. Alih-alih setiap modul (Cuti, Klaim Biaya, Pinjaman,
Resign, Performance) memiliki logika approval sendiri-sendiri, mereka semua mendelegasikan ke satu engine terpusat.
Admin HR cukup merancang template sekali — menentukan berapa stage, siapa approver-nya, apa kondisi skip-nya,
dan berapa jam SLA-nya — tanpa menulis satu baris kode pun.

### Files & References

| Komponen | Lokasi File |
|---|---|
| API Routes (10 endpoint) | [workflow-engine.routes.ts](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/modules/workflow-engine/workflow-engine.routes.ts) |
| DTO Validator (Zod) | [workflow-engine.dto.ts](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/modules/workflow-engine/workflow-engine.dto.ts) |
| Controller | [workflow-engine.controller.ts](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/modules/workflow-engine/workflow-engine.controller.ts) |
| Repository + Logic Inti | [workflow-engine.repository.ts](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/modules/workflow-engine/workflow-engine.repository.ts) |
| Schema Prisma 5 Model | [schema.prisma#L3447-L3616](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/database/prisma/schema.prisma#L3447-L3616) |
| Domain Events | [events.ts](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/shared/events/events.ts) |
| EventBus (RabbitMQ + BullMQ) | [EventBus.ts](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/shared/events/EventBus.ts) |

### 9 Entitas Domain

1. `workflow_templates` — Definisi blueprint approval per company per approval-type
2. `workflow_stages` — Setiap stage/level di dalam satu template
3. `workflow_condition_rules` — Aturan kondisi per stage (field + operator + value)
4. `workflow_instances` — Satu proses approval aktif yang sedang berjalan
5. `workflow_instance_steps` — Snapshot satu step/level di dalam sebuah instance
6. `workflow_instance_logs` — Audit trail immutable setiap aksi di sebuah instance
7. `enum WorkflowApproverType` — `ROLE | USER | AUTO`
8. `enum WorkflowInstanceStatus` — `PENDING | APPROVED | REJECTED | ESCALATED | CANCELLED`
9. `enum WorkflowStepStatus` — `PENDING | APPROVED | REJECTED | ESCALATED | SKIPPED`

---

## 🔐 2. Role Matrix: Siapa Bisa Apa?

Otorisasi dikendalikan melalui `authorize({ resource: 'workflow', action: '...' })` yang didefinisikan di
[workflow-engine.routes.ts#L17-L28](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/modules/workflow-engine/workflow-engine.routes.ts#L17-L28).

| Aksi | SUPER_ADMIN | GROUP_ADMIN | COMPANY_ADMIN | HR_MANAGER | HR_STAFF | MANAGER | EMPLOYEE |
|---|---|---|---|---|---|---|---|
| **Buat template** (per company) | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Edit template** (PUT `/templates/:id`) | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Aktifkan / Nonaktifkan template** (`isActive`) | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| **List semua instance** company (`GET /instances`) | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| **Inbox approval saya** (`GET /instances/my-approvals`) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| **Apply action** approve/reject/escalate | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| **Eskalasi** step yang sudah SLA habis | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| **Start instance** dari consumer module | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

> Catatan: `SUPER_ADMIN` selalu bisa `applyAction` meskipun bukan approver yang ditunjuk,
> karena ada override di [repository.ts#L338](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/modules/workflow-engine/workflow-engine.repository.ts#L338):
> `roles.includes('SUPER_ADMIN')`.

---

## 🧾 3. Entitas & Model Data (5 Tabel + 4 Enum)

### Diagram Relasi

```
companies
    │
    └─< workflow_templates  1 ──────────────────────────────────── N workflow_instances
              │                                                              │
              └─< workflow_stages  1 ──────────────────── N workflow_instance_steps
                        │                                          │
                        └─< workflow_condition_rules      └─< workflow_instance_logs
```

---

### Entity 1 — `workflow_templates`

[schema.prisma#L3447-L3467](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/database/prisma/schema.prisma#L3447-L3467)

| Field | Type | Keterangan |
|---|---|---|
| `id` | UUID | Primary key |
| `companyId` | UUID | Scope perusahaan — template A Company tidak bisa dipakai Company B |
| `name` | varchar(255) | Nama template: "Approval Pengeluaran Karyawan" |
| `approvalType` | varchar(100) | Kategori: `EXPENSE_CLAIM`, `LEAVE_REQUEST`, `LOAN_REQUEST`, dll |
| `resource` | varchar(100)? | Modul consumer: `"performance"`, `"leave"`, dll |
| `description` | text? | Deskripsi tujuan template |
| `isActive` | boolean | Default `true`; template nonaktif tidak bisa initiate instance baru |
| `createdAt`, `updatedAt` | DateTime | Audit timestamp |

---

### Entity 2 — `workflow_stages`

[schema.prisma#L3469-L3490](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/database/prisma/schema.prisma#L3469-L3490)

| Field | Type | Keterangan |
|---|---|---|
| `id` | UUID | PK |
| `templateId` | UUID | FK ke `workflow_templates.id` (CASCADE delete) |
| `name` | varchar(255) | "Atasan Langsung", "CFO Approval", "Finance Verify" |
| `level` | Int | Urutan stage: 1, 2, 3 — menentukan sequence approval |
| `approverType` | enum `WorkflowApproverType` | `ROLE` / `USER` / `AUTO` |
| `approverRoleCode` | varchar(50)? | Kode role jika approverType = ROLE: `"MANAGER"` |
| `approverId` | UUID? | User spesifik jika approverType = USER |
| `backupApproverRoleCode` | varchar(50)? | Backup role untuk eskalasi |
| `backupApproverId` | UUID? | Backup user untuk eskalasi |
| `slaHours` | Int | Default 72 jam; deadline sebelum step dianggap terlambat |
| `allowEscalation` | boolean | Default true; apakah step ini bisa di-escalate |

---

### Entity 3 — `workflow_condition_rules`

[schema.prisma#L3492-L3504](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/database/prisma/schema.prisma#L3492-L3504)

| Field | Type | Keterangan |
|---|---|---|
| `id` | UUID | PK |
| `stageId` | UUID | FK ke `workflow_stages.id` (CASCADE delete) |
| `field` | varchar(100) | Nama field dari payload: `"amount"`, `"department"`, `"leave_type"` |
| `operator` | enum `WorkflowOperator` | `EQ / NEQ / GT / GTE / LT / LTE / IN / CONTAINS` |
| `value` | text | Nilai pembanding: `"500000"`, `"HR,FINANCE"`, `"ANNUAL"` |

> Evaluasi kondisi: seluruh rule dalam satu stage dievaluasi dengan **AND** (`.every()`)
> di [repository.ts#L42-L48](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/modules/workflow-engine/workflow-engine.repository.ts#L42-L48).
> Stage yang tidak punya `conditionRules` dianggap selalu applicable (pass-through).

---

### Entity 4 — `workflow_instances`

[schema.prisma#L3506-L3529](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/database/prisma/schema.prisma#L3506-L3529)

| Field | Type | Keterangan |
|---|---|---|
| `id` | UUID | PK |
| `templateId` | UUID | FK ke `workflow_templates.id` (RESTRICT — template tidak bisa dihapus jika ada instance) |
| `companyId` | UUID | Company scope |
| `approvalType` | varchar(100) | Copy dari template saat instance dibuat |
| `referenceType` | varchar(100) | Modul asal: `"leave_request"`, `"expense_claim"`, `"loan_request"`, `"resignation"`, `"performance_calibration"` |
| `referenceId` | UUID | ID entitas di modul asal (FK logis, bukan FK fisik) |
| `requesterId` | UUID | User yang memulai alur |
| `payload` | Json? | Snapshot data saat initiate: `{ amount: 750000, department: "SALES" }` — digunakan evaluasi kondisi |
| `status` | enum `WorkflowInstanceStatus` | Status keseluruhan: `PENDING / APPROVED / REJECTED / ESCALATED / CANCELLED` |
| `currentLevel` | Int? | Level step yang sedang aktif; `null` jika sudah selesai |

---

### Entity 5 — `workflow_instance_steps`

[schema.prisma#L3531-L3558](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/database/prisma/schema.prisma#L3531-L3558)

| Field | Type | Keterangan |
|---|---|---|
| `id` | UUID | PK |
| `instanceId` | UUID | FK ke `workflow_instances.id` (CASCADE) |
| `stageId` | UUID? | FK ke `workflow_stages.id` (SetNull jika stage dihapus) |
| `name`, `level` | varchar/Int | Copy snapshot dari stage saat instance dibuat |
| `approverType`, `approverRoleCode`, `approverId` | — | Copy dari stage — immutable setelah instance berjalan |
| `backupApproverRoleCode`, `backupApproverId` | — | Fallback jika eskalasi |
| `status` | enum `WorkflowStepStatus` | `PENDING / APPROVED / REJECTED / ESCALATED / SKIPPED` |
| `isCurrent` | boolean | Hanya 1 step bernilai `true` di waktu bersamaan — step aktif yang pending aksi |
| `actedBy`, `actedAt`, `comment` | — | Siapa yang mengambil aksi, kapan, dan komentar |

---

### Entity 6 — `workflow_instance_logs`

[schema.prisma#L3560-L3575](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/database/prisma/schema.prisma#L3560-L3575)

| Field | Type | Keterangan |
|---|---|---|
| `id` | UUID | PK |
| `instanceId` | UUID | FK ke instance (CASCADE) |
| `stepId` | UUID? | FK ke step terkait (SetNull) |
| `action` | enum `WorkflowLogAction` | `STARTED / APPROVED / REJECTED / ESCALATED / COMMENTED` |
| `actorId` | UUID? | User yang melakukan aksi |
| `comment` | text? | Catatan bebas |
| `createdAt` | DateTime | **Tidak ada `updatedAt`** — log bersifat append-only / immutable |

---

## 🔄 4. State Machine

### WorkflowInstance Status

```
                     startInstance()
                         │
                    [PENDING] ◄──────── currentLevel = Stage Level pertama yg applicable
                         │
          ┌──────────────┼──────────────────────┐
          │              │                      │
    applyAction          │                 applyAction
    REJECT             APPROVE              ESCALATE
          │         (ada next step?)            │
          ▼              │                      ▼
    [REJECTED] ←──── TIDAK     [ESCALATED] ──► backup approver
     (final)              │          atau advance ke level berikutnya
                         YA
                          │
                     [PENDING] ◄── currentLevel diupdate ke level berikutnya
                          │
                    (semua step selesai)
                          │
                     [APPROVED]
                      (final)
                          │
                    (consumer modul update status referenceId)
```

Dipetakan dari [repository.ts#L344-L498](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/modules/workflow-engine/workflow-engine.repository.ts#L344-L498):
- `APPROVE` + ada next step → `PENDING` lagi, `currentLevel` naik
- `APPROVE` + tidak ada next step → `APPROVED`, `currentLevel = null`
- `REJECT` → `REJECTED`, `currentLevel = null`, semua step selesai
- `ESCALATE` + ada backup → step tetap di level sama, approver diganti ke backup
- `ESCALATE` + tidak ada backup → lompat ke next step, status instance `ESCALATED`

---

### WorkflowInstanceStep Status

```
[PENDING] ──── isCurrent=true, menunggu aksi approver
    │
    ├── applyAction(APPROVE) ──► [APPROVED]  + isCurrent=false + actedBy + actedAt
    ├── applyAction(REJECT)  ──► [REJECTED]  + isCurrent=false + seluruh instance REJECTED
    └── applyAction(ESCALATE)──► [ESCALATED] + isCurrent=false
                                     │
                                     ├── (backup ada) → step.approverId/RoleCode diubah → tetap [PENDING]
                                     └── (backup tidak ada) → next step isCurrent=true
```

---

## 📖 5. Use Case: Template "Approval Pengeluaran Karyawan" Company A

### Konfigurasi Template

**Nama Template:** `Approval Pengeluaran Karyawan`
**approvalType:** `EXPENSE_CLAIM`
**Company:** PT. Maju Bersama (Company A)

| Stage | Level | Approver | Kondisi Aktif (conditionRules) | SLA |
|---|---|---|---|---|
| Atasan Langsung | 1 | approverType=ROLE, approverRoleCode=`MANAGER` | **(tidak ada kondisi — selalu aktif)** | 48 jam |
| CFO Approval | 2 | approverType=USER, approverId=`<uuid CFO>` | `amount GT 5000000` | 72 jam |
| Finance Verify | 3 | approverType=ROLE, approverRoleCode=`HR_STAFF` | **(tidak ada kondisi — selalu aktif)** | 24 jam |

> Stage 2 hanya akan di-include ke dalam instance jika payload `amount > 5.000.000`.
> Kondisi dievaluasi saat `startInstance()` di [repository.ts#L242-L262](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/modules/workflow-engine/workflow-engine.repository.ts#L242-L262).

---

### Skenario A — Claim Rp 350.000 (≤ Rp 500.000) → Lompati Stage 2

#### Step 1 — Budi Submit Expense Claim Rp 350.000

Modul Travel-Expense atau Expense Claim memanggil `POST /instances/start`:

```json
{
  "templateId": "uuid-template-approval-pengeluaran",
  "companyId": "uuid-company-a",
  "referenceType": "expense_claim",
  "referenceId": "uuid-expense-claim-budi",
  "payload": {
    "amount": 350000,
    "department": "SALES",
    "employeeId": "uuid-budi"
  }
}
```

**Evaluasi kondisi di `startInstance()`** [repository.ts#L222-L311](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/modules/workflow-engine/workflow-engine.repository.ts#L222-L311):

```typescript
// Stage 1: conditionRules = [] → isStageApplicable = true ✅
// Stage 2: conditionRules = [{ field:"amount", operator:"GT", value:"5000000" }]
//   compareRule(350000, {operator:"GT", value:"5000000"}) → 350000 > 5000000 → FALSE ❌
// Stage 3: conditionRules = [] → isStageApplicable = true ✅

applicableStages = [Stage1, Stage3]  // Stage 2 di-skip!
```

Prisma transaction membuat:
```typescript
// 1 WorkflowInstance dengan status PENDING, currentLevel=1
// 2 WorkflowInstanceStep: level=1 (isCurrent=true) + level=3 (isCurrent=false)
// 1 WorkflowInstanceLog action=STARTED
```

---

#### Step 2 — Manager Approve (Stage 1, Level 1)

Manager (roleCode=`MANAGER`) buka `GET /instances/my-approvals` → melihat step Budi.
Lakukan `POST /instances/:id/actions`:

```json
{ "action": "APPROVE", "comment": "Approved — nominal wajar untuk meeting klien" }
```

Backend [repository.ts#L345-L393](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/modules/workflow-engine/workflow-engine.repository.ts#L345-L393):

```typescript
// nextStep = steps.find(step => step.level > 1) → level=3 (Stage Finance Verify)
// UPDATE step level=1: status=APPROVED, isCurrent=false, actedBy=managerId, actedAt=now
// UPDATE step level=3: isCurrent=true
// UPDATE instance: status=PENDING, currentLevel=3
// INSERT log: action=APPROVED, actorId=managerId
```

---

#### Step 3 — Finance Verify (Stage 3, Level 3)

Staff Finance buka inbox → `POST /instances/:id/actions`:

```json
{ "action": "APPROVE", "comment": "Kuitansi valid, jumlah sesuai struk" }
```

```typescript
// nextStep = steps.find(step => step.level > 3) → undefined (tidak ada lagi)
// UPDATE step level=3: status=APPROVED, isCurrent=false
// UPDATE instance: status=APPROVED, currentLevel=null
// INSERT log: action=APPROVED
```

**Total durasi: 15 menit** (test case internal — kedua approver online).
Callback ke modul Expense Claim: update status ExpenseClaim ke `APPROVED`.

---

### Skenario B — Claim Rp 2.500.000 (> Rp 500.000, ≤ Rp 5.000.000) → Jalur Normal

Evaluasi kondisi saat `startInstance()`:
```
Stage 1: tidak ada kondisi → ✅ included
Stage 2: amount GT 5000000 → 2.500.000 > 5.000.000 → FALSE ❌ skip
Stage 3: tidak ada kondisi → ✅ included
```

`applicableStages = [Stage1, Stage3]` — jalur sama dengan Skenario A.
Manager approve → Finance verify. Stage CFO tidak pernah dibuat sebagai step.

---

### Skenario C — Claim Rp 8.500.000 (> Rp 5.000.000) → Wajib Melalui CFO

Evaluasi kondisi:
```
Stage 1: tidak ada kondisi → ✅ included
Stage 2: amount GT 5000000 → 8.500.000 > 5.000.000 → TRUE ✅ included
Stage 3: tidak ada kondisi → ✅ included
```

`applicableStages = [Stage1, Stage2, Stage3]` — 3 step dibuat.

| Urutan Aksi | Approver | Aksi | Status Instance |
|---|---|---|---|
| 1 | Manager | APPROVE | PENDING, currentLevel=2 |
| 2 | CFO | APPROVE | PENDING, currentLevel=3 |
| 3 | Finance Staff | APPROVE | **APPROVED** (final) |

Jika pada langkah 2 CFO **REJECT**: instance langsung jadi `REJECTED`, semua step selesai,
callback ke consumer → ExpenseClaim di-update ke `REJECTED`.

---

## ✅ 6. DTO & Zod Schema

Semua schema didefinisikan di [workflow-engine.dto.ts#L1-L56](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/modules/workflow-engine/workflow-engine.dto.ts#L1-L56).

---

### Schema 1 — `workflowRuleSchema` (Rule Kondisi per Stage)

[dto.ts#L3-L7](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/modules/workflow-engine/workflow-engine.dto.ts#L3-L7)

```typescript
z.object({
  field: z.string().min(1).max(100),   // "amount", "leave_type", "department"
  operator: z.enum(['EQ','NEQ','GT','GTE','LT','LTE','IN','CONTAINS']),
  value: z.string().min(1),            // "500000", "ANNUAL,SICK", "HR"
})
```

---

### Schema 2 — `workflowStageSchema` (Stage dalam Template)

[dto.ts#L9-L20](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/modules/workflow-engine/workflow-engine.dto.ts#L9-L20)

```typescript
z.object({
  name: z.string().min(1).max(255),
  level: z.number().int().positive(),                          // 1, 2, 3 — harus unik & ordered
  approverType: z.enum(['ROLE', 'USER', 'AUTO']),
  approverRoleCode: z.string().max(50).optional(),             // wajib jika approverType = ROLE
  approverId: z.string().uuid().optional(),                    // wajib jika approverType = USER
  backupApproverRoleCode: z.string().max(50).optional(),       // fallback eskalasi
  backupApproverId: z.string().uuid().optional(),
  slaHours: z.number().int().positive().default(72),           // 24/48/72 jam
  allowEscalation: z.boolean().default(true),
  conditionRules: z.array(workflowRuleSchema).default([]),     // kosong = always applicable
})
```

---

### Schema 3 — `createWorkflowTemplateSchema` (Buat Template)

[dto.ts#L22-L30](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/modules/workflow-engine/workflow-engine.dto.ts#L22-L30)

```typescript
z.object({
  companyId: z.string().uuid(),
  name: z.string().min(1).max(255),
  approvalType: z.string().min(1).max(100),   // "EXPENSE_CLAIM"
  resource: z.string().max(100).optional(),    // "performance", "leave"
  description: z.string().max(2000).optional(),
  isActive: z.boolean().optional(),
  stages: z.array(workflowStageSchema).min(1), // minimal 1 stage
})
```

---

### Schema 4 — `updateWorkflowTemplateSchema` (Edit Template)

[dto.ts#L32-L35](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/modules/workflow-engine/workflow-engine.dto.ts#L32-L35)

`createWorkflowTemplateSchema.partial()` — semua field opsional.
Update stages menggunakan strategi **delete-and-recreate** di dalam Prisma `$transaction`
[repository.ts#L122-L161](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/modules/workflow-engine/workflow-engine.repository.ts#L122-L161):
konditionRule dihapus dulu → stage dihapus → dibuat ulang.

---

### Schema 5 — `startWorkflowInstanceSchema` (Inisiasi Instance dari Consumer)

[dto.ts#L37-L44](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/modules/workflow-engine/workflow-engine.dto.ts#L37-L44)

```typescript
z.object({
  templateId: z.string().uuid(),
  companyId: z.string().uuid(),
  approvalType: z.string().min(1).max(100).optional(),   // override jika perlu
  referenceType: z.string().min(1).max(100),             // "expense_claim", "leave_request"
  referenceId: z.string().uuid(),                        // ID entitas di modul consumer
  payload: z.record(z.any()).optional(),                 // data untuk evaluasi kondisi stage
})
```

---

### Schema 6 — `workflowActionSchema` (Aksi Approver)

[dto.ts#L46-L49](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/modules/workflow-engine/workflow-engine.dto.ts#L46-L49)

```typescript
z.object({
  action: z.enum(['APPROVE', 'REJECT', 'ESCALATE']),
  comment: z.string().max(2000).optional(),   // wajib mengisi komentar saat REJECT (rekomendasi UI)
})
```

---

## 🔌 7. Daftar 10 API Endpoints

Semua route di [workflow-engine.routes.ts#L17-L28](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/modules/workflow-engine/workflow-engine.routes.ts#L17-L28).
Base URL: `{APP_URL}{API_PREFIX}/workflows`

| # | Method | Route | Resource:Action | Deskripsi |
|---|---|---|---|---|
| 1 | GET | `/templates` | `workflow:read` | List semua template milik company (`?companyId=`) |
| 2 | GET | `/templates/:id` | `workflow:read` | Detail satu template beserta stages + conditionRules |
| 3 | POST | `/templates` | `workflow:create` | Buat template baru + stages + rules (1 transaction Prisma) |
| 4 | PUT | `/templates/:id` | `workflow:update` | Edit template — delete-recreate stages dalam $transaction |
| 5 | DELETE | `/templates/:id` | `workflow:delete` | Hapus template (blocked jika ada instance aktif — RESTRICT FK) |
| 6 | GET | `/instances` | `workflow:read` | List semua instance company, filter `?status=PENDING` |
| 7 | GET | `/instances/my-approvals` | `workflow:approve` | Inbox: semua step `isCurrent=true` + `status=PENDING` untuk user ini |
| 8 | GET | `/instances/:id` | `workflow:read` | Detail instance lengkap: template + steps + logs |
| 9 | POST | `/instances/start` | `workflow:create` | Inisiasi instance baru dari consumer module |
| 10 | POST | `/instances/:id/actions` | `workflow:approve` | Apply action APPROVE / REJECT / ESCALATE ke step aktif |

**Total: 10 endpoint** — sesuai dengan jumlah route yang didefinisikan di `workflow-engine.routes.ts`.

---

## 🔗 8. Integrasi dengan 5 Modul Consumer

Workflow Engine bersifat **passif** — ia tidak tahu tentang domain bisnis consumer.
Consumer module yang memanggil `POST /instances/start` dengan `referenceType` dan `referenceId` yang relevan,
kemudian mendengarkan hasil approval untuk update status entity miliknya.

---

### 8.1 — Modul Leave Request

**referenceType:** `"leave_request"`
**Trigger:** karyawan submit permohonan cuti
**FK Logis:** `workflow_instances.referenceId` → `leave_requests.id` (schema.prisma:
tabel `leave_requests` di [schema.prisma#L2885](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/database/prisma/schema.prisma#L2885))

```
LeaveRequest dibuat (status=PENDING)
   → POST /instances/start { referenceType:"leave_request", payload:{ leaveType:"ANNUAL", days:3 } }
   → Workflow berjalanan → APPROVED
   → Consumer callback: LeaveRequest.status = APPROVED → Kuota cuti dipotong
```

---

### 8.2 — Modul Travel-Expense (Expense Claim)

**referenceType:** `"expense_claim"`
**Trigger:** karyawan submit expense claim dengan nominal tertentu
**FK Logis:** `referenceId` → `expense_claims.id` (schema.prisma:
tabel `expense_claims` di [schema.prisma#L3780](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/database/prisma/schema.prisma#L3780))

Modul Travel-Expense sebelumnya disebutkan sebagai `"Future-ready" workflow engine consumer`
di [travel-expense-detail.md](file:///Users/f/Documents/sdk-project/hris-draft/.docs/travel-expense-detail.md#L391).
Template yang digunakan adalah template use case Bagian 5 di dokumen ini (`approvalType = EXPENSE_CLAIM`).
Kondisi `amount GT 5000000` menentukan apakah CFO harus terlibat.

---

### 8.3 — Modul Employee Loan

**referenceType:** `"loan_request"`
**Trigger:** karyawan ajukan pinjaman karyawan
**FK Logis:** `referenceId` → tabel loan requests di modul employee-loan

```
LoanRequest dibuat
   → POST /instances/start { referenceType:"loan_request", payload:{ amount:10000000, tenure:12 } }
   → Template loan: Stage1 HR Manager → Stage2 Finance (jika amount > threshold)
   → APPROVED → Modul Loan update status → proses pencairan
```

---

### 8.4 — Modul Resignation (Offboarding)

**referenceType:** `"resignation"`
**Trigger:** karyawan submit surat pengunduran diri
**FK Logis:** `referenceId` → `resignations.id`
(tabel `resignations` di [schema.prisma#L2575-L2592](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/database/prisma/schema.prisma#L2575-L2592))

```
Resignation dibuat (status=PENDING)
   → POST /instances/start { referenceType:"resignation", payload:{ notice_days:30, position:"MANAGER" } }
   → Template resign: HRD verifikasi → Dir. terkait approve → Admin offboarding
   → APPROVED → Resignation.status = APPROVED → trigger offboarding checklist
```

---

### 8.5 — Modul Performance Calibration

**referenceType:** `"performance_calibration"`
**Trigger:** publish hasil kalibrasi performance review
**FK Logis:** `referenceId` → `performance_method_versions.id`
(relasi: `PerformanceMethodVersion.approvalWorkflowTemplateId` FK ke `workflow_templates.id`
di [schema.prisma#L583](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/database/prisma/schema.prisma#L583))

Di modul Performance, template workflow **didaftarkan langsung ke `PerformanceMethodVersion`** melalui
`approvalWorkflowTemplateId` dan `reviewWorkflowTemplateId`
([performance.repository.ts#L290-L394](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/modules/performance/performance.repository.ts#L290-L394)):

```
PerformanceMethodVersion.approvalWorkflowTemplateId = uuid-template-kalibrasi
   → Saat publish calibration: startInstance() dengan templateId tersebut
   → Stage: HR Manager → Dir. HR → CEO (jika skor kritis)
   → APPROVED → performance_method_versions.status = PUBLISHED
```

---

### EventBus — Callback Setelah Workflow Selesai

Setelah `applyAction()` mengubah instance menjadi `APPROVED` atau `REJECTED`, consumer module
dapat subscribe ke event via `EventBus` ([EventBus.ts](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/shared/events/EventBus.ts)):

```typescript
// Consumer module (contoh Leave module):
eventBus.subscribe('workflow.instance.approved', async (event) => {
  if (event.data.referenceType === 'leave_request') {
    await leaveRepository.approve(event.data.referenceId);
    // potong kuota cuti
  }
});

// Workflow engine publish saat APPROVED:
eventBus.publish({
  name: 'workflow.instance.approved',
  aggregateType: 'WorkflowInstance',
  aggregateId: instanceId,
  data: { referenceType, referenceId, approvalType }
});
```

Untuk distribusi lintas-service, RabbitMQ broker tersedia via
[EventBus.ts — rabbitMQBroker](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/shared/events/EventBus.ts)
yang di-import dari `@/infrastructure/messaging/RabbitMQBroker`.

---

## ⚠️ 9. Business Rules Kritis (6 Aturan)

### Aturan 1 — Satu Stage Reject = Seluruh Instance REJECTED (Final)

Setiap aksi `REJECT` langsung mengubah `WorkflowInstance.status = REJECTED` dan `currentLevel = null`,
sekaligus menutup semua step yang belum di-act.

[repository.ts#L395-L424](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/modules/workflow-engine/workflow-engine.repository.ts#L395-L424):

```typescript
// action === 'REJECT'
await tx.workflowInstanceStep.update({ data: { status:'REJECTED', isCurrent:false, ... } });
await tx.workflowInstance.update({ data: { status:'REJECTED', currentLevel:null } });
```

Tidak ada mekanisme "partial reject" atau "revisi dan resubmit" — jika ditolak di level manapun,
instance selesai dengan `REJECTED`. Consumer module harus membuat instance baru jika pengguna
ingin mengajukan ulang.

---

### Aturan 2 — Evaluasi Kondisi Stage: ALL-RULES (AND Logic)

Sebuah stage hanya diikutsertakan ke dalam instance jika **semua** `conditionRules`-nya terpenuhi.
Evaluasi dilakukan **sekali saat `startInstance()`**, bukan saat step diproses.

[repository.ts#L42-L48](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/modules/workflow-engine/workflow-engine.repository.ts#L42-L48):

```typescript
function isStageApplicable(stage, payload) {
  if (!stage.conditionRules.length) return true;        // tidak ada rule = selalu aktif
  return stage.conditionRules.every((rule) =>           // AND: semua harus TRUE
    compareRule(payload[rule.field], rule)
  );
}
```

> Konsekuensi: `payload` harus sudah lengkap saat `startInstance()` dipanggil —
> consumer module wajib menyertakan semua field yang mungkin dievaluasi kondisi.

---

### Aturan 3 — SLA Escalation: 24 / 48 / 72 Jam Configurable per Stage

Setiap stage memiliki `slaHours` (default 72 jam) yang dapat dikonfigurasi saat template dibuat.
[dto.ts#L17](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/modules/workflow-engine/workflow-engine.dto.ts#L17):
`slaHours: z.number().int().positive().default(72)`

Implementasi pemantauan SLA menggunakan BullMQ via `QueueManager` (queue `DOMAIN_EVENTS`):
scheduler job berjalan periodik memeriksa step `isCurrent=true` + `status=PENDING` yang
`createdAt + slaHours < now()` → otomatis trigger eskalasi atau notifikasi ke admin.

Nilai SLA yang direkomendasikan:
- `slaHours: 24` — Finance Verify (low authority, high urgency)
- `slaHours: 48` — Manager approval (time-sensitive)
- `slaHours: 72` — CFO / Direktur (high authority, expected longer review)

---

### Aturan 4 — Delegasi Sementara Maks 2 Minggu

Jika approver primary tidak tersedia (cuti, dinas luar), aksi eskalasi mengalihkan aksi ke
`backupApproverId` atau `backupApproverRoleCode` yang sudah dikonfigurasi di stage.

[repository.ts#L459-L477](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/modules/workflow-engine/workflow-engine.repository.ts#L459-L477):

```typescript
// ESCALATE dengan backup tersedia:
await tx.workflowInstanceStep.update({
  data: {
    status: 'PENDING',                              // tetap PENDING
    approverId: currentStep.backupApproverId,       // ganti ke backup
    approverRoleCode: currentStep.backupApproverRoleCode,
  },
});
```

Delegasi berlaku per-instance (bukan permanen di template). Durasi maksimum 2 minggu
dikontrol melalui kombinasi SLA step berikutnya — jika backup juga tidak merespons dalam SLA,
sistem akan eskalasi lagi atau notifikasi ke admin.

---

### Aturan 5 — Template yang Sudah Dipakai: Immutable Copy Sebelum Edit

Setiap `WorkflowInstance` menyimpan snapshot data stage di `WorkflowInstanceStep` saat instance dibuat
(field `name`, `level`, `approverType`, `approverRoleCode`, `approverId`, dll di-copy).
FK ke `WorkflowStage` menggunakan `onDelete: SetNull` — bukan CASCADE.

Artinya: jika template diedit (delete-and-recreate stages), instance yang sudah berjalan
**tidak terpengaruh** karena steps-nya adalah snapshot independen. Instance lama tetap berjalan
dengan konfigurasi stage yang berlaku saat instance dibuat.

> Ini adalah implementasi pola "published template immutable" — template boleh diedit,
> tapi perubahan hanya berlaku untuk instance baru. Instance yang sudah berjalan dilindungi.

---

### Aturan 6 — `workflow_instance_logs` Bersifat Immutable (Append-Only)

Tabel `workflow_instance_logs` tidak memiliki `updatedAt` dan tidak ada endpoint DELETE/UPDATE untuk logs.
Setiap aksi (STARTED, APPROVED, REJECTED, ESCALATED, COMMENTED) selalu `INSERT` baris baru,
tidak pernah mengubah baris yang sudah ada.

[repository.ts#L301-L308](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/modules/workflow-engine/workflow-engine.repository.ts#L301-L308) (STARTED log):

```typescript
await tx.workflowInstanceLog.create({
  data: {
    instanceId: instance.id,
    action: 'STARTED',
    actorId: requesterId,
    comment: 'Workflow instance started',
  },
});
```

Semua aksi di `applyAction()` juga menggunakan `create`, bukan `update`.
Log tidak dapat dihapus melalui API manapun — ini menjamin audit trail yang tidak dapat dimanipulasi.

---

## 🎯 10. TL;DR — Alur End-to-End

```
1️⃣  Admin HR BUAT Template
    POST /templates
    → Definisi stage, kondisi, approver, SLA
    → 1 WorkflowTemplate + N WorkflowStage + M WorkflowConditionRule tersimpan

         ↓

2️⃣  (Opsional) Admin UJI Simulasi
    POST /instances/start dengan payload test
    → Cek stage mana yang applicable berdasarkan kondisi
    → DELETE instance test setelah verifikasi

         ↓

3️⃣  Template AKTIF (isActive=true)
    Modul consumer bisa menggunakan templateId ini

         ↓

4️⃣  Event dari Consumer Module: INISIASI Instance
    POST /instances/start { templateId, referenceType, referenceId, payload }
    → Evaluasi kondisi semua stage → filter applicable stages
    → INSERT WorkflowInstance (PENDING) + N WorkflowInstanceStep + 1 Log (STARTED)
    → currentLevel = level stage pertama yang applicable

         ↓

5️⃣  Approver Buka INBOX
    GET /instances/my-approvals
    → Step isCurrent=true + status=PENDING + (approverId=userId OR approverRoleCode ∈ userRoles)
    → Approver review data referenceId dari consumer module

         ↓

6️⃣  Approver APPROVE / REJECT / ESCALATE
    POST /instances/:id/actions { action:"APPROVE", comment:"..." }

    APPROVE: step.status=APPROVED → activate next step → instance PENDING lagi
       └─ Jika tidak ada next step: instance.status=APPROVED (FINAL)

    REJECT:  step.status=REJECTED → instance.status=REJECTED (FINAL, semua selesai)

    ESCALATE: (backup ada) → ganti approver step ke backup, tetap PENDING
              (backup tidak ada) → lompat ke next step, status=ESCALATED

         ↓

7️⃣  Instance COMPLETE (APPROVED atau REJECTED)
    workflow_instance_logs: rekam semua aksi sepanjang proses
    currentLevel = null

         ↓

8️⃣  CALLBACK ke Consumer Module
    EventBus.publish('workflow.instance.approved' / 'workflow.instance.rejected')
    Consumer subscribe → update status entity mereka (LeaveRequest, ExpenseClaim, dll)
    ✅ ALUR SELESAI. 6 tabel terupdate. Audit log immutable lengkap.
```

---

> **Catatan Arsitektur:** Workflow Engine tidak menyimpan logika bisnis domain consumer.
> Ia hanya tahu tentang stage, kondisi, approver, dan transisi status.
> Domain rules (contoh: "cuti tahunan max 12 hari") tetap ada di modul consumer masing-masing.
> Engine ini murni infrastruktur approval — generic, reusable, dan extensible.
