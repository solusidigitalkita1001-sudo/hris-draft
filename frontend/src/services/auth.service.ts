import api from './api';
import { appConfig } from '@/config/app';

export interface LoginRequest {
  email: string;
  password: string;
}

export interface TokenResponse {
  expiresIn: number;
}

export interface AuthUser {
  id: string;
  email: string;
  employeeId?: string;
  name?: string;
  roles: string[];
  permissions: string[];
  companyId?: string;
  companyScope: string[];
  groupId?: string;
  mustChangePassword: boolean;
}

export interface AuthResponse {
  user: AuthUser;
  tokens: TokenResponse;
}

export interface UserSession {
  id: string;
  userAgent: string | null;
  ipAddress: string | null;
  createdAt: string;
  expiresAt: string;
}

class AuthService {
  async login(data: LoginRequest): Promise<AuthResponse> {
    const response = await api.post('/auth/login', data);
    const result = response.data.data;

    // Cleanup any legacy access token left in localStorage after migration.
    // Access & refresh tokens live exclusively in httpOnly cookies now.
    localStorage.removeItem(appConfig.authTokenKey);
    localStorage.removeItem(appConfig.refreshTokenKey);

    return result;
  }

  async logout(): Promise<void> {
    try {
      // HttpOnly auth cookies are sent automatically; backend revokes refresh token + clears cookies.
      await api.post('/auth/logout');
    } catch {
      // Ignore logout errors
    }
    // Always clean up legacy localStorage items even if API call fails.
    localStorage.removeItem(appConfig.authTokenKey);
    localStorage.removeItem(appConfig.refreshTokenKey);
  }

  async refreshToken(): Promise<AuthResponse> {
    // HttpOnly cookies (at + rt) are sent automatically. Backend rotates cookies in response.
    const response = await api.post('/auth/refresh');
    const result = response.data.data;

    localStorage.removeItem(appConfig.authTokenKey);
    localStorage.removeItem(appConfig.refreshTokenKey);

    return result;
  }

  async getProfile(): Promise<AuthUser> {
    const response = await api.get('/auth/me');
    return response.data.data;
  }

  async getSessions(): Promise<UserSession[]> {
    const response = await api.get('/auth/sessions');
    return response.data.data;
  }

  async revokeSession(sessionId: string): Promise<void> {
    await api.delete(`/auth/sessions/${sessionId}`);
  }

  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    await api.post('/auth/change-password', { currentPassword, newPassword });
  }

  getAccessToken(): string | null {
    // Access token lives in httpOnly cookie - not accessible from JS (XSS-safe).
    // Return null - callers should rely on isAuthenticated via auth store / profile load.
    return null;
  }

  isAuthenticated(): boolean {
    // Best-effort check. Caller should load profile via auth store for definitive result.
    // Legacy localStorage token fallback removed entirely.
    return false;
  }
}

export const authService = new AuthService();
