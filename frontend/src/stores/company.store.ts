import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Company } from '@/services/organization.service';
import { appConfig } from '@/config/app';

interface CompanyState {
  activeCompany: Company | null;
  companies: Company[];

  setActiveCompany: (company: Company | null) => void;
  setCompanies: (companies: Company[]) => void;
}

function syncActiveCompany(company: Company | null) {
  if (typeof window === 'undefined') return;

  if (!company) {
    localStorage.removeItem('companyId');
    localStorage.removeItem(appConfig.companyKey);
    return;
  }

  localStorage.setItem('companyId', company.id);
  localStorage.setItem(appConfig.companyKey, company.id);
}

export const useCompanyStore = create<CompanyState>()(
  persist(
    (set) => ({
      activeCompany: null,
      companies: [],

      setActiveCompany: (company) => {
        syncActiveCompany(company);
        set({ activeCompany: company });
      },
      setCompanies: (companies) => set({ companies }),
    }),
    {
      name: 'hrms-company-store',
      partialize: (state) => ({
        activeCompany: state.activeCompany,
      }),
      onRehydrateStorage: () => (state) => {
        syncActiveCompany(state?.activeCompany || null);
      },
    }
  )
);
