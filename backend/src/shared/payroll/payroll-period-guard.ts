import { Prisma } from '@prisma/client';
import prisma from '@/shared/database/prisma';
import { ConflictError } from '@/shared/exceptions/AppError';

type Db = Prisma.TransactionClient | typeof prisma;

/**
 * Attendance/leave lock after payroll close (checklist §10): once a period's
 * attendance has been reviewed or the period is CLOSED, the source data that
 * fed the payroll run must stop moving. Any attendance or leave mutation for
 * a date inside such a period is rejected with 409 — corrections for a paid
 * period belong to an adjustment flow, not to silent history rewrites.
 */
export async function assertPayrollRangeOpen(companyId: string, start: Date, end: Date, db: Db = prisma): Promise<void> {
  const locked = await db.payrollPeriod.findFirst({
    where: {
      companyId,
      deletedAt: null,
      startDate: { lte: end },
      endDate: { gte: start },
      OR: [{ status: 'CLOSED' }, { attendanceReviewedAt: { not: null } }],
    },
    select: { name: true, status: true, attendanceReviewedAt: true },
  });
  if (locked) {
    const why = locked.status === 'CLOSED' ? 'sudah ditutup' : 'absensinya sudah direview untuk payroll';
    throw new ConflictError(`Periode payroll "${locked.name}" ${why}; data absensi/cuti tanggal tersebut terkunci. Gunakan alur adjustment payroll.`);
  }
}

export async function assertPayrollDateOpen(companyId: string, date: Date, db: Db = prisma): Promise<void> {
  return assertPayrollRangeOpen(companyId, date, date, db);
}
