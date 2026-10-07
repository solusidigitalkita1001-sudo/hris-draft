/**
 * One shape, five services: branch, division, department, sub-department and
 * position all used to generate their own code and silently drop the one the
 * client sent, and all five checked that code against every company at once.
 * The table below is the whole point -- if any of them drifts out of the
 * pattern, one group of cases fails.
 */
jest.mock('../repositories/branch.repository', () => ({
  branchRepository: {
    findByCode: jest.fn(),
    create: jest.fn(),
    upsertAttendancePolicy: jest.fn(async () => undefined),
  },
}));
jest.mock('../repositories/division.repository', () => ({
  divisionRepository: { findByCode: jest.fn(), create: jest.fn() },
}));
jest.mock('../repositories/department.repository', () => ({
  departmentRepository: { findByCode: jest.fn(), create: jest.fn(), findById: jest.fn() },
}));
jest.mock('../repositories/sub-department.repository', () => ({
  subDepartmentRepository: { findByCode: jest.fn(), create: jest.fn() },
}));
jest.mock('../repositories/position.repository', () => ({
  positionRepository: { findByCode: jest.fn(), create: jest.fn() },
}));
jest.mock('@/shared/events/EventBus', () => ({ eventBus: { publish: jest.fn(async () => undefined) } }));
jest.mock('../org-integrity', () => ({
  assertOrgRefsInCompany: jest.fn(async () => undefined),
  assertNoActiveDependents: jest.fn(async () => undefined),
  assertNoDepartmentCycle: jest.fn(async () => undefined),
  assertNoPositionCycle: jest.fn(async () => undefined),
}));
jest.mock('@/shared/logger/WinstonLogger', () => {
  class WinstonLogger {
    info = jest.fn();
    warn = jest.fn();
    error = jest.fn();
    debug = jest.fn();
  }
  return { WinstonLogger, logger: new WinstonLogger() };
});

import { ConflictError } from '@/shared/exceptions/AppError';
import { branchRepository } from '../repositories/branch.repository';
import { divisionRepository } from '../repositories/division.repository';
import { departmentRepository } from '../repositories/department.repository';
import { subDepartmentRepository } from '../repositories/sub-department.repository';
import { positionRepository } from '../repositories/position.repository';
import { branchService } from './branch.service';
import { divisionService } from './division.service';
import { departmentService } from './department.service';
import { subDepartmentService } from './sub-department.service';
import { positionService } from './position.service';

type Repo = { findByCode: jest.Mock; create: jest.Mock };

const units: Array<{
  label: string;
  repo: Repo;
  create: (dto: Record<string, unknown>) => Promise<unknown>;
  dto: Record<string, unknown>;
  prefix: string;
}> = [
  {
    label: 'branch',
    repo: branchRepository as unknown as Repo,
    create: (dto) => branchService.create(dto as never),
    dto: { companyId: 'company-1', name: 'Head Office', timezone: 'Asia/Jakarta' },
    prefix: 'BR-',
  },
  {
    label: 'division',
    repo: divisionRepository as unknown as Repo,
    create: (dto) => divisionService.create(dto as never),
    dto: { companyId: 'company-1', name: 'Operations' },
    prefix: 'DIV-',
  },
  {
    label: 'department',
    repo: departmentRepository as unknown as Repo,
    create: (dto) => departmentService.create(dto as never),
    dto: { companyId: 'company-1', name: 'Human Resources' },
    prefix: 'DPT-',
  },
  {
    // A sub-department has no companyId of its own; it inherits the parent
    // department's, which is why departmentRepository.findById is mocked below.
    label: 'sub-department',
    repo: subDepartmentRepository as unknown as Repo,
    create: (dto) => subDepartmentService.create(dto as never),
    dto: { departmentId: 'dept-1', name: 'Recruitment' },
    prefix: 'SUBDPT-',
  },
  {
    label: 'position',
    repo: positionRepository as unknown as Repo,
    create: (dto) => positionService.create(dto as never),
    dto: { companyId: 'company-1', name: 'HR Manager' },
    prefix: 'POS-',
  },
];

beforeEach(() => {
  jest.clearAllMocks();
  for (const unit of units) {
    unit.repo.findByCode.mockResolvedValue(null);
    unit.repo.create.mockImplementation(async (data: unknown) => ({
      id: 'created-1',
      companyId: 'company-1',
      ...(data as object),
    }));
  }
  (departmentRepository as unknown as { findById: jest.Mock }).findById
    .mockResolvedValue({ id: 'dept-1', companyId: 'company-1', code: 'IT' });
});

for (const { label, repo, create, dto, prefix } of units) {
  describe(`${label} code on create`, () => {
    it('keeps the code the company has been using for years', async () => {
      await create({ ...dto, code: 'HR' });

      expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({ code: 'HR' }));
    });

    it('still generates one when none is given', async () => {
      await create({ ...dto });

      const saved = repo.create.mock.calls[0][0] as { code: string };
      expect(saved.code.startsWith(prefix)).toBe(true);
    });

    it('generates one when the field is sent blank', async () => {
      await create({ ...dto, code: '   ' });

      const saved = repo.create.mock.calls[0][0] as { code: string };
      expect(saved.code.startsWith(prefix)).toBe(true);
    });

    it('refuses a code already taken inside the same company', async () => {
      repo.findByCode.mockResolvedValue({ id: 'someone-else' });

      await expect(create({ ...dto, code: 'HR' })).rejects.toThrow(ConflictError);
    });

    it('looks the code up scoped to one company, not across the installation', async () => {
      await create({ ...dto, code: 'HR' });

      expect(repo.findByCode).toHaveBeenCalledWith('company-1', 'HR');
    });
  });
}
