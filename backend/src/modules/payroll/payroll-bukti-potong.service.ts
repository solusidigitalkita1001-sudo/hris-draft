import prisma from '@/shared/database/prisma';
import { ConflictError, NotFoundError } from '@/shared/exceptions/AppError';
import {
  buildForm1721VII, buildForm1721VIII, Form1721VII, Form1721VIII,
} from '@/shared/payroll/bukti-potong';

/**
 * Bahan e-Bupot 21/26 (GAP-33): data bukti potong selain 1721-A1, siap
 * dimasukkan/diimpor ke aplikasi e-Bupot DJP.
 *
 * - 1721-VIII per masa pajak (bulanan, pegawai tetap): satu baris per
 *   karyawan dari payslip run APPROVED/DISBURSED periode itu. Dibuat untuk
 *   setiap masa SELAIN masa pajak terakhir — masa terakhir memakai 1721-A1
 *   yang sudah ada di `annual-tax-recap.service.ts`.
 * - 1721-VII (final) untuk pesangon: dari `SeverancePayment` yang sudah
 *   APPLIED — angkanya beku sejak pendaftaran, bukti potongnya mengikuti.
 *
 * Definisi bruto/pph SAMA dengan rekap tahunan (`taxableOf`/`withheldOf`),
 * supaya VIII, A1 dan rekonsiliasi Desember tidak pernah berselisih.
 */
// NIK belum dimodelkan pada Employee; form menerima NPWP ATAU NIK, jadi baris
// tanpa NPWP ditandai `tanpaNpwp` dan NIK-nya diisi manusia di e-Bupot.
const EMPLOYEE_SELECT = {
  select: { id: true, fullName: true, employeeNumber: true, taxId: true, address: true },
};

export class PayrollBuktiPotongService {
  /** Baris 1721-VIII seluruh karyawan untuk satu periode. */
  async monthly(companyId: string, periodId: string, employeeId?: string) {
    const period = await prisma.payrollPeriod.findFirst({
      where: { id: periodId, companyId, deletedAt: null },
      select: { id: true, code: true, name: true, startDate: true },
    });
    if (!period) throw new NotFoundError('Payroll period not found in the active company');

    const start = new Date(period.startDate);
    const taxMonth = start.getUTCMonth() + 1;
    const taxYear = start.getUTCFullYear();

    const payslips = await prisma.payslip.findMany({
      where: {
        companyId,
        ...(employeeId ? { employeeId } : {}),
        payrollRun: {
          periodId: period.id,
          status: { in: ['APPROVED', 'DISBURSED'] },
          // Pesangon final bukan objek 1721-VIII; buktinya 1721-VII di bawah.
          runType: { in: ['REGULAR', 'THR', 'CORRECTION'] },
        },
      },
      select: {
        employeeId: true,
        employee: EMPLOYEE_SELECT,
        components: {
          select: { type: true, amount: true, isTaxable: true, salaryComponent: { select: { code: true } } },
        },
      },
    });

    const byEmployee = new Map<string, { employee: (typeof payslips)[number]['employee']; bruto: number; pph: number }>();
    for (const slip of payslips) {
      const row = byEmployee.get(slip.employeeId) ?? { employee: slip.employee, bruto: 0, pph: 0 };
      for (const component of slip.components) {
        if (component.type === 'ALLOWANCE' && component.isTaxable) row.bruto += Number(component.amount);
        if (component.type === 'DEDUCTION' && component.salaryComponent?.code === 'PPH21') row.pph += Number(component.amount);
      }
      byEmployee.set(slip.employeeId, row);
    }

    const rows: Array<{
      employee: { id: string; fullName: string; employeeNumber: string; npwp: string | null; nik: string | null; address: string | null };
      form: Form1721VIII;
    }> = [];
    for (const row of byEmployee.values()) {
      // Bulan tanpa penghasilan kena pajak tidak punya bukti potong.
      if (row.bruto <= 0 && row.pph <= 0) continue;
      rows.push({
        employee: {
          id: row.employee.id,
          fullName: row.employee.fullName,
          employeeNumber: row.employee.employeeNumber,
          npwp: row.employee.taxId ?? null,
          nik: null,
          address: row.employee.address ?? null,
        },
        form: buildForm1721VIII({
          taxMonth, taxYear,
          bruto: row.bruto,
          pphDipotong: row.pph,
          hasNpwp: Boolean(row.employee.taxId),
        }),
      });
    }
    rows.sort((a, b) => a.employee.employeeNumber.localeCompare(b.employee.employeeNumber));
    return { period: { id: period.id, code: period.code, name: period.name }, taxMonth, taxYear, rows };
  }

  /** 1721-VII untuk satu pembayaran pesangon yang sudah dibayar run-nya. */
  async finalSeverance(companyId: string, severancePaymentId: string) {
    const payment = await prisma.severancePayment.findFirst({
      where: { id: severancePaymentId, companyId },
      include: { employee: EMPLOYEE_SELECT },
    });
    if (!payment) throw new NotFoundError('Severance payment not found');
    if (payment.status !== 'APPLIED' || !payment.appliedAt) {
      throw new ConflictError('Bukti potong dibuat untuk pesangon yang sudah DIBAYAR; pembayaran ini masih ' + payment.status);
    }
    // APPLIED saja belum berarti dibayar: klaim terjadi saat kalkulasi, saat
    // run baru COMPLETED dan masih bisa di-void. Gerbang yang sama dengan
    // 1721-VIII bulanan: bukti potong final hanya untuk run yang uangnya
    // benar-benar disetujui/cair.
    const appliedRun = payment.appliedRunId
      ? await prisma.payrollRun.findFirst({
          where: { id: payment.appliedRunId, companyId },
          select: { status: true },
        })
      : null;
    if (!appliedRun || (appliedRun.status !== 'APPROVED' && appliedRun.status !== 'DISBURSED')) {
      throw new ConflictError(
        'Run SEVERANCE yang membayar pesangon ini belum di-approve; bukti potong final menunggu uangnya pasti '
        + `(status run saat ini: ${appliedRun?.status ?? 'tidak ditemukan'})`,
      );
    }

    const basis = (payment.basis ?? {}) as { cumulativeGross?: number };
    const appliedAt = new Date(payment.appliedAt);
    const form: Form1721VII = buildForm1721VII({
      taxMonth: appliedAt.getUTCMonth() + 1,
      taxYear: appliedAt.getUTCFullYear(),
      bruto: Number(payment.grossAmount),
      pphDipotong: Number(payment.taxAmount),
      cumulativeGross: basis.cumulativeGross,
    });
    return {
      employee: {
        id: payment.employee.id,
        fullName: payment.employee.fullName,
        employeeNumber: payment.employee.employeeNumber,
        npwp: payment.employee.taxId ?? null,
        nik: null,
        address: payment.employee.address ?? null,
      },
      severancePaymentId: payment.id,
      resignationId: payment.resignationId,
      form,
    };
  }
}

/** CSV rekonsiliasi internal tim pajak — sengaja bukan berkas impor e-Bupot. */
export function monthlyToCsv(result: Awaited<ReturnType<PayrollBuktiPotongService['monthly']>>): string {
  const header = 'employeeNumber;fullName;npwp;nik;masaPajak;kodeObjek;bruto;dpp;tanpaNpwp;tarifPercent;pphDipotong';
  const lines = result.rows.map((row) => [
    row.employee.employeeNumber, row.employee.fullName,
    row.employee.npwp ?? '', row.employee.nik ?? '',
    row.form.masaPajak, row.form.taxObjectCode,
    row.form.bruto, row.form.dasarPengenaanPajak,
    row.form.tanpaNpwp ? 'X' : '', row.form.tarifPercent, row.form.pphDipotong,
  ].join(';'));
  return [header, ...lines].join('\n');
}

export const payrollBuktiPotongService = new PayrollBuktiPotongService();
