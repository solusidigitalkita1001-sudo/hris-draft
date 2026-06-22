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
        ],
      },
      // Placeholder routes for future modules
      {
        path: 'employees',
        element: <div className="p-8 text-center text-muted-foreground">Employee Management (Coming Soon)</div>,
      },
      {
        path: 'attendance',
        element: <div className="p-8 text-center text-muted-foreground">Attendance (Coming Soon)</div>,
      },
      {
        path: 'leave',
        element: <div className="p-8 text-center text-muted-foreground">Leave Management (Coming Soon)</div>,
      },
      {
        path: 'payroll',
        element: <div className="p-8 text-center text-muted-foreground">Payroll (Coming Soon)</div>,
      },
      {
        path: 'admin/roles',
        element: <div className="p-8 text-center text-muted-foreground">Role Management (Coming Soon)</div>,
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
