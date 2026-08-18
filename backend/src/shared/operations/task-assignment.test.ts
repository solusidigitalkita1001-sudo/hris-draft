import {
  isTaskTransitionValid,
  isFeedbackValid,
  isProgressValid,
  sortTaskByPriority,
} from './task-assignment';

describe('C.6 Task Assignment pure functions', () => {
  it('C.6 CASE1: FSM chain TODO → IN_PROGRESS → REVIEW → DONE = semua allowed.', () => {
    expect(isTaskTransitionValid('TODO', 'IN_PROGRESS').allowed).toBe(true);
    expect(isTaskTransitionValid('IN_PROGRESS', 'REVIEW').allowed).toBe(true);
    expect(isTaskTransitionValid('REVIEW', 'DONE').allowed).toBe(true);
  });

  it('C.6 CASE2: Skip REVIEW gate TODO → DONE = invalid (byPass=false). Admin byPass/allowForceDone = allowed.', () => {
    expect(isTaskTransitionValid('TODO', 'DONE').allowed).toBe(false);
    expect(isTaskTransitionValid('TODO', 'DONE', { allowForceDone: true }).allowed).toBe(true);
    expect(isTaskTransitionValid('TODO', 'DONE', { byPass: true }).allowed).toBe(true);
  });

  it('C.6 CASE3: Status final DONE & CANCELLED = zero outgoing transitions. REVIEW→REVIEW same status auto pass.', () => {
    expect(isTaskTransitionValid('DONE', 'CANCELLED').allowed).toBe(false);
    expect(isTaskTransitionValid('CANCELLED', 'REVIEW').allowed).toBe(false);
    expect(isTaskTransitionValid('DONE', 'DONE').allowed).toBe(true);
  });

  it('C.6 CASE4: priority URGENT > HIGH > MEDIUM > LOW. sortTaskByPriority order URGENT dulu, LOW paling belakang.', () => {
    const tasks = [
      { id: '1', priority: 'LOW' as const },
      { id: '2', priority: 'URGENT' as const },
      { id: '3', priority: 'MEDIUM' as const },
      { id: '4', priority: 'HIGH' as const },
    ];
    const sorted = sortTaskByPriority(tasks).map(t => t.id);
    expect(sorted).toEqual(['2', '4', '3', '1']);
  });

  it('C.6 CASE5: feedbackStar 1-5 true, luar false. progress 0..100 integer only; null/undefined safe guards.', () => {
    expect(isFeedbackValid(3)).toBe(true);
    expect(isFeedbackValid(5)).toBe(true);
    expect(isFeedbackValid(0)).toBe(false);
    expect(isFeedbackValid(6)).toBe(false);
    expect(isFeedbackValid(3.5)).toBe(false);
    expect(isProgressValid(0)).toBe(true);
    expect(isProgressValid(100)).toBe(true);
    expect(isProgressValid(-1)).toBe(false);
    expect(isProgressValid(101)).toBe(false);
    expect(isProgressValid('100' as any)).toBe(false);
    expect(isTaskTransitionValid(null, 'TODO').allowed).toBe(false);
    expect(isTaskTransitionValid('TODO', 'BAD' as any).allowed).toBe(false);
  });
});
