import { Prisma, TimesheetStatus } from '@prisma/client';
import prisma from '@/shared/database/prisma';
import { BadRequestError, ConflictError, NotFoundError } from '@/shared/exceptions/AppError';
import { logger } from '@/shared/logger/WinstonLogger';
import type {
  CreateEntryDTO, CreateProjectDTO, EntriesQueryDTO, MyEntriesQueryDTO,
  ReportQueryDTO, UpdateEntryDTO, UpdateProjectDTO,
} from './timesheet.dto';

/**
 * Timesheet per proyek (GAP-35). Absensi menjawab "hadirkah dia"; timesheet
 * menjawab "jamnya dipakai untuk proyek apa" — bahan penagihan dan biaya per
 * proyek. Karena angkanya bisa menjadi tagihan, jam orang disetujui atasannya
 * (timesheet:approve), dan baris yang sudah APPROVED terkunci.
 *
 * Satu baris per karyawan+proyek+hari; total satu hari di semua proyek
 * dibatasi 24 jam — timesheet yang menjumlah 30 jam sehari bukan data, tapi
 * tagihan yang akan dipertengkarkan.
 */
const PROJECT_SELECT = { select: { id: true, code: true, name: true } };
const EMPLOYEE_SELECT = { select: { id: true, fullName: true, employeeNumber: true } };

export class TimesheetService {
  // ==================== Projects ====================
  async listProjects(companyId: string, includeInactive = false) {
    return prisma.project.findMany({
      where: { companyId, ...(includeInactive ? {} : { isActive: true }) },
      orderBy: { code: 'asc' },
    });
  }

  async createProject(companyId: string, input: CreateProjectDTO) {
    const code = input.code.toUpperCase();
    const existing = await prisma.project.findFirst({ where: { companyId, code }, select: { id: true } });
    if (existing) throw new ConflictError(`Proyek dengan kode ${code} sudah ada`);
    return prisma.project.create({ data: { companyId, code, name: input.name } });
  }

  async updateProject(companyId: string, id: string, input: UpdateProjectDTO) {
    const project = await prisma.project.findFirst({ where: { id, companyId }, select: { id: true } });
    if (!project) throw new NotFoundError('Proyek tidak ditemukan');
    return prisma.project.update({ where: { id }, data: { name: input.name, isActive: input.isActive } });
  }

  // ==================== Entries (self service) ====================
  async createEntry(companyId: string, employeeId: string, input: CreateEntryDTO) {
    const project = await prisma.project.findFirst({
      where: { id: input.projectId, companyId, isActive: true },
      select: { id: true, code: true },
    });
    if (!project) throw new NotFoundError('Proyek tidak ditemukan atau nonaktif');

    const date = new Date(`${input.date}T00:00:00.000Z`);
    if (Number.isNaN(date.getTime())) throw new BadRequestError('Tanggal tidak valid');
    const today = new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00.000Z');
    if (date.getTime() > today.getTime()) {
      throw new BadRequestError('Jam kerja dicatat setelah dikerjakan, bukan direncanakan');
    }

    await this.assertDayFits(companyId, employeeId, date, new Prisma.Decimal(input.hours), null);

    const existing = await prisma.timesheetEntry.findFirst({
      where: { employeeId, projectId: project.id, date },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictError('Sudah ada baris untuk proyek dan tanggal itu; ubah baris itu alih-alih menambah');
    }

    const row = await prisma.timesheetEntry.create({
      data: { companyId, employeeId, projectId: project.id, date, hours: input.hours, notes: input.notes },
      include: { project: PROJECT_SELECT },
    });
    logger.info('Timesheet entry created', { companyId, entryId: row.id, project: project.code, hours: input.hours });
    return row;
  }

  async listMine(companyId: string, employeeId: string, query: MyEntriesQueryDTO) {
    return prisma.timesheetEntry.findMany({
      where: {
        companyId, employeeId,
        ...(query.from || query.to ? { date: {
          ...(query.from ? { gte: new Date(`${query.from}T00:00:00.000Z`) } : {}),
          ...(query.to ? { lte: new Date(`${query.to}T00:00:00.000Z`) } : {}),
        } } : {}),
      },
      orderBy: { date: 'desc' },
      include: { project: PROJECT_SELECT },
    });
  }

  async updateMine(companyId: string, employeeId: string, id: string, input: UpdateEntryDTO) {
    const entry = await this.ownSubmittedEntry(companyId, employeeId, id);
    if (input.hours !== undefined) {
      await this.assertDayFits(companyId, employeeId, entry.date, new Prisma.Decimal(input.hours), entry.id);
    }
    return prisma.timesheetEntry.update({
      where: { id },
      data: { hours: input.hours, notes: input.notes },
      include: { project: PROJECT_SELECT },
    });
  }

  async deleteMine(companyId: string, employeeId: string, id: string) {
    await this.ownSubmittedEntry(companyId, employeeId, id);
    await prisma.timesheetEntry.delete({ where: { id } });
    return { id, deleted: true };
  }

  // ==================== Approval & reporting ====================
  async list(companyId: string, query: EntriesQueryDTO) {
    return prisma.timesheetEntry.findMany({
      where: {
        companyId,
        ...(query.status ? { status: query.status } : {}),
        ...(query.employeeId ? { employeeId: query.employeeId } : {}),
        ...(query.projectId ? { projectId: query.projectId } : {}),
        ...(query.from || query.to ? { date: {
          ...(query.from ? { gte: new Date(`${query.from}T00:00:00.000Z`) } : {}),
          ...(query.to ? { lte: new Date(`${query.to}T00:00:00.000Z`) } : {}),
        } } : {}),
      },
      // Tiebreaker id: kursor Prisma butuh urutan total — baris yang seri di
      // date+createdAt bisa terlewat/terduplikat di batas halaman tanpanya.
      orderBy: [{ date: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
      // Daftar approval berpaginasi seperti antrian helpdesk: dua tahun
      // timesheet perusahaan tidak boleh terkirim utuh demi satu layar.
      take: query.limit ?? 50,
      ...(query.cursor ? { skip: 1, cursor: { id: query.cursor } } : {}),
      include: { project: PROJECT_SELECT, employee: EMPLOYEE_SELECT },
    });
  }

  async decide(
    companyId: string, id: string, approverUserId: string, decision: 'APPROVED' | 'REJECTED',
    approverEmployeeId?: string | null,
  ) {
    const entry = await prisma.timesheetEntry.findFirst({ where: { id, companyId }, select: { id: true, status: true, employeeId: true } });
    if (!entry) throw new NotFoundError('Baris timesheet tidak ditemukan');
    // Jam yang menjadi tagihan butuh empat mata — prinsip yang sama dengan
    // maker-checker payroll: pencatat tidak menyetujui jamnya sendiri.
    if (approverEmployeeId && entry.employeeId === approverEmployeeId) {
      throw new ConflictError('Jam kerja sendiri tidak bisa disetujui sendiri; minta approver lain memutuskan');
    }
    // Keputusan hanya atas baris yang menunggu: APPROVED terkunci (angkanya
    // mungkin sudah ditagihkan), REJECTED kembali lewat baris baru.
    const result = await prisma.timesheetEntry.updateMany({
      where: { id, companyId, status: TimesheetStatus.SUBMITTED },
      data: { status: decision, approvedBy: approverUserId, approvedAt: new Date() },
    });
    if (result.count !== 1) {
      throw new ConflictError(`Baris ini sudah ${entry.status}; hanya SUBMITTED yang bisa diputuskan`);
    }
    return prisma.timesheetEntry.findFirst({ where: { id }, include: { project: PROJECT_SELECT, employee: EMPLOYEE_SELECT } });
  }

  /** Rekap jam APPROVED per proyek per karyawan — bahan penagihan. */
  async report(companyId: string, query: ReportQueryDTO) {
    const grouped = await prisma.timesheetEntry.groupBy({
      by: ['projectId', 'employeeId'],
      where: {
        companyId,
        status: TimesheetStatus.APPROVED,
        ...(query.projectId ? { projectId: query.projectId } : {}),
        date: { gte: new Date(`${query.from}T00:00:00.000Z`), lte: new Date(`${query.to}T00:00:00.000Z`) },
      },
      _sum: { hours: true },
    });
    if (!grouped.length) return [];

    const [projects, employees] = await Promise.all([
      prisma.project.findMany({
        where: { id: { in: [...new Set(grouped.map((row) => row.projectId))] } },
        select: { id: true, code: true, name: true },
      }),
      prisma.employee.findMany({
        where: { id: { in: [...new Set(grouped.map((row) => row.employeeId))] } },
        select: { id: true, fullName: true, employeeNumber: true },
      }),
    ]);
    const projectById = new Map(projects.map((row) => [row.id, row]));
    const employeeById = new Map(employees.map((row) => [row.id, row]));

    return grouped.map((row) => ({
      project: projectById.get(row.projectId) ?? { id: row.projectId },
      employee: employeeById.get(row.employeeId) ?? { id: row.employeeId },
      hours: row._sum.hours?.toNumber() ?? 0,
    }));
  }

  // ==================== Guards ====================
  private async ownSubmittedEntry(companyId: string, employeeId: string, id: string) {
    const entry = await prisma.timesheetEntry.findFirst({
      where: { id, companyId },
      select: { id: true, employeeId: true, status: true, date: true },
    });
    if (!entry || entry.employeeId !== employeeId) throw new NotFoundError('Baris timesheet tidak ditemukan');
    if (entry.status !== TimesheetStatus.SUBMITTED) {
      throw new ConflictError(`Baris ${entry.status} terkunci; minta approver membukanya lewat penolakan, lalu catat ulang`);
    }
    return entry;
  }

  /** Total jam sehari di semua proyek ≤ 24; `excludeId` saat mengubah baris. */
  private async assertDayFits(
    companyId: string, employeeId: string, date: Date, hours: Prisma.Decimal, excludeId: string | null,
  ) {
    const sameDay = await prisma.timesheetEntry.findMany({
      where: { companyId, employeeId, date, ...(excludeId ? { id: { not: excludeId } } : {}), status: { not: TimesheetStatus.REJECTED } },
      select: { hours: true },
    });
    const total = sameDay.reduce((sum, row) => sum.plus(row.hours), hours);
    if (total.greaterThan(24)) {
      throw new BadRequestError(`Total jam pada hari itu menjadi ${total.toString()}; satu hari hanya punya 24 jam`);
    }
  }
}

export const timesheetService = new TimesheetService();
