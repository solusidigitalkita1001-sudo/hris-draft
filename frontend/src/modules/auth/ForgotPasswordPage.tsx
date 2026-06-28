import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useI18n } from '@/i18n/provider';
import { ArrowLeft, Loader2, Mail, CheckCircle2, AlertCircle } from 'lucide-react';

export function ForgotPasswordPage() {
  const { t } = useI18n();
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email.trim()) {
      setError(t('auth.forgot.emailRequired'));
      return;
    }

    setIsSubmitting(true);

    // Simulate API call
    try {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      setIsSubmitted(true);
    } catch {
      setError(t('auth.forgot.failed'));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSubmitted) {
    return (
      <div className="text-center">
        <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle2 size={24} className="text-primary" />
        </div>
        <h1 className="text-xl font-semibold mb-2">{t('auth.forgot.successTitle')}</h1>
        <p className="text-sm text-muted-foreground mb-6">
          {t('auth.forgot.successDescription', { email })}
        </p>
        <Link
          to="/login"
          className="text-sm text-primary hover:text-primary/80 transition-colors"
        >
          {t('auth.forgot.back')}
        </Link>
      </div>
    );
  }

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
        {t('auth.forgot.description')}
      </p>

      <form onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <div className="flex items-center gap-2 p-3 text-sm bg-destructive/10 text-destructive rounded-md border border-destructive/20">
            <AlertCircle size={16} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="reset-email">{t('auth.login.email')}</Label>
          <div className="relative">
            <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="reset-email"
              type="email"
              placeholder="name@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-10 pl-10"
              autoFocus
            />
          </div>
        </div>

        <Button type="submit" className="w-full h-10" disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <Loader2 size={16} className="animate-spin mr-2" />
              {t('auth.forgot.sending')}
            </>
          ) : (
            t('auth.forgot.send')
          )}
        </Button>
      </form>
    </div>
  );
}
