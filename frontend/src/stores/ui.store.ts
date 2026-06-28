import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { applyThemePreset, type ThemePreset } from '@/theme/theme-presets';

interface UIState {
  theme: ThemePreset;
  sidebarCollapsed: boolean;
  sidebarMobileOpen: boolean;

  setTheme: (theme: ThemePreset) => void;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setSidebarMobileOpen: (open: boolean) => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      theme: 'light',
      sidebarCollapsed: false,
      sidebarMobileOpen: false,

      setTheme: (theme) => {
        applyThemePreset(theme);
        set({ theme });
      },

      toggleSidebar: () =>
        set((state) => ({
          sidebarCollapsed: !state.sidebarCollapsed,
        })),

      setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
      setSidebarMobileOpen: (open) => set({ sidebarMobileOpen: open }),
    }),
    {
      name: 'hrms-ui-store',
      partialize: (state) => ({
        theme: state.theme,
        sidebarCollapsed: state.sidebarCollapsed,
      }),
      onRehydrateStorage: () => (state) => {
        if (state?.theme) {
          applyThemePreset(state.theme);
        }
      },
    }
  )
);
