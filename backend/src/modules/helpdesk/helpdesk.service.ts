import { HrTicketStatus } from '@prisma/client';
import prisma from '@/shared/database/prisma';
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from '@/shared/exceptions/AppError';
import { logger } from '@/shared/logger/WinstonLogger';
import type { CommentDTO, CreateTicketDTO, TicketQueryDTO, UpdateTicketDTO } from './helpdesk.dto';

/**
 * HR helpdesk (GAP-50): tiket permintaan karyawan ke HR, menggantikan thread
 * WhatsApp yang tidak berstatus dan tidak berpenanggung jawab.
 *
 * Dua sisi dengan hak berbeda: karyawan hanya melihat dan mengomentari tiket
 * MILIKNYA dan boleh menutupnya sendiri; HR (helpdesk:read/update) melihat
 * antrian perusahaan, memegang, dan memindahkan status. Transisi status
 * dibatasi — CLOSED adalah akhir; tiket yang keliru ditutup dibuka lagi lewat
 * RESOLVED→OPEN sebelum tertutup, atau dibuat baru.
 */
const TRANSITIONS: Record<HrTicketStatus, HrTicketStatus[]> = {
  OPEN: ['IN_PROGRESS', 'RESOLVED', 'CLOSED'],
  IN_PROGRESS: ['OPEN', 'RESOLVED', 'CLOSED'],
  RESOLVED: ['OPEN', 'CLOSED'],
  CLOSED: [],
};

const TICKET_INCLUDE = {
  employee: { select: { id: true, fullName: true, employeeNumber: true } },
  comments: { orderBy: { createdAt: 'asc' as const } },
};

export class HelpdeskService {
  async createMine(companyId: string, employeeId: string, input: CreateTicketDTO) {
    const row = await prisma.hrTicket.create({
      data: {
        companyId,
        employeeId,
        category: input.category,
        subject: input.subject,
        description: input.description,
        priority: input.priority ?? 'MEDIUM',
      },
    });
    logger.info('Helpdesk ticket created', { ticketId: row.id, companyId, category: input.category });
    return row;
  }

  async listMine(companyId: string, employeeId: string) {
    return prisma.hrTicket.findMany({
      where: { companyId, employeeId },
      orderBy: { createdAt: 'desc' },
      // Tiket milik sendiri jarang banyak; komentar ikut, tapi tetap dibatasi.
      take: 100,
      include: { comments: { orderBy: { createdAt: 'asc' } } },
    });
  }

  /**
   * Antrian adalah DAFTAR, bukan arsip: berpaginasi, default tanpa CLOSED,
   * dan tanpa isi thread komentar — dua tahun tiket perusahaan 2.000 orang
   * tidak boleh terkirim utuh demi layar 25 baris. Detail (termasuk komentar)
   * ada di `getForActor`.
   */
  async listQueue(companyId: string, filters: TicketQueryDTO) {
    return prisma.hrTicket.findMany({
      where: {
        companyId,
        ...(filters.status
          ? { status: filters.status }
          : filters.includeClosed === 'true' ? {} : { status: { not: 'CLOSED' } }),
        ...(filters.category ? { category: filters.category } : {}),
        ...(filters.assigneeUserId ? { assigneeUserId: filters.assigneeUserId } : {}),
      },
      // Tiebreaker id: kursor Prisma butuh urutan total — tiket yang seri di
      // priority+createdAt bisa terlewat/terduplikat di batas halaman tanpanya.
      orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }, { id: 'asc' }],
      take: filters.limit ?? 50,
      ...(filters.cursor ? { skip: 1, cursor: { id: filters.cursor } } : {}),
      include: {
        employee: { select: { id: true, fullName: true, employeeNumber: true } },
        _count: { select: { comments: true } },
      },
    });
  }

  async getForActor(companyId: string, id: string, actor: { employeeId?: string | null; canReadAll: boolean }) {
    const ticket = await prisma.hrTicket.findFirst({ where: { id, companyId }, include: TICKET_INCLUDE });
    if (!ticket) throw new NotFoundError('Tiket tidak ditemukan');
    if (!actor.canReadAll && ticket.employeeId !== actor.employeeId) {
      // Jawaban yang sama dengan "tidak ada": keberadaan tiket orang lain
      // bukan informasi untuk karyawan lain.
      throw new NotFoundError('Tiket tidak ditemukan');
    }
    return ticket;
  }

  async update(companyId: string, id: string, input: UpdateTicketDTO) {
    const ticket = await prisma.hrTicket.findFirst({ where: { id, companyId }, select: { id: true, status: true } });
    if (!ticket) throw new NotFoundError('Tiket tidak ditemukan');

    if (input.status && input.status !== ticket.status && !TRANSITIONS[ticket.status].includes(input.status)) {
      throw new ConflictError(`Tiket ${ticket.status} tidak bisa pindah ke ${input.status}`);
    }

    // Assignee harus user hidup yang punya akses company ini — userId asing
    // atau milik tenant lain membuat antrian menunjuk orang yang tidak akan
    // pernah melihat tiketnya.
    if (input.assigneeUserId) {
      const assignee = await prisma.user.findFirst({
        where: {
          id: input.assigneeUserId, deletedAt: null,
          companyAccesses: { some: { companyId } },
        },
        select: { id: true },
      });
      if (!assignee) throw new BadRequestError('Assignee bukan user aktif di perusahaan ini');
    }

    return prisma.hrTicket.update({
      where: { id },
      data: {
        status: input.status,
        priority: input.priority,
        ...(input.assigneeUserId !== undefined ? { assigneeUserId: input.assigneeUserId } : {}),
        ...(input.status === 'RESOLVED' ? { resolvedAt: new Date() } : {}),
        ...(input.status === 'CLOSED' ? { closedAt: new Date() } : {}),
        // Dibuka lagi = belum selesai: stempel penyelesaian lama harus ikut
        // hilang, atau metrik SLA menghitung tiket terbuka sebagai selesai.
        ...(input.status === 'OPEN' || input.status === 'IN_PROGRESS'
          ? { resolvedAt: null, closedAt: null }
          : {}),
      },
      include: TICKET_INCLUDE,
    });
  }

  /** Karyawan menutup tiketnya sendiri — masalahnya selesai menurut dia. */
  async closeMine(companyId: string, id: string, employeeId: string) {
    const ticket = await prisma.hrTicket.findFirst({ where: { id, companyId }, select: { id: true, status: true, employeeId: true } });
    if (!ticket || ticket.employeeId !== employeeId) throw new NotFoundError('Tiket tidak ditemukan');
    if (ticket.status === 'CLOSED') throw new ConflictError('Tiket sudah ditutup');
    return prisma.hrTicket.update({
      where: { id },
      data: { status: 'CLOSED', closedAt: new Date() },
    });
  }

  async comment(
    companyId: string, id: string,
    actor: { userId: string; employeeId?: string | null; canReadAll: boolean },
    input: CommentDTO,
  ) {
    const ticket = await prisma.hrTicket.findFirst({ where: { id, companyId }, select: { id: true, status: true, employeeId: true } });
    if (!ticket) throw new NotFoundError('Tiket tidak ditemukan');
    if (!actor.canReadAll && ticket.employeeId !== actor.employeeId) throw new NotFoundError('Tiket tidak ditemukan');
    if (ticket.status === 'CLOSED') throw new ConflictError('Tiket sudah ditutup; buat tiket baru');
    if (!actor.userId) throw new ForbiddenError('Komentar butuh akun pengguna');

    return prisma.hrTicketComment.create({
      data: { ticketId: ticket.id, authorUserId: actor.userId, body: input.body },
    });
  }
}

export const helpdeskService = new HelpdeskService();

export function requireEmployee(employeeId: string | null | undefined): string {
  if (!employeeId) {
    throw new BadRequestError('Akun ini tidak tertaut ke data karyawan; tiket helpdesk diajukan sebagai karyawan');
  }
  return employeeId;
}
