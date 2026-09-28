import { Prisma } from '@prisma/client';
import { ConflictError } from '@/shared/exceptions/AppError';
import { isConcurrencyFailure, withConcurrencyRetry } from './concurrency';

const known = (code: string, message = 'failed') =>
  new Prisma.PrismaClientKnownRequestError(message, { code, clientVersion: '5.0.0' });

// The shape the real-database suite actually produced: the company row lock is
// a raw statement, so a deadlock arrives as P2010 carrying the MySQL code.
const RAW_DEADLOCK = 'Invalid `prisma.$queryRaw()` invocation:\n\nRaw query failed. '
  + 'Code: `1213`. Message: `Deadlock found when trying to get lock; try restarting transaction`';
const RAW_LOCK_TIMEOUT = 'Raw query failed. Code: `1205`. Message: `Lock wait timeout exceeded`';

describe('isConcurrencyFailure', () => {
  it.each([
    ['P2034 write conflict', known('P2034')],
    ['P2024 pool timeout', known('P2024')],
    ['P2010 raw deadlock', known('P2010', RAW_DEADLOCK)],
    ['P2010 raw lock timeout', known('P2010', RAW_LOCK_TIMEOUT)],
    ['unknown deadlock', new Prisma.PrismaClientUnknownRequestError('Deadlock found', { clientVersion: '5.0.0' })],
  ])('recognises %s', (_label, error) => {
    expect(isConcurrencyFailure(error)).toBe(true);
  });

  it.each([
    ['P2002 unique constraint', known('P2002')],
    ['P2025 missing record', known('P2025')],
    ['P2010 unrelated raw failure', known('P2010', 'Raw query failed. Code: `1064`. Message: `You have an error in your SQL syntax`')],
    ['a plain error', new Error('Disk on fire')],
    ['a conflict we raised ourselves', new ConflictError('Already exists')],
  ])('does not mistake %s for contention', (_label, error) => {
    expect(isConcurrencyFailure(error)).toBe(false);
  });
});

describe('withConcurrencyRetry', () => {
  it('returns the first success without retrying', async () => {
    const work = jest.fn().mockResolvedValue('ok');
    await expect(withConcurrencyRetry(work, 'conflict')).resolves.toBe('ok');
    expect(work).toHaveBeenCalledTimes(1);
  });

  it('retries a lost race and returns the winning attempt', async () => {
    const work = jest.fn()
      .mockRejectedValueOnce(known('P2010', RAW_DEADLOCK))
      .mockResolvedValueOnce('ok');
    await expect(withConcurrencyRetry(work, 'conflict')).resolves.toBe('ok');
    expect(work).toHaveBeenCalledTimes(2);
  });

  it('reports a retryable conflict once the attempts are spent', async () => {
    const work = jest.fn().mockRejectedValue(known('P2010', RAW_DEADLOCK));
    await expect(withConcurrencyRetry(work, 'try again')).rejects.toMatchObject({
      statusCode: 409, message: 'try again',
    });
    expect(work).toHaveBeenCalledTimes(3);
  });

  it('never retries or rewrites an unrelated failure', async () => {
    const work = jest.fn().mockRejectedValue(new Error('Disk on fire'));
    await expect(withConcurrencyRetry(work, 'conflict')).rejects.toThrow('Disk on fire');
    expect(work).toHaveBeenCalledTimes(1);
  });
});
