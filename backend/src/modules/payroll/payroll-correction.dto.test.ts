import { registerCorrectionSchema, correctionQuerySchema } from './payroll-correction.dto';

const PAYSLIP = '11111111-1111-1111-1111-111111111111';

describe('registerCorrectionSchema', () => {
  it('accepts an underpayment and an overpayment', () => {
    for (const amount of [250000, -250000]) {
      expect(registerCorrectionSchema.safeParse({
        sourcePayslipId: PAYSLIP, amount, reason: 'Lembur 12 jam Agustus tidak terbayar',
      }).success).toBe(true);
    }
  });

  it('rejects a zero amount — zero corrects nothing', () => {
    expect(registerCorrectionSchema.safeParse({
      sourcePayslipId: PAYSLIP, amount: 0, reason: 'Lembur Agustus tidak terbayar',
    }).success).toBe(false);
  });

  it('rejects a sub-cent amount that would round to 0.00 and jam the payslip', () => {
    for (const amount of [0.004, -0.004]) {
      expect(registerCorrectionSchema.safeParse({
        sourcePayslipId: PAYSLIP, amount, reason: 'Selisih pembulatan tidak berarti',
      }).success).toBe(false);
    }
  });

  it('rejects a reason the length of "typo"', () => {
    expect(registerCorrectionSchema.safeParse({
      sourcePayslipId: PAYSLIP, amount: 100000, reason: 'typo',
    }).success).toBe(false);
  });

  it('does not accept a companyId from the client', () => {
    const parsed = registerCorrectionSchema.parse({
      sourcePayslipId: PAYSLIP, amount: 100000, reason: 'Lembur Agustus tidak terbayar', companyId: 'evil',
    });
    expect('companyId' in parsed).toBe(false);
  });
});

describe('correctionQuerySchema', () => {
  it('filters by status and employee', () => {
    expect(correctionQuerySchema.safeParse({ status: 'PENDING', employeeId: PAYSLIP }).success).toBe(true);
    expect(correctionQuerySchema.safeParse({ status: 'PAID' }).success).toBe(false);
  });
});
