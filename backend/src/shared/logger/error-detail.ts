/**
 * Turn a caught value into something a log can actually carry.
 *
 * `logger.error('...', { error })` with an Error instance serialises to `{}`:
 * `message`, `stack` and `cause` are non-enumerable, so JSON.stringify drops
 * them. Production told us a worker was crash-looping and said only
 * `"error": {}` — twenty-five restarts with nothing to diagnose. An error that
 * cannot be read is a second outage on top of the first.
 */
export function errorDetail(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    const detail: Record<string, unknown> = {
      name: error.name,
      message: error.message,
      // First lines only: a full stack in a log line buries the message.
      stack: error.stack?.split('\n').slice(0, 6).join('\n'),
    };
    // AMQP, Prisma and Node all attach their own fields; keep the ones that
    // identify a failure without dragging a whole object in.
    for (const key of ['code', 'errno', 'syscall', 'address', 'port', 'replyCode', 'replyText', 'clientVersion']) {
      const value = (error as unknown as Record<string, unknown>)[key];
      if (value !== undefined) detail[key] = value;
    }
    if (error.cause !== undefined) {
      detail.cause = error.cause instanceof Error
        ? { name: error.cause.name, message: error.cause.message }
        : String(error.cause);
    }
    return detail;
  }

  if (error === null || error === undefined) return { message: String(error) };
  if (typeof error === 'object') return { message: 'non-error object thrown', value: JSON.stringify(error).slice(0, 500) };
  return { message: String(error) };
}
