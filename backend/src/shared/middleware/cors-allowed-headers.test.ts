import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

/**
 * A custom request header the API reads but CORS does not allow is stripped at
 * preflight for any cross-origin browser, so the request arrives looking as if
 * the client never sent it. That failure mode does not announce itself: the
 * payslip unlock read as a wrong PIN, and X-Client-Type going missing would
 * silently drop a WebView back to the cookie flow.
 *
 * So the allowlist is checked against the code rather than maintained by hand:
 * every `x-…` header any handler reads off the request must be listed. Adding
 * a reader without the allowlist entry fails here instead of in a browser.
 */
const SRC = resolve(__dirname, '..', '..');

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return entry.endsWith('.ts') && !entry.includes('.test.') ? [path] : [];
  });
}

const READS_HEADER = /req(?:uest)?\.(?:headers\[['"](x-[a-z0-9-]+)['"]\]|header\(['"]([Xx]-[A-Za-z0-9-]+)['"]\)|get\(['"]([Xx]-[A-Za-z0-9-]+)['"]\))/g;

describe('CORS allowlist covers every custom request header the API reads', () => {
  const allowlist = readFileSync(join(SRC, 'app.ts'), 'utf8')
    .match(/allowedHeaders:\s*\[([\s\S]*?)\]/)?.[1]
    .toLowerCase() ?? '';

  const read = new Map<string, string>();
  for (const file of sourceFiles(SRC)) {
    const contents = readFileSync(file, 'utf8');
    for (const match of contents.matchAll(READS_HEADER)) {
      const header = (match[1] ?? match[2] ?? match[3]).toLowerCase();
      if (!read.has(header)) read.set(header, `${file.slice(SRC.length + 1)}`);
    }
  }

  it('found the headers to check at all', () => {
    // Guards the regex itself: if it stops matching, the suite must fail loudly
    // rather than pass by having nothing left to assert.
    expect(read.size).toBeGreaterThanOrEqual(4);
    expect([...read.keys()]).toContain('x-client-type');
    expect([...read.keys()]).toContain('x-payslip-unlock');
  });

  it('allows each one', () => {
    const missing = [...read.entries()]
      .filter(([header]) => !allowlist.includes(header))
      .map(([header, where]) => `${header} (read in ${where})`);
    expect(missing).toEqual([]);
  });
});
