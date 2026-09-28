/**
 * Kebijakan saldo cuti (aturan murni, tanpa Prisma).
 *
 * Aturan bisnis: setiap pengajuan cuti memotong saldo (`LeaveBalance`) pada
 * tahun tanggal MULAI cuti. Karena pemotongan saldo di approval
 * (`finalizeApprovalEffects`) mewajibkan baris saldo ada DAN mencukupi untuk
 * semua jenis cuti, aturan yang sama harus sudah ditegakkan saat pengajuan
 * dibuat — kalau tidak, pengajuan tersimpan hanya untuk ditolak di meja atasan.
 *
 * Dua pelanggaran dibedakan dengan sengaja karena tindak lanjutnya berbeda:
 * - NO_ALLOCATION: HR belum pernah menetapkan saldo jenis+tahun tsb.
 * - INSUFFICIENT: saldo ada tapi sisanya kurang dari hari kerja yang diajukan.
 */

/** Tahun buku saldo yang dipakai sebuah pengajuan = tahun tanggal mulai. */
export function leaveBalanceYear(startDate: Date): number {
  return startDate.getFullYear();
}

export type LeaveBalanceViolation =
  | {
      code: 'NO_ALLOCATION';
      leaveTypeName: string;
      year: number;
      requestedDays: number;
    }
  | {
      code: 'INSUFFICIENT';
      leaveTypeName: string;
      year: number;
      requestedDays: number;
      remainingDays: number;
    };

/**
 * Konteks pesan. Pengaju butuh instruksi "hubungi HR / pilih jenis lain",
 * approver butuh instruksi "minta HR menetapkan saldo".
 */
export type LeaveBalanceAudience = 'REQUESTER' | 'APPROVER';

/**
 * Evaluasi saldo terhadap jumlah hari kerja yang diajukan.
 *
 * @param remainingDays sisa saldo, atau null/undefined bila baris saldo untuk
 *   jenis+tahun tsb belum ada sama sekali (beda dengan saldo 0).
 * @returns pelanggaran yang ditemukan, atau null bila saldo mencukupi.
 */
export function evaluateLeaveBalance(input: {
  leaveTypeName: string;
  year: number;
  requestedDays: number;
  remainingDays: number | null | undefined;
}): LeaveBalanceViolation | null {
  const { leaveTypeName, year, requestedDays, remainingDays } = input;

  if (remainingDays === null || remainingDays === undefined) {
    return { code: 'NO_ALLOCATION', leaveTypeName, year, requestedDays };
  }
  if (remainingDays < requestedDays) {
    return { code: 'INSUFFICIENT', leaveTypeName, year, requestedDays, remainingDays };
  }
  return null;
}

/** Pesan Indonesia yang informatif untuk sebuah pelanggaran saldo. */
export function leaveBalanceViolationMessage(
  violation: LeaveBalanceViolation,
  audience: LeaveBalanceAudience
): string {
  if (violation.code === 'NO_ALLOCATION') {
    return audience === 'APPROVER'
      ? `Karyawan belum punya saldo ${violation.leaveTypeName} untuk tahun ${violation.year}. Minta HR menetapkan saldo sebelum menyetujui.`
      : `Anda belum punya alokasi saldo cuti ${violation.leaveTypeName} untuk tahun ${violation.year}, jadi jenis cuti ini belum bisa diajukan. Hubungi HR untuk penetapan saldo atau pilih jenis cuti lain.`;
  }
  return audience === 'APPROVER'
    ? `Saldo ${violation.leaveTypeName} tidak cukup: sisa ${violation.remainingDays} hari, diajukan ${violation.requestedDays} hari.`
    : `Saldo cuti ${violation.leaveTypeName} tahun ${violation.year} tidak cukup: sisa ${violation.remainingDays} hari, sedangkan pengajuan ini memakai ${violation.requestedDays} hari kerja.`;
}
