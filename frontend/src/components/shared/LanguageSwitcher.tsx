import { cn } from '@/utils/cn';
import { useI18n } from '@/i18n/provider';

/**
 * Switch bilingual ID/EN sesuai handoff: track pill dengan knob yang
 * meluncur (.28s cubic-bezier(.22,.9,.3,1)).
 */
export function LanguageSwitcher({ className }: { compact?: boolean; className?: string }) {
  const { language, setLanguage, t } = useI18n();
  const isEn = language === 'en';

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isEn}
      aria-label={t('common.language')}
      onClick={() => setLanguage(isEn ? 'id' : 'en')}
      className={cn(
        'relative inline-flex h-8 w-[76px] shrink-0 items-center rounded-full border border-border bg-muted text-[11px] font-semibold',
        className
      )}
    >
      <span
        aria-hidden="true"
        className="absolute top-0.5 h-[26px] w-[34px] rounded-full bg-card shadow-card transition-transform duration-[280ms] ease-[cubic-bezier(.22,.9,.3,1)]"
        style={{ transform: isEn ? 'translateX(38px)' : 'translateX(3px)' }}
      />
      <span className={cn('relative z-10 flex-1 text-center transition-colors', !isEn ? 'text-foreground' : 'text-muted-foreground')}>
        ID
      </span>
      <span className={cn('relative z-10 flex-1 text-center transition-colors', isEn ? 'text-foreground' : 'text-muted-foreground')}>
        EN
      </span>
    </button>
  );
}
