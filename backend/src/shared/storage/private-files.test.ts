import express from 'express';
import type { NextFunction, Response } from 'express';
import type { AuthenticatedRequest } from '@/shared/middleware/Authenticate';
jest.mock('@/shared/database/prisma', () => ({ __esModule: true, default: {
  expenseClaim: { findFirst: jest.fn() }, performancePlanningEvidence: { findFirst: jest.fn() },
} }));
jest.mock('@/modules/administration/administration.service', () => ({ administrationService: {
  findMyDataScopeByUser: jest.fn().mockResolvedValue(null), resolveEmployeeFilterForCurrentUser: jest.fn().mockReturnValue({}),
} }));
jest.mock('@/shared/middleware/Authenticate', () => ({ authenticate: (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  if (req.get('x-test-actor') !== 'employee-a') { res.sendStatus(401); return; }
  req.user = { id: 'user-a', email: 'a@example.com', companyId: 'A', employeeId: 'employee-a', roles: ['EMPLOYEE'], permissions: ['performance:read'] };
  next();
} }));
import prisma from '@/shared/database/prisma';
import { privateFilesRouter } from './private-files';
// eslint-disable-next-line @typescript-eslint/no-require-imports -- Supertest ships no declarations, and this repository does not install @types/supertest.
const request = require('supertest');
const app = express();
app.use('/api/v1/private-files', privateFilesRouter);
app.use((error: Error, _req: express.Request, res: Response, _next: NextFunction) => {
  res.status(error.message.includes('not found') ? 404 : 403).json({ message: error.message });
});
describe('private download HTTP authorization', () => {
  beforeEach(() => {
    jest.mocked(prisma.expenseClaim.findFirst).mockReset().mockResolvedValue(null);
    jest.mocked(prisma.performancePlanningEvidence.findFirst).mockReset().mockResolvedValue(null);
  });
  it.each(['receipts', 'performance-evidence'])('rejects anonymous %s access before database lookup', async (resource) => {
    expect((await request(app).get(`/api/v1/private-files/${resource}/guessed`)).status).toBe(401);
    expect(prisma.expenseClaim.findFirst).not.toHaveBeenCalled();
    expect(prisma.performancePlanningEvidence.findFirst).not.toHaveBeenCalled();
  });
  it('constrains guessed receipt IDs by company and owner/approver in SQL', async () => {
    expect((await request(app).get('/api/v1/private-files/receipts/foreign').set('x-test-actor', 'employee-a')).status).toBe(404);
    expect(prisma.expenseClaim.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({
      id: 'foreign', companyId: 'A', employee: { companyId: 'A' },
      OR: [{ employeeId: 'employee-a' }, { approvals: { some: { approverId: 'user-a' } } }],
    }) }));
  });
  it('denies a forged company parameter before database lookup', async () => {
    expect((await request(app).get('/api/v1/private-files/receipts/foreign?companyId=B').set('x-test-actor', 'employee-a')).status).toBe(403);
    expect(prisma.expenseClaim.findFirst).not.toHaveBeenCalled();
  });
  it('constrains evidence IDs by active company and assignment participants', async () => {
    expect((await request(app).get('/api/v1/private-files/performance-evidence/foreign').set('x-test-actor', 'employee-a')).status).toBe(404);
    expect(prisma.performancePlanningEvidence.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({
      companyId: 'A', assignment: { deletedAt: null, employee: { companyId: 'A' } },
      OR: expect.arrayContaining([{ assignment: { employeeId: 'employee-a' } }]),
    }) }));
  });
});
