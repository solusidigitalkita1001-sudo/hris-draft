import fs from 'fs/promises';
import path from 'path';
import config from '@/config';
import { prisma } from '@/shared/database/prisma';
import {
  BadRequestError,
  ForbiddenError,
  NotFoundError,
} from '@/shared/exceptions/AppError';
import {
  CreateDocumentCategoryDTO,
  CreateDocumentDTO,
  DocumentQueryDTO,
} from './document-management.dto';
import { documentManagementRepository } from './document-management.repository';
import {
  generateSignedDocumentPath,
  verifyDocumentSignature,
} from '@/shared/security/signed-url';

export class DocumentManagementService {
  async findCategories(companyId?: string, groupId?: string) {
    return documentManagementRepository.findCategories(companyId, groupId);
  }

  async createCategory(data: CreateDocumentCategoryDTO, user: { companyId?: string; groupId?: string; roles?: string[] }) {
    if (!data.companyId && !data.groupId) {
      throw new BadRequestError('companyId or groupId is required');
    }

    if (!this.canAccessCompany(user, data.companyId) || !this.canAccessGroup(user, data.groupId)) {
      throw new ForbiddenError('You do not have access to create this category');
    }

    return documentManagementRepository.createCategory(data);
  }

  async findDocuments(query: DocumentQueryDTO, user: { id: string; companyId?: string; groupId?: string; roles?: string[] }) {
    const companyId = query.companyId || user.companyId;
    if (!companyId) {
      throw new BadRequestError('companyId is required');
    }

    if (!this.canAccessCompany(user, companyId)) {
      throw new ForbiddenError('You do not have access to this company data');
    }

    return documentManagementRepository.findDocuments({ ...query, companyId, userId: user.id });
  }

  async findDocumentById(id: string, user: { id: string; companyId?: string; groupId?: string; roles?: string[] }) {
    const document = await documentManagementRepository.findDocumentById(id);
    if (!document) {
      throw new NotFoundError('Document not found');
    }

    if (!this.canAccessCompany(user, document.companyId) || !this.canAccessGroup(user, document.groupId || undefined)) {
      throw new ForbiddenError('You do not have access to this document');
    }

    await documentManagementRepository.logAccess(document.id, user.id, 'VIEW');
    return document;
  }

  async createDocument(
    data: CreateDocumentDTO,
    file: Express.Multer.File | undefined,
    user: { id: string; companyId?: string; groupId?: string; roles?: string[] }
  ) {
    if (!file) {
      throw new BadRequestError('File is required');
    }

    if (!this.canAccessCompany(user, data.companyId)) {
      throw new ForbiddenError('You do not have access to this company data');
    }

    const category = await prisma.documentCategory.findUnique({
      where: { id: data.categoryId },
    });

    if (!category) {
      throw new NotFoundError('Document category not found');
    }

    if (category.companyId && category.companyId !== data.companyId) {
      throw new BadRequestError('Category does not belong to this company');
    }

    if (data.ownerType === 'EMPLOYEE') {
      if (!data.employeeId) {
        throw new BadRequestError('employeeId is required for employee documents');
      }

      const employee = await prisma.employee.findFirst({
        where: {
          id: data.employeeId,
          companyId: data.companyId,
          deletedAt: null,
        },
      });

      if (!employee) {
        throw new NotFoundError('Employee not found');
      }
    }

    return documentManagementRepository.createDocument({
      ...data,
      groupId: user.groupId,
      uploadedBy: user.id,
      fileName: file.originalname,
      filePath: file.path,
      mimeType: file.mimetype,
      fileSize: file.size,
    });
  }

  // Task 1.3: issue a short-lived signed URL after the normal access check.
  async getSignedUrl(id: string, user: { id: string; companyId?: string; groupId?: string; roles?: string[] }) {
    const document = await documentManagementRepository.findDocumentById(id);
    if (!document) throw new NotFoundError('Document not found');

    if (!this.canAccessCompany(user, document.companyId) || !this.canAccessGroup(user, document.groupId || undefined)) {
      throw new ForbiddenError('You do not have access to this document');
    }

    const { path: signedPath, expiresAt } = generateSignedDocumentPath(id);
    await documentManagementRepository.logAccess(document.id, user.id, 'VIEW');
    return { url: `${config.app.url}${signedPath}`, expiresAt };
  }

  // Serve by signature only — the HMAC is the authorization, so no user context.
  async getFileBySignature(id: string, expires?: string, sig?: string) {
    if (!verifyDocumentSignature(id, expires, sig)) {
      throw new ForbiddenError('Invalid or expired document URL');
    }
    const document = await documentManagementRepository.findDocumentById(id);
    if (!document) throw new NotFoundError('Document not found');

    const absolutePath = path.resolve(document.filePath);
    try {
      await fs.access(absolutePath);
    } catch {
      throw new NotFoundError('Stored file not found');
    }
    return { absolutePath, fileName: document.fileName, mimeType: document.mimeType };
  }

  async getDownloadPayload(id: string, user: { id: string; companyId?: string; groupId?: string; roles?: string[] }) {
    const document = await documentManagementRepository.findDocumentById(id);
    if (!document) {
      throw new NotFoundError('Document not found');
    }

    if (!this.canAccessCompany(user, document.companyId) || !this.canAccessGroup(user, document.groupId || undefined)) {
      throw new ForbiddenError('You do not have access to this document');
    }

    try {
      await fs.access(path.resolve(document.filePath));
    } catch {
      throw new NotFoundError('Stored file not found');
    }

    await documentManagementRepository.logAccess(document.id, user.id, 'DOWNLOAD');
    return {
      absolutePath: path.resolve(document.filePath),
      fileName: document.fileName,
      mimeType: document.mimeType,
    };
  }

  private canAccessCompany(user: { companyId?: string; roles?: string[] }, companyId?: string | null) {
    if (!companyId) return true;
    if (user.roles?.some((role) => ['SUPER_ADMIN', 'GROUP_ADMIN'].includes(role))) return true;
    return user.companyId === companyId;
  }

  private canAccessGroup(user: { groupId?: string; roles?: string[] }, groupId?: string | null) {
    if (!groupId) return true;
    if (user.roles?.includes('SUPER_ADMIN')) return true;
    return user.groupId === groupId;
  }
}

export const documentManagementService = new DocumentManagementService();
