import {
  createPaymentBatchSchema,
  emptyPaymentActionSchema,
  paymentAmountSchema,
  paymentIdempotencyKeySchema,
  recordPaymentTransactionSchema,
} from './payroll-payment.dto';

describe('payroll payment request validation', () => {
  it('keeps only runId when creating a batch', () => {
    const runId = '11111111-1111-4111-8111-111111111111';
    expect(createPaymentBatchSchema.parse({ runId, companyId: 'forged', actorId: 'forged' })).toEqual({ runId });
  });

  it.each(['0', '0.00', '1.1', '1000000.25', '9999999999999.99'])('accepts exact decimal amount %s', (amount) => {
    expect(paymentAmountSchema.parse(amount)).toBe(amount);
  });

  it.each(['-1', '1e2', 'NaN', 'Infinity', '1,000', ' 1', '1 ', '.5', '1.', '01', '1.234', '10000000000000', 1])(
    'rejects malformed/out-of-range amount %s',
    (amount) => expect(paymentAmountSchema.safeParse(amount).success).toBe(false)
  );

  it('requires payment evidence and strips forged fields and opposite-state data', () => {
    expect(recordPaymentTransactionSchema.parse({
      status: 'PAID', amount: '123.45', bankReference: '  BANK-REF-001  ',
      failureReason: 'irrelevant', companyId: 'forged', actorId: 'forged',
    })).toEqual({ status: 'PAID', amount: '123.45', bankReference: 'BANK-REF-001' });
    expect(recordPaymentTransactionSchema.safeParse({ status: 'PAID', amount: '123.45' }).success).toBe(false);
    expect(recordPaymentTransactionSchema.safeParse({ status: 'PAID', amount: '123.45', bankReference: '   ' }).success).toBe(false);
  });

  it('requires an actionable failure reason without retaining payment evidence', () => {
    expect(recordPaymentTransactionSchema.parse({
      status: 'FAILED', failureReason: '  Rejected by bank  ', amount: '123.45', bankReference: 'irrelevant',
    })).toEqual({ status: 'FAILED', failureReason: 'Rejected by bank' });
    expect(recordPaymentTransactionSchema.safeParse({ status: 'FAILED', failureReason: '  ' }).success).toBe(false);
    expect(recordPaymentTransactionSchema.safeParse({ status: 'PENDING' }).success).toBe(false);
  });

  it('limits reference and failure reason lengths after trimming', () => {
    expect(recordPaymentTransactionSchema.safeParse({ status: 'PAID', amount: '1', bankReference: 'x'.repeat(101) }).success).toBe(false);
    expect(recordPaymentTransactionSchema.safeParse({ status: 'FAILED', failureReason: 'x'.repeat(501) }).success).toBe(false);
  });

  it('ignores body fields for state actions and allows a missing body', () => {
    expect(emptyPaymentActionSchema.parse({ status: 'RECONCILED', actorId: 'forged' })).toEqual({});
    expect(emptyPaymentActionSchema.parse(undefined)).toEqual({});
  });

  it('requires bounded visible ASCII idempotency keys', () => {
    expect(paymentIdempotencyKeySchema.safeParse('request-key-0001').success).toBe(true);
    expect(paymentIdempotencyKeySchema.safeParse('a'.repeat(128)).success).toBe(true);
    for (const key of [undefined, '', 'short', 'a'.repeat(129), 'a'.repeat(15) + '\n', 'a'.repeat(15) + ' ', 'a'.repeat(15) + 'é']) {
      expect(paymentIdempotencyKeySchema.safeParse(key).success).toBe(false);
    }
  });
});
