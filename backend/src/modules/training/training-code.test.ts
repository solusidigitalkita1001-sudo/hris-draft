jest.mock('./training.repository', () => ({
  trainingRepository: {
    findCategoryByCode: jest.fn(),
    findCourseByCode: jest.fn(),
    createCategory: jest.fn(),
    createCourse: jest.fn(),
  },
}));
jest.mock('@/shared/database/prisma', () => ({ __esModule: true, default: {}, prisma: {} }));

import { ConflictError } from '@/shared/exceptions/AppError';
import { trainingRepository } from './training.repository';
import { trainingService } from './training.service';

const repo = trainingRepository as unknown as {
  findCategoryByCode: jest.Mock;
  findCourseByCode: jest.Mock;
  createCategory: jest.Mock;
  createCourse: jest.Mock;
};

const passthrough = async (data: unknown) => ({ id: 'created-1', ...(data as object) });

beforeEach(() => {
  jest.clearAllMocks();
  repo.findCategoryByCode.mockResolvedValue(null);
  repo.findCourseByCode.mockResolvedValue(null);
  repo.createCategory.mockImplementation(passthrough);
  repo.createCourse.mockImplementation(passthrough);
});

describe('training category code on create', () => {
  const dto = { companyId: 'company-1', name: 'Technical Skills' } as never;

  it('keeps the code the customer sent', async () => {
    await trainingService.createCategory({ ...(dto as object), code: 'TECH' } as never);

    expect(repo.createCategory).toHaveBeenCalledWith(expect.objectContaining({ code: 'TECH' }));
  });

  it('still generates one when none is given', async () => {
    await trainingService.createCategory(dto);

    const saved = repo.createCategory.mock.calls[0][0] as { code: string };
    expect(saved.code.startsWith('TRN-CAT-')).toBe(true);
  });

  it('refuses a code already taken inside the same company', async () => {
    repo.findCategoryByCode.mockResolvedValue({ id: 'other' });

    await expect(trainingService.createCategory({ ...(dto as object), code: 'TECH' } as never))
      .rejects.toThrow(ConflictError);
  });

  it('looks the code up scoped to one company', async () => {
    await trainingService.createCategory({ ...(dto as object), code: 'TECH' } as never);

    expect(repo.findCategoryByCode).toHaveBeenCalledWith('company-1', 'TECH');
  });
});

describe('training course code on create', () => {
  const dto = { companyId: 'company-1', title: 'TypeScript 101', isMandatory: false } as never;

  it('keeps the code the customer sent', async () => {
    await trainingService.createCourse({ ...(dto as object), code: 'TS-101' } as never);

    expect(repo.createCourse).toHaveBeenCalledWith(expect.objectContaining({ code: 'TS-101' }));
  });

  it('still generates one when none is given', async () => {
    await trainingService.createCourse(dto);

    const saved = repo.createCourse.mock.calls[0][0] as { code: string };
    expect(saved.code.startsWith('TRN-CRS-')).toBe(true);
  });

  it('refuses a code already taken inside the same company', async () => {
    repo.findCourseByCode.mockResolvedValue({ id: 'other' });

    await expect(trainingService.createCourse({ ...(dto as object), code: 'TS-101' } as never))
      .rejects.toThrow(ConflictError);
  });

  it('looks the code up scoped to one company', async () => {
    await trainingService.createCourse({ ...(dto as object), code: 'TS-101' } as never);

    expect(repo.findCourseByCode).toHaveBeenCalledWith('company-1', 'TS-101');
  });
});
