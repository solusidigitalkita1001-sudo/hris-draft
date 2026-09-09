// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { SalaryComponentList } from './SalaryComponentList';
import { payrollService, type SalaryComponent } from '@/services/payroll.service';
vi.mock('@/services/payroll.service', () => ({ payrollService: { getSalaryComponents: vi.fn() } }));
vi.mock('../components/PayrollFormulaPanel', () => ({ PayrollFormulaPanel: ({ component }: { component: SalaryComponent }) => <div role="region" aria-label="Formula editor">Formula {component.companyId}</div> }));
const companies = vi.hoisted(() => ({ activeCompany: { id: 'company-a' } }));
vi.mock('@/stores/company.store', () => ({ useCompanyStore: (selector: (state: typeof companies) => unknown) => selector(companies) }));
vi.mock('@/stores/auth.store', () => ({ useAuthStore: (selector: (state: { user: { companyId: string } }) => unknown) => selector({ user: { companyId: 'company-a' } }) }));
afterEach(cleanup);
describe('salary component company switch', () => {
  it('closes the previous formula editor and reloads components for the selected company', async () => {
    companies.activeCompany.id = 'company-a';
    vi.mocked(payrollService.getSalaryComponents).mockImplementation(async companyId => [{
      id: `${companyId}-bonus`, companyId, code: 'BONUS', name: `Bonus ${companyId}`, type: 'ALLOWANCE', calculationMethod: 'FIXED', amount: 100,
      isTaxable: true, isProrated: false, isActive: true, sortOrder: 0, createdAt: '',
    }]);
    const view = render(<SalaryComponentList />);
    fireEvent.click(await screen.findByRole('button', { name: 'Kelola formula Bonus company-a' }));
    expect(screen.getByRole('region', { name: 'Formula editor' }).textContent).toBe('Formula company-a');
    companies.activeCompany.id = 'company-b'; view.rerender(<SalaryComponentList />);
    expect(screen.queryByRole('region', { name: 'Formula editor' })).toBeNull();
    await screen.findByRole('button', { name: 'Kelola formula Bonus company-b' });
    await waitFor(() => expect(payrollService.getSalaryComponents).toHaveBeenLastCalledWith('company-b'));
    expect(screen.queryByRole('button', { name: 'Kelola formula Bonus company-a' })).toBeNull();
  });
});
