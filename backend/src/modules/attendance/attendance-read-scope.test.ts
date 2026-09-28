import { NotFoundError } from '@/shared/exceptions/AppError';

jest.mock('@/shared/logger/WinstonLogger', () => ({
  WinstonLogger: jest.fn().mockImplementation(() => ({ warn: jest.fn() })),
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));
jest.mock('@/shared/security/employee-data-scope', () => ({
  employeeAccessWhere: jest.fn(),
  assertEmployeeInScope: jest.fn(),
}));
jest.mock('./attendance.repository', () => ({
  attendanceRepository: { findById: jest.fn() },
}));
jest.mock('./attendance-correction.repository', () => ({
  attendanceCorrectionRepository: { findAll: jest.fn(), findById: jest.fn() },
}));

import { employeeAccessWhere } from '@/shared/security/employee-data-scope';
import { attendanceRepository } from './attendance.repository';
import { attendanceCorrectionRepository } from './attendance-correction.repository';
import { attendanceService } from './attendance.service';
import { attendanceCorrectionService } from './attendance-correction.service';

/**
 * Tier 3 (#8): OWN_* data scope was only ever forced into `req.query`, so a
 * fetch-by-path was governed by the coarse `attendance:read` grant alone. These
 * reads now carry the actor's employee predicate, and out-of-scope resolves to
 * not-found rather than disclosing a colleague's record.
 */
const SCOPE = { companyId: 'company-a', departmentId: 'dept-a' };

describe('attendance reads carry the actor data scope', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(employeeAccessWhere).mockResolvedValue(SCOPE);
  });

  it('passes the employee predicate into the attendance detail query', async () => {
    jest.mocked(attendanceRepository.findById).mockResolvedValue({ id: 'att-1' } as never);

    await expect(attendanceService.findById('att-1')).resolves.toEqual({ id: 'att-1' });

    expect(employeeAccessWhere).toHaveBeenCalledWith('attendance');
    expect(attendanceRepository.findById).toHaveBeenCalledWith('att-1', SCOPE);
  });

  it('reports an out-of-scope attendance record as not found', async () => {
    jest.mocked(attendanceRepository.findById).mockResolvedValue(null as never);

    await expect(attendanceService.findById('att-of-a-colleague')).rejects.toThrow(NotFoundError);
  });

  it('passes the employee predicate into correction list and detail queries', async () => {
    jest.mocked(attendanceCorrectionRepository.findAll).mockResolvedValue([] as never);
    jest.mocked(attendanceCorrectionRepository.findById).mockResolvedValue({ id: 'corr-1' } as never);

    await attendanceCorrectionService.findAll('company-a', { status: 'PENDING' });
    await attendanceCorrectionService.findById('corr-1');

    expect(attendanceCorrectionRepository.findAll).toHaveBeenCalledWith(
      'company-a', { status: 'PENDING' }, SCOPE,
    );
    expect(attendanceCorrectionRepository.findById).toHaveBeenCalledWith('corr-1', SCOPE);
  });

  it('reports an out-of-scope correction as not found', async () => {
    jest.mocked(attendanceCorrectionRepository.findById).mockResolvedValue(null as never);

    await expect(attendanceCorrectionService.findById('corr-of-a-colleague')).rejects.toThrow(NotFoundError);
  });
});
