import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AuthUser } from '@/services/auth.service';
import { authService } from '@/services/auth.service';
import { appConfig } from '@/config/app';

interface AuthState {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;

  setUser: (user: AuthUser | null) => void;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  loadProfile: () => Promise<void>;
  hasPermission: (resource: string, action: string) => boolean;
  hasRole: (...roles: string[]) => boolean;
  reset: () => void;
}

function syncUserContext(user: AuthUser | null) {
  if (typeof window === 'undefined') return;

  if (!user) {
    localStorage.removeItem('companyId');
    localStorage.removeItem('employeeId');
    localStorage.removeItem('groupId');
    localStorage.removeItem(appConfig.companyKey);
    return;
  }

  if (user.companyId) {
    localStorage.setItem('companyId', user.companyId);
    localStorage.setItem(appConfig.companyKey, user.companyId);
  } else {
    localStorage.removeItem('companyId');
    localStorage.removeItem(appConfig.companyKey);
  }

  if (user.employeeId) {
    localStorage.setItem('employeeId', user.employeeId);
  } else {
    localStorage.removeItem('employeeId');
  }

  if (user.groupId) {
    localStorage.setItem('groupId', user.groupId);
  } else {
    localStorage.removeItem('groupId');
  }
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      isLoading: false,

      setUser: (user) => {
        syncUserContext(user);
        set({ user, isAuthenticated: !!user });
      },

      login: async (email, password) => {
        set({ isLoading: true });
        try {
          const response = await authService.login({ email, password });
          syncUserContext(response.user);
          set({
            user: response.user,
            isAuthenticated: true,
            isLoading: false,
          });
        } catch (error) {
          set({ isLoading: false });
          throw error;
        }
      },

      logout: async () => {
        await authService.logout();
        syncUserContext(null);
        set({
          user: null,
          isAuthenticated: false,
        });
      },

      loadProfile: async () => {
        try {
          const profile = await authService.getProfile();
          syncUserContext(profile);
          set({ user: profile, isAuthenticated: true });
        } catch {
          syncUserContext(null);
          set({ user: null, isAuthenticated: false });
        }
      },

      hasPermission: (resource: string, action: string) => {
        const { user } = get();
        if (!user) return false;
        if (user.roles.includes('SUPER_ADMIN')) return true;
        const required = `${resource}:${action}`;
        return user.permissions.includes(required) || user.permissions.includes(`${resource}:*`);
      },

      hasRole: (...roles: string[]) => {
        const { user } = get();
        if (!user) return false;
        if (user.roles.includes('SUPER_ADMIN')) return true;
        return roles.some((role) => user.roles.includes(role));
      },

      reset: () => {
        syncUserContext(null);
        set({ user: null, isAuthenticated: false });
      },
    }),
    {
      name: 'hrms-auth-store',
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
      onRehydrateStorage: () => (state) => {
        syncUserContext(state?.user || null);
      },
    }
  )
);
