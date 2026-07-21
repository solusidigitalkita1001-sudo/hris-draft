import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AuthLayout } from '@/layouts/AuthLayout';
import { DashboardLayout } from '@/layouts/DashboardLayout';
import { ProtectedRoute } from './ProtectedRoute';

// Pages
import { LoginPage } from '@/modules/auth/LoginPage';
import { ForgotPasswordPage } from '@/modules/auth/ForgotPasswordPage';
import { ProfilePage } from '@/modules/auth/ProfilePage';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { UnauthorizedPage } from '@/pages/UnauthorizedPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { GroupListPage } from '@/modules/organization/pages/GroupListPage';
import { CompanyListPage } from '@/modules/organization/pages/CompanyListPage';
import { BranchListPage } from '@/modules/organization/pages/BranchListPage';
import { DepartmentListPage } from '@/modules/organization/pages/DepartmentListPage';
import { PositionListPage } from '@/modules/organization/pages/PositionListPage';
import { OrganizationChartPage } from '@/modules/organization/pages/OrganizationChartPage';

// Employee Pages
import { EmployeeListPage } from '@/modules/employee/pages/EmployeeListPage';
import { EmployeeDetailPage } from '@/modules/employee/pages/EmployeeDetailPage';
import { EmployeeFormPage } from '@/modules/employee/pages/EmployeeFormPage';

// Payroll Pages
import { PayrollDashboard } from '@/modules/payroll/pages/PayrollDashboard';
import { SalaryComponentList } from '@/modules/payroll/pages/SalaryComponentList';
import { PayrollPeriodList } from '@/modules/payroll/pages/PayrollPeriodList';
import { PayrollRunList } from '@/modules/payroll/pages/PayrollRunList';
import { PayrollRunCreate } from '@/modules/payroll/pages/PayrollRunCreate';
import { PayrollRunDetail } from '@/modules/payroll/pages/PayrollRunDetail';
import { PayslipDetail } from '@/modules/payroll/pages/PayslipDetail';

// Benefit Pages
import { BenefitPlanList } from '@/modules/benefit/pages/BenefitPlanList';
import { BenefitPlanDetail } from '@/modules/benefit/pages/BenefitPlanDetail';

// Recruitment Pages
import { JobPostingList } from '@/modules/recruitment/pages/JobPostingList';
import { JobPostingDetail } from '@/modules/recruitment/pages/JobPostingDetail';
import { JobPostingFormPage } from '@/modules/recruitment/pages/JobPostingFormPage';
import { CandidateList } from '@/modules/recruitment/pages/CandidateList';
import { CandidateFormPage } from '@/modules/recruitment/pages/CandidateFormPage';
import { ApplicationCreatePage } from '@/modules/recruitment/pages/ApplicationCreatePage';
import { ApplicationPipeline } from '@/modules/recruitment/pages/ApplicationPipeline';
import { InterviewSchedule } from '@/modules/recruitment/pages/InterviewSchedule';
import { InterviewFormPage } from '@/modules/recruitment/pages/InterviewFormPage';

// Performance Pages
import { PerformanceDashboard } from '@/modules/performance/pages/PerformanceDashboard';
import { PerformanceCyclesPage } from '@/modules/performance/pages/PerformanceCyclesPage';
import { PerformanceLibrariesPage } from '@/modules/performance/pages/PerformanceLibrariesPage';
import { PerformanceMethodsPage } from '@/modules/performance/pages/PerformanceMethodsPage';
import { PerformancePeriodsPage } from '@/modules/performance/pages/PerformancePeriodsPage';
import { PerformanceWorkflowsPage } from '@/modules/performance/pages/PerformanceWorkflowsPage';
import { ReviewList } from '@/modules/performance/pages/ReviewList';
import { GoalList } from '@/modules/performance/pages/GoalList';

// Training Pages
import { CourseList } from '@/modules/training/pages/CourseList';
import { CourseDetail } from '@/modules/training/pages/CourseDetail';
import { CourseFormPage } from '@/modules/training/pages/CourseFormPage';

// Attendance Pages
import { AttendanceList } from '@/modules/attendance/pages/AttendanceList';

// Leave Pages
import { LeaveList } from '@/modules/leave/pages/LeaveList';
import { LeaveDetail } from '@/modules/leave/pages/LeaveDetail';

// Asset Pages
import { AssetList } from '@/modules/asset/pages/AssetList';

// Onboarding / Offboarding Pages
import { OffboardingList } from '@/modules/onboarding/pages/OffboardingList';
import { OffboardingDetail } from '@/modules/onboarding/pages/OffboardingDetail';

// Reports Pages
import { ReportsPage } from '@/modules/reports/pages/ReportsPage';

// RBAC / Roles Pages
import { RoleListPage } from '@/modules/rbac/pages/RoleListPage';

// Self Service Pages
import { SelfServicePage } from '@/modules/self-service/pages/SelfServicePage';

// Employee Loan Pages
import { EmployeeLoanPage } from '@/modules/employee-loan/pages/EmployeeLoanPage';
import { EmployeeLoanDetailPage } from '@/modules/employee-loan/pages/EmployeeLoanDetailPage';
import { TravelExpensePage } from '@/modules/travel-expense/pages/TravelExpensePage';
import { WorkflowEnginePage } from '@/modules/workflow-engine/pages/WorkflowEnginePage';
import { DocumentManagementPage } from '@/modules/document-management/pages/DocumentManagementPage';

// Work Calendar Pages
import { WorkCalendarListPage } from '@/modules/work-calendar/pages/WorkCalendarListPage';
import { WorkCalendarDetailPage } from '@/modules/work-calendar/pages/WorkCalendarDetailPage';
import { WorkCalendarHolidaysPage } from '@/modules/work-calendar/pages/WorkCalendarHolidaysPage';
import { ShiftFormulaPage } from '@/modules/work-calendar/pages/ShiftFormulaPage';

// Notification Pages
import { NotificationsPage } from '@/modules/notifications/pages/NotificationsPage';

// Admin Pages
import { AdminUsersPage } from '@/modules/admin/pages/AdminUsersPage';
import { AdminAuditLogPage } from '@/modules/admin/pages/AdminAuditLogPage';
import { AdminAuditLogDetailPage } from '@/modules/admin/pages/AdminAuditLogDetailPage';
import { AdminSettingsPage } from '@/modules/admin/pages/AdminSettingsPage';
import { EMPLOYEE_SELF_SERVICE_ROLES, OPERATIONAL_ROLES } from '@/lib/access-control';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <Navigate to="/dashboard" replace />,
  },
  {
    path: '/login',
    element: <AuthLayout />,
    children: [
      { index: true, element: <LoginPage /> },
    ],
  },
  {
    path: '/forgot-password',
    element: <AuthLayout />,
    children: [
      { index: true, element: <ForgotPasswordPage /> },
    ],
  },
  {
    path: '/',
    element: (
      <ProtectedRoute>
        <DashboardLayout />
      </ProtectedRoute>
    ),
    children: [
      {
        path: 'dashboard',
        element: (
          <ProtectedRoute requiredRoles={EMPLOYEE_SELF_SERVICE_ROLES}>
            <DashboardPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'profile',
        element: (
          <ProtectedRoute>
            <ProfilePage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'organization',
        children: [
          {
            path: 'chart',
            element: (
              <ProtectedRoute
                requiredPermissions={[{ resource: 'organization', action: 'read' }]}
                requiredRoles={OPERATIONAL_ROLES}
              >
                <OrganizationChartPage />
              </ProtectedRoute>
            ),
          },
          {
            path: 'groups',
            element: (
              <ProtectedRoute
                requiredPermissions={[{ resource: 'organization', action: 'read' }]}
                requiredRoles={OPERATIONAL_ROLES}
              >
                <GroupListPage />
              </ProtectedRoute>
            ),
          },
          {
            path: 'companies',
            element: (
              <ProtectedRoute
                requiredPermissions={[{ resource: 'organization', action: 'read' }]}
                requiredRoles={OPERATIONAL_ROLES}
              >
                <CompanyListPage />
              </ProtectedRoute>
            ),
          },
          {
            path: 'branches',
            element: (
              <ProtectedRoute
                requiredPermissions={[{ resource: 'organization', action: 'read' }]}
                requiredRoles={OPERATIONAL_ROLES}
              >
                <BranchListPage />
              </ProtectedRoute>
            ),
          },
          {
            path: 'departments',
            element: (
              <ProtectedRoute
                requiredPermissions={[{ resource: 'organization', action: 'read' }]}
                requiredRoles={OPERATIONAL_ROLES}
              >
                <DepartmentListPage />
              </ProtectedRoute>
            ),
          },
          {
            path: 'positions',
            element: (
              <ProtectedRoute
                requiredPermissions={[{ resource: 'organization', action: 'read' }]}
                requiredRoles={OPERATIONAL_ROLES}
              >
                <PositionListPage />
              </ProtectedRoute>
            ),
          },
        ],
      },
      // Employee Routes
      {
        path: 'employees',
        element: (
          <ProtectedRoute
            requiredPermissions={[{ resource: 'employee', action: 'read' }]}
            requiredRoles={OPERATIONAL_ROLES}
          >
            <EmployeeListPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'employees/new',
        element: (
          <ProtectedRoute
            requiredPermissions={[{ resource: 'employee', action: 'create' }]}
            requiredRoles={OPERATIONAL_ROLES}
          >
            <EmployeeFormPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'employees/:id/edit',
        element: (
          <ProtectedRoute
            requiredPermissions={[{ resource: 'employee', action: 'update' }]}
            requiredRoles={OPERATIONAL_ROLES}
          >
            <EmployeeFormPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'employees/:id',
        element: (
          <ProtectedRoute
            requiredPermissions={[{ resource: 'employee', action: 'read' }]}
            requiredRoles={OPERATIONAL_ROLES}
          >
            <EmployeeDetailPage />
          </ProtectedRoute>
        ),
      },
      // Payroll Routes
      {
        path: 'payroll',
        element: (
          <ProtectedRoute requiredPermissions={[{ resource: 'payroll', action: 'read' }]}>
            <PayrollDashboard />
          </ProtectedRoute>
        ),
      },
      {
        path: 'payroll/salary-components',
        element: (
          <ProtectedRoute requiredPermissions={[{ resource: 'payroll', action: 'read' }]}>
            <SalaryComponentList />
          </ProtectedRoute>
        ),
      },
      {
        path: 'payroll/periods',
        element: (
          <ProtectedRoute requiredPermissions={[{ resource: 'payroll', action: 'read' }]}>
            <PayrollPeriodList />
          </ProtectedRoute>
        ),
      },
      {
        path: 'payroll/runs',
        element: (
          <ProtectedRoute requiredPermissions={[{ resource: 'payroll', action: 'read' }]}>
            <PayrollRunList />
          </ProtectedRoute>
        ),
      },
      {
        path: 'payroll/runs/new',
        element: (
          <ProtectedRoute requiredPermissions={[{ resource: 'payroll', action: 'process' }]}>
            <PayrollRunCreate />
          </ProtectedRoute>
        ),
      },
      {
        path: 'payroll/runs/:id',
        element: (
          <ProtectedRoute requiredPermissions={[{ resource: 'payroll', action: 'read' }]}>
            <PayrollRunDetail />
          </ProtectedRoute>
        ),
      },
      {
        path: 'payroll/payslips/:id',
        element: (
          <ProtectedRoute requiredPermissions={[{ resource: 'payroll', action: 'read' }]}>
            <PayslipDetail />
          </ProtectedRoute>
        ),
      },
      // Benefit Routes
      {
        path: 'benefits',
        element: (
          <ProtectedRoute requiredPermissions={[{ resource: 'benefit', action: 'read' }]}>
            <BenefitPlanList />
          </ProtectedRoute>
        ),
      },
      {
        path: 'benefits/plans/:id',
        element: (
          <ProtectedRoute requiredPermissions={[{ resource: 'benefit', action: 'read' }]}>
            <BenefitPlanDetail />
          </ProtectedRoute>
        ),
      },
      // Recruitment Routes
      {
        path: 'recruitment',
        element: (
          <ProtectedRoute requiredPermissions={[{ resource: 'recruitment', action: 'read' }]}>
            <JobPostingList />
          </ProtectedRoute>
        ),
      },
      {
        path: 'recruitment/postings/:id',
        element: (
          <ProtectedRoute requiredPermissions={[{ resource: 'recruitment', action: 'read' }]}>
            <JobPostingDetail />
          </ProtectedRoute>
        ),
      },
      {
        path: 'recruitment/postings/new',
        element: (
          <ProtectedRoute requiredPermissions={[{ resource: 'recruitment', action: 'create' }]}>
            <JobPostingFormPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'recruitment/postings/:id/apply',
        element: (
          <ProtectedRoute requiredPermissions={[{ resource: 'recruitment', action: 'create' }]}>
            <ApplicationCreatePage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'recruitment/candidates',
        element: (
          <ProtectedRoute requiredPermissions={[{ resource: 'recruitment', action: 'read' }]}>
            <CandidateList />
          </ProtectedRoute>
        ),
      },
      {
        path: 'recruitment/candidates/new',
        element: (
          <ProtectedRoute requiredPermissions={[{ resource: 'recruitment', action: 'create' }]}>
            <CandidateFormPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'recruitment/pipeline',
        element: (
          <ProtectedRoute requiredPermissions={[{ resource: 'recruitment', action: 'read' }]}>
            <ApplicationPipeline />
          </ProtectedRoute>
        ),
      },
      {
        path: 'recruitment/interviews',
        element: (
          <ProtectedRoute requiredPermissions={[{ resource: 'recruitment', action: 'read' }]}>
            <InterviewSchedule />
          </ProtectedRoute>
        ),
      },
      {
        path: 'recruitment/interviews/new',
        element: (
          <ProtectedRoute requiredPermissions={[{ resource: 'recruitment', action: 'create' }]}>
            <InterviewFormPage />
          </ProtectedRoute>
        ),
      },
      // Performance Routes
      {
        path: 'performance',
        element: (
          <ProtectedRoute requiredPermissions={[{ resource: 'performance', action: 'read' }]}>
            <PerformanceDashboard />
          </ProtectedRoute>
        ),
      },
      {
        path: 'performance/reviews',
        element: (
          <ProtectedRoute requiredPermissions={[{ resource: 'performance', action: 'read' }]}>
            <ReviewList />
          </ProtectedRoute>
        ),
      },
      {
        path: 'performance/cycles',
        element: (
          <ProtectedRoute requiredPermissions={[{ resource: 'performance', action: 'read' }]}>
            <PerformanceCyclesPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'performance/goals',
        element: (
          <ProtectedRoute requiredPermissions={[{ resource: 'performance', action: 'read' }]}>
            <GoalList />
          </ProtectedRoute>
        ),
      },
      {
        path: 'performance/config/methods',
        element: (
          <ProtectedRoute requiredPermissions={[{ resource: 'performance', action: 'read' }]}>
            <PerformanceMethodsPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'performance/config/periods',
        element: (
          <ProtectedRoute requiredPermissions={[{ resource: 'performance', action: 'read' }]}>
            <PerformancePeriodsPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'performance/config/libraries',
        element: (
          <ProtectedRoute requiredPermissions={[{ resource: 'performance', action: 'read' }]}>
            <PerformanceLibrariesPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'performance/config/workflows',
        element: (
          <ProtectedRoute requiredPermissions={[{ resource: 'performance', action: 'read' }]}>
            <PerformanceWorkflowsPage />
          </ProtectedRoute>
        ),
      },
      // Attendance Routes
      {
        path: 'attendance',
        element: (
          <ProtectedRoute
            requiredPermissions={[{ resource: 'attendance', action: 'read' }]}
            requiredRoles={OPERATIONAL_ROLES}
          >
            <AttendanceList />
          </ProtectedRoute>
        ),
      },
      // Leave Routes
      {
        path: 'leave',
        element: (
          <ProtectedRoute
            requiredPermissions={[{ resource: 'leave', action: 'read' }]}
            requiredRoles={OPERATIONAL_ROLES}
          >
            <LeaveList />
          </ProtectedRoute>
        ),
      },
      {
        path: 'leave/:id',
        element: (
          <ProtectedRoute
            requiredPermissions={[{ resource: 'leave', action: 'read' }]}
            requiredRoles={OPERATIONAL_ROLES}
          >
            <LeaveDetail />
          </ProtectedRoute>
        ),
      },
      // Asset Routes
      {
        path: 'assets',
        element: (
          <ProtectedRoute
            requiredPermissions={[{ resource: 'asset', action: 'read' }]}
            requiredRoles={OPERATIONAL_ROLES}
          >
            <AssetList />
          </ProtectedRoute>
        ),
      },
      // Offboarding Routes
      {
        path: 'offboarding',
        element: (
          <ProtectedRoute
            requiredPermissions={[{ resource: 'employee', action: 'read' }]}
            requiredRoles={OPERATIONAL_ROLES}
          >
            <OffboardingList />
          </ProtectedRoute>
        ),
      },
      {
        path: 'offboarding/:id',
        element: (
          <ProtectedRoute
            requiredPermissions={[{ resource: 'employee', action: 'read' }]}
            requiredRoles={OPERATIONAL_ROLES}
          >
            <OffboardingDetail />
          </ProtectedRoute>
        ),
      },
      // Self Service Route
      {
        path: 'self-service',
        element: (
          <ProtectedRoute requiredRoles={EMPLOYEE_SELF_SERVICE_ROLES}>
            <SelfServicePage />
          </ProtectedRoute>
        ),
      },
      // Employee Loan Routes
      {
        path: 'employee-loans',
        element: (
          <ProtectedRoute requiredRoles={EMPLOYEE_SELF_SERVICE_ROLES}>
            <EmployeeLoanPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'employee-loans/:id',
        element: (
          <ProtectedRoute requiredRoles={EMPLOYEE_SELF_SERVICE_ROLES}>
            <EmployeeLoanDetailPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'travel-expenses',
        element: (
          <ProtectedRoute requiredRoles={EMPLOYEE_SELF_SERVICE_ROLES}>
            <TravelExpensePage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'workflow-engine',
        element: (
          <ProtectedRoute
            requiredPermissions={[{ resource: 'workflow', action: 'read' }]}
            requiredRoles={OPERATIONAL_ROLES}
          >
            <WorkflowEnginePage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'documents',
        element: (
          <ProtectedRoute
            requiredPermissions={[{ resource: 'document', action: 'read' }]}
            requiredRoles={OPERATIONAL_ROLES}
          >
            <DocumentManagementPage />
          </ProtectedRoute>
        ),
      },
      // Work Calendar Routes
      {
        path: 'work-calendar',
        element: (
          <ProtectedRoute
            requiredPermissions={[{ resource: 'work-calendar', action: 'read' }]}
            requiredRoles={OPERATIONAL_ROLES}
          >
            <WorkCalendarListPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'work-calendar/holidays',
        element: (
          <ProtectedRoute
            requiredPermissions={[{ resource: 'work-calendar', action: 'read' }]}
            requiredRoles={OPERATIONAL_ROLES}
          >
            <WorkCalendarHolidaysPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'work-calendar/shifts',
        element: (
          <ProtectedRoute
            requiredPermissions={[{ resource: 'work-calendar', action: 'read' }]}
            requiredRoles={OPERATIONAL_ROLES}
          >
            <ShiftFormulaPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'work-calendar/:id',
        element: (
          <ProtectedRoute
            requiredPermissions={[{ resource: 'work-calendar', action: 'read' }]}
            requiredRoles={OPERATIONAL_ROLES}
          >
            <WorkCalendarDetailPage />
          </ProtectedRoute>
        ),
      },
      // Reports Routes
      {
        path: 'reports',
        element: (
          <ProtectedRoute
            requiredPermissions={[{ resource: 'report', action: 'read' }]}
            requiredRoles={OPERATIONAL_ROLES}
          >
            <ReportsPage />
          </ProtectedRoute>
        ),
      },
      // Notifications Route
      {
        path: 'notifications',
        element: (
          <ProtectedRoute requiredRoles={EMPLOYEE_SELF_SERVICE_ROLES}>
            <NotificationsPage />
          </ProtectedRoute>
        ),
      },
      // Training / LMS Routes
      {
        path: 'lms',
        element: (
          <ProtectedRoute requiredPermissions={[{ resource: 'training', action: 'read' }]}>
            <CourseList />
          </ProtectedRoute>
        ),
      },
      {
        path: 'lms/courses/:id',
        element: (
          <ProtectedRoute requiredPermissions={[{ resource: 'training', action: 'read' }]}>
            <CourseDetail />
          </ProtectedRoute>
        ),
      },
      {
        path: 'lms/courses/new',
        element: (
          <ProtectedRoute requiredPermissions={[{ resource: 'training', action: 'create' }]}>
            <CourseFormPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'lms/courses/:id/edit',
        element: (
          <ProtectedRoute requiredPermissions={[{ resource: 'training', action: 'update' }]}>
            <CourseFormPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'admin/users',
        element: (
          <ProtectedRoute requiredPermissions={[{ resource: 'user', action: 'read' }]}>
            <AdminUsersPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'admin/roles',
        element: (
          <ProtectedRoute requiredPermissions={[{ resource: 'rbac', action: 'read' }]}>
            <RoleListPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'admin/audit',
        element: (
          <ProtectedRoute requiredPermissions={[{ resource: 'audit-log', action: 'read' }]}>
            <AdminAuditLogPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'admin/audit/:id',
        element: (
          <ProtectedRoute requiredPermissions={[{ resource: 'audit-log', action: 'read' }]}>
            <AdminAuditLogDetailPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'admin/settings',
        element: (
          <ProtectedRoute requiredPermissions={[{ resource: 'settings', action: 'read' }]}>
            <AdminSettingsPage />
          </ProtectedRoute>
        ),
      },
    ],
  },
  {
    path: '/unauthorized',
    element: <UnauthorizedPage />,
  },
  {
    path: '*',
    element: <NotFoundPage />,
  },
]);
