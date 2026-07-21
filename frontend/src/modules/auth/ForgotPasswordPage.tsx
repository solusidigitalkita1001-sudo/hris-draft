import { Link } from 'react-router-dom';
import { useI18n } from '@/i18n/provider';
import { ArrowLeft, AlertCircle } from 'lucide-react';

export function ForgotPasswordPage() {
  const { t } = useI18n();

  return (
    <div>
      <Link
        to="/login"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
      >
        <ArrowLeft size={16} />
        {t('auth.forgot.back')}
      </Link>

      <h1 className="text-2xl font-semibold mb-2">{t('auth.forgot.title')}</h1>
      <p className="text-sm text-muted-foreground mb-6">
        Reset password belum diaktifkan di build ini.
      </p>

      <div className="flex items-start gap-3 rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
        <AlertCircle size={16} className="mt-0.5 shrink-0" />
        <div className="space-y-1">
          <p>Flow reset password publik belum tersedia di backend.</p>
          <p className="text-amber-800/80 dark:text-amber-200/80">
            Hubungi administrator atau gunakan menu ubah password setelah login.
          </p>
        </div>
      </div>
    </div>
  );
}
