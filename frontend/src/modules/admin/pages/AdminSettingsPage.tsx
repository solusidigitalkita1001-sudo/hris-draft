import { useState } from 'react';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Save } from 'lucide-react';
import { useI18n } from '@/i18n/provider';
import type { TranslationKey } from '@/i18n/translations';

const NOTIFICATION_KEYS: TranslationKey[] = [
  'adm.settings.notif.leaveRequests',
  'adm.settings.notif.approvals',
  'adm.settings.notif.payroll',
  'adm.settings.notif.trainingReminders',
  'adm.settings.notif.contractExpiry',
];

export function AdminSettingsPage() {
  const { t } = useI18n();
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div>
      <PageHeader title={t('adm.settings.title')} description={t('adm.settings.description')}
        actions={
          <Button size="sm" onClick={handleSave}>
            <Save size={16} className="mr-2" /> {saved ? t('adm.settings.saved') : t('adm.settings.saveChanges')}
          </Button>
        }
      />

      <div className="max-w-2xl space-y-6">
        {/* General Settings */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-border p-5">
          <h3 className="text-sm font-medium mb-4">{t('adm.settings.general')}</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-muted-foreground mb-1">{t('adm.settings.companyName')}</label>
              <Input defaultValue="PT. Contoh Perusahaan" className="max-w-md" />
            </div>
            <div>
              <label className="block text-sm text-muted-foreground mb-1">{t('adm.settings.timezone')}</label>
              <Input defaultValue="Asia/Jakarta" className="max-w-md" />
            </div>
            <div>
              <label className="block text-sm text-muted-foreground mb-1">{t('adm.settings.dateFormat')}</label>
              <Input defaultValue="DD/MM/YYYY" className="max-w-md" />
            </div>
            <div>
              <label className="block text-sm text-muted-foreground mb-1">{t('adm.settings.currency')}</label>
              <Input defaultValue="IDR" className="max-w-md" />
            </div>
          </div>
        </div>

        {/* Security Settings */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-border p-5">
          <h3 className="text-sm font-medium mb-4">{t('adm.settings.security')}</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-muted-foreground mb-1">{t('adm.settings.passwordMinLength')}</label>
              <Input type="number" defaultValue="8" className="max-w-[120px]" />
            </div>
            <div>
              <label className="block text-sm text-muted-foreground mb-1">{t('adm.settings.maxLoginAttempts')}</label>
              <Input type="number" defaultValue="5" className="max-w-[120px]" />
            </div>
            <div>
              <label className="block text-sm text-muted-foreground mb-1">{t('adm.settings.sessionTimeout')}</label>
              <Input type="number" defaultValue="60" className="max-w-[120px]" />
            </div>
          </div>
        </div>

        {/* Notification Settings */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-border p-5">
          <h3 className="text-sm font-medium mb-4">{t('adm.settings.notifications')}</h3>
          <div className="space-y-3">
            {NOTIFICATION_KEYS.map((item) => (
              <label key={item} className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" defaultChecked className="rounded border-gray-300 text-primary focus:ring-primary" />
                <span className="text-sm">{t(item)}</span>
              </label>
            ))}
          </div>
        </div>

        <p className="text-xs text-muted-foreground text-center pb-8">
          {t('adm.settings.placeholderNote')}
        </p>
      </div>
    </div>
  );
}
