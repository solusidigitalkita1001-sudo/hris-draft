import fs from 'fs/promises';
import { Request, Response, NextFunction } from 'express';
import { BadRequestError } from '@/shared/exceptions/AppError';
import config from '@/config';

function detectAllowedFileMime(bytes: Buffer): string | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'image/jpeg';
  }
  if (bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return 'image/png';
  }
  const header6 = bytes.subarray(0, 6).toString('ascii');
  if (header6 === 'GIF87a' || header6 === 'GIF89a') return 'image/gif';
  if (bytes.length >= 5 && bytes.subarray(0, 5).toString('ascii') === '%PDF-') return 'application/pdf';
  return null;
}

/**
 * Task 1.2 (SEC-009/SEC-016): validate a file by its MAGIC BYTES, not the
 * client-supplied Content-Type. Catches `virus.exe.png` — an executable renamed
 * with an image extension has the wrong signature and is rejected.
 *
 * Positive allowlist: the content MUST be positively identified as one of the
 * allowed types. Anything the signature allowlist cannot identify (for example
 * an ELF binary) is rejected; every accepted format has a stable magic header.
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
        const handle = await fs.open(file.path, 'r');
        let detectedMime: string | null;
        try {
          const header = Buffer.alloc(16);
          const { bytesRead } = await handle.read(header, 0, header.length, 0);
          detectedMime = detectAllowedFileMime(header.subarray(0, bytesRead));
        } finally {
          await handle.close();
        }
        if (!detectedMime || !allowedMimes.includes(detectedMime)) {
          throw new BadRequestError(
            `Tipe file tidak diizinkan (terdeteksi ${detectedMime ?? 'tidak dikenal'})`
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
