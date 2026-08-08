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

    // Refresh token is now in httpOnly cookie set by server — only store access token
    localStorage.setItem(appConfig.authTokenKey, result.tokens.accessToken);

    return result;
  }

  async logout(): Promise<void> {
    try {
      // Cookie is sent automatically; no need to send refreshToken in body
      await api.post('/auth/logout');
    } catch {
      // Ignore logout errors
    }
    localStorage.removeItem(appConfig.authTokenKey);
  }

  async refreshToken(): Promise<AuthResponse> {
    // Cookie is sent automatically; backend reads from httpOnly cookie
    const response = await api.post('/auth/refresh');
    const result = response.data.data;

    localStorage.setItem(appConfig.authTokenKey, result.tokens.accessToken);

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
