# Phase 1: Foundation Architecture

## High-Level Architecture

### System Context

```
┌─────────────────────────────────────────────────────────────┐
│                        HRMS Enterprise                        │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐   │
│  │   Web Client  │    │  Mobile App  │    │  3rd Party   │   │
│  │  (React SPA)  │    │   (Future)   │    │   API Int.   │   │
│  └──────┬───────┘    └──────┬───────┘    └──────┬───────┘   │
│         │                    │                    │           │
│  ┌──────┴────────────────────┴────────────────────┴───────┐  │
│  │                    API Gateway (Nginx)                  │  │
│  │              Rate Limit · WAF · Load Balancer           │  │
│  └────────────────────────┬───────────────────────────────┘  │
│                           │                                   │
│  ┌────────────────────────┴───────────────────────────────┐  │
│  │                 Express REST API                        │  │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ │  │
│  │  │  Auth    │ │ Employee │ │   Org    │ │Attend..  │ │  │
│  │  │ Module  │ │  Module  │ │  Module  │ │ Module   │ │  │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘ │  │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ │  │
│  │  │  Leave   │ │  Payroll │ │Dashboard │ │ Workflow │ │  │
│  │  │  Module  │ │  Module  │ │  Module  │ │  Engine  │ │  │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘ │  │
│  └────────────────────────┬───────────────────────────────┘  │
│                           │                                   │
│  ┌────────────────────────┴───────────────────────────────┐  │
│  │                 Shared Infrastructure                    │  │
│  │  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌──────┐ │  │
│  │  │Redis   │ │  Bull  │ │Winston │ │Prisma  │ │Mail  │ │  │
│  │  │ Cache  │ │  Queue │ │ Logger │ │   ORM  │ │Server│ │  │
│  │  └────────┘ └────────┘ └────────┘ └────────┘ └──────┘ │  │
│  └────────────────────────┬───────────────────────────────┘  │
│                           │                                   │
│  ┌────────────────────────┴───────────────────────────────┐  │
│  │                    MySQL Database                        │  │
│  │              (Multi-Company · Multi-Tenant)              │  │
│  └────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### Clean Architecture Layers

```
┌──────────────────────────────────────────────────┐
│                  Presentation Layer                │
│  Controllers · Middleware · DTOs · Validators     │
│  (Handles HTTP request/response only)             │
├──────────────────────────────────────────────────┤
│                  Application Layer                 │
│  Application Services · Use Cases · CQRS          │
│  (Orchestrates business flows)                    │
├──────────────────────────────────────────────────┤
│                  Domain Layer                      │
│  Domain Services · Entities · Value Objects        │
│  Domain Events · Specifications                   │
│  (Pure business logic, no infra dependencies)      │
├──────────────────────────────────────────────────┤
│                  Infrastructure Layer              │
│  Repositories · Cache · Queue · Mail · Storage    │
│  (Implements interfaces defined by domain)        │
└──────────────────────────────────────────────────┘
```

### Module Dependency Rules

```
┌─────────────┐
│  Container  │ (DI Container · Config · Logger)
└──────┬──────┘
       │
┌──────┴──────┐     ┌─────────────┐
│  Auth       │────▶│  User/RBAC  │
└──────┬──────┘     └──────┬──────┘
       │                    │
       ▼                    ▼
┌──────────────┐  ┌──────────────────┐
│ Organization │  │ Employee Master  │
│ (Group/Co)   │  │ (Personal · Job) │
└──────┬───────┘  └────────┬─────────┘
       │                    │
       ▼                    ▼
┌─────────────────────────────────────────────┐
│         Operational Modules                   │
│  Attendance · Leave · Payroll · etc.         │
└─────────────────────────────────────────────┘
```

## Phase 1 Module Breakdown

### 1. Authentication & Authorization
- Login with email/password
- JWT Access Token (15 min TTL)
- Refresh Token Rotation (7 day TTL, rotation on use)
- Token Blacklist (Redis)
- Session Management
- Password Policy (min 8 chars, complex)
- Bcrypt password hashing with salt
- Login attempt limiting
- MFA Ready structure

### 2. RBAC (Role-Based Access Control)
- Roles: Super Admin, Group Admin, Company Admin, HR Manager, HR Staff, Manager, Employee
- Permission hierarchy
- Company-scoped roles
- Group-scoped roles
- Action-based permissions (create, read, update, delete, approve, export)
- Resource-based permissions (employee, attendance, leave, payroll, etc.)

### 3. Company Group Structure
- CompanyGroup (Holding Company)
- Company (Entity under group)
- Branch (Physical location)
- Division (Functional vertical)
- Department (Sub-functional)
- SubDepartment (Team-level)
- Position (Job position with hierarchy)
- Company Switcher support
- Multi-level scoping

## Database Design

### Entity Relationship Diagram (Text-based)

```
┌─────────────────┐       ┌──────────────────┐
│  CompanyGroups  │       │    Companies      │
│─────────────────│       │──────────────────│
│ id (UUID) PK    │──1:N──│ id (UUID) PK      │
│ name            │       │ group_id (FK)     │
│ code (unique)   │       │ name              │
│ status          │       │ code (unique)     │
│ created_at      │       │ tax_id            │
│ updated_at      │       │ address           │
│ deleted_at      │       │ logo              │
│                 │       │ status            │
└─────────────────┘       │ created_at        │
                          │ updated_at        │
                          │ deleted_at        │
                          └────────┬──────────┘
                                   │
                          ┌────────┴──────────┐
                          │     Branches       │
                          │──────────────────-│
                          │ id (UUID) PK       │──1:N── ...
                          │ company_id (FK)   │
                          │ name               │
                          │ code (unique)      │
                          │ address            │
                          │ phone              │
                          │ status             │
                          │ timezone           │
                          └────────┬──────────┘
                                   │
                          ┌────────┴──────────┐
                          │     Divisions      │
                          │──────────────────-│
                          │ id (UUID) PK       │
                          │ company_id (FK)    │
                          │ name               │
                          │ code (unique)      │
                          │ head_id (FK)       │
                          │ status             │
                          └────────┬──────────┘
                                   │
                          ┌────────┴──────────┐
                          │    Departments     │
                          │──────────────────-│
                          │ id (UUID) PK       │
                          │ division_id (FK)   │
                          │ company_id (FK)    │
                          │ name               │
                          │ code (unique)      │
                          │ head_id (FK)       │
                          │ parent_id (FK)     │
                          │ status             │
                          └────────┬──────────┘
                                   │
                          ┌────────┴──────────┐
                          │  SubDepartments    │
                          │──────────────────-│
                          │ id (UUID) PK       │
                          │ department_id (FK) │
                          │ name               │
                          │ head_id (FK)       │
                          │ status             │
                          └────────┬──────────┘
                                   │
                          ┌────────┴──────────┐
                          │    Positions       │
                          │──────────────────-│
                          │ id (UUID) PK       │
                          │ department_id (FK) │
                          │ company_id (FK)    │
                          │ name               │
                          │ code (unique)      │
                          │ grade_level        │
                          │ min_salary         │
                          │ max_salary         │
                          │ reports_to_id (FK) │
                          │ status             │
                          └────────────────────┘
```

### Authentication Tables

```
┌──────────────────┐       ┌──────────────────────┐
│      Users        │       │   Roles               │
│──────────────────│       │──────────────────────│
│ id (UUID) PK      │──1:N──│ id (UUID) PK          │
│ email (unique)    │       │ name (unique)         │
│ password_hash     │       │ code (unique)         │
│ employee_id (FK)  │       │ description           │
│ status            │       │ is_system             │
│ must_change_pwd   │       │ company_id (FK)       │
│ last_login_at     │       │ group_id (FK)         │
│ failed_attempts   │       │ scope (company/group) │
│ locked_until      │       │ created_at            │
│ created_at        │       │ updated_at            │
│ updated_at        │       │ deleted_at            │
│ deleted_at        │       └──────────┬───────────┘
└────────┬─────────┘                    │
         │                              │
         │1:N              ┌────────────┴────────────┐
         ├─────────────────│    UserRoles             │
         │                 │─────────────────────────│
         │                 │ user_id (FK) + role_id  │
         │                 │ company_id (FK)          │
         │                 │ group_id (FK)            │
         │                 │ scope_type               │
         │1:N              └──────────────────────────┘
         │
┌────────┴─────────┐       ┌──────────────────────┐
│  RefreshTokens    │       │   Permissions         │
│──────────────────│       │──────────────────────│
│ id (UUID) PK      │       │ id (UUID) PK          │
│ user_id (FK)      │       │ resource              │
│ token_hash        │       │ action                │
│ family            │       │ name                  │
│ expires_at        │       │ code (unique)         │
│ is_revoked        │       └──────────┬───────────┘
│ created_at        │                    │
└───────────────────┘         ┌──────────┴───────────┐
                              │  RolePermissions      │
                              │──────────────────────│
                              │ role_id (FK) + perm_id│
                              └──────────────────────┘
```

## API Design - Phase 1

### Auth Endpoints

```
POST   /api/v1/auth/login          → Login
POST   /api/v1/auth/logout         → Logout
POST   /api/v1/auth/refresh        → Refresh Token
POST   /api/v1/auth/change-password → Change Password
POST   /api/v1/auth/forgot-password → Forgot Password
POST   /api/v1/auth/reset-password  → Reset Password
GET    /api/v1/auth/me             → Current User Profile
GET    /api/v1/auth/sessions       → Active Sessions
DELETE /api/v1/auth/sessions/:id   → Revoke Session
```

### Organization Endpoints

```
GET    /api/v1/organization/groups       → List Groups
POST   /api/v1/organization/groups       → Create Group
GET    /api/v1/organization/groups/:id   → Get Group
PUT    /api/v1/organization/groups/:id   → Update Group
DELETE /api/v1/organization/groups/:id   → Delete Group

GET    /api/v1/organization/companies       → List Companies
POST   /api/v1/organization/companies       → Create Company
GET    /api/v1/organization/companies/:id   → Get Company
PUT    /api/v1/organization/companies/:id   → Update Company
DELETE /api/v1/organization/companies/:id   → Delete Company

GET    /api/v1/organization/branches        → List Branches
POST   /api/v1/organization/branches        → Create Branch
...

GET    /api/v1/organization/divisions       → List Divisions
POST   /api/v1/organization/divisions       → Create Division
...

GET    /api/v1/organization/departments     → List Departments
POST   /api/v1/organization/departments     → Create Department
...

GET    /api/v1/organization/positions       → List Positions
POST   /api/v1/organization/positions       → Create Position
...

GET    /api/v1/organization/hierarchy   → Get Org Hierarchy Tree
```

### RBAC Endpoints

```
GET    /api/v1/roles                → List Roles
POST   /api/v1/roles                → Create Role
GET    /api/v1/roles/:id            → Get Role
PUT    /api/v1/roles/:id            → Update Role
DELETE /api/v1/roles/:id            → Delete Role
GET    /api/v1/roles/:id/permissions → Get Role Permissions
PUT    /api/v1/roles/:id/permissions → Update Role Permissions

GET    /api/v1/permissions          → List All Permissions
GET    /api/v1/users/:id/roles      → Get User Roles
PUT    /api/v1/users/:id/roles      → Assign User Roles
```

## Folder Structure - Phase 1

### Backend

```
src/
├── index.ts                        # Entry point
├── app.ts                          # Express app setup
├── config/
│   ├── index.ts                    # Config loader
│   ├── database.ts                 # DB config
│   ├── redis.ts                    # Redis config
│   ├── jwt.ts                      # JWT config
│   └── mail.ts                     # Mail config
│
├── shared/
│   ├── core/
│   │   ├── BaseController.ts       # Base controller
│   │   ├── BaseService.ts          # Base service
│   │   ├── BaseRepository.ts       # Base repository
│   │   ├── BaseEntity.ts           # Base entity
│   │   └── Result.ts               # Standardized result
│   │
│   ├── database/
│   │   ├── prisma.ts               # Prisma client singleton
│   │   └── UnitOfWork.ts           # Unit of Work pattern
│   │
│   ├── security/
│   │   ├── JWTHandler.ts           # JWT generation & verification
│   │   ├── PasswordHandler.ts      # Bcrypt hashing
│   │   ├── RateLimiter.ts          # Rate limiting
│   │   └── SecurityHeaders.ts      # Helmet config
│   │
│   ├── logger/
│   │   └── WinstonLogger.ts        # Winston configuration
│   │
│   ├── middleware/
│   │   ├── Authenticate.ts          # Auth middleware
│   │   ├── Authorize.ts            # RBAC middleware
│   │   ├── CompanyScope.ts         # Company scoping
│   │   ├── GroupScope.ts           # Group scoping
│   │   ├── ErrorHandler.ts         # Global error handler
│   │   ├── RequestValidator.ts     # Zod validation
│   │   ├── AuditLog.ts             # Audit logging
│   │   └── Pagination.ts           # Pagination handler
│   │
│   ├── events/
│   │   ├── EventBus.ts             # Event emitter
│   │   └── events.ts               # Event definitions
│   │
│   ├── queue/
│   │   └── QueueService.ts         # BullMQ service
│   │
│   └── exceptions/
│       ├── AppError.ts             # Base app error
│       ├── AuthError.ts            # Auth errors
│       ├── ValidationError.ts      # Validation errors
│       ├── NotFoundError.ts        # Not found errors
│       └── ForbiddenError.ts       # Forbidden errors
│
├── modules/
│   ├── auth/
│   │   ├── auth.controller.ts
│   │   ├── auth.service.ts
│   │   ├── auth.repository.ts
│   │   ├── auth.routes.ts
│   │   ├── auth.validation.ts
│   │   ├── auth.dto.ts
│   │   └── auth.test.ts
│   │
│   ├── organization/
│   │   ├── controllers/
│   │   │   ├── group.controller.ts
│   │   │   ├── company.controller.ts
│   │   │   ├── branch.controller.ts
│   │   │   ├── division.controller.ts
│   │   │   ├── department.controller.ts
│   │   │   └── position.controller.ts
│   │   ├── services/
│   │   │   ├── group.service.ts
│   │   │   ├── company.service.ts
│   │   │   ├── branch.service.ts
│   │   │   ├── division.service.ts
│   │   │   ├── department.service.ts
│   │   │   └── position.service.ts
│   │   ├── repositories/
│   │   ├── organization.routes.ts
│   │   ├── organization.validation.ts
│   │   └── organization.dto.ts
│   │
│   ├── rbac/
│   │   ├── controllers/
│   │   │   ├── role.controller.ts
│   │   │   └── permission.controller.ts
│   │   ├── services/
│   │   │   ├── role.service.ts
│   │   │   └── permission.service.ts
│   │   ├── repositories/
│   │   ├── rbac.routes.ts
│   │   └── rbac.validation.ts
│   │
│   └── user/
│       ├── user.controller.ts
│       ├── user.service.ts
│       ├── user.repository.ts
│       ├── user.routes.ts
│       └── user.validation.ts
│
├── infrastructure/
│   ├── cache/
│   │   └── RedisCache.ts
│   ├── mail/
│   │   └── MailService.ts
│   └── storage/
│       └── StorageService.ts
│
└── database/
    ├── migrations/
    └── seeds/
        ├── seed.ts
        ├── groups.seed.ts
        ├── roles.seed.ts
        ├── permissions.seed.ts
        └── users.seed.ts
```

### Frontend

```
src/
├── main.tsx
├── App.tsx
├── index.css
│
├── config/
│   ├── app.ts                     # App configuration
│   └── constants.ts               # Constants
│
├── types/
│   ├── api.ts                     # API response types
│   ├── auth.ts                    # Auth types
│   ├── organization.ts            # Org structure types
│   ├── user.ts                    # User types
│   └── common.ts                  # Common types
│
├── services/
│   ├── api.ts                     # Axios instance
│   ├── auth.service.ts            # Auth API calls
│   └── organization.service.ts    # Org API calls
│
├── stores/
│   ├── auth.store.ts              # Auth state (Zustand)
│   ├── ui.store.ts                # UI state
│   └── company.store.ts           # Company switcher state
│
├── hooks/
│   ├── useAuth.ts                 # Auth hooks
│   ├── usePagination.ts           # Pagination hook
│   └── useDebounce.ts             # Debounce hook
│
├── layouts/
│   ├── AuthLayout.tsx             # Login/register layout
│   ├── DashboardLayout.tsx         # Main dashboard layout
│   ├── Sidebar.tsx                # Left sidebar
│   ├── TopNavigation.tsx          # Top navigation
│   └── AppShell.tsx               # Main app shell
│
├── modules/
│   ├── auth/
│   │   ├── LoginPage.tsx
│   │   ├── ForgotPasswordPage.tsx
│   │   └── ResetPasswordPage.tsx
│   │
│   └── organization/
│       ├── pages/
│       │   ├── GroupListPage.tsx
│       │   ├── CompanyListPage.tsx
│       │   ├── BranchListPage.tsx
│       │   ├── DivisionListPage.tsx
│       │   ├── DepartmentListPage.tsx
│       │   └── PositionListPage.tsx
│       └── components/
│           ├── OrgTreeView.tsx
│           └── CompanySwitcher.tsx
│
├── components/
│   ├── ui/                         # Shadcn components
│   └── shared/
│       ├── DataTable.tsx
│       ├── PageHeader.tsx
│       ├── BreadcrumbNav.tsx
│       ├── SearchInput.tsx
│       ├── FilterBar.tsx
│       ├── StatusBadge.tsx
│       ├── ConfirmDialog.tsx
│       └── EmptyState.tsx
│
├── routes/
│   ├── index.tsx                   # Route definitions
│   ├── ProtectedRoute.tsx          # Auth guard
│   └── RoleGuard.tsx               # Role-based guard
│
├── utils/
│   ├── cn.ts                       # Classname utility
│   ├── format.ts                   # Formatters
│   └── date.ts                     # Date utilities
│
└── pages/
    ├── NotFoundPage.tsx
    └── UnauthorizedPage.tsx
```

## Security Architecture

```
┌─────────────────────────────────────────────────────┐
│                  Security Layers                       │
├─────────────────────────────────────────────────────┤
│  Layer 1: Network Security                            │
│  ├── Nginx reverse proxy                              │
│  ├── Rate limiting (per IP, per user, per endpoint)   │
│  └── CORS whitelist                                   │
│                                                       │
│  Layer 2: Transport Security                          │
│  ├── HTTPS enforced                                   │
│  ├── Helmet security headers (CSP, HSTS, X-Frame)    │
│  └── Cookie security (HttpOnly, Secure, SameSite)     │
│                                                       │
│  Layer 3: Authentication                              │
│  ├── JWT Access Token (15m TTL, signed RS256)         │
│  ├── Refresh Token Rotation with family tracking      │
│  ├── Token blacklist in Redis                         │
│  └── Brute force protection (lockout after 5 fails)   │
│                                                       │
│  Layer 4: Authorization                               │
│  ├── RBAC with role hierarchy                         │
│  ├── Company scope isolation                          │
│  ├── Group scope isolation                            │
│  └── Row-level security via Prisma middleware         │
│                                                       │
│  Layer 5: Application Security                        │
│  ├── Input validation (Zod schemas)                   │
│  ├── Anti XSS (DOMPurify, output encoding)            │
│  ├── Anti CSRF (double-submit cookie pattern)         │
│  ├── Anti IDOR (resource ownership verification)      │
│  ├── SQL injection (Prisma parameterized queries)     │
│  └── Mass assignment protection (DTOs)                │
│                                                       │
│  Layer 6: Audit & Compliance                          │
│  ├── All CRUD operations logged                       │
│  ├── Login attempts (success + failure)               │
│  ├── Sensitive data access logging                    │
│  └── Immutable audit trail                            │
└─────────────────────────────────────────────────────┘
```

## Redis Cache Strategy

```
┌─────────────────────────────────────────────────────────────┐
│                    Redis Usage                                │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  Session Store:                                              │
│  ├── Token Blacklist:  blacklist:{jti} → TTL until expiry   │
│  └── Rate Limiter:     ratelimit:{ip}:{endpoint} → count     │
│                                                               │
│  Cache Layer:                                                │
│  ├── Organization Tree:  cache:org:tree:{companyId} → 1h TTL │
│  ├── User Permissions:   cache:perm:{userId} → 30m TTL       │
│  ├── User Roles:         cache:roles:{userId} → 30m TTL      │
│  └── Company Info:       cache:company:{id} → 1h TTL         │
│                                                               │
│  Queue Layer (BullMQ):                                       │
│  ├── Email Queue         (welcome, password reset, notif)    │
│  ├── Audit Queue         (async audit log write)             │
│  └── Notification Queue  (push/email notifications)          │
│                                                               │
│  Session Management:                                         │
│  └── Active Sessions:    session:{userId}:{sessionId} → info  │
└─────────────────────────────────────────────────────────────┘
```

## Error Handling Strategy

```
Error Hierarchy:
├── AppError (Base)
│   ├── BadRequestError        (400) - Validation errors
│   ├── AuthError              (401) - Authentication failed
│   ├── ForbiddenError         (403) - Not authorized
│   ├── NotFoundError          (404) - Resource not found
│   ├── ConflictError          (409) - Duplicate/conflict
│   ├── TooManyRequestsError  (429) - Rate limited
│   └── InternalError        (500) - Server errors

Global Error Handler:
├── Catches all thrown errors
├── Maps to standardized response format
├── Logs with correlation ID
├── Sanitizes error messages (no stack in production)
└── Triggers security alerts on suspicious patterns
```

## Testing Strategy - Phase 1

```
Unit Tests:
├── Auth Service (login, logout, refresh, password)
├── RBAC Service (role assignment, permission checking)
├── Organization Service (CRUD, hierarchy)
├── JWT Handler (token generation, verification)
├── Password Handler (hashing, comparison)
└── All validators and DTOs

Integration Tests:
├── Auth flow (login → access → refresh → logout)
├── RBAC flow (create role → assign → verify access)
├── Organization CRUD (create → read → update → delete)
├── Multi-company isolation (no data leakage)
└── Rate limiting behavior

E2E Tests (Playwright):
├── Login flow
├── Company switcher
├── Organization tree navigation
└── Permission-based page access
```

## Deployment Architecture

```
┌───────────────────────────────────────────┐
│          Docker Compose Stack              │
├───────────────────────────────────────────┤
│                                           │
│  ┌──────────┐  ┌──────────┐               │
│  │  Nginx   │  │  API App │               │
│  │  :443    │──▶│  :3000   │               │
│  └──────────┘  └────┬─────┘               │
│                      │                      │
│  ┌──────────┐  ┌────┴─────┐  ┌──────────┐ │
│  │  MySQL   │◀─▶│  Redis   │  │  BullMQ  │ │
│  │  :3306   │   │  :6379   │  │  Worker  │ │
│  └──────────┘  └──────────┘  └──────────┘ │
│                                           │
│  ┌──────────┐                              │
│  │  React   │  (served by Nginx)           │
│  │  Static  │                              │
│  └──────────┘                              │
└───────────────────────────────────────────┘

CI/CD Pipeline:
├── GitHub Actions
├── Lint → Test → Build → Deploy
├── Environment: dev → staging → production
└── Automated migrations on deploy
```
