import type { AnnouncementCandidate, AnnouncementRepository } from './announcement.repository';
import { AnnouncementService } from './announcement.service';

function candidate(overrides: Partial<AnnouncementCandidate> = {}): AnnouncementCandidate {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    companyId: 'company-a',
    audienceType: 'COMPANY_WIDE',
    departmentIds: null,
    branchIds: null,
    positionIds: null,
    employeeIds: null,
    title: 'Policy update',
    content: 'Content',
    coverImageUrl: null,
    priority: 'NORMAL',
    status: 'PUBLISHED',
    publishFrom: null,
    publishUntil: null,
    pinnedUntil: null,
    allowComment: false,
    totalViews: 0,
    createdAt: new Date('2026-09-20T00:00:00.000Z'),
    author: { id: 'author-1', employee: { fullName: 'HR Admin' } },
    reads: [],
    ...overrides,
  };
}

describe('AnnouncementService', () => {
  const repository = {
    audienceContext: jest.fn(),
    findVisibleCandidates: jest.fn(),
    findCandidateById: jest.fn(),
    markRead: jest.fn(),
  } as unknown as jest.Mocked<AnnouncementRepository>;
  const service = new AnnouncementService(repository);
  const actor = { userId: 'user-1', companyId: 'company-a', employeeId: 'employee-1' };
  const now = new Date('2026-09-21T00:00:00.000Z');

  beforeEach(() => {
    jest.clearAllMocks();
    repository.audienceContext.mockResolvedValue({
      companyId: 'company-a', employeeId: 'employee-1', departmentId: 'department-hr',
      branchId: 'branch-a', positionId: 'position-a',
    });
  });

  it('filters audience defensively, sorts active pins, and paginates unread items', async () => {
    repository.findVisibleCandidates.mockResolvedValue([
      candidate({ id: '11111111-1111-4111-8111-111111111111', title: 'Normal', createdAt: new Date('2026-09-20T00:00:00Z') }),
      candidate({ id: '22222222-2222-4222-8222-222222222222', title: 'Pinned', priority: 'PINNED', pinnedUntil: new Date('2026-09-30T00:00:00Z'), createdAt: new Date('2026-09-01T00:00:00Z') }),
      candidate({ id: '33333333-3333-4333-8333-333333333333', title: 'Read', reads: [{ readAt: now }] }),
      candidate({ id: '44444444-4444-4444-8444-444444444444', audienceType: 'DEPARTMENT_ONLY', departmentIds: '["department-other"]' }),
    ]);

    const result = await service.list(actor, { page: 1, limit: 10, unreadOnly: 'true' }, now);

    expect(result.total).toBe(2);
    expect(result.items.map((item) => item.title)).toEqual(['Pinned', 'Normal']);
    expect(result.items.every((item) => item.isRead === false)).toBe(true);
  });

  it('returns only visible unread records in the count', async () => {
    repository.findVisibleCandidates.mockResolvedValue([
      candidate(),
      candidate({ id: '22222222-2222-4222-8222-222222222222', reads: [{ readAt: now }] }),
      candidate({ id: '33333333-3333-4333-8333-333333333333', status: 'DRAFT' }),
    ]);

    await expect(service.unreadCount(actor, now)).resolves.toBe(1);
  });

  it('hides a guessed announcement outside the actor audience', async () => {
    repository.findCandidateById.mockResolvedValue(candidate({
      audienceType: 'EMPLOYEE_SPECIFIC', employeeIds: '["employee-other"]',
    }));

    await expect(service.detail(actor, 'announcement-id', now))
      .rejects.toMatchObject({ statusCode: 404 });
  });

  it('marks a visible announcement once through the repository', async () => {
    repository.findCandidateById.mockResolvedValue(candidate());
    repository.markRead.mockResolvedValue({ readAt: now, alreadyRead: false });

    await expect(service.markRead(actor, 'announcement-id', now)).resolves.toEqual({
      announcementId: 'announcement-id', readAt: now, alreadyRead: false,
    });
    expect(repository.markRead).toHaveBeenCalledWith('announcement-id', 'user-1', 'company-a');
  });

  it('passes a validated platform scope to the read transaction', async () => {
    repository.findCandidateById.mockResolvedValue(candidate({ companyId: null, audienceType: 'ALL' }));
    repository.markRead.mockResolvedValue({ readAt: now, alreadyRead: false });

    await service.markRead(actor, 'platform-announcement-id', now);

    expect(repository.markRead).toHaveBeenCalledWith('platform-announcement-id', 'user-1', null);
  });
});
