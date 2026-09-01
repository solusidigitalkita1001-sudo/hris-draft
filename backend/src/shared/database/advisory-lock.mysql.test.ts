import { randomUUID } from 'node:crypto';
import prisma from '@/shared/database/prisma';
import { withDatabaseAdvisoryLock } from './advisory-lock';

const describeWithMysql = process.env.RUN_DB_INTEGRATION === '1' ? describe : describe.skip;

describeWithMysql('withDatabaseAdvisoryLock (real MySQL)', () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('serializes two concurrent operations using the same lock key', async () => {
    const lockKey = `jest:${randomUUID()}`;
    const events: string[] = [];

    let markFirstEntered!: () => void;
    const firstEntered = new Promise<void>((resolve) => {
      markFirstEntered = resolve;
    });

    let releaseFirst!: () => void;
    const firstMayExit = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });

    let markSecondEntered!: () => void;
    const secondEntered = new Promise<void>((resolve) => {
      markSecondEntered = resolve;
    });

    const first = withDatabaseAdvisoryLock('integration-test', lockKey, async () => {
      events.push('first-enter');
      markFirstEntered();
      await firstMayExit;
      events.push('first-exit');
    });

    await firstEntered;

    const second = withDatabaseAdvisoryLock('integration-test', lockKey, async () => {
      events.push('second-enter');
      markSecondEntered();
      events.push('second-exit');
    });

    const earlySecondEntry = await Promise.race([
      secondEntered.then(() => true),
      new Promise<false>((resolve) => setTimeout(() => resolve(false), 150)),
    ]);

    expect(earlySecondEntry).toBe(false);
    expect(events).toEqual(['first-enter']);

    releaseFirst();
    await Promise.all([first, second]);

    expect(events).toEqual(['first-enter', 'first-exit', 'second-enter', 'second-exit']);
  });
});
