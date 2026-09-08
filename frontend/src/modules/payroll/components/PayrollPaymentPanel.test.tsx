// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { PayrollPaymentPanel } from './PayrollPaymentPanel';
import { payrollPaymentService as service, type PaymentBatch } from '@/services/payroll-payment.service';

vi.mock('@/services/api', () => ({ default: {} }));
vi.mock('@/services/payroll-payment.service', async importOriginal => {
  const actual = await importOriginal<typeof import('@/services/payroll-payment.service')>();
  return { ...actual, payrollPaymentService: { forRun: vi.fn(), create: vi.fn(), export: vi.fn(), record: vi.fn(), reconcile: vi.fn(), cancel: vi.fn() } };
});
const auth = vi.hoisted(() => ({ user: { id: 'recorder' }, hasPermission: (_resource: string, action: string) => ['process', 'disburse'].includes(action) }));
vi.mock('@/stores/auth.store', () => ({ useAuthStore: (selector: (state: typeof auth) => unknown) => selector(auth) }));
const batch: PaymentBatch = {
  id: 'batch', runId: 'run', runName: 'September', status: 'EXPORTED', version: 1,
  totalAmount: '1000.10', transactionCount: 1, createdBy: 'maker', runCreatedBy: 'maker', runApprovedBy: 'checker',
  exportedAt: '2026-09-08T00:00:00Z', reconciledAt: null, cancelledAt: null, createdAt: '2026-09-08T00:00:00Z',
  transactions: [{ id: 'transaction', payslipId: 'slip', employeeId: 'employee', employeeName: 'Sari', bankCode: 'BCA', bankName: 'BCA',
    accountNumberMasked: '****1234', accountHolderMasked: 'S***', expectedAmount: '1000.10', paidAmount: null, status: 'PENDING', bankReferenceMasked: null, failureReason: null, recordedAt: null }],
};
describe('payroll manual payment controls', () => {
  beforeEach(() => { vi.resetAllMocks(); auth.user.id = 'recorder'; auth.hasPermission = (_resource, action) => ['process', 'disburse'].includes(action); vi.mocked(service.forRun).mockResolvedValue(batch); });
  afterEach(cleanup);
  it('keeps payment records read-only for a payroll processor without disbursement access', async () => {
    auth.hasPermission = (_resource, action) => action === 'process';
    render(<PayrollPaymentPanel runId="run" runStatus="APPROVED" onReconciled={vi.fn()} />);
    await screen.findByText('Hak akses pencairan payroll diperlukan untuk mencatat hasil dan merekonsiliasi pembayaran.');
    expect(screen.queryByRole('button', { name: 'Catat hasil Sari' })).toBeNull();
  });
  it('preserves payment evidence and idempotency key after a failed response', async () => {
    vi.mocked(service.record).mockRejectedValue(new Error('Offline'));
    render(<PayrollPaymentPanel runId="run" runStatus="APPROVED" onReconciled={vi.fn()} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Catat hasil Sari' }));
    const reference = screen.getByLabelText('Referensi transaksi bank');
    fireEvent.change(reference, { target: { value: 'BANK-RECEIPT-123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Simpan hasil pembayaran' }));
    await screen.findByRole('alert');
    expect((reference as HTMLInputElement).value).toBe('BANK-RECEIPT-123');
    fireEvent.click(screen.getByRole('button', { name: 'Simpan hasil pembayaran' }));
    await waitFor(() => expect(service.record).toHaveBeenCalledTimes(2));
    const calls = vi.mocked(service.record).mock.calls;
    expect(calls[0][2]).toEqual({ status: 'PAID', amount: '1000.10', bankReference: 'BANK-RECEIPT-123' });
    expect(calls[1][3]).toBe(calls[0][3]);
    expect(screen.getByText(/BCA · \*\*\*\*1234/)).toBeTruthy();
  });
  it('requires explicit confirmation before reconciliation', async () => {
    const paid = { ...batch, status: 'PAID' as const, transactions: batch.transactions.map(transaction => ({ ...transaction, status: 'PAID' as const, paidAmount: transaction.expectedAmount })) };
    vi.mocked(service.forRun).mockResolvedValue(paid);
    vi.mocked(service.reconcile).mockResolvedValue({ ...paid, status: 'RECONCILED' });
    const onReconciled = vi.fn().mockResolvedValue(undefined);
    render(<PayrollPaymentPanel runId="run" runStatus="APPROVED" onReconciled={onReconciled} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Tinjau rekonsiliasi' }));
    const confirm = screen.getByRole('button', { name: 'Rekonsiliasi pembayaran' });
    expect((confirm as HTMLButtonElement).disabled).toBe(true);
    expect(service.reconcile).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(confirm);
    await waitFor(() => expect(onReconciled).toHaveBeenCalledTimes(1));
  });
  it('prevents the payroll checker from recording payments', async () => {
    auth.user.id = 'checker';
    render(<PayrollPaymentPanel runId="run" runStatus="APPROVED" onReconciled={vi.fn()} />);
    await screen.findByText('Pencatatan dan rekonsiliasi harus dilakukan pengguna selain pemberi persetujuan payroll.');
    expect(screen.queryByRole('button', { name: 'Catat hasil Sari' })).toBeNull();
  });
  it('does not treat a failed lookup as an empty batch eligible for duplicate creation', async () => {
    vi.mocked(service.forRun).mockRejectedValue(new Error('Offline'));
    render(<PayrollPaymentPanel runId="run" runStatus="APPROVED" onReconciled={vi.fn()} />);
    await screen.findByRole('alert');
    expect(screen.queryByRole('button', { name: 'Buat daftar pembayaran' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Muat ulang pembayaran' })).toBeTruthy();
  });
});
