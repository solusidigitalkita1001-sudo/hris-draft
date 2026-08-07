# 🎯 Modul Performance Management — Panduan Detail Alur Bisnis

> Modul ini menangani **seluruh siklus manajemen kinerja karyawan** dari konfigurasi metode penilaian, perencanaan target, eksekusi & monitoring, kalibrasi komite, hingga publikasi hasil, dispute, dan penguncian akhir.
>
> Ruang lingkup modul mencakup:
> 1. **Konfigurasi Library** → Metode, Formula, Indikator, Grade Rule, Workflow Template
> 2. **Periode Penilaian** → Binding metode ke periode kalender dengan snapshot konfigurasi
> 3. **Planning (Penugasan Target)** → Penetapan target per karyawan per komponen KPI/Kompetensi/Lainnya
> 4. **Eksekusi (Check-in & Progress)** → Update progres, upload bukti, komentar mandiri
> 5. **Hasil & Kalkulasi** → Kalkulasi skor tertimbang otomatis berbasis formula
> 6. **Kalibrasi** → Sesi komite paksa distribusi bell curve
> 7. **Publikasi & Acknowledge** → Karyawan terima dan akui hasil
> 8. **Dispute / Keberatan** → Karyawan ajukan keberatan, HR/L2 merespons
> 9. **Final Lock** → Hasil dikunci untuk payroll & succession planning

---

## 📌 1. Overview & Codebase References

### Files & Lokasi

| Komponen | Lokasi File |
|---|---|
| API Routes (97 endpoints) | [performance.routes.ts](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/modules/performance/performance.routes.ts#L1-L219) |
| DTO Validator (Zod — 35+ schemas) | [performance.dto.ts](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/modules/performance/performance.dto.ts#L1-L436) |
| Controller | [performance.controller.ts](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/modules/performance/performance.controller.ts#L1-L777) |
| Service (business logic) | [performance.service.ts](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/modules/performance/performance.service.ts#L1-L3941) |
| Repository (Prisma queries) | [performance.repository.ts](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/modules/performance/performance.repository.ts#L1-L100) |
| Enums & Types | [performance.types.ts](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/modules/performance/performance.types.ts#L1-L48) |
| Prisma Schema (21 model) | [schema.prisma#L553-L1374](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/database/prisma/schema.prisma#L553-L1374) |
| Prisma Enums Performance | [schema.prisma#L3039-L3265](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/database/prisma/schema.prisma#L3039-L3265) |

### Ringkasan Arsitektur

Modul menggunakan pola **Controller → Service → Repository** yang ketat. Semua logika bisnis (kalkulasi skor, validasi readiness, forced distribution) berada di `PerformanceService`. Repository hanya mengandung query Prisma murni. Controller mengekstrak audit context (`userId`, `employeeId`, `companyId`, `ipAddress`, `userAgent`) dari request terautentikasi ([performance.controller.ts#L8-L20](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/modules/performance/performance.controller.ts#L8-L20)) dan meneruskannya ke service untuk audit trail.

Multer dikonfigurasi dengan dua storage terpisah:
- `evidenceUploadDirectory` → `uploads/performance/evidence/` untuk bukti target ([performance.routes.ts#L57-L83](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/modules/performance/performance.routes.ts#L57-L83))
- `attachmentUploadDirectory` → `uploads/documents/performance-results/` untuk lampiran hasil & dispute ([performance.routes.ts#L85-L106](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/modules/performance/performance.routes.ts#L85-L106))

---

## 🔐 2. Role Matrix: Siapa Bisa Apa?

Semua route diproteksi oleh middleware `authenticate` (baris [performance.routes.ts#L108](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/modules/performance/performance.routes.ts#L108)) diikuti `authorize({ resource: 'performance', action: '...' })`. Permission dipetakan dari RBAC system ke resource `performance` dengan action `read`, `create`, `update`, atau `approve`.

> **Catatan implementasi saat ini:** Guard `authorize` berbasis resource+action di permission table, bukan enum role hardcode. Mapping kolom di bawah merupakan inferensi dari konvensi HRIS — role SUPER_ADMIN, GROUP_ADMIN, COMPANY_ADMIN, HR_MANAGER mendapat akses penuh; MANAGER mendapat read + beberapa approve; EMPLOYEE terbatas pada baca hasil sendiri, acknowledge, dan dispute.

| Aksi | SUPER_ADMIN | GROUP_ADMIN | COMPANY_ADMIN | HR_MANAGER | HR_STAFF | MANAGER | EMPLOYEE |
|---|---|---|---|---|---|---|---|
| **Konfigurasi Metode (CRUD)** | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Buat / Update Method Version** | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Publish Method Version** | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| **CRUD Formula / Indikator** | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| **CRUD Grade Rule** | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| **CRUD Workflow Template** | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Buat/Update Periode** | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Publish Periode** | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Assign Employee (Planning)** | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| **Update / Delete Assignment** | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| **Reassign Assignment** | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| **Submit Planning (Karyawan self-submit)** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Approve / Reject Planning** | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ |
| **Upload Bukti (Evidence)** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Update Progress Target** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Lihat My Execution Assignments** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Hitung Hasil Kinerja (Calculate)** | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Buat Kalibrasi Session** | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Open / Close / Finalize Kalibrasi** | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Apply Calibration Decision (adjust skor)** | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Final Approve Hasil** | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Publish Hasil ke Karyawan** | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Lihat Hasil Sendiri & Acknowledge** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Ajukan Dispute** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Respond / Resolve Dispute** | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Reopen Hasil (setelah kunci)** | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Automation Schedule** | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Sync / Assign Development Recommendation** | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |

---

## 🧾 3. Data Model Entities & Relations

### Diagram Relasi ASCII

```
companies
   │
   ├─< PerformanceMethod (metode penilaian perusahaan)
   │       │
   │       └─< PerformanceMethodVersion (versi frozen)
   │               ├── PerformanceGradeRule (FK grade_rule_id)
   │               ├── WorkflowTemplate "review" (FK review_workflow_template_id)
   │               ├── WorkflowTemplate "approval" (FK approval_workflow_template_id)
   │               └─< PerformanceComponent (komponen: KPI/Kompetensi/dll)
   │
   ├─< PerformanceFormula (library formula kalkulasi)
   │       └── PerformanceIndicator (FK formula_id) ──< PerformancePlanningTarget
   │
   ├─< PerformanceGradeRule
   │       └─< PerformanceGradeRange (label/min/max)
   │
   ├─< PerformancePeriod (FK method_id, method_version_id)
   │       └─< PerformancePlanningAssignment (1 karyawan per periode)
   │               ├─< PerformancePlanningTarget (1 target per KPI item)
   │               │       ├─< PerformancePlanningTargetProgress (log progres)
   │               │       └─< PerformancePlanningEvidence (file bukti)
   │               └── PerformanceResult (1-to-1 per assignment)
   │                       ├─< PerformanceCalibrationParticipant
   │                       │       └─< PerformanceCalibrationDecision
   │                       ├─< PerformanceResultDispute
   │                       │       └─< PerformanceResultAttachment (type=DISPUTE)
   │                       ├─< PerformanceResultAttachment (type=RESULT)
   │                       └─< PerformanceDevelopmentRecommendation
   │                               └── TrainingCourse / TrainingEnrollment
   │
   ├─< PerformanceCalibrationSession (per periode)
   │
   ├─< PerformanceAutomationSchedule (per periode)
   │
   ├─< ReviewCycle (siklus review legacy KPI form)
   │       └─< PerformanceReview
   │               └─< ReviewSection
   │                       └─< ReviewScore
   │
   └─< Goal (OKR/target personal karyawan)
           ├─< GoalUpdate (log progres)
           └─< FeedbackRequest
                   └─< FeedbackResponse
```

### Entity 1 — `performance_methods` ([schema.prisma#L553-L574](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/database/prisma/schema.prisma#L553-L574))
| Field | Type | Required | Keterangan |
|---|---|---|---|
| `id` | UUID | auto | PK |
| `companyId` | UUID | ✅ | Company scope |
| `name` | varchar(255) | ✅ | Nama metode: "KPI + Kompetensi 2025" |
| `code` | varchar(50) | ✅ | Kode unik per company |
| `status` | `PerformanceMethodStatus` | default `DRAFT` | `DRAFT → ACTIVE → ARCHIVED` |
| `latestVersionNumber` | Int | auto-increment | Nomor versi terakhir dibuat |
| `deletedAt` | DateTime? | ❌ | Soft delete |

### Entity 2 — `performance_method_versions` ([schema.prisma#L577-L614](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/database/prisma/schema.prisma#L577-L614))
| Field | Type | Required | Keterangan |
|---|---|---|---|
| `methodId` | UUID | ✅ | FK ke PerformanceMethod |
| `versionNumber` | Int | ✅ | Nomor urut versi (unique per method) |
| `status` | `PerformanceMethodVersionStatus` | default `DRAFT` | `DRAFT → PUBLISHED → ARCHIVED` |
| `weightMode` | `PerformanceWeightMode` | default `STRICT_100` | `STRICT_100` atau `FLEXIBLE` |
| `scoreAggregation` | `PerformanceScoreAggregation` | default `WEIGHTED_AVERAGE` | `WEIGHTED_AVERAGE`, `SUM`, `AVERAGE` |
| `minimumScore` | Decimal(5,2)? | ❌ | Batas bawah skor akhir |
| `maximumScore` | Decimal(5,2)? | ❌ | Batas atas skor akhir |
| `gradeRuleId` | UUID? | ❌ | FK ke PerformanceGradeRule |
| `reviewWorkflowTemplateId` | UUID? | ❌ | FK WorkflowTemplate (jenis review) |
| `approvalWorkflowTemplateId` | UUID? | ❌ | FK WorkflowTemplate (jenis approval) |
| `normalizationRule` | Json? | ❌ | Aturan normalisasi skor (future-ready) |
| `publishedAt` | DateTime? | ❌ | Timestamp publish |

### Entity 3 — `performance_formulas` ([schema.prisma#L618-L642](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/database/prisma/schema.prisma#L618-L642))
| Field | Type | Keterangan |
|---|---|---|
| `strategy` | `PerformanceFormulaStrategy` | `ACHIEVEMENT_PERCENTAGE`, `LOWER_IS_BETTER`, `MANUAL_RATING`, `AVERAGE`, `WEIGHTED_AVERAGE`, `CUSTOM` |
| `expression` | Text? | Custom formula expression (untuk CUSTOM strategy) |
| `roundingMode` | `PerformanceRoundingMode` | `ROUND`, `FLOOR`, `CEIL` |
| `roundingPrecision` | Int default 2 | Jumlah desimal |
| `minimumScore` / `maximumScore` | Decimal(5,2)? | Clamp skor formula ini |

### Entity 4 — `performance_indicators` ([schema.prisma#L645-L676](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/database/prisma/schema.prisma#L645-L676))
| Field | Type | Keterangan |
|---|---|---|
| `measurementType` | `PerformanceMeasurementType` | `NUMBER`, `PERCENTAGE`, `CURRENCY`, `DURATION`, `BOOLEAN`, `RATING`, `TEXT`, `CUSTOM_FORMULA` |
| `targetType` | `PerformanceTargetType` | `MONTHLY`, `QUARTERLY`, `SEMESTER`, `YEARLY`, `CUSTOM` |
| `direction` | `PerformanceDirection` | `HIGHER_BETTER`, `LOWER_BETTER`, `RANGE`, `EXACT`, `MANUAL` |
| `category` | varchar(100)? | Perspektif BSC: Financial / Customer / dll |
| `perspective` | varchar(100)? | Perspektif tambahan |
| `evidenceRequired` / `reviewRequired` | Boolean | Flag wajib bukti/review |

### Entity 5 — `performance_components` ([schema.prisma#L679-L702](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/database/prisma/schema.prisma#L679-L702))
| Field | Type | Keterangan |
|---|---|---|
| `methodVersionId` | UUID | FK ke PerformanceMethodVersion (Cascade delete) |
| `type` | `PerformanceComponentType` | `KPI`, `GOAL`, `COMPETENCY`, `BEHAVIOR`, `CUSTOM` |
| `weight` | Decimal(5,2) | Bobot komponen (total harus = 100 jika STRICT_100) |
| `sortOrder` | Int default 0 | Urutan tampil |
| `isRequired` | Boolean default true | Wajib ada target |

### Entity 6 — `performance_grade_rules` & `performance_grade_ranges` ([schema.prisma#L705-L742](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/database/prisma/schema.prisma#L705-L742))
| Model | Field Penting | Keterangan |
|---|---|---|
| `PerformanceGradeRule` | `recommendationRules` (Json?) | Array rule `{label, condition, action}` untuk rekomendasi otomatis |
| `PerformanceGradeRange` | `label`, `minimum`, `maximum`, `sortOrder` | Satu range = satu grade. Range tidak boleh tumpang tindih (divalidasi di service#L149-L173) |

### Entity 7 — `performance_periods` ([schema.prisma#L745-L780](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/database/prisma/schema.prisma#L745-L780))
| Field | Type | Keterangan |
|---|---|---|
| `status` | `PerformancePeriodStatus` | `DRAFT → READY → PUBLISHED → CLOSED → ARCHIVED` |
| `configSnapshot` | Json? | Snapshot konfigurasi method version saat publish |
| `readinessSummary` | Json? | Cache readiness check (issues, metrics) |
| `planningSummary` | Json? | Cache summary planning workspace |
| `publishedAt` / `planningPublishedAt` | DateTime? | Dua milestone publish: publish periode & publish planning |

### Entity 8 — `performance_planning_assignments` ([schema.prisma#L782-L827](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/database/prisma/schema.prisma#L782-L827))
| Field | Type | Keterangan |
|---|---|---|
| `status` | `PerformancePlanningAssignmentStatus` | 10 status (lihat State Machine) |
| `assignmentSource` | `PerformanceAssignmentSource` | `MANUAL` atau `AUTO_FROM_ORG` |
| `employeeSnapshot` / `orgSnapshot` / `planningSnapshot` / `executionSnapshot` | Json? | 4 snapshot frozen di berbagai titik siklus |
| `reviewerId` / `approverId` | UUID? | Reviewer & approver yang ditetapkan |
| `reassignmentReason` | Text? | Catatan saat assignment diubah |
| Constraint | `@@unique([periodId, employeeId])` | 1 karyawan hanya bisa 1 assignment per periode |

### Entity 9 — `performance_planning_targets` ([schema.prisma#L829-L876](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/database/prisma/schema.prisma#L829-L876))
| Field | Type | Keterangan |
|---|---|---|
| `componentId` | UUID? | FK ke PerformanceComponent |
| `indicatorId` | UUID? | FK ke PerformanceIndicator |
| `formulaId` | UUID? | FK ke PerformanceFormula (override dari indicator) |
| `targetValue` | Decimal(12,2)? | Target numerik (e.g. 95 untuk 95% konversi) |
| `targetText` | Text? | Target kualitatif |
| `currentValue` | Decimal(12,2)? | Realisasi numerik |
| `progressPercent` | Int default 0 | Progress 0-100 |
| `selfComment` / `reviewerComment` | Text? | Komentar dua sisi |
| `frequency` | `PerformanceTargetFrequency` | `ONCE`, `MONTHLY`, `QUARTERLY`, dll |
| `evidenceRequired` | Boolean | Wajib upload bukti sebelum submit |

### Entity 10 — `performance_planning_target_progresses` ([schema.prisma#L878-L899](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/database/prisma/schema.prisma#L878-L899))
Log immutable setiap update progres. Field: `progressPercent`, `currentValue`, `currentText`, `note`, `actorId`.

### Entity 11 — `performance_planning_evidences` ([schema.prisma#L901-L924](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/database/prisma/schema.prisma#L901-L924))
| Field | Type | Keterangan |
|---|---|---|
| `fileName` / `originalName` | varchar(255) | Nama file sanitized + nama asli |
| `fileUrl` | varchar(500) | URL akses file |
| `mimeType` | varchar(100) | Tipe MIME |
| `fileSize` | Int | Ukuran bytes |
| `uploadedById` | UUID? | FK ke Employee yang upload |

### Entity 12 — `performance_results` ([schema.prisma#L926-L996](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/database/prisma/schema.prisma#L926-L996))
| Field | Type | Keterangan |
|---|---|---|
| `assignmentId` | UUID UNIQUE | FK 1-to-1 ke PlanningAssignment |
| `status` | `PerformanceResultStatus` | `CALCULATED → CALIBRATION_IN_PROGRESS → CALIBRATED → FINALIZED → PUBLISHED` |
| `rawScore` / `normalizedScore` / `weightedScore` / `finalScore` | Decimal(7,2)? | 4 level skor |
| `gradeCode` / `gradeLabel` | varchar? | Grade hasil mapping ke GradeRule |
| `recommendationRules` | Json? | Array matched recommendation rules |
| `visibilityPolicy` | Json? | `{showCalculation, showRecommendations, showCalibrationHistory}` |
| `calculationSnapshot` / `calibrationSnapshot` / `finalSnapshot` | Json? | 3 snapshot frozen |
| `disputeDeadline` | DateTime? | Batas waktu dispute (dihitung dari `publishPerformanceResultsSchema.disputeWindowDays`) |
| `acknowledgedAt` / `acknowledgementNote` | DateTime? / Text? | Konfirmasi terima dari karyawan |
| `reopenCount` | Int default 0 | Berapa kali pernah dibuka ulang |

### Entity 13 — `performance_calibration_sessions` ([schema.prisma#L998-L1026](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/database/prisma/schema.prisma#L998-L1026))
| Field | Type | Keterangan |
|---|---|---|
| `status` | `PerformanceCalibrationSessionStatus` | `DRAFT → OPEN → CLOSED → FINALIZED` |
| `scope` | Json? | Filter dept/jabatan yang dicakup sesi kalibrasi |
| `forcedDistribution` | Json? | `{mode: 'COUNT'/'PERCENT', buckets: {A:10,B:20,...}, tolerance: 0}` |
| `openedAt` / `closedAt` / `finalizedAt` | DateTime? | Timestamp transisi |

### Entity 14 — `performance_calibration_participants` & `performance_calibration_decisions` ([schema.prisma#L1028-L1082](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/database/prisma/schema.prisma#L1028-L1082))

`PerformanceCalibrationParticipant` menyimpan snapshot `beforeScore`/`beforeGradeCode` dan `afterScore`/`afterGradeCode`. `PerformanceCalibrationDecision` adalah audit trail immutable setiap keputusan penyesuaian.

### Entity 15 — `performance_result_disputes` ([schema.prisma#L1084-L1109](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/database/prisma/schema.prisma#L1084-L1109))
| Field | Type | Keterangan |
|---|---|---|
| `status` | `PerformanceResultDisputeStatus` | `OPEN → RESPONDED → RESOLVED / REJECTED / CLOSED` |
| `title` | varchar(255) | Judul keberatan |
| `message` | Text | Isi keberatan karyawan |
| `responseMessage` | Text? | Jawaban HR/reviewer |
| `respondedAt` / `resolvedAt` / `closedAt` | DateTime? | Timestamp tiap transisi |

### Entity 16 — `performance_development_recommendations` ([schema.prisma#L1111-L1148](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/database/prisma/schema.prisma#L1111-L1148))
Rekomendasi pengembangan yang di-generate otomatis dari `recommendationRules` grade, dengan link ke `TrainingCourse` dan `TrainingEnrollment`.

### Entity 17 — `performance_result_attachments` ([schema.prisma#L1150-L1170](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/database/prisma/schema.prisma#L1150-L1170))
Lampiran dokumen (menggunakan Document module). `attachmentType` membedakan `RESULT` vs `DISPUTE`.

### Entity 18 — `performance_automation_schedules` ([schema.prisma#L1172-L1197](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/database/prisma/schema.prisma#L1172-L1197))
Jadwal reminder otomatis berbasis queue (`cadenceHours`, `queueJobId`, `reminderTarget`: `UNACKNOWLEDGED_RESULTS`, `OPEN_DISPUTES`, `ALL`).

### Entity 19 — `review_cycles` & `performance_reviews` ([schema.prisma#L1200-L1256](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/database/prisma/schema.prisma#L1200-L1256))
Subsistem review berbasis form (legacy/sederhana). `PerformanceReview` punya tipe `SELF`, `MANAGER`, `PEER`, `SUBORDINATE`, `FULL_360`.

### Entity 20 — `goals` & `goal_updates` ([schema.prisma#L1336-L1374](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/database/prisma/schema.prisma#L1336-L1374))
OKR / target personal. `GoalType`: `PERSONAL`, `TEAM`, `COMPANY`. `GoalStatus`: `IN_PROGRESS`, `COMPLETED`, `CANCELLED`.

### Entity 21 — `feedback_requests` & `feedback_responses` ([schema.prisma#L1292-L1333](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/database/prisma/schema.prisma#L1292-L1333))
Permintaan feedback 360°. `FeedbackResponse.isAnonymous` melindungi identitas pemberi feedback.

---

## 🔄 4. State Machine

### A. PerformancePlanningAssignment Status ([schema.prisma#L3071-L3082](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/database/prisma/schema.prisma#L3071-L3082))

```
DRAFT ──────────────────────────────────────────────────────────────────────────────────────
  │                                                                                         │
  │  publishPlanning() → service.publishPlanning → repo.publishPlanningAssignments         │
  ▼                                                                                         │
PUBLISHED                                                                                   │
  │                                                                                         │
  │  createPlanningTargetProgress() / uploadPlanningEvidence()                              │
  │  → nextExecutionAssignmentStatus() → IN_PROGRESS                                        │
  ▼                                                                                         │
IN_PROGRESS ──────────────┐                                                                 │
  │                        │                                                                 │
  │  submitPlanningAssignment()    rejectPlanningAssignment()                               │
  │  → repo.submitAssignment       → REJECTED                                               │
  ▼                        │                                                                 │
SUBMITTED                  │                                                                 │
  │                        │                                                                 │
  │  approvePlanningAssignment()   requestPlanningAssignmentRevision()                     │
  │  → APPROVED            └───────→ REVISION_REQUIRED ──────────────────→ IN_PROGRESS    │
  ▼                                                                                         │
APPROVED                                                                                    │
  │                                                                                         │
  │  completePlanningAssignment()                                                           │
  ▼                                                                                         │
COMPLETED                                                                                   │
  │                                                                                         │
  └── REASSIGNED (via reassignPlanningAssignment) ──────────────────────────────────────────┘
  └── ARCHIVED (soft close)
```

| Transisi | Method Service / Repository |
|---|---|
| `DRAFT → PUBLISHED` | `publishPlanning()` → `repo.publishPlanningAssignments()` |
| `PUBLISHED → IN_PROGRESS` | `createPlanningTargetProgress()` via `nextExecutionAssignmentStatus()` ([service.ts#L587-L593](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/modules/performance/performance.service.ts#L587-L593)) |
| `IN_PROGRESS → SUBMITTED` | `submitPlanningAssignment()` → `repo.submitAssignment()` |
| `SUBMITTED → APPROVED` | `approvePlanningAssignment()` → `repo.approveAssignment()` |
| `SUBMITTED → REJECTED` | `rejectPlanningAssignment()` → `repo.rejectAssignment()` |
| `SUBMITTED → REVISION_REQUIRED` | `requestPlanningAssignmentRevision()` → `repo.requestRevision()` |
| `REVISION_REQUIRED → IN_PROGRESS` | Karyawan kembali update target |
| `APPROVED → COMPLETED` | `completePlanningAssignment()` → `repo.completeAssignment()` |

### B. PerformanceResult Status ([schema.prisma#L3095-L3101](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/database/prisma/schema.prisma#L3095-L3101))

```
CALCULATED ──────────────────────────────────────────────────────────────────────
  │  (setelah calculatePerformanceResults())                                      │
  │                                                                               │
  │  createCalibrationSession() + openCalibrationSession()                        │
  ▼                                                                               │
CALIBRATION_IN_PROGRESS                                                           │
  │                                                                               │
  │  closeCalibrationSession() + finalizeCalibrationSession()                     │
  ▼                                                                               │
CALIBRATED                                                                        │
  │                                                                               │
  │  approvePerformanceResults()                                                  │
  ▼                                                                               │
FINALIZED                                                                         │
  │                                                                               │
  │  publishPerformanceResults()                                                  │
  ▼                                                                               │
PUBLISHED ──────── (dispute window aktif, karyawan bisa ajukan dispute)           │
  │                                                                               │
  └─── reopenPerformanceResult() ────────────────────────────────────────────────┘
       (kembali ke CALCULATED untuk recalculate)
```

### C. GoalStatus ([performance.types.ts#L36-L40](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/modules/performance/performance.types.ts#L36-L40))

```
IN_PROGRESS ──── updateGoalProgress(progress=100) ──── COMPLETED
     │
     └──── (cancel manual) ──── CANCELLED
```

### D. PerformanceCalibrationSession ([schema.prisma#L3103-L3108](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/database/prisma/schema.prisma#L3103-L3108))

```
DRAFT ──── openCalibrationSession() ──── OPEN
              │
              │  applyCalibrationDecision() (berulang, per peserta)
              │
              └── closeCalibrationSession() ──── CLOSED
                          │
                          └── finalizeCalibrationSession() ──── FINALIZED
```

---

## 📖 5. Use Case End-to-End (9 Langkah)

### 🎬 Skenario: Siklus Penilaian H2 2025 — PT Nusa Persada Tbk

#### ⬛ Step 1 — HR Setup: Konfigurasi Metode & Library

**Tanggal: 1 Juli 2025**. Bu Rini (HR_MANAGER) menyiapkan metode penilaian untuk semester 2:

1. Buat `PerformanceMethod` bernama **"KPI + Kompetensi H2 2025"**, kode `KPI-COMP-H2-2025`.
2. Buat `PerformanceMethodVersion` v1 dengan `weightMode=STRICT_100`, `scoreAggregation=WEIGHTED_AVERAGE`.
3. Tambah 3 komponen:
   - **KPI** → weight 40%, required
   - **Kompetensi** → weight 30%, required
   - **OKR/Goal** → weight 30%, required
4. Assign `PerformanceGradeRule` "Standard 5 Tier": E(<60) / D(60-70) / C(70-80) / B(80-90) / A(90-100)
5. Assign `reviewWorkflowTemplateId` → template "Manager → Dept Head"
6. **Publish method version** → `publishMethodVersion()` service mengecek readiness: komponen minimal 1, grade rule terpasang, total bobot = 100.

```typescript
// performance.service.ts — ensureEditableMethodVersion (L131-L135)
private ensureEditableMethodVersion(status: string) {
  if (status !== 'DRAFT') {
    throw new BadRequestError('Only draft method versions can be modified');
  }
}
```

Hasil: ✅ `PerformanceMethodVersion.status = PUBLISHED`, `PerformanceMethod.status = ACTIVE`.

#### ⬛ Step 2 — Buat Periode & Publish

Bu Rini buat `PerformancePeriod` "Semester 2 2025" terhubung ke method version:
- `startDate: 2025-07-01`, `endDate: 2025-12-31`, `reviewDeadline: 2026-01-15`
- `POST /api/v1/performance/periods` → `createPeriod()` service

Cek readiness via `GET /periods/:id/readiness` → `buildPeriodReadiness()` ([service.ts#L1414-L1456](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/modules/performance/performance.service.ts#L1414-L1456)):
- Method version status = PUBLISHED ✅
- startDate < endDate ✅
- Total bobot komponen = 100 ✅

Publish: `POST /periods/:id/publish` → `buildPeriodConfigSnapshot()` membekukan seluruh konfigurasi method version ke `period.configSnapshot` (JSON).

#### ⬛ Step 3 — 74 Karyawan Di-assign (Planning)

Bu Rini buka workspace planning: `GET /periods/:id/planning`. Untuk setiap karyawan:

```typescript
// POST /periods/:id/planning/assignments
{
  "employeeId": "emp-budi-001",
  "reviewerId": "emp-rudi-manager",
  "approverId": "emp-dhestu-dept-head",
  "assignmentSource": "MANUAL"
}
```

`createPlanningAssignment()` service membuat snapshot karyawan (`buildEmployeePlanningSnapshot()`) mencatat branch/dept/posisi saat ini. Kemudian per karyawan ditambahkan target:

```typescript
// POST /planning-assignments/:id/targets
{
  "componentId": "comp-kpi-id",
  "indicatorId": "ind-konversi-sales-id",
  "targetValue": 95,
  "weight": 40,
  "frequency": "QUARTERLY",
  "evidenceRequired": true
}
```

Setelah 74 assignment selesai: `POST /periods/:id/planning/publish` → `publishPlanning()` service memvalidasi semua assignment punya reviewer, approver, dan minimal 1 target. Status semua assignment berubah `DRAFT → PUBLISHED`.

#### ⬛ Step 4 — Budi Isi Self-Review KPI 6 Item

**Tanggal: 15 Oktober 2025**. Budi Santoso (EMPLOYEE) login, buka "My Assignments":

- `GET /execution/my-assignments` → service `getMyExecutionAssignments()` filter berdasarkan `context.employeeId`
- Budi update progres 6 KPI target via `POST /planning-targets/:id/progress`:

```typescript
{
  "progressPercent": 87,
  "currentValue": 82.65,
  "note": "Konversi Q3 82.65%, target 95%. Terdapat hambatan pasar di bulan Agustus."
}
```

Setiap call membuat 1 row baru di `performance_planning_target_progresses`. Status assignment otomatis bergeser ke `IN_PROGRESS` via `nextExecutionAssignmentStatus()`.

Budi upload bukti laporan Q3: `POST /planning-targets/:id/evidences` (multipart/form-data, field `file`).

Budi juga menambahkan `selfComment` via `PATCH /execution/targets/:id/comment`:
```typescript
{ "comment": "Hambatan di bulan Agustus akibat perubahan policy regional." }
```

Akhirnya Budi submit: `POST /planning-assignments/:id/submit` → `submitPlanningAssignment()` → service memvalidasi: semua target punya minimal 1 progress update, target dengan `evidenceRequired=true` sudah ada buktinya.

#### ⬛ Step 5 — Manager Rudi Review & Beri Nilai 3.8

**Tanggal: 20 November 2025**. Pak Rudi (MANAGER) buka approval queue: `GET /execution/approval-queue` → list semua assignment yang menunggu approval sebagai reviewer-nya.

Pak Rudi tambah `reviewerComment` pada setiap target, lalu:

`POST /planning-assignments/:id/approve` → `approvePlanningAssignment()` → service memvalidasi `ensureExecutionApprover()`: `assignment.approverId === context.employeeId` atau salah satu target memiliki approver = Pak Rudi.

Status assignment: `SUBMITTED → APPROVED`.

#### ⬛ Step 6 — Dept Head L2 Adjust

**Tanggal: 25 November 2025**. Pak Dhestu (COMPANY_ADMIN / Dept Head) sebagai approver terakhir: `POST /planning-assignments/:id/complete` → `completePlanningAssignment()`. Status: `APPROVED → COMPLETED`.

Lalu Bu Rini kalkulasi semua hasil: `POST /periods/:id/results/calculate` → `calculatePerformanceResults()` service menjalankan `buildPerformanceCalculation()` ([service.ts#L1146-L1263](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/modules/performance/performance.service.ts#L1146-L1263)):

```
Budi: KPI 82.65 × 0.40 = 33.06
      Kompetensi 78.00 × 0.30 = 23.40
      OKR 85.00 × 0.30 = 25.50
      Final Score = 81.96 → Grade B
```

Setiap karyawan mendapat 1 row di `performance_results` dengan status `CALCULATED`.

#### ⬛ Step 7 — Kalibrasi Session: Paksa Distribusi Bell Curve

**Tanggal: 1 Desember 2025**. Bu Rini buat sesi kalibrasi:

```typescript
// POST /periods/:id/calibrations
{
  "name": "Kalibrasi H2 2025 — Dept Sales",
  "scope": { "departmentId": "dept-sales-id" },
  "forcedDistribution": {
    "mode": "PERCENT",
    "buckets": { "A": 10, "B": 20, "C": 40, "D": 20, "E": 10 },
    "tolerance": 1
  }
}
```

`POST /calibration-sessions/:id/open` → status `DRAFT → OPEN`.

Komite melihat analisis distribusi (service `buildForcedDistributionAnalysis()` [service.ts#L318-L348](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/modules/performance/performance.service.ts#L318-L348)): ternyata 35% karyawan dapat grade A → melebihi kuota 10%. Komite perlu menurunkan 25% karyawan.

Untuk setiap penyesuaian: `POST /calibration-participants/:id/decision`:
```typescript
{ "finalScore": 78.5, "reason": "Distribusi forced bell curve. Kinerja relatif dibanding peer." }
```

Service `applyCalibrationDecision()` INSERT 1 baris ke `performance_calibration_decisions` (audit trail permanen) dan UPDATE skor di `PerformanceResult`.

`POST /calibration-sessions/:id/close` → `OPEN → CLOSED`
`POST /calibration-sessions/:id/finalize` → `CLOSED → FINALIZED`

Status semua PerformanceResult dalam scope: `CALIBRATED`.

#### ⬛ Step 8 — Publish Hasil

```typescript
// POST /periods/:id/results/final-approve
{ "notes": "Final approval oleh HR Manager sebelum publikasi." }
// → status CALIBRATED → FINALIZED

// POST /periods/:id/results/publish
{
  "visibilityPolicy": {
    "showCalculation": true,
    "showRecommendations": true,
    "showCalibrationHistory": false
  },
  "disputeWindowDays": 14,
  "notes": "Hasil resmi H2 2025 dipublikasikan."
}
```

`publishPerformanceResults()` service mengupdate semua hasil:
- `status = PUBLISHED`
- `disputeDeadline = now() + 14 days`
- `visibilityPolicy` disimpan ke setiap result

Notifikasi dikirim ke semua karyawan via `notifyEmployeeTargets()`.

#### ⬛ Step 9 — Budi Dispute Nilai → L2 Selesaikan → Final Lock

Budi (EMPLOYEE) melihat nilainya turun dari 81.96 ke 78.5 setelah kalibrasi:

```typescript
// POST /results/:id/disputes
{
  "title": "Keberatan Penyesuaian Nilai Kalibrasi",
  "message": "Nilai KPI saya 82.65 seharusnya masuk Grade B. Penyesuaian ke 78.5 tidak sesuai kontribusi aktual."
}
```

Budi upload lampiran bukti pendukung: `POST /result-disputes/:id/attachments`.

Bu Rini merespons: `POST /result-disputes/:id/respond`:
```typescript
{
  "response": "Setelah review ulang, nilai Anda disesuaikan menjadi 80.0 mempertimbangkan hambatan pasar yang terdokumentasi.",
  "status": "RESOLVED"
}
```

Jika disetujui → `reopenPerformanceResult()` untuk recalculate, lalu publish ulang. Jika ditolak → status dispute = `REJECTED`, nilai tetap 78.5.

Setelah dispute window 14 hari habis → `PerformanceResult.status` tetap `PUBLISHED` (Final Lock. Data siap untuk modul Payroll Annual Bonus dan Succession Planning).

---

## ✅ 6. Zod DTO — Semua Schema Validator

Sumber: [performance.dto.ts](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/modules/performance/performance.dto.ts#L1-L436)

| # | Schema | Dipakai Oleh Route | Field Wajib | Field Opsional / Enum / Constraint |
|---|---|---|---|---|
| 1 | `createReviewCycleSchema` | POST /review-cycles | `companyId`, `name`, `startDate`, `endDate` | `code`(max 50), `type` ∈ `[QUARTERLY,SEMI_ANNUAL,ANNUAL,MONTHLY]` default QUARTERLY, `reviewDeadline`, `description` |
| 2 | `createReviewSchema` | POST /reviews | `cycleId`, `employeeId`, `companyId`, `title` | `reviewerId`, `type` ∈ `[SELF,MANAGER,PEER,SUBORDINATE,FULL_360]`, `strengths`, `improvements`, `notes` |
| 3 | `updateReviewSchema` | — (internal) | — | `strengths`, `improvements`, `notes` |
| 4 | `createGoalSchema` | POST /goals | `employeeId`, `companyId`, `title`, `startDate` | `description`, `type` ∈ `[PERSONAL,TEAM,COMPANY]`, `endDate`, `priority` ∈ `[LOW,MEDIUM,HIGH,CRITICAL]` |
| 5 | `updateGoalProgressSchema` | PATCH /goals/:id/progress | `progress` (int 0-100) | `note` |
| 6 | `createFeedbackRequestSchema` | POST /feedback-requests | `requesterId`, `recipientId`, `companyId` | `reviewId`, `relationship`, `message` |
| 7 | `createFeedbackResponseSchema` | POST /feedback-responses | `requestId` | `rating` (int 0-10), `strengths`, `improvements`, `notes`, `isAnonymous` default false |
| 8 | `createPerformanceMethodSchema` | POST /methods | `companyId`, `name` | `code`(max 50), `description` |
| 9 | `updatePerformanceMethodSchema` | PUT /methods/:id | — | `name`(max 255), `description` |
| 10 | `createPerformanceMethodVersionSchema` | POST /methods/:id/version | — | `weightMode`∈`[STRICT_100,FLEXIBLE]`, `scoreAggregation`∈`[WEIGHTED_AVERAGE,SUM,AVERAGE]`, `minimumScore`/`maximumScore` (0-999), `gradeRuleId`, `reviewWorkflowTemplateId`, `approvalWorkflowTemplateId`, `normalizationRule` |
| 11 | `updatePerformanceMethodVersionSchema` | PUT /method-versions/:id | — | Semua field dari create (semua opsional) |
| 12 | `createPerformanceComponentSchema` | POST /method-versions/:id/components | `name`, `weight`(>0 max 100) | `code`, `type`∈`[KPI,GOAL,COMPETENCY,BEHAVIOR,CUSTOM]`, `description`, `sortOrder` int≥0, `isRequired` bool, `config` JSON |
| 13 | `updatePerformanceComponentSchema` | PUT /components/:id | — | Semua field dari create (semua opsional) |
| 14 | `createPerformancePeriodSchema` | POST /periods | `companyId`, `methodId`, `methodVersionId`, `name`, `startDate`, `endDate` | `code`, `reviewDeadline`, `description` |
| 15 | `updatePerformancePeriodSchema` | PUT /periods/:id | — | `methodVersionId`, `name`, `code`, `startDate`, `endDate`, `reviewDeadline`, `description` |
| 16 | `createPerformancePlanningAssignmentSchema` | POST /periods/:id/planning/assignments | `employeeId` | `reviewerId`, `approverId`, `assignmentSource`∈`[MANUAL,AUTO_FROM_ORG]` |
| 17 | `updatePerformancePlanningAssignmentSchema` | PUT /planning-assignments/:id | — | `reviewerId`, `approverId`, `assignmentSource` |
| 18 | `reassignPerformancePlanningAssignmentSchema` | POST /planning-assignments/:id/reassign | `reason`(min 3 max 1000) | `reviewerId`, `approverId` |
| 19 | `createPerformancePlanningTargetSchema` | POST /planning-assignments/:id/targets | `componentId`, `indicatorId`, `weight`(>0 max 100) | `formulaId`, `reviewerId`, `approverId`, `name`(max 255), `description`, `targetValue`, `targetText`(max 2000), `frequency`∈`[ONCE,MONTHLY,QUARTERLY,SEMI_ANNUAL,ANNUAL,CUSTOM]`, `evidenceRequired`, `config` JSON |
| 20 | `updatePerformancePlanningTargetSchema` | PUT /planning-targets/:id | — | Semua field dari create (semua opsional) |
| 21 | `createPerformanceTargetProgressSchema` | POST /planning-targets/:id/progress | `progressPercent`(int 0-100) | `currentValue`, `currentText`(max 5000), `note`(max 5000) |
| 22 | `performanceExecutionActionSchema` | POST .../submit, .../approve, .../reject, .../revision, .../complete | — | `notes`(max 5000) |
| 23 | `updateExecutionTargetCommentSchema` | PATCH /execution/targets/:id/comment | — | `comment`(max 5000, nullable) |
| 24 | `createPerformanceCalibrationSessionSchema` | POST /periods/:id/calibrations | `name`(min 1 max 255) | `code`, `scope` JSON, `forcedDistribution` JSON, `notes`(max 5000) |
| 25 | `performanceCalibrationDecisionSchema` | POST /calibration-participants/:id/decision | `finalScore`(0-999), `reason`(min 3 max 5000) | — |
| 26 | `publishPerformanceResultsSchema` | POST /periods/:id/results/publish | — | `visibilityPolicy` {showCalculation, showRecommendations, showCalibrationHistory}, `disputeWindowDays`(int 1-90 default 14), `notes`(max 5000) |
| 27 | `acknowledgePerformanceResultSchema` | POST /results/:id/acknowledge | — | `notes`(max 5000) |
| 28 | `createPerformanceResultDisputeSchema` | POST /results/:id/disputes | `title`(min 1 max 255), `message`(min 1 max 5000) | — |
| 29 | `respondPerformanceResultDisputeSchema` | POST /result-disputes/:id/respond | `response`(min 1 max 5000) | `status`∈`[RESPONDED,RESOLVED,REJECTED,CLOSED]` default RESPONDED |
| 30 | `approvePerformanceResultsSchema` | POST /periods/:id/results/final-approve | — | `notes`(max 5000) |
| 31 | `reopenPerformanceResultSchema` | POST /results/:id/reopen | `reason`(min 3 max 5000) | — |
| 32 | `sendPerformanceResultRemindersSchema` | POST /periods/:id/results/reminders | — | `target`∈`[UNACKNOWLEDGED_RESULTS,OPEN_DISPUTES,ALL]` default ALL, `notes`(max 5000) |
| 33 | `syncPerformanceDevelopmentRecommendationsSchema` | POST /periods/:id/development-recommendations/sync | — | `strategy`∈`[REGENERATE,UPSERT_MISSING]` default UPSERT_MISSING |
| 34 | `assignPerformanceDevelopmentRecommendationSchema` | POST /development-recommendations/:id/assign | `courseId`(UUID) | `notes`(max 5000) |
| 35 | `createPerformanceAutomationScheduleSchema` | POST /periods/:id/automation-schedules | `name`(min 1 max 255), `cadenceHours`(int 1-168) | `reminderTarget`∈enum, `notes`(max 5000) |
| 36 | `createPerformanceFormulaSchema` | POST /formulas | `companyId`, `name`, `strategy`∈6 enum | `code`, `description`, `expression`, `roundingMode`∈`[ROUND,FLOOR,CEIL]`, `roundingPrecision`(0-6), `minimumScore`/`maximumScore`, `isActive` |
| 37 | `createPerformanceIndicatorSchema` | POST /indicators | `companyId`, `name`, `measurementType`∈8 enum, `targetType`∈5 enum, `direction`∈5 enum | `formulaId`, `code`, `description`, `category`, `perspective`, `unit`, `defaultWeight`, `minimumValue`/`maximumValue`, `evidenceRequired`, `reviewRequired`, `isActive` |
| 38 | `createPerformanceGradeRuleSchema` | POST /grades | `companyId`, `name`, `ranges`(array min 1) | `code`, `description`, `recommendationRules`(array), `isActive` |
| 39 | `createPerformanceWorkflowTemplateSchema` | POST /review-workflows & /approval-workflows | `companyId`, `name`, `stages`(array min 1) | `description`, `isActive` |

---

## 🔌 7. API Endpoints (97 Endpoint)

Base URL: `{APP_URL}{API_PREFIX}/performance`. Semua endpoint memerlukan `authenticate` middleware.

| # | Method | Route | Action Permission | DTO | Deskripsi |
|---|---|---|---|---|---|
| 1 | GET | `/methods` | `performance:read` | — | List semua metode penilaian |
| 2 | GET | `/methods/:id` | `performance:read` | — | Detail satu metode |
| 3 | POST | `/methods` | `performance:create` | `createPerformanceMethodSchema` | Buat metode baru |
| 4 | PUT | `/methods/:id` | `performance:update` | `updatePerformanceMethodSchema` | Update metode |
| 5 | GET | `/methods/:id/versions` | `performance:read` | — | List semua versi dari satu metode |
| 6 | POST | `/methods/:id/version` | `performance:create` | `createPerformanceMethodVersionSchema` | Buat versi baru |
| 7 | GET | `/method-versions/:id` | `performance:read` | — | Detail satu versi |
| 8 | GET | `/method-versions/:id/readiness` | `performance:read` | — | Cek kesiapan versi (issues + metrics) |
| 9 | PUT | `/method-versions/:id` | `performance:update` | `updatePerformanceMethodVersionSchema` | Update versi |
| 10 | POST | `/method-versions/:id/publish` | `performance:update` | — | Publish versi |
| 11 | GET | `/review-workflows` | `performance:read` | — | List workflow template tipe review |
| 12 | GET | `/review-workflows/:id` | `performance:read` | — | Detail workflow review |
| 13 | POST | `/review-workflows` | `performance:create` | `createPerformanceWorkflowTemplateSchema` | Buat workflow review |
| 14 | PUT | `/review-workflows/:id` | `performance:update` | `updatePerformanceWorkflowTemplateSchema` | Update workflow review |
| 15 | GET | `/approval-workflows` | `performance:read` | — | List workflow template tipe approval |
| 16 | GET | `/approval-workflows/:id` | `performance:read` | — | Detail workflow approval |
| 17 | POST | `/approval-workflows` | `performance:create` | `createPerformanceWorkflowTemplateSchema` | Buat workflow approval |
| 18 | PUT | `/approval-workflows/:id` | `performance:update` | `updatePerformanceWorkflowTemplateSchema` | Update workflow approval |
| 19 | GET | `/formulas` | `performance:read` | — | List formula library |
| 20 | GET | `/formulas/:id` | `performance:read` | — | Detail formula |
| 21 | POST | `/formulas` | `performance:create` | `createPerformanceFormulaSchema` | Buat formula |
| 22 | PUT | `/formulas/:id` | `performance:update` | `updatePerformanceFormulaSchema` | Update formula |
| 23 | GET | `/indicators` | `performance:read` | — | List indicator library |
| 24 | GET | `/indicators/:id` | `performance:read` | — | Detail indicator |
| 25 | POST | `/indicators` | `performance:create` | `createPerformanceIndicatorSchema` | Buat indicator |
| 26 | PUT | `/indicators/:id` | `performance:update` | `updatePerformanceIndicatorSchema` | Update indicator |
| 27 | GET | `/grades` | `performance:read` | — | List grade rules |
| 28 | GET | `/grades/:id` | `performance:read` | — | Detail grade rule |
| 29 | POST | `/grades` | `performance:create` | `createPerformanceGradeRuleSchema` | Buat grade rule |
| 30 | PUT | `/grades/:id` | `performance:update` | `updatePerformanceGradeRuleSchema` | Update grade rule |
| 31 | GET | `/method-versions/:id/components` | `performance:read` | — | List komponen dari versi |
| 32 | POST | `/method-versions/:id/components` | `performance:create` | `createPerformanceComponentSchema` | Tambah komponen ke versi |
| 33 | PUT | `/components/:id` | `performance:update` | `updatePerformanceComponentSchema` | Update komponen |
| 34 | GET | `/periods` | `performance:read` | — | List periode penilaian |
| 35 | GET | `/periods/:id` | `performance:read` | — | Detail periode |
| 36 | POST | `/periods` | `performance:create` | `createPerformancePeriodSchema` | Buat periode |
| 37 | PUT | `/periods/:id` | `performance:update` | `updatePerformancePeriodSchema` | Update periode |
| 38 | GET | `/periods/:id/readiness` | `performance:read` | — | Cek readiness periode |
| 39 | POST | `/periods/:id/publish` | `performance:update` | — | Publish periode |
| 40 | GET | `/periods/:id/planning` | `performance:read` | — | Lihat workspace planning |
| 41 | POST | `/periods/:id/planning/assignments` | `performance:create` | `createPerformancePlanningAssignmentSchema` | Assign karyawan ke periode |
| 42 | POST | `/periods/:id/planning/publish` | `performance:update` | — | Publish semua assignment (buka ke karyawan) |
| 43 | PUT | `/planning-assignments/:id` | `performance:update` | `updatePerformancePlanningAssignmentSchema` | Update assignment |
| 44 | POST | `/planning-assignments/:id/reassign` | `performance:update` | `reassignPerformancePlanningAssignmentSchema` | Reassign reviewer/approver |
| 45 | DELETE | `/planning-assignments/:id` | `performance:update` | — | Hapus assignment |
| 46 | POST | `/planning-assignments/:id/submit` | `performance:update` | `performanceExecutionActionSchema` | Karyawan submit hasil kerja |
| 47 | POST | `/planning-assignments/:id/approve` | `performance:approve` | `performanceExecutionActionSchema` | Reviewer approve |
| 48 | POST | `/planning-assignments/:id/reject` | `performance:approve` | `performanceExecutionActionSchema` | Reviewer reject |
| 49 | POST | `/planning-assignments/:id/revision` | `performance:approve` | `performanceExecutionActionSchema` | Minta revisi |
| 50 | POST | `/planning-assignments/:id/complete` | `performance:update` | `performanceExecutionActionSchema` | Approver complete (L2 final) |
| 51 | POST | `/planning-assignments/:id/targets` | `performance:create` | `createPerformancePlanningTargetSchema` | Tambah target ke assignment |
| 52 | PUT | `/planning-targets/:id` | `performance:update` | `updatePerformancePlanningTargetSchema` | Update target |
| 53 | DELETE | `/planning-targets/:id` | `performance:update` | — | Hapus target |
| 54 | POST | `/planning-targets/:id/progress` | `performance:update` | `createPerformanceTargetProgressSchema` | Log update progres |
| 55 | POST | `/planning-targets/:id/evidences` | `performance:update` | multer `file` | Upload bukti target |
| 56 | GET | `/execution/approval-queue` | `performance:read` | — | Antrian assignment menunggu approval reviewer |
| 57 | GET | `/execution/my-assignments` | `performance:read` | — | Assignment milik user yang login |
| 58 | GET | `/execution/assignments/:id` | `performance:read` | — | Detail 1 assignment execution |
| 59 | PATCH | `/execution/targets/:id/comment` | `performance:update` | `updateExecutionTargetCommentSchema` | Update komentar target (self/reviewer) |
| 60 | GET | `/periods/:id/results` | `performance:read` | — | List semua hasil kinerja periode |
| 61 | GET | `/periods/:id/development-recommendations` | `performance:read` | — | Rekomendasi pengembangan periode |
| 62 | POST | `/periods/:id/development-recommendations/sync` | `performance:update` | `syncPerformanceDevelopmentRecommendationsSchema` | Sinkron/regenerasi rekomendasi |
| 63 | POST | `/development-recommendations/:id/assign` | `performance:update` | `assignPerformanceDevelopmentRecommendationSchema` | Assign ke training course |
| 64 | POST | `/periods/:id/results/calculate` | `performance:update` | — | Kalkulasi skor semua karyawan |
| 65 | GET | `/periods/:id/results/dashboard` | `performance:read` | — | Dashboard distribusi skor per periode |
| 66 | POST | `/periods/:id/results/final-approve` | `performance:approve` | `approvePerformanceResultsSchema` | Final approve sebelum publish |
| 67 | POST | `/periods/:id/results/publish` | `performance:approve` | `publishPerformanceResultsSchema` | Publish hasil ke karyawan |
| 68 | POST | `/periods/:id/results/reminders` | `performance:approve` | `sendPerformanceResultRemindersSchema` | Kirim reminder acknowledge |
| 69 | GET | `/periods/:id/automation-schedules` | `performance:read` | — | List jadwal automation |
| 70 | POST | `/periods/:id/automation-schedules` | `performance:update` | `createPerformanceAutomationScheduleSchema` | Buat jadwal automation reminder |
| 71 | GET | `/results/me` | `performance:read` | — | Hasil kinerja sendiri yang sudah dipublish |
| 72 | POST | `/results/:id/acknowledge` | `performance:read` | `acknowledgePerformanceResultSchema` | Karyawan acknowledge hasil |
| 73 | POST | `/results/:id/attachments` | `performance:read` | multer `file` | Upload lampiran ke hasil |
| 74 | POST | `/results/:id/disputes` | `performance:read` | `createPerformanceResultDisputeSchema` | Ajukan dispute/keberatan |
| 75 | POST | `/results/:id/reopen` | `performance:approve` | `reopenPerformanceResultSchema` | Buka ulang hasil untuk penyesuaian |
| 76 | POST | `/result-disputes/:id/attachments` | `performance:read` | multer `file` | Upload lampiran dispute |
| 77 | POST | `/result-disputes/:id/respond` | `performance:approve` | `respondPerformanceResultDisputeSchema` | Respons dispute karyawan |
| 78 | GET | `/periods/:id/calibrations` | `performance:read` | — | List sesi kalibrasi |
| 79 | POST | `/periods/:id/calibrations` | `performance:create` | `createPerformanceCalibrationSessionSchema` | Buat sesi kalibrasi |
| 80 | POST | `/calibration-sessions/:id/open` | `performance:approve` | — | Buka sesi kalibrasi |
| 81 | POST | `/calibration-sessions/:id/close` | `performance:approve` | — | Tutup sesi kalibrasi |
| 82 | POST | `/calibration-sessions/:id/finalize` | `performance:approve` | — | Finalisasi sesi kalibrasi |
| 83 | POST | `/calibration-participants/:id/decision` | `performance:approve` | `performanceCalibrationDecisionSchema` | Apply penyesuaian skor per karyawan |
| 84 | GET | `/review-cycles` | `performance:read` | — | List siklus review |
| 85 | POST | `/review-cycles` | `performance:create` | `createReviewCycleSchema` | Buat siklus review |
| 86 | GET | `/reviews` | `performance:read` | — | List semua review |
| 87 | GET | `/reviews/:id` | `performance:read` | — | Detail review |
| 88 | POST | `/reviews` | `performance:create` | `createReviewSchema` | Buat review (SELF/MANAGER/PEER/dll) |
| 89 | PATCH | `/reviews/:id/submit` | `performance:update` | — | Submit review |
| 90 | PATCH | `/reviews/:id/approve` | `performance:approve` | — | Approve review |
| 91 | GET | `/goals` | `performance:read` | — | List goals/OKR karyawan |
| 92 | POST | `/goals` | `performance:create` | `createGoalSchema` | Buat goal baru |
| 93 | PATCH | `/goals/:id/progress` | `performance:update` | `updateGoalProgressSchema` | Update progres goal |
| 94 | GET | `/feedback-requests` | `performance:read` | — | List permintaan feedback |
| 95 | POST | `/feedback-requests` | `performance:create` | `createFeedbackRequestSchema` | Minta feedback ke rekan |
| 96 | POST | `/feedback-responses` | `performance:create` | `createFeedbackResponseSchema` | Submit jawaban feedback |
| 97 | *(Upload Evidences)* | `/planning-targets/:id/evidences` | `performance:update` | multer `file` | *(sudah dicatat di #55)* |

---

## 🔗 8. Integrasi Antar Modul

### A. Modul Notification

Service memanggil `notifyEmployeeTargets()` ([performance.service.ts#L1019-L1053](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/modules/performance/performance.service.ts#L1019-L1053)) yang menggunakan `performanceRepository.createNotifications()`. Dipicu oleh 12 jenis event:

| # | Event / Trigger | Target Penerima | Type |
|---|---|---|---|
| 1 | Planning dipublish (assignment karyawan dibuka) | Employee | INFO |
| 2 | Assignment di-submit karyawan → reviewer | Reviewer | INFO |
| 3 | Assignment di-approve reviewer → karyawan | Employee | SUCCESS |
| 4 | Assignment di-reject reviewer → karyawan | Employee | WARNING |
| 5 | Minta revisi dari reviewer → karyawan | Employee | WARNING |
| 6 | Assignment complete (L2 approve) → karyawan | Employee | SUCCESS |
| 7 | Hasil kinerja dipublish → karyawan | Employee | INFO |
| 8 | Reminder hasil belum di-acknowledge | Employee | INFO |
| 9 | Reminder dispute masih terbuka | Reviewer, Approver, HR | WARNING |
| 10 | Dispute baru diajukan | HR, Reviewer | WARNING |
| 11 | Respons dispute dari HR → karyawan | Employee | INFO |
| 12 | Development recommendation di-assign → karyawan | Employee | INFO |

FK linker: `notifications.referenceId` berisi `PerformanceResult.id` atau `PerformanceResultDispute.id`.

### B. Modul Employee (Tab Riwayat Kinerja)

`PerformanceResult.employeeId` (FK ke `employees.id`) memungkinkan tab **Riwayat Kinerja** di profil karyawan menampilkan semua hasil penilaian lintas periode. Fields penting yang ditampilkan:
- `finalScore`, `gradeCode`, `gradeLabel` → ringkasan kinerja
- `recommendationSummary` → rekomendasi pengembangan
- `PerformancePlanningAssignment.employeeSnapshot` → snapshot posisi karyawan saat periode berlangsung (immutable, meski karyawan pindah jabatan)

### C. Modul Payroll (Bonus Tahunan)

`PerformanceResult` dengan status `PUBLISHED` (Final Lock) menjadi sumber data bagi Payroll module untuk kalkulasi bonus kinerja tahunan. Link melalui:
- FK: `performance_results.employee_id` → `employee_salary_components.employee_id`
- `gradeCode` / `finalScore` → dipakai sebagai faktor multiplier bonus komponen `PERFORMANCE_BONUS`
- `performance_results.period_id` → dikaitkan ke `payroll_periods` berdasarkan tanggal tutup periode

> **Status integrasi saat ini:** Tersedia sebagai sumber data. Pipeline otomatis ke Payroll belum di-implement (future-ready via `finalizedAt` field dan queue job).

### D. Modul Reports (Bell Curve per Departemen)

`GET /periods/:id/results/dashboard` → `getPerformanceResultDashboard()` menghasilkan distribusi skor per departemen. Data ini dipakai oleh Reports module untuk:
- **Bell Curve Chart**: distribusi grade A-B-C-D-E per departemen
- **Ranking Karyawan**: sort berdasarkan `finalScore` dalam scope dept
- **Trend Analysis**: bandingkan `finalScore` lintas periode untuk karyawan yang sama (`employeeId` FK sama)

FK linker: `performance_results.companyId` + `employee.departmentId` (via join ke Employee module).

---

## ⚠️ 9. Business Rules Gap Analysis

| # | Aturan Bisnis | Status Saat Ini | Ideal / Hardening Production |
|---|---|---|---|
| 1 | **Snapshot konfigurasi immutable saat periode mid-cycle** | `PerformancePeriod.configSnapshot` di-set saat publish (`buildPeriodConfigSnapshot()`). Namun jika method version diupdate setelah periode published, tidak ada guard di service yang mencegah update method version yang sudah digunakan periode aktif | Service `updateMethodVersion()` harus cek: jika ada `PerformancePeriod.status = PUBLISHED/CLOSED` yang menggunakan version ini → throw `ConflictError('Method version digunakan periode aktif, tidak bisa diubah')` |
| 2 | **Maksimum 3 kali penyesuaian kalibrasi per karyawan** | Tidak ada pembatasan. `applyCalibrationDecision()` dapat dipanggil berulang kali tanpa batas, menghasilkan banyak baris di `performance_calibration_decisions` | Tambah validasi di service: `COUNT(decisions) WHERE resultId = X AND sessionId = Y` > 3 → throw `BadRequestError('Batas maksimal 3 penyesuaian per karyawan per sesi telah tercapai')` |
| 3 | **Dispute window auto-close setelah 7/14 hari** | `PerformanceResult.disputeDeadline` di-set saat publish, tetapi tidak ada background job yang otomatis menutup dispute yang expired. Dispute tetap `OPEN` selamanya kecuali HR menutupnya manual | Tambah cron job atau automation schedule yang berjalan harian: `UPDATE performance_result_disputes SET status='CLOSED', closedAt=NOW() WHERE status IN ('OPEN','RESPONDED') AND result.disputeDeadline < NOW()` |
| 4 | **Manager tidak bisa me-review dirinya sendiri** | `ensureExecutionApprover()` ([service.ts#L539-L556](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/modules/performance/performance.service.ts#L539-L556)) mengecek apakah actor adalah approver yang dikonfigurasi, tetapi tidak mencegah `reviewerId = employeeId` saat pembuatan assignment. Jika Pak Rudi menjadi reviewer sekaligus karyawan yang dinilai dalam 1 assignment, sistem tidak protes | Validasi di `createPlanningAssignment()`: jika `reviewerId === employeeId` → throw `BadRequestError('Reviewer tidak boleh sama dengan karyawan yang dinilai')`. Idem untuk `approverId === employeeId` |
| 5 | **Bobot KPI:Kompetensi:OKR = 40:30:30 sebagai weighted sum** | Formula kalkulasi menggunakan `buildPerformanceCalculation()` yang bersifat configurable: `componentScoreWeighted = componentNormalizedScore × componentWeight / 100`. Bobot bebas dikonfigurasi per company. Tidak ada enforcement aturan distribusi 40:30:30 | Jika kebijakan perusahaan mewajibkan distribusi bobot tertentu, tambahkan `componentWeightPolicy` di `PerformanceMethodVersion.normalizationRule` JSON, lalu service memvalidasi: total bobot komponen tipe `KPI` = 40, `COMPETENCY` = 30, `GOAL` = 30. Saat ini `normalizationRule` ada tapi belum diproses |
| 6 | **Bell curve paksa 10-20-40-20-10 per departemen minimal 10 sampel** | `parseForcedDistribution()` + `buildForcedDistributionAnalysis()` ([service.ts#L208-L348](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/modules/performance/performance.service.ts#L208-L348)) sudah menghitung compliance. Namun `finalizeCalibrationSession()` tidak memblokir finalisasi meski `isCompliant = false`. Juga tidak ada validasi minimum sampel (misal 10 peserta) sebelum sesi dapat difinalisasi | `finalizeCalibrationSession()` harus: (a) cek `participants.length >= 10` → jika kurang throw `BadRequestError('Minimal 10 peserta untuk kalibrasi bell curve')`, (b) cek `distributionAnalysis.isCompliant === true` → jika tidak throw `BadRequestError('Distribusi belum memenuhi target. Silakan sesuaikan nilai peserta berikut: ...')` |

---

## 🎯 10. TL;DR — Flowchart 9 Fase

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                     SIKLUS PERFORMANCE MANAGEMENT — 9 FASE                              │
└─────────────────────────────────────────────────────────────────────────────────────────┘

1️⃣ KONFIGURASI LIBRARY
   HR buat: PerformanceMethod → PerformanceMethodVersion → Components (KPI/Kompetensi/OKR)
   Library: PerformanceFormula + PerformanceIndicator + PerformanceGradeRule + WorkflowTemplate
   Method Version: publish → status PUBLISHED (frozen)
         │
         ▼
2️⃣ SETUP PERIODE
   PerformancePeriod dibuat & diikat ke method version yang sudah PUBLISHED
   Readiness check: komponen ✅, grade rule ✅, bobot = 100 ✅, tanggal valid ✅
   publishPeriod() → configSnapshot frozen → status PUBLISHED
         │
         ▼
3️⃣ PLANNING & ASSIGNMENT
   HR assign 74 karyawan ke periode + set reviewer & approver
   HR tambah targets per karyawan (KPI item, bobot, indikator, formula)
   publishPlanning() → semua assignment DRAFT → PUBLISHED
         │
         ▼
4️⃣ EKSEKUSI (Karyawan)
   Karyawan buka "My Assignments" (GET /execution/my-assignments)
   Update progress, isi currentValue, selfComment, upload bukti evidence
   Assignment status → IN_PROGRESS
   Karyawan submit → status SUBMITTED
         │
         ▼
5️⃣ GOVERNANCE (Manager L1 + L2)
   Reviewer (Manager) lihat antrian approval → review semua target → tambah reviewerComment
   approvePlanningAssignment() → APPROVED
   Dept Head completePlanningAssignment() → COMPLETED
         │
         ▼
6️⃣ KALKULASI SKOR
   calculatePerformanceResults() → buildPerformanceCalculation()
   Per karyawan: rawScore per target → normalizedScore → weightedScore per komponen
   → finalScore → mapGradeResult() → gradeCode, recommendationSummary
   PerformanceResult.status = CALCULATED
         │
         ▼
7️⃣ KALIBRASI (Komite)
   createCalibrationSession() + scope + forcedDistribution 10-20-40-20-10
   openCalibrationSession() → OPEN
   applyCalibrationDecision() per peserta yang melebihi kuota (audit log immutable)
   buildForcedDistributionAnalysis() → cek compliance
   close() → CLOSED → finalize() → FINALIZED
   PerformanceResult.status = CALIBRATED
         │
         ▼
8️⃣ PUBLIKASI & ACKNOWLEDGE
   approvePerformanceResults() → status FINALIZED
   publishPerformanceResults() → visibilityPolicy + disputeDeadline (+14 hari)
   status → PUBLISHED. Notifikasi ke semua karyawan.
   Karyawan: GET /results/me → lihat hasil → POST /results/:id/acknowledge
         │
         ▼
9️⃣ DISPUTE → FINAL LOCK
   Karyawan ajukan keberatan: POST /results/:id/disputes
   HR respond: POST /result-disputes/:id/respond (status RESOLVED/REJECTED/CLOSED)
   Jika diterima: reopenPerformanceResult() → recalculate → publish ulang
   Jika ditolak / dispute window habis → PerformanceResult tetap PUBLISHED
   → FINAL LOCK ✅ → Siap untuk Payroll Bonus & Succession Planning
```

---

*Dokumen ini dihasilkan dari pembacaan langsung source code per tanggal 7 Agustus 2025. Semua referensi baris mengacu pada commit branch `main` terkini.*
