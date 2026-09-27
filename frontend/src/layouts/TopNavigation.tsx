import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth.store';
import { useUIStore } from '@/stores/ui.store';
import { useCompanyStore } from '@/stores/company.store';
import { ADMIN_ROLES, canAccess } from '@/lib/access-control';
import { LanguageSwitcher } from '@/components/shared/LanguageSwitcher';
import { useI18n } from '@/i18n/provider';
import { cn } from '@/utils/cn';
import { getInitials } from '@/utils/format';
import { Bell, Menu, ChevronDown, LogOut, User, Settings, Sun, Moon, Building } from 'lucide-react';
import { organizationService, type Company } from '@/services/organization.service';
import { notificationService } from '@/services/notification.service';

export function TopNavigation() {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const { theme, setTheme, sidebarCollapsed, setSidebarMobileOpen, setSidebarCollapsed } = useUIStore();
  const { activeCompanyId, activeCompany, setActiveCompany, setCompanies: setStoredCompanies } = useCompanyStore();
  const { t } = useI18n();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showCompanySwitcher, setShowCompanySwitcher] = useState(false);
  const [companies, setCompanyOptions] = useState<Company[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const isDark = theme === 'dark';
  const canOpenSettings = canAccess(user, {
    requireAuth: true,
    requiredPermissions: [{ resource: 'settings', action: 'read' }],
    requiredRoles: ADMIN_ROLES,
  });

  const getScopedCompanies = useCallback(
    (items: Company[]) => {
      if (!user?.companyScope?.length) return items;
      const allowed = new Set(user.companyScope);
      return items.filter((company) => allowed.has(company.id));
    },
    [user?.companyScope]
  );

  const handleLogout = useCallback(async () => {
    await logout();
    window.location.href = '/login';
  }, [logout]);

  const openCompanySwitcher = useCallback(async () => {
    setShowCompanySwitcher(true);
    try {
      const data = await organizationService.getCompanies();
      const scopedCompanies = getScopedCompanies(data);
      setStoredCompanies(scopedCompanies);
      setCompanyOptions(scopedCompanies);
    } catch {
      // silent
    }
  }, [getScopedCompanies, setStoredCompanies]);

  useEffect(() => {
    let cancelled = false;

    const bootstrapActiveCompany = async () => {
      if (!user) return;

      try {
        const data = await organizationService.getCompanies();
        const scopedCompanies = getScopedCompanies(data);
        if (cancelled || !scopedCompanies.length) return;

        setStoredCompanies(scopedCompanies);
        setCompanyOptions(scopedCompanies);

        const scopedCompany =
          scopedCompanies.find((company) => company.id === activeCompanyId) ||
          scopedCompanies.find((company) => company.id === user.companyId) ||
          scopedCompanies[0];

        if (!scopedCompany) return;

        if (activeCompanyId !== scopedCompany.id) {
          setActiveCompany(scopedCompany);
        }
      } catch {
        // silent
      }
    };

    bootstrapActiveCompany();

    return () => {
      cancelled = true;
    };
  }, [activeCompanyId, getScopedCompanies, setActiveCompany, setStoredCompanies, user]);

  useEffect(() => {
    let cancelled = false;
    if (!user || !activeCompanyId) {
      setUnreadCount(0);
      return;
    }
    notificationService
      .getUnreadCount()
      .then((result) => {
        if (!cancelled) setUnreadCount(Number(result?.count) || 0);
      })
      .catch(() => {
        if (!cancelled) setUnreadCount(0);
      });
    return () => {
      cancelled = true;
    };
  }, [user, activeCompanyId]);

  const switchCompany = useCallback(
    (company: Company) => {
      setActiveCompany(company);
      setShowCompanySwitcher(false);
    },
    [setActiveCompany]
  );

  // Tampilkan role dengan wewenang tertinggi, bukan urutan array dari server.
  const ROLE_PRECEDENCE = ['SUPER_ADMIN', 'GROUP_ADMIN', 'COMPANY_ADMIN', 'HR_MANAGER', 'HR_STAFF', 'MANAGER', 'EMPLOYEE'];
  const topRole = ROLE_PRECEDENCE.find((role) => user?.roles?.includes(role)) ?? user?.roles?.[0];
  const roleLabel = topRole?.replace(/_/g, ' ').toLowerCase();

  return (
    <header className="topbar-blur sticky top-0 z-30">
      <div className="flex h-16 items-center justify-between gap-2 px-4 lg:px-6">
        {/* Kiri: hamburger + chip perusahaan */}
        <div className="flex min-w-0 items-center gap-2">
          <button
            className="rounded-[13px] p-2 transition-colors hover:bg-secondary lg:hidden"
            onClick={() => setSidebarMobileOpen(true)}
            aria-label="Buka menu"
          >
            <Menu size={20} />
          </button>
          {sidebarCollapsed && (
            <button
              className="hidden rounded-[13px] p-2 transition-colors hover:bg-secondary lg:inline-flex"
              onClick={() => setSidebarCollapsed(false)}
              aria-label="Buka sidebar"
            >
              <Menu size={18} />
            </button>
          )}

          {activeCompany && (
            <button
              onClick={openCompanySwitcher}
              className="flex min-w-0 items-center gap-2 rounded-full border border-border bg-card py-1.5 pl-1.5 pr-3 text-sm shadow-card transition-colors hover:bg-secondary"
            >
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent">
                <Building size={13} className="text-primary" aria-hidden="true" />
              </span>
              <span className="hidden max-w-[160px] truncate font-medium sm:inline">{activeCompany.name}</span>
              <ChevronDown size={14} className="shrink-0 text-muted-foreground" aria-hidden="true" />
            </button>
          )}
        </div>

        {/* Kanan: tema, bahasa, notifikasi, chip user */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setTheme(isDark ? 'light' : 'dark')}
            className="rounded-[13px] border border-border bg-card p-2 shadow-card transition-colors hover:bg-secondary"
            aria-label={isDark ? 'Ganti ke tema terang' : 'Ganti ke tema gelap'}
            title={isDark ? 'Tema terang' : 'Tema gelap'}
          >
            {isDark ? <Sun size={16} /> : <Moon size={16} />}
          </button>

          <LanguageSwitcher className="hidden sm:inline-flex" />

          <button
            className="relative rounded-[13px] border border-border bg-card p-2 shadow-card transition-colors hover:bg-secondary"
            onClick={() => navigate('/notifications')}
            aria-label={unreadCount > 0 ? `Notifikasi, ${unreadCount} belum dibaca` : 'Notifikasi'}
          >
            <Bell size={16} />
            {unreadCount > 0 && (
              <span className="absolute -right-1 -top-1 flex h-[17px] min-w-[17px] items-center justify-center rounded-full border-2 border-background bg-[#EF4444] px-0.5 text-[9px] font-semibold text-white">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {/* Chip user */}
          <div className="relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-2 rounded-full border border-border bg-card py-1 pl-1 pr-2.5 shadow-card transition-colors hover:bg-secondary"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                {user?.name ? getInitials(user.name) : 'U'}
              </span>
              <span className="hidden text-left md:block">
                <span className="block text-sm font-medium leading-tight">{user?.name || user?.email}</span>
                <span className="block text-[11px] capitalize leading-tight text-muted-foreground">{roleLabel}</span>
              </span>
              <ChevronDown size={14} className="hidden text-muted-foreground md:block" aria-hidden="true" />
            </button>

            {showUserMenu && (
              <>
                <div className="fixed inset-0 z-50" onClick={() => setShowUserMenu(false)} />
                <div className="absolute right-0 top-full z-50 mt-2 w-56 rounded-card-sm border border-border bg-card py-1 shadow-float">
                  <div className="border-b border-border px-3 py-2">
                    <p className="text-sm font-medium">{user?.name || t('topnav.userFallback')}</p>
                    <p className="text-xs text-muted-foreground">{user?.email}</p>
                  </div>
                  <button
                    onClick={() => { navigate('/profile'); setShowUserMenu(false); }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-sm transition-colors hover:bg-secondary"
                  >
                    <User size={16} />
                    {t('topnav.profile')}
                  </button>
                  {canOpenSettings && (
                    <button
                      onClick={() => { navigate('/admin/settings'); setShowUserMenu(false); }}
                      className="flex w-full items-center gap-2 px-3 py-2 text-sm transition-colors hover:bg-secondary"
                    >
                      <Settings size={16} />
                      {t('topnav.settings')}
                    </button>
                  )}
                  <hr className="my-1 border-border" />
                  <button
                    onClick={handleLogout}
                    className="flex w-full items-center gap-2 px-3 py-2 text-sm text-[#EF4444] transition-colors hover:bg-danger-bg"
                  >
                    <LogOut size={16} />
                    {t('topnav.signOut')}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Company Switcher Modal */}
      {showCompanySwitcher && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-20">
          <div className="fixed inset-0 bg-black/50" onClick={() => setShowCompanySwitcher(false)} />
          <div className="relative w-full max-w-md rounded-card border border-border bg-card shadow-float">
            <div className="border-b border-border p-4">
              <h3 className="font-semibold">{t('topnav.companySwitcher.title')}</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {t('topnav.companySwitcher.description')}
              </p>
            </div>
            <div className="max-h-80 overflow-y-auto p-2">
              {companies.map((company) => (
                <button
                  key={company.id}
                  onClick={() => switchCompany(company)}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-field px-3 py-3 text-sm transition-colors',
                    activeCompany?.id === company.id ? 'bg-accent text-primary' : 'hover:bg-secondary'
                  )}
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent">
                    <span className="text-xs font-semibold text-primary">{getInitials(company.name)}</span>
                  </div>
                  <div className="text-left">
                    <p className="font-medium">{company.name}</p>
                    <p className="text-xs text-muted-foreground">{company.code}</p>
                  </div>
                  {activeCompany?.id === company.id && (
                    <span className="ml-auto text-xs font-medium text-primary">{t('topnav.companySwitcher.active')}</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
