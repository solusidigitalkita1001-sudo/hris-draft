import type { NextFunction, Response } from 'express';

jest.mock('@/shared/security/JWTHandler', () => ({ jwtHandler: {
  verifyAccessToken: jest.fn(),
} }));
jest.mock('@/shared/database/prisma', () => ({ __esModule: true, default: {
  user: { findUnique: jest.fn() },
} }));
jest.mock('@/shared/context/RequestContext', () => ({
  runInRequestContext: (_context: unknown, callback: () => void) => callback(),
}));

import prisma from '@/shared/database/prisma';
import { jwtHandler } from '@/shared/security/JWTHandler';
import { authenticate, optionalAuthenticate, type AuthenticatedRequest } from './Authenticate';

const verify = jest.mocked(jwtHandler.verifyAccessToken);
const findUser = jest.mocked(prisma.user.findUnique);

const decoded = {
  sub: 'user-1',
  email: 'user@example.test',
  sessionVersion: 3,
  companyId: 'company-1',
  permissions: ['attendance:read'],
};

function request(token = 'access-token'): AuthenticatedRequest {
  return {
    headers: { authorization: `Bearer ${token}` },
    cookies: {},
  } as unknown as AuthenticatedRequest;
}

describe('authenticate session version', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    verify.mockReturnValue(decoded);
    findUser.mockResolvedValue({ sessionVersion: 3, status: 'ACTIVE', deletedAt: null } as never);
  });

  it('attaches a user only when the persisted session version matches', async () => {
    const req = request();
    const next = jest.fn() as NextFunction;

    await authenticate(req, {} as Response, next);

    expect(findUser).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      select: { sessionVersion: true, status: true, deletedAt: true },
    });
    expect(req.user).toMatchObject({ id: 'user-1', companyId: 'company-1' });
    expect(next).toHaveBeenCalledWith();
  });

  it('rejects an access token issued before a password change', async () => {
    findUser.mockResolvedValue({ sessionVersion: 4, status: 'ACTIVE', deletedAt: null } as never);
    const next = jest.fn() as NextFunction;

    await authenticate(request(), {} as Response, next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 401 }));
  });

  it('rejects a matching token when the account is suspended', async () => {
    findUser.mockResolvedValue({ sessionVersion: 3, status: 'SUSPENDED', deletedAt: null } as never);
    const next = jest.fn() as NextFunction;

    await authenticate(request(), {} as Response, next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 401 }));
  });

  it('forwards database failures on required routes', async () => {
    const databaseError = new Error('database unavailable');
    findUser.mockRejectedValue(databaseError);
    const next = jest.fn() as NextFunction;

    await authenticate(request(), {} as Response, next);

    expect(next).toHaveBeenCalledWith(databaseError);
  });

  it('treats a stale token as anonymous on an optional route', async () => {
    findUser.mockResolvedValue({ sessionVersion: 4, status: 'ACTIVE', deletedAt: null } as never);
    const req = request();
    const next = jest.fn() as NextFunction;

    await optionalAuthenticate(req, {} as Response, next);

    expect(req.user).toBeUndefined();
    expect(next).toHaveBeenCalledWith();
  });

  it('forwards database failures instead of silently accepting or anonymizing', async () => {
    const databaseError = new Error('database unavailable');
    findUser.mockRejectedValue(databaseError);
    const next = jest.fn() as NextFunction;

    await optionalAuthenticate(request(), {} as Response, next);

    expect(next).toHaveBeenCalledWith(databaseError);
  });
});
