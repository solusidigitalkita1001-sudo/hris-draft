export type Priority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'REVIEW' | 'DONE' | 'CANCELLED';

const VALID_PRIORITY = new Set<Priority>(['LOW', 'MEDIUM', 'HIGH', 'URGENT']);
const VALID_STATUS = new Set<TaskStatus>(['TODO', 'IN_PROGRESS', 'REVIEW', 'DONE', 'CANCELLED']);

const TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  TODO: ['IN_PROGRESS', 'CANCELLED'],
  IN_PROGRESS: ['REVIEW', 'CANCELLED'],
  REVIEW: ['DONE', 'IN_PROGRESS', 'CANCELLED'],
  DONE: [],
  CANCELLED: [],
};

export interface TaskTransitionResult {
  allowed: boolean;
  reason: string | null;
}

export function isPriorityValid(priority: unknown): priority is Priority {
  return typeof priority === 'string' && VALID_PRIORITY.has(priority as Priority);
}

export function isStatusValid(status: unknown): status is TaskStatus {
  return typeof status === 'string' && VALID_STATUS.has(status as TaskStatus);
}

export function isTaskTransitionValid(
  fromStatus: unknown,
  toStatus: unknown,
  opts?: { allowForceDone?: boolean; byPass?: boolean },
): TaskTransitionResult {
  const byPass = !!opts?.byPass;
  const allowForce = !!opts?.allowForceDone;
  if (byPass) return { allowed: true, reason: 'byPass=true (admin override)' };
  if (!isStatusValid(fromStatus)) {
    return { allowed: false, reason: `fromStatus tidak valid: ${String(fromStatus ?? 'undefined/null')}` };
  }
  if (!isStatusValid(toStatus)) {
    return { allowed: false, reason: `toStatus tidak valid: ${String(toStatus ?? 'undefined/null')}` };
  }
  if (fromStatus === toStatus) return { allowed: true, reason: 'Sama status, tidak perlu perubahan' };
  const allowed = TRANSITIONS[fromStatus];
  if (allowForce && fromStatus !== 'DONE' && fromStatus !== 'CANCELLED' && toStatus === 'DONE') {
    return { allowed: true, reason: 'allowForceDone=true (admin override REVIEW gate)' };
  }
  if (!allowed.includes(toStatus)) {
    return {
      allowed: false,
      reason: `Transisi task dari ${fromStatus} → ${toStatus} tidak diizinkan. Hanya boleh: ${allowed.length ? allowed.join(', ') : 'tidak ada (status final)'}`,
    };
  }
  return { allowed: true, reason: null };
}

export function isFeedbackValid(star: unknown): star is 1 | 2 | 3 | 4 | 5 {
  if (star === null || star === undefined) return false;
  const n = Number(star);
  return Number.isInteger(n) && n >= 1 && n <= 5;
}

export function isProgressValid(p: unknown): p is number {
  if (typeof p !== 'number' || !Number.isFinite(p)) return false;
  return Number.isInteger(p) && p >= 0 && p <= 100;
}

export function getPriorityLevel(p: Priority): number {
  switch (p) {
    case 'URGENT': return 4;
    case 'HIGH': return 3;
    case 'MEDIUM': return 2;
    case 'LOW': return 1;
    default: return 0;
  }
}

export function sortTaskByPriority<T extends { priority?: Priority }>(tasks: T[]): T[] {
  return [...tasks].sort((a, b) => getPriorityLevel((b.priority ?? 'MEDIUM') as Priority) - getPriorityLevel((a.priority ?? 'MEDIUM') as Priority));
}
