import path from 'path';
import fs from 'fs/promises';
import { ForbiddenError } from '@/shared/exceptions/AppError';

export async function resolvePrivatePath(root: string, relative: string): Promise<string> {
  const base = await fs.realpath(root);
  const target = await fs.realpath(path.resolve(base, relative));
  const remainder = path.relative(base, target);
  if (!remainder || remainder.startsWith('..') || path.isAbsolute(remainder)) throw new ForbiddenError('Invalid file location');
  return target;
}

