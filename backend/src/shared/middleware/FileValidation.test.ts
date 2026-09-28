import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type { NextFunction, Request, Response } from 'express';
import { discardUploadOnFailure, validateFileMagicBytes } from './FileValidation';
import { BadRequestError } from '@/shared/exceptions/AppError';

describe('validateFileMagicBytes', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'hris-file-validation-'));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('accepts a PNG based on its signature, not its filename', async () => {
    const filePath = path.join(tempDir, 'upload.bin');
    await fs.writeFile(filePath, Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]));
    const next = jest.fn() as jest.MockedFunction<NextFunction>;

    await validateFileMagicBytes(['image/png'])(
      { file: { path: filePath } } as Request,
      {} as Response,
      next,
    );

    expect(next).toHaveBeenCalledWith();
  });

  it('validates memory-storage uploads by magic bytes', async () => {
    const next = jest.fn() as jest.MockedFunction<NextFunction>;
    await validateFileMagicBytes(['image/jpeg'])(
      {
        file: {
          buffer: Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]),
        },
      } as Request,
      {} as Response,
      next,
    );
    expect(next).toHaveBeenCalledWith();
  });

  it('rejects and removes an executable renamed as an image', async () => {
    const filePath = path.join(tempDir, 'malware.png');
    await fs.writeFile(filePath, Buffer.from('MZ-not-an-image'));
    const next = jest.fn() as jest.MockedFunction<NextFunction>;

    await validateFileMagicBytes(['image/png'])(
      { file: { path: filePath } } as Request,
      {} as Response,
      next,
    );

    expect(next.mock.calls[0]?.[0]).toBeInstanceOf(BadRequestError);
    await expect(fs.access(filePath)).rejects.toBeDefined();
  });
});

describe('file metadata spoofing', () => {
  it.each([
    { originalname: 'payload.html', mimetype: 'image/png' },
    { originalname: 'photo.png', mimetype: 'text/html' },
  ])('rejects mismatched filename or MIME: %j', async (metadata) => {
    const next = jest.fn();
    await validateFileMagicBytes(['image/png'])({ file: {
      ...metadata, buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    } } as Request, {} as Response, next);
    expect(next).toHaveBeenCalledWith(expect.any(BadRequestError));
  });
});

describe('container formats that share one signature', () => {
  const ZIP = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0, 0, 0, 0]);
  const OLE2 = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
  const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

  const run = async (allowed: string[], file: Record<string, unknown>) => {
    const next = jest.fn() as jest.MockedFunction<NextFunction>;
    await validateFileMagicBytes(allowed)({ file } as unknown as Request, {} as Response, next);
    return next;
  };

  it('accepts a docx whose bytes are a zip container', async () => {
    // Every OOXML file is a zip, so byte inspection alone cannot separate them;
    // the claimed type has to be accepted as one of the candidates.
    const file = { buffer: ZIP, originalname: 'review.docx', mimetype: DOCX };
    expect(await run([DOCX, 'application/pdf'], file)).toHaveBeenCalledWith();
    expect(file.mimetype).toBe(DOCX);
  });

  it('accepts a legacy xls through the OLE2 signature', async () => {
    const next = await run(['application/vnd.ms-excel'], {
      buffer: OLE2, originalname: 'payroll.xls', mimetype: 'application/vnd.ms-excel',
    });
    expect(next).toHaveBeenCalledWith();
  });

  it('rejects a zip that claims a type the route does not allow', async () => {
    const next = await run([DOCX], {
      buffer: ZIP, originalname: 'archive.zip', mimetype: 'application/zip',
    });
    expect(next).toHaveBeenCalledWith(expect.any(BadRequestError));
  });

  it('rejects a container whose extension belongs to a different candidate', async () => {
    const next = await run([DOCX, XLSX], {
      buffer: ZIP, originalname: 'sheet.xlsx', mimetype: DOCX,
    });
    expect(next).toHaveBeenCalledWith(expect.any(BadRequestError));
  });

  it('still rejects an unidentifiable container-looking file', async () => {
    const next = await run([DOCX], {
      buffer: Buffer.from('PK-not-really'), originalname: 'fake.docx', mimetype: DOCX,
    });
    expect(next).toHaveBeenCalledWith(expect.any(BadRequestError));
  });
});

describe('discardUploadOnFailure', () => {
  // Cleanup runs from a response 'finish' listener and is deliberately
  // fire-and-forget, so the assertion polls instead of racing the unlink.
  const untilGone = async (filePath: string, deadlineMs = 2000) => {
    const started = process.hrtime.bigint();
    for (;;) {
      try {
        await fs.access(filePath);
      } catch {
        return true;
      }
      if (Number(process.hrtime.bigint() - started) / 1e6 > deadlineMs) return false;
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
  };

  const finish = (statusCode: number, filePath: string) => {
    const listeners: Array<() => void> = [];
    const res = { statusCode, on: (_event: string, cb: () => void) => listeners.push(cb) } as unknown as Response;
    const next = jest.fn() as jest.MockedFunction<NextFunction>;
    discardUploadOnFailure()({ file: { path: filePath } } as unknown as Request, res, next);
    expect(next).toHaveBeenCalledWith();
    for (const listener of listeners) listener();
  };

  it('removes the stored file when the request ends in an error status', async () => {
    // Multer has already written the file by the time a domain rule (an
    // insufficient leave balance, say) rejects the request.
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'hris-orphan-upload-'));
    const filePath = path.join(tempDir, 'attachment.pdf');
    await fs.writeFile(filePath, Buffer.from('%PDF-1.4'));

    finish(422, filePath);

    await expect(untilGone(filePath)).resolves.toBe(true);
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('keeps the file when the request succeeds', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'hris-orphan-upload-'));
    const filePath = path.join(tempDir, 'attachment.pdf');
    await fs.writeFile(filePath, Buffer.from('%PDF-1.4'));

    finish(201, filePath);

    // Give the listener the same chance to run; the file must survive it.
    await expect(untilGone(filePath, 100)).resolves.toBe(false);
    await expect(fs.access(filePath)).resolves.toBeUndefined();
    await fs.rm(tempDir, { recursive: true, force: true });
  });
});
