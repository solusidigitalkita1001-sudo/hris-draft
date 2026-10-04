import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * The self-service payslip unlock sends its token in X-Payslip-Unlock, read at
 * payroll.controller.ts. A browser on another origin cannot send a header the
 * CORS allowlist omits — the preflight strips it and the request arrives
 * unlocked, which looks like a wrong PIN rather than a missing configuration.
 *
 * This is asserted against the source text rather than by booting the app:
 * every custom request header the code reads must appear in the allowlist, so
 * adding a third unlock path cannot silently repeat the omission.
 */
describe('CORS allowlist covers the custom headers the API reads', () => {
  const read = (...parts: string[]) => readFileSync(join(__dirname, ...parts), 'utf8');
  const allowlist = read('..', '..', 'app.ts').match(/allowedHeaders:\s*\[([^\]]+)\]/)?.[1] ?? '';

  it.each(['X-Payslip-Unlock', 'X-Payroll-Unlock-Token', 'Idempotency-Key'])(
    'allows %s',
    (header) => {
      expect(allowlist).toContain(header);
    },
  );

  it('allows every x- header the payroll controller reads from the request', () => {
    const controller = read('payroll.controller.ts');
    const read_headers = [...controller.matchAll(/req\.headers\['(x-[a-z-]+)'\]/g)].map(match => match[1]);
    expect(read_headers.length).toBeGreaterThan(0);
    for (const header of read_headers) {
      expect(allowlist.toLowerCase()).toContain(header);
    }
  });
});
