import { cn } from '@/utils/cn';
import { useI18n } from '@/i18n/provider';
import type { Language } from '@/i18n/translations';

export function LanguageSwitcher({ compact = false, className }: { compact?: boolean; className?: string }) {
  const { language, setLanguage, t } = useI18n();

  const languages: Array<{ code: Language; label: string }> = [
    { code: 'id', label: 'ID' },
    { code: 'en', label: 'EN' },
  ];

  return (
    <div
      className={cn(
        'inline-flex items-center rounded-md border border-border bg-background p-1',
        compact ? 'gap-1' : 'gap-2',
        className
      )}
      aria-label={t('common.language')}
    >
      {!compact && <span className="px-2 text-xs text-muted-foreground">{t('common.language')}</span>}
      {languages.map((item) => (
        <button
          key={item.code}
          type="button"
          onClick={() => setLanguage(item.code)}
          className={cn(
            'rounded px-2.5 py-1 text-xs font-medium transition-colors',
            language === item.code
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:bg-muted hover:text-foreground'
          )}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
