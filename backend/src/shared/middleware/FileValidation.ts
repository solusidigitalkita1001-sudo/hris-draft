import fs from 'fs/promises';
import path from 'path';
import { Request, Response, NextFunction } from 'express';
import { BadRequestError } from '@/shared/exceptions/AppError';
import config from '@/config';

/**
 * One container signature can carry several MIME types: an OOXML .docx and a
 * plain .zip are byte-identical at the header, and .doc/.xls share the OLE2
 * compound-file header. A signature therefore maps to CANDIDATE types, and the
 * claimed type only has to be one of them.
 */
interface FileType {
  mime: string;
  extensions: string[];
}

interface Signature {
  label: string;
  matches: (bytes: Buffer) => boolean;
  types: FileType[];
}

const startsWith = (bytes: Buffer, prefix: number[]) =>
  bytes.length >= prefix.length && prefix.every((byte, index) => bytes[index] === byte);

const ascii = (bytes: Buffer, text: string) =>
  bytes.length >= text.length && bytes.subarray(0, text.length).toString('ascii') === text;

const SIGNATURES: Signature[] = [
  {
    label: 'image/jpeg',
    matches: (bytes) => startsWith(bytes, [0xff, 0xd8, 0xff]),
    types: [{ mime: 'image/jpeg', extensions: ['.jpg', '.jpeg'] }],
  },
  {
    label: 'image/png',
    matches: (bytes) => startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    types: [{ mime: 'image/png', extensions: ['.png'] }],
  },
  {
    label: 'image/gif',
    matches: (bytes) => ascii(bytes, 'GIF87a') || ascii(bytes, 'GIF89a'),
    types: [{ mime: 'image/gif', extensions: ['.gif'] }],
  },
  {
    label: 'application/pdf',
    matches: (bytes) => ascii(bytes, '%PDF-'),
    types: [{ mime: 'application/pdf', extensions: ['.pdf'] }],
  },
  {
    // ZIP container: an empty and a spanned archive have their own headers.
    label: 'zip container',
    matches: (bytes) =>
      startsWith(bytes, [0x50, 0x4b, 0x03, 0x04])
      || startsWith(bytes, [0x50, 0x4b, 0x05, 0x06])
      || startsWith(bytes, [0x50, 0x4b, 0x07, 0x08]),
    types: [
      { mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', extensions: ['.docx'] },
      { mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', extensions: ['.xlsx'] },
      { mime: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', extensions: ['.pptx'] },
      { mime: 'application/zip', extensions: ['.zip'] },
    ],
  },
  {
    // OLE2 compound file: legacy .doc/.xls/.ppt.
    label: 'OLE2 compound document',
    matches: (bytes) => startsWith(bytes, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]),
    types: [
      { mime: 'application/msword', extensions: ['.doc'] },
      { mime: 'application/vnd.ms-excel', extensions: ['.xls'] },
      { mime: 'application/vnd.ms-powerpoint', extensions: ['.ppt'] },
    ],
  },
];

/** Header bytes needed by the longest signature above. */
const HEADER_BYTES = 16;

function detectSignature(bytes: Buffer): Signature | null {
  return SIGNATURES.find((signature) => signature.matches(bytes)) ?? null;
}

/**
 * Kept for callers that only need the resolved type of an unambiguous file.
 * Returns the first candidate, so a zip container reports the OOXML document
 * type; prefer `validateFileMagicBytes` when the claimed type matters.
 */
export function detectAllowedFileMime(bytes: Buffer): string | null {
  return detectSignature(bytes)?.types[0]?.mime ?? null;
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
        let header: Buffer | null = null;
        if (file?.buffer) {
          header = file.buffer.subarray(0, HEADER_BYTES);
        } else if (file?.path) {
          const handle = await fs.open(file.path, 'r');
          try {
            const buffer = Buffer.alloc(HEADER_BYTES);
            const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
            header = buffer.subarray(0, bytesRead);
          } finally {
            await handle.close();
          }
        }
        const signature = header ? detectSignature(header) : null;
        // Only candidates the caller actually allows may resolve the file, so a
        // route that permits .docx alone cannot receive a plain .zip.
        const permitted = signature?.types.filter((type) => allowedMimes.includes(type.mime)) ?? [];
        if (!permitted.length) {
          throw new BadRequestError(
            `Tipe file tidak diizinkan (terdeteksi ${signature?.label ?? 'tidak dikenal'})`
          );
        }

        let resolved = permitted[0]!;
        if (file.mimetype) {
          const claimed = permitted.find((type) => type.mime === file.mimetype);
          if (!claimed) throw new BadRequestError('File MIME does not match content');
          resolved = claimed;
        }
        if (file.originalname) {
          const extension = path.extname(file.originalname).toLowerCase();
          // Without a claimed type any allowed candidate's extension is fine;
          // with one, the extension has to match that exact type.
          const acceptable = file.mimetype ? [resolved] : permitted;
          if (!acceptable.some((type) => type.extensions.includes(extension))) {
            throw new BadRequestError('File extension does not match content');
          }
        }
        file.mimetype = resolved.mime;
      }
      next();
    } catch (err) {
      // Reject the whole request: remove every uploaded file from disk.
      await Promise.all(files.map((f) => (f?.path ? fs.unlink(f.path).catch(() => {}) : null)));
      next(err);
    }
  };
}

/**
 * Multer writes the upload to disk before the route runs, so any later
 * rejection — validation, authorization, or a domain rule such as an
 * insufficient leave balance — leaves the file behind with nothing referencing
 * it. Only document-management cleaned up after itself; this removes the file
 * for every disk-storage upload whose request ends in an error status.
 *
 * ponytail: keyed on response status, so a route that answers 2xx without
 * persisting the file would still keep it. No such route exists today.
 */
export function discardUploadOnFailure() {
  return (req: Request, res: Response, next: NextFunction): void => {
    res.on('finish', () => {
      if (res.statusCode < 400) return;
      const files: Express.Multer.File[] = req.file
        ? [req.file]
        : Array.isArray(req.files)
          ? req.files
          : Object.values(req.files ?? {}).flat();
      for (const file of files) {
        if (file?.path) void fs.unlink(file.path).catch(() => {});
      }
    });
    next();
  };
}
