import { Outlet, Navigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth.store';
import { LanguageSwitcher } from '@/components/shared/LanguageSwitcher';
import { useI18n } from '@/i18n/provider';

/**
 * Layout auth sesuai handoff: grid 4:8 — form di kiri, foto full-bleed +
 * scrim di kanan (hilang di mobile). Switch ID/EN mengambang kanan atas.
 */
export function AuthLayout() {
  const { isAuthenticated } = useAuthStore();
  const { t } = useI18n();

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="min-h-screen bg-background lg:grid lg:grid-cols-3">
      {/* Kiri — form */}
      <div className="relative flex min-h-screen items-center justify-center p-6 lg:col-span-1 lg:min-h-0 lg:p-10">
        <div className="absolute right-5 top-5 lg:hidden">
          <LanguageSwitcher />
        </div>
        <div className="w-full max-w-sm">
          <Outlet />
        </div>
      </div>

      {/* Kanan — foto kantor + scrim */}
      <div className="relative hidden overflow-hidden lg:col-span-2 lg:block">
        <img
          src="/login-cover.jpg"
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(160deg, rgba(10,17,28,.72) 0%, rgba(10,17,28,.35) 45%, rgba(10,17,28,.55) 100%)',
          }}
        />
        <h2 className="absolute left-8 top-8 max-w-md text-balance text-[23px] font-semibold leading-snug tracking-tight text-white">
          {t('auth.cover.headline')}
        </h2>
        <div className="absolute right-8 top-8 flex items-center gap-3">
          <span className="flex items-center gap-2 rounded-full bg-white/15 px-3 py-1.5 text-xs font-medium text-white backdrop-blur-md">
            <span className="anim-pulse-dot h-2 w-2 rounded-full bg-[#4ADE80]" aria-hidden="true" />
            {t('auth.cover.serverActive')}
          </span>
          <LanguageSwitcher className="border-white/20 bg-white/15 backdrop-blur-md" />
        </div>
      </div>
    </div>
  );
}
