import { Prisma } from '@prisma/client';
import prisma from '@/shared/database/prisma';
import { BadRequestError, ConflictError, NotFoundError } from '@/shared/exceptions/AppError';
import { logger } from '@/shared/logger/WinstonLogger';
import { assertEmployeeInScope } from '@/shared/security/employee-data-scope';
import type { CreateCustomFieldDTO, SetCustomFieldValuesDTO, UpdateCustomFieldDTO } from './custom-field.dto';

/**
 * Custom fields (GAP-39): data karyawan yang bentuknya hanya diketahui tenant
 * (nomor seragam, golongan internal, plat kendaraan). Definisi milik
 * perusahaan; nilai divalidasi per tipe saat ditulis supaya kolom teks generik
 * tidak menjadi tempat sampah.
 *
 * V1 hanya entitas EMPLOYEE. Definisi tidak pernah dihapus — dinonaktifkan —
 * karena nilai historis menunjuk padanya.
 */
export class CustomFieldService {
  async listDefinitions(companyId: string, includeInactive = false) {
    return prisma.customFieldDefinition.findMany({
      where: { companyId, ...(includeInactive ? {} : { isActive: true }) },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async createDefinition(companyId: string, input: CreateCustomFieldDTO) {
    const existing = await prisma.customFieldDefinition.findFirst({
      where: { companyId, entity: 'EMPLOYEE', key: input.key },
      select: { id: true, isActive: true },
    });
    if (existing) {
      // Kunci tidak pernah dipakai ulang untuk definisi berbeda: nilai lama
      // masih menunjuk ke sana. Nyalakan kembali lewat PATCH.
      throw new ConflictError(`Field dengan key '${input.key}' sudah ada (${existing.isActive ? 'aktif' : 'nonaktif'})`);
    }
    const row = await prisma.customFieldDefinition.create({
      data: {
        companyId,
        key: input.key,
        label: input.label,
        type: input.type,
        options: input.options as Prisma.InputJsonValue | undefined,
        required: input.required ?? false,
        sortOrder: input.sortOrder ?? 0,
      },
    });
    logger.info('Custom field defined', { companyId, key: input.key, type: input.type });
    return row;
  }

  async updateDefinition(companyId: string, id: string, input: UpdateCustomFieldDTO) {
    const definition = await prisma.customFieldDefinition.findFirst({ where: { id, companyId } });
    if (!definition) throw new NotFoundError('Custom field tidak ditemukan');
    if (input.options && definition.type !== 'SELECT') {
      throw new BadRequestError('options hanya untuk tipe SELECT');
    }
    // Menyempitkan options tidak menyentuh nilai lama: nilai historis tetap
    // sah sebagai sejarah, hanya penulisan BARU yang divalidasi ke daftar baru.
    return prisma.customFieldDefinition.update({
      where: { id },
      data: {
        label: input.label,
        options: input.options as Prisma.InputJsonValue | undefined,
        required: input.required,
        isActive: input.isActive,
        sortOrder: input.sortOrder,
      },
    });
  }

  /** Definisi aktif + nilai karyawan, digabung per key. */
  async valuesFor(companyId: string, employeeId: string) {
    await assertEmployeeInScope(employeeId, 'employee');
    const employee = await prisma.employee.findFirst({
      where: { id: employeeId, companyId, deletedAt: null }, select: { id: true },
    });
    if (!employee) throw new NotFoundError('Karyawan tidak ditemukan di perusahaan ini');

    const definitions = await this.listDefinitions(companyId);
    const rows = await prisma.employeeCustomFieldValue.findMany({
      where: { companyId, employeeId },
      select: { definitionId: true, value: true },
    });
    const valueByDefinition = new Map(rows.map((row) => [row.definitionId, row.value]));
    return definitions.map((definition) => ({
      key: definition.key,
      label: definition.label,
      type: definition.type,
      options: definition.options,
      required: definition.required,
      value: valueByDefinition.get(definition.id) ?? null,
    }));
  }

  async setValues(companyId: string, employeeId: string, input: SetCustomFieldValuesDTO) {
    await assertEmployeeInScope(employeeId, 'employee');
    const employee = await prisma.employee.findFirst({
      where: { id: employeeId, companyId, deletedAt: null }, select: { id: true },
    });
    if (!employee) throw new NotFoundError('Karyawan tidak ditemukan di perusahaan ini');

    const definitions = await prisma.customFieldDefinition.findMany({
      where: { companyId, entity: 'EMPLOYEE', isActive: true },
    });
    const byKey = new Map(definitions.map((definition) => [definition.key, definition]));

    const writes: Array<{ definitionId: string; value: string | null }> = [];
    for (const [key, raw] of Object.entries(input.values)) {
      const definition = byKey.get(key);
      if (!definition) throw new BadRequestError(`Field '${key}' tidak dikenal atau nonaktif`);
      if (raw === null || raw === '') {
        if (definition.required) throw new BadRequestError(`Field '${key}' wajib diisi dan tidak bisa dikosongkan`);
        writes.push({ definitionId: definition.id, value: null });
        continue;
      }
      writes.push({ definitionId: definition.id, value: this.normalise(definition, raw) });
    }

    await prisma.$transaction(async (tx) => {
      for (const write of writes) {
        if (write.value === null) {
          await tx.employeeCustomFieldValue.deleteMany({
            where: { companyId, employeeId, definitionId: write.definitionId },
          });
        } else {
          await tx.employeeCustomFieldValue.upsert({
            where: { definitionId_employeeId: { definitionId: write.definitionId, employeeId } },
            create: { companyId, employeeId, definitionId: write.definitionId, value: write.value },
            update: { value: write.value },
          });
        }
      }
    });

    logger.info('Custom field values written', { companyId, employeeId, keys: Object.keys(input.values) });
    return this.valuesFor(companyId, employeeId);
  }

  /** Validasi per tipe; nilai disimpan sebagai teks kanonis. */
  private normalise(
    definition: { key: string; type: string; options: Prisma.JsonValue },
    raw: string | number,
  ): string {
    const text = String(raw).trim();
    switch (definition.type) {
      case 'NUMBER': {
        const value = Number(text);
        if (!Number.isFinite(value)) throw new BadRequestError(`Field '${definition.key}' harus angka`);
        return String(value);
      }
      case 'DATE': {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(text) || Number.isNaN(new Date(`${text}T00:00:00.000Z`).getTime())) {
          throw new BadRequestError(`Field '${definition.key}' harus tanggal YYYY-MM-DD`);
        }
        return text;
      }
      case 'SELECT': {
        const options = Array.isArray(definition.options) ? definition.options.map(String) : [];
        if (!options.includes(text)) {
          throw new BadRequestError(`Field '${definition.key}' harus salah satu dari: ${options.join(', ')}`);
        }
        return text;
      }
      default:
        return text;
    }
  }
}

export const customFieldService = new CustomFieldService();
