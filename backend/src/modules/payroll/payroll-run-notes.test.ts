jest.mock('@/shared/database/prisma', () => {
  const client = { payrollRun: { create: jest.fn(async () => ({ id: 'run-1' })) } };
  return { __esModule: true, default: client, prisma: client };
});

import { prisma } from '@/shared/database/prisma';
import { PayrollRepository } from './payroll.repository';

const repository = new PayrollRepository();
const create = prisma.payrollRun.create as unknown as jest.Mock;

describe('payroll run notes', () => {
  beforeEach(() => jest.clearAllMocks());

  it('persists the note explaining why the run was created', async () => {
    // createPayrollRunSchema accepts `notes` and PayrollRun has the column, but
    // the insert never wrote it -- and no other endpoint can fill it in later.
    await repository.createPayrollRun(
      { periodId: 'period-1', companyId: 'company-1', name: 'Koreksi Juni', notes: 'rapel kenaikan Mei' } as never,
      1,
      'maker-1'
    );

    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({ notes: 'rapel kenaikan Mei' }),
    });
  });
});
