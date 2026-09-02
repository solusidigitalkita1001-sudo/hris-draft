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
  { value: 'ALL', label: 'Semua data', description: 'Tanpa batas tambahan di luar permission.' },
  { value: 'COMPANY_ONLY', label: 'Company aktif', description: 'Seluruh data pada company yang sedang aktif.' },
  { value: 'BRANCH_ONLY', label: 'Branch tertentu', description: 'Hanya branch yang dipilih admin.' },
  { value: 'DEPARTMENT_ONLY', label: 'Department tertentu', description: 'Hanya department yang dipilih admin.' },
  { value: 'SUB_DEPARTMENT_ONLY', label: 'Sub-department tertentu', description: 'Hanya sub-department yang dipilih admin.' },
  { value: 'EMPLOYEE_SELF', label: 'Data sendiri', description: 'User hanya dapat mengakses record miliknya.' },
];

export interface MenuCatalogItem {
  path: string;
  label: string;
  group: 'General' | 'People' | 'Operations' | 'Talent' | 'Administration';
}

export const MENU_ITEMS: MenuCatalogItem[] = [
  { path: '/dashboard', label: 'Dashboard', group: 'General' },
  { path: '/self-service', label: 'Self Service', group: 'General' },
  { path: '/notifications', label: 'Notifications', group: 'General' },
  { path: '/organization/chart', label: 'Organization Chart', group: 'People' },
  { path: '/organization/groups', label: 'Company Groups', group: 'People' },
  { path: '/organization/companies', label: 'Companies', group: 'People' },
  { path: '/organization/branches', label: 'Branches', group: 'People' },
  { path: '/organization/departments', label: 'Departments', group: 'People' },
  { path: '/organization/positions', label: 'Positions', group: 'People' },
  { path: '/employees', label: 'Employees', group: 'People' },
  { path: '/attendance', label: 'Attendance', group: 'Operations' },
  { path: '/work-calendar', label: 'Work Calendar', group: 'Operations' },
  { path: '/work-calendar/shifts', label: 'Shift Formulas', group: 'Operations' },
  { path: '/work-calendar/holidays', label: 'Holidays', group: 'Operations' },
  { path: '/leave', label: 'Leave', group: 'Operations' },
  { path: '/employee-loans', label: 'Employee Loans', group: 'Operations' },
  { path: '/ewa', label: 'Earned Wage Access', group: 'Operations' },
  { path: '/daily-activity', label: 'Daily Activity', group: 'Operations' },
  { path: '/travel-expenses', label: 'Travel Expenses', group: 'Operations' },
  { path: '/workflow-engine', label: 'Workflow Engine', group: 'Operations' },
  { path: '/documents', label: 'Document Management', group: 'Operations' },
  { path: '/offboarding', label: 'Offboarding', group: 'Operations' },
  { path: '/assets', label: 'Assets', group: 'Operations' },
  { path: '/payroll', label: 'Payroll', group: 'Operations' },
  { path: '/benefits', label: 'Benefits', group: 'Operations' },
  { path: '/recruitment', label: 'Job Openings', group: 'Talent' },
  { path: '/recruitment/candidates', label: 'Candidates', group: 'Talent' },
  { path: '/recruitment/pipeline', label: 'Recruitment Pipeline', group: 'Talent' },
  { path: '/recruitment/interviews', label: 'Interviews', group: 'Talent' },
  { path: '/performance', label: 'Performance Dashboard', group: 'Talent' },
  { path: '/performance/cycles', label: 'Performance Cycles', group: 'Talent' },
  { path: '/performance/reviews', label: 'Performance Reviews', group: 'Talent' },
  { path: '/performance/goals', label: 'Goals', group: 'Talent' },
  { path: '/lms', label: 'Learning & Training', group: 'Talent' },
  { path: '/reports', label: 'Reports', group: 'Administration' },
  { path: '/admin/users', label: 'User Management', group: 'Administration' },
  { path: '/admin/roles', label: 'Roles & Permissions', group: 'Administration' },
  { path: '/admin/audit', label: 'Audit Logs', group: 'Administration' },
  { path: '/admin/settings', label: 'Settings', group: 'Administration' },
  { path: '/admin/workflows', label: 'Workflow Administration', group: 'Administration' },
  { path: '/admin/menu-access', label: 'Menu Access', group: 'Administration' },
  { path: '/admin/data-scope', label: 'Data Access', group: 'Administration' },
  { path: '/admin/ewa', label: 'EWA Approval', group: 'Administration' },
  { path: '/admin/daily-activities', label: 'Daily Activity Approval', group: 'Administration' },
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
