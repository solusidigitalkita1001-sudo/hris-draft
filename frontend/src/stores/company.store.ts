import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Company } from '@/services/organization.service';

interface CompanyState {
  activeCompany: Company | null;
  companies: Company[];

  setActiveCompany: (company: Company | null) => void;
  setCompanies: (companies: Company[]) => void;
}

export const useCompanyStore = create<CompanyState>()(
  persist(
    (set) => ({
      activeCompany: null,
      companies: [],

      setActiveCompany: (company) => set({ activeCompany: company }),
      setCompanies: (companies) => set({ companies }),
    }),
    {
      name: 'hrms-company-store',
      partialize: (state) => ({
        activeCompany: state.activeCompany,
      }),
    }
  )
);
