# Blueprint Sistem HRIS Enterprise

## 1. Gambaran Umum Arsitektur

Sistem HRIS Enterprise adalah aplikasi SaaS Human Resources Information System multi-tenant (group of companies) dengan arsitektur monolitik modular yang mendukung skala enterprise. Sistem dirancang untuk menangani seluruh siklus hidup manajemen karyawan mulai dari rekrutmen, onboarding, manajemen data karyawan, absensi, cuti, payroll, benefit, performance management, training, hingga offboarding.

```
┌─────────────────────────────────────────────────────────────────┐
│                        Frontend (React 19)                       │
│  Vite + TypeScript + TanStack Query + Zustand + Radix + Tailwind │
└────────────────────────────────────┬────────────────────────────┘
                                     │ HTTPS / REST API (JSON)
┌────────────────────────────────────▼────────────────────────────┐
│                    Backend API (Express 5 + TypeScript)          │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐            │
│  │  Auth    │ │  RBAC    │ │ Employee │ │  Org     │  ... 20+   │
│  │  Module  │ │  Module  │ │  Module  │ │  Module  │   Modules  │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘            │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  Shared Layer: Middleware, Security, Utils, Events,     │    │
│  │  Logging, Error Handling, Pagination, Validation        │    │
│  └─────────────────────────────────────────────────────────┘    │
└───┬──────────────────┬──────────────────┬───────────────────────┘
    │                  │                  │
    ▼                  ▼                  ▼
┌─────────┐      ┌───────────┐      ┌────────────┐
│  MySQL  │      │   Redis   │      │ RabbitMQ   │
│ (Prisma)│      │  (Cache,  │      │ (Message   │
│  80+    │      │  BullMQ)  │      │   Broker)  │
│ Tables  │      └───────────┘      └────────────┘
└─────────┘
```

## 2. Stack Teknologi

### Backend Stack
| Layer | Teknologi | Versi | Tujuan |
|-------|-----------|-------|--------|
| Runtime | Node.js | LTS (via tsx) | Execusi TypeScript native |
| Framework | Express | ^5.0.0 | HTTP server & routing |
| Language | TypeScript | ^5.6.3 | Type safety |
| ORM | Prisma | ^5.22.0 | Database access layer (MySQL) |
| Validation | Zod | ^3.23.8 | Input validation & DTO schema |
| Auth | JWT (jsonwebtoken) | ^9.0.2 | Token-based authentication |
| Password Hashing | Argon2 + bcryptjs | ^0.41.1 / ^2.4.3 | Credential hashing |
| Cache | ioredis | ^5.4.1 | Caching & session store |
| Queue | BullMQ | ^5.34.10 | Background job processing |
| Message Broker | amqplib (RabbitMQ) | ^0.10.4 | Pub/Sub domain events |
| Logger | Winston + daily-rotate | ^3.14.2 | Structured logging |
| Rate Limit | express-rate-limit | ^7.4.1 | API throttling |
| Security Headers | Helmet | ^8.0.0 | OWASP security headers |
| CORS | cors | ^2.8.5 | Cross-origin control |
| File Upload | Multer | ^1.4.5-lts.1 | Multipart form upload |
| Email | Nodemailer | ^6.9.15 | SMTP email delivery |
| CSV/Excel | csv-parse/csv-stringify | ^5.5.6 | Import/export data |
| HTTP Client | Axios | ^1.7.7 | Outbound HTTP calls |
| Testing | Jest + supertest | ^29.7.0 | Unit & E2E tests |

### Frontend Stack
| Layer | Teknologi | Versi | Tujuan |
|-------|-----------|-------|--------|
| Runtime | Vite | ^5.4.10 | Build tool & dev server |
| Framework | React | ^19.0.0-rc.0 | UI component library |
| Language | TypeScript | ^5.6.3 | Type safety |
| Routing | React Router | ^6.28.0 | Client-side routing |
| Data Fetching | TanStack React Query | ^5.59.16 | Server state management |
| Global State | Zustand | ^5.0.1 | Client state (auth, UI, company) |
| Form | React Hook Form | ^7.53.1 | Form state & submission |
| Validation Resolver | @hookform/resolvers + Zod | ^3.9.0 | Client-side validation sync with backend |
| UI Primitives | Radix UI Components | ^1.x series | Accessible headless components |
| Styling | Tailwind CSS | ^3.4.14 | Utility-first CSS |
| Class Utils | clsx + tailwind-merge + CVA | ^2.1.1 | Dynamic className composition |
| Iconography | Lucide React | ^0.453.0 | SVG icon set |
| Animation | Framer Motion | ^11.11.9 | UI transitions |
| Toast | react-hot-toast | ^2.4.1 | In-app notification |
| Table | TanStack Table | ^8.20.5 | Data grid & pagination |
| Charts | Recharts | ^2.13.3 | Dashboard visualization |
| Export | jsPDF + xlsx | ^2.5.2 / ^0.18.5 | PDF & Excel export |
| i18n | Custom provider | - | Internalization |
| Testing | Vitest + Testing Library + Playwright | ^2.1.3 | Unit, integration & E2E |

### Infrastructure & Database
- **Database**: MySQL 8.0+ (Prisma 28 migrations, 80+ tables)
- **Cache**: Redis 7+ (caching, rate limit, BullMQ queue persistence, LRU eviction)
- **Message Queue**: RabbitMQ 3.12+ (domain event fan-out)
- **Container**: Dockerfile available untuk backend
- **CI/CD**: GitHub Actions deploy workflow (`.github/workflows/deploy.yml`)

## 3. Struktur Modul Backend (25 Modules)

Lokasi: `backend/src/modules/`

| Module | Kode | Cakupan Fitur | Core Entities |
|--------|------|---------------|---------------|
| **Authentication** | auth | Login, refresh token, change password, forgot password, MFA placeholder | User, RefreshToken, LoginLog |
| **RBAC** | rbac | Role CRUD, permission assignment, user-role mapping, system vs custom roles | Role, Permission, RolePermission, UserRole |
| **User Management** | user | User list, activate/deactivate, reset password, profile | User |
| **Organization** | organization | Company group, company, branch, division, department, sub-department, position | CompanyGroup, Company, Branch, Division, Department, SubDepartment, Position |
| **Employee Master** | employee | Employee CRUD, import CSV, detail tabs (family, education, experience, skill, training, emergency contact, attachment), career transaction, multi-company assignment | Employee, EmployeeFamily, EmployeeEducation, EmployeeEmergencyContact, EmployeeTraining, EmployeeSkill, EmployeeExperience, EmployeeAttachment, EmployeeCareerTransaction, EmployeeCompanyAssignment, UserCompanyAccess |
| **Attendance** | attendance | Clock in/out, attendance log, geofence check, shift formula, shift swap, overtime, permission request | Attendance, ShiftFormula, ShiftSwapRequest, OvertimeRequest, PermissionRequest, EmployeeShiftOverride, BranchAttendancePolicy |
| **Leave** | leave | Leave type, leave balance, leave request, approval workflow, carry over | LeaveType, LeaveBalance, LeaveRequest |
| **Payroll** | payroll | Salary component, employee salary structure, payroll period, payroll run, payslip generation, disbursement | SalaryComponent, EmployeeSalary, EmployeeSalaryComponent, PayrollPeriod, PayrollRun, Payslip, PayslipComponent |
| **Benefit** | benefit | Benefit plan (BPJS, asuransi, THR), enrollment, contribution employee/employer | BenefitPlan, BenefitEnrollment, BenefitDeduction |
| **Performance Management** | performance | 8 phases: Config Engine → Libraries → Workflows → Period/Snapshot → Governance → Planning/Assignment → Execution/Runtime → Calibration → Result/Publish/Dispute → Approval/Reopen/Integration | +30 tables: PerformanceFormula, Indicator, GradeRule, Method/Version, Component, Period, PlanningAssignment/Target/Progress/Evidence, Result, CalibrationSession, Dispute, DevRecommendation, AutomationSchedule, ReviewCycle/Review, FeedbackRequest, Goal |
| **Training & Development** | training | Training category, course, enrollment, attendance, completion certificate | TrainingCategory, TrainingCourse, TrainingEnrollment, TrainingAttendance |
| **Recruitment** | recruitment | Job posting, candidate, application pipeline, interview scheduling, interview feedback, hiring status | JobPosting, Candidate, JobApplication, Interview |
| **Onboarding/Offboarding** | onboarding | Checklist template, assignment, PIC, exit clearance | OnboardingChecklist, Resignation, ExitClearance |
| **Asset Management** | asset | Asset category, asset master, assignment to employee, return tracking | AssetCategory, Asset, AssetAssignment |
| **Document Management** | document-management | Document category, upload, version, signature, access log, visibility control | DocumentCategory, Document, DocumentSignature, DocumentAccessLog |
| **Work Calendar** | work-calendar | Work week setup, national holiday, calendar per branch/company | WorkCalendar, NationalHoliday |
| **Notification** | notification | In-app notification, unread counter, read status | Notification |
| **Permission Request** | permission-request | Special permission (izin keluar kantor, dinas luar), approval flow | PermissionRequest |
| **Employee Loan** | employee-loan | Loan type, application, amortization schedule, payment tracking | LoanType, Loan |
| **Travel & Expense** | travel-expense | Business trip, travel advance, expense claim, reimbursement | BusinessTrip, TravelAdvance, ExpenseClaim, Reimbursement |
| **Workflow Engine** | workflow-engine | Workflow template (stage, approver mapping), workflow instance, task list, approval action | WorkflowTemplate, WorkflowInstance |
| **Reports & Analytics** | reports | Employee headcount, turnover, attendance summary, payroll summary, performance distribution | - (aggregation queries) |
| **Audit Log** | audit-log | Full change tracking: actor, action, resource, before/after snapshot, IP, user agent | AuditLog |

### Shared Infrastructure Layer
Lokasi: `backend/src/shared/` dan `backend/src/infrastructure/`

| Komponen | Lokasi | Tugas |
|----------|--------|-------|
| Prisma Client | `shared/database/prisma.ts` | Singleton DB connection + health check |
| Result Pattern | `shared/core/Result.ts` | Standardized response envelope |
| Custom Exceptions | `shared/exceptions/AppError.ts` | Typed errors: Auth, Forbidden, NotFound, Conflict, BadRequest, Validation, TooManyRequests |
| Error Handler MW | `shared/middleware/ErrorHandler.ts` | Global exception catcher → JSON response |
| Auth MW | `shared/middleware/Authenticate.ts` | JWT verification → inject `req.user` |
| Authorization MW | `shared/middleware/Authorize.ts` | `authorize(resource:action)`, `authorizeRole(...)`, `authorizeOwnership(...)` |
| Company Scope MW | `shared/middleware/CompanyScope.ts` | Row-level multi-tenant isolation |
| Request Validator MW | `shared/middleware/RequestValidator.ts` | Zod schema → DTO validation pipeline |
| Pagination MW | `shared/middleware/Pagination.ts` | Standardized page/limit/sort |
| Audit Log MW | `shared/middleware/AuditLog.ts` | Auto-create audit trail on mutations |
| JWT Handler | `shared/security/JWTHandler.ts` | Access/refresh token sign & verify |
| Password Handler | `shared/security/PasswordHandler.ts` | Argon2 hashing & verification |
| System Code Generator | `shared/utils/system-code.ts` | EMP-XXXX, PAY-XXXX sequential code generator |
| Winston Logger | `shared/logger/WinstonLogger.ts` | Console + daily file rotation |
| Event Bus | `shared/events/EventBus.ts` | In-process event dispatcher → fan-out ke RabbitMQ + BullMQ |
| Domain Events List | `shared/events/events.ts` | Enum events: ROLE_CREATED, USER_LOGGED_IN, dll. |
| Redis Cache | `infrastructure/cache/RedisCache.ts` | Cache abstraction: get/set/del/ping, TTL, LRU client |
| RabbitMQ Broker | `infrastructure/messaging/RabbitMQBroker.ts` | Publisher/subscriber fan-out |
| Queue Manager (BullMQ) | `infrastructure/queue/QueueManager.ts` | Queue factory: DOMAIN_EVENTS, PERFORMANCE_AUTOMATION |

## 4. Struktur Modul Frontend

Lokasi: `frontend/src/modules/` (22 halaman utama + shared)

### Pola Arsitektur Frontend
```
modules/<nama-module>/
  pages/              # Route-level page components
    <PageName>.tsx
  components/         # Module-scoped reusable components
services/             # API service layer (axios) per module (24 services)
stores/               # Zustand global stores: auth, company, ui, popup
routes/               # index.tsx (route tree) + ProtectedRoute.tsx
layouts/              # AuthLayout, DashboardLayout, Sidebar, TopNavigation
components/
  shared/             # PageHeader, LanguageSwitcher
  ui/                 # Design system: button, input, label, select2, popup-host
```

### Mapping Halaman → Module API
| Frontend Page | Backend Module | Key Routes |
|---------------|----------------|------------|
| Login/ForgotPassword/Profile | auth | POST `/auth/login`, `/auth/refresh`, `/auth/change-password` |
| DashboardPage | - (aggregate) | - |
| Company/Organization/Branch/Department/Position/Group List + Chart | organization | `/organization/*` |
| RoleListPage | rbac | `/roles`, `/permissions/all` |
| AdminUsersPage, AdminAuditLogPage, AdminSettingsPage | user, audit-log | `/users`, `/audit-logs` |
| EmployeeList/Form/Detail + 7 tabs (Family, Education, Emergency, Experience, Skill, Training, Attachment) | employee | `/employees`, `/employees/:id/career-transactions`, dll. |
| AttendanceListPage | attendance | `/attendance`, `/attendance/clock-in`, shift endpoints |
| LeaveList + LeaveDetail | leave | `/leave`, `/leave/:id/approve` |
| PayrollDashboard, SalaryComponentList, PayrollPeriodList, PayrollRun (Create/List/Detail), PayslipDetail | payroll | `/payroll/salary-components`, `/payroll/periods`, `/payroll/runs`, `/payroll/payslips/:id` |
| BenefitPlanList + Detail | benefit | `/benefits/*` |
| PerformanceDashboard, PerformanceCycles, PerformanceMethods, PerformanceLibraries, PerformanceWorkflows, PerformancePeriods, PerformancePlanning, PerformanceExecution, PerformanceSelfReview, PerformanceManagerReview, PerformanceResults, PerformanceCalibration, PerformanceMyResults, GoalList, ReviewList | performance | 40+ endpoints under `/performance/*` |
| TrainingCourse List/Form/Detail | training | `/training/*` |
| Recruitment: JobPosting (List/Form/Detail), Candidate (List/Form), InterviewSchedule/Form, ApplicationPipeline | recruitment | `/recruitment/*` |
| Onboarding/Offboarding List+Detail | onboarding | `/onboarding/*`, `/offboarding/*` |
| AssetList | asset | `/assets/*` |
| DocumentManagementPage | document-management | `/documents/*` |
| NotificationsPage | notification | `/notifications`, `/notifications/:id/read` |
| PermissionRequest CRUD | permission-request | `/permission-requests/*` |
| EmployeeLoan List+Detail | employee-loan | `/employee-loans/*` |
| TravelExpensePage | travel-expense | `/travel-expenses/*` |
| ReportsPage | reports | `/reports/*` (export endpoints) |
| WorkCalendar List+Detail+Holidays, ShiftFormulaPage | work-calendar | `/work-calendars/*`, `/shift-formulas/*` |
| WorkflowEnginePage | workflow-engine | `/workflow-engine/*` |
| SelfServicePage | aggregate | multi-module self-service |

## 5. Skema Keamanan & RBAC

### Alur Autentikasi
1. **Login** → `AuthService.login()`:
   - Rate limiting per IP & per email
   - Account lockout setelah N failed attempts
   - Verifikasi password (argon2)
   - Build auth context: roles, permissions, company scope, group scope
   - Sign **access token (15m)** + **refresh token (7d)**
   - Refresh token disimpan di DB (whitelist), bisa di-revoke
   - Publish event `USER_LOGGED_IN`

2. **Request Auth**: `authenticate` middleware extracts & verifies Bearer token. Inject ke `req.user`:
   ```typescript
   { id, email, employeeId?, companyId?, companyScope[], groupId?, permissions[], roles[] }
   ```

### RBAC Hierarchy
```
SUPER_ADMIN (bypass semua, companyId=null → system-wide)
└── GROUP_ADMIN (scope: GROUP → semua company dalam group)
    └── COMPANY_ADMIN (scope: COMPANY → satu company)
        └── HR_MANAGER
            └── HR_STAFF
                └── MANAGER
                    └── EMPLOYEE (self-service only)
```

**Permissions Pattern**: `resource:action`
- Action: `create | read | update | delete | approve | export | process`
- Resource alias map: organization→org, attendance→att, recruitment→rec, dashboard→dash, travel-expense→travel

**Row-Level Access Rules**:
- `CompanyScope` middleware ensures all queries filter `companyId IN req.user.companyScope`
- System roles include: companyId=null tetap muncul di list meskipun filter company
- Performance assignments: employee hanya melihat milik sendiri (hard constraint)

**Immutable Properties**:
- System roles (isSystem=true): TIDAK boleh di-edit, di-delete, di-change permission
- Custom Role: `scope`, `companyId`, `groupId` immutable setelah creation
- System-generated codes (EMP-XXX, PAY-XXX): tidak bisa di-update

## 6. Data Flow Pattern

### HTTP Request Lifecycle (Standard Pipeline)
```
Client Request
  → Global Rate Limiter
  → Helmet + CORS + Body Parser
  → Request Logger (Winston HTTP log)
  → Router match
    → authenticate (JWT → req.user)
    → RequestValidator(zod schema DTO)
    → authorize(resource:action) / authorizeRole(...)
    → CompanyScope (tenant isolation)
    → Controller method
      → Service (business logic)
        → Repository (Prisma queries)
        → eventBus.publish(DomainEvent)
          → RabbitMQ publish + BullMQ queue (worker processes asynchronously)
      ← Service Result
    ← Controller response (JSON envelope)
  → AuditLog (auto on mutation)
  → ErrorHandler (jika exception)
```

### Background Worker Flow
Lokasi: `backend/src/worker.ts` (berjalan sebagai proses terpisah: `npm run worker`)

1. Bootstrap worker: DB health, Redis health, RabbitMQ connect, BullMQ queues
2. **BullMQ Worker `DOMAIN_EVENTS`**:
   - Consume semua domain events dari queue
   - Buat notification untuk user terkait
   - Fan-out ke RabbitMQ exchange untuk subscriber eksternal
   - Record processed event di Redis (200-item rolling log)
3. **BullMQ Worker `PERFORMANCE_AUTOMATION`**:
   - Schedule-based trigger: progress reminder, cycle status transitions
   - Dispute SLA escalation
4. **RabbitMQ Subscriber**: consume `hrms.domain-events` exchange
5. **Dead Letter Queue**: auto retry exponential backoff (default 3 attempts, 5s backoff)

### Pattern Repository-Service-Controller
```typescript
// Controller: HTTP interface only
@Post()
async create(req, res) { res.json(await service.create(req.body)); }

// Service: Business rules, validation, orchestration, transactions, events
async create(dto) {
  // check duplicate
  // generate code
  // validate constraints (e.g. FACTORY employee wajib punya shift)
  const result = repo.create(data);
  await eventBus.publish(EMPLOYEE_CREATED);
  logger.info('Employee created', { id });
  return result;
}

// Repository: Pure data access (Prisma), NO business logic
async create(data) { return prisma.employee.create({ data }); }
```

## 7. Multi-Tenant Data Model (SaaS Multi-Company)

```
CompanyGroup (Holding)
  ├── GroupSetting / GroupPolicy
  └── Company (Legal entity) [1..N per group]
        ├── CompanySetting
        ├── Branch (Lokasi fisik)
        │     └── BranchAttendancePolicy
        ├── Division → Department → SubDepartment (hierarki org)
        ├── Position (Jabatan, grade level, min/max salary, reportsTo)
        ├── Employee
        │     ├── User (1:1 optional, link via employeeId)
        │     ├── EmployeeCompanyAssignment (multi-company assignment: PRIMARY, SECONDMENT, TRANSFER)
        │     └── 15+ detail tables (family, education, dll.)
        ├── SalaryComponent → EmployeeSalary → Payslip
        ├── 30+ Performance tables
        └── 30+ module tables (semua punya companyId FK + @@index)
```

Isolasi tenant:
- Semua tabel non-system memiliki `companyId VARCHAR(36)` FK → index
- `deletedAt` soft delete untuk semua master tables
- `UserCompanyAccess`: user bisa punya akses ke banyak company, atau GROUP_WIDE scope

## 8. Konfigurasi Environment
Lokasi: `backend/.env.example` (wajib copy ke `.env`)

Key sections:
- **App**: name, port, url, NODE_ENV, API_PREFIX (default: `/api/v1`)
- **Database**: DATABASE_URL (MySQL connection string)
- **Redis**: enabled, url, host/port/password, db, key-prefix (hrms:)
- **RabbitMQ**: enabled, url, exchange name, queue prefix, prefetch
- **Queue**: enabled, default attempts (3), backoff ms (5000)
- **JWT**: access/refresh secret (min 32 chars!), expiry, issuer
- **Password**: salt rounds, min/max length, max attempts, lockout duration
- **Rate Limit**: window 15m, max requests 100, auth-specific 10
- **CORS origins**: comma-separated whitelist
- **SMTP Mail**: host, port, user, pass, from address
- **Upload**: max size 5MB, allowed mime (jpeg/png/gif/pdf), upload path
- **Logging**: level, directory
- **Session / CSRF / Encryption keys**: fallback keys NOT SECURE untuk production → WAJIB diganti

## 9. Deployment & Operations Blueprint

### Environment Targets
| Stage | DB | Redis | RabbitMQ | Worker |
|-------|----|-------|----------|--------|
| Development | local / Docker | local | local (optional, can disable) | `npm run worker` (optional) |
| Staging | Managed MySQL (RDS/CloudSQL) | Managed Redis | Managed RabbitMQ | 1 replica |
| Production | Managed MySQL HA + read replicas | Redis Cluster | RabbitMQ Cluster | 2+ replicas, auto-scaling |

### Proses Deploy
1. **Backend Build**: `npm run build` → `tsc && tsc-alias` → `dist/`
2. **DB Migrate**: `prisma migrate deploy` (production-safe, idempotent)
3. **Seed (hanya fresh install)**: `npm run prisma:seed`
   - 01-permissions → 02-roles (system roles: SUPER_ADMIN, EMPLOYEE, MANAGER, HR_STAFF, HR_MANAGER, COMPANY_ADMIN, GROUP_ADMIN) → 03-role-permissions → 04-admin-user (superadmin@hrms.com) → 05-test-data
4. **Start API**: `node dist/index.js` (PM2 / container orchestration)
5. **Start Worker**: `node dist/worker.js` (separate process)

### Monitoring Checklist
- `/health` endpoint: checks Redis, RabbitMQ, Queue health → 200 OK / 503 Degraded
- Winston logs: `logs/` directory dengan daily rotation
- Queue dashboard: BullMQ UI / RedisInsight for queue depth, failed jobs
- Prisma query performance: slow query log (tambahkan jika belum)

## 10. Batasan Sistem Saat Ini (Known Blueprint Constraints)
- **Belum production-ready**: JWT fallback secret visible, CSRF middleware tidak aktif, upload local filesystem (bukan object storage)
- **Zero test coverage**: Tidak ada `*.test.ts` / `*.spec.ts` terdeteksi di codebase
- **Performance module**: Phase 1-8 complete tetapi butuh load testing >10k employees
- **Frontend routes**: Protected route validation client-side, butuh tambahan server-side gate
- **File upload**: Belum ada antivirus scan, belum ada signed URL, belum ada lifecycle policy
