import { create } from 'zustand';
import type { AuthUser } from '@/services/auth.service';
import { authService } from '@/services/auth.service';
import { appConfig } from '@/config/app';

interface AuthState {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isBootstrapped: boolean;

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

let profileRequest: Promise<void> | null = null;
let sessionVersion = 0;

if (typeof window !== 'undefined') localStorage.removeItem('hrms-auth-store');

export const useAuthStore = create<AuthState>()(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      isBootstrapped: false,

      setUser: (user) => {
        sessionVersion++;
        syncUserContext(user);
        set({ user, isAuthenticated: !!user, isBootstrapped: true });
      },

      login: async (email, password) => {
        const version = ++sessionVersion;
        set({ isLoading: true });
        try {
          const response = await authService.login({ email, password });
          if (version !== sessionVersion) return;
          syncUserContext(response.user);
          set({
            user: response.user,
            isAuthenticated: true,
            isBootstrapped: true,
            isLoading: false,
          });
        } catch (error) {
          set({ isLoading: false });
          throw error;
        }
      },

      logout: async () => {
        get().reset();
        localStorage.setItem('hrms-logout', String(Date.now()));
        await authService.logout();
      },

      loadProfile: () => {
        if (profileRequest) return profileRequest;
        const version = sessionVersion;
        set({ isLoading: true });
        profileRequest = (async () => {
          try {
            const profile = await authService.getProfile();
            if (version !== sessionVersion) return;
            syncUserContext(profile);
            set({ user: profile, isAuthenticated: true });
          } catch {
            if (version !== sessionVersion) return;
            syncUserContext(null);
            set({ user: null, isAuthenticated: false });
          } finally {
            if (version === sessionVersion) set({ isLoading: false, isBootstrapped: true });
            profileRequest = null;
          }
        })();
        return profileRequest;
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
        sessionVersion++;
        syncUserContext(null);
        set({ user: null, isAuthenticated: false, isLoading: false, isBootstrapped: true });
      },
    })
);

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key === 'hrms-logout' && event.newValue) useAuthStore.getState().reset();
  });
  window.addEventListener('focus', () => {
    if (useAuthStore.getState().isAuthenticated) void useAuthStore.getState().loadProfile();
  });
}
