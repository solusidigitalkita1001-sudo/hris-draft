import { NextFunction, Response } from 'express';
import path from 'path';
import { Result } from '@/shared/core/Result';
import { AuthenticatedRequest } from '@/shared/middleware/Authenticate';
import {
  createDocumentCategorySchema,
  createDocumentSchema,
  documentQuerySchema,
} from './document-management.dto';
import { documentManagementService } from './document-management.service';

export class DocumentManagementController {
  async findCategories(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = (req.query.companyId as string) || req.user?.companyId;
      const groupId = (req.query.groupId as string) || req.user?.groupId;
      const data = await documentManagementService.findCategories(companyId, groupId);
      res.json(Result.success(data));
    } catch (error) {
      next(error);
    }
  }

  async createCategory(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return res.status(401).json(Result.error('Authentication required'));
      }

      const payload = createDocumentCategorySchema.parse(req.body);
      const data = await documentManagementService.createCategory(payload, req.user);
      res.status(201).json(Result.created(data, 'Document category created'));
    } catch (error) {
      next(error);
    }
  }

  async findDocuments(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return res.status(401).json(Result.error('Authentication required'));
      }

      const query = documentQuerySchema.parse(req.query);
      const data = await documentManagementService.findDocuments(query, req.user);
      res.json(Result.success(data));
    } catch (error) {
      next(error);
    }
  }

  async findDocumentById(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return res.status(401).json(Result.error('Authentication required'));
      }

      const data = await documentManagementService.findDocumentById(req.params.id as string, req.user);
      res.json(Result.success(data));
    } catch (error) {
      next(error);
    }
  }

  async createDocument(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return res.status(401).json(Result.error('Authentication required'));
      }

      const payload = createDocumentSchema.parse({
        ...req.body,
        expiresAt: req.body.expiresAt || undefined,
      });
      const data = await documentManagementService.createDocument(payload, req.file, req.user);
      res.status(201).json(Result.created(data, 'Document uploaded'));
    } catch (error) {
      next(error);
    }
  }

  async downloadDocument(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return res.status(401).json(Result.error('Authentication required'));
      }

      const file = await documentManagementService.getDownloadPayload(req.params.id as string, req.user);
      res.download(path.resolve(file.absolutePath), file.fileName);
    } catch (error) {
      next(error);
    }
  }
}

export const documentManagementController = new DocumentManagementController();
