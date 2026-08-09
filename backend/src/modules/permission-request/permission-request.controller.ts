import { Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '@/shared/middleware/Authenticate';
import { permissionRequestRepository } from './permission-request.repository';
import { Result } from '@/shared/core/Result';
import { ForbiddenError } from '@/shared/exceptions/AppError';
import { prisma } from '@/shared/database/prisma';

export class PermissionRequestController {
  private async getEmployeeId(req: AuthenticatedRequest) {
    const employeeId = req.user?.employeeId || (
      await prisma.user.findUnique({
        where: { id: req.user!.id },
        select: { employeeId: true },
      })
    )?.employeeId;

    if (!employeeId) {
      throw new ForbiddenError('This account is not linked to an employee profile');
    }
    return employeeId;
  }

  async findAll(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = (req.query.companyId as string) || (req.user as any)?.companyId as string;
      const status = req.query.status as string | undefined;
      if (!companyId) return res.status(400).json(Result.error('companyId is required'));
      const data = await permissionRequestRepository.findAll(companyId, status);
      res.json(Result.success(data));
    } catch (error) { next(error); }
  }

  async findMyRequests(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const employeeId = await this.getEmployeeId(req);
      const status = req.query.status as string | undefined;
      const data = await permissionRequestRepository.findMyRequests(employeeId, status);
      res.json(Result.success(data));
    } catch (error) { next(error); }
  }

  async findById(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await permissionRequestRepository.findById(req.params.id as string);
      if (!data) return res.status(404).json(Result.error('Request not found'));
      res.json(Result.success(data));
    } catch (error) { next(error); }
  }

  async create(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const employeeId = await this.getEmployeeId(req);
      const data = await permissionRequestRepository.create({
        ...req.body,
        companyId: req.user!.companyId,
        employeeId,
      });
      res.status(201).json(Result.created(data));
    } catch (error) { next(error); }
  }

  async cancel(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const employeeId = await this.getEmployeeId(req);
      const result = await permissionRequestRepository.cancel(req.params.id as string, employeeId);
      if (result.count === 0) return res.status(404).json(Result.error('Request not found or already processed'));
      res.json(Result.success(null, 'Request cancelled'));
    } catch (error) { next(error); }
  }

  async approve(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const request = await permissionRequestRepository.findById(req.params.id as string);
      if (!request) return res.status(404).json(Result.error('Request not found'));
      if (req.user!.employeeId && req.user!.employeeId === request.employeeId) {
        throw new ForbiddenError('Cannot approve your own permission request');
      }
      const data = await permissionRequestRepository.approve(req.params.id as string, req.user!.id, req.body);
      res.json(Result.updated(data, 'Request approved'));
    } catch (error) { next(error); }
  }

  async reject(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const request = await permissionRequestRepository.findById(req.params.id as string);
      if (!request) return res.status(404).json(Result.error('Request not found'));
      if (req.user!.employeeId && req.user!.employeeId === request.employeeId) {
        throw new ForbiddenError('Cannot reject your own permission request');
      }
      const data = await permissionRequestRepository.reject(req.params.id as string, req.user!.id, req.body);
      res.json(Result.updated(data, 'Request rejected'));
    } catch (error) { next(error); }
  }
}

export const permissionRequestController = new PermissionRequestController();
