import {
  LEAVE_ATTACHMENT_MIN_DAYS_BEFORE,
  daysBeforeLeaveStart,
  leaveNeedsAttachment,
} from './attachment-policy';

describe('leave attachment policy — aturan H-7 (kalender harian, UTC date-only)', () => {
  const submittedAt = new Date(Date.UTC(2026, 8, 20, 10, 30)); // 20 Sep 2026 10:30 UTC

  describe('daysBeforeLeaveStart', () => {
    it('menghitung selisih hari kalender: H-7 => 7, hari-H => 0, mundur => negatif', () => {
      expect(daysBeforeLeaveStart(new Date(Date.UTC(2026, 8, 27)), submittedAt)).toBe(7);
      expect(daysBeforeLeaveStart(new Date(Date.UTC(2026, 8, 20)), submittedAt)).toBe(0);
      expect(daysBeforeLeaveStart(new Date(Date.UTC(2026, 8, 18)), submittedAt)).toBe(-2);
    });

    it('mengabaikan komponen jam (date-only): pengajuan 23:59 UTC vs mulai 00:00 UTC tetap dihitung per tanggal', () => {
      const lateNightSubmission = new Date(Date.UTC(2026, 8, 20, 23, 59, 59));
      const earlyMorningStart = new Date(Date.UTC(2026, 8, 27, 0, 0, 0));
      expect(daysBeforeLeaveStart(earlyMorningStart, lateNightSubmission)).toBe(7);
    });

    it('konsisten melintasi batas bulan dan tahun', () => {
      // Diajukan 28 Des 2026, mulai 4 Jan 2027 => H-7
      const dec = new Date(Date.UTC(2026, 11, 28, 8, 0));
      expect(daysBeforeLeaveStart(new Date(Date.UTC(2027, 0, 4)), dec)).toBe(7);
    });
  });

  describe('leaveNeedsAttachment', () => {
    it('H-8: tidak wajib lampiran', () => {
      expect(leaveNeedsAttachment(new Date(Date.UTC(2026, 8, 28)), submittedAt)).toBe(false);
    });

    it('H-7 (tepat di batas): tidak wajib lampiran', () => {
      expect(leaveNeedsAttachment(new Date(Date.UTC(2026, 8, 27)), submittedAt)).toBe(false);
    });

    it('H-6: wajib lampiran', () => {
      expect(leaveNeedsAttachment(new Date(Date.UTC(2026, 8, 26)), submittedAt)).toBe(true);
    });

    it('H-1 dan hari-H: wajib lampiran', () => {
      expect(leaveNeedsAttachment(new Date(Date.UTC(2026, 8, 21)), submittedAt)).toBe(true);
      expect(leaveNeedsAttachment(new Date(Date.UTC(2026, 8, 20)), submittedAt)).toBe(true);
    });

    it('tanggal mulai sudah lewat (pengajuan mundur): wajib lampiran', () => {
      expect(leaveNeedsAttachment(new Date(Date.UTC(2026, 8, 15)), submittedAt)).toBe(true);
    });

    it('timezone-safe: jam pengajuan larut malam tidak membuat H-7 dianggap kurang dari H-7', () => {
      const lateNightSubmission = new Date(Date.UTC(2026, 8, 20, 23, 59, 59));
      expect(leaveNeedsAttachment(new Date(Date.UTC(2026, 8, 27, 0, 0, 0)), lateNightSubmission)).toBe(false);
    });

    it('menghormati parameter minDaysBefore kustom', () => {
      const start = new Date(Date.UTC(2026, 8, 23)); // H-3
      expect(leaveNeedsAttachment(start, submittedAt, 3)).toBe(false);
      expect(leaveNeedsAttachment(start, submittedAt, 4)).toBe(true);
    });

    it('default minDaysBefore mengikuti konstanta H-7', () => {
      expect(LEAVE_ATTACHMENT_MIN_DAYS_BEFORE).toBe(7);
    });
  });
});
