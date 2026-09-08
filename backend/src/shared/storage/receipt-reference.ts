import { BadRequestError } from '@/shared/exceptions/AppError';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function receiptOwnerDirectory(companyId?: string, employeeId?: string): string {
  if (!companyId || !employeeId || !UUID.test(companyId) || !UUID.test(employeeId)) {
    throw new BadRequestError('Valid company and employee identity required for receipt upload');
  }
  return `${companyId}/${employeeId}`;
}

export function validateReceiptReference(reference: string, companyId: string, employeeId: string): void {
  const prefix = `/uploads/travel-expenses/receipts/${receiptOwnerDirectory(companyId, employeeId)}/`;
  let pathname: string;
  try { pathname = new URL(reference, 'https://local.invalid').pathname; }
  catch { throw new BadRequestError('Invalid receipt reference'); }
  if (!pathname.startsWith(prefix)) throw new BadRequestError('Receipt does not belong to this employee');
  const filename = pathname.slice(prefix.length);
  const dot = filename.lastIndexOf('.');
  if (!UUID.test(filename.slice(0, dot)) || !['.png', '.jpg', '.jpeg', '.gif', '.pdf'].includes(filename.slice(dot))) {
    throw new BadRequestError('Invalid receipt reference');
  }
}
