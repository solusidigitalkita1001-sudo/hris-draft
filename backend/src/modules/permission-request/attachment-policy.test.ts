let permissionCreate: jest.Mock;
jest.mock('@/shared/database/prisma', () => {
  permissionCreate = jest.fn(async () => ({ id: 'permission-1', companyId: 'company-a' }));
  const client = { permissionRequest: { create: permissionCreate } };
  return { __esModule: true, default: client, prisma: client };
});
jest.mock('@/modules/workflow-engine/workflow-engine.repository', () => ({
  workflowEngineRepository: {
    findDefaultTemplate: jest.fn(async () => null),
    startInstance: jest.fn(),
  },
}));
jest.mock('@/shared/logger/WinstonLogger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));

import { BadRequestError } from '@/shared/exceptions/AppError';
import { permissionRequestRepository } from './permission-request.repository';

/**
 * Every izin must carry an attachment — unconditionally, unlike leave, where the
 * document is demanded only inside H-7 or when the leave type asks for it. The
 * rule lives in one line of the create path and had no test, so nothing stopped
 * a refactor from dropping it and letting undocumented absences through.
 */
const request = {
  companyId: 'company-a',
  employeeId: 'employee-1',
  type: 'SICK',
  startDate: '2026-11-02',
  endDate: '2026-11-02',
  reason: 'Periksa ke dokter',
} as never;

describe('izin attachment policy', () => {
  beforeEach(() => jest.clearAllMocks());

  it('refuses a request with no attachment, before writing anything', async () => {
    await expect(permissionRequestRepository.create(request)).rejects.toBeInstanceOf(BadRequestError);
    expect(permissionCreate).not.toHaveBeenCalled();
  });

  it.each([undefined, null, '', '   '])('treats %p as no attachment', async (attachment) => {
    await expect(permissionRequestRepository.create({ ...(request as object), attachment } as never))
      .rejects.toThrow('Pengajuan izin wajib menyertakan lampiran');
    expect(permissionCreate).not.toHaveBeenCalled();
  });

  it('accepts a request that carries one', async () => {
    await expect(permissionRequestRepository.create({
      ...(request as object), attachment: 'https://example.test/uploads/permission/doc.pdf',
    } as never)).resolves.toMatchObject({ id: 'permission-1' });

    expect(permissionCreate).toHaveBeenCalledTimes(1);
  });
});
