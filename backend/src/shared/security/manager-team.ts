import prisma from '@/shared/database/prisma';
import { runInSystemContext } from '@/shared/context/RequestContext';

const MAX_UNIT_DEPTH = 50;

/**
 * Resolve the set of employee ids a manager may see under the MANAGER_TEAM data
 * scope (checklist #7). "Manager" = an employee set as the `head` of a
 * Division / Department / SubDepartment; "team" = every employee in the units
 * they head, expanded down the department subtree, plus the manager themselves.
 *
 * Runs in system context with an explicit companyId filter at every hop, so the
 * walk stays inside one tenant (a unit pointer into another company is never
 * followed). Returns an EMPTY array when the manager heads no unit — the caller
 * then fails closed (a non-manager gets no team scope), never company-wide. Own
 * record access, if needed, comes from a separate EMPLOYEE_SELF scope.
 */
export async function resolveManagedEmployeeIds(
  companyId: string,
  managerEmployeeId: string,
): Promise<string[]> {
  if (!companyId || !managerEmployeeId) return [];
  return runInSystemContext('manager-team-resolve', async () => {
    const [headedDivisions, headedDepartments, headedSubDepartments] = await Promise.all([
      prisma.division.findMany({ where: { companyId, headId: managerEmployeeId }, select: { id: true } }),
      prisma.department.findMany({ where: { companyId, headId: managerEmployeeId }, select: { id: true } }),
      prisma.subDepartment.findMany({ where: { companyId, headId: managerEmployeeId }, select: { id: true } }),
    ]);

    const deptIds = new Set<string>(headedDepartments.map((d) => d.id));

    // Departments belonging to a division the manager heads.
    if (headedDivisions.length) {
      const divDepts = await prisma.department.findMany({
        where: { companyId, divisionId: { in: headedDivisions.map((d) => d.id) } },
        select: { id: true },
      });
      divDepts.forEach((d) => deptIds.add(d.id));
    }

    // Expand the department subtree via parentId (bounded depth + visited set so
    // a cycle or a very deep tree can never loop).
    let frontier = [...deptIds];
    for (let depth = 0; frontier.length && depth < MAX_UNIT_DEPTH; depth += 1) {
      const children = await prisma.department.findMany({
        where: { companyId, parentId: { in: frontier } },
        select: { id: true },
      });
      frontier = children.map((c) => c.id).filter((id) => !deptIds.has(id));
      frontier.forEach((id) => deptIds.add(id));
    }

    // Sub-departments: those headed directly + those under the managed departments.
    const subDeptIds = new Set<string>(headedSubDepartments.map((s) => s.id));
    if (deptIds.size) {
      const subs = await prisma.subDepartment.findMany({
        where: { companyId, departmentId: { in: [...deptIds] } },
        select: { id: true },
      });
      subs.forEach((s) => subDeptIds.add(s.id));
    }

    // Employees in any managed unit (team only — self access, if wanted, is a
    // separate EMPLOYEE_SELF scope).
    const teamIds = new Set<string>();
    const orClauses: Array<Record<string, unknown>> = [];
    if (deptIds.size) orClauses.push({ departmentId: { in: [...deptIds] } });
    if (subDeptIds.size) orClauses.push({ subDepartmentId: { in: [...subDeptIds] } });
    if (orClauses.length) {
      const employees = await prisma.employee.findMany({
        where: { companyId, deletedAt: null, OR: orClauses },
        select: { id: true },
      });
      employees.forEach((e) => teamIds.add(e.id));
    }
    return [...teamIds];
  });
}
