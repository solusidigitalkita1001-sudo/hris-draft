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
import { getInitials } from '@/utils/format';
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
  Receipt,
  X,
} from 'lucide-react';
import { administrationService } from '@/services/administration.service';
import { SidebarAttendanceCard } from './SidebarAttendanceCard';

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
    icon: <LayoutDashboard size={17} />,
    path: '/dashboard',
    access: { requireAuth: true, requiredRoles: EMPLOYEE_SELF_SERVICE_ROLES },
  },
  {
    labelKey: 'sidebar.organization',
    icon: <Building2 size={17} />,
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
      {
        labelKey: 'sidebar.organization.attendanceMethods',
        icon: <ShieldCheck size={16} />,
        path: '/organization/attendance-methods',
        access: { requireAuth: true, requiredRoles: ['SUPER_ADMIN'] },
      },
    ],
  },
  {
    labelKey: 'sidebar.selfService',
    icon: <UserCheck size={17} />,
    path: '/self-service',
    access: { requireAuth: true, requiredRoles: EMPLOYEE_SELF_SERVICE_ROLES },
  },
  {
    labelKey: 'sidebar.myPayslips',
    icon: <Receipt size={17} />,
    path: '/my-payslips',
    access: { requireAuth: true, requiredRoles: EMPLOYEE_SELF_SERVICE_ROLES },
  },
  {
    labelKey: 'sidebar.loan',
    icon: <Banknote size={17} />,
    path: '/employee-loans',
    access: { requireAuth: true, requiredRoles: EMPLOYEE_SELF_SERVICE_ROLES },
  },
  {
    labelKey: 'sidebar.ewa',
    icon: <Wallet size={17} />,
    path: '/ewa',
    access: { requireAuth: true, requiredRoles: EMPLOYEE_SELF_SERVICE_ROLES },
  },
  {
    labelKey: 'sidebar.dailyActivity',
    icon: <MapPin size={17} />,
    path: '/daily-activity',
    access: { requireAuth: true, requiredRoles: EMPLOYEE_SELF_SERVICE_ROLES },
  },
  {
    labelKey: 'sidebar.travelExpense',
    icon: <Plane size={17} />,
    path: '/travel-expenses',
    access: { requireAuth: true, requiredRoles: EMPLOYEE_SELF_SERVICE_ROLES },
  },
  {
    labelKey: 'sidebar.workflow',
    icon: <Workflow size={17} />,
    path: '/workflow-engine',
    access: {
      requireAuth: true,
      requiredPermissions: [{ resource: 'workflow', action: 'read' }],
      requiredRoles: OPERATIONAL_ROLES,
    },
  },
  {
    labelKey: 'sidebar.documents',
    icon: <FileText size={17} />,
    path: '/documents',
    access: {
      requireAuth: true,
      requiredPermissions: [{ resource: 'document', action: 'read' }],
      requiredRoles: OPERATIONAL_ROLES,
    },
  },
  {
    labelKey: 'sidebar.employees',
    icon: <Users size={17} />,
    path: '/employees',
    access: {
      requireAuth: true,
      requiredPermissions: [{ resource: 'employee', action: 'read' }],
      requiredRoles: OPERATIONAL_ROLES,
    },
  },
  {
    labelKey: 'sidebar.attendance',
    icon: <Clock size={17} />,
    path: '/attendance',
    access: {
      requireAuth: true,
      requiredPermissions: [{ resource: 'attendance', action: 'read' }],
      // Karyawan biasa juga melihat menu ini untuk self check-in & riwayat sendiri.
      requiredRoles: EMPLOYEE_SELF_SERVICE_ROLES,
    },
  },
  {
    labelKey: 'sidebar.workCalendar',
    icon: <CalendarDays size={17} />,
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
    icon: <Calendar size={17} />,
    path: '/leave',
    access: {
      requireAuth: true,
      requiredPermissions: [{ resource: 'leave', action: 'read' }],
      requiredRoles: OPERATIONAL_ROLES,
    },
  },
  {
    labelKey: 'sidebar.offboarding',
    icon: <LogOut size={17} />,
    path: '/offboarding',
    access: {
      requireAuth: true,
      requiredPermissions: [{ resource: 'employee', action: 'read' }],
      requiredRoles: OPERATIONAL_ROLES,
    },
  },
  {
    labelKey: 'sidebar.assets',
    icon: <Package size={17} />,
    path: '/assets',
    access: {
      requireAuth: true,
      requiredPermissions: [{ resource: 'asset', action: 'read' }],
      requiredRoles: OPERATIONAL_ROLES,
    },
  },
  {
    labelKey: 'sidebar.payroll',
    icon: <Banknote size={17} />,
    path: '/payroll',
    access: { requireAuth: true, requiredPermissions: [{ resource: 'payroll', action: 'read' }], requiredRoles: OPERATIONAL_ROLES },
  },
  {
    labelKey: 'sidebar.benefits',
    icon: <Heart size={17} />,
    path: '/benefits',
    access: { requireAuth: true, requiredPermissions: [{ resource: 'benefit', action: 'read' }], requiredRoles: OPERATIONAL_ROLES },
  },
  {
    labelKey: 'sidebar.recruitment',
    icon: <UserSquare2 size={17} />,
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
    icon: <BarChart3 size={17} />,
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
    icon: <GraduationCap size={17} />,
    path: '/lms',
    access: { requireAuth: true, requiredPermissions: [{ resource: 'training', action: 'read' }], requiredRoles: OPERATIONAL_ROLES },
  },
  {
    labelKey: 'sidebar.reports',
    icon: <FileText size={17} />,
    path: '/reports',
    access: {
      requireAuth: true,
      requiredPermissions: [{ resource: 'report', action: 'read' }],
      requiredRoles: OPERATIONAL_ROLES,
    },
  },
  {
    labelKey: 'sidebar.administration',
    icon: <Shield size={17} />,
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
        access: { requireAuth: true, requiredPermissions: [{ resource: 'rbac', action: 'update' }] },
      },
      {
        labelKey: 'sidebar.administration.dataScope',
        icon: <ShieldCheck size={16} />,
        path: '/admin/data-scope',
        access: { requireAuth: true, requiredPermissions: [{ resource: 'rbac', action: 'update' }] },
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

function isItemActive(item: NavItem, pathname: string): boolean {
  if (item.path) {
    if (item.path === '/recruitment' || item.path === '/performance' || item.path === '/work-calendar') {
      return pathname === item.path;
    }
    return pathname === item.path || pathname.startsWith(`${item.path}/`);
  }
  return (item.children ?? []).some((child) => isItemActive(child, pathname));
}

function NavEntry({
  item,
  collapsed,
  isOpen,
  onToggleGroup,
  onNavigate,
  onExpandSidebar,
}: {
  item: NavItem;
  collapsed: boolean;
  isOpen: boolean;
  onToggleGroup: (key: string) => void;
  onNavigate: (path: string) => void;
  onExpandSidebar: (groupKey: string) => void;
}) {
  const location = useLocation();
  const { t } = useI18n();
  const hasChildren = !!item.children?.length;
  const active = isItemActive(item, location.pathname);
  const selfActive = item.path
    ? location.pathname === item.path || location.pathname.startsWith(`${item.path}/`)
    : false;

  const handleClick = () => {
    if (hasChildren) {
      if (collapsed) {
        onExpandSidebar(item.labelKey);
        return;
      }
      onToggleGroup(item.labelKey);
      return;
    }
    if (item.path) onNavigate(item.path);
  };

  return (
    <div className="flex flex-col gap-0.5">
      <button
        onClick={handleClick}
        title={collapsed ? t(item.labelKey) : undefined}
        className={cn(
          'relative flex w-full items-center gap-3 whitespace-nowrap rounded-[14px] px-3 py-[11px] text-[12.5px] transition-colors',
          selfActive || (hasChildren && active && !isOpen)
            ? 'bg-accent font-semibold text-primary'
            : 'text-sidebar-muted hover:bg-sidebar-hover hover:text-sidebar-foreground',
          collapsed && 'justify-center px-2'
        )}
        aria-expanded={hasChildren ? isOpen : undefined}
      >
        {/* Bar aksen kiri — menyala saat item (atau salah satu child-nya) aktif */}
        <span
          aria-hidden="true"
          className={cn(
            'absolute left-0 top-1/2 w-[3px] -translate-y-1/2 rounded-r-[3px] bg-primary transition-all duration-[220ms] ease-[cubic-bezier(.22,.9,.3,1)]',
            active ? 'h-[18px]' : 'h-0'
          )}
        />
        <span className="flex h-[18px] w-[18px] flex-none items-center justify-center">{item.icon}</span>
        {!collapsed && <span className="min-w-0 flex-1 overflow-hidden text-left">{t(item.labelKey)}</span>}
        {!collapsed && hasChildren && (
          <ChevronDown
            size={12}
            aria-hidden="true"
            className={cn('transition-transform duration-[240ms] ease-[cubic-bezier(.22,.9,.3,1)]', isOpen && 'rotate-180')}
          />
        )}
        {collapsed && hasChildren && (
          <span
            aria-hidden="true"
            className={cn('absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full', active ? 'bg-primary' : 'bg-sidebar-muted/50')}
          />
        )}
      </button>

      {!collapsed && hasChildren && isOpen && (
        <div className="my-0.5 ml-[21px] flex flex-col gap-px border-l-[1.5px] border-sidebar-border pl-[11px]">
          {item.children!.map((child) => {
            const childActive = child.path
              ? location.pathname === child.path || location.pathname.startsWith(`${child.path}/`)
              : false;
            return (
              <button
                key={child.labelKey}
                onClick={() => child.path && onNavigate(child.path)}
                className={cn(
                  'flex w-full items-center gap-2.5 whitespace-nowrap rounded-[11px] px-[11px] py-[9px] text-[11.5px] transition-colors',
                  childActive
                    ? 'bg-accent font-semibold text-primary'
                    : 'text-sidebar-muted hover:bg-sidebar-hover hover:text-sidebar-foreground'
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn('h-[5px] w-[5px] flex-none rounded-full', childActive ? 'bg-primary' : 'bg-sidebar-muted/50')}
                />
                <span className="min-w-0 flex-1 overflow-hidden text-ellipsis text-left">{t(child.labelKey)}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Bottom nav mobile sesuai handoff: tujuan utama ESS + Profil. */
function MobileBottomNav({ visiblePaths }: { visiblePaths: Set<string> }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuthStore();
  const { t } = useI18n();

  const bottomNavItems: Array<{ path: string; labelKey: TranslationKey; icon: React.ReactNode }> = [
    { path: '/dashboard', labelKey: 'sidebar.dashboard', icon: <LayoutDashboard size={19} /> },
    { path: '/self-service', labelKey: 'sidebar.selfService', icon: <UserCheck size={19} /> },
    { path: '/employee-loans', labelKey: 'sidebar.loan', icon: <Banknote size={19} /> },
    { path: '/notifications', labelKey: 'sidebar.notifications', icon: <Bell size={19} /> },
  ];
  const items = bottomNavItems.filter(
    (item) => item.path === '/notifications' || visiblePaths.has(item.path)
  );

  return (
    <nav
      className="fixed bottom-[14px] left-[14px] right-[14px] z-40 flex h-[68px] items-stretch rounded-[24px] border border-border bg-card/95 shadow-nav backdrop-blur-md lg:hidden"
      aria-label="Navigasi utama"
    >
      {items.map((item) => {
        const active = location.pathname.startsWith(item.path);
        return (
          <button
            key={item.path}
            onClick={() => navigate(item.path)}
            className={cn(
              'flex flex-1 flex-col items-center justify-center gap-1 text-[9.5px]',
              active ? 'font-semibold text-primary' : 'text-muted-foreground'
            )}
          >
            {item.icon}
            {t(item.labelKey)}
          </button>
        );
      })}
      <button
        onClick={() => navigate('/profile')}
        className={cn(
          'flex flex-1 flex-col items-center justify-center gap-1 text-[9.5px]',
          location.pathname.startsWith('/profile') ? 'font-semibold text-primary' : 'text-muted-foreground'
        )}
      >
        <span
          className={cn(
            'flex h-[22px] w-[22px] items-center justify-center rounded-full text-[9px] font-semibold',
            location.pathname.startsWith('/profile') ? 'bg-primary text-primary-foreground' : 'bg-secondary text-foreground'
          )}
        >
          {user?.name ? getInitials(user.name) : 'U'}
        </span>
        {t('topnav.profile')}
      </button>
    </nav>
  );
}

export function Sidebar() {
  const navigate = useNavigate();
  const { sidebarCollapsed, setSidebarCollapsed, sidebarMobileOpen, setSidebarMobileOpen } = useUIStore();
  const { user } = useAuthStore();
  const { activeCompany } = useCompanyStore();
  const { t } = useI18n();

  const [deniedMenuPaths, setDeniedMenuPaths] = useState<Set<string>>(new Set());
  const [openGroup, setOpenGroup] = useState<string | null>(null);

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
      try {
        const res = await administrationService.getMyMenuAccess(activeCompany.id);
        if (!cancelled) {
          setDeniedMenuPaths(new Set(res.deniedMenuPaths || []));
        }
      } catch {
        if (!cancelled) {
          setDeniedMenuPaths(new Set());
        }
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

  const visiblePaths = useMemo(() => {
    const paths = new Set<string>();
    const walk = (items: NavItem[]) => {
      for (const item of items) {
        if (item.path) paths.add(item.path);
        if (item.children) walk(item.children);
      }
    };
    walk(visibleNavItems);
    return paths;
  }, [visibleNavItems]);

  const handleNavigate = useCallback(
    (path: string) => {
      navigate(path);
      setSidebarMobileOpen(false);
    },
    [navigate, setSidebarMobileOpen]
  );

  const handleToggleGroup = useCallback((key: string) => {
    setOpenGroup((current) => (current === key ? null : key));
  }, []);

  const handleExpandSidebar = useCallback(
    (groupKey: string) => {
      setSidebarCollapsed(false);
      setOpenGroup(groupKey);
    },
    [setSidebarCollapsed]
  );

  const navList = (collapsed: boolean) => (
    <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto overflow-x-hidden">
      {!collapsed && (
        <p className="px-3 pb-1 text-[9.5px] font-semibold uppercase tracking-[1px] text-sidebar-muted">Menu</p>
      )}
      {visibleNavItems.map((item) => (
        <NavEntry
          key={item.labelKey}
          item={item}
          collapsed={collapsed}
          isOpen={openGroup === item.labelKey}
          onToggleGroup={handleToggleGroup}
          onNavigate={handleNavigate}
          onExpandSidebar={handleExpandSidebar}
        />
      ))}
    </div>
  );

  const logoHeader = (collapsed: boolean, withClose = false) => (
    <div className={cn('flex flex-none items-center gap-[11px] px-1', collapsed && 'flex-col gap-3')}>
      <div className="flex h-10 w-10 flex-none items-center justify-center rounded-[14px] bg-primary text-[15px] font-semibold text-primary-foreground shadow-primary-btn">
        H
      </div>
      {!collapsed && (
        <div className="min-w-0 flex-1 overflow-hidden">
          <p className="whitespace-nowrap text-[15px] font-semibold tracking-[-0.3px] text-sidebar-foreground">HRIS</p>
          <p className="whitespace-nowrap text-[10.5px] text-sidebar-muted">Enterprise</p>
        </div>
      )}
      {!collapsed && !withClose && (
        <button
          onClick={() => setSidebarCollapsed(true)}
          title={t('sidebar.collapse')}
          aria-label={t('sidebar.collapse')}
          className="flex h-7 w-7 flex-none items-center justify-center rounded-[10px] bg-sidebar-hover text-sidebar-muted transition-colors hover:text-sidebar-foreground"
        >
          <ChevronLeft size={14} />
        </button>
      )}
      {withClose && (
        <button
          onClick={() => setSidebarMobileOpen(false)}
          aria-label="Tutup menu"
          className="flex h-8 w-8 flex-none items-center justify-center rounded-[10px] bg-sidebar-hover text-sidebar-muted"
        >
          <X size={16} />
        </button>
      )}
    </div>
  );

  return (
    <>
      {/* Desktop — panel "Melayang" */}
      <aside
        className={cn(
          'fixed left-0 top-0 z-40 hidden lg:flex',
          'm-[14px] h-[calc(100vh-28px)] flex-col gap-5 overflow-hidden',
          'rounded-[26px] border border-sidebar-border bg-sidebar shadow-float',
          'px-[14px] py-[22px] transition-[width] duration-300 ease-[cubic-bezier(.22,.9,.3,1)]',
          sidebarCollapsed ? 'w-[78px]' : 'w-[246px]'
        )}
      >
        {logoHeader(sidebarCollapsed)}
        {navList(sidebarCollapsed)}
        <SidebarAttendanceCard collapsed={sidebarCollapsed} />
      </aside>

      {/* Mobile — drawer menu lengkap */}
      {sidebarMobileOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 lg:hidden" onClick={() => setSidebarMobileOpen(false)} />
      )}
      <aside
        className={cn(
          'fixed left-0 top-0 z-50 flex h-full w-[268px] flex-col gap-5 bg-sidebar px-[14px] py-[22px]',
          'rounded-r-[26px] border-r border-sidebar-border shadow-float transition-transform duration-300 ease-[cubic-bezier(.22,.9,.3,1)]',
          sidebarMobileOpen ? 'translate-x-0' : '-translate-x-full',
          'lg:hidden'
        )}
      >
        {logoHeader(false, true)}
        {navList(false)}
        <SidebarAttendanceCard collapsed={false} />
      </aside>

      {/* Mobile — bottom nav 5 tujuan utama */}
      <MobileBottomNav visiblePaths={visiblePaths} />
    </>
  );
}
