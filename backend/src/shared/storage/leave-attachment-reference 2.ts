import { BadRequestError } from '@/shared/exceptions/AppError';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Prefix path publik (logis) tempat lampiran cuti disimpan; file fisik tetap privat. */
export const LEAVE_ATTACHMENT_URL_PREFIX = '/uploads/leave/attachments/';

/**
 * Direktori pemilik lampiran cuti: <companyId>/<employeeId>.
 * Identitas wajib UUID valid agar path tidak bisa disuntik.
 */
export function leaveAttachmentOwnerDirectory(companyId?: string, employeeId?: string): string {
  if (!companyId || !employeeId || !UUID.test(companyId) || !UUID.test(employeeId)) {
    throw new BadRequestError('Identitas perusahaan dan karyawan yang valid diperlukan untuk unggah lampiran cuti');
  }
  return `${companyId}/${employeeId}`;
}
