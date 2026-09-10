import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { appConfig } from '@/config/app';

let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value: unknown) => void;
  reject: (reason: unknown) => void;
}> = [];

const processQueue = (error: unknown) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(null);
    }
  });
  failedQueue = [];
};

const clearClientSession = () => {
  csrfToken = undefined;
  localStorage.removeItem(appConfig.authTokenKey);
  localStorage.removeItem(appConfig.refreshTokenKey);
  localStorage.removeItem(appConfig.companyKey);
  localStorage.removeItem('companyId');
  localStorage.removeItem('employeeId');
  localStorage.removeItem('groupId');
  localStorage.removeItem('hrms-auth-store');
};

const api = axios.create({
  baseURL: appConfig.apiUrl,
  timeout: 30000,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
    'X-Requested-With': 'XMLHttpRequest',
  },
});

const UNSAFE_METHODS = new Set(['post', 'put', 'patch', 'delete']);
const SESSION_ENDPOINT = /\/auth\/(login|refresh)(?:[?#]|$)/;

function tokenFromResponse(body: unknown): string | undefined {
  if (!body || typeof body !== 'object' || !('data' in body)) return undefined;
  const data = body.data;
  if (!data || typeof data !== 'object' || !('csrfToken' in data)) return undefined;
  return typeof data.csrfToken === 'string' && data.csrfToken.length > 0 ? data.csrfToken : undefined;
}

// Keep the header token in memory. API cookies may belong to another hostname
// and cannot reliably be read through the frontend's document.cookie.
let csrfToken: string | undefined;
let csrfBootstrap: Promise<string> | null = null;
let csrfRequestId = 0;
async function ensureCsrfToken(force = false): Promise<string> {
  if (csrfBootstrap) return csrfBootstrap;
  if (csrfToken && !force) return csrfToken;
  csrfToken = undefined;
  csrfBootstrap = axios.get(`${appConfig.apiUrl}/auth/csrf`, {
    withCredentials: true,
    timeout: 10000,
    // Bypass cached responses from deployments that predate no-store headers.
    params: { _csrf: `${Date.now()}-${++csrfRequestId}` },
  })
    .then((response) => {
      csrfToken = tokenFromResponse(response.data);
      if (!csrfToken) throw new Error('Endpoint CSRF tidak mengembalikan token. Periksa URL API dan proxy server.');
      return csrfToken;
    }).finally(() => { csrfBootstrap = null; });
  return csrfBootstrap;
}

function isCsrfError(error: unknown): boolean {
  return axios.isAxiosError(error) && error.response?.status === 403
    && error.response.data?.message === 'Invalid or missing CSRF token';
}

async function refreshSession(): Promise<void> {
  const refresh = async (forceCsrf = false) => axios.post(`${appConfig.apiUrl}/auth/refresh`, null, {
    withCredentials: true,
    timeout: 10000,
    headers: { 'X-CSRF-Token': await ensureCsrfToken(forceCsrf) },
  });
  let response;
  try {
    response = await refresh();
  } catch (error) {
    if (!isCsrfError(error)) throw error;
    response = await refresh(true);
  }
  csrfToken = tokenFromResponse(response.data);
}

// Request interceptor - auth token is sent automatically via httpOnly cookies (withCredentials:true)
// No manual Authorization header attachment from localStorage for security (XSS mitigation).
api.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    if (UNSAFE_METHODS.has((config.method || '').toLowerCase())) {
      config.headers.set('X-CSRF-Token', await ensureCsrfToken());
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor - handle token refresh
api.interceptors.response.use(
  (response) => {
    if (SESSION_ENDPOINT.test(response.config.url || '')) {
      csrfToken = tokenFromResponse(response.data);
    } else if (/\/auth\/logout(?:[?#]|$)/.test(response.config.url || '')) {
      csrfToken = undefined;
    }
    return response;
  },
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean; _csrfRetry?: boolean };
    if (!originalRequest) return Promise.reject(error);
    if (isCsrfError(error)
      && UNSAFE_METHODS.has((originalRequest.method || '').toLowerCase()) && !originalRequest._csrfRetry) {
      originalRequest._csrfRetry = true;
      await ensureCsrfToken(true);
      return api(originalRequest);
    }

    if (error.response?.status === 401 && !originalRequest._retry
      && !SESSION_ENDPOINT.test(originalRequest.url || '')) {
      originalRequest._retry = true;
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then(() => api(originalRequest))
          .catch((err) => Promise.reject(err));
      }

      isRefreshing = true;

      try {
        // HttpOnly refresh cookie is sent automatically via withCredentials:true.
        // Backend responds with new httpOnly cookies (at + rt) - no token handling in JS needed.
        await refreshSession();

        processQueue(null);

        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError);
        clearClientSession();
        window.location.href = '/login';
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default api;
