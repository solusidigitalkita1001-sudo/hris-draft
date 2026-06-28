import { Prisma } from '@prisma/client';
import { prisma } from '@/shared/database/prisma';
import {
  CreateDocumentCategoryDTO,
  CreateDocumentDTO,
  DocumentQueryDTO,
} from './document-management.dto';

export class DocumentManagementRepository {
  async findCategories(companyId?: string, groupId?: string) {
    const where: Prisma.DocumentCategoryWhereInput = {
      status: 'ACTIVE',
      OR: [
        companyId ? { companyId } : undefined,
        groupId ? { groupId } : undefined,
        { companyId: null, groupId: null },
      ].filter(Boolean) as Prisma.DocumentCategoryWhereInput[],
    };

    const rows = await prisma.documentCategory.findMany({
      where,
      orderBy: [{ name: 'asc' }],
    });
    return rows;
  }

  async createCategory(data: CreateDocumentCategoryDTO) {
    return prisma.documentCategory.create({ data });
  }

  async findDocuments(params: DocumentQueryDTO & { companyId: string; userId?: string }) {
    const where: Prisma.DocumentWhereInput = {
      companyId: params.companyId,
      deletedAt: null,
    };

    if (params.categoryId) where.categoryId = params.categoryId;
    if (params.employeeId) where.employeeId = params.employeeId;
    if (params.status) where.status = params.status;
    if (params.search) {
      where.OR = [
        { title: { contains: params.search } },
        { fileName: { contains: params.search } },
        { category: { name: { contains: params.search } } },
      ];
    }

    const rows = await prisma.document.findMany({
      where,
      include: {
        category: true,
        employee: {
          select: {
            id: true,
            fullName: true,
            employeeNumber: true,
          },
        },
        uploader: {
          select: {
            id: true,
            email: true,
          },
        },
      },
      orderBy: [{ createdAt: 'desc' }],
    });
    return rows;
  }

  async findDocumentById(id: string) {
    return prisma.document.findFirst({
      where: { id, deletedAt: null },
      include: {
        category: true,
        employee: {
          select: {
            id: true,
            fullName: true,
            employeeNumber: true,
          },
        },
        uploader: {
          select: {
            id: true,
            email: true,
          },
        },
        accessLogs: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
      },
    });
  }

  async createDocument(data: CreateDocumentDTO & {
    groupId?: string;
    uploadedBy: string;
    fileName: string;
    filePath: string;
    mimeType: string;
    fileSize: number;
  }) {
    return prisma.document.create({
      data: {
        companyId: data.companyId,
        groupId: data.groupId,
        categoryId: data.categoryId,
        employeeId: data.employeeId,
        ownerType: data.ownerType,
        title: data.title,
        description: data.description,
        visibility: data.visibility,
        expiresAt: data.expiresAt ? new Date(data.expiresAt) : undefined,
        uploadedBy: data.uploadedBy,
        fileName: data.fileName,
        filePath: data.filePath,
        mimeType: data.mimeType,
        fileSize: data.fileSize,
      },
      include: {
        category: true,
        employee: {
          select: {
            id: true,
            fullName: true,
            employeeNumber: true,
          },
        },
        uploader: {
          select: {
            id: true,
            email: true,
          },
        },
      },
    });
  }

  async logAccess(documentId: string, accessedBy: string, action: 'VIEW' | 'DOWNLOAD') {
    await prisma.documentAccessLog.create({
      data: {
        documentId,
        accessedBy,
        action,
      },
    });
  }
}

export const documentManagementRepository = new DocumentManagementRepository();
