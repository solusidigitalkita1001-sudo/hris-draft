import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { WEBHOOK_EVENTS, WEBHOOK_EVENTS_PENDING_PUBLISHERS } from './webhook-events';
import { DomainEvents } from '@/shared/events/events';

/**
 * The catalogue advertised sixteen events; six were ever published. The other
 * ten delivered silence, which a subscriber cannot distinguish from "nothing
 * happened" — so an integrator building against `employee.created` would have
 * concluded the HRIS had no staff changes.
 *
 * The file's own comment already said why that is the worst kind of error: "a
 * published name is a promise". This keeps the promise checkable, by requiring
 * every advertised event to have somewhere that publishes it.
 */
const SRC = resolve(__dirname, '..', '..');

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return entry.endsWith('.ts') && !entry.includes('.test.') && entry !== 'webhook-events.ts'
      ? [path]
      : [];
  });
}

/** DomainEvents keys that some handler actually publishes on the bus. */
function publishedEventKeys(): Map<string, string> {
  const published = new Map<string, string>();
  for (const file of sourceFiles(SRC)) {
    const contents = readFileSync(file, 'utf8');
    for (const match of contents.matchAll(/name:\s*DomainEvents\.(\w+)/g)) {
      if (!published.has(match[1])) published.set(match[1], file.slice(SRC.length + 1));
    }
  }
  return published;
}

const keyOf = (value: string) =>
  Object.keys(DomainEvents).find(key => (DomainEvents as Record<string, string>)[key] === value) ?? value;

describe('the webhook catalogue is a promise that can be checked', () => {
  const published = publishedEventKeys();

  it('finds publishers at all', () => {
    // A broken scan would otherwise let the suite pass with nothing to assert.
    expect(published.size).toBeGreaterThanOrEqual(5);
  });

  it('advertises only events something publishes', () => {
    const silent = WEBHOOK_EVENTS.map(keyOf).filter(key => !published.has(key));

    expect(silent).toEqual([]);
  });

  it('keeps the pending list honestly pending — none of them has a publisher yet', () => {
    // If one of these gains a publisher, move it into WEBHOOK_EVENTS; this
    // failing is the reminder to do so, not a reason to delete the case.
    const nowPublished = WEBHOOK_EVENTS_PENDING_PUBLISHERS.map(keyOf).filter(key => published.has(key));

    expect(nowPublished).toEqual([]);
  });

  it('does not list the same event as both advertised and pending', () => {
    const overlap = WEBHOOK_EVENTS.filter(event => WEBHOOK_EVENTS_PENDING_PUBLISHERS.includes(event));

    expect(overlap).toEqual([]);
  });
});
