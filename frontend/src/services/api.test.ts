// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AxiosInstance, AxiosStatic, InternalAxiosRequestConfig } from 'axios';

let axios: AxiosStatic;
let api: AxiosInstance;
const bootstrap = vi.fn();
const refresh = vi.fn();
const csrfBody = (token: string) => ({ success: true, data: { csrfToken: token } });

function response(config: InternalAxiosRequestConfig, data: unknown, status = 200) {
  return { config, data, status, statusText: String(status), headers: {} };
}

function fail(config: InternalAxiosRequestConfig, status: number, message: string): never {
  throw new axios.AxiosError(message, undefined, config, undefined, response(config, { message }, status));
}

describe('API CSRF bootstrap and session rotation', () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    vi.resetModules();
    bootstrap.mockReset().mockResolvedValue({ data: csrfBody('bootstrap-token') });
    refresh.mockReset();
    localStorage.clear();
    document.cookie = 'csrf=; Max-Age=0; Path=/';
    axios = (await import('axios')).default;
    vi.spyOn(axios, 'get').mockImplementation(bootstrap);
    vi.spyOn(axios, 'post').mockImplementation(refresh);
    api = (await import('./api')).default;
  });

  it('logs in without a JS-readable API cookie and uses the token rotated by login', async () => {
    const seen: unknown[] = [];
    api.defaults.adapter = async (config) => {
      seen.push(config.headers.get('X-CSRF-Token'));
      return response(config, config.url === '/auth/login' ? csrfBody('login-token') : { success: true });
    };
    await api.post('/auth/login', { email: 'test@example.com', password: 'password' });
    await api.patch('/employees/me', { name: 'Employee' });
    expect(seen).toEqual(['bootstrap-token', 'login-token']);
    expect(document.cookie).toBe('');
    expect(bootstrap).toHaveBeenCalledTimes(1);
    expect(bootstrap).toHaveBeenCalledWith(expect.stringContaining('/auth/csrf'), expect.objectContaining({
      withCredentials: true, timeout: 10000, params: { _csrf: expect.any(String) },
    }));
    expect(localStorage.length).toBe(0);
  });

  it('shares one bootstrap between simultaneous mutations', async () => {
    let issue!: (value: unknown) => void;
    bootstrap.mockReturnValue(new Promise((resolve) => { issue = resolve; }));
    const adapter = vi.fn(async (config: InternalAxiosRequestConfig) => response(config, {}));
    api.defaults.adapter = adapter;
    const first = api.post('/first');
    const second = api.post('/second');
    await vi.waitFor(() => expect(bootstrap).toHaveBeenCalledTimes(1));
    expect(adapter).not.toHaveBeenCalled();
    issue({ data: csrfBody('shared-token') });
    await Promise.all([first, second]);
    expect(adapter).toHaveBeenCalledTimes(2);
    expect(adapter.mock.calls.every(([config]) => config.headers.get('X-CSRF-Token') === 'shared-token')).toBe(true);
  });

  it.each(['<!doctype html><html>SPA fallback</html>', { success: true, data: null }, undefined])(
    'rejects missing tokens instead of sending login with an invalid bootstrap: %j', async (body) => {
      bootstrap.mockResolvedValue({ data: body });
      const adapter = vi.fn();
      api.defaults.adapter = adapter;
      await expect(api.post('/auth/login')).rejects.toThrow('Endpoint CSRF tidak mengembalikan token');
      expect(adapter).not.toHaveBeenCalled();
      bootstrap.mockResolvedValue({ data: csrfBody('recovered-token') });
      adapter.mockImplementation(async (config: InternalAxiosRequestConfig) => response(config, {}));
      await api.post('/auth/login');
      expect(bootstrap).toHaveBeenCalledTimes(2);
      expect(bootstrap.mock.calls[0][1].params._csrf).not.toBe(bootstrap.mock.calls[1][1].params._csrf);
    },
  );

  it('refreshes an expired CSRF token and retries a mutation once', async () => {
    bootstrap.mockResolvedValueOnce({ data: csrfBody('expired-token') }).mockResolvedValueOnce({ data: csrfBody('fresh-token') });
    const seen: unknown[] = [];
    api.defaults.adapter = async (config) => {
      seen.push(config.headers.get('X-CSRF-Token'));
      if (seen.length === 1) fail(config, 403, 'Invalid or missing CSRF token');
      return response(config, {});
    };
    await api.post('/auth/login');
    expect(seen).toEqual(['expired-token', 'fresh-token']);
    expect(bootstrap).toHaveBeenCalledTimes(2);
  });

  it('stops after one CSRF retry when cookies are still rejected', async () => {
    const adapter = vi.fn(async (config: InternalAxiosRequestConfig) => fail(config, 403, 'Invalid or missing CSRF token'));
    api.defaults.adapter = adapter;
    await expect(api.post('/auth/login')).rejects.toMatchObject({ response: { status: 403 } });
    expect(adapter).toHaveBeenCalledTimes(2);
    expect(bootstrap).toHaveBeenCalledTimes(2);
  });

  it('does not retry a permission denial', async () => {
    const adapter = vi.fn(async (config: InternalAxiosRequestConfig) => fail(config, 403, 'Request origin is not allowed'));
    api.defaults.adapter = adapter;
    await expect(api.post('/employees')).rejects.toMatchObject({ response: { status: 403 } });
    expect(adapter).toHaveBeenCalledTimes(1);
    expect(bootstrap).toHaveBeenCalledTimes(1);
  });

  it.each(['/auth/login', '/auth/refresh'])('preserves a 401 from %s without recursively refreshing', async (url) => {
    api.defaults.adapter = async (config) => fail(config, 401, 'Invalid credentials');
    await expect(api.post(url)).rejects.toMatchObject({ response: { data: { message: 'Invalid credentials' } } });
    expect(refresh).not.toHaveBeenCalled();
  });

  it('recovers stale CSRF on automatic session refresh and uses the new rotation on replay', async () => {
    bootstrap.mockResolvedValueOnce({ data: csrfBody('old-token') }).mockResolvedValueOnce({ data: csrfBody('fresh-token') });
    refresh.mockRejectedValueOnce(new axios.AxiosError('CSRF', undefined, undefined, undefined, {
      status: 403, statusText: 'Forbidden', config: { headers: new axios.AxiosHeaders() }, headers: {},
      data: { message: 'Invalid or missing CSRF token' },
    })).mockResolvedValueOnce({ data: csrfBody('rotated-token') });
    const seen: unknown[] = [];
    api.defaults.adapter = async (config) => {
      seen.push(config.headers.get('X-CSRF-Token'));
      if (seen.length === 1) fail(config, 401, 'Expired session');
      return response(config, {});
    };
    await api.patch('/employees/me', { name: 'Employee' });
    expect(refresh.mock.calls.map((call) => call[2].headers['X-CSRF-Token'])).toEqual(['old-token', 'fresh-token']);
    expect(seen).toEqual(['old-token', 'rotated-token']);
    expect(bootstrap).toHaveBeenCalledTimes(2);
  });

  it('bootstraps again after logout clears the token', async () => {
    api.defaults.adapter = async (config) => response(config, {});
    await api.post('/auth/logout');
    await api.post('/auth/login');
    expect(bootstrap).toHaveBeenCalledTimes(2);
  });

  it('takes company context from the central store and overwrites stale request params', async () => {
    const { useCompanyStore } = await import('@/stores/company.store');
    useCompanyStore.getState().setActiveCompany({
      id: 'company-b', groupId: 'group-1', name: 'Company B', code: 'B',
      timezone: 'Asia/Jakarta', currency: 'IDR', status: 'ACTIVE',
    });
    const seen: InternalAxiosRequestConfig[] = [];
    api.defaults.adapter = async (config) => {
      seen.push(config);
      return response(config, {});
    };

    await api.get('/employees', { params: { companyId: 'stale-company-a' } });
    await api.get('/organization/companies');

    expect(seen[0].params).toMatchObject({ companyId: 'company-b' });
    expect(seen[1].params?.companyId).toBeUndefined();
  });

  it('aborts a pending tenant request before sending requests for the next company', async () => {
    const { useCompanyStore } = await import('@/stores/company.store');
    useCompanyStore.getState().setActiveCompany({
      id: 'company-a', groupId: 'group-1', name: 'Company A', code: 'A',
      timezone: 'Asia/Jakarta', currency: 'IDR', status: 'ACTIVE',
    });
    let firstConfig: InternalAxiosRequestConfig | undefined;
    api.defaults.adapter = (config) => new Promise((_resolve, reject) => {
      firstConfig = config;
      config.signal?.addEventListener('abort', () => reject(new axios.CanceledError()), { once: true });
    });

    const pending = api.get('/employees').catch((error) => error);
    await vi.waitFor(() => expect(firstConfig?.params).toMatchObject({ companyId: 'company-a' }));

    useCompanyStore.getState().setActiveCompany({
      id: 'company-b', groupId: 'group-1', name: 'Company B', code: 'B',
      timezone: 'Asia/Jakarta', currency: 'IDR', status: 'ACTIVE',
    });

    expect(axios.isCancel(await pending)).toBe(true);
    expect(firstConfig?.signal?.aborted).toBe(true);

    api.defaults.adapter = async (config) => response(config, {});
    const next = await api.get('/employees');
    expect(next.config.params).toMatchObject({ companyId: 'company-b' });
    expect(next.config.signal?.aborted).toBe(false);
  });
});
