import { randomBytes } from 'crypto';

type GenerateSystemCodeOptions = {
  prefix: string;
  label?: string;
  maxLength?: number;
  exists?: (candidate: string) => Promise<boolean>;
};

function normalizeSegment(value: string, maxLength = 10) {
  const normalized = value
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');

  return normalized.slice(0, maxLength) || 'ITEM';
}

function buildCandidate(prefix: string, label?: string, maxLength = 50) {
  const date = new Date().toISOString().slice(2, 10).replace(/-/g, '');
  // [Finding #13] CSPRNG crypto.randomBytes menggantikan Math.random untuk security-sensitive suffix
  const random = randomBytes(3).toString('hex').slice(0, 4).toUpperCase();
  const segments = [normalizeSegment(prefix, 12)];

  if (label?.trim()) {
    segments.push(normalizeSegment(label, 12));
  }

  segments.push(date, random);
  return segments.join('-').slice(0, maxLength);
}

export async function generateSystemCode(options: GenerateSystemCodeOptions) {
  const maxLength = options.maxLength ?? 50;

  for (let attempt = 0; attempt < 12; attempt += 1) {
    const candidate = buildCandidate(options.prefix, options.label, maxLength);
    if (!options.exists) {
      return candidate;
    }

    const taken = await options.exists(candidate);
    if (!taken) {
      return candidate;
    }
  }

  throw new Error(`Unable to generate unique system code for prefix ${options.prefix}`);
}
