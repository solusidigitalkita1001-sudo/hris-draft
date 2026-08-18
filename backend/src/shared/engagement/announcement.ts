export type AnnouncementAudience =
  | 'ALL'
  | 'COMPANY_WIDE'
  | 'DEPARTMENT_ONLY'
  | 'BRANCH_ONLY'
  | 'POSITION_ONLY'
  | 'EMPLOYEE_SPECIFIC';

export type AnnouncementStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
export type AnnouncementPriority = 'PINNED' | 'NORMAL' | 'HIDDEN';

export interface AnnouncementViewContext {
  companyId: string | null;
  departmentId?: string | null;
  branchId?: string | null;
  positionId?: string | null;
  employeeId?: string | null;
  userId?: string | null;
  currentDate?: Date | string | number;
}

export interface AnnouncementRow {
  id?: string | null;
  companyId?: string | null;
  audienceType: AnnouncementAudience | string;
  departmentIds?: string | null | string[];
  branchIds?: string | null | string[];
  positionIds?: string | null | string[];
  employeeIds?: string | null | string[];
  priority?: AnnouncementPriority | string;
  status?: AnnouncementStatus | string;
  publishFrom?: Date | string | number | null;
  publishUntil?: Date | string | number | null;
  pinnedUntil?: Date | string | number | null;
  title?: string | null;
  createdAt?: Date | string | number | null;
}

function toDate(v: unknown): Date | null {
  if (!v) return null;
  const d = v instanceof Date ? v : new Date(v as any);
  return Number.isNaN(d.getTime()) ? null : d;
}

function parseJsonArray(v: unknown): string[] {
  if (Array.isArray(v)) return v.filter(x => typeof x === 'string').map(x => x as string);
  if (typeof v !== 'string' || v.length === 0) return [];
  try {
    const parsed = JSON.parse(v);
    if (Array.isArray(parsed)) return parsed.filter(x => typeof x === 'string').map(x => x as string);
  } catch {
    return v.split(',').map(s => s.trim()).filter(Boolean);
  }
  return [];
}

export function isWithinPublishWindow(
  row: Pick<AnnouncementRow, 'publishFrom' | 'publishUntil'>,
  nowOverride?: Date | string | number,
): boolean {
  const now = nowOverride ? (toDate(nowOverride) ?? new Date()) : new Date();
  const from = toDate(row.publishFrom);
  const until = toDate(row.publishUntil);
  if (from && now.getTime() < from.getTime()) return false;
  if (until && now.getTime() > until.getTime()) return false;
  return true;
}

export function isAudienceMatch(
  row: AnnouncementRow,
  ctx: AnnouncementViewContext,
): boolean {
  const audience = row.audienceType as AnnouncementAudience;
  switch (audience) {
    case 'ALL':
      return true;
    case 'COMPANY_WIDE': {
      if (!row.companyId) return true;
      return !!ctx.companyId && String(ctx.companyId) === String(row.companyId);
    }
    case 'DEPARTMENT_ONLY': {
      if (!row.companyId || ctx.companyId !== String(row.companyId)) return false;
      const depts = parseJsonArray(row.departmentIds);
      if (depts.length === 0) return false;
      return !!ctx.departmentId && depts.includes(String(ctx.departmentId));
    }
    case 'BRANCH_ONLY': {
      if (!row.companyId || ctx.companyId !== String(row.companyId)) return false;
      const branches = parseJsonArray(row.branchIds);
      if (branches.length === 0) return false;
      return !!ctx.branchId && branches.includes(String(ctx.branchId));
    }
    case 'POSITION_ONLY': {
      if (!row.companyId || ctx.companyId !== String(row.companyId)) return false;
      const positions = parseJsonArray(row.positionIds);
      if (positions.length === 0) return false;
      return !!ctx.positionId && positions.includes(String(ctx.positionId));
    }
    case 'EMPLOYEE_SPECIFIC': {
      if (!row.companyId || ctx.companyId !== String(row.companyId)) return false;
      const empls = parseJsonArray(row.employeeIds);
      if (empls.length === 0) return false;
      return !!ctx.employeeId && empls.includes(String(ctx.employeeId));
    }
    default:
      return false;
  }
}

export function isAnnouncementVisibleTo(
  row: AnnouncementRow,
  ctx: AnnouncementViewContext,
): boolean {
  const status = String(row.status ?? '').toUpperCase() as AnnouncementStatus;
  if (status !== 'PUBLISHED') return false;
  const priority = String(row.priority ?? '').toUpperCase() as AnnouncementPriority;
  if (priority === 'HIDDEN') return false;
  if (!isWithinPublishWindow(row, ctx.currentDate)) return false;
  return isAudienceMatch(row, ctx);
}

export function filterAnnouncementsForUser(
  rows: AnnouncementRow[],
  ctx: AnnouncementViewContext,
): AnnouncementRow[] {
  return rows.filter(r => isAnnouncementVisibleTo(r, ctx));
}

function priorityRank(p: AnnouncementPriority | string | undefined | null): number {
  switch (String(p ?? 'NORMAL').toUpperCase()) {
    case 'PINNED': return 3;
    case 'NORMAL': return 2;
    case 'HIDDEN': return 1;
    default: return 2;
  }
}

function isPinnedActive(row: AnnouncementRow, now?: Date): boolean {
  if (priorityRank(row.priority) !== 3) return false;
  const until = toDate(row.pinnedUntil);
  if (!until) return true;
  const n = now ?? new Date();
  return n.getTime() <= until.getTime();
}

export function sortAnnouncementsForDashboard(
  rows: AnnouncementRow[],
  nowOverride?: Date | string | number,
): AnnouncementRow[] {
  const now = nowOverride ? (toDate(nowOverride) ?? new Date()) : new Date();
  return [...rows].sort((a, b) => {
    const pinnedA = isPinnedActive(a, now);
    const pinnedB = isPinnedActive(b, now);
    if (pinnedA !== pinnedB) return pinnedA ? -1 : 1;
    const prA = priorityRank(a.priority);
    const prB = priorityRank(b.priority);
    if (prA !== prB) return prB - prA;
    const ca = toDate(a.createdAt)?.getTime() ?? 0;
    const cb = toDate(b.createdAt)?.getTime() ?? 0;
    return cb - ca;
  });
}

export function filterUnreadAnnouncements<T extends { id?: string | null }>(
  visibleRows: T[],
  readAnnouncementIds: string[] | Set<string> | null | undefined,
): T[] {
  const reads = readAnnouncementIds instanceof Set ? readAnnouncementIds : new Set(readAnnouncementIds ?? []);
  return visibleRows.filter(r => !reads.has(String(r.id ?? '')));
}

export interface AnnouncementUnreadSummary {
  totalVisible: number;
  totalUnread: number;
  hasUnread: boolean;
  unreadIds: string[];
}

export function summarizeUnread(
  visibleRows: Array<{ id?: string | null }>,
  readIds: string[] | Set<string> | null | undefined,
): AnnouncementUnreadSummary {
  const reads = readIds instanceof Set ? readIds : new Set(readIds ?? []);
  const unread: string[] = [];
  for (const r of visibleRows) {
    const id = String(r.id ?? '');
    if (id && !reads.has(id)) unread.push(id);
  }
  return {
    totalVisible: visibleRows.length,
    totalUnread: unread.length,
    hasUnread: unread.length > 0,
    unreadIds: unread,
  };
}
