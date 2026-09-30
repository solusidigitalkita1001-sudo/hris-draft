import { errorDetail } from './error-detail';

/**
 * This exists because of a real outage note: the production worker crash-looped
 * twenty-five times and every line said `"error": {}`. An Error's `message`,
 * `stack` and `cause` are non-enumerable, so `JSON.stringify` drops them — the
 * log carried the fact of a failure and nothing about it.
 */
describe('errorDetail', () => {
  it('keeps the message, which is the whole point', () => {
    expect(errorDetail(new Error('ECONNREFUSED 10.0.0.5:5672'))).toMatchObject({
      name: 'Error',
      message: 'ECONNREFUSED 10.0.0.5:5672',
    });
  });

  it('would have survived JSON.stringify, unlike the raw Error', () => {
    const raw = JSON.stringify({ error: new Error('boom') });
    const fixed = JSON.stringify({ error: errorDetail(new Error('boom')) });

    expect(raw).toBe('{"error":{}}');      // what production actually logged
    expect(fixed).toContain('boom');
  });

  it('trims the stack to the first frames, so the message is not buried', () => {
    const detail = errorDetail(new Error('deep'));
    expect(String(detail.stack).split('\n').length).toBeLessThanOrEqual(6);
    expect(String(detail.stack)).toContain('deep');
  });

  /** AMQP, Prisma and Node each attach their own identifying fields. */
  it.each([
    ['code', 'ECONNREFUSED'],
    ['errno', -111],
    ['syscall', 'connect'],
    ['address', '10.0.0.5'],
    ['port', 5672],
    ['replyCode', 403],
    ['replyText', 'ACCESS_REFUSED - Login was refused'],
    ['clientVersion', '5.22.0'],
  ])('carries %s when the error has it', (key, value) => {
    const error = Object.assign(new Error('connect failed'), { [key]: value });
    expect(errorDetail(error)[key]).toBe(value);
  });

  it('ignores fields the error does not have rather than filling them with undefined', () => {
    expect(Object.keys(errorDetail(new Error('plain')))).toEqual(['name', 'message', 'stack']);
  });

  it('follows a cause one level, which is where the real reason usually is', () => {
    const error = new Error('bootstrap failed', { cause: new Error('ACCESS_REFUSED') });
    expect(errorDetail(error).cause).toMatchObject({ message: 'ACCESS_REFUSED' });
  });

  it('renders a non-Error cause as text instead of dropping it', () => {
    expect(errorDetail(new Error('wrapped', { cause: 'timeout' })).cause).toBe('timeout');
  });

  it.each([
    ['a string', 'just a string', 'just a string'],
    ['a number', 42, '42'],
    ['null', null, 'null'],
    ['undefined', undefined, 'undefined'],
  ])('handles %s being thrown', (_label, thrown, expected) => {
    expect(errorDetail(thrown).message).toBe(expected);
  });

  it('summarises a thrown plain object instead of pretending it is an Error', () => {
    const detail = errorDetail({ replyCode: 403, replyText: 'refused' });
    expect(detail.message).toBe('non-error object thrown');
    expect(String(detail.value)).toContain('403');
  });

  it('caps a huge thrown object so one log line cannot swallow the file', () => {
    const detail = errorDetail({ blob: 'x'.repeat(5000) });
    expect(String(detail.value).length).toBeLessThanOrEqual(500);
  });
});
