import { trainingRepository } from './training.repository';
import { CreateCategoryDTO, CreateCourseDTO, UpdateCourseDTO, CreateSessionDTO, CreateEnrollmentDTO, UpdateEnrollmentDTO } from './training.dto';
import { NotFoundError, ConflictError } from '@/shared/exceptions/AppError';
import { logger } from '@/shared/logger/WinstonLogger';

export class TrainingService {
  async findAllCategories(companyId: string) {
    return trainingRepository.findAllCategories(companyId);
  }

  async createCategory(data: CreateCategoryDTO) {
    return trainingRepository.createCategory(data);
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
    return trainingRepository.createCourse(data);
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

  async completeEnrollment(id: string) {
    return trainingRepository.updateEnrollment(id, { status: 'COMPLETED' as any, progress: 100, notes: 'Completed' });
  }
}

export const trainingService = new TrainingService();
