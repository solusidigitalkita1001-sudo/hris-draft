import { Outlet, Navigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth.store';
import { LanguageSwitcher } from '@/components/shared/LanguageSwitcher';
import { useI18n } from '@/i18n/provider';

export function AuthLayout() {
  const { isAuthenticated } = useAuthStore();
  const { t } = useI18n();

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="min-h-screen bg-background flex">
      {/* Left side - branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-primary relative items-center justify-center">
        <div className="max-w-md text-primary-foreground">
          <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center mb-6">
            <span className="text-xl font-bold">H</span>
          </div>
          <h1 className="text-3xl font-bold mb-3">HRMS Enterprise</h1>
          <p className="text-primary-foreground/80 text-lg leading-relaxed">
            {t('auth.layout.description')}
          </p>
          <div className="mt-8 space-y-4">
            {[
              t('auth.layout.feature.multiCompany'),
              t('auth.layout.feature.employeeLifecycle'),
              t('auth.layout.feature.analytics'),
              t('auth.layout.feature.security'),
            ].map((feature, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center">
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <span className="text-sm text-primary-foreground/80">{feature}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right side - form */}
      <div className="relative flex-1 flex items-center justify-center p-8">
        <div className="absolute right-6 top-6">
          <LanguageSwitcher compact />
        </div>
        <div className="w-full max-w-sm">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
