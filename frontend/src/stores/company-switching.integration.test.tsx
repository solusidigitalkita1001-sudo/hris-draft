// @vitest-environment jsdom
import { act, cleanup, render, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Company } from '@/services/organization.service';
import { useCompanyStore } from './company.store';
import { PayrollRunList } from '@/modules/payroll/pages/PayrollRunList';
import { EmployeeListPage } from '@/modules/employee/pages/EmployeeListPage';
import { AssetList } from '@/modules/asset/pages/AssetList';
import { payrollService } from '@/services/payroll.service';
import { employeeService } from '@/services/employee.service';
import { organizationService } from '@/services/organization.service';
import { assetService } from '@/services/asset.service';

vi.mock('@/services/payroll.service', () => ({
  payrollService: { getPayrollRuns: vi.fn() },
}));
vi.mock('@/services/employee.service', () => ({
  employeeService: {
    getEmployees: vi.fn(),
    exportCsv: vi.fn(),
    importCsv: vi.fn(),
  },
}));
vi.mock('@/services/organization.service', () => ({
  organizationService: { getDepartments: vi.fn() },
}));
vi.mock('@/services/asset.service', () => ({
  assetService: { getAll: vi.fn(), create: vi.fn() },
}));

function company(id: string): Company {
  return {
    id,
    groupId: 'group-1',
    name: `Company ${id}`,
    code: id.toUpperCase(),
    timezone: 'Asia/Jakarta',
    currency: 'IDR',
    status: 'ACTIVE',
  };
}

async function switchAtoBtoA(assertCurrentCompany: (companyId: string) => void) {
  await waitFor(() => assertCurrentCompany('company-a'));
  act(() => useCompanyStore.getState().setActiveCompany(company('company-b')));
  await waitFor(() => assertCurrentCompany('company-b'));
  act(() => useCompanyStore.getState().setActiveCompany(company('company-a')));
  await waitFor(() => assertCurrentCompany('company-a'));
}

describe('company switching without a browser refresh', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    useCompanyStore.getState().clearActiveCompany();
    useCompanyStore.getState().setActiveCompany(company('company-a'));
    vi.mocked(payrollService.getPayrollRuns).mockResolvedValue([]);
    vi.mocked(assetService.getAll).mockResolvedValue([]);
    vi.mocked(employeeService.getEmployees).mockResolvedValue({
      data: [],
      page: 1,
      limit: 20,
      total: 0,
      totalPages: 1,
    });
    vi.mocked(organizationService.getDepartments).mockResolvedValue([]);
  });

  afterEach(() => {
    cleanup();
    useCompanyStore.getState().clearActiveCompany();
  });

  it('reloads Payroll for A → B → A from the central company store', async () => {
    render(<MemoryRouter><PayrollRunList /></MemoryRouter>);
    await switchAtoBtoA((companyId) => {
      expect(payrollService.getPayrollRuns).toHaveBeenLastCalledWith(companyId);
    });
    expect(vi.mocked(payrollService.getPayrollRuns).mock.calls.map(([id]) => id))
      .toEqual(['company-a', 'company-b', 'company-a']);
  });

  it('reloads Employee and its reference data for A → B → A', async () => {
    render(<MemoryRouter><EmployeeListPage /></MemoryRouter>);
    await switchAtoBtoA((companyId) => {
      expect(employeeService.getEmployees).toHaveBeenLastCalledWith(
        expect.objectContaining({ companyId }),
      );
      expect(organizationService.getDepartments).toHaveBeenLastCalledWith(companyId);
    });
    expect(vi.mocked(employeeService.getEmployees).mock.calls.map(([params]) => params.companyId))
      .toEqual(['company-a', 'company-b', 'company-a']);
  });

  it('reloads Asset for A → B → A', async () => {
    render(<MemoryRouter><AssetList /></MemoryRouter>);
    await switchAtoBtoA((companyId) => {
      expect(assetService.getAll).toHaveBeenLastCalledWith(companyId);
    });
    expect(vi.mocked(assetService.getAll).mock.calls.map(([id]) => id))
      .toEqual(['company-a', 'company-b', 'company-a']);
  });
});
