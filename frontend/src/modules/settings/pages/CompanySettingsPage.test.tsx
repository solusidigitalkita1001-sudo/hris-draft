// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { I18nProvider } from '@/i18n/provider';
import { CompanySettingsPage } from './CompanySettingsPage';
import { companySettingsService as service, type SettingDescriptor } from '@/services/company-settings.service';

vi.mock('@/services/api', () => ({ default: {} }));
vi.mock('@/services/company-settings.service', async importOriginal => {
  const actual = await importOriginal<typeof import('@/services/company-settings.service')>();
  return { ...actual, companySettingsService: { catalog: vi.fn(), all: vi.fn(), save: vi.fn() } };
});
const auth = vi.hoisted(() => ({ hasPermission: (_resource: string, _action: string): boolean => true }));
vi.mock('@/stores/auth.store', () => ({ useAuthStore: (selector: (state: typeof auth) => unknown) => selector(auth) }));
vi.mock('@/stores/company.store', () => ({ useCompanyStore: (selector: (state: { activeCompanyId: string }) => unknown) => selector({ activeCompanyId: 'company-a' }) }));

const CATALOG: SettingDescriptor[] = [
  { key: 'pph21_gross_up_enabled', type: 'boolean', defaultValue: 'false' },
  { key: 'leave_carryover_max_days', type: 'number', defaultValue: '1', min: 0, max: 365, integer: true },
  // Deliberately in no group the page knows about.
  { key: 'some_future_setting', type: 'text', defaultValue: 'x' },
  { key: 'pph21_method', type: 'enum', defaultValue: 'ANNUALIZED', options: ['ANNUALIZED', 'TER'] },
];
const VALUES = {
  pph21_gross_up_enabled: 'false', leave_carryover_max_days: '1',
  some_future_setting: 'x', pph21_method: 'ANNUALIZED',
};

function renderPage() {
  return render(<I18nProvider><CompanySettingsPage /></I18nProvider>);
}

describe('company settings page', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    auth.hasPermission = () => true;
    vi.mocked(service.catalog).mockResolvedValue(CATALOG);
    vi.mocked(service.all).mockResolvedValue(VALUES);
  });
  afterEach(cleanup);

  it('renders the control the server says each setting is, not one it guessed', async () => {
    renderPage();
    const toggle = await screen.findByLabelText('Gross-up PPh21 (pajak ditanggung perusahaan)');
    expect((toggle as HTMLInputElement).type).toBe('checkbox');
    const number = screen.getByLabelText('Maksimum hari cuti yang boleh dibawa ke tahun berikutnya');
    expect((number as HTMLInputElement).type).toBe('number');
    expect((number as HTMLInputElement).min).toBe('0');
    expect((number as HTMLInputElement).max).toBe('365');
  });

  it('shows a setting no group claims instead of dropping it', async () => {
    renderPage();
    // No label copy exists for it either, so the key itself must be the label:
    // a setting added server-side has to stay reachable before its UI copy is
    // written, which is the whole point of reading the catalog from the server.
    expect(await screen.findByLabelText('some_future_setting')).toBeTruthy();
    expect(screen.getByText('Lainnya')).toBeTruthy();
  });

  it('sends only the settings that actually changed', async () => {
    vi.mocked(service.save).mockResolvedValue(undefined);
    renderPage();
    fireEvent.click(await screen.findByLabelText('Gross-up PPh21 (pajak ditanggung perusahaan)'));
    fireEvent.click(screen.getByRole('button', { name: 'Simpan perubahan' }));
    await waitFor(() => expect(service.save).toHaveBeenCalledTimes(1));
    expect(vi.mocked(service.save).mock.calls[0][0]).toEqual({ pph21_gross_up_enabled: 'true' });
  });

  it('keeps the page read-only without permission to update settings', async () => {
    auth.hasPermission = (_resource, action) => action === 'read';
    renderPage();
    const toggle = await screen.findByLabelText('Gross-up PPh21 (pajak ditanggung perusahaan)');
    expect((toggle as HTMLInputElement).disabled).toBe(true);
    expect(screen.queryByRole('button', { name: 'Simpan perubahan' })).toBeNull();
    expect(screen.getByText('Anda hanya bisa melihat pengaturan ini. Hak akses ubah pengaturan diperlukan untuk menyimpan.')).toBeTruthy();
  });

  it('refuses to show anything without permission to read settings', async () => {
    auth.hasPermission = () => false;
    renderPage();
    expect(await screen.findByText('Hak akses baca pengaturan diperlukan untuk membuka halaman ini.')).toBeTruthy();
    expect(service.catalog).not.toHaveBeenCalled();
  });

  it('offers an enum setting as a choice, not a text box', () => {
    // A text box would accept 'ter', which the server rejects and which would
    // otherwise read as configured while leaving the old method in force.
    renderPage();
    return screen.findByLabelText('Metode pemotongan PPh 21').then(control => {
      expect(control.tagName).toBe('SELECT');
      const values = Array.from((control as HTMLSelectElement).options).map(option => option.value);
      expect(values).toEqual(['ANNUALIZED', 'TER']);
      expect((control as HTMLSelectElement).value).toBe('ANNUALIZED');
    });
  });

  it('sends the chosen enum value verbatim', async () => {
    vi.mocked(service.save).mockResolvedValue(undefined);
    renderPage();
    const control = await screen.findByLabelText('Metode pemotongan PPh 21');
    fireEvent.change(control, { target: { value: 'TER' } });
    fireEvent.click(screen.getByRole('button', { name: 'Simpan perubahan' }));
    await waitFor(() => expect(service.save).toHaveBeenCalledTimes(1));
    expect(vi.mocked(service.save).mock.calls[0][0]).toEqual({ pph21_method: 'TER' });
  });
});
