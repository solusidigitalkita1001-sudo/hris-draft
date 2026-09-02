import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type { NextFunction, Request, Response } from 'express';
import { validateFileMagicBytes } from './FileValidation';
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
