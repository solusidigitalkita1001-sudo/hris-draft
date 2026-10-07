import prisma from '@/shared/database/prisma';
import { BadRequestError, NotFoundError } from '@/shared/exceptions/AppError';
import { WinstonLogger } from '@/shared/logger/WinstonLogger';
import { serializeEmployee } from '@/modules/employee/employee-pii';
import {
  LETTER_PLACEHOLDERS,
  extractPlaceholders,
  renderLetter,
  validateTemplateBody,
  type LetterContext,
} from '@/shared/letters/placeholders';

const logger = new WinstonLogger('LetterService');

/**
 * Letter generation from templates (GAP-46). HR writes the body once —
 * surat keterangan kerja, SK, and the rest — and the system fills the
 * employee's details in.
 *
 * Two things this service is careful about:
 *
 * The template body is validated when SAVED, not when rendered. A letter is
 * printed and signed; discovering then that a placeholder was misspelled is
 * discovering it too late.
 *
 * The employee's NIK and NPWP pass through the same masking every other read
 * of this data obeys (`serializeEmployee`). A letter is not a loophole: if the
 * requester may not see an unmasked NIK on the employee page, generating a
 * letter must not hand it to them either.
 */
export class LetterService {
  /** What a template author may use, for the editor to list. */
  availablePlaceholders() {
    return Object.entries(LETTER_PLACEHOLDERS).map(([key, description]) => ({ key, description }));
  }

  async list(companyId: string) {
    return prisma.letterTemplate.findMany({
      where: { companyId, deletedAt: null },
      orderBy: [{ isActive: 'desc' }, { code: 'asc' }],
    });
  }

  async upsert(companyId: string, input: {
    code: string; name: string; body: string; description?: string; isActive?: boolean;
  }) {
    validateTemplateBody(input.body);
    const data = {
      name: input.name,
      body: input.body,
      description: input.description ?? null,
      isActive: input.isActive ?? true,
    };
    return prisma.letterTemplate.upsert({
      where: { companyId_code: { companyId, code: input.code } },
      update: data,
      create: { companyId, code: input.code, ...data },
    });
  }

  async remove(companyId: string, id: string) {
    const existing = await prisma.letterTemplate.findFirst({ where: { id, companyId, deletedAt: null } });
    if (!existing) throw new NotFoundError('Template surat tidak ditemukan');
    // Soft delete: a letter already issued refers to the template it came
    // from, and losing that makes the issued letter unexplainable.
    return prisma.letterTemplate.update({ where: { id }, data: { deletedAt: new Date(), isActive: false } });
  }

  async render(companyId: string, templateId: string, input: { employeeId: string; letterNumber?: string }) {
    const template = await prisma.letterTemplate.findFirst({
      where: { id: templateId, companyId, deletedAt: null },
    });
    if (!template) throw new NotFoundError('Template surat tidak ditemukan');
    if (!template.isActive) throw new BadRequestError('Template surat ini tidak aktif');

    const employee = await prisma.employee.findFirst({
      where: { id: input.employeeId, companyId, deletedAt: null },
      select: {
        fullName: true, employeeNumber: true, email: true, joinDate: true,
        employmentType: true, idNumber: true, taxId: true,
        placeOfBirth: true, dateOfBirth: true,
        position: { select: { name: true } },
        department: { select: { name: true } },
        company: { select: { name: true, address: true } },
      },
    });
    if (!employee) throw new NotFoundError('Karyawan tidak ditemukan di perusahaan ini');

    // Same masking as every other read of this data. A letter is not a
    // loophole around employee:read-sensitive.
    const safe = serializeEmployee(employee as unknown as Record<string, unknown>) as typeof employee;

    const date = (value: Date | null | undefined) => (value ? value.toISOString().slice(0, 10) : '');
    const context: LetterContext = {
      'employee.fullName': safe.fullName,
      'employee.employeeNumber': safe.employeeNumber,
      'employee.position': safe.position?.name ?? '',
      'employee.department': safe.department?.name ?? '',
      'employee.joinDate': date(safe.joinDate),
      'employee.employmentType': safe.employmentType ?? '',
      'employee.email': safe.email ?? '',
      'employee.idNumber': safe.idNumber ?? '',
      'employee.taxId': safe.taxId ?? '',
      'employee.placeOfBirth': safe.placeOfBirth ?? '',
      'employee.dateOfBirth': date(safe.dateOfBirth),
      'company.name': safe.company?.name ?? '',
      'company.address': safe.company?.address ?? '',
      'letter.date': new Date().toISOString().slice(0, 10),
      'letter.number': input.letterNumber ?? '',
    };

    const rendered = renderLetter(template.body, context);
    logger.info('Letter rendered', { companyId, templateId, employeeId: input.employeeId });
    return {
      templateId: template.id,
      templateCode: template.code,
      templateName: template.name,
      employeeId: input.employeeId,
      placeholdersUsed: extractPlaceholders(template.body),
      rendered,
    };
  }
}

export const letterService = new LetterService();
