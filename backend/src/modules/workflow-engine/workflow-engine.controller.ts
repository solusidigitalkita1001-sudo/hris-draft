import { NextFunction, Response } from 'express';
import { Result } from '@/shared/core/Result';
import { AuthenticatedRequest } from '@/shared/middleware/Authenticate';
import { workflowEngineRepository } from './workflow-engine.repository';

export class WorkflowEngineController {
  async findTemplates(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = (req.query.companyId as string) || req.user?.companyId;
      if (!companyId) {
        return res.status(400).json(Result.error('companyId is required'));
      }

      const data = await workflowEngineRepository.findTemplates(companyId);
      res.json(Result.success(data));
    } catch (error) {
      next(error);
    }
  }

  async findTemplateById(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const data = await workflowEngineRepository.findTemplateById(req.params.id as string);
      if (!data) {
        return res.status(404).json(Result.error('Workflow template not found'));
      }
      res.json(Result.success(data));
    } catch (error) {
      next(error);
    }
  }

  async createTemplate(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const data = await workflowEngineRepository.createTemplate(req.body);
      res.status(201).json(Result.created(data, 'Workflow template created'));
    } catch (error) {
      next(error);
    }
  }

  async updateTemplate(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const data = await workflowEngineRepository.updateTemplate(req.params.id as string, req.body);
      res.json(Result.updated(data, 'Workflow template updated'));
    } catch (error) {
      next(error);
    }
  }

  async deleteTemplate(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      await workflowEngineRepository.deleteTemplate(req.params.id as string);
      res.json(Result.deleted('Workflow template deleted'));
    } catch (error) {
      next(error);
    }
  }

  async findInstances(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = (req.query.companyId as string) || req.user?.companyId;
      const status = req.query.status as string | undefined;
      if (!companyId) {
        return res.status(400).json(Result.error('companyId is required'));
      }

      const data = await workflowEngineRepository.findInstances(companyId, status);
      res.json(Result.success(data));
    } catch (error) {
      next(error);
    }
  }

  async findMyApprovals(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = (req.query.companyId as string) || req.user?.companyId;
      if (!companyId || !req.user) {
        return res.status(400).json(Result.error('companyId is required'));
      }

      const data = await workflowEngineRepository.findMyApprovals(companyId, req.user.id, req.user.roles || []);
      res.json(Result.success(data));
    } catch (error) {
      next(error);
    }
  }

  async findInstanceById(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const data = await workflowEngineRepository.findInstanceById(req.params.id as string);
      if (!data) {
        return res.status(404).json(Result.error('Workflow instance not found'));
      }
      res.json(Result.success(data));
    } catch (error) {
      next(error);
    }
  }

  async startInstance(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return res.status(401).json(Result.error('Authentication required'));
      }

      const data = await workflowEngineRepository.startInstance(req.user.id, req.body);
      res.status(201).json(Result.created(data, 'Workflow instance started'));
    } catch (error) {
      next(error);
    }
  }

  async applyAction(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return res.status(401).json(Result.error('Authentication required'));
      }

      const data = await workflowEngineRepository.applyAction(
        req.params.id as string,
        req.user.id,
        req.user.roles || [],
        req.body
      );
      res.json(Result.updated(data, 'Workflow action applied'));
    } catch (error) {
      next(error);
    }
  }
}

export const workflowEngineController = new WorkflowEngineController();
