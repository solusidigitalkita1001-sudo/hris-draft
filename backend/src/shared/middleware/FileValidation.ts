import fs from 'fs/promises';
import { fromFile } from 'file-type';
import { Request, Response, NextFunction } from 'express';
import { BadRequestError } from '@/shared/exceptions/AppError';
import config from '@/config';

/**
 * Task 1.2 (SEC-009/SEC-016): validate a file by its MAGIC BYTES, not the
 * client-supplied Content-Type. Catches `virus.exe.png` — an executable renamed
 * with an image extension has the wrong signature and is rejected.
 *
 * Positive allowlist: the content MUST be positively identified as one of the
 * allowed types. Anything file-type can't identify (e.g. an ELF binary it
 * doesn't recognise) is rejected too — this route only accepts binary formats
 * that all carry a known signature, so "undetected" is never legitimate here.
 */
export function validateFileMagicBytes(allowedMimes: string[] = config.upload.allowedMimes) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    const files: Express.Multer.File[] = req.file
      ? [req.file]
      : Array.isArray(req.files)
        ? req.files
        : Object.values(req.files ?? {}).flat();

    try {
      for (const file of files) {
        if (!file?.path) continue;
        const detected = await fromFile(file.path);
        if (!detected || !allowedMimes.includes(detected.mime)) {
          throw new BadRequestError(
            `Tipe file tidak diizinkan (terdeteksi ${detected?.mime ?? 'tidak dikenal'})`
          );
        }
      }
      next();
    } catch (err) {
      // Reject the whole request: remove every uploaded file from disk.
      await Promise.all(files.map((f) => (f?.path ? fs.unlink(f.path).catch(() => {}) : null)));
      next(err);
    }
  };
}
