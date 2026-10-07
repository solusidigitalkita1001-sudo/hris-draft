import prisma from '@/shared/database/prisma';
import { logger } from '@/shared/logger/WinstonLogger';
import { runInSystemContext } from '@/shared/context/RequestContext';
import { DEFAULT_COMPANY_SETTINGS } from '@/modules/company-settings/company-settings.service';
import { carryOverDeadlinePassed, computeCarryOverForfeit } from '@/shared/leave/carryover-expiry';

export interface CarryOverExpiryResult {
  year: number;
  /** Companies with a deadline configured and already passed. */
  companies: number;
  checked: number;
  expired: number;
  daysForfeited: number;
}

/**
 * Forfeits unused carried-over days once a company's cut-off has passed.
 *
 * Runs daily rather than once a year, because the cut-off is a date inside the
 * year and a job that only fires on 1 January would miss it by months. Each
 * balance is stamped `carryOverExpiredAt`, so a sweep that runs every morning
 * forfeits once and then leaves the row alone.
 *
 * Nothing happens for a company that has set no deadline — `0` is the default,
 * and it is the behaviour that existed before this feature, so no tenant loses
 * days because the code shipped.
 */
export async function sweepCarryOverExpiry(now = new Date()): Promise<CarryOverExpiryResult> {
  return runInSystemContext('carryover-expiry-sweep', async () => {
    const year = now.getUTCFullYear();
    const result: CarryOverExpiryResult = { year, companies: 0, checked: 0, expired: 0, daysForfeited: 0 };

    const settings = await prisma.companySetting.findMany({
      where: { key: 'leave_carryover_expiry_month' },
      select: { companyId: true, value: true },
    });
    const defaultMonth = Number(DEFAULT_COMPANY_SETTINGS.leave_carryover_expiry_month);
    const due = settings
      .map((row) => ({ companyId: row.companyId, month: Number(row.value) }))
      .filter((row) => carryOverDeadlinePassed(row.month, year, now));
    // A company with no row keeps the default, which is "no deadline", so it
    // is absent from this list by construction rather than by omission.
    if (defaultMonth >= 1 && carryOverDeadlinePassed(defaultMonth, year, now)) {
      logger.warn('Default carry-over expiry month is set; companies without an explicit row are not swept', { defaultMonth });
    }
    result.companies = due.length;
    if (!due.length) {
      logger.info('Carry-over expiry sweep: no company past its deadline', { ...result });
      return result;
    }

    for (const company of due) {
      const balances = await prisma.leaveBalance.findMany({
        where: {
          companyId: company.companyId,
          year,
          carryOverDays: { gt: 0 },
          carryOverExpiredAt: null,
          expiredAt: null,
        },
        select: { id: true, totalDays: true, usedDays: true, carryOverDays: true },
      });
      result.checked += balances.length;

      for (const balance of balances) {
        const forfeit = computeCarryOverForfeit(balance);
        // Stamped even when nothing is lost: the deadline has passed for this
        // row either way, and leaving it unstamped means re-reading it every
        // morning for the rest of the year.
        await prisma.leaveBalance.update({
          where: { id: balance.id },
          data: {
            carryOverExpiredAt: now,
            ...(forfeit.forfeited > 0
              ? { totalDays: forfeit.totalDays, remainingDays: forfeit.remainingDays }
              : {}),
          },
        });
        if (forfeit.forfeited > 0) {
          result.expired += 1;
          result.daysForfeited += forfeit.forfeited;
        }
      }
    }

    logger.info('Carry-over expiry sweep finished', { ...result });
    return result;
  });
}
