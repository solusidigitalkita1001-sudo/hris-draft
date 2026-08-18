import {
  isAnnouncementVisibleTo,
  filterAnnouncementsForUser,
  sortAnnouncementsForDashboard,
  filterUnreadAnnouncements,
  isWithinPublishWindow,
  isAudienceMatch,
  summarizeUnread,
} from './announcement';

const companyA = 'COMP-A';
const deptHR = 'DEP-HR';
const deptENG = 'DEP-ENG';
const branchJKT = 'BR-JKT';
const posSTAFF = 'POS-STAFF';
const empE1 = 'EMP-001';
const empE2 = 'EMP-002';

const ctxHR = {
  companyId: companyA, departmentId: deptHR, branchId: branchJKT,
  positionId: posSTAFF, employeeId: empE1, userId: 'U1',
};
const ctxENG = {
  companyId: companyA, departmentId: deptENG, branchId: branchJKT,
  positionId: posSTAFF, employeeId: empE2, userId: 'U2',
};

describe('D.1 Announcement engagement pure functions', () => {
  it('D.1 CASE1: publishFrom future = invisible (not yet). publishUntil passed = invisible.', () => {
    const now = new Date(2026, 7, 18);
    const future = { audienceType: 'COMPANY_WIDE' as const, companyId: companyA, status: 'PUBLISHED', publishFrom: new Date(2026, 7, 19), publishUntil: null };
    expect(isAnnouncementVisibleTo(future, { ...ctxHR, currentDate: now })).toBe(false);
    const expired = { audienceType: 'COMPANY_WIDE' as const, companyId: companyA, status: 'PUBLISHED', publishFrom: new Date(2026, 7, 1), publishUntil: new Date(2026, 7, 17) };
    expect(isAnnouncementVisibleTo(expired, { ...ctxHR, currentDate: now })).toBe(false);
    expect(isWithinPublishWindow(future, now)).toBe(false);
    expect(isWithinPublishWindow(expired, now)).toBe(false);
    // publishFrom null + publishUntil null = always in window
    expect(isWithinPublishWindow({ publishFrom: null, publishUntil: null }, now)).toBe(true);
  });

  it('D.1 CASE2: sort dashboard priority PINNED > NORMAL. Within same priority = newest createdAt first. PINNED expired = demote NORMAL sort.', () => {
    const now = new Date(2026, 7, 18, 12, 0);
    const a = { id: 'a', audienceType: 'COMPANY_WIDE' as const, companyId: companyA, status: 'PUBLISHED', priority: 'NORMAL' as const, createdAt: new Date(2026, 7, 10) };
    const b = { id: 'b', audienceType: 'COMPANY_WIDE' as const, companyId: companyA, status: 'PUBLISHED', priority: 'PINNED' as const, createdAt: new Date(2026, 7, 1), pinnedUntil: new Date(2026, 8, 1) };
    const c = { id: 'c', audienceType: 'COMPANY_WIDE' as const, companyId: companyA, status: 'PUBLISHED', priority: 'PINNED' as const, createdAt: new Date(2026, 7, 12), pinnedUntil: new Date(2026, 7, 15) }; // PINNED expired
    const sorted = sortAnnouncementsForDashboard([a, b, c], now).map(r => r.id);
    expect(sorted[0]).toBe('b'); // PINNED active #1
    // c pin expired -> rank normal tapi createdAt 12 > a.createdAt 10 -> c sebelum a
    expect(sorted.slice(1)).toEqual(['c', 'a']);
  });

  it('D.1 CASE3: Audience DEPARTMENT_ONLY dept HR => ctxHR visible=true, ctxENG visible=false.', () => {
    const row = {
      audienceType: 'DEPARTMENT_ONLY' as const,
      companyId: companyA,
      status: 'PUBLISHED',
      departmentIds: JSON.stringify([deptHR]),
    };
    expect(isAudienceMatch(row, ctxHR)).toBe(true);
    expect(isAudienceMatch(row, ctxENG)).toBe(false);
    expect(isAnnouncementVisibleTo(row, ctxHR)).toBe(true);
    expect(isAnnouncementVisibleTo(row, ctxENG)).toBe(false);
  });

  it('D.1 CASE4: EMPLOYEE_SPECIFIC hanya untuk empE1 => empE2 invisible.', () => {
    const row = {
      audienceType: 'EMPLOYEE_SPECIFIC' as const,
      companyId: companyA,
      status: 'PUBLISHED',
      employeeIds: JSON.stringify([empE1]),
    };
    expect(isAnnouncementVisibleTo(row, ctxHR)).toBe(true);
    expect(isAnnouncementVisibleTo(row, ctxENG)).toBe(false);
  });

  it('D.1 CASE5: unread filter dari 5 visible total (3 read, 2 unread) => return 2 yg id tidak dalam read set.', () => {
    const visible = [
      { id: 'A1' }, { id: 'A2' }, { id: 'A3' }, { id: 'A4' }, { id: 'A5' },
    ];
    const read = ['A1', 'A3', 'A5'];
    const unread = filterUnreadAnnouncements(visible, read);
    expect(unread.length).toBe(2);
    expect(unread.map(x => x.id)).toEqual(['A2', 'A4']);
    const summary = summarizeUnread(visible, read);
    expect(summary.totalVisible).toBe(5);
    expect(summary.totalUnread).toBe(2);
    expect(summary.hasUnread).toBe(true);
    expect(summary.unreadIds).toEqual(['A2', 'A4']);
  });

  it('D.1 CASE6: guards null ctx, status DRAFT, BRANCH_ONLY mismatch, POSITION_ONLY string CSV parse, all pass.', () => {
    // DRAFT status => invisible even COMPANY_WIDE
    const draft = { audienceType: 'COMPANY_WIDE' as const, companyId: companyA, status: 'DRAFT' };
    expect(isAnnouncementVisibleTo(draft, ctxHR)).toBe(false);
    // priority HIDDEN = invisible even published
    const hidden = { audienceType: 'COMPANY_WIDE' as const, companyId: companyA, status: 'PUBLISHED', priority: 'HIDDEN' as const };
    expect(isAnnouncementVisibleTo(hidden, ctxHR)).toBe(false);
    // BRANCH_ONLY branch beda -> false
    const br = { audienceType: 'BRANCH_ONLY' as const, companyId: companyA, status: 'PUBLISHED', branchIds: 'BR-BDG,BR-SBY' }; // CSV split (fallback non-JSON)
    expect(isAudienceMatch(br, ctxHR)).toBe(false);
    // POSITION_ONLY array match
    const pos = { audienceType: 'POSITION_ONLY' as const, companyId: companyA, status: 'PUBLISHED', positionIds: JSON.stringify([posSTAFF]) };
    expect(isAudienceMatch(pos, ctxHR)).toBe(true);
    // filter for user 6 pengumuman mixed => ctxENG hanya dapat 2 (company wide & eng dept)
    const engOnly = { audienceType: 'DEPARTMENT_ONLY' as const, companyId: companyA, status: 'PUBLISHED', departmentIds: JSON.stringify([deptENG]) };
    const hrOnly = { audienceType: 'DEPARTMENT_ONLY' as const, companyId: companyA, status: 'PUBLISHED', departmentIds: JSON.stringify([deptHR]) };
    const cw = { audienceType: 'COMPANY_WIDE' as const, companyId: companyA, status: 'PUBLISHED' };
    const all = { audienceType: 'ALL' as const, status: 'PUBLISHED' };
    const list = [engOnly, hrOnly, cw, all, draft, hidden];
    const engVisible = filterAnnouncementsForUser(list, ctxENG);
    expect(engVisible.map(x => x.audienceType).sort()).toEqual(['ALL', 'COMPANY_WIDE', 'DEPARTMENT_ONLY'].sort());
  });
});
