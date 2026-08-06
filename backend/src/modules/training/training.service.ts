import { trainingRepository } from './training.repository';
import { CreateCategoryDTO, CreateCourseDTO, UpdateCourseDTO, CreateSessionDTO, CreateEnrollmentDTO, UpdateEnrollmentDTO } from './training.dto';
import { NotFoundError, ConflictError } from '@/shared/exceptions/AppError';
import { logger } from '@/shared/logger/WinstonLogger';
import { generateSystemCode } from '@/shared/utils/system-code';

export class TrainingService {
  async findAllCategories(companyId: string) {
    return trainingRepository.findAllCategories(companyId);
  }

  async createCategory(data: CreateCategoryDTO) {
    const code = await generateSystemCode({
      prefix: 'TRN-CAT',
      label: data.name,
      exists: async (candidate) => Boolean(await trainingRepository.findCategoryByCode(candidate)),
    });

    return trainingRepository.createCategory({
      ...data,
      code,
    });
  }

  async findAllCourses(companyId: string, categoryId?: string) {
    return trainingRepository.findAllCourses(companyId, categoryId);
  }

  async findCourseById(id: string) {
    const course = await trainingRepository.findCourseById(id);
    if (!course) throw new NotFoundError('Course not found');
    return course;
  }

  async createCourse(data: CreateCourseDTO) {
    const code = await generateSystemCode({
      prefix: 'TRN-CRS',
      label: data.title,
      exists: async (candidate) => Boolean(await trainingRepository.findCourseByCode(candidate)),
    });

    return trainingRepository.createCourse({
      ...data,
      code,
    });
  }

  async updateCourse(id: string, data: UpdateCourseDTO) {
    await this.findCourseById(id);
    return trainingRepository.updateCourse(id, data);
  }

  async findAllSessions(courseId?: string) {
    return trainingRepository.findAllSessions(courseId);
  }

  async createSession(data: CreateSessionDTO) {
    return trainingRepository.createSession(data);
  }

  async findAllEnrollments(companyId: string, employeeId?: string) {
    return trainingRepository.findAllEnrollments(companyId, employeeId);
  }

  async createEnrollment(data: CreateEnrollmentDTO) {
    return trainingRepository.createEnrollment(data);
  }

  async enrollSelf(courseId: string, employeeId: string, companyId: string) {
    await this.findCourseById(courseId);

    const existing = await trainingRepository.findActiveEnrollment(courseId, employeeId, companyId);
    if (existing) {
      throw new ConflictError('You are already enrolled in this course');
    }

    return trainingRepository.createEnrollment({
      courseId,
      employeeId,
      companyId,
    });
  }

  async completeEnrollment(id: string) {
    return trainingRepository.updateEnrollment(id, { status: 'COMPLETED' as any, progress: 100, notes: 'Completed' });
  }

  async completeSelf(courseId: string, employeeId: string, companyId: string) {
    await this.findCourseById(courseId);

    const enrollment = await trainingRepository.findActiveEnrollment(courseId, employeeId, companyId);
    if (!enrollment) {
      throw new NotFoundError('Enrollment not found');
    }

    if (enrollment.status === 'COMPLETED') {
      return enrollment;
    }

    return trainingRepository.updateEnrollment(enrollment.id, {
      status: 'COMPLETED' as any,
      progress: 100,
      notes: 'Completed',
    });
  }
}

export const trainingService = new TrainingService();
