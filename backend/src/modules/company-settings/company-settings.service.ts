import prisma from '@/shared/database/prisma';
import { getCurrentCompanyId, getCurrentRoles } from '@/shared/context/RequestContext';
import { ForbiddenError, BadRequestError } from '@/shared/exceptions/AppError';
import type { CompanySetting, Prisma } from '@prisma/client';
import type { BulkUpsertSettingsDTO } from './company-settings.dto';

export const DEFAULT_COMPANY_SETTINGS: Record<string, string> = {
  fiscal_year_start_month: '1',
  currency_code: 'IDR',
  late_deduction_enabled: 'true',
  late_deduction_default_rate_per_minute: '500',
  late_deduction_daily_cap_percent: '10',
  absence_deduction_daily_basic_percent: '100',
  attendance_default_working_days_per_month: '22',
  attendance_workweek_days: '5',
  // Leave encashment (GAP-09). Off by default: it moves money, so switching it
  // on is a tenant decision rather than a consequence of deploying.
  leave_encashment_enabled: 'false',
  /// 0 means no ceiling beyond the employee's own remaining balance.
  leave_encashment_max_days_per_year: '0',
  /// Daily rate = monthly wage / this. 21 follows working days, 30 calendar
  /// days; both are in use in Indonesia, which is why it is a setting.
  leave_encashment_daily_divisor: '21',
  /// Whether fixed allowances join base salary in the daily rate.
  leave_encashment_include_allowances: 'false',
};

const WORKWEEK_DAYS_KEY = 'attendance_workweek_days';

/**
 * PP 35/2021 hanya mengenal pola 5 atau 6 hari kerja/minggu untuk band upah
 * lembur hari libur; nilai lain jatuh ke 5 (default konservatif).
 */
export function parseWorkweekDays(raw: string): 5 | 6 {
  return Number(raw) === 6 ? 6 : 5;
}

const ABSENCE_DEDUCTION_KEY = 'absence_deduction_daily_basic_percent';
const LATE_DEDUCTION_ENABLED = 'late_deduction_enabled';
const LATE_DEDUCTION_RATE = 'late_deduction_default_rate_per_minute';
const LATE_DEDUCTION_CAP = 'late_deduction_daily_cap_percent';

const VALID_KEY_REGEX = /^[a-zA-Z0-9][a-zA-Z0-9_]{0,99}$/;

function validateKey(key: string): void {
  if (!VALID_KEY_REGEX.test(key)) {
    throw new BadRequestError(`Invalid setting key format: ${key}. Allowed: alphanumeric + underscore, max 100 chars.`);
  }
}

function isSuperOrGroupAdmin(): boolean {
  const roles = getCurrentRoles();
  return roles.includes('SUPER_ADMIN') || roles.includes('GROUP_ADMIN');
}

export class CompanySettingsService {
  /**
   * Get ALL settings for current company (or explicit companyId if SUPER bypass)
   * Returns Record<string, string> merged with DEFAULT values (DB override default)
   */
  async getAllSettings(explicitCompanyId?: string): Promise<Record<string, string>> {
    const companyId = this.resolveCompanyIdWithPermission(explicitCompanyId);
    const rows = await prisma.companySetting.findMany({
      where: { companyId },
      select: { key: true, value: true },
    });
    const result: Record<string, string> = { ...DEFAULT_COMPANY_SETTINGS };
    for (const row of rows) {
      result[row.key] = row.value;
    }
    return result;
  }

  /**
   * Get single setting key by name. Returns default value if key not set in DB.
   */
  async getSettingByKey(key: string, explicitCompanyId?: string): Promise<string> {
    validateKey(key);
    const companyId = this.resolveCompanyIdWithPermission(explicitCompanyId);
    const row = await prisma.companySetting.findFirst({
      where: { companyId, key },
      select: { value: true },
    });
    if (row) return row.value;
    if (Object.prototype.hasOwnProperty.call(DEFAULT_COMPANY_SETTINGS, key)) {
      return DEFAULT_COMPANY_SETTINGS[key];
    }
    throw new BadRequestError(`Setting key '${key}' not found and has no default value.`);
  }

  /**
   * Upsert single setting key-value (create if not exists, update if exists)
   * @@unique([companyId, key]) constraint enforced by DB.
   */
  async setSetting(key: string, value: string, explicitCompanyId?: string): Promise<CompanySetting> {
    validateKey(key);
    const companyId = this.resolveCompanyIdWithPermission(explicitCompanyId, true);
    return prisma.companySetting.upsert({
      where: { companyId_key: { companyId, key } },
      create: { companyId, key, value },
      update: { value },
    });
  }

  /**
   * Bulk upsert multiple settings in a single transaction.
   * Atomic: all success or all rollback.
   */
  async bulkUpsertSettings(settings: BulkUpsertSettingsDTO, explicitCompanyId?: string): Promise<void> {
    const entries = Object.entries(settings);
    for (const [key] of entries) validateKey(key);
    const companyId = this.resolveCompanyIdWithPermission(explicitCompanyId, true);
    await prisma.$transaction(
      entries.map(([key, value]) =>
        prisma.companySetting.upsert({
          where: { companyId_key: { companyId, key } },
          create: { companyId, key, value },
          update: { value },
        })
      )
    );
  }

  /**
   * Delete a setting key (fallback to default if default exist).
   */
  async deleteSetting(key: string, explicitCompanyId?: string): Promise<void> {
    validateKey(key);
    const companyId = this.resolveCompanyIdWithPermission(explicitCompanyId, true);
    await prisma.companySetting.deleteMany({
      where: { companyId, key },
    });
  }

  // ==================== LATE / ABSENCE DEDUCTION HELPER ====================
  // These are pure-read helpers consumed by Task 4.2 payroll calculatePayroll().
  // Returns typed parsed values with fallback default to avoid errors.

  async getLateDeductionConfig(explicitCompanyId?: string, database: Prisma.TransactionClient = prisma): Promise<{
    enabled: boolean;
    ratePerMinuteIdr: number;
    dailyCapPercentOfBasic: number;
    absenceDailyPercentOfBasic: number;
    defaultWorkingDaysPerMonth: number;
  }> {
    const companyId = this.resolveCompanyIdWithPermission(explicitCompanyId);
    const [enabledStr, rateStr, capStr, absenceStr, wdStr] = await Promise.all([
      this.readRawKeyOrFallback(LATE_DEDUCTION_ENABLED, companyId, database),
      this.readRawKeyOrFallback(LATE_DEDUCTION_RATE, companyId, database),
      this.readRawKeyOrFallback(LATE_DEDUCTION_CAP, companyId, database),
      this.readRawKeyOrFallback(ABSENCE_DEDUCTION_KEY, companyId, database),
      this.readRawKeyOrFallback('attendance_default_working_days_per_month', companyId, database),
    ]);
    const rate = Number(rateStr);
    const cap = Number(capStr);
    const absence = Number(absenceStr);
    const wd = Number(wdStr);
    return {
      enabled: enabledStr === 'true',
      ratePerMinuteIdr: Number.isFinite(rate) && rate >= 0 ? rate : Number(DEFAULT_COMPANY_SETTINGS[LATE_DEDUCTION_RATE]),
      dailyCapPercentOfBasic: Number.isFinite(cap) && cap >= 0 && cap <= 100 ? cap : Number(DEFAULT_COMPANY_SETTINGS[LATE_DEDUCTION_CAP]),
      absenceDailyPercentOfBasic: Number.isFinite(absence) && absence >= 0 && absence <= 500 ? absence : Number(DEFAULT_COMPANY_SETTINGS[ABSENCE_DEDUCTION_KEY]),
      defaultWorkingDaysPerMonth: Number.isFinite(wd) && wd >= 1 && wd <= 31 ? wd : Number(DEFAULT_COMPANY_SETTINGS['attendance_default_working_days_per_month']),
    };
  }

  /**
   * Jumlah hari kerja per minggu (5 | 6) untuk band lembur PP 35/2021.
   * Dipakai payroll run & EWA agar tenant 6-hari-kerja dibayar dengan band
   * hari libur yang benar (jam 1–7 @2x, jam-8 @3x, jam-9+ @4x).
   */
  async getWorkweekDays(explicitCompanyId?: string, database: Prisma.TransactionClient = prisma): Promise<5 | 6> {
    const companyId = this.resolveCompanyIdWithPermission(explicitCompanyId);
    const raw = await this.readRawKeyOrFallback(WORKWEEK_DAYS_KEY, companyId, database);
    return parseWorkweekDays(raw);
  }

  // ==================== Internal Permission Resolver ====================
  private resolveCompanyIdWithPermission(explicitCompanyId?: string, writeMode = false): string {
    const ctxCompanyId = getCurrentCompanyId();
    const isSuper = isSuperOrGroupAdmin();

    if (writeMode) {
      // Write mode: COMPANY_ADMIN dll hanya bisa write ke company-nya sendiri; SUPER/GROUP bisa cross.
      if (!explicitCompanyId) {
        if (!ctxCompanyId) throw new ForbiddenError('Missing company context.');
        return ctxCompanyId;
      }
      if (!isSuper && ctxCompanyId && explicitCompanyId !== ctxCompanyId) {
        throw new ForbiddenError('Non admin tidak bisa mengubah setting company lain.');
      }
      return explicitCompanyId;
    }

    // Read mode.
    if (!explicitCompanyId) {
      if (!ctxCompanyId) throw new ForbiddenError('Missing company context.');
      return ctxCompanyId;
    }
    if (!isSuper && ctxCompanyId && explicitCompanyId !== ctxCompanyId) {
      throw new ForbiddenError('Non admin tidak bisa membaca setting company lain.');
    }
    return explicitCompanyId;
  }

  private async readRawKeyOrFallback(key: string, companyId: string, database: Prisma.TransactionClient = prisma): Promise<string> {
    const row = await database.companySetting.findFirst({
      where: { companyId, key },
      select: { value: true },
    });
    if (row) return row.value;
    if (Object.prototype.hasOwnProperty.call(DEFAULT_COMPANY_SETTINGS, key)) {
      return DEFAULT_COMPANY_SETTINGS[key];
    }
    return '';
  }
}

export const companySettingsService = new CompanySettingsService();
