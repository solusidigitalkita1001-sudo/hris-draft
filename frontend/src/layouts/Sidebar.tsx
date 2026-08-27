import { useCallback, useMemo, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useUIStore } from '@/stores/ui.store';
import { useAuthStore } from '@/stores/auth.store';
import { useCompanyStore } from '@/stores/company.store';
import {
  ADMIN_ROLES,
  EMPLOYEE_SELF_SERVICE_ROLES,
  OPERATIONAL_ROLES,
  canAccess,
  type AccessRule,
} from '@/lib/access-control';
import { useI18n } from '@/i18n/provider';
import type { TranslationKey } from '@/i18n/translations';
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
  Network,
  Heart,
  Target,
  Package,
  Plane,
  Workflow,
  MapPin,
  Repeat,
  Menu as MenuIcon,
  ShieldCheck,
  Wallet,
} from 'lucide-react';
import { administrationService } from '@/services/administration.service';

interface NavItem {
  labelKey: TranslationKey;
  icon: React.ReactNode;
  path?: string;
  children?: NavItem[];
  access?: AccessRule;
}

const navItems: NavItem[] = [
  {
    labelKey: 'sidebar.dashboard',
    icon: <LayoutDashboard size={18} />,
    path: '/dashboard',
    access: { requireAuth: true, requiredRoles: EMPLOYEE_SELF_SERVICE_ROLES },
  },
  {
    labelKey: 'sidebar.organization',
    icon: <Building2 size={18} />,
    access: {
      requireAuth: true,
      requiredPermissions: [{ resource: 'organization', action: 'read' }],
      requiredRoles: OPERATIONAL_ROLES,
    },
    children: [
      { labelKey: 'sidebar.organization.chart', icon: <Network size={16} />, path: '/organization/chart' },
      { labelKey: 'sidebar.organization.groups', icon: <GitBranch size={16} />, path: '/organization/groups' },
      { labelKey: 'sidebar.organization.companies', icon: <Building size={16} />, path: '/organization/companies' },
      { labelKey: 'sidebar.organization.branches', icon: <MapPin size={16} />, path: '/organization/branches' },
      { labelKey: 'sidebar.organization.departments', icon: <Building2 size={16} />, path: '/organization/departments' },
      { labelKey: 'sidebar.organization.positions', icon: <Briefcase size={16} />, path: '/organization/positions' },
    ],
  },
  {
    labelKey: 'sidebar.selfService',
    icon: <UserCheck size={18} />,
    path: '/self-service',
    access: { requireAuth: true, requiredRoles: EMPLOYEE_SELF_SERVICE_ROLES },
  },
  {
    labelKey: 'sidebar.loan',
    icon: <Banknote size={18} />,
    path: '/employee-loans',
    access: { requireAuth: true, requiredRoles: EMPLOYEE_SELF_SERVICE_ROLES },
  },
  {
    labelKey: 'sidebar.ewa',
    icon: <Wallet size={18} />,
    path: '/ewa',
    access: { requireAuth: true, requiredRoles: EMPLOYEE_SELF_SERVICE_ROLES },
  },
  {
    labelKey: 'sidebar.dailyActivity',
    icon: <MapPin size={18} />,
    path: '/daily-activity',
    access: { requireAuth: true, requiredRoles: EMPLOYEE_SELF_SERVICE_ROLES },
  },
  {
    labelKey: 'sidebar.travelExpense',
    icon: <Plane size={18} />,
    path: '/travel-expenses',
    access: { requireAuth: true, requiredRoles: EMPLOYEE_SELF_SERVICE_ROLES },
  },
  {
    labelKey: 'sidebar.workflow',
    icon: <Workflow size={18} />,
    path: '/workflow-engine',
    access: {
      requireAuth: true,
      requiredPermissions: [{ resource: 'workflow', action: 'read' }],
      requiredRoles: OPERATIONAL_ROLES,
    },
  },
  {
    labelKey: 'sidebar.documents',
    icon: <FileText size={18} />,
    path: '/documents',
    access: {
      requireAuth: true,
      requiredPermissions: [{ resource: 'document', action: 'read' }],
      requiredRoles: OPERATIONAL_ROLES,
    },
  },
  {
    labelKey: 'sidebar.employees',
    icon: <Users size={18} />,
    path: '/employees',
    access: {
      requireAuth: true,
      requiredPermissions: [{ resource: 'employee', action: 'read' }],
      requiredRoles: OPERATIONAL_ROLES,
    },
  },
  {
    labelKey: 'sidebar.attendance',
    icon: <Clock size={18} />,
    path: '/attendance',
    access: {
      requireAuth: true,
      requiredPermissions: [{ resource: 'attendance', action: 'read' }],
      requiredRoles: OPERATIONAL_ROLES,
    },
  },
  {
    labelKey: 'sidebar.workCalendar',
    icon: <CalendarDays size={18} />,
    access: {
      requireAuth: true,
      requiredPermissions: [{ resource: 'work-calendar', action: 'read' }],
      requiredRoles: OPERATIONAL_ROLES,
    },
    children: [
      { labelKey: 'sidebar.workCalendar.calendars', icon: <CalendarDays size={16} />, path: '/work-calendar' },
      { labelKey: 'sidebar.workCalendar.shifts', icon: <Repeat size={16} />, path: '/work-calendar/shifts' },
      { labelKey: 'sidebar.workCalendar.holidays', icon: <CalendarDays size={16} />, path: '/work-calendar/holidays' },
    ],
  },
  {
    labelKey: 'sidebar.leave',
    icon: <Calendar size={18} />,
    path: '/leave',
    access: {
      requireAuth: true,
      requiredPermissions: [{ resource: 'leave', action: 'read' }],
      requiredRoles: OPERATIONAL_ROLES,
    },
  },
  {
    labelKey: 'sidebar.offboarding',
    icon: <LogOut size={18} />,
    path: '/offboarding',
    access: {
      requireAuth: true,
      requiredPermissions: [{ resource: 'employee', action: 'read' }],
      requiredRoles: OPERATIONAL_ROLES,
    },
  },
  {
    labelKey: 'sidebar.assets',
    icon: <Package size={18} />,
    path: '/assets',
    access: {
      requireAuth: true,
      requiredPermissions: [{ resource: 'asset', action: 'read' }],
      requiredRoles: OPERATIONAL_ROLES,
    },
  },
  {
    labelKey: 'sidebar.payroll',
    icon: <Banknote size={18} />,
    path: '/payroll',
    access: { requireAuth: true, requiredPermissions: [{ resource: 'payroll', action: 'read' }], requiredRoles: OPERATIONAL_ROLES },
  },
  {
    labelKey: 'sidebar.benefits',
    icon: <Heart size={18} />,
    path: '/benefits',
    access: { requireAuth: true, requiredPermissions: [{ resource: 'benefit', action: 'read' }], requiredRoles: OPERATIONAL_ROLES },
  },
  {
    labelKey: 'sidebar.recruitment',
    icon: <UserSquare2 size={18} />,
    access: { requireAuth: true, requiredPermissions: [{ resource: 'recruitment', action: 'read' }], requiredRoles: OPERATIONAL_ROLES },
    children: [
      { labelKey: 'sidebar.recruitment.jobs', icon: <Briefcase size={16} />, path: '/recruitment' },
      { labelKey: 'sidebar.recruitment.candidates', icon: <Users size={16} />, path: '/recruitment/candidates' },
      { labelKey: 'sidebar.recruitment.pipeline', icon: <GitBranch size={16} />, path: '/recruitment/pipeline' },
      { labelKey: 'sidebar.recruitment.interviews', icon: <CalendarDays size={16} />, path: '/recruitment/interviews' },
    ],
  },
  {
    labelKey: 'sidebar.performance',
    icon: <BarChart3 size={18} />,
    access: { requireAuth: true, requiredPermissions: [{ resource: 'performance', action: 'read' }], requiredRoles: OPERATIONAL_ROLES },
    children: [
      { labelKey: 'sidebar.performance.dashboard', icon: <BarChart3 size={16} />, path: '/performance' },
      { labelKey: 'sidebar.performance.cycles', icon: <BarChart3 size={16} />, path: '/performance/cycles' },
      { labelKey: 'sidebar.performance.reviews', icon: <ClipboardList size={16} />, path: '/performance/reviews' },
      { labelKey: 'sidebar.performance.goals', icon: <Target size={16} />, path: '/performance/goals' },
    ],
  },
  {
    labelKey: 'sidebar.lms',
    icon: <GraduationCap size={18} />,
    path: '/lms',
    access: { requireAuth: true, requiredPermissions: [{ resource: 'training', action: 'read' }], requiredRoles: OPERATIONAL_ROLES },
  },
  {
    labelKey: 'sidebar.reports',
    icon: <FileText size={18} />,
    path: '/reports',
    access: {
      requireAuth: true,
      requiredPermissions: [{ resource: 'report', action: 'read' }],
      requiredRoles: OPERATIONAL_ROLES,
    },
  },
  {
    labelKey: 'sidebar.administration',
    icon: <Shield size={18} />,
    access: { requireAuth: true, requiredRoles: ADMIN_ROLES },
    children: [
      {
        labelKey: 'sidebar.administration.users',
        icon: <Users size={16} />,
        path: '/admin/users',
        access: { requireAuth: true, requiredPermissions: [{ resource: 'user', action: 'read' }] },
      },
      {
        labelKey: 'sidebar.administration.roles',
        icon: <Shield size={16} />,
        path: '/admin/roles',
        access: { requireAuth: true, requiredPermissions: [{ resource: 'rbac', action: 'read' }] },
      },
      {
        labelKey: 'sidebar.administration.audit',
        icon: <FileText size={16} />,
        path: '/admin/audit',
        access: { requireAuth: true, requiredPermissions: [{ resource: 'audit-log', action: 'read' }] },
      },
      {
        labelKey: 'sidebar.administration.workflows',
        icon: <Workflow size={16} />,
        path: '/admin/workflows',
        access: { requireAuth: true, requiredPermissions: [{ resource: 'workflow', action: 'read' }] },
      },
      {
        labelKey: 'sidebar.administration.menuAccess',
        icon: <MenuIcon size={16} />,
        path: '/admin/menu-access',
        access: { requireAuth: true, requiredPermissions: [{ resource: 'settings', action: 'read' }] },
      },
      {
        labelKey: 'sidebar.administration.dataScope',
        icon: <ShieldCheck size={16} />,
        path: '/admin/data-scope',
        access: { requireAuth: true, requiredPermissions: [{ resource: 'settings', action: 'read' }] },
      },
      {
        labelKey: 'sidebar.administration.ewaApproval',
        icon: <Wallet size={16} />,
        path: '/admin/ewa',
        access: { requireAuth: true, requiredPermissions: [{ resource: 'ewa', action: 'read' }], requiredRoles: OPERATIONAL_ROLES },
      },
      {
        labelKey: 'sidebar.administration.dailyActivities',
        icon: <MapPin size={16} />,
        path: '/admin/daily-activities',
        access: { requireAuth: true, requiredPermissions: [{ resource: 'daily-activity', action: 'read' }], requiredRoles: OPERATIONAL_ROLES },
      },
      {
        labelKey: 'sidebar.administration.settings',
        icon: <Settings size={16} />,
        path: '/admin/settings',
        access: { requireAuth: true, requiredPermissions: [{ resource: 'settings', action: 'read' }] },
      },
    ],
  },
];

function filterNavItems(
  items: NavItem[],
  user: ReturnType<typeof useAuthStore.getState>['user'],
  deniedMenuPaths: Set<string>
) {
  return items.reduce<NavItem[]>((visibleItems, item) => {
    const isVisible = item.access ? canAccess(user, item.access) : !!user;
    if (!isVisible) return visibleItems;

    if (item.path) {
      const isSuperAdmin = user?.roles?.includes('SUPER_ADMIN');
      if (!isSuperAdmin && deniedMenuPaths.has(item.path)) {
        return visibleItems;
      }
    }

    if (item.children) {
      const filteredChildren = filterNavItems(item.children, user, deniedMenuPaths);
      if (filteredChildren.length > 0) {
        visibleItems.push({ ...item, children: filteredChildren });
      }
      return visibleItems;
    }

    visibleItems.push(item);
    return visibleItems;
  }, []);
}

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
  const { t } = useI18n();
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
        title={collapsed ? t(item.labelKey) : undefined}
      >
        <span className="shrink-0">{item.icon}</span>
        {!collapsed && (
          <>
            <span className="flex-1 text-left">{t(item.labelKey)}</span>
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
  const { logout, user } = useAuthStore();
  const { activeCompany } = useCompanyStore();
  const { t } = useI18n();

  const [deniedMenuPaths, setDeniedMenuPaths] = useState<Set<string>>(new Set());
  const [_denyLoading, setDenyLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function loadDeniedPaths() {
      if (!user || !activeCompany?.id) {
        setDeniedMenuPaths(new Set());
        return;
      }
      if (user.roles?.includes('SUPER_ADMIN')) {
        setDeniedMenuPaths(new Set());
        return;
      }
      setDenyLoading(true);
      try {
        const res = await administrationService.getMyMenuAccess(activeCompany.id);
        if (!cancelled) {
          setDeniedMenuPaths(new Set(res.deniedMenuPaths || []));
        }
      } catch (e) {
        if (!cancelled) {
          setDeniedMenuPaths(new Set());
        }
      } finally {
        if (!cancelled) setDenyLoading(false);
      }
    }
    loadDeniedPaths();
    return () => {
      cancelled = true;
    };
  }, [user, activeCompany?.id]);

  const visibleNavItems = useMemo(
    () => filterNavItems(navItems, user, deniedMenuPaths),
    [user, deniedMenuPaths]
  );

  const handleLogout = useCallback(async () => {
    await logout();
    window.location.href = '/login';
  }, [logout]);

  return (
    <>
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

        <nav className="flex-1 overflow-y-auto p-3 space-y-1 scrollbar-thin">
          {visibleNavItems.map((item, idx) => (
            <NavItemComponent key={idx} item={item} collapsed={sidebarCollapsed} />
          ))}
        </nav>

        <div className="border-t border-sidebar-border p-3 space-y-1">
          <button
            className="w-full flex items-center gap-3 px-3 py-2 text-sm rounded-lg text-sidebar-foreground/70 hover:bg-sidebar-hover hover:text-sidebar-foreground transition-colors"
            onClick={() => navigate('/notifications')}
          >
            <Bell size={18} />
            {!sidebarCollapsed && <span className="flex-1 text-left">{t('sidebar.notifications')}</span>}
          </button>

          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2 text-sm rounded-lg text-sidebar-foreground/70 hover:bg-sidebar-hover hover:text-sidebar-foreground transition-colors"
          >
            <LogOut size={18} />
            {!sidebarCollapsed && <span className="flex-1 text-left">{t('sidebar.signOut')}</span>}
          </button>

          <button
            onClick={toggleSidebar}
            className="w-full flex items-center gap-3 px-3 py-2 text-sm rounded-lg text-sidebar-foreground/50 hover:bg-sidebar-hover transition-colors"
          >
            {sidebarCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
            {!sidebarCollapsed && <span className="flex-1 text-left">{t('sidebar.collapse')}</span>}
          </button>
        </div>
      </aside>

      <aside
        className={cn(
          'fixed top-0 left-0 z-50 h-full bg-sidebar flex flex-col',
          'transition-transform duration-300 ease-in-out w-[260px]',
          sidebarMobileOpen ? 'translate-x-0' : '-translate-x-full',
          'lg:hidden'
        )}
      >
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
          {visibleNavItems.map((item, idx) => (
            <NavItemComponent key={idx} item={item} collapsed={false} />
          ))}
        </nav>
        <div className="border-t border-sidebar-border p-3">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2 text-sm rounded-lg text-sidebar-foreground/70 hover:bg-sidebar-hover transition-colors"
          >
            <LogOut size={18} />
            <span>{t('sidebar.signOut')}</span>
          </button>
        </div>
      </aside>
    </>
  );
}
