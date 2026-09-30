jest.mock('@/config', () => {
  const actual = jest.requireActual('@/config');
  return { ...actual, __esModule: true, default: { ...actual.default, app: { ...actual.default.app, env: 'production' } } };
});

import { assertDeliverableUrl, isBlockedAddress } from './webhook-url-guard';

/**
 * A webhook URL is an address the server fetches on a tenant's instruction, so
 * an unfenced one is a server-side request forgery primitive: point it at the
 * cloud metadata service and the HRIS reads instance credentials on the
 * tenant's behalf, or sweep internal services no external client can reach.
 */
describe('webhook URL guard (production posture)', () => {
  it('accepts an ordinary https endpoint', () => {
    expect(assertDeliverableUrl('https://hooks.example.com/hris').hostname).toBe('hooks.example.com');
  });

  it.each([
    ['http, because a payload would travel in the clear', 'http://hooks.example.com/hris'],
    ['a non-http scheme', 'file:///etc/passwd'],
    ['embedded credentials', 'https://user:pass@hooks.example.com/hris'],
    ['a non-standard port', 'https://hooks.example.com:9200/hris'],
    ['localhost by name', 'https://localhost/hris'],
    ['a .localhost suffix', 'https://api.localhost/hris'],
    ['an .internal suffix', 'https://payroll.internal/hris'],
    ['loopback by address', 'https://127.0.0.1/hris'],
    ['IPv6 loopback', 'https://[::1]/hris'],
    ['a private 10/8 address', 'https://10.1.2.3/hris'],
    ['a private 192.168/16 address', 'https://192.168.1.10/hris'],
    ['a private 172.16/12 address', 'https://172.20.0.5/hris'],
    ['cloud metadata', 'https://169.254.169.254/latest/meta-data/'],
    ['an IPv4-mapped IPv6 private address', 'https://[::ffff:10.0.0.1]/hris'],
    ['a unique-local IPv6 address', 'https://[fd00::1]/hris'],
    ['nonsense that is not a URL', 'not-a-url'],
  ])('refuses %s', (_label, url) => {
    expect(() => assertDeliverableUrl(url)).toThrow();
  });

  /** The address check is used again at delivery, against resolved addresses. */
  it.each([
    ['127.0.0.53', true],
    ['10.0.0.1', true],
    ['169.254.169.254', true],
    ['172.31.255.255', true],
    ['172.32.0.1', false],
    ['100.64.0.1', true],
    ['0.0.0.0', true],
    ['224.0.0.1', true],
    ['8.8.8.8', false],
    ['203.0.113.10', false],
    ['::1', true],
    ['fe80::1', true],
    ['2606:4700::1111', false],
    ['definitely-not-an-ip', true],
  ])('classifies %s as blocked=%s', (address, blocked) => {
    expect(isBlockedAddress(address)).toBe(blocked);
  });
});
