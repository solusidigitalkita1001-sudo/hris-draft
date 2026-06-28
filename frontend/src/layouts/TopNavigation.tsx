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
import { Bell, Moon, Sun, Menu, ChevronDown, LogOut, User, Settings } from 'lucide-react';
import { organizationService, type Company } from '@/services/organization.service';

export function TopNavigation() {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const { theme, toggleTheme, setSidebarMobileOpen } = useUIStore();
  const { activeCompany, setActiveCompany, setCompanies: setStoredCompanies } = useCompanyStore();
  const { t } = useI18n();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showCompanySwitcher, setShowCompanySwitcher] = useState(false);
  const [companies, setCompanyOptions] = useState<Company[]>([]);
  const canOpenSettings = canAccess(user, {
    requireAuth: true,
    requiredPermissions: [{ resource: 'settings', action: 'read' }],
    requiredRoles: ADMIN_ROLES,
  });

  const handleLogout = useCallback(async () => {
    await logout();
    window.location.href = '/login';
  }, [logout]);

  const openCompanySwitcher = useCallback(async () => {
    setShowCompanySwitcher(true);
    try {
      const data = await organizationService.getCompanies();
      setStoredCompanies(data);
      setCompanyOptions(data);
    } catch {
      // silent
    }
  }, [setStoredCompanies]);

  useEffect(() => {
    let cancelled = false;

    const bootstrapActiveCompany = async () => {
      if (!user || activeCompany) return;

      try {
        const data = await organizationService.getCompanies();
        if (cancelled || !data.length) return;
        const previousCompanyId = localStorage.getItem('companyId');

        setStoredCompanies(data);
        setCompanyOptions(data);

        const scopedCompany =
          data.find((company) => company.id === user.companyId) ||
          data.find((company) => company.id === localStorage.getItem('companyId')) ||
          data[0];

        if (!scopedCompany) return;

        setActiveCompany(scopedCompany);

        if (previousCompanyId !== scopedCompany.id) {
          window.location.reload();
        }
      } catch {
        // silent
      }
    };

    bootstrapActiveCompany();

    return () => {
      cancelled = true;
    };
  }, [activeCompany, setActiveCompany, setStoredCompanies, user]);

  const switchCompany = useCallback(
    (company: Company) => {
      setActiveCompany(company);
      setShowCompanySwitcher(false);
      // Refresh page to reload scope
      window.location.reload();
    },
    [setActiveCompany]
  );

  return (
    <header className="h-16 border-b border-border bg-background sticky top-0 z-30">
      <div className="flex items-center justify-between h-full px-4 lg:px-6">
        {/* Left side */}
        <div className="flex items-center gap-4">
          {/* Mobile menu button */}
          <button
            className="lg:hidden p-2 hover:bg-muted rounded-md"
            onClick={() => setSidebarMobileOpen(true)}
          >
            <Menu size={20} />
          </button>

          {/* Breadcrumb placeholder */}
          <div className="hidden sm:flex items-center text-sm text-muted-foreground">
            {/* Dynamic breadcrumb will go here */}
          </div>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-2">
          {/* Company Switcher */}
          {activeCompany && (
            <button
              onClick={openCompanySwitcher}
              className="flex items-center gap-2 px-3 py-1.5 text-sm border border-border rounded-md hover:bg-muted transition-colors"
            >
              <div className="w-5 h-5 rounded bg-primary/10 flex items-center justify-center">
                <span className="text-[10px] font-bold text-primary">
                  {getInitials(activeCompany.name)}
                </span>
              </div>
              <span className="hidden sm:inline max-w-[120px] truncate">
                {activeCompany.name}
              </span>
              <ChevronDown size={14} className="text-muted-foreground" />
            </button>
          )}

          {/* Theme toggle */}
          <LanguageSwitcher compact />

          <button
            onClick={toggleTheme}
            className="p-2 hover:bg-muted rounded-md transition-colors"
            title={theme === 'light' ? t('topnav.theme.switchToDark') : t('topnav.theme.switchToLight')}
          >
            {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
          </button>

          {/* Notifications */}
          <button
            className="relative p-2 hover:bg-muted rounded-md transition-colors"
            onClick={() => navigate('/notifications')}
          >
            <Bell size={18} />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-destructive rounded-full" />
          </button>

          {/* User menu */}
          <div className="relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-2 px-2 py-1.5 hover:bg-muted rounded-md transition-colors"
            >
              <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center">
                <span className="text-xs font-medium text-primary">
                  {user?.name ? getInitials(user.name) : 'U'}
                </span>
              </div>
              <div className="hidden md:block text-left">
                <p className="text-sm font-medium leading-tight">{user?.name || user?.email}</p>
                <p className="text-[11px] text-muted-foreground leading-tight">
                  {user?.roles?.[0]?.replace(/_/g, ' ').toLowerCase()}
                </p>
              </div>
              <ChevronDown size={14} className="text-muted-foreground" />
            </button>

            {showUserMenu && (
              <>
                <div
                  className="fixed inset-0 z-50"
                  onClick={() => setShowUserMenu(false)}
                />
                <div className="absolute right-0 top-full mt-1 w-56 bg-card border border-border rounded-lg shadow-lg z-50 py-1">
                  <div className="px-3 py-2 border-b border-border">
                    <p className="text-sm font-medium">{user?.name || t('topnav.userFallback')}</p>
                    <p className="text-xs text-muted-foreground">{user?.email}</p>
                  </div>
                  <button
                    onClick={() => { navigate('/profile'); setShowUserMenu(false); }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted transition-colors"
                  >
                    <User size={16} />
                    {t('topnav.profile')}
                  </button>
                  {canOpenSettings && (
                    <button
                      onClick={() => { navigate('/admin/settings'); setShowUserMenu(false); }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted transition-colors"
                    >
                      <Settings size={16} />
                      {t('topnav.settings')}
                    </button>
                  )}
                  <hr className="border-border my-1" />
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-destructive hover:bg-destructive/10 transition-colors"
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
          <div className="relative w-full max-w-md bg-card border border-border rounded-lg shadow-lg">
            <div className="p-4 border-b border-border">
              <h3 className="font-semibold">{t('topnav.companySwitcher.title')}</h3>
              <p className="text-sm text-muted-foreground mt-1">
                {t('topnav.companySwitcher.description')}
              </p>
            </div>
            <div className="p-2 max-h-80 overflow-y-auto">
              {companies.map((company) => (
                <button
                  key={company.id}
                  onClick={() => switchCompany(company)}
                  className={cn(
                    'w-full flex items-center gap-3 px-3 py-3 rounded-md text-sm transition-colors',
                    activeCompany?.id === company.id
                      ? 'bg-primary/10 text-primary'
                      : 'hover:bg-muted'
                  )}
                >
                  <div className="w-8 h-8 rounded bg-primary/10 flex items-center justify-center">
                    <span className="text-xs font-bold text-primary">
                      {getInitials(company.name)}
                    </span>
                  </div>
                  <div className="text-left">
                    <p className="font-medium">{company.name}</p>
                    <p className="text-xs text-muted-foreground">{company.code}</p>
                  </div>
                  {activeCompany?.id === company.id && (
                    <span className="ml-auto text-xs text-primary font-medium">{t('topnav.companySwitcher.active')}</span>
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
