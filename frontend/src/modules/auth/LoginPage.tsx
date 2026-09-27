import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Link } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth.store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useI18n } from '@/i18n/provider';
import { Loader2, Eye, EyeOff, AlertCircle, Check, TimerReset } from 'lucide-react';
import { apiErrorMessage } from '@/lib/errors';
import { cn } from '@/utils/cn';

const REMEMBER_KEY = 'hris-login-email';

export function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login, isLoading } = useAuthStore();
  const { t } = useI18n();

  // Alasan terlempar ke login (dari IdleLogoutGuard / kegagalan refresh sesi).
  const reason = searchParams.get('reason');
  const sessionNotice =
    reason === 'idle' ? t('idle.expired') : reason === 'expired' ? t('login.notice.expired') : null;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [succeeded, setSucceeded] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(REMEMBER_KEY);
    if (saved) {
      setEmail(saved);
      setRemember(true);
    }
  }, []);

  useEffect(() => {
    if (!succeeded) return;
    const timer = window.setTimeout(() => navigate('/dashboard', { replace: true }), 950);
    return () => window.clearTimeout(timer);
  }, [succeeded, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email.trim()) {
      setError(t('auth.login.emailRequired'));
      return;
    }

    if (!password) {
      setError(t('auth.login.passwordRequired'));
      return;
    }

    try {
      await login(email.trim(), password);
      if (remember) {
        localStorage.setItem(REMEMBER_KEY, email.trim());
      } else {
        localStorage.removeItem(REMEMBER_KEY);
      }
      setSucceeded(true);
    } catch (err) {
      setError(apiErrorMessage(err, t('auth.login.failed')));
    }
  };

  return (
    <div className="relative">
      {/* Overlay sukses: centang hijau pop + ring + progress */}
      {succeeded && (
        <div
          className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 rounded-card bg-background/95"
          role="status"
          aria-live="polite"
        >
          <div className="relative flex h-[74px] w-[74px] items-center justify-center">
            <span className="anim-login-ring absolute inset-0 rounded-full border-2 border-[#4ADE80]" aria-hidden="true" />
            <span className="anim-login-pop flex h-full w-full items-center justify-center rounded-full bg-[#4ADE80]">
              <Check size={36} strokeWidth={3} className="text-white" aria-hidden="true" />
            </span>
          </div>
          <div className="text-center">
            <p className="text-base font-semibold">{t('auth.login.overlayTitle')}</p>
            <p className="mt-1 text-sm text-muted-foreground">{t('auth.login.overlaySubtitle')}</p>
          </div>
          <div className="h-1 w-36 overflow-hidden rounded-full bg-muted">
            <div className="anim-login-progress h-full rounded-full bg-primary" />
          </div>
        </div>
      )}

      <div className={cn('transition-all duration-300', succeeded && 'scale-[0.97] opacity-20')}>
        {/* Logo + identitas */}
        <div className="mb-8 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-[14px] bg-primary shadow-primary-btn">
            <span className="text-base font-semibold text-primary-foreground">H</span>
          </div>
          <div>
            <p className="text-sm font-semibold leading-tight">HRIS Enterprise</p>
            <p className="text-xs leading-tight text-muted-foreground">Portal karyawan</p>
          </div>
        </div>

        <h1 className="text-balance text-[26px] font-semibold tracking-[-1px] text-foreground">
          {t('auth.login.title')}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('auth.login.description')}</p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-5" noValidate>
          {sessionNotice && !error && (
            <div
              className="flex items-start gap-2.5 rounded-field border border-warning/25 bg-warning-bg p-3 text-sm text-warning"
              role="status"
            >
              <TimerReset size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
              <span>{sessionNotice}</span>
            </div>
          )}
          {error && (
            <div className="flex items-center gap-2 rounded-field border border-danger/20 bg-danger-bg p-3 text-sm text-danger" role="alert">
              <AlertCircle size={16} className="shrink-0" aria-hidden="true" />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-1.5">
            <label
              htmlFor="email"
              className="text-[9.5px] font-semibold uppercase tracking-[1px] text-muted-foreground"
            >
              {t('auth.login.email')}
            </label>
            <Input
              id="email"
              type="email"
              placeholder="nama@perusahaan.com"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setError(null);
              }}
              autoComplete="email"
              autoFocus
              disabled={isLoading || succeeded}
              className="h-[54px] rounded-[18px] px-4"
            />
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="password"
              className="text-[9.5px] font-semibold uppercase tracking-[1px] text-muted-foreground"
            >
              {t('auth.login.password')}
            </label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder={t('auth.login.passwordPlaceholder')}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError(null);
                }}
                autoComplete="current-password"
                disabled={isLoading || succeeded}
                className="h-[54px] rounded-[18px] px-4 pr-12"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-1 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-[14px] text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label={showPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
                aria-pressed={showPassword}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <button
              type="button"
              role="switch"
              aria-checked={remember}
              onClick={() => setRemember(!remember)}
              className="flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              <span
                className={cn(
                  'relative inline-flex h-5 w-[34px] shrink-0 rounded-full transition-colors',
                  remember ? 'bg-primary' : 'bg-muted'
                )}
                aria-hidden="true"
              >
                <span
                  className={cn(
                    'absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-card transition-transform duration-200',
                    remember ? 'translate-x-[15px]' : 'translate-x-0.5'
                  )}
                />
              </span>
              {t('auth.login.remember')}
            </button>
            <Link to="/forgot-password" className="text-sm font-medium text-primary hover:underline">
              {t('auth.login.forgotPassword')}
            </Link>
          </div>

          <Button
            type="submit"
            className="h-[54px] w-full rounded-[18px] text-[15px]"
            disabled={isLoading || succeeded}
          >
            {isLoading ? (
              <>
                <Loader2 size={17} className="mr-2 animate-spin" aria-hidden="true" />
                {t('auth.login.verifying')}
              </>
            ) : (
              t('auth.login.submit')
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}
