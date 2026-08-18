import api from './api';

export type MenuAccessType = 'ALLOW' | 'DENY';

export type DataScopeType =
  | 'ALL'
  | 'COMPANY_ONLY'
  | 'BRANCH_ONLY'
  | 'DEPARTMENT_ONLY'
  | 'SUB_DEPARTMENT_ONLY'
  | 'EMPLOYEE_SELF'
  | 'MANAGER_TEAM';

export interface RoleMenuAccess {
  id: string;
  companyId: string;
  roleCode: string;
  menuPath: string;
  accessType: MenuAccessType;
  createdAt: string;
  updatedAt: string;
}

export interface RoleDataScope {
  id: string;
  companyId: string;
  roleCode: string;
  resource: string;
  scopeType: DataScopeType;
  scopeValue?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MyMenuAccessResponse {
  deniedMenuPaths: string[];
  details: Array<{ menuPath: string; roleCode: string }>;
}

export interface MyDataScopeResponse {
  roleCode: string | null;
  scopeType: DataScopeType;
  scopeValue: string | null;
  resource: string;
  parsedFilter: Record<string, unknown>;
}

export const ROLE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'SUPER_ADMIN', label: 'Super Admin' },
  { value: 'GROUP_ADMIN', label: 'Group Admin' },
  { value: 'COMPANY_ADMIN', label: 'Company Admin' },
  { value: 'HR_MANAGER', label: 'HR Manager' },
  { value: 'HR_STAFF', label: 'HR Staff' },
  { value: 'MANAGER', label: 'Manager' },
  { value: 'EMPLOYEE', label: 'Employee' },
  { value: 'OPSL', label: 'Operational Staff' },
  { value: 'FINANCE_MANAGER', label: 'Finance Manager' },
];

export const RESOURCE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'ALL', label: 'All Resources (Default)' },
  { value: 'employee', label: 'Employees' },
  { value: 'leave', label: 'Leave Requests' },
  { value: 'attendance', label: 'Attendance' },
  { value: 'payroll', label: 'Payroll' },
  { value: 'travel', label: 'Travel Expenses' },
  { value: 'loan', label: 'Employee Loans' },
  { value: 'work-calendar', label: 'Work Calendar' },
];

export const SCOPE_TYPE_OPTIONS: Array<{ value: DataScopeType; label: string; description?: string }> = [
  { value: 'ALL', label: 'All Data', description: 'No restriction' },
  { value: 'COMPANY_ONLY', label: 'Company Only', description: 'Within company context' },
  { value: 'BRANCH_ONLY', label: 'Branch Only', description: 'Restrict to selected branches' },
  { value: 'DEPARTMENT_ONLY', label: 'Department Only', description: 'Restrict to selected departments' },
  { value: 'SUB_DEPARTMENT_ONLY', label: 'Sub-Department Only', description: 'Restrict to selected sub-depts' },
  { value: 'EMPLOYEE_SELF', label: 'Employee Self', description: 'Own data only' },
];

export const MENU_ITEMS: Array<{ path: string; label: string }> = [
  { path: '/dashboard', label: 'Dashboard' },
  { path: '/organization', label: 'Organization (parent)' },
  { path: '/organization/chart', label: 'Org Chart' },
  { path: '/organization/groups', label: 'Groups' },
  { path: '/organization/companies', label: 'Companies' },
  { path: '/organization/branches', label: 'Branches' },
  { path: '/organization/departments', label: 'Departments' },
  { path: '/organization/positions', label: 'Positions' },
  { path: '/self-service', label: 'Self Service' },
  { path: '/employee-loans', label: 'Employee Loans' },
  { path: '/travel-expenses', label: 'Travel Expenses' },
  { path: '/workflow-engine', label: 'Workflow Engine' },
  { path: '/documents', label: 'Document Management' },
  { path: '/employees', label: 'Employees List' },
  { path: '/attendance', label: 'Attendance' },
  { path: '/work-calendar', label: 'Work Calendar' },
  { path: '/work-calendar/shifts', label: 'Shift Formulas' },
  { path: '/work-calendar/holidays', label: 'Holidays' },
  { path: '/leave', label: 'Leave' },
  { path: '/offboarding', label: 'Offboarding' },
  { path: '/assets', label: 'Assets' },
  { path: '/payroll', label: 'Payroll' },
  { path: '/benefits', label: 'Benefits' },
  { path: '/recruitment', label: 'Recruitment' },
  { path: '/recruitment/candidates', label: 'Candidates' },
  { path: '/recruitment/pipeline', label: 'Pipeline' },
  { path: '/recruitment/interviews', label: 'Interviews' },
  { path: '/performance', label: 'Performance' },
  { path: '/performance/cycles', label: 'Performance Cycles' },
  { path: '/performance/reviews', label: 'Reviews' },
  { path: '/performance/goals', label: 'Goals' },
  { path: '/performance/planning', label: 'Planning' },
  { path: '/performance/execution', label: 'Execution' },
  { path: '/performance/self-review', label: 'Self Review' },
  { path: '/performance/manager-review', label: 'Manager Review' },
  { path: '/performance/results', label: 'Results' },
  { path: '/performance/my-results', label: 'My Results' },
  { path: '/performance/config/methods', label: 'Perf Methods' },
  { path: '/performance/config/periods', label: 'Perf Periods' },
  { path: '/performance/config/libraries', label: 'Perf Libraries' },
  { path: '/performance/config/workflows', label: 'Perf Workflows' },
  { path: '/lms', label: 'LMS / Training' },
  { path: '/reports', label: 'Reports' },
  { path: '/notifications', label: 'Notifications' },
  { path: '/admin/users', label: 'Admin - Users' },
  { path: '/admin/roles', label: 'Admin - Roles' },
  { path: '/admin/audit', label: 'Admin - Audit Logs' },
  { path: '/admin/settings', label: 'Admin - Settings' },
  { path: '/admin/workflows', label: 'Admin - Workflows' },
  { path: '/admin/menu-access', label: 'Admin - Menu Access' },
  { path: '/admin/data-scope', label: 'Admin - Data Scope' },
];

class AdministrationService {
  async listRoleMenuAccess(
    companyId: string,
    roleCode: string
  ): Promise<RoleMenuAccess[]> {
    const r = await api.get('/administration/role-menu-access', {
      params: { companyId, roleCode },
    });
    return r.data.data as RoleMenuAccess[];
  }

  async upsertRoleMenuAccess(
    data: Omit<RoleMenuAccess, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<RoleMenuAccess> {
    const r = await api.post('/administration/role-menu-access', data);
    return r.data.data as RoleMenuAccess;
  }

  async bulkUpsertRoleMenuAccess(params: {
    companyId: string;
    roleCode: string;
    items: Array<{ menuPath: string; accessType: MenuAccessType }>;
  }): Promise<RoleMenuAccess[]> {
    const r = await api.post(
      '/administration/role-menu-access/bulk-upsert',
      params
    );
    return r.data.data as RoleMenuAccess[];
  }

  async listRoleDataScope(
    companyId: string,
    roleCode: string,
    resource?: string
  ): Promise<RoleDataScope | RoleDataScope[]> {
    const params: Record<string, string> = { companyId, roleCode };
    if (resource) params.resource = resource;
    const r = await api.get('/administration/role-data-scope', { params });
    return r.data.data;
  }

  async upsertRoleDataScope(
    data: Omit<RoleDataScope, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<RoleDataScope> {
    const r = await api.post('/administration/role-data-scope', data);
    return r.data.data as RoleDataScope;
  }

  async getMyMenuAccess(companyId?: string): Promise<MyMenuAccessResponse> {
    const params: Record<string, string> = {};
    if (companyId) params.companyId = companyId;
    const r = await api.get('/administration/role-menu-access/my', {
      params,
    });
    return r.data.data as MyMenuAccessResponse;
  }

  async getMyDataScope(params?: {
    companyId?: string;
    resource?: string;
  }): Promise<MyDataScopeResponse> {
    const q: Record<string, string> = {};
    if (params?.companyId) q.companyId = params.companyId;
    if (params?.resource) q.resource = params.resource;
    const r = await api.get('/administration/role-data-scope/my', {
      params: q,
    });
    return r.data.data as MyDataScopeResponse;
  }
}

export const administrationService = new AdministrationService();
