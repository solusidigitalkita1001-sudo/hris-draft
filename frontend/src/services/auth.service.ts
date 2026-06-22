import api from './api';
import { appConfig } from '@/config/app';

export interface LoginRequest {
  email: string;
  password: string;
}

export interface TokenResponse {
  accessToken: string;
  refreshToken: string;
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

    // Store tokens
    localStorage.setItem(appConfig.authTokenKey, result.tokens.accessToken);
    localStorage.setItem(appConfig.refreshTokenKey, result.tokens.refreshToken);

    return result;
  }

  async logout(): Promise<void> {
    const refreshToken = localStorage.getItem(appConfig.refreshTokenKey);
    try {
      await api.post('/auth/logout', { refreshToken });
    } catch {
      // Ignore logout errors
    }
    localStorage.removeItem(appConfig.authTokenKey);
    localStorage.removeItem(appConfig.refreshTokenKey);
  }

  async refreshToken(): Promise<AuthResponse> {
    const refreshToken = localStorage.getItem(appConfig.refreshTokenKey);
    if (!refreshToken) throw new Error('No refresh token');

    const response = await api.post('/auth/refresh', { refreshToken });
    const result = response.data.data;

    localStorage.setItem(appConfig.authTokenKey, result.tokens.accessToken);
    localStorage.setItem(appConfig.refreshTokenKey, result.tokens.refreshToken);

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
    return localStorage.getItem(appConfig.authTokenKey);
  }

  isAuthenticated(): boolean {
    return !!this.getAccessToken();
  }
}

export const authService = new AuthService();
