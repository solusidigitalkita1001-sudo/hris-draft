import { z } from 'zod';

export const createPaymentBatchSchema = z.object({
  runId: z.string().uuid(),
}).strip();

// Keep amounts as decimal strings until the service constructs a Prisma Decimal.
// Decimal(15, 2) supports at most thirteen whole digits and two fractional digits.
export const paymentAmountSchema = z.string().regex(
  /^(?:0|[1-9]\d{0,12})(?:\.\d{1,2})?$/,
  'Amount must be a nonnegative decimal string with at most 13 whole and 2 fractional digits'
);

export const recordPaymentTransactionSchema = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('PAID'),
    amount: paymentAmountSchema,
    bankReference: z.string().trim().min(1).max(100),
  }).strip(),
  z.object({
    status: z.literal('FAILED'),
    failureReason: z.string().trim().min(1).max(500),
  }).strip(),
]);

export const paymentBatchParamsSchema = z.object({
  id: z.string().uuid(),
}).strip();

export const paymentBatchRunParamsSchema = z.object({
  runId: z.string().uuid(),
}).strip();

export const paymentTransactionParamsSchema = paymentBatchParamsSchema.extend({
  transactionId: z.string().uuid(),
});

export const emptyPaymentActionSchema = z.object({}).strip().default({});

export const paymentIdempotencyKeySchema = z.string().min(16).max(128).regex(
  /^[\x21-\x7e]+$/,
  'Idempotency-Key must contain only visible ASCII characters without spaces'
);

export type CreatePaymentBatchDTO = z.infer<typeof createPaymentBatchSchema>;
export type RecordPaymentTransactionDTO = z.infer<typeof recordPaymentTransactionSchema>;
