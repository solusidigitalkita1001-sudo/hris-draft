import { useState } from 'react';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Save } from 'lucide-react';

export function AdminSettingsPage() {
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div>
      <PageHeader title="Settings" description="System configuration"
        actions={
          <Button size="sm" onClick={handleSave}>
            <Save size={16} className="mr-2" /> {saved ? 'Saved!' : 'Save Changes'}
          </Button>
        }
      />

      <div className="max-w-2xl space-y-6">
        {/* General Settings */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-border p-5">
          <h3 className="text-sm font-medium mb-4">General</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-muted-foreground mb-1">Company Name</label>
              <Input defaultValue="PT. Contoh Perusahaan" className="max-w-md" />
            </div>
            <div>
              <label className="block text-sm text-muted-foreground mb-1">Timezone</label>
              <Input defaultValue="Asia/Jakarta" className="max-w-md" />
            </div>
            <div>
              <label className="block text-sm text-muted-foreground mb-1">Date Format</label>
              <Input defaultValue="DD/MM/YYYY" className="max-w-md" />
            </div>
            <div>
              <label className="block text-sm text-muted-foreground mb-1">Currency</label>
              <Input defaultValue="IDR" className="max-w-md" />
            </div>
          </div>
        </div>

        {/* Security Settings */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-border p-5">
          <h3 className="text-sm font-medium mb-4">Security</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-muted-foreground mb-1">Password Min Length</label>
              <Input type="number" defaultValue="8" className="max-w-[120px]" />
            </div>
            <div>
              <label className="block text-sm text-muted-foreground mb-1">Max Login Attempts</label>
              <Input type="number" defaultValue="5" className="max-w-[120px]" />
            </div>
            <div>
              <label className="block text-sm text-muted-foreground mb-1">Session Timeout (minutes)</label>
              <Input type="number" defaultValue="60" className="max-w-[120px]" />
            </div>
          </div>
        </div>

        {/* Notification Settings */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-border p-5">
          <h3 className="text-sm font-medium mb-4">Notifications</h3>
          <div className="space-y-3">
            {['Leave Requests', 'Approvals', 'Payroll', 'Training Reminders', 'Contract Expiry'].map((item) => (
              <label key={item} className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" defaultChecked className="rounded border-gray-300 text-primary focus:ring-primary" />
                <span className="text-sm">{item}</span>
              </label>
            ))}
          </div>
        </div>

        <p className="text-xs text-muted-foreground text-center pb-8">
          Settings page is a placeholder. Full configuration management will be built in a future phase.
        </p>
      </div>
    </div>
  );
}
