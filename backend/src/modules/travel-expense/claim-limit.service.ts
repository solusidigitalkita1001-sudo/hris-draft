import prisma from '@/shared/database/prisma';
import { BadRequestError } from '@/shared/exceptions/AppError';
import {
  checkCategoryLimit,
  type ClaimLimitCheckResult,
  type ExpenseCategory,
} from '@/shared/claims/claim-limit';

/**
 * `ClaimCategoryLimit` is a complete, carefully built table — per company, per
 * category, per period type, with a limit amount, a validity window and a
 * WARN-or-BLOCK action — and `shared/claims/claim-limit.ts` holds a tested
 * pure checker for it. Nothing called either. A plafond nobody enforces is a
 * number in a table.
 *
 * Two things worth stating about the shape of the enforcement:
 *
 * The schema is `@@unique([companyId, category, periodType])`, so one category
 * may carry several limits at once — two million a month *and* twenty million
 * a year is a perfectly ordinary policy. All of them are checked, not just
 * one, because enforcing the loosest would make the tighter one decorative.
 *
 * It changes nothing until HR sets a limit. No row exists today, and with no
 * row the checker reports `unlimited`, so no existing tenant's claims start
 * failing because this shipped.
 */

/** Longest window any period type can span, plus slack for month lengths. */
const HISTORY_DAYS = 400;

export interface ClaimLimitVerdict {
  warnings: string[];
  results: ClaimLimitCheckResult[];
}

/**
 * Throws when an active limit says BLOCK; returns warnings when one says WARN.
 * Rejected and cancelled claims are excluded: neither ever spent anything.
 */
export async function assertWithinCategoryLimits(params: {
  companyId: string;
  employeeId: string;
  category: ExpenseCategory;
  amount: number;
  expenseDate: Date | string;
}): Promise<ClaimLimitVerdict> {
  const limits = await prisma.claimCategoryLimit.findMany({
    where: { companyId: params.companyId, category: params.category, isActive: true },
  });
  if (!limits.length) return { warnings: [], results: [] };

  const reference = new Date(params.expenseDate);
  const since = new Date(reference);
  since.setUTCDate(since.getUTCDate() - HISTORY_DAYS);

  const history = await prisma.expenseClaim.findMany({
    where: {
      companyId: params.companyId,
      employeeId: params.employeeId,
      category: params.category,
      // A rejected or cancelled claim never spent anything; counting it
      // would quietly shrink the plafond for no reason.
      status: { notIn: ['REJECTED', 'CANCELLED'] },
      expenseDate: { gte: since, lte: reference },
    },
    select: { amount: true, expenseDate: true },
  });
  const submitted = history.map((row) => ({
    category: params.category,
    amount: Number(row.amount),
    expenseDate: row.expenseDate,
  }));

  const results = limits.map((limit) =>
    checkCategoryLimit(
      submitted,
      { category: params.category, amount: params.amount, expenseDate: reference },
      {
        companyId: limit.companyId,
        category: limit.category as ExpenseCategory,
        periodType: limit.periodType as never,
        limitAmount: Number(limit.limitAmount),
        violationAction: limit.violationAction as never,
        isActive: limit.isActive,
        validFrom: limit.validFrom,
        validUntil: limit.validUntil,
      },
      reference,
    ),
  );

  const blocked = results.find((result) => result.isBlock);
  if (blocked) {
    throw new BadRequestError(
      blocked.blockMessage
        ?? `Klaim melewati plafon ${blocked.category} (${blocked.periodType}): batas ${blocked.limitAmount}, pengajuan ini membuat total menjadi ${blocked.projectedTotal}.`,
    );
  }

  return {
    warnings: results.filter((result) => result.isWarn && result.warningMessage).map((result) => result.warningMessage as string),
    results,
  };
}


export async function listCategoryLimits(companyId: string) {
  return prisma.claimCategoryLimit.findMany({
    where: { companyId },
    orderBy: [{ category: 'asc' }, { periodType: 'asc' }],
  });
}

/**
 * Upsert on the natural key, so setting the same category and period twice
 * edits the policy rather than failing on the unique constraint.
 */
export async function upsertCategoryLimit(companyId: string, input: {
  category: string; periodType: string; limitAmount: number;
  violationAction: string; description?: string; isActive: boolean;
  validFrom?: string; validUntil?: string;
}) {
  const data = {
    limitAmount: input.limitAmount,
    violationAction: input.violationAction as never,
    description: input.description ?? null,
    isActive: input.isActive,
    validFrom: input.validFrom ? new Date(input.validFrom) : null,
    validUntil: input.validUntil ? new Date(input.validUntil) : null,
  };
  if (data.validFrom && data.validUntil && data.validUntil < data.validFrom) {
    throw new BadRequestError('validUntil mendahului validFrom');
  }
  return prisma.claimCategoryLimit.upsert({
    where: {
      companyId_category_periodType: {
        companyId,
        category: input.category as never,
        periodType: input.periodType as never,
      },
    },
    update: data,
    create: { companyId, category: input.category as never, periodType: input.periodType as never, ...data },
  });
}
