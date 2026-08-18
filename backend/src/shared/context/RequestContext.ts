import { AsyncLocalStorage } from 'node:async_hooks';

export interface RequestUserContext {
  id: string;
  email: string;
  employeeId?: string | null;
  companyId?: string | null;
  companyScope?: string[];
  groupId?: string | null;
  permissions?: string[];
  roles?: string[];
}

export interface RequestContextData {
  user?: RequestUserContext;
}

const asyncLocalStorage = new AsyncLocalStorage<RequestContextData>();

export function runInRequestContext<T>(ctx: RequestContextData, fn: () => T): T {
  return asyncLocalStorage.run(ctx, fn);
}

export function getRequestContext(): RequestContextData | undefined {
  return asyncLocalStorage.getStore();
}

export function getCurrentUser(): RequestUserContext | undefined {
  return asyncLocalStorage.getStore()?.user;
}

export function getCurrentCompanyId(): string | undefined {
  const ctx = asyncLocalStorage.getStore();
  const user = ctx?.user;
  if (user?.companyId) return user.companyId;
  if (user?.companyScope && user.companyScope.length === 1) {
    return user.companyScope[0];
  }
  return undefined;
}

export function getCurrentRoles(): string[] {
  return asyncLocalStorage.getStore()?.user?.roles ?? [];
}

export function isSuperAdmin(): boolean {
  return getCurrentRoles().includes('SUPER_ADMIN');
}

export function isGroupAdmin(): boolean {
  return getCurrentRoles().includes('GROUP_ADMIN');
}
