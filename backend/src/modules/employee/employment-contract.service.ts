import { PROBATION_MAX_MONTHS } from '@/shared/employment/probation';
import { EmploymentContractStatus, EmploymentContractType } from '@prisma/client';
import prisma from '@/shared/database/prisma';
import { BadRequestError, NotFoundError } from '@/shared/exceptions/AppError';
import { logger } from '@/shared/logger/WinstonLogger';
import { getCurrentUser, runInSystemContext } from '@/shared/context/RequestContext';
import { assertEmployeeInScope } from '@/shared/security/employee-data-scope';

/** PP 35/2021: PKWT and its renewals may not exceed five years in total. */
export const PKWT_MAX_TOTAL_MONTHS = 60;
/** UU 13/2003 art. 60: probation is capped at three months. */
export { PROBATION_MAX_MONTHS } from '@/shared/employment/probation';
/** When a reminder goes out before the contract ends. */
export const REMINDER_OFFSETS_DAYS = [30, 14, 7];

export interface CreateContractInput {
  employeeId: string;
  type: EmploymentContractType;
  startDate: string;
  endDate?: string;
  contractNumber?: string;
  notes?: string;
}

function toDateOnly(value: string | Date): Date {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new BadRequestError('Invalid contract date');
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

/** Whole months between two dates, rounded up, as contract law counts them. */
export function monthsBetween(start: Date, end: Date): number {
  const months = (end.getUTCFullYear() - start.getUTCFullYear()) * 12 + (end.getUTCMonth() - start.getUTCMonth());
  return end.getUTCDate() >= start.getUTCDate() ? months : months - 1;
}

function daysUntil(target: Date, now: Date): number {
  const a = Date.UTC(target.getUTCFullYear(), target.getUTCMonth(), target.getUTCDate());
  const b = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.round((a - b) / 86_400_000);
}

/**
 * Employment contracts, with the renewal history kept (GAP-19/20).
 *
 * A table rather than two date columns on the employee, because PKWT carries a
 * **statutory ceiling on total fixed-term service**. Without the history the
 * system cannot warn when that ceiling is passed — a second renewal would
 * simply overwrite the first — and passing it converts the employment to
 * permanent by operation of law. That is the most expensive kind of compliance
 * failure: invisible until someone disputes it.
 *
 * The legal limits are checked and reported, not silently enforced away: HR is
 * told what the law says and what this contract would do, because there are
 * lawful arrangements this service cannot see (a genuine break in service, a
 * different legal entity).
 */
export class EmploymentContractService {
  async create(companyId: string, input: CreateContractInput) {
    await assertEmployeeInScope(input.employeeId, 'employee');

    const employee = await prisma.employee.findFirst({
      where: { id: input.employeeId, companyId, deletedAt: null },
      select: { id: true },
    });
    if (!employee) throw new NotFoundError('Employee not found in the active company');

    const startDate = toDateOnly(input.startDate);
    const endDate = input.endDate ? toDateOnly(input.endDate) : null;

    if (input.type === EmploymentContractType.PKWTT) {
      // A PKWTT with an end date is a contradiction: "indefinite until the 30th".
      if (endDate) throw new BadRequestError('PKWTT tidak boleh punya tanggal berakhir');
    } else if (!endDate) {
      throw new BadRequestError(`${input.type} wajib punya tanggal berakhir`);
    }

    if (endDate && endDate <= startDate) {
      throw new BadRequestError('Tanggal berakhir harus setelah tanggal mulai');
    }

    const warnings: string[] = [];

    if (input.type === EmploymentContractType.PROBATION && endDate) {
      const months = monthsBetween(startDate, endDate);
      if (months > PROBATION_MAX_MONTHS) {
        // Over three months the probation clause is void, and dismissing
        // someone under it afterwards is an unlawful termination.
        throw new BadRequestError(
          `Masa percobaan maksimal ${PROBATION_MAX_MONTHS} bulan (UU 13/2003 pasal 60); kontrak ini ${months} bulan`,
        );
      }
    }

    // Overlapping active contracts mean two answers to "what are they on now".
    const overlapping = await prisma.employmentContract.findFirst({
      where: {
        employeeId: input.employeeId,
        companyId,
        deletedAt: null,
        status: EmploymentContractStatus.ACTIVE,
        startDate: endDate ? { lte: endDate } : undefined,
        OR: [{ endDate: null }, { endDate: { gte: startDate } }],
      },
      select: { id: true, type: true, startDate: true, endDate: true },
    });
    if (overlapping) {
      throw new BadRequestError(
        `Kontrak aktif lain masih tumpang tindih (${overlapping.type}, mulai ${overlapping.startDate.toISOString().slice(0, 10)}). Akhiri atau tandai RENEWED lebih dulu.`,
      );
    }

    if (input.type === EmploymentContractType.PKWT && endDate) {
      const history = await prisma.employmentContract.findMany({
        where: {
          employeeId: input.employeeId,
          companyId,
          deletedAt: null,
          type: EmploymentContractType.PKWT,
          status: { in: [EmploymentContractStatus.ACTIVE, EmploymentContractStatus.ENDED, EmploymentContractStatus.RENEWED] },
        },
        select: { startDate: true, endDate: true },
      });

      const pastMonths = history.reduce(
        (sum, row) => sum + (row.endDate ? Math.max(0, monthsBetween(row.startDate, row.endDate)) : 0),
        0,
      );
      const thisMonths = monthsBetween(startDate, endDate);
      const total = pastMonths + thisMonths;

      if (total > PKWT_MAX_TOTAL_MONTHS) {
        warnings.push(
          `pkwt:TOTAL_EXCEEDS_LEGAL_LIMIT_${total}_OF_${PKWT_MAX_TOTAL_MONTHS}_MONTHS`,
        );
      }
      if (history.length >= 1) {
        warnings.push(`pkwt:RENEWAL_NUMBER_${history.length + 1}`);
      }
    }

    const contract = await prisma.employmentContract.create({
      data: {
        companyId,
        employeeId: input.employeeId,
        contractNumber: input.contractNumber,
        type: input.type,
        startDate,
        endDate,
        notes: input.notes,
        createdBy: getCurrentUser()?.id ?? null,
      },
    });

    logger.info('Employment contract created', { id: contract.id, companyId, type: contract.type, warnings });
    return { contract, warnings };
  }

  async list(companyId: string, filters: { employeeId?: string; status?: EmploymentContractStatus } = {}) {
    return prisma.employmentContract.findMany({
      where: {
        companyId,
        deletedAt: null,
        ...(filters.employeeId ? { employeeId: filters.employeeId } : {}),
        ...(filters.status ? { status: filters.status } : {}),
      },
      orderBy: [{ employeeId: 'asc' }, { startDate: 'desc' }],
      include: { employee: { select: { employeeNumber: true, fullName: true } } },
    });
  }

  /** Contracts ending within `days`, so HR can act before they lapse. */
  async expiring(companyId: string, days: number, now = new Date()) {
    const horizon = new Date(now);
    horizon.setUTCDate(horizon.getUTCDate() + days);

    const rows = await prisma.employmentContract.findMany({
      where: {
        companyId,
        deletedAt: null,
        status: EmploymentContractStatus.ACTIVE,
        endDate: { not: null, gte: toDateOnly(now), lte: toDateOnly(horizon) },
      },
      orderBy: { endDate: 'asc' },
      include: { employee: { select: { employeeNumber: true, fullName: true } } },
    });

    return rows.map((row) => ({
      ...row,
      daysRemaining: row.endDate ? daysUntil(row.endDate, now) : null,
    }));
  }

  /**
   * The decision at the end of a probation (GAP-20). The reminders and the
   * three-month cap already existed; what was missing was any way to record
   * the outcome, because the only move available was the generic status change
   * — and ENDED/TERMINATED/RENEWED cannot tell "passed, now permanent" apart
   * from "the contract simply ran out".
   *
   * PASS renews, FAIL terminates, EXTEND moves the end date — and EXTEND is
   * re-checked against the same statutory cap as creation, because a probation
   * extended past three months is a void clause (UU 13/2003 art. 60) and
   * dismissing on it is unlawful termination. Extending through a side door
   * would be the easiest way to lose that protection.
   */
  async decideProbation(companyId: string, id: string, input: {
    decision: 'PASS' | 'EXTEND' | 'FAIL';
    notes?: string;
    extendToDate?: string;
  }, decidedBy?: string) {
    const contract = await prisma.employmentContract.findFirst({
      where: { id, companyId, deletedAt: null },
      select: { id: true, status: true, type: true, startDate: true, endDate: true },
    });
    if (!contract) throw new NotFoundError('Employment contract not found');
    if (contract.type !== EmploymentContractType.PROBATION) {
      throw new BadRequestError('Hanya kontrak masa percobaan yang punya keputusan review probasi');
    }
    if (contract.status !== EmploymentContractStatus.ACTIVE) {
      throw new BadRequestError(`Keputusan probasi hanya untuk kontrak aktif; kontrak ini ${contract.status}`);
    }

    const data: Record<string, unknown> = {
      probationDecision: input.decision,
      probationDecidedBy: decidedBy ?? null,
      probationDecidedAt: new Date(),
      probationNotes: input.notes ?? null,
    };

    if (input.decision === 'EXTEND') {
      if (!input.extendToDate) throw new BadRequestError('EXTEND membutuhkan extendToDate');
      const to = new Date(input.extendToDate);
      if (Number.isNaN(to.getTime())) throw new BadRequestError('extendToDate tidak valid');
      if (contract.endDate && to <= contract.endDate) {
        throw new BadRequestError('extendToDate harus setelah tanggal akhir yang berlaku');
      }
      const months = monthsBetween(contract.startDate, to);
      if (months > PROBATION_MAX_MONTHS) {
        throw new BadRequestError(
          `Masa percobaan maksimal ${PROBATION_MAX_MONTHS} bulan (UU 13/2003 pasal 60); perpanjangan ini ${months} bulan`,
        );
      }
      data.endDate = to;
      // A new deadline deserves a fresh reminder cycle.
      data.lastReminderDays = null;
    } else {
      data.status = input.decision === 'PASS'
        ? EmploymentContractStatus.RENEWED
        : EmploymentContractStatus.TERMINATED;
    }

    return prisma.employmentContract.update({ where: { id: contract.id }, data });
  }

  async updateStatus(companyId: string, id: string, status: EmploymentContractStatus) {
    const contract = await prisma.employmentContract.findFirst({
      where: { id, companyId, deletedAt: null },
      select: { id: true, status: true },
    });
    if (!contract) throw new NotFoundError('Employment contract not found');
    if (contract.status !== EmploymentContractStatus.ACTIVE) {
      throw new BadRequestError(`Only an active contract can change status; this one is ${contract.status}`);
    }
    if (status === EmploymentContractStatus.ACTIVE) {
      throw new BadRequestError('A contract is already active; choose ENDED, TERMINATED or RENEWED');
    }

    return prisma.employmentContract.update({
      where: { id: contract.id },
      data: { status },
      select: { id: true, status: true },
    });
  }

  /**
   * Daily sweep: notify about contracts approaching their end date.
   *
   * Recipients are the employee's supervisor (via the position they report to)
   * and the company's HR and admin roles. One notification per offset, recorded
   * on the row, so a sweep running every day does not repeat itself — the point
   * is a reminder, and a reminder that arrives thirty times is noise people
   * learn to ignore.
   */
  async sweepExpiryReminders(now = new Date()) {
    return runInSystemContext('employment-contract-reminder-sweep', async () => {
      const result = { checked: 0, notified: 0, skipped: 0, recipients: 0 };

      const horizon = new Date(now);
      horizon.setUTCDate(horizon.getUTCDate() + Math.max(...REMINDER_OFFSETS_DAYS));

      const contracts = await prisma.employmentContract.findMany({
        where: {
          deletedAt: null,
          status: EmploymentContractStatus.ACTIVE,
          endDate: { not: null, gte: toDateOnly(now), lte: toDateOnly(horizon) },
        },
        include: {
          employee: {
            select: {
              id: true, employeeNumber: true, fullName: true,
              position: { select: { reportsTo: { select: { id: true } } } },
            },
          },
        },
      });
      result.checked = contracts.length;

      for (const contract of contracts) {
        if (!contract.endDate) continue;
        const remaining = daysUntil(contract.endDate, now);
        // The offset this reminder belongs to: the tightest one already passed.
        const offset = REMINDER_OFFSETS_DAYS.filter((days) => remaining <= days).sort((a, b) => a - b)[0];
        if (offset === undefined) { result.skipped++; continue; }
        if (contract.lastReminderDays !== null && contract.lastReminderDays <= offset) {
          result.skipped++;
          continue;
        }

        const recipients = await this.reminderRecipients(contract.companyId, contract.employee.position?.reportsTo?.id ?? null);
        if (recipients.length) {
          const label = contract.type === EmploymentContractType.PROBATION ? 'Masa percobaan' : 'Kontrak kerja';
          await prisma.notification.createMany({
            data: recipients.map((userId) => ({
              companyId: contract.companyId,
              userId,
              title: `${label} berakhir dalam ${remaining} hari`,
              message: `${label} ${contract.employee.fullName} (${contract.employee.employeeNumber}) berakhir ${contract.endDate?.toISOString().slice(0, 10)}. Putuskan perpanjangan atau pengakhiran sebelum tanggal itu.`,
              type: 'WARNING' as const,
              resource: 'employment-contract',
              action: 'CONTRACT_EXPIRING',
              referenceId: contract.id,
            })),
          });
          result.recipients += recipients.length;
          result.notified++;
        }

        await prisma.employmentContract.update({
          where: { id: contract.id },
          data: { lastReminderAt: new Date(), lastReminderDays: offset },
        });
      }

      if (result.checked) logger.info('Employment contract reminder sweep finished', { ...result });
      return result;
    });
  }

  private async reminderRecipients(companyId: string, reportsToPositionId: string | null): Promise<string[]> {
    const recipients = new Set<string>();

    if (reportsToPositionId) {
      const supervisors = await prisma.employee.findMany({
        where: { companyId, positionId: reportsToPositionId, deletedAt: null, status: 'ACTIVE' },
        select: { user: { select: { id: true, status: true } } },
      });
      for (const supervisor of supervisors) {
        if (supervisor.user?.status === 'ACTIVE') recipients.add(supervisor.user.id);
      }
    }

    // HR and company administrators. Deliberately by role code rather than by
    // permission lookup: the audience for a contract reminder is a job, not a
    // capability, and a role code is what an administrator can reason about.
    const hrUsers = await prisma.userRole.findMany({
      where: {
        role: { code: { in: ['HR_MANAGER', 'HR_STAFF', 'COMPANY_ADMIN'] } },
        user: { deletedAt: null, status: 'ACTIVE', companyAccesses: { some: { companyId } } },
      },
      select: { userId: true },
    });
    for (const row of hrUsers) recipients.add(row.userId);

    return [...recipients];
  }
}

export const employmentContractService = new EmploymentContractService();