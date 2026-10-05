import { validateSettingValue } from './company-settings.service';

/**
 * These settings decide whether money moves and how it is calculated. The store
 * is deliberately open to unknown keys — that is what makes it useful — but for
 * a switch that governs pay, a near-miss is the worst kind of failure: `TRUE`
 * stores happily, the feature stays off, and the person who thought they had
 * enabled it has no way to see why nothing happened.
 */
describe('boolean settings', () => {
  const keys = [
    'pph21_december_reconciliation_enabled',
    'leave_encashment_enabled',
    'leave_encashment_include_allowances',
    'recruitment_requisition_required',
    'payslip_email_notification_enabled',
    'benefit_payroll_deduction_enabled',
    'unpaid_leave_deduction_enabled',
    'late_deduction_enabled',
  ];

  it.each(keys)('accepts true and false for %s', (key) => {
    expect(() => validateSettingValue(key, 'true')).not.toThrow();
    expect(() => validateSettingValue(key, 'false')).not.toThrow();
  });

  it.each([['TRUE'], ['True'], ['1'], ['yes'], ['ya'], [''], [' true']])(
    'refuses %p, which would read as off while looking enabled',
    (value) => {
      expect(() => validateSettingValue('leave_encashment_enabled', value)).toThrow(/only 'true' or 'false'/);
    },
  );

  it('says what was received, so the mistake is obvious', () => {
    expect(() => validateSettingValue('pph21_december_reconciliation_enabled', 'TRUE'))
      .toThrow(/received 'TRUE'/);
  });
});

describe('numeric settings', () => {
  it('accepts a divisor inside range', () => {
    for (const value of ['21', '30', '25.5']) {
      expect(() => validateSettingValue('leave_encashment_daily_divisor', value)).not.toThrow();
    }
  });

  /** A zero divisor would divide by zero straight into someone's pay. */
  it.each([['0'], ['-1'], ['32']])('refuses divisor %p', (value) => {
    expect(() => validateSettingValue('leave_encashment_daily_divisor', value))
      .toThrow(/between 1 and 31/);
  });

  it('refuses a divisor that is not a number at all', () => {
    expect(() => validateSettingValue('leave_encashment_daily_divisor', 'dua puluh satu'))
      .toThrow(/must be a number/);
  });

  it('requires whole days for a yearly ceiling', () => {
    expect(() => validateSettingValue('leave_encashment_max_days_per_year', '12')).not.toThrow();
    expect(() => validateSettingValue('leave_encashment_max_days_per_year', '12.5'))
      .toThrow(/whole number/);
  });

  it('allows zero days, which means no ceiling beyond the balance', () => {
    expect(() => validateSettingValue('leave_encashment_max_days_per_year', '0')).not.toThrow();
  });

  it.each([
    ['late_deduction_daily_cap_percent', '101'],
    ['absence_deduction_daily_basic_percent', '-5'],
    ['attendance_default_working_days_per_month', '0'],
    // was fiscal_year_start_month '13'; that key is retired because nothing
    // read it. leave_carryover_expiry_month is the same integer-range shape.
    ['leave_carryover_expiry_month', '13'],
  ])('refuses %s = %p', (key, value) => {
    expect(() => validateSettingValue(key, value)).toThrow(/must be/);
  });
});

/** The store must stay usable for anything a tenant wants to remember. */
describe('keys outside the checked list', () => {
  it.each([['office_wifi_ssid', 'HRIS-Guest'], ['custom_flag', 'whatever'], ['note', '']])(
    'leaves %s alone',
    (key, value) => {
      expect(() => validateSettingValue(key, value)).not.toThrow();
    },
  );
});
