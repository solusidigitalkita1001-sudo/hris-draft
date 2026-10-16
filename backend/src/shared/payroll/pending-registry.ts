import { Prisma } from '@prisma/client';
import prisma from '@/shared/database/prisma';
import { BadRequestError, NotFoundError } from '@/shared/exceptions/AppError';

/**
 * Siklus hidup bersama ketiga registry pembayaran tertunda payroll — rapel
 * (arrears), koreksi, dan pesangon. Polanya satu: baris didaftarkan PENDING;
 * sebuah run payroll MENGKLAIMNYA lewat conditional update yang dihitung
 * (status masih PENDING, count harus pas — kalau run lain menyambar lebih
 * dulu, kalkulasi gagal utuh alih-alih membayar baris yang sama dua kali);
 * pembatalan hanya atas baris yang masih PENDING, dengan pagar yang sama.
 *
 * Pendaftaran (register) dan query daftar TIDAK di sini — bentuknya beda per
 * registry. Yang disatukan hanya mesin klaimnya.
 */

type Db = Prisma.TransactionClient | typeof prisma;

/** Potongan delegate Prisma yang dibutuhkan mesin klaim; structural supaya ketiga model cocok. */
interface RegistryDelegate {
  findFirst(args: {
    where: Record<string, unknown>;
    select: { id: true; status: true };
  }): Promise<{ id: string; status: string } | null>;
  updateMany(args: {
    where: Record<string, unknown>;
    data: Record<string, unknown>;
  }): Promise<{ count: number }>;
}

export interface PendingRegistryMessages {
  notFound: string;
  onlyPendingCancellable: (status: string) => string;
  claimedWhileCancelling: string;
  changedWhileCalculating: string;
}

export function createPendingRegistry(options: {
  delegate: (db: Db) => RegistryDelegate;
  messages: PendingRegistryMessages;
}) {
  const { delegate, messages } = options;
  return {
    async cancel(companyId: string, id: string): Promise<{ id: string; status: 'CANCELLED' }> {
      const row = await delegate(prisma).findFirst({
        where: { id, companyId }, select: { id: true, status: true },
      });
      if (!row) throw new NotFoundError(messages.notFound);
      if (row.status !== 'PENDING') throw new BadRequestError(messages.onlyPendingCancellable(row.status));

      // Conditional update: a run that claimed this row a moment ago moved it
      // out of PENDING, and cancelling it afterwards would hide money already
      // paid.
      const result = await delegate(prisma).updateMany({
        where: { id, companyId, status: 'PENDING' },
        data: { status: 'CANCELLED' },
      });
      if (result.count === 0) throw new BadRequestError(messages.claimedWhileCancelling);
      return { id, status: 'CANCELLED' };
    },

    async markApplied(
      companyId: string,
      runId: string,
      claims: Array<{ id: string; payslipId: string }>,
      database: Db = prisma,
      extraData: Record<string, unknown> = {},
    ): Promise<void> {
      for (const claim of claims) {
        const result = await delegate(database).updateMany({
          where: { id: claim.id, companyId, status: 'PENDING' },
          data: {
            status: 'APPLIED',
            payslipId: claim.payslipId,
            appliedRunId: runId,
            appliedAt: new Date(),
            ...extraData,
          },
        });
        if (result.count !== 1) throw new BadRequestError(messages.changedWhileCalculating);
      }
    },
  };
}

/** Pending rows keyed by employee — the shape every run consumes. */
export function groupByEmployee<T extends { employeeId: string }>(rows: T[]): Map<string, T[]> {
  const byEmployee = new Map<string, T[]>();
  for (const row of rows) {
    const list = byEmployee.get(row.employeeId) ?? [];
    list.push(row);
    byEmployee.set(row.employeeId, list);
  }
  return byEmployee;
}
