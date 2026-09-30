type Row = Record<string, unknown>;

const state: { goals: Row[]; updates: Array<{ where: Row; data: Row }> } = { goals: [], updates: [] };

const find = (where: Row) =>
  state.goals.find((goal) =>
    Object.entries(where).every(([key, value]) => {
      if (value === null) return goal[key] == null;
      if (key === 'deletedAt') return true;
      return goal[key] === value;
    })) ?? null;

jest.mock('@/shared/database/prisma', () => {
  const client = {
    goal: {
      findFirst: jest.fn(async ({ where }: { where: Row }) => find(where)),
      findMany: jest.fn(async ({ where }: { where: Row }) =>
        state.goals.filter((goal) => goal.parentGoalId === where.parentGoalId)),
      update: jest.fn(async ({ where, data }: { where: Row; data: Row }) => {
        state.updates.push({ where, data });
        const goal = state.goals.find((row) => row.id === where.id);
        if (goal) Object.assign(goal, data);
        return goal;
      }),
    },
  };
  return { __esModule: true, default: client, prisma: client };
});
jest.mock('@/shared/logger/WinstonLogger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));
jest.mock('@/shared/security/employee-data-scope', () => ({ assertEmployeeInScope: jest.fn(async () => undefined) }));

import { GoalHierarchyService, MAX_GOAL_DEPTH } from './goal-hierarchy.service';

const service = new GoalHierarchyService();
const COMPANY = 'company-a';

const goal = (id: string, over: Row = {}) => ({
  id, companyId: COMPANY, employeeId: 'employee-1', title: `Goal ${id}`,
  progress: 0, status: 'IN_PROGRESS', parentGoalId: null, deletedAt: null,
  employee: { employeeNumber: 'EMP001', fullName: 'Maya Putri' },
  ...over,
});

beforeEach(() => {
  jest.clearAllMocks();
  state.goals = [];
  state.updates = [];
});

/**
 * The decision was a free reference rather than formal cascade: formal cascade
 * assumes an organisational goal structure that is rarely settled when a system
 * is new, and insisting on it produces a tree filled in carelessly to satisfy
 * the form — worse than no tree at all.
 */
describe('pointing a goal at a parent', () => {
  it('sets the parent', async () => {
    state.goals = [goal('child'), goal('parent')];

    await expect(service.setParent(COMPANY, 'child', 'parent')).resolves.toMatchObject({ parentGoalId: 'parent' });
    expect(state.updates[0].data).toMatchObject({ parentGoalId: 'parent' });
  });

  it('clears the parent with null', async () => {
    state.goals = [goal('child', { parentGoalId: 'parent' }), goal('parent')];

    await expect(service.setParent(COMPANY, 'child', null)).resolves.toMatchObject({ parentGoalId: null });
    expect(state.updates[0].data).toMatchObject({ parentGoalId: null });
  });

  it('refuses a goal as its own parent', async () => {
    state.goals = [goal('solo')];
    await expect(service.setParent(COMPANY, 'solo', 'solo')).rejects.toThrow(/cannot be its own parent/i);
  });

  /**
   * The check that matters most: without it a chain can be closed into a loop,
   * and every reader that walks upwards — including the chain query here —
   * hangs forever.
   */
  it('refuses a parent that would close a cycle', async () => {
    state.goals = [
      goal('a'),
      goal('b', { parentGoalId: 'a' }),
      goal('c', { parentGoalId: 'b' }),
    ];

    // a → c would close a → b → c → a.
    await expect(service.setParent(COMPANY, 'a', 'c')).rejects.toThrow(/would create a cycle/i);
    expect(state.updates).toEqual([]);
  });

  it('allows a sibling branch that does not close a cycle', async () => {
    state.goals = [goal('root'), goal('branch', { parentGoalId: 'root' }), goal('leaf')];
    await expect(service.setParent(COMPANY, 'leaf', 'branch')).resolves.toMatchObject({ parentGoalId: 'branch' });
  });

  /** Cross-company parenting would let one tenant's objective hang under another's. */
  it('refuses a parent from another company', async () => {
    state.goals = [goal('child'), { ...goal('foreign'), companyId: 'company-b' }];
    await expect(service.setParent(COMPANY, 'child', 'foreign')).rejects.toThrow(/Parent goal not found/i);
  });

  it('refuses a goal from another company', async () => {
    state.goals = [{ ...goal('foreign'), companyId: 'company-b' }, goal('parent')];
    await expect(service.setParent(COMPANY, 'foreign', 'parent')).rejects.toThrow(/Goal not found/i);
  });

  it(`refuses a chain deeper than ${MAX_GOAL_DEPTH} levels`, async () => {
    // A chain of MAX_GOAL_DEPTH goals already exists; hanging one more under
    // its tip must be refused.
    state.goals = [goal('level-0')];
    for (let level = 1; level < MAX_GOAL_DEPTH + 1; level++) {
      state.goals.push(goal(`level-${level}`, { parentGoalId: `level-${level - 1}` }));
    }
    state.goals.push(goal('newcomer'));

    await expect(service.setParent(COMPANY, 'newcomer', `level-${MAX_GOAL_DEPTH}`))
      .rejects.toThrow(new RegExp(`exceed ${MAX_GOAL_DEPTH} levels`));
  });

  /** Stored data can already be looping; refuse rather than spin on it. */
  it('refuses when the existing chain already contains a cycle', async () => {
    state.goals = [
      goal('x', { parentGoalId: 'y' }),
      goal('y', { parentGoalId: 'x' }),
      goal('newcomer'),
    ];

    await expect(service.setParent(COMPANY, 'newcomer', 'x')).rejects.toThrow(/already contains a cycle/i);
  });
});

describe('reading the chain', () => {
  it('walks up to the top, nearest first', async () => {
    state.goals = [
      goal('company-goal'),
      goal('division-goal', { parentGoalId: 'company-goal' }),
      goal('my-goal', { parentGoalId: 'division-goal' }),
    ];

    const result = await service.chain(COMPANY, 'my-goal');

    expect(result.goal.id).toBe('my-goal');
    expect(result.ancestors.map((row) => row.id)).toEqual(['division-goal', 'company-goal']);
  });

  it('returns no ancestors for a goal with no parent', async () => {
    state.goals = [goal('solo')];
    await expect(service.chain(COMPANY, 'solo')).resolves.toMatchObject({ ancestors: [] });
  });

  it('stops instead of hanging on a stored loop', async () => {
    state.goals = [goal('p', { parentGoalId: 'q' }), goal('q', { parentGoalId: 'p' })];
    const result = await service.chain(COMPANY, 'p');
    expect(result.ancestors.length).toBeLessThanOrEqual(2);
  });
});

describe('reading the children', () => {
  it('lists children and averages their progress', async () => {
    state.goals = [
      goal('parent', { progress: 10 }),
      goal('child-a', { parentGoalId: 'parent', progress: 40 }),
      goal('child-b', { parentGoalId: 'parent', progress: 70 }),
    ];

    const result = await service.children(COMPANY, 'parent');

    expect(result.children.map((child) => child.id)).toEqual(['child-a', 'child-b']);
    expect(result.averageChildProgress).toBe(55);
  });

  /**
   * A free reference means a parent is not defined as the sum of its children,
   * so the parent's own recorded progress is reported untouched — overwriting
   * it would be inventing a number.
   */
  it('reports the parent progress separately and leaves it alone', async () => {
    state.goals = [
      goal('parent', { progress: 10 }),
      goal('child-a', { parentGoalId: 'parent', progress: 100 }),
    ];

    const result = await service.children(COMPANY, 'parent');

    expect(result.ownProgress).toBe(10);
    expect(state.updates).toEqual([]);
  });

  it('returns a null average when there are no children', async () => {
    state.goals = [goal('lonely')];
    await expect(service.children(COMPANY, 'lonely')).resolves.toMatchObject({
      children: [], averageChildProgress: null,
    });
  });
});
