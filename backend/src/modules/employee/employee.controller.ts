import { Request, Response, NextFunction } from 'express';
import { employeeService } from './employee.service';
import { Result } from '@/shared/core/Result';
import { AuthenticatedRequest } from '@/shared/middleware/Authenticate';

export class EmployeeController {
  async getFaceProfile(req: Request, res: Response, next: NextFunction) {
    try {
      const status = await employeeService.getFaceProfile(req.params.id as string);
      res.json(Result.success(status));
    } catch (error) {
      next(error);
    }
  }

  async enrollFaceProfile(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.file?.buffer) {
        res.status(400).json({ success: false, message: 'Foto wajah wajib diunggah pada field photo' });
        return;
      }
      const status = await employeeService.enrollFaceProfile(
        req.params.id as string,
        req.file.buffer,
      );
      res.json(Result.updated(status));
    } catch (error) {
      next(error);
    }
  }

  async deleteFaceProfile(req: Request, res: Response, next: NextFunction) {
    try {
      await employeeService.deleteFaceProfile(req.params.id as string);
      res.json(Result.deleted());
    } catch (error) {
      next(error);
    }
  }

  async findAll(req: Request, res: Response, next: NextFunction) {
    try {
      const cid = req.query.companyId as string;
      const query = {
        companyId: cid,
        departmentId: req.query.departmentId as string | undefined,
        positionId: req.query.positionId as string | undefined,
        status: req.query.status as string | undefined,
        search: req.query.search as string | undefined,
        page: parseInt(req.query.page as string) || 1,
        limit: parseInt(req.query.limit as string) || 20,
      };
      const result = await employeeService.findAll(query);
      res.json({
        success: true,
        data: result.data,
        meta: { page: result.page, limit: result.limit, total: result.total, totalPages: result.totalPages },
      });
    } catch (error) {
      next(error);
    }
  }

  async findById(req: Request, res: Response, next: NextFunction) {
    try {
      const employee = await employeeService.findById(req.params.id as string);
      res.json(Result.success(employee));
    } catch (error) {
      next(error);
    }
  }

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const employee = await employeeService.create(req.body);
      res.status(201).json(Result.created(employee));
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const employee = await employeeService.update(req.params.id as string, req.body);
      res.json(Result.updated(employee));
    } catch (error) {
      next(error);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      await employeeService.delete(req.params.id as string);
      res.json(Result.deleted());
    } catch (error) {
      next(error);
    }
  }

  async updateStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const employee = await employeeService.updateStatus(req.params.id as string, req.body.status);
      res.json(Result.updated(employee));
    } catch (error) {
      next(error);
    }
  }

  async findCareerTransactions(req: Request, res: Response, next: NextFunction) {
    try {
      const items = await employeeService.findCareerTransactions(req.params.id as string);
      res.json(Result.success(items));
    } catch (error) {
      next(error);
    }
  }

  async createCareerTransaction(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const transaction = await employeeService.createCareerTransaction(
        req.params.id as string,
        req.body,
        req.user?.id
      );
      res.status(201).json(Result.created(transaction));
    } catch (error) {
      next(error);
    }
  }

  async findCompanyAssignments(req: Request, res: Response, next: NextFunction) {
    try {
      const items = await employeeService.findCompanyAssignments(req.params.id as string);
      res.json(Result.success(items));
    } catch (error) {
      next(error);
    }
  }

  async createCompanyAssignment(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const assignment = await employeeService.createCompanyAssignment(req.params.id as string, req.body);
      res.status(201).json(Result.created(assignment));
    } catch (error) {
      next(error);
    }
  }

  async updateCompanyAssignment(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const assignment = await employeeService.updateCompanyAssignment(
        req.params.id as string,
        req.params.assignmentId as string,
        req.body
      );
      res.json(Result.updated(assignment));
    } catch (error) {
      next(error);
    }
  }

  async deleteCompanyAssignment(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      await employeeService.deleteCompanyAssignment(
        req.params.id as string,
        req.params.assignmentId as string
      );
      res.json(Result.deleted());
    } catch (error) {
      next(error);
    }
  }

  async importCsv(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = req.body.companyId || req.user?.companyId;
      if (!companyId) {
        res.status(400).json({ success: false, message: 'companyId is required' });
        return;
      }
      if (!req.file) {
        res.status(400).json({ success: false, message: 'CSV file is required' });
        return;
      }
      const result = await employeeService.importCsv(companyId, req.file);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async exportCsv(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = (req.query.companyId as string) || req.user?.companyId;
      if (!companyId) {
        res.status(400).json({ success: false, message: 'companyId is required' });
        return;
      }
      const csv = await employeeService.exportCsv(companyId);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="employees.csv"');
      res.send(csv);
    } catch (error) {
      next(error);
    }
  }

  // ============================================================
  // Employee Family
  // ============================================================
  async findFamilies(req: Request, res: Response, next: NextFunction) {
    try {
      const items = await employeeService.findFamilies(req.params.id as string);
      res.json(Result.success(items));
    } catch (error) { next(error); }
  }

  async createFamily(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const item = await employeeService.createFamily(req.params.id as string, req.body);
      res.status(201).json(Result.created(item));
    } catch (error) { next(error); }
  }

  async updateFamily(req: Request, res: Response, next: NextFunction) {
    try {
      const item = await employeeService.updateFamily(req.params.id as string, req.params.familyId as string, req.body);
      res.json(Result.updated(item));
    } catch (error) { next(error); }
  }

  async deleteFamily(req: Request, res: Response, next: NextFunction) {
    try {
      await employeeService.deleteFamily(req.params.id as string, req.params.familyId as string);
      res.json(Result.deleted());
    } catch (error) { next(error); }
  }

  // ============================================================
  // Employee Education
  // ============================================================
  async findEducations(req: Request, res: Response, next: NextFunction) {
    try {
      const items = await employeeService.findEducations(req.params.id as string);
      res.json(Result.success(items));
    } catch (error) { next(error); }
  }

  async createEducation(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const item = await employeeService.createEducation(req.params.id as string, req.body);
      res.status(201).json(Result.created(item));
    } catch (error) { next(error); }
  }

  async updateEducation(req: Request, res: Response, next: NextFunction) {
    try {
      const item = await employeeService.updateEducation(req.params.id as string, req.params.educationId as string, req.body);
      res.json(Result.updated(item));
    } catch (error) { next(error); }
  }

  async deleteEducation(req: Request, res: Response, next: NextFunction) {
    try {
      await employeeService.deleteEducation(req.params.id as string, req.params.educationId as string);
      res.json(Result.deleted());
    } catch (error) { next(error); }
  }

  // ============================================================
  // Employee Emergency Contact
  // ============================================================
  async findEmergencyContacts(req: Request, res: Response, next: NextFunction) {
    try {
      const items = await employeeService.findEmergencyContacts(req.params.id as string);
      res.json(Result.success(items));
    } catch (error) { next(error); }
  }

  async createEmergencyContact(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const item = await employeeService.createEmergencyContact(req.params.id as string, req.body);
      res.status(201).json(Result.created(item));
    } catch (error) { next(error); }
  }

  async updateEmergencyContact(req: Request, res: Response, next: NextFunction) {
    try {
      const item = await employeeService.updateEmergencyContact(req.params.id as string, req.params.emergencyId as string, req.body);
      res.json(Result.updated(item));
    } catch (error) { next(error); }
  }

  async deleteEmergencyContact(req: Request, res: Response, next: NextFunction) {
    try {
      await employeeService.deleteEmergencyContact(req.params.id as string, req.params.emergencyId as string);
      res.json(Result.deleted());
    } catch (error) { next(error); }
  }

  // ============================================================
  // Employee Training
  // ============================================================
  async findTrainings(req: Request, res: Response, next: NextFunction) {
    try {
      const items = await employeeService.findTrainings(req.params.id as string);
      res.json(Result.success(items));
    } catch (error) { next(error); }
  }

  async createTraining(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const item = await employeeService.createTraining(req.params.id as string, req.body);
      res.status(201).json(Result.created(item));
    } catch (error) { next(error); }
  }

  async updateTraining(req: Request, res: Response, next: NextFunction) {
    try {
      const item = await employeeService.updateTraining(req.params.id as string, req.params.trainingId as string, req.body);
      res.json(Result.updated(item));
    } catch (error) { next(error); }
  }

  async deleteTraining(req: Request, res: Response, next: NextFunction) {
    try {
      await employeeService.deleteTraining(req.params.id as string, req.params.trainingId as string);
      res.json(Result.deleted());
    } catch (error) { next(error); }
  }

  // ============================================================
  // Employee Skill
  // ============================================================
  async findSkills(req: Request, res: Response, next: NextFunction) {
    try {
      const items = await employeeService.findSkills(req.params.id as string);
      res.json(Result.success(items));
    } catch (error) { next(error); }
  }

  async createSkill(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const item = await employeeService.createSkill(req.params.id as string, req.body);
      res.status(201).json(Result.created(item));
    } catch (error) { next(error); }
  }

  async updateSkill(req: Request, res: Response, next: NextFunction) {
    try {
      const item = await employeeService.updateSkill(req.params.id as string, req.params.skillId as string, req.body);
      res.json(Result.updated(item));
    } catch (error) { next(error); }
  }

  async deleteSkill(req: Request, res: Response, next: NextFunction) {
    try {
      await employeeService.deleteSkill(req.params.id as string, req.params.skillId as string);
      res.json(Result.deleted());
    } catch (error) { next(error); }
  }

  // ============================================================
  // Employee Experience
  // ============================================================
  async findExperiences(req: Request, res: Response, next: NextFunction) {
    try {
      const items = await employeeService.findExperiences(req.params.id as string);
      res.json(Result.success(items));
    } catch (error) { next(error); }
  }

  async createExperience(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const item = await employeeService.createExperience(req.params.id as string, req.body);
      res.status(201).json(Result.created(item));
    } catch (error) { next(error); }
  }

  async updateExperience(req: Request, res: Response, next: NextFunction) {
    try {
      const item = await employeeService.updateExperience(req.params.id as string, req.params.experienceId as string, req.body);
      res.json(Result.updated(item));
    } catch (error) { next(error); }
  }

  async deleteExperience(req: Request, res: Response, next: NextFunction) {
    try {
      await employeeService.deleteExperience(req.params.id as string, req.params.experienceId as string);
      res.json(Result.deleted());
    } catch (error) { next(error); }
  }

  // ============================================================
  // Employee Attachment
  // ============================================================
  async findAttachments(req: Request, res: Response, next: NextFunction) {
    try {
      const category = req.query.category as string | undefined;
      const items = await employeeService.findAttachments(req.params.id as string, category);
      res.json(Result.success(items));
    } catch (error) { next(error); }
  }

  async createAttachment(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const item = await employeeService.createAttachment(req.params.id as string, req.body);
      res.status(201).json(Result.created(item));
    } catch (error) { next(error); }
  }

  async updateAttachment(req: Request, res: Response, next: NextFunction) {
    try {
      const item = await employeeService.updateAttachment(req.params.id as string, req.params.attachmentId as string, req.body);
      res.json(Result.updated(item));
    } catch (error) { next(error); }
  }

  async deleteAttachment(req: Request, res: Response, next: NextFunction) {
    try {
      await employeeService.deleteAttachment(req.params.id as string, req.params.attachmentId as string);
      res.json(Result.deleted());
    } catch (error) { next(error); }
  }
}

export const employeeController = new EmployeeController();
