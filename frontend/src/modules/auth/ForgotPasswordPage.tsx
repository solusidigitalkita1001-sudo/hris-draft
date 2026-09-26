import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '@/i18n/provider';
import { ArrowLeft, AlertCircle, MailCheck, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { authService } from '@/services/auth.service';
import { apiErrorMessage } from '@/lib/errors';

export function ForgotPasswordPage() {
  const { t } = useI18n();
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email.trim()) {
      setError(t('auth.forgot.emailRequired'));
      return;
    }
    setSending(true);
    try {
      await authService.forgotPassword(email.trim());
      setSent(true);
    } catch (err) {
      setError(apiErrorMessage(err, t('auth.forgot.failed')));
    } finally {
      setSending(false);
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

      <h1 className="text-balance text-[26px] font-semibold tracking-[-1px]">{t('auth.forgot.title')}</h1>

      {sent ? (
        <div className="mt-6 flex items-start gap-3 rounded-card-sm border border-success/20 bg-success-bg p-4 text-sm text-success" role="status">
          <MailCheck size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
          <div>
            <p className="font-semibold">{t('auth.forgot.successTitle')}</p>
            <p className="mt-1">{t('auth.forgot.successDescription', { email: email.trim() })}</p>
          </div>
        </div>
      ) : (
        <>
          <p className="mt-1 text-sm text-muted-foreground">{t('auth.forgot.description')}</p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-5" noValidate>
            {error && (
              <div className="flex items-center gap-2 rounded-field border border-danger/20 bg-danger-bg p-3 text-sm text-danger" role="alert">
                <AlertCircle size={16} className="shrink-0" aria-hidden="true" />
                <span>{error}</span>
              </div>
            )}

            <div className="space-y-1.5">
              <label
                htmlFor="forgot-email"
                className="text-[9.5px] font-semibold uppercase tracking-[1px] text-muted-foreground"
              >
                {t('auth.login.email')}
              </label>
              <Input
                id="forgot-email"
                type="email"
                placeholder="nama@perusahaan.com"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setError(null);
                }}
                autoComplete="email"
                autoFocus
                disabled={sending}
                className="h-[54px] rounded-[18px] px-4"
              />
            </div>

            <Button type="submit" className="h-[54px] w-full rounded-[18px] text-[15px]" disabled={sending}>
              {sending ? (
                <>
                  <Loader2 size={17} className="mr-2 animate-spin" aria-hidden="true" />
                  {t('auth.forgot.sending')}
                </>
              ) : (
                t('auth.forgot.send')
              )}
            </Button>
          </form>
        </>
      )}
    </div>
  );
}
