import dns from 'node:dns/promises';
import net from 'node:net';
import config from '@/config';
import { BadRequestError } from '@/shared/exceptions/AppError';

/**
 * A webhook URL is an address the server will fetch on a tenant's instruction.
 * That makes it a server-side request forgery primitive unless it is fenced:
 * without these checks, a tenant could point a subscription at
 * `http://169.254.169.254/` and have the HRIS read cloud instance credentials
 * for them, or sweep internal services that no external client can reach.
 *
 * Two layers, because one is not enough:
 *  - at registration, so a bad URL is refused while a human is watching;
 *  - at delivery, on the resolved address, because DNS can point somewhere
 *    private after the fact (rebinding) and a hostname check cannot see that.
 */

/**
 * `new URL('https://[::1]/').hostname` keeps the brackets, and `net.isIP` does
 * not recognise a bracketed literal — so without stripping them, every IPv6
 * address walks straight past the private-range check. (It did; a test caught
 * it.)
 */
export function normaliseHost(hostname: string): string {
  return hostname.replace(/^\[|\]$/g, '');
}

/** Loopback, link-local, private and carrier-grade-NAT ranges. */
function isBlockedIpv4(address: string): boolean {
  const parts = address.split('.').map(Number);
  if (parts.length !== 4 || parts.some((part) => Number.isNaN(part))) return true;
  const [a, b] = parts;

  if (a === 0) return true;                       // "this network"
  if (a === 10) return true;                      // private
  if (a === 127) return true;                     // loopback
  if (a === 169 && b === 254) return true;        // link-local, incl. cloud metadata
  if (a === 172 && b >= 16 && b <= 31) return true; // private
  if (a === 192 && b === 168) return true;        // private
  if (a === 100 && b >= 64 && b <= 127) return true; // carrier-grade NAT
  if (a >= 224) return true;                      // multicast and reserved
  return false;
}

function isBlockedIpv6(address: string): boolean {
  const normalised = normaliseHost(address).toLowerCase();
  if (normalised === '::1' || normalised === '::') return true;
  if (normalised.startsWith('fe80')) return true;  // link-local
  if (/^f[cd]/.test(normalised)) return true;      // unique local

  // IPv4-mapped addresses hide a v4 address inside a v6 literal, and they come
  // in two spellings: the dotted `::ffff:10.0.0.1` a person types, and the hex
  // `::ffff:a00:1` that `new URL()` normalises it into. Only checking the
  // dotted form let the hex one straight through — a test caught that.
  const dotted = normalised.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (dotted) return isBlockedIpv4(dotted[1]);

  const hex = normalised.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
  if (hex) {
    const high = parseInt(hex[1], 16);
    const low = parseInt(hex[2], 16);
    return isBlockedIpv4([high >> 8, high & 0xff, low >> 8, low & 0xff].join('.'));
  }

  return false;
}


export function isBlockedAddress(address: string): boolean {
  const version = net.isIP(normaliseHost(address));
  const host = normaliseHost(address);
  if (version === 4) return isBlockedIpv4(host);
  if (version === 6) return isBlockedIpv6(host);
  return true; // not an IP at all: caller must resolve first
}

/**
 * Validate a subscriber-supplied URL. `allowInsecure` exists only so a
 * developer can point a subscription at their own machine; production config
 * never sets it, and the private-range check still applies either way.
 */
export function assertDeliverableUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new BadRequestError('Webhook URL is not a valid absolute URL');
  }

  const allowInsecure = config.app.env !== 'production';
  if (url.protocol !== 'https:' && !(allowInsecure && url.protocol === 'http:')) {
    throw new BadRequestError('Webhook URL must use https');
  }
  if (url.username || url.password) {
    throw new BadRequestError('Webhook URL must not embed credentials');
  }
  if (url.port && !['80', '443', '8443'].includes(url.port) && !allowInsecure) {
    throw new BadRequestError('Webhook URL must use port 443, 80 or 8443');
  }

  // A literal private address needs no DNS to be refused.
  const host = normaliseHost(url.hostname);
  if (net.isIP(host) && isBlockedAddress(host)) {
    throw new BadRequestError('Webhook URL must not point at a private or loopback address');
  }
  const hostname = url.hostname.toLowerCase();
  if (hostname === 'localhost' || hostname.endsWith('.localhost') || hostname.endsWith('.internal')) {
    throw new BadRequestError('Webhook URL must not point at a local or internal hostname');
  }

  return url;
}

/**
 * Re-check at delivery time against the addresses the hostname actually
 * resolves to. This is the half that survives DNS rebinding: a name that
 * resolved publicly at registration can resolve to 127.0.0.1 an hour later.
 */
export async function assertResolvesPublicly(hostname: string): Promise<void> {
  const host = normaliseHost(hostname);
  if (net.isIP(host)) {
    if (isBlockedAddress(host)) {
      throw new BadRequestError('Webhook host resolves to a private address');
    }
    return;
  }

  let records: Array<{ address: string }>;
  try {
    records = await dns.lookup(host, { all: true });
  } catch {
    throw new BadRequestError('Webhook host could not be resolved');
  }
  if (!records.length) throw new BadRequestError('Webhook host could not be resolved');
  if (records.some((record) => isBlockedAddress(record.address))) {
    throw new BadRequestError('Webhook host resolves to a private address');
  }
}
