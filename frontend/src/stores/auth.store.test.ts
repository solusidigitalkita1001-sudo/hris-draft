// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthUser } from '@/services/auth.service';
vi.mock('@/services/auth.service', () => ({ authService: { getProfile: vi.fn(), login: vi.fn(), logout: vi.fn() } }));
import { authService } from '@/services/auth.service';
import { useAuthStore } from './auth.store';
const user: AuthUser = { id: 'u', email: 'u@example.com', roles: ['EMPLOYEE'], permissions: [], companyScope: ['A'], companyId: 'A', mustChangePassword: false };
describe('server authoritative auth', () => {
  beforeEach(() => { vi.resetAllMocks(); useAuthStore.getState().reset(); localStorage.clear(); });
  it('loads permissions from the server without persisting them', async () => {
    vi.mocked(authService.getProfile).mockResolvedValue(user);
    await useAuthStore.getState().loadProfile();
    expect(useAuthStore.getState().user).toEqual(user);
    expect(localStorage.getItem('hrms-auth-store')).toBeNull();
  });
  it('clears auth on an expired or disabled session', async () => {
    useAuthStore.getState().setUser(user);
    vi.mocked(authService.getProfile).mockRejectedValue({ response: { status: 403 } });
    await useAuthStore.getState().loadProfile();
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(useAuthStore.getState().isBootstrapped).toBe(true);
  });
  it('deduplicates concurrent bootstrap requests and does not resurrect logout', async () => {
    let resolve!: (value: AuthUser) => void;
    vi.mocked(authService.getProfile).mockReturnValue(new Promise((done) => { resolve = done; }));
    const first = useAuthStore.getState().loadProfile();
    const second = useAuthStore.getState().loadProfile();
    expect(authService.getProfile).toHaveBeenCalledTimes(1);
    useAuthStore.getState().reset();
    resolve(user);
    await Promise.all([first, second]);
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
  });
  it('receives logout from another tab', () => {
    useAuthStore.getState().setUser(user);
    window.dispatchEvent(new StorageEvent('storage', { key: 'hrms-logout', newValue: '123' }));
    expect(useAuthStore.getState().user).toBeNull();
  });
});
