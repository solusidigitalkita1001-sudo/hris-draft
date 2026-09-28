import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useI18n } from '@/i18n/provider';
import { ArrowLeft, AlertCircle, Loader2, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { authService } from '@/services/auth.service';
import { apiErrorMessage } from '@/lib/errors';
import toast from 'react-hot-toast';

export function ResetPasswordPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!password) {
      setError(t('auth.login.passwordRequired'));
      return;
    }
    if (password !== confirm) {
      setError(t('auth.reset.mismatch'));
      return;
    }
    setSaving(true);
    try {
      await authService.resetPassword(token, password);
      toast.success(t('auth.reset.success'));
      navigate('/login', { replace: true });
    } catch (err) {
      setError(apiErrorMessage(err, t('auth.reset.failed')));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <Link
        to="/login"
        className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft size={16} aria-hidden="true" />
        {t('auth.forgot.back')}
      </Link>

      <h1 className="text-balance text-[26px] font-semibold tracking-[-1px]">{t('auth.reset.title')}</h1>

      {!token ? (
        <div className="mt-6 flex items-start gap-3 rounded-card-sm border border-warning/20 bg-warning-bg p-4 text-sm text-warning" role="alert">
          <AlertCircle size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
          <p>{t('auth.reset.invalidToken')}</p>
        </div>
      ) : (
        <>
          <p className="mt-1 text-sm text-muted-foreground">{t('auth.reset.description')}</p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-5" noValidate>
            {error && (
              <div className="flex items-center gap-2 rounded-field border border-danger/20 bg-danger-bg p-3 text-sm text-danger" role="alert">
                <AlertCircle size={16} className="shrink-0" aria-hidden="true" />
                <span>{error}</span>
              </div>
            )}

            <div className="space-y-1.5">
              <label
                htmlFor="reset-password"
                className="text-[9.5px] font-semibold uppercase tracking-[1px] text-muted-foreground"
              >
                {t('auth.reset.password')}
              </label>
              <div className="relative">
                <Input
                  id="reset-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setError(null);
                  }}
                  autoComplete="new-password"
                  autoFocus
                  disabled={saving}
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

            <div className="space-y-1.5">
              <label
                htmlFor="reset-confirm"
                className="text-[9.5px] font-semibold uppercase tracking-[1px] text-muted-foreground"
              >
                {t('auth.reset.confirm')}
              </label>
              <Input
                id="reset-confirm"
                type={showPassword ? 'text' : 'password'}
                value={confirm}
                onChange={(e) => {
                  setConfirm(e.target.value);
                  setError(null);
                }}
                autoComplete="new-password"
                disabled={saving}
                className="h-[54px] rounded-[18px] px-4"
              />
            </div>

            <Button type="submit" className="h-[54px] w-full rounded-[18px] text-[15px]" disabled={saving}>
              {saving ? (
                <>
                  <Loader2 size={17} className="mr-2 animate-spin" aria-hidden="true" />
                  {t('auth.reset.submitting')}
                </>
              ) : (
                t('auth.reset.submit')
              )}
            </Button>
          </form>
        </>
      )}
    </div>
  );
}
