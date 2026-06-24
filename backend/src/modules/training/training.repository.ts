import { prisma } from '@/shared/database/prisma';
import { Prisma } from '@prisma/client';
import { CreateCategoryDTO, CreateCourseDTO, UpdateCourseDTO, CreateSessionDTO, CreateEnrollmentDTO } from './training.dto';

export class TrainingRepository {
  async findAllCategories(companyId: string) {
    return prisma.trainingCategory.findMany({ where: { companyId, deletedAt: null }, orderBy: { name: 'asc' } });
  }

  async createCategory(data: CreateCategoryDTO) {
    return prisma.trainingCategory.create({ data });
  }

  async findAllCourses(companyId: string, categoryId?: string) {
    const where: Prisma.TrainingCourseWhereInput = { companyId, deletedAt: null };
    if (categoryId) where.categoryId = categoryId;
    return prisma.trainingCourse.findMany({ where, include: { category: { select: { id: true, name: true } }, _count: { select: { enrollments: true, sessions: true } } }, orderBy: { title: 'asc' } });
  }

  async findCourseById(id: string) {
    return prisma.trainingCourse.findFirst({ where: { id, deletedAt: null }, include: { category: true, materials: { orderBy: { sortOrder: 'asc' } }, sessions: { where: { deletedAt: null }, orderBy: { startDate: 'desc' } }, enrollments: { where: { deletedAt: null }, include: { employee: { select: { id: true, fullName: true, employeeNumber: true } } } } } });
  }

  async createCourse(data: CreateCourseDTO) {
    return prisma.trainingCourse.create({ data });
  }

  async updateCourse(id: string, data: UpdateCourseDTO) {
    const update: Prisma.TrainingCourseUpdateInput = {};
    if (data.title !== undefined) update.title = data.title;
    if (data.description !== undefined) update.description = data.description;
    if (data.duration !== undefined) update.duration = data.duration;
    if (data.durationUnit !== undefined) update.durationUnit = data.durationUnit;
    if (data.isMandatory !== undefined) update.isMandatory = data.isMandatory;
    if (data.isActive !== undefined) update.isActive = data.isActive;
    if (data.categoryId !== undefined) update.category = { connect: { id: data.categoryId } };
    return prisma.trainingCourse.update({ where: { id }, data: update });
  }

  async findAllSessions(courseId?: string) {
    const where: Prisma.TrainingSessionWhereInput = { deletedAt: null };
    if (courseId) where.courseId = courseId;
    return prisma.trainingSession.findMany({ where, include: { course: { select: { id: true, title: true, code: true } }, _count: { select: { attendances: true } } }, orderBy: { startDate: 'desc' } });
  }

  async createSession(data: CreateSessionDTO) {
    return prisma.trainingSession.create({ data: { ...data, startDate: new Date(data.startDate), endDate: data.endDate ? new Date(data.endDate) : undefined } });
  }

  async findAllEnrollments(companyId: string, employeeId?: string) {
    const where: Prisma.TrainingEnrollmentWhereInput = { companyId, deletedAt: null };
    if (employeeId) where.employeeId = employeeId;
    return prisma.trainingEnrollment.findMany({ where, include: { course: { select: { id: true, title: true, code: true } }, employee: { select: { id: true, fullName: true, employeeNumber: true } } }, orderBy: { createdAt: 'desc' } });
  }

  async createEnrollment(data: CreateEnrollmentDTO) {
    return prisma.trainingEnrollment.create({ data });
  }

  async updateEnrollment(id: string, data: { status?: any; progress?: number; notes?: string }) {
    return prisma.trainingEnrollment.update({ where: { id }, data });
  }
}

export const trainingRepository = new TrainingRepository();
