import { Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '@/shared/middleware/Authenticate';
import { payrollService } from './payroll.service';
import { importSalaryMaster } from './salary-import.service';
import { journalToCsv } from '@/shared/payroll/journal';
import { Result } from '@/shared/core/Result';
import { payrollArrearsService } from './payroll-arrears.service';
import { annualTaxRecapService, recapToCsv } from './annual-tax-recap.service';
import { bpjsReportService, bpjsReportToCsv } from './bpjs-report.service';
import { sippWageExportToCsv } from '@/shared/payroll/sipp-wage-export';
import type { ArrearsQueryDTO, RegisterArrearsDTO } from './payroll-arrears.dto';
import { assertEmployeeInScope } from '@/shared/security/employee-data-scope';
import { payrollUnlockService } from './payroll-unlock.service';
import { payslipPinService } from './payslip-pin.service';
import PDFDocument from 'pdfkit';
import { AppError, BadRequestError } from '@/shared/exceptions/AppError';

function requiresPayrollUnlock(req: AuthenticatedRequest): boolean {
  const permissions = req.user?.permissions ?? [];
  const elevated = req.user?.roles?.includes('SUPER_ADMIN') || permissions.some((permission) =>
    ['payroll:process', 'payroll:approve', 'payroll:disburse', 'payroll:*'].includes(permission),
  );
  return Boolean(req.user?.employeeId) && !elevated;
}

function payrollUnlockToken(req: AuthenticatedRequest): string | undefined {
  const value = req.headers['x-payroll-unlock-token'];
  return Array.isArray(value) ? value[0] : value;
}

/** Token unlock PIN self-payslip — header terpisah dari jalur admin. */
function payslipSelfUnlockToken(req: AuthenticatedRequest): string | undefined {
  const value = req.headers['x-payslip-unlock'];
  return Array.isArray(value) ? value[0] : value;
}

function money(value: unknown): string {
  const amount = Number(value ?? 0);
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(amount);
}

async function createPayslipPdf(payslip: any): Promise<Buffer> {
  const document = new PDFDocument({ size: 'A4', margin: 48, info: { Title: `Payslip ${payslip.id}` } });
  const chunks: Buffer[] = [];
  document.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
  const completed = new Promise<Buffer>((resolve, reject) => {
    document.on('end', () => resolve(Buffer.concat(chunks)));
    document.on('error', reject);
  });

  document.fontSize(18).text('Slip Gaji', { align: 'center' }).moveDown();
  document.fontSize(10)
    .text(`Karyawan: ${payslip.employee?.fullName ?? '-'}`)
    .text(`Nomor karyawan: ${payslip.employee?.employeeNumber ?? '-'}`)
    .text(`Periode: ${payslip.payrollRun?.period?.name ?? payslip.payrollRun?.name ?? '-'}`)
    .text(`Status: ${payslip.status ?? '-'}`)
    .moveDown();
  document.fontSize(12).text('Ringkasan').moveDown(0.5);
  document.fontSize(10)
    .text(`Gaji pokok: ${money(payslip.baseSalary)}`)
    .text(`Total pendapatan: ${money(payslip.totalEarnings)}`)
    .text(`Total potongan: ${money(payslip.totalDeductions)}`)
    .font('Helvetica-Bold').text(`Gaji bersih: ${money(payslip.netPay)}`).font('Helvetica')
    .moveDown();

  if (Array.isArray(payslip.components) && payslip.components.length > 0) {
    document.fontSize(12).text('Komponen').moveDown(0.5);
    for (const component of payslip.components) {
      document.fontSize(9).text(`${component.name ?? 'Komponen'} (${component.type ?? '-'})`, { continued: true })
        .text(money(component.amount), { align: 'right' });
    }
  }
  document.moveDown(2).fontSize(8).fillColor('#666666')
    .text('Dokumen dibuat otomatis oleh HRIS. Validasi ke HR bila terdapat perbedaan.', { align: 'center' });
  document.end();
  return completed;
}

export class PayrollController {
  // ==================== Salary Components ====================

  async findAllSalaryComponents(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = req.query.companyId as string;
      const data = await payrollService.findAllSalaryComponents(companyId);
      res.json(Result.success(data));
    } catch (error) {
      next(error);
    }
  }

  async findSalaryComponentById(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const data = await payrollService.findSalaryComponentById(id);
      res.json(Result.success(data));
    } catch (error) {
      next(error);
    }
  }

  async createSalaryComponent(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await payrollService.createSalaryComponent(req.body);
      res.status(201).json(Result.created(data));
    } catch (error) {
      next(error);
    }
  }

  async updateSalaryComponent(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const data = await payrollService.updateSalaryComponent(id, req.body);
      res.json(Result.updated(data));
    } catch (error) {
      next(error);
    }
  }

  async deleteSalaryComponent(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      await payrollService.deleteSalaryComponent(id);
      res.json(Result.deleted());
    } catch (error) {
      next(error);
    }
  }

  // ==================== Employee Salaries ====================

  async findAllEmployeeSalaries(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = req.query.companyId as string;
      const employeeId = req.query.employeeId as string | undefined;
      const data = await payrollService.findAllEmployeeSalaries(companyId, employeeId);
      res.json(Result.success(data));
    } catch (error) {
      next(error);
    }
  }

  async findEmployeeSalaryById(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const data = await payrollService.findEmployeeSalaryById(id);
      res.json(Result.success(data));
    } catch (error) {
      next(error);
    }
  }

  async createEmployeeSalary(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await payrollService.createEmployeeSalary(req.body);
      res.status(201).json(Result.created(data));
    } catch (error) {
      next(error);
    }
  }

  async updateEmployeeSalary(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const data = await payrollService.updateEmployeeSalary(id, req.body);
      res.json(Result.updated(data));
    } catch (error) {
      next(error);
    }
  }

  async calculateEmployeeThr(req: Request, res: Response, next: NextFunction) {
    try {
      const employeeId = req.params.employeeId as string;
      // Enforce the caller's data scope on this by-path read (the middleware's
      // req.query rewrite cannot reach req.params) — closes THR salary disclosure.
      await assertEmployeeInScope(employeeId, 'payroll');
      const dateQuery = req.query.date as string | undefined;
      const referenceDate = dateQuery ? new Date(dateQuery) : undefined;
      const data = await payrollService.calculateEmployeeThr(employeeId, referenceDate);
      res.json(Result.success(data));
    } catch (error) {
      next(error);
    }
  }

  // ==================== Payroll Periods ====================

  async findAllPayrollPeriods(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = req.query.companyId as string;
      const data = await payrollService.findAllPayrollPeriods(companyId);
      res.json(Result.success(data));
    } catch (error) {
      next(error);
    }
  }

  async findPayrollPeriodById(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const data = await payrollService.findPayrollPeriodById(id);
      res.json(Result.success(data));
    } catch (error) {
      next(error);
    }
  }

  async createPayrollPeriod(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await payrollService.createPayrollPeriod(req.body);
      res.status(201).json(Result.created(data));
    } catch (error) {
      next(error);
    }
  }

  async updatePayrollPeriod(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const data = await payrollService.updatePayrollPeriod(id, req.body);
      res.json(Result.updated(data));
    } catch (error) {
      next(error);
    }
  }

  async closePayrollPeriod(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const data = await payrollService.closePayrollPeriod(id);
      res.json(Result.updated(data));
    } catch (error) {
      next(error);
    }
  }

  async getAttendanceSummary(req: Request, res: Response, next: NextFunction) {
    try {
      res.json(Result.success(await payrollService.getAttendanceSummaryForPeriod(req.params.id as string)));
    } catch (error) { next(error); }
  }

  async confirmAttendanceReview(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      res.json(Result.updated(await payrollService.confirmAttendanceReview(req.params.id as string, req.user!.id)));
    } catch (error) { next(error); }
  }

  // ==================== Payroll Runs ====================

  async findAllPayrollRuns(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = req.query.companyId as string;
      const data = await payrollService.findAllPayrollRuns(companyId);
      res.json(Result.success(data));
    } catch (error) {
      next(error);
    }
  }

  async findPayrollRunById(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const data = await payrollService.findPayrollRunById(id);
      res.json(Result.success(data));
    } catch (error) {
      next(error);
    }
  }

  /** Jurnal akuntansi per cost centre; `?format=csv` untuk diimpor. */
  async payrollRunJournal(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await payrollService.runJournal(req.params.id as string);
      if (req.query.format === 'csv') {
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="journal-${data.runId}.csv"`);
        res.send(journalToCsv(data.lines));
        return;
      }
      res.json(Result.success(data));
    } catch (error) {
      next(error);
    }
  }

  /**
   * Impor master gaji (GAP-44). `?dryRun=true` memeriksa seluruh berkas dan
   * melaporkan semua masalahnya tanpa menulis apa pun — itu yang dipakai
   * implementer sebelum menekan impor sungguhan.
   */
  async importSalaryMaster(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = req.user?.companyId;
      if (!companyId) throw new BadRequestError('Akun ini tidak tertaut ke perusahaan aktif');
      if (!req.file) throw new BadRequestError('Berkas CSV wajib diunggah pada field "file"');
      const result = await importSalaryMaster(companyId, req.file, { dryRun: req.query.dryRun === 'true' });
      // The import ran and reported; it simply wrote nothing. Result.error
      // carries no payload, and the per-row errors ARE the value here — so
      // this stays a success envelope with the findings in `data.errors`,
      // matching the employee importer rather than inventing a second shape.
      res.json(Result.success(
        result,
        result.errors.length
          ? 'Impor dibatalkan; tidak ada baris yang ditulis — periksa errors'
          : result.dryRun
            ? 'Berkas valid; belum ada yang ditulis'
            : 'Master gaji diimpor',
      ));
    } catch (error) {
      next(error);
    }
  }

  async createPayrollRun(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const data = await payrollService.createPayrollRun(req.body, req.user?.id);
      res.status(201).json(Result.created(data));
    } catch (error) {
      next(error);
    }
  }

  async voidPayrollRun(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const data = await payrollService.voidPayrollRun(req.params.id as string, req.user!.id, req.body?.reason);
      res.json(Result.updated(data, 'Payroll run di-void; periode dapat dihitung ulang'));
    } catch (error) {
      next(error);
    }
  }

  async approvePayrollRun(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const data = await payrollService.approvePayrollRun(id, req.user!.id);
      res.json(Result.updated(data));
    } catch (error) {
      next(error);
    }
  }

  async disbursePayrollRun(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const data = await payrollService.disbursePayrollRun(id, req.user!.id);
      res.json(Result.updated(data));
    } catch (error) {
      next(error);
    }
  }

  // ==================== B.6 Multibank Disbursements ====================
  async getDisbursements(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const bankCode = typeof req.query.bankCode === 'string' ? (req.query.bankCode as string) : undefined;
      const data = await payrollService.getPayrollRunDisbursements(id, bankCode);
      res.json(Result.success(data));
    } catch (error) {
      next(error);
    }
  }

  // ==================== Payslips ====================

  async unlockPayslips(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const data = await payrollUnlockService.unlock(req.user!, req.body);
      res.setHeader('Cache-Control', 'no-store');
      res.json(Result.success(data, 'Payroll unlocked'));
    } catch (error) {
      next(error);
    }
  }

  async lockPayslips(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      await payrollUnlockService.lock(req.user!);
      res.setHeader('Cache-Control', 'no-store');
      res.json(Result.updated(null, 'Payroll locked'));
    } catch (error) {
      next(error);
    }
  }

  async findPayslipById(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (requiresPayrollUnlock(req)) {
        await payrollUnlockService.assertGrant(req.user!, payrollUnlockToken(req));
      }
      const id = req.params.id as string;
      const data = await payrollService.findPayslipById(id);
      res.json(Result.success(data));
    } catch (error) {
      next(error);
    }
  }

  async downloadPayslipPdf(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (requiresPayrollUnlock(req)) {
        await payrollUnlockService.assertGrant(req.user!, payrollUnlockToken(req));
      }
      const payslip = await payrollService.findPayslipById(req.params.id as string);
      const pdf = await createPayslipPdf(payslip);
      if (pdf.byteLength > 5 * 1024 * 1024) {
        throw new AppError('Generated payslip PDF exceeds the 5 MB limit', 413, 'PAYSLIP_PDF_TOO_LARGE', true);
      }
      res.setHeader('Cache-Control', 'no-store, private');
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Length', String(pdf.byteLength));
      res.setHeader('Content-Disposition', `attachment; filename="payslip-${payslip.id}.pdf"`);
      res.send(pdf);
    } catch (error) {
      next(error);
    }
  }

  async findMyPayslips(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      // Self-service: employeeId WAJIB dari token, bukan dari query (cegah intip slip gaji orang lain).
      const employeeId = req.user?.employeeId;
      if (!employeeId) {
        return res.status(400).json(Result.error('Akun ini tidak tertaut ke data karyawan'));
      }
      const data = await payrollService.findPayslipsByEmployee(employeeId);
      res.json(Result.success(data.map((item) => ({ ...item, locked: true }))));
    } catch (error) {
      next(error);
    }
  }

  // ==================== Payslips (self-service, dilindungi PIN) ====================

  /** PUT /payroll/payslips/pin — set/ubah PIN setelah verifikasi password akun. */
  async setPayslipPin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      await payslipPinService.setPin(req.user!, req.body);
      res.setHeader('Cache-Control', 'no-store');
      res.json(Result.updated(null, 'PIN slip gaji berhasil disimpan'));
    } catch (error) {
      next(error);
    }
  }

  /** GET /payroll/payslips/pin/status — { pinSet, lockedUntil? }. */
  async getPayslipPinStatus(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const data = await payslipPinService.getStatus(req.user!);
      res.setHeader('Cache-Control', 'no-store');
      res.json(Result.success(data));
    } catch (error) {
      next(error);
    }
  }

  /** POST /payroll/payslips/my/unlock — verifikasi PIN → token unlock 15 menit. */
  async unlockMyPayslips(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const data = await payslipPinService.unlock(req.user!, req.body.pin);
      res.setHeader('Cache-Control', 'no-store');
      res.json(Result.success(data, 'Slip gaji terbuka'));
    } catch (error) {
      next(error);
    }
  }

  /** GET /payroll/payslips/my/:id — detail lengkap milik sendiri (header X-Payslip-Unlock). */
  async findMyPayslipDetail(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      payslipPinService.assertUnlockToken(req.user!, payslipSelfUnlockToken(req));
      const data = await payslipPinService.getMyPayslipDetail(req.user!, req.params.id as string);
      res.setHeader('Cache-Control', 'no-store, private');
      res.json(Result.success(data));
    } catch (error) {
      next(error);
    }
  }

  /** GET /payroll/payslips/my/:id/pdf — PDF slip milik sendiri (header X-Payslip-Unlock). */
  async downloadMyPayslipPdf(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      payslipPinService.assertUnlockToken(req.user!, payslipSelfUnlockToken(req));
      const payslip = await payslipPinService.getMyPayslipDetail(req.user!, req.params.id as string);
      const pdf = await createPayslipPdf(payslip);
      if (pdf.byteLength > 5 * 1024 * 1024) {
        throw new AppError('Generated payslip PDF exceeds the 5 MB limit', 413, 'PAYSLIP_PDF_TOO_LARGE', true);
      }
      res.setHeader('Cache-Control', 'no-store, private');
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Length', String(pdf.byteLength));
      res.setHeader('Content-Disposition', `attachment; filename="payslip-${payslip.id}.pdf"`);
      res.send(pdf);
    } catch (error) {
      next(error);
    }
  }

  // ==================== Standalone Calculation Endpoints (B.1, B.2, B.3) ====================

  async calculatePph21(req: Request, res: Response, next: NextFunction) {
    try {
      const data = payrollService.calculatePph21Standalone(req.body);
      res.json(Result.success(data));
    } catch (error) { next(error); }
  }

  async calculateThrStandalone(req: Request, res: Response, next: NextFunction) {
    try {
      const data = payrollService.calculateThrStandalone(req.body);
      res.json(Result.success(data));
    } catch (error) { next(error); }
  }

  async calculateBpjs(req: Request, res: Response, next: NextFunction) {
    try {
      const data = payrollService.calculateBpjsStandalone(req.body);
      res.json(Result.success(data));
    } catch (error) { next(error); }
  }

  async calculateJkn(req: Request, res: Response, next: NextFunction) {
    try {
      const data = payrollService.calculateJknStandalone(req.body);
      res.json(Result.success(data));
    } catch (error) { next(error); }
  }

  // ==================== Arrears (rapel) ====================
  async registerArrears(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = req.user?.companyId;
      if (!companyId) throw new BadRequestError('Akun ini tidak tertaut ke perusahaan aktif');
      const row = await payrollArrearsService.register(companyId, req.body as RegisterArrearsDTO);
      res.status(201).json(
        Result.success(
          { id: row.id, employeeId: row.employeeId, sourcePeriodId: row.sourcePeriodId, grossAmount: row.grossAmount, status: row.status, basis: row.basis },
          'Rapel terdaftar dan akan dibayarkan pada run periode berikutnya',
        ),
      );
    } catch (error) { next(error); }
  }

  async findAllArrears(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = req.user?.companyId;
      if (!companyId) throw new BadRequestError('Akun ini tidak tertaut ke perusahaan aktif');
      const query = req.query as unknown as ArrearsQueryDTO;
      res.json(Result.success(await payrollArrearsService.list(companyId, query)));
    } catch (error) { next(error); }
  }

  async cancelArrears(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = req.user?.companyId;
      if (!companyId) throw new BadRequestError('Akun ini tidak tertaut ke perusahaan aktif');
      res.json(Result.success(await payrollArrearsService.cancel(companyId, String(req.params.id))));
    } catch (error) { next(error); }
  }

  // ==================== Rekap PPh21 tahunan (bahan 1721-A1) ====================
  /**
   * The bukti potong 1721-A1 figures, laid out by PER-2/PJ/2024's line
   * numbers. The response carries `verified: false` until somebody has
   * compared it with a form a tax office accepted — see
   * `shared/payroll/form-1721-a1.ts`.
   */
  async buktiPotong1721A1(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = req.user?.companyId;
      if (!companyId) throw new BadRequestError('Akun ini tidak tertaut ke perusahaan aktif');
      const year = Number(req.query.year);
      const form = await annualTaxRecapService.buildBuktiPotong(
        companyId, String(req.params.employeeId), year);
      res.json(Result.success(form));
    } catch (error) { next(error); }
  }

  async annualTaxRecap(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = req.user?.companyId;
      if (!companyId) throw new BadRequestError('Akun ini tidak tertaut ke perusahaan aktif');
      const year = Number(req.query.year);
      const recap = await annualTaxRecapService.build(companyId, String(req.params.employeeId), year);

      if (req.query.format === 'csv') {
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader(
          'Content-Disposition',
          `attachment; filename="rekap-pph21-${recap.employee.employeeNumber}-${recap.year}.csv"`,
        );
        res.setHeader('Cache-Control', 'no-store');
        res.send(recapToCsv(recap));
        return;
      }
      res.json(Result.success(recap));
    } catch (error) { next(error); }
  }

  async annualTaxRecapSummary(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = req.user?.companyId;
      if (!companyId) throw new BadRequestError('Akun ini tidak tertaut ke perusahaan aktif');
      const year = Number(req.query.year);
      res.json(Result.success(await annualTaxRecapService.buildCompanySummary(companyId, year)));
    } catch (error) { next(error); }
  }

  // ==================== Laporan iuran BPJS bulanan ====================
  /**
   * The wage figures shaped for SIPP Online's Upload Upah. The payload says
   * `verified: false` and carries a warning that the template itself must be
   * downloaded from SIPP — see `shared/payroll/sipp-wage-export.ts`.
   */
  async sippWageExport(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = req.user?.companyId;
      if (!companyId) throw new BadRequestError('Akun ini tidak tertaut ke perusahaan aktif');
      const data = await bpjsReportService.buildSippWages(companyId, String(req.query.periodId));

      if (req.query.format === 'csv') {
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="upah-sipp-${data.payrollPeriod.code}.csv"`);
        res.setHeader('Cache-Control', 'no-store');
        res.send(sippWageExportToCsv(data));
        return;
      }
      res.json(Result.success(data));
    } catch (error) { next(error); }
  }

  async bpjsReport(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = req.user?.companyId;
      if (!companyId) throw new BadRequestError('Akun ini tidak tertaut ke perusahaan aktif');
      const report = await bpjsReportService.build(companyId, String(req.query.periodId));

      if (req.query.format === 'csv') {
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="iuran-bpjs-${report.period.code}.csv"`);
        res.setHeader('Cache-Control', 'no-store');
        res.send(bpjsReportToCsv(report));
        return;
      }
      res.json(Result.success(report));
    } catch (error) { next(error); }
  }
}

export const payrollController = new PayrollController();
