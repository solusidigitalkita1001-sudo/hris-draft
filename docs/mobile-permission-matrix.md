# Mobile permission matrix

Source of truth: `backend/src/database/seeds/modules/01-permissions.seed.ts` and
`03-role-permissions.seed.ts`. Self-service routes still enforce employee and
company identity from the authenticated session; a permission never authorizes
cross-employee or cross-company reads by itself.

| Mobile capability | EMPLOYEE | MANAGER | HR_STAFF | HR_MANAGER | COMPANY_ADMIN |
|---|---|---|---|---|---|
| Own profile | `employee:read` | `employee:read` | `employee:read` | `employee:read` | `employee:read` |
| Attendance self | authenticated self route | authenticated self route | authenticated self route | authenticated self route | authenticated self route |
| Attendance review | — | `att:read`, `att:approve` | `att:read` | `att:read`, `att:approve` | `att:read`, `att:approve` |
| Submit/read own leave | `leave:create`, `leave:read` | `leave:read` | `leave:read` | `leave:create`, `leave:read` | `leave:create`, `leave:read` |
| Approve leave | — | `leave:approve` | — | `leave:approve` | `leave:approve` |
| Submit/read own permission request | authenticated self route | authenticated self route | authenticated self route | authenticated self route | authenticated self route |
| Review permission requests | — | `permission-request:read/update` | `permission-request:read` | `permission-request:read/update` | `permission-request:read/update` |
| Own resolved calendar/shift swap/holiday | authenticated self route | authenticated self route | authenticated self route | authenticated self route | authenticated self route |
| Team/work-calendar administration | — | `work-calendar:read` | `work-calendar:read` | `work-calendar:create/read/update` | `work-calendar:create/read/update/delete` |
| Approval Center | `workflow:read` | `workflow:read/approve` | `workflow:read` | `workflow:create/read/update/approve` | `workflow:create/read/update/delete/approve` |
| Submit/read own loan | authenticated self route | authenticated self route | authenticated self route | authenticated self route | authenticated self route |
| Review employee loans | — | `employee-loan:read/update` | `employee-loan:read` | `employee-loan:read/update` | `employee-loan:read/update` |
| Travel/expense self | `travel:create/read` | `travel:create/read` | `travel:create/read` | `travel:create/read/update` | `travel:create/read/update` |
| Travel/expense approval | — | `travel:approve/process` | — | `travel:approve/process` | `travel:approve/process` |
| Documents within data scope | `document:create/read` | `document:read` | `document:create/read` | `document:create/read/update` | `document:create/read/update/delete` |
| EWA self | `ewa:create/read/update` | `ewa:read` | `ewa:read` | `ewa:read/approve/export` | `ewa:create/read/update/approve/disburse/export` |
| Daily activity self | `da:create/read/update` | `da:read/approve/process` | `da:read/process` | `da:read/approve/process/export` | `da:create/read/update/delete/approve/process/export` |
| Payroll period list + protected detail | `payroll:read` + unlock grant | — | — | `payroll:read/export` | `payroll:read/approve/export` |
| Notification inbox/device binding | authenticated self route | authenticated self route | authenticated self route | authenticated self route | authenticated self route |

`SUPER_ADMIN` receives all permissions. `GROUP_ADMIN` receives all permissions
except `auth:impersonate`. The table intentionally omits unrelated web/admin
capabilities.

## Data-scope expectations

- EMPLOYEE: `EMPLOYEE_SELF` for employee-owned records.
- MANAGER: `MANAGER_TEAM` or explicit headed-unit scope; an empty team is not
  interpreted as company-wide access.
- HR/Company Admin: scope is assigned per role/company and still intersects the
  active company selected in the session.
- SUPER_ADMIN must explicitly select an active company for both tenant reads and mutations.
  There is no global tenant-data mode; only the narrow group/company platform registry remains
  available for tenant discovery and provisioning.
