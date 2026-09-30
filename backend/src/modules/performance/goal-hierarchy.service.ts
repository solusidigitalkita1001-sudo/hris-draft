import prisma from '@/shared/database/prisma';
import { BadRequestError, NotFoundError } from '@/shared/exceptions/AppError';
import { logger } from '@/shared/logger/WinstonLogger';
import { assertEmployeeInScope } from '@/shared/security/employee-data-scope';

/**
 * Depth is bounded so a chain cannot grow into something no screen can render
 * and no person can follow. Five levels covers company → division → department
 * → team → individual, which is deeper than most organisations actually use.
 */
export const MAX_GOAL_DEPTH = 5;

/**
 * Goal hierarchy as a free reference (GAP-26).
 *
 * The decision was a free reference rather than formal cascade: a goal may name
 * another as its parent, without being forced to hang off an organisational
 * level. Formal cascade assumes an organisational goal structure that is rarely
 * settled when a system is new — insisting on it first produces a goal tree
 * filled in carelessly to satisfy the form, which is worse than no tree.
 *
 * Note: `parentGoalId` did not exist. An earlier claim in the gap list that it
 * did was wrong, so the hierarchy had to be modelled before it could be used.
 */
export class GoalHierarchyService {
  /**
   * Point a goal at its parent, or clear it with `null`.
   *
   * Refuses a cycle. Without that check a chain can be closed into a loop —
   * A's parent is B, B's parent is A — and every reader that walks upwards,
   * including this service's own chain query, hangs forever.
   */
  async setParent(companyId: string, goalId: string, parentGoalId: string | null) {
    const goal = await prisma.goal.findFirst({
      where: { id: goalId, companyId, deletedAt: null },
      select: { id: true, employeeId: true, parentGoalId: true, title: true },
    });
    if (!goal) throw new NotFoundError('Goal not found in the active company');
    await assertEmployeeInScope(goal.employeeId, 'performance');

    if (parentGoalId === null) {
      await prisma.goal.update({ where: { id: goal.id }, data: { parentGoalId: null } });
      return { id: goal.id, parentGoalId: null };
    }

    if (parentGoalId === goalId) throw new BadRequestError('A goal cannot be its own parent');

    const parent = await prisma.goal.findFirst({
      where: { id: parentGoalId, companyId, deletedAt: null },
      select: { id: true, parentGoalId: true },
    });
    // Cross-company parenting would let one tenant's objective hang under
    // another's, and the reader walking up would cross the boundary with it.
    if (!parent) throw new NotFoundError('Parent goal not found in the active company');

    // Walk up from the proposed parent: meeting this goal means a cycle.
    let cursor: string | null = parent.parentGoalId;
    let depth = 1;
    const seen = new Set<string>([parent.id]);
    while (cursor) {
      if (cursor === goalId) throw new BadRequestError('That parent would create a cycle in the goal hierarchy');
      if (seen.has(cursor)) {
        // Pre-existing loop in stored data: refuse rather than spin.
        throw new BadRequestError('The existing goal chain already contains a cycle; fix it before re-parenting');
      }
      seen.add(cursor);
      depth++;
      if (depth >= MAX_GOAL_DEPTH) {
        throw new BadRequestError(`Goal chain would exceed ${MAX_GOAL_DEPTH} levels`);
      }
      const next: { parentGoalId: string | null } | null = await prisma.goal.findFirst({
        where: { id: cursor, companyId },
        select: { parentGoalId: true },
      });
      cursor = next?.parentGoalId ?? null;
    }

    await prisma.goal.update({ where: { id: goal.id }, data: { parentGoalId } });
    logger.info('Goal parent set', { goalId, parentGoalId, companyId });
    return { id: goal.id, parentGoalId };
  }

  /** The chain from this goal up to the top, nearest first. */
  async chain(companyId: string, goalId: string) {
    const goal = await prisma.goal.findFirst({
      where: { id: goalId, companyId, deletedAt: null },
      select: { id: true, title: true, employeeId: true, progress: true, status: true, parentGoalId: true },
    });
    if (!goal) throw new NotFoundError('Goal not found in the active company');
    await assertEmployeeInScope(goal.employeeId, 'performance');

    const ancestors = [];
    const seen = new Set<string>([goal.id]);
    let cursor = goal.parentGoalId;

    while (cursor && ancestors.length < MAX_GOAL_DEPTH) {
      if (seen.has(cursor)) break; // stored loop: stop rather than hang
      seen.add(cursor);
      const parent = await prisma.goal.findFirst({
        where: { id: cursor, companyId, deletedAt: null },
        select: { id: true, title: true, employeeId: true, progress: true, status: true, parentGoalId: true },
      });
      if (!parent) break;
      ancestors.push(parent);
      cursor = parent.parentGoalId;
    }

    return { goal, ancestors };
  }

  /**
   * Children of a goal, with their progress.
   *
   * Progress is reported per child and averaged, but the parent's own progress
   * is left alone: the decision was a free reference, so a parent is not
   * defined as the sum of its children and overwriting what someone recorded
   * would be inventing a number.
   */
  async children(companyId: string, goalId: string) {
    const goal = await prisma.goal.findFirst({
      where: { id: goalId, companyId, deletedAt: null },
      select: { id: true, employeeId: true, progress: true },
    });
    if (!goal) throw new NotFoundError('Goal not found in the active company');
    await assertEmployeeInScope(goal.employeeId, 'performance');

    const children = await prisma.goal.findMany({
      where: { parentGoalId: goalId, companyId, deletedAt: null },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true, title: true, progress: true, status: true,
        employee: { select: { employeeNumber: true, fullName: true } },
      },
    });

    const averageChildProgress = children.length
      ? Math.round(children.reduce((sum, child) => sum + child.progress, 0) / children.length)
      : null;

    return {
      goalId,
      ownProgress: goal.progress,
      children,
      averageChildProgress,
    };
  }
}

export const goalHierarchyService = new GoalHierarchyService();
