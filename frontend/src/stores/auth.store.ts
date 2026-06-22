import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AuthUser } from '@/services/auth.service';
import { authService } from '@/services/auth.service';

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

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      isLoading: false,

      setUser: (user) => set({ user, isAuthenticated: !!user }),

      login: async (email, password) => {
        set({ isLoading: true });
        try {
          const response = await authService.login({ email, password });
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
        set({
          user: null,
          isAuthenticated: false,
        });
      },

      loadProfile: async () => {
        try {
          const profile = await authService.getProfile();
          set({ user: profile, isAuthenticated: true });
        } catch {
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

      reset: () => set({ user: null, isAuthenticated: false }),
    }),
    {
      name: 'hrms-auth-store',
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
