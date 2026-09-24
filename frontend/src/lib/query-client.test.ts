// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import type { Company } from '@/services/organization.service';
import { useCompanyStore } from '@/stores/company.store';
import { companyQueryKey, queryClient } from './query-client';

function company(id: string): Company {
  return {
    id,
    groupId: 'group-1',
    name: id,
    code: id,
    timezone: 'Asia/Jakarta',
    currency: 'IDR',
    status: 'ACTIVE',
  };
}

afterEach(() => {
  queryClient.clear();
  useCompanyStore.getState().clearActiveCompany();
});

describe('tenant-aware query cache', () => {
  it('includes company id in every tenant key and removes the previous tenant cache', () => {
    useCompanyStore.getState().setActiveCompany(company('company-a'));
    const companyAKey = companyQueryKey('company-a', 'employees');
    const companyBKey = companyQueryKey('company-b', 'employees');
    queryClient.setQueryData(companyAKey, ['employee-a']);
    queryClient.setQueryData(companyBKey, ['employee-b']);

    useCompanyStore.getState().setActiveCompany(company('company-b'));

    expect(companyAKey).toEqual(['company', 'company-a', 'employees']);
    expect(queryClient.getQueryData(companyAKey)).toBeUndefined();
    expect(queryClient.getQueryData(companyBKey)).toEqual(['employee-b']);
  });
});
