import fs from 'fs/promises';
import path from 'path';
import config from '@/config';
import type { Prisma } from '@prisma/client';
import { administrationService } from '@/modules/administration/administration.service';
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

type DocumentUser = { id: string; companyId?: string; companyScope?: string[]; employeeId?: string; groupId?: string; roles?: string[] };

export class DocumentManagementService {
  private async accessFilter(user: DocumentUser): Promise<Prisma.DocumentWhereInput> {
    if (!user.companyId) throw new ForbiddenError('Company context is required');
    const scope = await administrationService.findMyDataScopeByUser(user.companyId, user, 'document');
    const filter = administrationService.resolveEmployeeFilterForCurrentUser(scope, user, 'employee');
    return {
      companyId: user.companyId,
      ...(Object.keys(filter).length ? { employee: { is: { ...filter, companyId: user.companyId } } } : {}),
      OR: [
        { visibility: { not: 'RESTRICTED' }, employeeId: null },
        { uploadedBy: user.id },
        ...(user.employeeId ? [{ employeeId: user.employeeId }] : []),
        ...(user.roles?.some((role) => ['SUPER_ADMIN', 'COMPANY_ADMIN', 'HR_ADMIN', 'HR_MANAGER'].includes(role))
          ? [{ companyId: user.companyId }] : []),
      ],
    };
  }

  private async storedPath(filePath: string): Promise<string> {
    const root = await fs.realpath(path.resolve(process.cwd(), 'uploads/documents'));
    const resolved = await fs.realpath(path.resolve(filePath));
    const relative = path.relative(root, resolved);
    if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
      throw new ForbiddenError('Invalid stored file location');
    }
    return resolved;
  }

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

  async findDocuments(query: DocumentQueryDTO, user: DocumentUser) {
    const companyId = query.companyId || user.companyId;
    if (!companyId) {
      throw new BadRequestError('companyId is required');
    }

    if (!this.canAccessCompany(user, companyId)) {
      throw new ForbiddenError('You do not have access to this company data');
    }

    const documents = await documentManagementRepository.findDocuments({ ...query, companyId, userId: user.id }, await this.accessFilter(user));
    return documents.map(({ filePath: _filePath, ...document }) => document);
  }

  async findDocumentById(id: string, user: DocumentUser) {
    const document = await documentManagementRepository.findDocumentById(id, await this.accessFilter(user));
    if (!document) {
      throw new NotFoundError('Document not found');
    }

    if (!this.canAccessCompany(user, document.companyId) || !this.canAccessGroup(user, document.groupId || undefined)) {
      throw new ForbiddenError('You do not have access to this document');
    }

    await documentManagementRepository.logAccess(document.id, user.id, 'VIEW');
    const { filePath: _filePath, ...metadata } = document;
    return metadata;
  }

  async createDocument(
    data: CreateDocumentDTO,
    file: Express.Multer.File | undefined,
    user: DocumentUser
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

    if (category.groupId && category.groupId !== user.groupId) {
      throw new ForbiddenError('Category does not belong to this group');
    }

    const scope = await administrationService.findMyDataScopeByUser(data.companyId, user, 'document');
    const employeeFilter = administrationService.resolveEmployeeFilterForCurrentUser(scope, user, 'employee');
    if (Object.keys(employeeFilter).length && data.ownerType !== 'EMPLOYEE') {
      throw new ForbiddenError('Scoped users may only upload employee documents');
    }

    if (data.ownerType === 'EMPLOYEE') {
      if (!data.employeeId) {
        throw new BadRequestError('employeeId is required for employee documents');
      }

      const managesDocuments = user.roles?.some((role) => ['SUPER_ADMIN', 'COMPANY_ADMIN', 'HR_ADMIN', 'HR_MANAGER'].includes(role));
      if (!managesDocuments && data.employeeId !== user.employeeId) {
        throw new ForbiddenError('Cannot upload another employee document');
      }
      const employee = await prisma.employee.findFirst({
        where: {
          AND: [employeeFilter],
          id: data.employeeId,
          companyId: data.companyId,
          deletedAt: null,
        },
      });

      if (!employee) {
        throw new NotFoundError('Employee not found');
      }
    }

    const created = await documentManagementRepository.createDocument({
      ...data,
      groupId: user.groupId,
      uploadedBy: user.id,
      fileName: file.originalname,
      filePath: file.path,
      mimeType: file.mimetype,
      fileSize: file.size,
    });
    const { filePath: _filePath, ...metadata } = created;
    return metadata;
  }

  // Task 1.3: issue a short-lived signed URL after the normal access check.
  async getSignedUrl(id: string, user: DocumentUser) {
    const document = await documentManagementRepository.findDocumentById(id, await this.accessFilter(user));
    if (!document) throw new NotFoundError('Document not found');

    if (!this.canAccessCompany(user, document.companyId) || !this.canAccessGroup(user, document.groupId || undefined)) {
      throw new ForbiddenError('You do not have access to this document');
    }

    const { path: signedPath, expiresAt } = generateSignedDocumentPath(id);
    await documentManagementRepository.logAccess(document.id, user.id, 'VIEW');
    return { url: `${config.app.url}${signedPath}`, expiresAt };
  }

  // A signature supplements, but never replaces, current session authorization.
  async getFileBySignature(id: string, expires: string | undefined, sig: string | undefined, user: DocumentUser) {
    if (!verifyDocumentSignature(id, expires, sig)) {
      throw new ForbiddenError('Invalid or expired document URL');
    }
    return this.getDownloadPayload(id, user);
  }

  async getDownloadPayload(id: string, user: DocumentUser) {
    const document = await documentManagementRepository.findDocumentById(id, await this.accessFilter(user));
    if (!document) {
      throw new NotFoundError('Document not found');
    }

    if (!this.canAccessCompany(user, document.companyId) || !this.canAccessGroup(user, document.groupId || undefined)) {
      throw new ForbiddenError('You do not have access to this document');
    }

    let absolutePath: string;
    try {
      absolutePath = await this.storedPath(document.filePath);
    } catch {
      throw new NotFoundError('Stored file not found');
    }

    await documentManagementRepository.logAccess(document.id, user.id, 'DOWNLOAD');
    return {
      absolutePath,
      fileName: document.fileName,
      mimeType: document.mimeType,
    };
  }

  private canAccessCompany(user: { companyId?: string; roles?: string[] }, companyId?: string | null) {
    if (!companyId) return true;
    if (user.roles?.includes('SUPER_ADMIN')) return true;
    return user.companyId === companyId;
  }

  private canAccessGroup(user: { groupId?: string; roles?: string[] }, groupId?: string | null) {
    if (!groupId) return true;
    if (user.roles?.includes('SUPER_ADMIN')) return true;
    return user.groupId === groupId;
  }
}

export const documentManagementService = new DocumentManagementService();
