import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describeSettings, validateSettingValue } from './company-settings.service';

/**
 * The catalogue exists so a client never has to keep its own copy of which
 * setting is a switch and which is a number. That only holds if the catalogue
 * says the same thing the validator enforces — a descriptor claiming `number`
 * for a key the boundary rejects as a boolean would send a tenant's save
 * straight into a 400, and one claiming a range the validator does not apply
 * would do the opposite. So this checks the two against each other by
 * behaviour, not by reading the same list twice.
 */
const descriptors = describeSettings();

describe('the company setting catalog matches the boundary that validates it', () => {
  it('describes every advertised setting exactly once', () => {
    expect(descriptors.length).toBeGreaterThanOrEqual(18);
    expect(new Set(descriptors.map((entry) => entry.key)).size).toBe(descriptors.length);
  });

  it('states a default each setting would itself accept', () => {
    for (const entry of descriptors) {
      expect(() => validateSettingValue(entry.key, entry.defaultValue)).not.toThrow();
    }
  });

  it.each(descriptors.filter((entry) => entry.type === 'boolean').map((entry) => entry.key))(
    '%s is a switch at the boundary too', (key) => {
      expect(() => validateSettingValue(key, 'true')).not.toThrow();
      expect(() => validateSettingValue(key, 'false')).not.toThrow();
      // Not merely "rejects nonsense": a numeric key would accept this.
      expect(() => validateSettingValue(key, '1')).toThrow();
    });

  it.each(descriptors.filter((entry) => entry.type === 'number').map((entry) => [entry.key, entry] as const))(
    '%s carries the range the boundary actually enforces', (_key, entry) => {
      const { key, min, max, integer } = entry;
      expect(min).toBeDefined();
      expect(max).toBeDefined();
      expect(() => validateSettingValue(key, String(min))).not.toThrow();
      expect(() => validateSettingValue(key, String(max))).not.toThrow();
      expect(() => validateSettingValue(key, String((max as number) + 1))).toThrow();
      expect(() => validateSettingValue(key, String((min as number) - 1))).toThrow();
      // The integer flag is a promise about what a client may submit.
      const fractional = String((min as number) + 0.5);
      if (integer) expect(() => validateSettingValue(key, fractional)).toThrow();
      else expect(() => validateSettingValue(key, fractional)).not.toThrow();
    });

  it('serves the catalog on its own path rather than as a setting named "catalog"', () => {
    // Express matches in order: '/:key' declared first would swallow this.
    // Comments are stripped first — the explanatory comment above the route
    // names '/:key' itself, and measuring against it made this assertion fail
    // on text that registers nothing. Same trap as the one the settings
    // unread test documents.
    const routes = readFileSync(join(__dirname, 'company-settings.routes.ts'), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
    expect(routes.indexOf("'/catalog'")).toBeGreaterThan(-1);
    expect(routes.indexOf("'/catalog'")).toBeLessThan(routes.indexOf("'/:key'"));
  });
});
