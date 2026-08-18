export type CompanyOperationalStatus = 'ACTIVE' | 'TRIAL' | 'SUSPENDED' | 'INACTIVE' | 'PENDING_ONBOARDING';
export type UserCompanyAccessScope = 'SINGLE_COMPANY' | 'GROUP_ALL' | 'GROUP_SELECTED' | 'ALL_PLATFORM';

const SUPER_ROLES = new Set(['SUPER_ADMIN', 'PLATFORM_OWNER', 'ROOT']);

export interface UserCompanyAccessRow {
  id?: string | null;
  companyId: string;
  accessScope?: UserCompanyAccessScope | string;
  roleOverride?: string | null;
  isPrimary?: boolean | null;
  rankPriority?: number | null; // lower = lebih dipilih sebagai default (primary rank=1)
  companyName?: string | null;
  companyOperationalStatus?: CompanyOperationalStatus | string | null;
  deletedAt?: Date | string | number | null;
}

export interface SwitcherContext {
  currentRoles: string[];      // User.roles array (mis. ['SUPER_ADMIN'], ['HR_ADMIN','COMPANY_ADMIN'])
  currentCompanyId?: string | null;
  activeGroupId?: string | null;
}

export interface SwitchAllowedResult {
  allowed: boolean;
  reason: string | null;
  targetCompanyId?: string | null;
  isSwitchBackToCurrent?: boolean;
}

export interface ResolveDefaultResult {
  defaultCompanyId: string | null;
  defaultCompanyName?: string | null;
  eligibleCount: number;
  reason: string | null;
}

const FORBIDDEN_OPERATIONAL_STATUSES = new Set<CompanyOperationalStatus>(['INACTIVE', 'SUSPENDED']);

export function isCompanySwitchable(status: CompanyOperationalStatus | string | null | undefined): boolean {
  if (!status) return false;
  const s = String(status).toUpperCase() as CompanyOperationalStatus;
  return !FORBIDDEN_OPERATIONAL_STATUSES.has(s);
}

export function isSuperAdmin(roles: unknown): boolean {
  if (!Array.isArray(roles)) return false;
  return roles.some(r => typeof r === 'string' && SUPER_ROLES.has(r.trim().toUpperCase()));
}

function toStrArr(arr: unknown): string[] {
  if (!Array.isArray(arr)) return [];
  return arr.map(x => String(x)).filter(Boolean);
}

export function listSwitchableCompanies(
  accessList: UserCompanyAccessRow[] | null | undefined,
  ctx: SwitcherContext,
): UserCompanyAccessRow[] {
  const list = Array.isArray(accessList) ? accessList : [];
  const superAdmin = isSuperAdmin(ctx.currentRoles);
  const roles = toStrArr(ctx.currentRoles).map(r => r.toUpperCase());
  // Filter out soft deleted
  const notDeleted = list.filter(a => {
    if (!a || !a.companyId) return false;
    if (a.deletedAt !== null && a.deletedAt !== undefined) {
      const d = a.deletedAt instanceof Date ? a.deletedAt : new Date(a.deletedAt as any);
      if (!Number.isNaN(d.getTime())) return false;
    }
    return true;
  });
  const eligible = notDeleted.filter(a => {
    if (superAdmin) return isCompanySwitchable(a.companyOperationalStatus ?? 'ACTIVE');
    // Group ALL scope: semua company group
    if (String(a.accessScope ?? 'SINGLE_COMPANY').toUpperCase() === 'ALL_PLATFORM') {
      return isCompanySwitchable(a.companyOperationalStatus ?? 'ACTIVE');
    }
    return isCompanySwitchable(a.companyOperationalStatus ?? 'ACTIVE');
  });
  // sort: primary rank=1 pertama, lalu scope GROUP_ALL / ALL_PLATFORM duluan, terakhir company status
  return [...eligible].sort((a, b) => {
    const pa = Number(a.rankPriority) || 999;
    const pb = Number(b.rankPriority) || 999;
    if (pa !== pb) return pa - pb;
    const ia = !!a.isPrimary ? 1 : 0;
    const ib = !!b.isPrimary ? 1 : 0;
    if (ia !== ib) return ib - ia;
    return (a.companyName ?? '').localeCompare(b.companyName ?? '');
  });
}

export function validateCompanySwitchTarget(
  targetCompanyId: unknown,
  accessList: UserCompanyAccessRow[] | null | undefined,
  ctx: SwitcherContext,
): SwitchAllowedResult {
  const target = typeof targetCompanyId === 'string' && targetCompanyId.length > 0 ? targetCompanyId : null;
  if (!target) return { allowed: false, reason: 'Target company ID tidak valid (kosong/null).', targetCompanyId: null };
  if (ctx.currentCompanyId && String(ctx.currentCompanyId) === target) {
    return { allowed: true, reason: null, targetCompanyId: target, isSwitchBackToCurrent: true };
  }
  const switchable = listSwitchableCompanies(accessList, ctx);
  const hit = switchable.find(c => String(c.companyId) === target);
  if (isSuperAdmin(ctx.currentRoles)) {
    // SUPER ADMIN boleh semua KECUALI INACTIVE company explicit
    const any = (Array.isArray(accessList) ? accessList : []).find(c => String(c.companyId) === target);
    if (any && !isCompanySwitchable(any.companyOperationalStatus ?? 'ACTIVE')) {
      return { allowed: false, reason: `Company ID=${target} status INACTIVE/SUSPENDED — tidak bisa di-switch bahkan SUPER_ADMIN.`, targetCompanyId: target };
    }
    return { allowed: true, reason: 'SUPER_ADMIN bypass access list filter.', targetCompanyId: target };
  }
  if (!hit) return { allowed: false, reason: `Anda tidak memiliki akses switch ke company ${target}.`, targetCompanyId: target };
  return { allowed: true, reason: null, targetCompanyId: target };
}

export function resolveDefaultActiveCompany(
  accessList: UserCompanyAccessRow[] | null | undefined,
  ctx: SwitcherContext,
): ResolveDefaultResult {
  const switchable = listSwitchableCompanies(accessList, ctx);
  if (switchable.length === 0) return { defaultCompanyId: null, eligibleCount: 0, reason: 'Tidak ada company yang eligible untuk diakses user.' };
  const primary = switchable.find(c => !!c.isPrimary) ?? switchable[0];
  return {
    defaultCompanyId: primary.companyId,
    defaultCompanyName: primary.companyName ?? null,
    eligibleCount: switchable.length,
    reason: primary.isPrimary ? 'Primary company dipilih sebagai default.' : 'Company pertama eligible dipilih default (tidak ada primary flag).',
  };
}

export function groupCompaniesByScope(list: UserCompanyAccessRow[] | null, ctx: SwitcherContext): Record<string, UserCompanyAccessRow[]> {
  const switchable = listSwitchableCompanies(list, ctx);
  const out: Record<string, UserCompanyAccessRow[]> = {
    ACTIVE: [],
    TRIAL: [],
    PENDING_ONBOARDING: [],
    OTHER: [],
  };
  for (const c of switchable) {
    const key = (String(c.companyOperationalStatus ?? 'ACTIVE').toUpperCase());
    if (key in out) out[key].push(c);
    else out.OTHER.push(c);
  }
  return out;
}
