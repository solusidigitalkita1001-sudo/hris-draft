import prisma from '@/shared/database/prisma';
import { BadRequestError, ConflictError } from '@/shared/exceptions/AppError';
import { runInSystemContext } from '@/shared/context/RequestContext';

/**
 * Org-graph integrity rules (checklist §7): parent links must stay inside one
 * tenant, hierarchies must stay acyclic, and masters that are still
 * referenced cannot be deleted. Lookups run in system context with an
 * explicit companyId filter so multi-company admins are validated against
 * the TARGET row's company, not their own ambient context.
 */

type Model = 'branch' | 'division' | 'department' | 'subDepartment' | 'position' | 'employee';

async function findScoped(model: Model, id: string, companyId: string): Promise<{ id: string } | null> {
  return runInSystemContext('org-integrity-lookup', () =>
    (prisma as unknown as Record<string, { findFirst: (args: unknown) => Promise<{ id: string } | null> }>)[model]
      .findFirst({ where: { id, companyId, deletedAt: null }, select: { id: true } }));
}

/** Every provided parent/related id must exist in the same company. */
export async function assertOrgRefsInCompany(
  companyId: string,
  refs: Partial<Record<'divisionId' | 'departmentId' | 'parentId' | 'reportsToId' | 'headId' | 'branchId', string | null | undefined>>,
): Promise<void> {
  const mapping: Array<[keyof typeof refs, Model, string]> = [
    ['divisionId', 'division', 'Division'],
    ['departmentId', 'department', 'Department'],
    ['parentId', 'department', 'Parent department'],
    ['reportsToId', 'position', 'Reports-to position'],
    ['headId', 'employee', 'Head employee'],
    ['branchId', 'branch', 'Branch'],
  ];
  for (const [key, model, label] of mapping) {
    const id = refs[key];
    if (!id) continue;
    const row = await findScoped(model, id, companyId);
    if (!row) throw new BadRequestError(`${label} tidak ditemukan di company ini (atau sudah dihapus)`);
  }
}

const MAX_HIERARCHY_DEPTH = 50;

/** Walk a parent chain; throws when `startId` is reachable from `parentId`. */
async function assertAcyclic(
  model: 'department' | 'position',
  parentField: 'parentId' | 'reportsToId',
  startId: string,
  parentId: string,
): Promise<void> {
  if (startId === parentId) {
    throw new BadRequestError('Hierarki tidak boleh menunjuk ke dirinya sendiri');
  }
  let cursor: string | null = parentId;
  for (let depth = 0; cursor && depth < MAX_HIERARCHY_DEPTH; depth += 1) {
    if (cursor === startId) {
      throw new BadRequestError('Perubahan ini membentuk siklus dalam hierarki organisasi');
    }
    const row: Record<string, string | null> | null = await runInSystemContext('org-cycle-walk', () =>
      (prisma as unknown as Record<string, { findUnique: (args: unknown) => Promise<Record<string, string | null> | null> }>)[model]
        .findUnique({ where: { id: cursor }, select: { [parentField]: true } }));
    cursor = row?.[parentField] ?? null;
  }
}

export const assertNoDepartmentCycle = (departmentId: string, parentId: string) =>
  assertAcyclic('department', 'parentId', departmentId, parentId);

export const assertNoPositionCycle = (positionId: string, reportsToId: string) =>
  assertAcyclic('position', 'reportsToId', positionId, reportsToId);

/** Block delete while active rows still reference the master. */
export async function assertNoActiveDependents(
  checks: Array<{ model: Model; where: Record<string, unknown>; label: string }>,
): Promise<void> {
  for (const check of checks) {
    const count = await runInSystemContext('org-delete-dependency-check', () =>
      (prisma as unknown as Record<string, { count: (args: unknown) => Promise<number> }>)[check.model]
        .count({ where: { ...check.where, deletedAt: null } }));
    if (count > 0) {
      throw new ConflictError(`Tidak dapat menghapus: masih ada ${count} ${check.label} aktif yang terhubung. Pindahkan/nonaktifkan dulu.`);
    }
  }
}
