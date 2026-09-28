import {
  evaluateLeaveBalance,
  leaveBalanceViolationMessage,
  leaveBalanceYear,
} from './balance-policy';

describe('leave balance policy — aturan saldo cuti', () => {
  describe('leaveBalanceYear', () => {
    it('memakai tahun tanggal MULAI cuti (sama dengan approval & cancel)', () => {
      expect(leaveBalanceYear(new Date('2026-01-02T00:00:00Z'))).toBe(2026);
    });

    it('cuti yang melintasi tahun tetap memotong saldo tahun tanggal mulai', () => {
      // 30 Des 2026 – 2 Jan 2027 → dibebankan ke saldo 2026.
      expect(leaveBalanceYear(new Date('2026-12-30T00:00:00Z'))).toBe(2026);
    });
  });

  describe('evaluateLeaveBalance', () => {
    const base = { leaveTypeName: 'Annual Leave', year: 2026, requestedDays: 3 };

    it('saldo lebih dari pengajuan → tidak ada pelanggaran', () => {
      expect(evaluateLeaveBalance({ ...base, remainingDays: 9 })).toBeNull();
    });

    it('saldo tepat sama dengan pengajuan → boleh (batas inklusif, sama seperti approval)', () => {
      expect(evaluateLeaveBalance({ ...base, remainingDays: 3 })).toBeNull();
    });

    it('sisa kurang satu hari → INSUFFICIENT dengan angka sisa vs diajukan', () => {
      expect(evaluateLeaveBalance({ ...base, remainingDays: 2 })).toEqual({
        code: 'INSUFFICIENT',
        leaveTypeName: 'Annual Leave',
        year: 2026,
        requestedDays: 3,
        remainingDays: 2,
      });
    });

    it('belum ada baris saldo (null) → NO_ALLOCATION, bukan INSUFFICIENT', () => {
      expect(evaluateLeaveBalance({ ...base, leaveTypeName: 'Sick Leave', remainingDays: null }))
        .toEqual({ code: 'NO_ALLOCATION', leaveTypeName: 'Sick Leave', year: 2026, requestedDays: 3 });
    });

    it('undefined diperlakukan sama dengan null (baris saldo tidak ditemukan)', () => {
      const violation = evaluateLeaveBalance({ ...base, remainingDays: undefined });
      expect(violation?.code).toBe('NO_ALLOCATION');
    });

    it('saldo ada tapi sudah habis (0) → INSUFFICIENT, dibedakan dari belum ada alokasi', () => {
      const violation = evaluateLeaveBalance({ ...base, remainingDays: 0 });
      expect(violation).toMatchObject({ code: 'INSUFFICIENT', remainingDays: 0 });
    });

    it('saldo 0 dan pengajuan 0 hari kerja → tidak ada pelanggaran saldo', () => {
      expect(evaluateLeaveBalance({ ...base, requestedDays: 0, remainingDays: 0 })).toBeNull();
    });
  });

  describe('leaveBalanceViolationMessage', () => {
    it('NO_ALLOCATION ke pemohon: menyebut jenis + tahun dan mengarahkan ke HR', () => {
      const message = leaveBalanceViolationMessage(
        { code: 'NO_ALLOCATION', leaveTypeName: 'Sick Leave', year: 2026, requestedDays: 2 },
        'REQUESTER'
      );
      expect(message).toContain('Sick Leave');
      expect(message).toContain('2026');
      expect(message).toContain('HR');
    });

    it('NO_ALLOCATION ke approver: memakai kalimat sudut pandang approver', () => {
      expect(
        leaveBalanceViolationMessage(
          { code: 'NO_ALLOCATION', leaveTypeName: 'Sick Leave', year: 2026, requestedDays: 2 },
          'APPROVER'
        )
      ).toBe('Karyawan belum punya saldo Sick Leave untuk tahun 2026. Minta HR menetapkan saldo sebelum menyetujui.');
    });

    it('INSUFFICIENT ke pemohon: menyebut sisa dan jumlah hari kerja yang diajukan', () => {
      const message = leaveBalanceViolationMessage(
        { code: 'INSUFFICIENT', leaveTypeName: 'Annual Leave', year: 2026, requestedDays: 5, remainingDays: 2 },
        'REQUESTER'
      );
      expect(message).toContain('sisa 2 hari');
      expect(message).toContain('5 hari kerja');
    });

    it('INSUFFICIENT ke approver: mempertahankan format pesan approval yang sudah dipakai', () => {
      expect(
        leaveBalanceViolationMessage(
          { code: 'INSUFFICIENT', leaveTypeName: 'Annual Leave', year: 2026, requestedDays: 5, remainingDays: 2 },
          'APPROVER'
        )
      ).toBe('Saldo Annual Leave tidak cukup: sisa 2 hari, diajukan 5 hari.');
    });
  });
});
