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

// Request interceptor - auth token is sent automatically via httpOnly cookies (withCredentials:true)
// No manual Authorization header attachment from localStorage for security (XSS mitigation).
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor - handle token refresh
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

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
        await axios.post(`${appConfig.apiUrl}/auth/refresh`, null, {
          withCredentials: true,
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
