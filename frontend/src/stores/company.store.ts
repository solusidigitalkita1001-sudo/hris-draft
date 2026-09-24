import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Company } from '@/services/organization.service';
import { appConfig } from '@/config/app';

interface CompanyState {
  activeCompanyId: string | null;
  activeCompany: Company | null;
  companies: Company[];

  setActiveCompany: (company: Company | null) => void;
  seedActiveCompanyId: (companyId: string | null | undefined) => void;
  clearActiveCompany: () => void;
  setCompanies: (companies: Company[]) => void;
}

function syncActiveCompanyId(companyId: string | null) {
  if (typeof window === 'undefined') return;

  if (!companyId) {
    localStorage.removeItem('companyId');
    localStorage.removeItem(appConfig.companyKey);
    return;
  }

  localStorage.setItem('companyId', companyId);
  localStorage.setItem(appConfig.companyKey, companyId);
}

export const useCompanyStore = create<CompanyState>()(
  persist(
    (set, get) => ({
      activeCompanyId: null,
      activeCompany: null,
      companies: [],

      setActiveCompany: (company) => {
        const activeCompanyId = company?.id ?? null;
        syncActiveCompanyId(activeCompanyId);
        set({ activeCompanyId, activeCompany: company });
      },
      seedActiveCompanyId: (companyId) => {
        const normalizedId = companyId?.trim() || null;
        if (get().activeCompanyId === normalizedId) return;

        const activeCompany = normalizedId
          ? get().companies.find((company) => company.id === normalizedId) ?? null
          : null;
        syncActiveCompanyId(normalizedId);
        set({ activeCompanyId: normalizedId, activeCompany });
      },
      clearActiveCompany: () => {
        syncActiveCompanyId(null);
        set({ activeCompanyId: null, activeCompany: null, companies: [] });
      },
      setCompanies: (companies) => set((state) => ({
        companies,
        activeCompany: companies.find((company) => company.id === state.activeCompanyId)
          ?? null,
      })),
    }),
    {
      name: 'hrms-company-store',
      partialize: (state) => ({
        activeCompanyId: state.activeCompanyId,
        activeCompany: state.activeCompany,
      }),
      onRehydrateStorage: () => (state) => {
        const activeCompanyId = state?.activeCompanyId ?? state?.activeCompany?.id ?? null;
        if (state && state.activeCompanyId !== activeCompanyId) {
          state.seedActiveCompanyId(activeCompanyId);
          return;
        }
        syncActiveCompanyId(activeCompanyId);
      },
    }
  )
);
