import prisma from '@/shared/database/prisma';
import { BadRequestError, NotFoundError } from '@/shared/exceptions/AppError';
import { logger } from '@/shared/logger/WinstonLogger';
import type { CreatePostDTO, FeedQueryDTO, GiveKudosDTO, KudosQueryDTO } from './engagement.dto';

const AUTHOR_SELECT = { select: { id: true, fullName: true, employeeNumber: true } };

/**
 * Engagement (GAP-51): feed perusahaan dan kudos. Semua self-service — menulis
 * dan berterima kasih tidak butuh izin, hanya identitas karyawan. Moderasi
 * memakai izin `announcement:approve` yang sudah ada: pemegangnya memang
 * pemilik kanal komunikasi perusahaan, dan feed adalah kanal komunikasi.
 */
export class EngagementService {
  async createPost(companyId: string, authorEmployeeId: string, input: CreatePostDTO) {
    const row = await prisma.feedPost.create({
      data: { companyId, authorEmployeeId, content: input.content },
      include: { author: AUTHOR_SELECT },
    });
    logger.info('Feed post created', { companyId, postId: row.id });
    return row;
  }

  async listFeed(companyId: string, query: FeedQueryDTO) {
    return prisma.feedPost.findMany({
      where: {
        companyId,
        deletedAt: null,
        ...(query.before ? { createdAt: { lt: new Date(query.before) } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: query.limit,
      include: { author: AUTHOR_SELECT },
    });
  }

  /**
   * Penulis menarik tulisannya; moderator menurunkan tulisan siapa pun.
   * Soft delete — jejak tinggal untuk audit, feed tidak menampilkannya lagi.
   */
  async deletePost(companyId: string, id: string, actor: { employeeId?: string | null; isModerator: boolean }) {
    const post = await prisma.feedPost.findFirst({
      where: { id, companyId, deletedAt: null },
      select: { id: true, authorEmployeeId: true },
    });
    if (!post) throw new NotFoundError('Post tidak ditemukan');
    if (!actor.isModerator && post.authorEmployeeId !== actor.employeeId) {
      throw new NotFoundError('Post tidak ditemukan');
    }
    await prisma.feedPost.update({ where: { id }, data: { deletedAt: new Date() } });
    return { id, deleted: true };
  }

  async giveKudos(companyId: string, fromEmployeeId: string, input: GiveKudosDTO) {
    if (input.toEmployeeId === fromEmployeeId) {
      throw new BadRequestError('Kudos untuk diri sendiri tidak dihitung');
    }
    const recipient = await prisma.employee.findFirst({
      where: { id: input.toEmployeeId, companyId, deletedAt: null },
      select: { id: true },
    });
    if (!recipient) throw new NotFoundError('Karyawan penerima tidak ditemukan di perusahaan ini');

    const row = await prisma.kudos.create({
      data: {
        companyId,
        fromEmployeeId,
        toEmployeeId: input.toEmployeeId,
        badge: input.badge,
        message: input.message,
      },
      include: { from: AUTHOR_SELECT, to: AUTHOR_SELECT },
    });
    logger.info('Kudos given', { companyId, kudosId: row.id });
    return row;
  }

  async listKudos(companyId: string, query: KudosQueryDTO) {
    return prisma.kudos.findMany({
      where: {
        companyId,
        ...(query.employeeId ? { toEmployeeId: query.employeeId } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: query.limit,
      include: { from: AUTHOR_SELECT, to: AUTHOR_SELECT },
    });
  }
}

export const engagementService = new EngagementService();
