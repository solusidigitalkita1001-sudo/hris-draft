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

function readCookie(name: string): string | undefined {
  if (typeof document === 'undefined') return undefined;
  const prefix = `${encodeURIComponent(name)}=`;
  const item = document.cookie.split('; ').find((part) => part.startsWith(prefix));
  return item ? decodeURIComponent(item.slice(prefix.length)) : undefined;
}

let csrfBootstrap: Promise<string> | null = null;
async function ensureCsrfToken(force = false): Promise<string> {
  if (csrfBootstrap) return csrfBootstrap;
  const token = readCookie('csrf');
  if (token && !force) return token;
  csrfBootstrap = axios.get(`${appConfig.apiUrl}/auth/csrf`, { withCredentials: true, timeout: 10000 })
    .then(() => {
      const issued = readCookie('csrf');
      if (!issued) throw new Error('CSRF bootstrap did not issue a readable token');
      return issued;
    }).finally(() => { csrfBootstrap = null; });
  return csrfBootstrap;
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
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean; _csrfRetry?: boolean };
    if (!originalRequest) return Promise.reject(error);
    const responseData = error.response?.data as { message?: string } | undefined;
    if (error.response?.status === 403 && responseData?.message === 'Invalid or missing CSRF token'
      && UNSAFE_METHODS.has((originalRequest.method || '').toLowerCase()) && !originalRequest._csrfRetry) {
      originalRequest._csrfRetry = true;
      await ensureCsrfToken(true);
      return api(originalRequest);
    }

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then(() => api(originalRequest))
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        // HttpOnly refresh cookie is sent automatically via withCredentials:true.
        // Backend responds with new httpOnly cookies (at + rt) - no token handling in JS needed.
        const csrfToken = await ensureCsrfToken();
        await axios.post(`${appConfig.apiUrl}/auth/refresh`, null, {
          withCredentials: true,
          headers: { 'X-CSRF-Token': csrfToken },
        });

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
