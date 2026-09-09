// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { PayrollFormulaPanel } from './PayrollFormulaPanel';
import { payrollFormulaService as service, type PayrollFormulaVersion } from '@/services/payroll-formula.service';
import type { SalaryComponent } from '@/services/payroll.service';
vi.mock('@/services/payroll-formula.service', () => ({ payrollFormulaService: { list: vi.fn(), create: vi.fn(), preview: vi.fn(), publish: vi.fn() } }));
const auth = vi.hoisted(() => ({ user: { id: 'reviewer' }, hasPermission: (_resource: string, action: string) => ['update', 'approve'].includes(action) }));
vi.mock('@/stores/auth.store', () => ({ useAuthStore: (selector: (state: typeof auth) => unknown) => selector(auth) }));
const component: SalaryComponent = { id: 'bonus', companyId: 'company', name: 'Bonus', code: 'BONUS', type: 'ALLOWANCE', calculationMethod: 'FIXED', amount: 100,
  isTaxable: true, isProrated: false, isActive: true, sortOrder: 0, createdAt: '' };
const version: PayrollFormulaVersion = { id: 'v1', componentId: 'bonus', version: 1, expression: 'BASE_SALARY / 10', effectiveFrom: '2026-10-01', status: 'DRAFT', createdBy: 'maker', previewedAt: '2026-09-08T00:00:00Z', publishedAt: null, publishedBy: null, engineVersion: 1 };
function renderPanel() { return render(<PayrollFormulaPanel component={component} components={[component]} onClose={vi.fn()} onChanged={vi.fn()} />); }
async function simulate() {
  fireEvent.change(await screen.findByLabelText('Gaji pokok (IDR)'), { target: { value: '1000' } });
  fireEvent.click(screen.getByRole('button', { name: 'Jalankan simulasi' }));
  await screen.findByText(/Hasil simulasi:/);
}
describe('payroll formula review controls', () => {
  beforeEach(() => {
    vi.resetAllMocks(); auth.user.id = 'reviewer'; auth.hasPermission = (_resource, action) => ['update', 'approve'].includes(action);
    vi.mocked(service.list).mockResolvedValue([version]);
    vi.mocked(service.preview).mockResolvedValue({ versionId: version.id, amount: '100.00', effectiveFrom: version.effectiveFrom, engineVersion: 1, rounding: 'HALF_UP_2_DECIMALS', components: { BONUS: '100.00' } });
    vi.mocked(service.publish).mockResolvedValue({ ...version, status: 'PUBLISHED' });
  });
  afterEach(cleanup);
  it('lets an approve-only reviewer simulate, requires fresh results and confirmation, and clears both on input change', async () => {
    auth.hasPermission = (_resource, action) => action === 'approve'; renderPanel();
    const publish = await screen.findByRole('button', { name: 'Publikasikan formula' });
    expect((publish as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByRole('button', { name: 'Buat revisi dari versi ini' })).toBeNull();
    await simulate(); fireEvent.click(screen.getByRole('checkbox'));
    expect((publish as HTMLButtonElement).disabled).toBe(false);
    fireEvent.change(screen.getByLabelText('Hari hadir'), { target: { value: '19' } });
    expect((publish as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('checkbox') as HTMLInputElement).checked).toBe(false);
    expect(screen.queryByText(/Hasil simulasi:/)).toBeNull();
    await simulate(); fireEvent.click(screen.getByRole('checkbox')); fireEvent.click(publish);
    await waitFor(() => expect(service.publish).toHaveBeenCalledWith('bonus', 'v1'));
  });
  it('keeps creator from publishing even with approval permission', async () => {
    auth.user.id = 'maker'; renderPanel(); await simulate();
    expect(screen.queryByRole('button', { name: 'Publikasikan formula' })).toBeNull();
    expect(screen.getByText(/Publikasi harus dilakukan pengguna lain/)).toBeTruthy();
  });
  it('retains expression and date and permits retry after a failed draft save', async () => {
    vi.mocked(service.list).mockResolvedValue([]); vi.mocked(service.create).mockRejectedValue(new Error('Offline')); renderPanel();
    const expression = await screen.findByLabelText('Ekspresi formula'), effective = screen.getByLabelText('Berlaku mulai');
    fireEvent.change(expression, { target: { value: 'BASE_SALARY / 10' } }); fireEvent.change(effective, { target: { value: '2026-10-01' } });
    fireEvent.click(screen.getByRole('button', { name: 'Simpan draft formula' })); await screen.findByRole('alert');
    expect((expression as HTMLTextAreaElement).value).toBe('BASE_SALARY / 10'); expect((effective as HTMLInputElement).value).toBe('2026-10-01');
    fireEvent.click(screen.getByRole('button', { name: 'Simpan draft formula' }));
    await waitFor(() => expect(service.create).toHaveBeenCalledTimes(2));
  });
  it('does not enable draft creation after a failed initial lookup', async () => {
    vi.mocked(service.list).mockRejectedValue(new Error('Offline')); renderPanel(); await screen.findByRole('alert');
    expect((screen.getByRole('button', { name: 'Simpan draft formula' }) as HTMLButtonElement).disabled).toBe(true);
  });
  it('blocks publication after failed simulation and keeps example inputs', async () => {
    vi.mocked(service.preview).mockRejectedValue(new Error('Division by zero')); renderPanel();
    const salary = await screen.findByLabelText('Gaji pokok (IDR)'); fireEvent.change(salary, { target: { value: '1234' } });
    fireEvent.click(screen.getByRole('button', { name: 'Jalankan simulasi' })); await screen.findByRole('alert');
    expect((salary as HTMLInputElement).value).toBe('1234');
    expect((screen.getByRole('button', { name: 'Publikasikan formula' }) as HTMLButtonElement).disabled).toBe(true);
  });
});
