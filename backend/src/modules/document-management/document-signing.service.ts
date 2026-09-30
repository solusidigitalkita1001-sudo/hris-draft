import { DocumentSignerStatus } from '@prisma/client';
import prisma from '@/shared/database/prisma';
import { BadRequestError, ForbiddenError, NotFoundError } from '@/shared/exceptions/AppError';
import { logger } from '@/shared/logger/WinstonLogger';
import { getCurrentUser } from '@/shared/context/RequestContext';

export interface SignerInput {
  userId: string;
  /** Step in the sequence. Equal values sign in parallel. Omit for no order. */
  order?: number;
  dueAt?: string;
}

/**
 * Who must sign a document, and — when it matters — in what order (GAP-27).
 *
 * Order is **optional per document**, which was the decision. A contract or a
 * warning letter has a binding sequence: the employee acknowledges, then HR
 * counter-signs, then a director approves. Most documents have no such
 * sequence, and forcing one on them would slow the simple case down without
 * adding any certainty. A document with no signer list behaves exactly as
 * before.
 *
 * Note on scope: `DocumentSignature` existed in the schema with no code using
 * it, so signing itself is implemented here rather than merely ordered.
 */
export class DocumentSigningService {
  private async loadDocument(companyId: string, documentId: string) {
    const document = await prisma.document.findFirst({
      where: { id: documentId, companyId, deletedAt: null },
      select: { id: true, title: true, status: true },
    });
    if (!document) throw new NotFoundError('Document not found in the active company');
    return document;
  }

  /**
   * Declare the expected signers. Replaces any list that has not been acted on
   * yet; refuses once anyone has signed, because reshuffling a sequence
   * mid-signing would change what the people who already signed agreed to.
   */
  async setSigners(companyId: string, documentId: string, signers: SignerInput[]) {
    await this.loadDocument(companyId, documentId);

    if (!signers.length) throw new BadRequestError('At least one signer is required');
    const userIds = signers.map((signer) => signer.userId);
    if (new Set(userIds).size !== userIds.length) {
      throw new BadRequestError('The same signer appears more than once');
    }

    const existing = await prisma.documentSigner.findMany({
      where: { documentId },
      select: { status: true },
    });
    if (existing.some((row) => row.status !== DocumentSignerStatus.PENDING)) {
      throw new BadRequestError('Someone has already signed or declined; the signer list can no longer be changed');
    }

    // Every signer must be a real, active user with access to this company, or
    // the document waits forever on somebody who cannot sign it.
    const users = await prisma.user.findMany({
      where: {
        id: { in: userIds },
        deletedAt: null,
        status: 'ACTIVE',
        companyAccesses: { some: { companyId } },
      },
      select: { id: true },
    });
    if (users.length !== userIds.length) {
      throw new BadRequestError('One or more signers are not active users of this company');
    }

    await prisma.$transaction([
      prisma.documentSigner.deleteMany({ where: { documentId } }),
      prisma.documentSigner.createMany({
        data: signers.map((signer) => ({
          documentId,
          userId: signer.userId,
          order: signer.order ?? 1,
          dueAt: signer.dueAt ? new Date(signer.dueAt) : null,
        })),
      }),
    ]);

    logger.info('Document signers set', { documentId, companyId, signers: signers.length });
    return this.status(companyId, documentId);
  }

  async status(companyId: string, documentId: string) {
    await this.loadDocument(companyId, documentId);

    const signers = await prisma.documentSigner.findMany({
      where: { documentId },
      orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
      include: { user: { select: { id: true, email: true, employee: { select: { fullName: true } } } } },
    });

    const pending = signers.filter((signer) => signer.status === DocumentSignerStatus.PENDING);
    const currentStep = pending.length ? Math.min(...pending.map((signer) => signer.order)) : null;

    return {
      documentId,
      /// False for a document that never declared signers — the old behaviour.
      ordered: signers.length > 0 && new Set(signers.map((signer) => signer.order)).size > 1,
      signers: signers.map((signer) => ({
        userId: signer.userId,
        email: signer.user.email,
        fullName: signer.user.employee?.fullName ?? null,
        order: signer.order,
        status: signer.status,
        dueAt: signer.dueAt,
        signedAt: signer.signedAt,
        /// Whose turn it is right now.
        isTurn: signer.status === DocumentSignerStatus.PENDING && signer.order === currentStep,
        overdue: Boolean(signer.dueAt && signer.status === DocumentSignerStatus.PENDING && signer.dueAt < new Date()),
      })),
      currentStep,
      complete: signers.length > 0 && pending.length === 0,
    };
  }

  /**
   * Sign, if it is this person's turn.
   *
   * A document with no declared signers accepts any authorized signature, as it
   * did before this existed. With a list, the rule is simply that an earlier
   * step must be finished first — the point of a sequence is that the later
   * signer sees what the earlier one agreed to.
   */
  async sign(companyId: string, documentId: string) {
    const actor = getCurrentUser();
    if (!actor?.id) throw new ForbiddenError('A signed-in user is required to sign');

    const document = await this.loadDocument(companyId, documentId);

    return prisma.$transaction(async (tx) => {
      const signers = await tx.documentSigner.findMany({
        where: { documentId },
        select: { id: true, userId: true, order: true, status: true },
      });

      if (signers.length) {
        const mine = signers.find((signer) => signer.userId === actor.id);
        if (!mine) throw new ForbiddenError('You are not on the signer list for this document');
        if (mine.status !== DocumentSignerStatus.PENDING) {
          throw new BadRequestError(`You have already ${mine.status.toLowerCase()} this document`);
        }

        const blocking = signers.filter(
          (signer) => signer.order < mine.order && signer.status === DocumentSignerStatus.PENDING,
        );
        if (blocking.length) {
          throw new BadRequestError(
            `Masih menunggu ${blocking.length} penanda tangan pada langkah sebelumnya`,
          );
        }

        const claimed = await tx.documentSigner.updateMany({
          where: { id: mine.id, status: DocumentSignerStatus.PENDING },
          data: { status: DocumentSignerStatus.SIGNED, signedAt: new Date() },
        });
        if (claimed.count !== 1) throw new BadRequestError('This signature was already recorded');
      }

      const signature = await tx.documentSignature.create({
        data: { documentId, signerId: actor.id },
        select: { id: true, signedAt: true },
      });

      logger.info('Document signed', { documentId, companyId, signerId: actor.id, title: document.title });
      return { documentId, signatureId: signature.id, signedAt: signature.signedAt };
    });
  }

  /** Refusing is an answer too, and an unanswered document is worse than a refused one. */
  async decline(companyId: string, documentId: string, reason: string) {
    const actor = getCurrentUser();
    if (!actor?.id) throw new ForbiddenError('A signed-in user is required');
    await this.loadDocument(companyId, documentId);

    const result = await prisma.documentSigner.updateMany({
      where: { documentId, userId: actor.id, status: DocumentSignerStatus.PENDING },
      data: { status: DocumentSignerStatus.DECLINED, declinedReason: reason.slice(0, 255) },
    });
    if (result.count === 0) {
      throw new BadRequestError('You have no pending signature on this document');
    }
    return { documentId, status: DocumentSignerStatus.DECLINED };
  }

  /** Documents waiting on the signed-in user, with whose turn it is respected. */
  async myPending(companyId: string) {
    const actor = getCurrentUser();
    if (!actor?.id) throw new ForbiddenError('A signed-in user is required');

    const rows = await prisma.documentSigner.findMany({
      where: {
        userId: actor.id,
        status: DocumentSignerStatus.PENDING,
        document: { companyId, deletedAt: null },
      },
      orderBy: [{ dueAt: 'asc' }, { createdAt: 'asc' }],
      include: {
        document: { select: { id: true, title: true, categoryId: true } },
      },
    });

    const documentIds = rows.map((row) => row.documentId);
    const blockingCounts = documentIds.length
      ? await prisma.documentSigner.groupBy({
          by: ['documentId'],
          where: { documentId: { in: documentIds }, status: DocumentSignerStatus.PENDING },
          _min: { order: true },
        })
      : [];
    const currentStep = new Map(blockingCounts.map((row) => [row.documentId, row._min.order]));

    return rows.map((row) => ({
      documentId: row.documentId,
      title: row.document.title,
      order: row.order,
      dueAt: row.dueAt,
      overdue: Boolean(row.dueAt && row.dueAt < new Date()),
      // A document can be assigned to someone and still not be their turn.
      isTurn: currentStep.get(row.documentId) === row.order,
    }));
  }
}

export const documentSigningService = new DocumentSigningService();
