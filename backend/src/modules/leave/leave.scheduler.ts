import { queueManager, QueueNames } from '@/infrastructure/queue/QueueManager';
import { logger } from '@/shared/logger/WinstonLogger';
import prisma from '@/shared/database/prisma';
import { leaveService } from './leave.service';

export const LEAVE_YEARLY_ACCRUAL_JOB = 'leave:yearly-accrual';

/**
 * Jalankan carry-over & accrual tahunan untuk semua karyawan aktif.
 * Dipanggil oleh worker saat job `leave:yearly-accrual` diproses.
 */
export async function runYearlyLeaveAccrual(year: number): Promise<{ processed: number; failed: number }> {
  logger.info('Leave yearly accrual started', { year });
  const prevYear = year - 1;

  // Expire saldo tahun lalu (carry-over sudah dihitung saat create balance tahun ini)
  const expiredCount = await prisma.leaveBalance.updateMany({
    where: { year: prevYear, remainingDays: { gt: 0 }, expiredAt: null },
    data: { expiredAt: new Date(), remainingDays: 0 },
  });
  logger.info('Previous year leave balances expired', { year: prevYear, count: expiredCount.count });

  // Ambil semua karyawan aktif beserta company mereka
  const employees = await prisma.employee.findMany({
    where: { deletedAt: null, status: 'ACTIVE' },
    select: { id: true, companyId: true },
  });

  // Ambil semua leave type tahunan per company
  const leaveTypes = await prisma.leaveType.findMany({
    where: { isAnnual: true, deletedAt: null },
    select: { id: true, companyId: true },
  });

  const leaveTypesByCompany: Record<string, string[]> = {};
  for (const lt of leaveTypes) {
    if (!leaveTypesByCompany[lt.companyId]) leaveTypesByCompany[lt.companyId] = [];
    leaveTypesByCompany[lt.companyId].push(lt.id);
  }

  let processed = 0;
  let failed = 0;

  for (const employee of employees) {
    const companyLeaveTypes = leaveTypesByCompany[employee.companyId] ?? [];
    for (const leaveTypeId of companyLeaveTypes) {
      try {
        await leaveService.accrueAnnualBalance({ employeeId: employee.id, leaveTypeId, year });
        processed++;
      } catch (err) {
        logger.error('Failed to accrue leave balance', { employeeId: employee.id, leaveTypeId, year, err });
        failed++;
      }
    }
  }

  logger.info('Leave yearly accrual finished', { year, processed, failed });
  return { processed, failed };
}

/**
 * Register cron job: jalankan tiap 1 Jan pukul 01:00.
 * Aman dipanggil berkali-kali — BullMQ dedup by repeat key.
 */
export async function scheduleYearlyLeaveAccrual(): Promise<void> {
  if (!queueManager.isEnabled()) {
    logger.warn('Queue disabled — yearly leave accrual will not be scheduled');
    return;
  }

  await queueManager.enqueue(
    QueueNames.LEAVE_AUTOMATION,
    LEAVE_YEARLY_ACCRUAL_JOB,
    {},
    {
      repeat: { pattern: '0 1 1 1 *' },
      jobId: 'leave-yearly-accrual-cron',
    }
  );

  logger.info('Yearly leave accrual cron scheduled', { pattern: '0 1 1 1 *' });
}
