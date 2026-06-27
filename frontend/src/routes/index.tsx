import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AuthLayout } from '@/layouts/AuthLayout';
import { DashboardLayout } from '@/layouts/DashboardLayout';
import { ProtectedRoute } from './ProtectedRoute';

// Pages
import { LoginPage } from '@/modules/auth/LoginPage';
import { ForgotPasswordPage } from '@/modules/auth/ForgotPasswordPage';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { UnauthorizedPage } from '@/pages/UnauthorizedPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { GroupListPage } from '@/modules/organization/pages/GroupListPage';
import { CompanyListPage } from '@/modules/organization/pages/CompanyListPage';
import { DepartmentListPage } from '@/modules/organization/pages/DepartmentListPage';
import { PositionListPage } from '@/modules/organization/pages/PositionListPage';

// Employee Pages
import { EmployeeListPage } from '@/modules/employee/pages/EmployeeListPage';
import { EmployeeDetailPage } from '@/modules/employee/pages/EmployeeDetailPage';
import { EmployeeFormPage } from '@/modules/employee/pages/EmployeeFormPage';

// Payroll Pages
import { PayrollDashboard } from '@/modules/payroll/pages/PayrollDashboard';
import { SalaryComponentList } from '@/modules/payroll/pages/SalaryComponentList';
import { PayrollPeriodList } from '@/modules/payroll/pages/PayrollPeriodList';
import { PayrollRunList } from '@/modules/payroll/pages/PayrollRunList';
import { PayrollRunDetail } from '@/modules/payroll/pages/PayrollRunDetail';
import { PayslipDetail } from '@/modules/payroll/pages/PayslipDetail';

// Benefit Pages
import { BenefitPlanList } from '@/modules/benefit/pages/BenefitPlanList';
import { BenefitPlanDetail } from '@/modules/benefit/pages/BenefitPlanDetail';

// Recruitment Pages
import { JobPostingList } from '@/modules/recruitment/pages/JobPostingList';
import { JobPostingDetail } from '@/modules/recruitment/pages/JobPostingDetail';
import { CandidateList } from '@/modules/recruitment/pages/CandidateList';
import { ApplicationPipeline } from '@/modules/recruitment/pages/ApplicationPipeline';
import { InterviewSchedule } from '@/modules/recruitment/pages/InterviewSchedule';

// Performance Pages
import { PerformanceDashboard } from '@/modules/performance/pages/PerformanceDashboard';
import { ReviewList } from '@/modules/performance/pages/ReviewList';
import { GoalList } from '@/modules/performance/pages/GoalList';

// Training Pages
import { CourseList } from '@/modules/training/pages/CourseList';
import { CourseDetail } from '@/modules/training/pages/CourseDetail';

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

// Work Calendar Pages
import { WorkCalendarListPage } from '@/modules/work-calendar/pages/WorkCalendarListPage';
import { WorkCalendarDetailPage } from '@/modules/work-calendar/pages/WorkCalendarDetailPage';
import { WorkCalendarHolidaysPage } from '@/modules/work-calendar/pages/WorkCalendarHolidaysPage';

// Notification Pages
import { NotificationsPage } from '@/modules/notifications/pages/NotificationsPage';

// Admin Pages
import { AdminUsersPage } from '@/modules/admin/pages/AdminUsersPage';
import { AdminAuditLogPage } from '@/modules/admin/pages/AdminAuditLogPage';
import { AdminSettingsPage } from '@/modules/admin/pages/AdminSettingsPage';

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
        element: <DashboardPage />,
      },
      {
        path: 'organization',
        children: [
          {
            path: 'groups',
            element: (
              <ProtectedRoute requiredPermissions={[{ resource: 'organization', action: 'read' }]}>
                <GroupListPage />
              </ProtectedRoute>
            ),
          },
          {
            path: 'companies',
            element: (
              <ProtectedRoute requiredPermissions={[{ resource: 'organization', action: 'read' }]}>
                <CompanyListPage />
              </ProtectedRoute>
            ),
          },
          {
            path: 'departments',
            element: (
              <ProtectedRoute requiredPermissions={[{ resource: 'organization', action: 'read' }]}>
                <DepartmentListPage />
              </ProtectedRoute>
            ),
          },
          {
            path: 'positions',
            element: (
              <ProtectedRoute requiredPermissions={[{ resource: 'organization', action: 'read' }]}>
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
          <ProtectedRoute requiredPermissions={[{ resource: 'employee', action: 'read' }]}>
            <EmployeeListPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'employees/new',
        element: (
          <ProtectedRoute requiredPermissions={[{ resource: 'employee', action: 'create' }]}>
            <EmployeeFormPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'employees/:id/edit',
        element: (
          <ProtectedRoute requiredPermissions={[{ resource: 'employee', action: 'update' }]}>
            <EmployeeFormPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'employees/:id',
        element: (
          <ProtectedRoute requiredPermissions={[{ resource: 'employee', action: 'read' }]}>
            <EmployeeDetailPage />
          </ProtectedRoute>
        ),
      },
      // Payroll Routes
      {
        path: 'payroll',
        element: <PayrollDashboard />,
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
        path: 'recruitment/candidates',
        element: (
          <ProtectedRoute requiredPermissions={[{ resource: 'recruitment', action: 'read' }]}>
            <CandidateList />
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
        path: 'performance/goals',
        element: (
          <ProtectedRoute requiredPermissions={[{ resource: 'performance', action: 'read' }]}>
            <GoalList />
          </ProtectedRoute>
        ),
      },
      // Attendance Routes
      {
        path: 'attendance',
        element: (
          <ProtectedRoute requiredPermissions={[{ resource: 'attendance', action: 'read' }]}>
            <AttendanceList />
          </ProtectedRoute>
        ),
      },
      // Leave Routes
      {
        path: 'leave',
        element: (
          <ProtectedRoute requiredPermissions={[{ resource: 'leave', action: 'read' }]}>
            <LeaveList />
          </ProtectedRoute>
        ),
      },
      {
        path: 'leave/:id',
        element: (
          <ProtectedRoute requiredPermissions={[{ resource: 'leave', action: 'read' }]}>
            <LeaveDetail />
          </ProtectedRoute>
        ),
      },
      // Asset Routes
      {
        path: 'assets',
        element: (
          <ProtectedRoute requiredPermissions={[{ resource: 'asset', action: 'read' }]}>
            <AssetList />
          </ProtectedRoute>
        ),
      },
      // Offboarding Routes
      {
        path: 'offboarding',
        element: (
          <ProtectedRoute requiredPermissions={[{ resource: 'employee', action: 'read' }]}>
            <OffboardingList />
          </ProtectedRoute>
        ),
      },
      {
        path: 'offboarding/:id',
        element: (
          <ProtectedRoute requiredPermissions={[{ resource: 'employee', action: 'read' }]}>
            <OffboardingDetail />
          </ProtectedRoute>
        ),
      },
      // Work Calendar Routes
      {
        path: 'work-calendar',
        element: (
          <ProtectedRoute requiredPermissions={[{ resource: 'work-calendar', action: 'read' }]}>
            <WorkCalendarListPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'work-calendar/holidays',
        element: (
          <ProtectedRoute requiredPermissions={[{ resource: 'work-calendar', action: 'read' }]}>
            <WorkCalendarHolidaysPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'work-calendar/:id',
        element: (
          <ProtectedRoute requiredPermissions={[{ resource: 'work-calendar', action: 'read' }]}>
            <WorkCalendarDetailPage />
          </ProtectedRoute>
        ),
      },
      // Reports Routes
      {
        path: 'reports',
        element: (
          <ProtectedRoute requiredPermissions={[{ resource: 'report', action: 'read' }]}>
            <ReportsPage />
          </ProtectedRoute>
        ),
      },
      // Notifications Route
      {
        path: 'notifications',
        element: (
          <ProtectedRoute requiredPermissions={[{ resource: 'dashboard', action: 'read' }]}>
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
        path: 'admin/users',
        element: (
          <ProtectedRoute requiredPermissions={[{ resource: 'user', action: 'read' }]}>
            <AdminUsersPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'admin/roles',
        element: <div className="p-8 text-center text-muted-foreground">Role Management (Coming Soon)</div>,
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
        path: 'admin/settings',
        element: (
          <ProtectedRoute requiredPermissions={[{ resource: 'administration', action: 'read' }]}>
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
