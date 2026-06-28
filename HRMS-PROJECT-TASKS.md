# HRMS Project — Complete Task List (Detail)

> **Project root:** `/Users/f/Documents/sdk-project/hrms/hris-draft`  
> **Last updated:** 2026-06-27

---

## 📋 LEGEND

| Icon | Arti |
|------|------|
| ✅ | Selesai (backend + frontend) |
| ⚠️ | Backend ada, frontend lewat halaman admin / blm sempurna |
| 🟡 | Backend selesai, frontend belum ada |
| 🟠 | Frontend ada (mock), backend belum |
| ❌ | Belum disentuh sama sekali |
| ➖ | Tidak relevan untuk modul ini |

---

## 1. ✅ CORE SYSTEM

### 1.1 Auth & User — ✅ Selesai

| Sub-modul | Backend | Frontend | Service |
|-----------|---------|----------|---------|
| Login | ✅ POST `/auth/login` | ✅ LoginPage | ✅ |
| Register | ✅ POST `/auth/register` | ❌ (belum ada halaman) | ✅ |
| Refresh Token | ✅ POST `/auth/refresh` | ✅ (di api.ts interceptor) | ✅ |
| Logout | ✅ POST `/auth/logout` | ✅ (di Sidebar) | ✅ |
| OTP Validation | ✅ POST `/auth/otp/validate` | ❌ | ✅ |
| Forgot Password | ✅ POST `/auth/reset/request` | ✅ ForgotPasswordPage | ✅ |
| Reset Password | ✅ POST `/auth/reset/confirm` | ❌ | ✅ |

### 1.2 User Management — ✅ Selesai

| Sub-modul | Backend | Frontend | Service |
|-----------|---------|----------|---------|
| List Users | ✅ GET `/users` | ✅ AdminUsersPage | ✅ user.service.ts |
| Detail User | ✅ GET `/users/:id` | ✅ (via table) | ✅ |
| Create User | ✅ POST `/users` | ✅ | ✅ |
| Update User | ✅ PATCH `/users/:id` | ✅ | ✅ |
| Delete User | ✅ DELETE `/users/:id` | ✅ | ✅ |
| Change Password | ✅ PATCH `/users/:id/password` | ❌ | ✅ |
| Reset Password | ✅ POST `/users/reset` | ❌ | ✅ |

### 1.3 RBAC / Roles — ✅ Selesai

| Sub-modul | Backend | Frontend | Service |
|-----------|---------|----------|---------|
| List Roles | ✅ GET `/roles` | ✅ RoleListPage (card grid) | ✅ rbac.service.ts |
| Detail Role | ✅ GET `/roles/:id` | ✅ (via modal) | ✅ |
| Create Role | ✅ POST `/roles` | ✅ (modal form) | ✅ |
| Update Role | ✅ PUT `/roles/:id` | ✅ (modal form) | ✅ |
| Delete Role | ✅ DELETE `/roles/:id` | ✅ (confirm dialog) | ✅ |
| Assign Permission | ✅ PUT `/roles/:id/permissions` | ✅ PermissionManager modal | ✅ |
| View Permissions | ✅ GET `/roles/:id/permissions` | ✅ (grouped checkboxes) | ✅ |

### 1.4 Organization — ✅ Selesai

| Sub-modul | Backend | Frontend | Service |
|-----------|---------|----------|---------|
| Company Groups | ✅ CRUD `/organization/groups` | ✅ GroupListPage | ✅ |
| Companies | ✅ CRUD `/organization/companies` | ✅ CompanyListPage | ✅ |
| Departments | ✅ CRUD `/organization/departments` | ✅ DepartmentListPage | ✅ |
| Positions | ✅ CRUD `/organization/positions` | ✅ PositionListPage | ✅ |

---

## 2. ✅ HR OPERATIONS

### 2.1 Employee — ✅ Selesai

| Sub-modul | Backend | Frontend | Service |
|-----------|---------|----------|---------|
| List Employees | ✅ GET `/employees` | ✅ EmployeeListPage | ✅ employee.service.ts |
| Detail Employee | ✅ GET `/employees/:id` | ✅ EmployeeDetailPage | ✅ |
| Create Employee | ✅ POST `/employees` | ✅ EmployeeFormPage | ✅ |
| Update Employee | ✅ PATCH `/employees/:id` | ✅ EmployeeFormPage | ✅ |
| Delete Employee | ✅ DELETE `/employees/:id` | ✅ | ✅ |
| Activate/Deactivate | ✅ PATCH `/:id/activate` | ❌ | ✅ |

### 2.2 Attendance — ✅ Selesai

| Sub-modul | Backend | Frontend | Service |
|-----------|---------|----------|---------|
| List Attendance | ✅ GET `/attendance` | ✅ AttendanceList | ✅ attendance.service.ts |
| Check In | ✅ POST `/attendance` | ❌ (belum ada form) | ✅ |
| Check Out | ✅ PATCH `/attendance/:id/checkout` | ❌ | ✅ |
| Overtime List | ✅ GET `/attendance/overtime` | ❌ | ✅ |
| Create Overtime | ✅ POST `/attendance/overtime` | ❌ | ✅ |
| Approve/Reject Overtime | ✅ PATCH `/overtime/:id/approve\|reject` | ❌ | ✅ |

### 2.3 Leave — ✅ Selesai

| Sub-modul | Backend | Frontend | Service |
|-----------|---------|----------|---------|
| List Leave | ✅ GET `/leave` | ✅ LeaveList | ✅ leave.service.ts |
| Detail Leave | ✅ GET `/leave/:id` | ✅ LeaveDetail | ✅ |
| Create Leave | ✅ POST `/leave` | ❌ (belum ada form) | ✅ |
| Approve/Reject Leave | ✅ PATCH `/:id/approve\|reject` | ❌ | ✅ |
| Leave Stats | ✅ GET `/leave/stats` | ❌ | ✅ |

### 2.4 Work Calendar — ✅ Selesai

| Sub-modul | Backend | Frontend | Service |
|-----------|---------|----------|---------|
| List Calendars | ✅ GET `/work-calendars` | ✅ WorkCalendarListPage | ✅ work-calendar.service.ts |
| Create Calendar | ✅ POST `/work-calendars` | ✅ (modal) | ✅ |
| Edit Calendar | ✅ PUT `/work-calendars/:id` | ✅ (modal) | ✅ |
| Delete Calendar | ✅ DELETE `/work-calendars/:id` | ✅ (confirm) | ✅ |
| Monthly Day Grid | ✅ GET `/:id/days?year=&month=` | ✅ WorkCalendarDetailPage | ✅ |
| Edit Day Type | ✅ PUT `/:id/days` (bulk) | ✅ (dropdown per hari) | ✅ |
| Generate Default Days | ✅ POST `/:id/generate` | ✅ (button) | ✅ |
| Copy Calendar | ✅ POST `/:id/copy` | ✅ (dialog) | ✅ |
| Count Working Days | ✅ GET `/:id/working-days` | ❌ (belum dipakai) | ✅ |
| Employee Calendar | ✅ GET `/employee/:employeeId` | ❌ | ✅ |
| Team Calendar | ✅ GET `/team/:managerId` | ❌ | ✅ |

### 2.5 Onboarding / Offboarding — ✅ Selesai

| Sub-modul | Backend | Frontend | Service |
|-----------|---------|----------|---------|
| List Onboarding | ✅ GET `/onboarding` | ✅ OffboardingList | ✅ onboarding.service.ts |
| Create Onboarding | ✅ POST `/onboarding` | ❌ | ✅ |
| Update Onboarding | ✅ PATCH `/onboarding/:id` | ❌ | ✅ |
| Complete Onboarding | ✅ POST `/:id/complete` | ❌ | ✅ |

---

## 3. ✅ COMPENSATION & BENEFITS

### 3.1 Payroll — ✅ Selesai

| Sub-modul | Backend | Frontend | Service |
|-----------|---------|----------|---------|
| Dashboard | ➖ | ✅ PayrollDashboard | ✅ payroll.service.ts |
| Salary Components | ✅ CRUD | ✅ SalaryComponentList | ✅ |
| Payroll Periods | ✅ CRUD | ✅ PayrollPeriodList | ✅ |
| Payroll Runs | ✅ CRUD | ✅ PayrollRunList | ✅ |
| Run Detail | ✅ | ✅ PayrollRunDetail | ✅ |
| Payslip Detail | ✅ | ✅ PayslipDetail | ✅ |
| Generate Payslip | ✅ POST `/:id/payslip` | ❌ | ✅ |

### 3.2 Benefits — ✅ Selesai

| Sub-modul | Backend | Frontend | Service |
|-----------|---------|----------|---------|
| List Plans | ✅ GET `/benefits` | ✅ BenefitPlanList | ✅ benefit.service.ts |
| Plan Detail | ✅ GET `/benefits/:id` | ✅ BenefitPlanDetail | ✅ |
| Create Plan | ✅ POST `/benefits` | ❌ | ✅ |
| Update Plan | ✅ PATCH `/benefits/:id` | ❌ | ✅ |
| Employee Benefits | ✅ GET `/benefits/employee/:employeeId` | ❌ | ✅ |

---

## 4. ✅ TALENT MANAGEMENT

### 4.1 Performance — ✅ Selesai

| Sub-modul | Backend | Frontend | Service |
|-----------|---------|----------|---------|
| Dashboard | ➖ | ✅ PerformanceDashboard | ✅ performance.service.ts |
| Reviews List | ✅ CRUD | ✅ ReviewList | ✅ |
| Goals | ✅ CRUD | ✅ GoalList | ✅ |
| Publish Review | ✅ POST `/:id/review/publish` | ❌ | ✅ |
| Metrics | ✅ GET `/:id/metrics` | ❌ | ✅ |

### 4.2 Recruitment — ✅ Selesai

| Sub-modul | Backend | Frontend | Service |
|-----------|---------|----------|---------|
| Job Postings | ✅ CRUD | ✅ JobPostingList | ✅ recruitment.service.ts |
| Posting Detail | ✅ | ✅ JobPostingDetail | ✅ |
| Candidates | ✅ CRUD | ✅ CandidateList | ✅ |
| Pipeline | ✅ | ✅ ApplicationPipeline | ✅ |
| Interviews | ✅ | ✅ InterviewSchedule | ✅ |
| Post/Close Job | ✅ POST/PATCH | ❌ | ✅ |
| Make Offer | ✅ POST `/jobs/:id/offer` | ❌ | ✅ |

### 4.3 Training / LMS — ✅ Selesai

| Sub-modul | Backend | Frontend | Service |
|-----------|---------|----------|---------|
| Course List | ✅ GET `/training/courses` | ✅ CourseList | ✅ training.service.ts |
| Course Detail | ✅ GET `/training/courses/:id` | ✅ CourseDetail | ✅ |
| Create Course | ✅ POST `/training/courses` | ❌ | ✅ |
| Enroll | ✅ POST `/courses/:id/enrol` | ❌ | ✅ |
| Complete | ✅ POST `/courses/:id/complete` | ❌ | ✅ |

---

## 5. ✅ OPERATIONS SUPPORT

### 5.1 Asset — ✅ Selesai

| Sub-modul | Backend | Frontend | Service |
|-----------|---------|----------|---------|
| List Assets | ✅ GET `/assets` | ✅ AssetList | ✅ asset.service.ts |
| Create Asset | ✅ POST `/assets` | ❌ | ✅ |
| Assign Asset | ✅ POST `/:id/assign` | ❌ | ✅ |
| Return Asset | ✅ POST `/:id/return` | ❌ | ✅ |

### 5.2 Audit Log — ⚠️ Partial

| Sub-modul | Backend | Frontend | Service |
|-----------|---------|----------|---------|
| List Audit | ✅ GET `/audit-logs` | ✅ AdminAuditLogPage | ✅ audit-log.service.ts |
| Detail Audit | ✅ GET `/audit-logs/:id` | ❌ | ✅ |
| Filter by User | ✅ GET `/audit-logs/user/:userId` | ❌ | ✅ |

---

## 6. ✅ ANALYTICS

### 6.1 Reports — ✅ Selesai

| Sub-modul | Backend | Frontend | Service |
|-----------|---------|----------|---------|
| Headcount Report | ✅ GET `/reports/headcount` | ✅ (BarChart) | ✅ reports.service.ts |
| Attendance Report | ✅ GET `/reports/attendance` | ✅ (PieChart + stats) | ✅ |
| Leave Report | ✅ GET `/reports/leave` | ✅ (BarChart) | ✅ |
| Payroll Report | ✅ GET `/reports/payroll` | ✅ (table + summary) | ✅ |
| Turnover Report | ✅ GET `/reports/turnover` | ✅ (LineChart) | ✅ |
| Recruitment Report | ✅ GET `/reports/recruitment` | ✅ (BarChart) | ✅ |
| CSV Export | ➖ | ✅ (per tab) | ➖ |

---

## 7. 🟡 / 🟠 PARTIAL / REMAINING

### 7.1 Notifications — ✅ Selesai

| Sub-modul | Backend | Frontend | Service |
|-----------|---------|----------|---------|
| Notification List | ✅ GET `/notifications` | ✅ NotificationsPage | ✅ notification.service.ts |
| Unread Count | ✅ GET `/notifications/unread-count` | ✅ (header) | ✅ |
| Mark Read | ✅ PUT `/notifications/read` | ✅ (per item) | ✅ |
| Mark All Read | ✅ PUT `/notifications/read-all` | ✅ (button) | ✅ |
| Delete | ✅ DELETE `/notifications/:id` | ✅ (icon button) | ✅ |
| Real-time Push | ❌ (future) | ❌ | ❌ |

---

## 8. ❌ BELUM DISENTUH

### 8.1 Self Service Request — ✅ Selesai

> Portal untuk karyawan mengajukan & melihat status berbagai pengajuan: izin, cuti, lembur.

| Sub-modul | Prisma Model | Backend | Frontend | Service |
|-----------|:------------:|:-------:|:--------:|:-------:|
| Permission Types (8 jenis) | ✅ PermissionType enum | ✅ | ✅ | ✅ |
| Submit Permission Request | ✅ PermissionRequest model | ✅ POST | ✅ PermissionForm modal | ✅ |
| My Requests List | ✅ | ✅ GET /my | ✅ SelfServicePage (tabs + filter) | ✅ |
| Approve / Reject | ➖ (via backend API) | ✅ PATCH approve/reject | ❌ (admin page future) | ✅ |
| Cancel Request | ➖ | ✅ PATCH cancel | ✅ (button) | ✅ |
| Unified Dashboard | ➖ | ➖ | ✅ Tabs: Izin, Cuti, Lembur | ✅ |

### 8.2 Employee Loan — ✅ Selesai

> Pinjaman karyawan: pengajuan, approval, cicilan, sisa pinjaman.

| Sub-modul | Prisma Model | Backend | Frontend | Service |
|-----------|:------------:|:-------:|:--------:|:-------:|
| Loan Types | ✅ LoanType model | ✅ GET /types | ✅ (dropdown di form) | ✅ |
| Apply Loan | ✅ Loan model | ✅ POST | ✅ EmployeeLoanPage + modal form | ✅ |
| Approve / Reject | ➖ | ✅ PATCH approve/reject | ❌ (admin page future) | ✅ |
| Installment Tracking | ✅ LoanInstallment model | ✅ GET /:id/installments | ✅ DetailPage tabel cicilan | ✅ |
| Remaining Balance | ✅ field on Loan | ✅ auto-calculate | ✅ info card + progress bar | ✅ |
| Payroll Deduction | ❌ (future) | ❌ | ❌ | ❌ |

### 8.3 Travel & Expense Claim — ⚠️ Partial

> Perjalanan dinas: pengajuan, approval, klaim biaya (transportasi, akomodasi, dll).

| Sub-modul | Prisma Model | Backend | Frontend | Service |
|-----------|:------------:|:-------:|:--------:|:-------:|
| Travel Request | ✅ BusinessTrip | ✅ GET/POST `/travel-expenses/trips`, `/trips/my` | ✅ TravelExpensePage form + list | ✅ travel-expense.service.ts |
| Travel Approval | ➖ | ✅ PATCH `/trips/:id/approve\|reject` | ✅ (approver action di page) | ✅ |
| Expense Categories | ✅ ExpenseCategory enum | ✅ GET `/travel-expenses/categories` | ✅ (dropdown di form claim) | ✅ |
| Submit Claim | ✅ ExpenseClaim | ✅ GET/POST `/travel-expenses/claims`, `/claims/my` | ✅ TravelExpensePage form + list | ✅ |
| Claim Approval | ✅ ExpenseApproval | ✅ PATCH `/claims/:id/approve\|reject` | ✅ (approver action di page) | ✅ |
| Receipt Upload | ⚠️ field `receiptFilePath` saja | ⚠️ belum multipart upload | ⚠️ input URL/path receipt | ✅ |
| Reimbursement | ✅ Reimbursement | ✅ POST `/claims/:id/reimburse` | ✅ (approver action di page) | ✅ |

### 8.4 Workflow Engine — ✅ Selesai

> Mesin workflow/approval yang bisa dikonfigurasi: multi-level approval, conditional routing.

| Sub-modul | Prisma Model | Backend | Frontend | Service |
|-----------|:------------:|:-------:|:--------:|:-------:|
| Workflow Templates | ✅ WorkflowTemplate | ✅ CRUD `/workflow-engine/templates` | ✅ WorkflowEnginePage | ✅ workflow-engine.service.ts |
| Approval Stages | ✅ WorkflowStage | ✅ nested config via template API | ✅ dynamic stage builder | ✅ |
| Approver Assignment | ✅ stage approver fields | ✅ role/user/backup approver config | ✅ form config per stage | ✅ |
| Condition Rules | ✅ WorkflowConditionRule | ✅ nested rule config + evaluation on start instance | ✅ dynamic rule builder | ✅ |
| Workflow Instance | ✅ WorkflowInstance + WorkflowInstanceStep + WorkflowInstanceLog | ✅ list/detail/start `/workflow-engine/instances*` | ✅ instance list + start modal | ✅ |
| Approval Actions | ➖ | ✅ POST `/instances/:id/actions` (approve/reject/escalate) | ✅ approval inbox actions | ✅ |

### 8.5 Document Management — ❌

> Upload, manage, dan tracking dokumen karyawan (kontrak, KTP, ijazah, dll).

| Sub-modul | Prisma Model | Backend | Frontend | Service |
|-----------|:------------:|:-------:|:--------:|:-------:|
| Document Categories | ❌ | ❌ | ❌ | ❌ |
| Upload Document | ❌ | ❌ | ❌ | ❌ |
| Document List | ❌ | ❌ | ❌ | ❌ |
| Document Preview | ❌ | ❌ | ❌ | ❌ |
| Document Expiry | ❌ | ❌ | ❌ | ❌ |
| Version History | ❌ | ❌ | ❌ | ❌ |

---

## 9. 📊 QUICK SUMMARY

### Per Modul (23 total)

```
CORE SYSTEM
├── 1.1 Auth              ✅ Full-stack
├── 1.2 User              ✅ Full-stack
├── 1.3 RBAC              ✅ Full-stack (baru)
├── 1.4 Organization      ✅ Full-stack

HR OPERATIONS
├── 2.1 Employee          ✅ Full-stack
├── 2.2 Attendance        ✅ Full-stack
├── 2.3 Leave             ✅ Full-stack
├── 2.4 Work Calendar     ✅ Full-stack
├── 2.5 Onboarding        ✅ Full-stack

COMPENSATION
├── 3.1 Payroll           ✅ Full-stack
├── 3.2 Benefits          ✅ Full-stack

TALENT
├── 4.1 Performance       ✅ Full-stack
├── 4.2 Recruitment       ✅ Full-stack
├── 4.3 Training/LMS      ✅ Full-stack

OPERATIONS
├── 5.1 Asset             ✅ Full-stack
├── 5.2 Audit Log         ⚠️ Backend ✅, via /admin

ANALYTICS
├── 6.1 Reports           ✅ Full-stack

PENDING
├── 7.1 Notifications     ✅ Full-stack (baru)
├── 8.1 Self Service      ✅ Full-stack (baru)
├── 8.2 Employee Loan     ✅ Full-stack (baru)
├── 8.3 Travel & Expense  ⚠️ Partial (baru)
├── 8.4 Workflow Engine   ✅ Full-stack (baru)
├── 8.5 Document Mgmt     ❌ Not started
```

### Angka

| Kategori | Jumlah |
|----------|:------:|
| ✅ Full-stack (backend + frontend + service) | **19 modul** |
| ⚠️ Partial / masih ada gap tertentu | **3 modul** (User, Audit Log, Travel & Expense) |
| 🟡 Backend ✅, Frontend ❌ | **0 modul** |
| 🟠 Frontend mock, Backend ❌ | **0 modul** |
| ❌ Not started | **1 modul** |
| **Total** | **23 modul** |

---

## 10. 🔜 RECOMMENDED PRIORITY

| Priority | Module | Estimasi | Alasan |
|----------|--------|----------|--------|
| 🥇 P1 | **Document Management** | 4-6 hari | Upload & tracking dokumen |
| 🥈 P2 | **Travel & Expense Polish** | 1-2 hari | File upload receipt dan refinement approval |
| 🥉 P3 | **Workflow Integration** | 2-4 hari | Sambungkan engine ke leave, loan, dan expense flow existing |
