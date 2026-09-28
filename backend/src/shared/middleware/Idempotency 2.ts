import crypto from 'node:crypto';
import type { NextFunction, Response } from 'express';
import config from '@/config';
import { redisCache } from '@/infrastructure/cache/RedisCache';
import type { AuthenticatedRequest } from './Authenticate';
import { ConflictError, ValidationError } from '@/shared/exceptions/AppError';

interface IdempotencyRecord {
  fingerprint: string;
  state: 'PENDING' | 'COMPLETED';
  statusCode?: number;
  body?: unknown;
  expiresAt: number;
}

const memory = new Map<string, IdempotencyRecord>();

function digest(value: string) {
  return crypto.createHash('sha256').update(value, 'utf8').digest('hex');
}

/**
 * JSON object key order is not part of the request's meaning. Canonicalizing
 * before hashing prevents an otherwise identical retry from being rejected
 * merely because a client serializer emitted keys in a different order.
 */
function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, nested]) => nested !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nested]) => [key, canonicalize(nested)]),
    );
  }
  return value;
}

function memoryGet(key: string): IdempotencyRecord | null {
  const record = memory.get(key);
  if (!record) return null;
  if (record.expiresAt <= Date.now()) {
    memory.delete(key);
    return null;
  }
  return record;
}

async function getRecord(key: string): Promise<IdempotencyRecord | null> {
  return config.redis.enabled ? redisCache.get<IdempotencyRecord>(key) : memoryGet(key);
}

async function reserve(key: string, record: IdempotencyRecord, ttlSeconds: number): Promise<boolean> {
  if (config.redis.enabled) return redisCache.setIfAbsent(key, record, ttlSeconds);
  if (memoryGet(key)) return false;
  memory.set(key, record);
  return true;
}

async function save(key: string, record: IdempotencyRecord, ttlSeconds: number) {
  if (config.redis.enabled) await redisCache.set(key, record, ttlSeconds);
  else memory.set(key, record);
}

async function release(key: string) {
  if (config.redis.enabled) await redisCache.delete(key);
  else memory.delete(key);
}

function replayOrThrow(record: IdempotencyRecord, fingerprint: string, res: Response): boolean {
  if (record.fingerprint !== fingerprint) {
    throw new ConflictError('Idempotency-Key was already used with a different request payload');
  }
  if (record.state === 'PENDING') {
    throw new ConflictError('A request with this Idempotency-Key is still in progress');
  }
  res.setHeader('Idempotency-Replayed', 'true');
  res.status(record.statusCode ?? 200).json(record.body);
  return true;
}

/**
 * Replays a successful mutation for 24 hours. The scope includes tenant,
 * actor, method and path, so keys may safely be reused for unrelated actions.
 * Supplying the same key with a different payload fails with 409.
 */
export function idempotency(ttlSeconds = 24 * 60 * 60) {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const rawKey = req.get('Idempotency-Key');
      if (!rawKey) return next();
      if (!/^[!-~]{16,128}$/.test(rawKey)) {
        throw new ValidationError('Invalid Idempotency-Key', [
          { field: 'Idempotency-Key', message: 'Use 16 to 128 visible ASCII characters without spaces' },
        ]);
      }
      if (!req.user) throw new ValidationError('Idempotency requires authentication');

      const path = `${req.baseUrl}${req.path}`;
      const scope = `${req.user.companyId ?? 'none'}:${req.user.id}:${req.method}:${path}:${rawKey}`;
      const storageKey = `idempotency:mobile:${digest(scope)}`;
      const fingerprint = digest(JSON.stringify(canonicalize({
        body: req.body ?? null,
        query: req.query ?? null,
      })));
      const existing = await getRecord(storageKey);
      if (existing && replayOrThrow(existing, fingerprint, res)) return;

      const pending: IdempotencyRecord = {
        fingerprint,
        state: 'PENDING',
        expiresAt: Date.now() + ttlSeconds * 1000,
      };
      if (!await reserve(storageKey, pending, ttlSeconds)) {
        const raced = await getRecord(storageKey);
        if (raced && replayOrThrow(raced, fingerprint, res)) return;
        throw new ConflictError('A request with this Idempotency-Key is still in progress');
      }

      const originalJson = res.json.bind(res);
      let responseFinalized = false;
      res.json = function json(body: unknown) {
        if (responseFinalized) return res;
        responseFinalized = true;
        const statusCode = res.statusCode;

        // Persist only completed success responses. Validation, permission,
        // conflict and server failures must remain retryable with the same key.
        // Delay sending the response until Redis has durably replaced PENDING,
        // otherwise an immediate retry can observe a false in-progress conflict.
        const finalize = statusCode >= 200 && statusCode < 300
          ? save(storageKey, {
              fingerprint,
              state: 'COMPLETED',
              statusCode,
              body,
              expiresAt: pending.expiresAt,
            }, ttlSeconds)
          : release(storageKey);

        void finalize
          .then(() => originalJson(body))
          .catch(async (error) => {
            await release(storageKey).catch(() => undefined);
            next(error);
          });
        return res;
      };
      res.on('close', () => {
        if (!res.writableFinished) void release(storageKey);
      });
      next();
    } catch (error) {
      next(error);
    }
  };
}
