import { queueManager, QueueNames } from '@/infrastructure/queue/QueueManager';
import { logger } from '@/shared/logger/WinstonLogger';
import prisma from '@/shared/database/prisma';
import { leaveService } from './leave.service';
import { DEFAULT_COMPANY_SETTINGS } from '@/modules/company-settings/company-settings.service';

export const LEAVE_YEARLY_ACCRUAL_JOB = 'leave:yearly-accrual';

/**
 * Jalankan carry-over & accrual tahunan untuk semua karyawan aktif.
 * Dipanggil oleh worker saat job `leave:yearly-accrual` diproses.
 */
export async function runYearlyLeaveAccrual(year: number): Promise<{ processed: number; failed: number; expired: number; skippedExpiry: number }> {
  logger.info('Leave yearly accrual started', { year });
  const prevYear = year - 1;

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

  // Carry-over cap per company. Read directly rather than through
  // companySettingsService, which resolves the company from request context
  // that a cron job does not have.
  const caps = new Map<string, number>();
  const capFor = async (companyId: string) => {
    const cached = caps.get(companyId);
    if (cached !== undefined) return cached;
    const row = await prisma.companySetting.findUnique({
      where: { companyId_key: { companyId, key: 'leave_carryover_max_days' } },
      select: { value: true },
    });
    const parsed = Number(row?.value ?? DEFAULT_COMPANY_SETTINGS.leave_carryover_max_days);
    const cap = Number.isInteger(parsed) && parsed >= 0
      ? parsed
      : Number(DEFAULT_COMPANY_SETTINGS.leave_carryover_max_days);
    caps.set(companyId, cap);
    return cap;
  };

  let processed = 0;
  let failed = 0;
  // Expiry must not touch an employee whose accrual failed. Zeroing last
  // year's balance after the addition for this year never happened destroys
  // days the employee is still owed, with nothing left to reconstruct them
  // from — the loss is silent, and the job reports success around it.
  const failedEmployeeIds = new Set<string>();

  for (const employee of employees) {
    const companyLeaveTypes = leaveTypesByCompany[employee.companyId] ?? [];
    const maxCarryOver = await capFor(employee.companyId);
    for (const leaveTypeId of companyLeaveTypes) {
      try {
        await leaveService.accrueAnnualBalance({ employeeId: employee.id, leaveTypeId, year, maxCarryOver });
        processed++;
      } catch (err) {
        logger.error('Failed to accrue leave balance', { employeeId: employee.id, leaveTypeId, year, err });
        failed++;
        failedEmployeeIds.add(employee.id);
      }
    }
  }

  // Expire saldo tahun lalu SETELAH accrual, bukan sebelumnya.
  //
  // Carry-over membaca `remainingDays` tahun lalu lewat `findAccrualInputs`.
  // Ketika expire berjalan lebih dulu, field itu sudah di-nol-kan sehingga
  // `previousRemaining` selalu 0 dan carry-over tidak pernah membawa apa pun —
  // fitur yang justru menjadi alasan job ini ada. Urutan ini yang membuatnya
  // benar-benar berpindah.
  const expiredCount = await prisma.leaveBalance.updateMany({
    where: {
      year: prevYear,
      remainingDays: { gt: 0 },
      expiredAt: null,
      ...(failedEmployeeIds.size ? { employeeId: { notIn: [...failedEmployeeIds] } } : {}),
    },
    data: { expiredAt: new Date(), remainingDays: 0 },
  });
  logger.info('Previous year leave balances expired', {
    year: prevYear,
    count: expiredCount.count,
    skippedEmployees: failedEmployeeIds.size,
  });

  logger.info('Leave yearly accrual finished', { year, processed, failed, skipped: failedEmployeeIds.size });
  return { processed, failed, expired: expiredCount.count, skippedExpiry: failedEmployeeIds.size };
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
