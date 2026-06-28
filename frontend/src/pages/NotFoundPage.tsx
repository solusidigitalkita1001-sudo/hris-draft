import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/i18n/provider';

export function NotFoundPage() {
  const { t } = useI18n();

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-primary mb-4">404</h1>
        <h2 className="text-xl font-semibold mb-2">{t('error.404.title')}</h2>
        <p className="text-muted-foreground mb-6">
          {t('error.404.description')}
        </p>
        <Link to="/dashboard">
          <Button>{t('error.backToDashboard')}</Button>
        </Link>
      </div>
    </div>
  );
}
