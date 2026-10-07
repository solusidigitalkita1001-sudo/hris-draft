import { assetService } from './asset.service';
import { ConflictError } from '@/shared/exceptions/AppError';
import { assetRepository } from './asset.repository';

jest.mock('./asset.repository', () => ({
  assetRepository: {
    create: jest.fn(async (data: unknown) => data),
    findByAssetCode: jest.fn(async () => null),
  },
}));

const repo = assetRepository as jest.Mocked<typeof assetRepository>;

const payload = (over: Record<string, unknown> = {}) => ({
  companyId: 'company-1',
  name: 'MacBook Pro 14',
  ...over,
}) as never;

beforeEach(() => {
  jest.clearAllMocks();
  repo.create.mockImplementation(async (data: unknown) => data as never);
  repo.findByAssetCode.mockResolvedValue(null as never);
});

describe('asset code on create', () => {
  it('keeps the code the customer already printed on the sticker', async () => {
    await assetService.create(payload({ assetCode: 'AST-LAP-001' }));

    expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({ assetCode: 'AST-LAP-001' }));
  });

  it('still generates one when none is given', async () => {
    await assetService.create(payload());

    const saved = repo.create.mock.calls[0][0] as { assetCode: string };
    expect(saved.assetCode).toMatch(/^AST-/);
  });

  it('generates one when the field is sent blank', async () => {
    await assetService.create(payload({ assetCode: '   ' }));

    const saved = repo.create.mock.calls[0][0] as { assetCode: string };
    expect(saved.assetCode).toMatch(/^AST-/);
  });

  it('refuses a code already taken inside the same company', async () => {
    repo.findByAssetCode.mockResolvedValue({ id: 'another-asset' } as never);

    await expect(assetService.create(payload({ assetCode: 'AST-LAP-001' })))
      .rejects.toThrow(ConflictError);
  });

  it('lets a second company reuse a code the first company holds', async () => {
    // What the migration to @@unique([companyId, assetCode]) buys: the lookup is
    // scoped by company, so company-2 may label its own first laptop the same.
    repo.findByAssetCode.mockImplementation(async (companyId: string) =>
      (companyId === 'company-1' ? ({ id: 'first-tenant' } as never) : null));

    await assetService.create(payload({ companyId: 'company-2', assetCode: 'AST-LAP-001' }));

    expect(repo.findByAssetCode).toHaveBeenCalledWith('company-2', 'AST-LAP-001');
    expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({
      companyId: 'company-2',
      assetCode: 'AST-LAP-001',
    }));
  });
});
