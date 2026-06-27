import { useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useUIStore } from '@/stores/ui.store';
import { useAuthStore } from '@/stores/auth.store';
import { cn } from '@/utils/cn';
import {
  LayoutDashboard,
  Users,
  Building2,
  Clock,
  UserCheck,
  CalendarDays,
  Calendar,
  LogOut,
  ChevronLeft,
  ChevronRight,
  UserSquare2,
  Banknote,
  ClipboardList,
  GraduationCap,
  Settings,
  ChevronDown,
  Building,
  Briefcase,
  BarChart3,
  FileText,
  Bell,
  Shield,
  GitBranch,
  Heart,
  Target,
  Package,
} from 'lucide-react';
import { useState } from 'react';

interface NavItem {
  label: string;
  icon: React.ReactNode;
  path?: string;
  children?: NavItem[];
  module?: string;
}

const navItems: NavItem[] = [
  { label: 'Dashboard', icon: <LayoutDashboard size={18} />, path: '/dashboard', module: 'dashboard' },
  {
    label: 'Organization',
    icon: <Building2 size={18} />,
    module: 'organization',
    children: [
      { label: 'Company Groups', icon: <GitBranch size={16} />, path: '/organization/groups' },
      { label: 'Companies', icon: <Building size={16} />, path: '/organization/companies' },
      { label: 'Departments', icon: <Building2 size={16} />, path: '/organization/departments' },
      { label: 'Positions', icon: <Briefcase size={16} />, path: '/organization/positions' },
    ],
  },
  { label: 'Self Service', icon: <UserCheck size={18} />, path: '/self-service', module: 'self-service' },
  { label: 'Employees', icon: <Users size={18} />, path: '/employees', module: 'employee' },
  { label: 'Attendance', icon: <Clock size={18} />, path: '/attendance', module: 'attendance' },
  {
    label: 'Work Calendar',
    icon: <CalendarDays size={18} />,
    module: 'work-calendar',
    children: [
      { label: 'Calendars', icon: <CalendarDays size={16} />, path: '/work-calendar' },
      { label: 'Holidays', icon: <CalendarDays size={16} />, path: '/work-calendar/holidays' },
    ],
  },
  { label: 'Leave', icon: <Calendar size={18} />, path: '/leave', module: 'leave' },
  { label: 'Offboarding', icon: <LogOut size={18} />, path: '/offboarding', module: 'employee' },
  { label: 'Assets', icon: <Package size={18} />, path: '/assets', module: 'employee' },
  { label: 'Payroll', icon: <Banknote size={18} />, path: '/payroll', module: 'payroll' },
  { label: 'Benefits', icon: <Heart size={18} />, path: '/benefits', module: 'benefit' },
  {
    label: 'Recruitment',
    icon: <UserSquare2 size={18} />,
    module: 'recruitment',
    children: [
      { label: 'Job Postings', icon: <Briefcase size={16} />, path: '/recruitment' },
      { label: 'Candidates', icon: <Users size={16} />, path: '/recruitment/candidates' },
      { label: 'Pipeline', icon: <GitBranch size={16} />, path: '/recruitment/pipeline' },
      { label: 'Interviews', icon: <CalendarDays size={16} />, path: '/recruitment/interviews' },
    ],
  },
  {
    label: 'Performance',
    icon: <BarChart3 size={18} />,
    module: 'performance',
    children: [
      { label: 'Dashboard', icon: <BarChart3 size={16} />, path: '/performance' },
      { label: 'Reviews', icon: <ClipboardList size={16} />, path: '/performance/reviews' },
      { label: 'Goals', icon: <Target size={16} />, path: '/performance/goals' },
    ],
  },
  { label: 'LMS', icon: <GraduationCap size={18} />, path: '/lms', module: 'lms' },
  { label: 'Reports', icon: <FileText size={18} />, path: '/reports', module: 'report' },
  {
    label: 'Administration',
    icon: <Shield size={18} />,
    module: 'rbac',
    children: [
      { label: 'Users', icon: <Users size={16} />, path: '/admin/users' },
      { label: 'Roles', icon: <Shield size={16} />, path: '/admin/roles' },
      { label: 'Audit Log', icon: <FileText size={16} />, path: '/admin/audit' },
      { label: 'Settings', icon: <Settings size={16} />, path: '/admin/settings' },
    ],
  },
];

function NavItemComponent({
  item,
  collapsed,
  depth = 0,
}: {
  item: NavItem;
  collapsed: boolean;
  depth?: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const isActive = item.path ? location.pathname.startsWith(item.path) : false;
  const hasChildren = item.children && item.children.length > 0;

  const handleClick = useCallback(() => {
    if (hasChildren) {
      setExpanded(!expanded);
    }
    if (item.path) {
      navigate(item.path);
    }
  }, [hasChildren, expanded, item.path, navigate]);

  return (
    <div>
      <button
        onClick={handleClick}
        className={cn(
          'w-full flex items-center gap-3 px-3 py-2 text-sm rounded-lg transition-colors',
          isActive
            ? 'bg-sidebar-active text-white'
            : 'text-sidebar-foreground/70 hover:bg-sidebar-hover hover:text-sidebar-foreground',
          collapsed && 'justify-center px-2'
        )}
        title={collapsed ? item.label : undefined}
      >
        <span className="shrink-0">{item.icon}</span>
        {!collapsed && (
          <>
            <span className="flex-1 text-left">{item.label}</span>
            {hasChildren && (
              <ChevronDown
                size={14}
                className={cn('transition-transform', expanded && 'rotate-180')}
              />
            )}
          </>
        )}
      </button>

      {!collapsed && expanded && hasChildren && (
        <div className="ml-6 mt-1 space-y-1">
          {item.children!.map((child, idx) => (
            <NavItemComponent key={idx} item={child} collapsed={collapsed} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

export function Sidebar() {
  const navigate = useNavigate();
  const { sidebarCollapsed, toggleSidebar, sidebarMobileOpen, setSidebarMobileOpen } = useUIStore();
  const { logout } = useAuthStore();

  const handleLogout = useCallback(async () => {
    await logout();
    window.location.href = '/login';
  }, [logout]);

  return (
    <>
      {/* Mobile overlay */}
      {sidebarMobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarMobileOpen(false)}
        />
      )}

      <aside
        className={cn(
          'fixed top-0 left-0 z-50 h-full bg-sidebar flex flex-col',
          'transition-all duration-300 ease-in-out',
          sidebarCollapsed ? 'w-[64px]' : 'w-[260px]',
          'hidden lg:flex'
        )}
      >
        {/* Logo */}
        <div
          className={cn(
            'flex items-center h-16 px-4 border-b border-sidebar-border',
            sidebarCollapsed && 'justify-center px-2'
          )}
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-sm font-bold text-primary-foreground">H</span>
            </div>
            {!sidebarCollapsed && (
              <div>
                <span className="text-sm font-semibold text-sidebar-foreground">HRMS</span>
                <span className="text-[10px] text-sidebar-foreground/50 block leading-tight">
                  Enterprise
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto p-3 space-y-1 scrollbar-thin">
          {navItems.map((item, idx) => (
            <NavItemComponent key={idx} item={item} collapsed={sidebarCollapsed} />
          ))}
        </nav>

        {/* Bottom section */}
        <div className="border-t border-sidebar-border p-3 space-y-1">
          <button
            className="w-full flex items-center gap-3 px-3 py-2 text-sm rounded-lg text-sidebar-foreground/70 hover:bg-sidebar-hover hover:text-sidebar-foreground transition-colors"
            onClick={() => navigate('/notifications')}
          >
            <Bell size={18} />
            {!sidebarCollapsed && <span className="flex-1 text-left">Notifications</span>}
          </button>

          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2 text-sm rounded-lg text-sidebar-foreground/70 hover:bg-sidebar-hover hover:text-sidebar-foreground transition-colors"
          >
            <LogOut size={18} />
            {!sidebarCollapsed && <span className="flex-1 text-left">Sign Out</span>}
          </button>

          {/* Collapse toggle */}
          <button
            onClick={toggleSidebar}
            className="w-full flex items-center gap-3 px-3 py-2 text-sm rounded-lg text-sidebar-foreground/50 hover:bg-sidebar-hover transition-colors"
          >
            {sidebarCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
            {!sidebarCollapsed && <span className="flex-1 text-left">Collapse</span>}
          </button>
        </div>
      </aside>

      {/* Mobile sidebar */}
      <aside
        className={cn(
          'fixed top-0 left-0 z-50 h-full bg-sidebar flex flex-col',
          'transition-transform duration-300 ease-in-out w-[260px]',
          sidebarMobileOpen ? 'translate-x-0' : '-translate-x-full',
          'lg:hidden'
        )}
      >
        {/* Same content as desktop but without collapse */}
        <div className="flex items-center h-16 px-4 border-b border-sidebar-border">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-sm font-bold text-primary-foreground">H</span>
            </div>
            <div>
              <span className="text-sm font-semibold text-sidebar-foreground">HRMS</span>
              <span className="text-[10px] text-sidebar-foreground/50 block leading-tight">Enterprise</span>
            </div>
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          {navItems.map((item, idx) => (
            <NavItemComponent key={idx} item={item} collapsed={false} />
          ))}
        </nav>
        <div className="border-t border-sidebar-border p-3">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2 text-sm rounded-lg text-sidebar-foreground/70 hover:bg-sidebar-hover transition-colors"
          >
            <LogOut size={18} />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>
    </>
  );
}
