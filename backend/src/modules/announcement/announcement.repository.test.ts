const mockTransaction = jest.fn();
const mockRunInSystemContext = jest.fn((_reason: string, fn: () => unknown) => fn());

jest.mock('@/shared/database/prisma', () => ({
  __esModule: true,
  default: { $transaction: mockTransaction },
}));
jest.mock('@/shared/context/RequestContext', () => ({ runInSystemContext: mockRunInSystemContext }));

import { announcementRepository } from './announcement.repository';

describe('AnnouncementRepository.markRead', () => {
  const tx = {
    announcementRead: {
      createMany: jest.fn(),
      findUnique: jest.fn(),
    },
    announcement: { updateMany: jest.fn() },
  };
  const readAt = new Date('2026-09-21T00:00:00.000Z');

  beforeEach(() => {
    jest.clearAllMocks();
    mockTransaction.mockImplementation((callback: (client: typeof tx) => unknown) => callback(tx));
    tx.announcementRead.createMany.mockResolvedValue({ count: 1 });
    tx.announcementRead.findUnique.mockResolvedValue({ readAt });
    tx.announcement.updateMany.mockResolvedValue({ count: 1 });
  });

  it('increments a tenant announcement inside the current tenant context', async () => {
    await announcementRepository.markRead('announcement-1', 'user-1', 'company-a');

    expect(mockRunInSystemContext).not.toHaveBeenCalled();
    expect(tx.announcement.updateMany).toHaveBeenCalledWith({
      where: { id: 'announcement-1', companyId: 'company-a' },
      data: { totalViews: { increment: 1 } },
    });
  });

  it('uses a narrow system boundary to increment a validated platform announcement', async () => {
    await announcementRepository.markRead('announcement-platform', 'user-1', null);

    expect(mockRunInSystemContext).toHaveBeenCalledWith(
      'increment validated platform announcement view',
      expect.any(Function),
    );
    expect(tx.announcement.updateMany).toHaveBeenCalledWith({
      where: { id: 'announcement-platform', companyId: null },
      data: { totalViews: { increment: 1 } },
    });
  });

  it('does not increment views when the read already exists', async () => {
    tx.announcementRead.createMany.mockResolvedValue({ count: 0 });

    await expect(announcementRepository.markRead('announcement-1', 'user-1', 'company-a'))
      .resolves.toEqual({ readAt, alreadyRead: true });
    expect(tx.announcement.updateMany).not.toHaveBeenCalled();
  });
});
