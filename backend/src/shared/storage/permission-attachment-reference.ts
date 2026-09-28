import { BadRequestError } from '@/shared/exceptions/AppError';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Prefix path logis lampiran izin; file fisik tetap privat (diunduh via /private-files). */
export const PERMISSION_ATTACHMENT_URL_PREFIX = '/uploads/permission-requests/attachments/';

/**
 * Direktori pemilik lampiran izin: <companyId>/<employeeId>.
 * Identitas wajib UUID valid agar path tidak bisa disuntik.
 */
export function permissionAttachmentOwnerDirectory(companyId?: string, employeeId?: string): string {
  if (!companyId || !employeeId || !UUID.test(companyId) || !UUID.test(employeeId)) {
    throw new BadRequestError('Identitas perusahaan dan karyawan yang valid diperlukan untuk unggah lampiran izin');
  }
  return `${companyId}/${employeeId}`;
}
