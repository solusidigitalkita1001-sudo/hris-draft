# HRMS Enterprise — Panduan Lengkap

> Human Resource Management System berbasis web dengan arsitektur monorepo (Express.js + React).

---

## 📋 Daftar Isi

1. [Arsitektur Aplikasi](#1-arsitektur-aplikasi)
2. [Struktur Project](#2-struktur-project)
3. [Setup & Instalasi](#3-setup--instalasi)
4. [Database & Migration](#4-database--migration)
5. [Menjalankan Aplikasi](#5-menjalankan-aplikasi)
6. [Testing dengan Seed Data](#6-testing-dengan-seed-data)
7. [Module Overview](#7-module-overview)
8. [API Endpoints](#8-api-endpoints)
9. [Role & Permissions](#9-role--permissions)
10. [Troubleshooting](#10-troubleshooting)

---

## 1. Arsitektur Aplikasi

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (React + Vite)                   │
│  Port 5500                                                   │
│  modules/[nama-module]/pages/*.tsx                           │
│  services/[nama-module].service.ts                           │
│  layouts/Sidebar.tsx                                         │
│  routes/index.tsx                                            │
├─────────────────────────────────────────────────────────────┤
│                    Backend API (Express.js)                   │
│  Port 4000                                                    │
│  modules/[nama-module]/controller/service/repository/        │
│  shared/middleware/ (Auth, RBAC, Validation)                 │
│  shared/events/ (Event Bus)                                  │
├─────────────────────────────────────────────────────────────┤
│                    Database (MySQL via Prisma ORM)            │
│  host.docker.internal:3306                                    │
│  schema.prisma → migration → SQL                             │
└─────────────────────────────────────────────────────────────┘
```

### Pattern Backend per Module

```
modules/[module]/
├── [module].controller.ts   # Request handlers (req/res)
├── [module].service.ts      # Business logic
├── [module].repository.ts   # Database queries (Prisma)
├── [module].dto.ts          # Zod validation schemas
├── [module].routes.ts       # Express router
└── [module].types.ts        # Enums/constants
```

### Pattern Frontend per Module

```
modules/[module]/
└── pages/
    ├── [Nama]List.tsx       # Halaman daftar (table/card grid)
    └── [Nama]Detail.tsx     # Halaman detail
```

---

## 2. Struktur Project

```
hris-draft/
├── backend/
│   ├── src/
│   │   ├── modules/              # Modul bisnis
│   │   │   ├── organization/     # Group, Company, Branch, Division, Dept, Position
│   │   │   ├── employee/         # Master data karyawan
│   │   │   ├── attendance/       # Absensi harian & overtime
│   │   │   ├── leave/            # Cuti (jenis, permohonan, saldo)
│   │   │   ├── payroll/          # Payroll (komponen, run, payslip)
│   │   │   ├── benefit/          # Benefit plans & enrollment
│   │   │   ├── performance/      # Review, goals, 360 feedback
│   │   │   ├── recruitment/      # ATS (job posting, candidate, pipeline)
│   │   │   ├── training/         # LMS (course, session, enrollment)
│   │   │   ├── auth/             # Login, register, MFA
│   │   │   ├── rbac/             # Role & permission management
│   │   │   └── user/             # User account management
│   │   ├── shared/               # Shared infrastructure
│   │   │   ├── middleware/       # Authenticate, Authorize, Validate
│   │   │   ├── events/          # Domain event bus
│   │   │   ├── exceptions/      # Custom error classes
│   │   │   ├── database/        # Prisma client
│   │   │   ├── logger/          # Winston logger
│   │   │   └── core/            # Result pattern, base classes
│   │   ├── config/              # App configuration (env)
│   │   └── app.ts               # Express app setup
│   ├── package.json
│   └── .env
├── frontend/
│   ├── src/
│   │   ├── modules/             # Frontend pages per modul
│   │   ├── services/            # API service classes
│   │   ├── layouts/             # DashboardLayout, AuthLayout, Sidebar
│   │   ├── routes/              # React Router config
│   │   ├── components/          # Shared UI components
│   │   ├── stores/              # Zustand stores
│   │   └── utils/               # Formatting helpers
│   ├── package.json
│   └── vite.config.ts
├── docker/
│   └── mysql/                   # Docker MySQL setup
├── docker-compose.yml
├── TUTORIAL.md                  # ← File ini
└── pain-point.md                # Spesifikasi lengkap fitur
```

---

## 3. Setup & Instalasi

### Prasyarat

| Tool | Version | Notes |
|------|---------|-------|
| Node.js | ≥ 18.x | LTS disarankan |
| npm | ≥ 9.x | Bundled with Node |
| Docker Desktop | Latest | Untuk MySQL |
| Git | Latest | - |

### Langkah-langkah

```bash
# 1. Clone repository
git clone <repo-url> hris-draft
cd hris-draft

# 2. Setup environment
cp backend/.env.example backend/.env
# Edit backend/.env jika perlu (default sudah sesuai untuk local dev)

# 3. Install dependencies
cd backend && npm install
cd ../frontend && npm install
cd ..

# 4. Start database
docker compose up -d mysql

# 5. Run database migration
cd backend
npx prisma migrate dev

# 6. Seed data (termasuk test data)
npx ts-node src/database/seeds/seed.ts

# 7. Start aplikasi (butuh 2 terminal)
# Terminal 1: Backend
cd backend && npm run dev

# Terminal 2: Frontend
cd frontend && npm run dev
```

### Akses Aplikasi

| Aplikasi | URL |
|----------|-----|
| Frontend | http://localhost:5500 |
| Backend API | http://localhost:4000 |
| Health Check | http://localhost:4000/api/v1/health |

---

## 4. Database & Migration

### Teknologi
- **ORM**: Prisma 5.x
- **Database**: MySQL 8
- **Migration**: Prisma Migrate

### Perintah Penting

```bash
# Generate Prisma client setelah schema berubah
cd backend
npx prisma generate

# Buat migration baru
npx prisma migrate dev --name [nama_migration]

# Apply migration ke database
npx prisma migrate dev

# Reset database (data akan hilang!)
npx prisma migrate reset

# Lihat data di Prisma Studio
npx prisma studio

# Validasi schema
npx prisma validate
```

### Schema Prisma

File: `backend/src/database/prisma/schema.prisma`

Berisi ~30+ model yang mencakup:
- Organisasi (Group → Company → Branch → Division → Dept → Position)
- Employee (master data dengan BPJS, bank, dll)
- Attendance (absensi harian + overtime)
- Leave (jenis, permohonan, saldo cuti)
- Payroll (komponen gaji, run, payslip)
- Benefit (plan & enrollment)
- Performance (review cycle, goals, 360 feedback)
- Training (course, session, enrollment, attendance)
- Recruitment (job posting, candidate, application, interview)
- Auth (user, role, permission, refresh token)
- Audit log & Settings

---

## 5. Menjalankan Aplikasi

### Backend

```bash
cd backend

# Development dengan hot reload
npm run dev

# Production build
npm run build
npm start

# Lint
npm run lint
```

### Frontend

```bash
cd frontend

# Development dengan HMR
npm run dev

# Production build
npm run build

# Preview build
npm run preview

# TypeScript check
npx tsc --noEmit
```

### Docker (seluruh stack)

```bash
# Build & start semua service
docker compose up --build -d

# Hanya MySQL
docker compose up -d mysql

# Stop
docker compose down
```

---

## 6. Testing dengan Seed Data

### Login Credentials

Setelah menjalankan seed, gunakan kredensial berikut:

| Role | Email | Password |
|------|-------|----------|
| **Super Admin** | `admin@hrms.com` | `Admin123!` |
| Employee | `bambang@tech.com` | `Employee123!` |
| Employee | `siti@tech.com` | `Employee123!` |
| Employee | `ahmad@tech.com` | `Employee123!` |
| Employee | `dewi@tech.com` | `Employee123!` |

### Test Data yang Tersedia

| Module | Data |
|--------|------|
| **Organization** | 1 Group (HOLDING), 1 Company (TECH), 2 Branch, 1 Division |
| **Department** | IT, HR, Finance, Marketing |
| **Position** | Manager, Developer, HR Specialist, Accountant, Marketing Staff |
| **Employee** | 8 karyawan (permanent, contract, intern, probation) |
| **Salary** | 7 komponen gaji + struktur gaji per employee |
| **Payroll** | 1 payroll period aktif (June 2026) |
| **Leave** | 7 jenis cuti, balance tahunan, 2 sample request |
| **Benefit** | 4 benefit plans (BPJS, Insurance, THR) |
| **Attendance** | 7 hari absensi (dengan variasi late/present) |
| **Performance** | 1 review cycle Q2 2026, 1 sample review, 4 goals |
| **Training** | 2 kategori, 4 kursus |
| **Recruitment** | 1 job posting, 1 candidate, 1 application (di stage Interview) |

### Skip Test Data

```bash
SKIP_TEST_DATA=true npx ts-node src/database/seeds/seed.ts
```

### Run Seed Ulang

```bash
# Reset database & seed ulang
npx prisma migrate reset --force

# Atau seed saja (tanpa reset)
npx ts-node src/database/seeds/seed.ts
```

---

## 7. Module Overview

### 7.1 Organization
Backend lengkap, Frontend: Group/Company/Department/Position list.

**Endpoint prefix:** `/api/v1/organization`

### 7.2 Employee ✅
Backend + Frontend lengkap dengan pagination, search, filter.

**Key features:**
- Data pribadi (nama, gender, agama, status pernikahan)
- Data organisasi (departemen, posisi, branch)
- Data bank & pajak (bank, NPWP, BPJS)
- Status kepegawaian (ACTIVE, PROBATION, RESIGNED, dll)
- Pagination & search

### 7.3 Attendance ✅
**Key features:**
- Check-in/out harian
- Status: PRESENT, LATE, ABSENT, EXCUSED
- Auto-calculate late minutes
- Overtime request dengan approval

### 7.4 Leave ✅
**Key features:**
- Master jenis cuti (annual, sick, maternity, dll)
- Permohonan cuti dengan approval flow
- Saldo cuti tahunan per employee
- Auto-calculate total days from date range

### 7.5 Payroll ✅
**Key features:**
- Salary components (allowance/deduction)
- Perhitungan fixed amount & percentage
- Employee salary structure
- Payroll period & run
- Payslip generation with calculation engine
- Approval flow (COMPLETED → APPROVED → DISBURSED)

### 7.6 Benefit ✅
**Key features:**
- Benefit plans (BPJS, insurance, THR)
- Employee enrollment dengan coverage details
- Event publishing on create

### 7.7 Performance ✅
**Key features:**
- Review cycle (quarterly, annual, etc.)
- Performance review dengan sections & scores
- Goals/OKRs dengan progress tracking
- 360 feedback request & response

### 7.8 Training/LMS ✅
**Key features:**
- Training categories
- Course management dengan materials
- Scheduled sessions
- Employee enrollment & progress
- Attendance tracking per session

### 7.9 Recruitment ✅
**Key features:**
- Job posting management
- Candidate database
- Application pipeline stages
- Interview scheduling with online meeting
- Interview feedback

---

## 8. API Endpoints

Semua endpoint membutuhkan:
- `Authorization: Bearer <token>` header
- Atau `HttpOnly` cookie dengan refresh token

### Organization
```
GET    /api/v1/organization/groups
POST   /api/v1/organization/groups
GET    /api/v1/organization/companies
POST   /api/v1/organization/companies
GET    /api/v1/organization/departments
POST   /api/v1/organization/departments
GET    /api/v1/organization/departments/hierarchy/:companyId
GET    /api/v1/organization/positions
POST   /api/v1/organization/positions
```

### Employee
```
GET    /api/v1/employees?companyId=&departmentId=&status=&page=&limit=
GET    /api/v1/employees/:id
POST   /api/v1/employees
PUT    /api/v1/employees/:id
DELETE /api/v1/employees/:id
PATCH  /api/v1/employees/:id/status
```

### Attendance
```
GET    /api/v1/attendance?companyId=&date=&status=
POST   /api/v1/attendance
PATCH  /api/v1/attendance/:id/checkout
GET    /api/v1/attendance/overtime
POST   /api/v1/attendance/overtime
PATCH  /api/v1/attendance/overtime/:id/approve
PATCH  /api/v1/attendance/overtime/:id/reject
```

### Leave
```
GET    /api/v1/leave/types
POST   /api/v1/leave/types
GET    /api/v1/leave?companyId=&status=&employeeId=
GET    /api/v1/leave/:id
POST   /api/v1/leave
PATCH  /api/v1/leave/:id/approve
PATCH  /api/v1/leave/:id/reject
GET    /api/v1/leave/balances/employee?employeeId=
```

### Payroll
```
GET    /api/v1/payroll/salary-components
POST   /api/v1/payroll/salary-components
GET    /api/v1/payroll/employee-salaries
POST   /api/v1/payroll/employee-salaries
GET    /api/v1/payroll/periods
POST   /api/v1/payroll/periods
GET    /api/v1/payroll/runs
POST   /api/v1/payroll/runs
PATCH  /api/v1/payroll/runs/:id/approve
PATCH  /api/v1/payroll/runs/:id/disburse
```

### Recruitment
```
GET    /api/v1/recruitment/job-postings
POST   /api/v1/recruitment/job-postings
GET    /api/v1/recruitment/candidates
POST   /api/v1/recruitment/candidates
GET    /api/v1/recruitment/applications
POST   /api/v1/recruitment/applications
PATCH  /api/v1/recruitment/applications/:id/status
GET    /api/v1/recruitment/interviews
POST   /api/v1/recruitment/interviews
```

### Performance
```
GET    /api/v1/performance/review-cycles
POST   /api/v1/performance/review-cycles
GET    /api/v1/performance/reviews
POST   /api/v1/performance/reviews
PATCH  /api/v1/performance/reviews/:id/submit
PATCH  /api/v1/performance/reviews/:id/approve
GET    /api/v1/performance/goals
POST   /api/v1/performance/goals
```

### Training
```
GET    /api/v1/training/categories
POST   /api/v1/training/categories
GET    /api/v1/training/courses
POST   /api/v1/training/courses
GET    /api/v1/training/sessions
POST   /api/v1/training/sessions
GET    /api/v1/training/enrollments
POST   /api/v1/training/enrollments
```

---

## 9. Role & Permissions

### Roles yang Tersedia

| Role | Level | Deskripsi |
|------|-------|-----------|
| `SUPER_ADMIN` | Global | Akses penuh ke seluruh sistem |
| `GROUP_ADMIN` | Group | Admin untuk holding company |
| `COMPANY_ADMIN` | Company | Admin untuk satu perusahaan |
| `HR_MANAGER` | Company | Manager HR dengan approval authority |
| `HR_STAFF` | Company | Staff HR dengan akses operasional |
| `MANAGER` | Company | Dept manager (approve leave, attendance) |
| `EMPLOYEE` | Company | Karyawan reguler (self-service) |

### Permission Structure

Format: `resource:action`

```typescript
// Tersedia di seeds/modules/01-permissions.seed.ts
const permissions = [
  // Format: { resource, action, name, module, code }
  { resource: 'employee', action: 'read', name: 'Read Employee', code: 'employee:read' },
  { resource: 'payroll', action: 'process', name: 'Process Payroll', code: 'payroll:process' },
  // ... ~50+ permissions
];
```

### Permission per Module

| Module | Actions |
|--------|---------|
| auth | login, logout, impersonate |
| user | create, read, update, delete |
| employee | create, read, update, delete, export |
| attendance | create, read, update, approve, export |
| leave | create, read, update, approve, export |
| payroll | create, read, update, approve, export, process |
| benefit | create, read, update, delete |
| performance | create, read, update, approve |
| training | create, read, update, delete |
| recruitment | create, read, update, approve |
| organization | create, read, update, delete |
| rbac | create, read, update, delete, assign |
| dashboard | read, export |
| report | create, read, export |
| settings | read, update |

### Authorization Middleware

```typescript
import { authorize } from '@/shared/middleware/Authorize';

// Single permission
router.get('/', authorize({ resource: 'employee', action: 'read' }), handler);

// Multiple permissions
router.post('/', authorize(
  { resource: 'employee', action: 'create' },
  { resource: 'employee', action: 'update' }
), handler);

// Role-based
import { authorizeRole } from '@/shared/middleware/Authorize';
router.get('/admin', authorizeRole('SUPER_ADMIN', 'COMPANY_ADMIN'), handler);
```

---

## 10. Troubleshooting

### Database

**Q: Prisma connection refused?**
```
A: Pastikan Docker MySQL sudah running:
   docker compose ps
   
   Jika belum, start dengan:
   docker compose up -d mysql
```

**Q: Migration error "already exists"?**
```
A: Reset database:
   npx prisma migrate reset --force
```

**Q: Prisma client not found?**
```
A: Generate ulang client:
   cd backend && npx prisma generate
```

### Backend

**Q: Module not found '@/'?**
```
A: Pastikan path alias di tsconfig.json sudah benar, lalu:
   cd backend && npm run dev (gunakan ts-node dengan tsconfig-paths)
```

**Q: Port 4000 already in use?**
```
A: Ubah port di backend/.env:
   PORT=4001
```

**Q: Seed gagal dengan error duplicate?**
```
A: Seed menggunakan upsert, jadi aman di-run ulang.
   Jika masih error, reset database dulu.
```

### Frontend

**Q: TypeScript error di file baru?**
```
A: Jalankan type check:
   cd frontend && npx tsc --noEmit
   
   Perbaiki error yang muncul (biasanya unused import/variable)
```

**Q: API call 401 Unauthorized?**
```
A: Pastikan sudah login. Token ada di localStorage.
   Cek di browser dev tools → Application → Local Storage
```

**Q: Halaman kosong / blank page?**
```
A: Cek browser console untuk error.
   Pastikan backend sudah running di port 4000.
```

### Git

```bash
# Melihat perubahan yang belum di-commit
git status

# Melihat diff
git diff

# Commit perubahan
git add .
git commit -m "deskripsi perubahan"

# Switch branch
git checkout [branch-name]
```

---

## Flow Testing Cepat

```bash
# 1. Reset & seed database
cd backend
npx prisma migrate reset --force

# 2. Start backend
npm run dev
# Backend running at http://localhost:4000

# 3. TERMINAL BARU: Start frontend
cd frontend
npm run dev
# Frontend running at http://localhost:5500

# 4. Buka browser → http://localhost:5500
# 5. Login dengan admin@hrms.com / Admin123!
# 6. Explore semua module!
```

---

> **Last updated:** June 25, 2026
> **Author:** Bale Inovasi Teknologi
> **Tech Stack:** Express.js + React + TypeScript + Prisma + MySQL
