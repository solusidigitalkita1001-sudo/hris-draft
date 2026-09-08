import api from './api';

export type PaymentBatchStatus = 'DRAFT' | 'EXPORTED' | 'PROCESSING' | 'PAID' | 'PARTIALLY_FAILED' | 'FAILED' | 'RECONCILED' | 'CANCELLED';
export interface PaymentTransaction {
  id: string; payslipId: string; employeeId: string; employeeName: string;
  bankCode: string; bankName: string; accountNumberMasked: string | null; accountHolderMasked: string | null;
  expectedAmount: string; paidAmount: string | null; status: 'PENDING' | 'PAID' | 'FAILED';
  bankReferenceMasked: string | null; failureReason: string | null; recordedAt: string | null;
}
export interface PaymentBatch {
  id: string; runId: string; runName: string; status: PaymentBatchStatus; version: number;
  totalAmount: string; transactionCount: number; createdBy: string; runCreatedBy: string; runApprovedBy: string;
  exportedAt: string | null; reconciledAt: string | null; cancelledAt: string | null; createdAt: string;
  transactions: PaymentTransaction[];
}
export type RecordPayment = { status: 'PAID'; amount: string; bankReference: string }
  | { status: 'FAILED'; failureReason: string };
export interface PaymentExport {
  batch: PaymentBatch; mode: 'MANUAL_BANK_FILE_EXPORT'; paymentSubmitted: false;
  groups: { bankCode: string; bankName: string; employeeCount: number; totalAmount: string;
    csv: { headers: string[]; delimiter: string; filename: string; content: string; totalRows: number } }[];
}
type Envelope<T> = { data: T };
const base = '/payroll/payment-batches';
const headers = (key: string) => ({ headers: { 'Idempotency-Key': key } });

export const payrollPaymentService = {
  async forRun(runId: string, signal?: AbortSignal): Promise<PaymentBatch | null> {
    return (await api.get<Envelope<PaymentBatch | null>>(`${base}/run/${runId}`, { signal })).data.data;
  },
  async create(runId: string, key: string): Promise<PaymentBatch> {
    return (await api.post<Envelope<PaymentBatch>>(base, { runId }, headers(key))).data.data;
  },
  async export(id: string): Promise<PaymentExport> {
    return (await api.post<Envelope<PaymentExport>>(`${base}/${id}/export`, {})).data.data;
  },
  async record(id: string, transactionId: string, data: RecordPayment, key: string): Promise<PaymentBatch> {
    return (await api.patch<Envelope<PaymentBatch>>(`${base}/${id}/transactions/${transactionId}`, data, headers(key))).data.data;
  },
  async reconcile(id: string, key: string): Promise<PaymentBatch> {
    return (await api.post<Envelope<PaymentBatch>>(`${base}/${id}/reconcile`, {}, headers(key))).data.data;
  },
  async cancel(id: string, key: string): Promise<PaymentBatch> {
    return (await api.post<Envelope<PaymentBatch>>(`${base}/${id}/cancel`, {}, headers(key))).data.data;
  },
};

/** Retry an unchanged action with the same key, including after an uncertain network response. */
export function paymentRequestKey(previous: { fingerprint: string; key: string } | undefined, payload: unknown) {
  const fingerprint = JSON.stringify(payload);
  return previous?.fingerprint === fingerprint ? previous : { fingerprint, key: crypto.randomUUID() };
}
