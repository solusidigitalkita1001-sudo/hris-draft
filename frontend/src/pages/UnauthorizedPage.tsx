import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/i18n/provider';

export function UnauthorizedPage() {
  const { t } = useI18n();

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-destructive mb-4">403</h1>
        <h2 className="text-xl font-semibold mb-2">{t('error.403.title')}</h2>
        <p className="text-muted-foreground mb-6">
          {t('error.403.description')}
        </p>
        <Link to="/dashboard">
          <Button>{t('error.backToDashboard')}</Button>
        </Link>
      </div>
    </div>
  );
}
