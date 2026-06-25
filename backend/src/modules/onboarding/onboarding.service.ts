import { onboardingRepository } from './onboarding.repository';
import { CreateChecklistDTO, UpdateChecklistDTO, CreateResignationDTO } from './onboarding.dto';
import { NotFoundError } from '@/shared/exceptions/AppError';
import { logger } from '@/shared/logger/WinstonLogger';

export class OnboardingService {
  async getChecklists(employeeId: string) {
    return onboardingRepository.findChecklistsByEmployee(employeeId);
  }

  async createChecklist(data: CreateChecklistDTO) {
    return onboardingRepository.createChecklist(data);
  }

  async updateChecklist(id: string, data: UpdateChecklistDTO) {
    return onboardingRepository.updateChecklist(id, data);
  }

  async findAllResignations(companyId: string, status?: string) {
    return onboardingRepository.findAllResignations(companyId, status);
  }

  async findResignationById(id: string) {
    const resignation = await onboardingRepository.findResignationById(id);
    if (!resignation) throw new NotFoundError('Resignation not found');
    return resignation;
  }

  async createResignation(data: CreateResignationDTO) {
    const resignation = await onboardingRepository.createResignation(data);
    // Auto-generate exit clearances
    await onboardingRepository.generateClearances(resignation.id, data.employeeId);
    logger.info('Resignation created with clearances', { employeeId: data.employeeId });
    return this.findResignationById(resignation.id);
  }

  async approveResignation(id: string, userId: string) {
    await this.findResignationById(id);
    return onboardingRepository.updateResignationStatus(id, 'APPROVED', userId);
  }

  async rejectResignation(id: string) {
    await this.findResignationById(id);
    return onboardingRepository.updateResignationStatus(id, 'REJECTED');
  }

  async updateClearance(id: string, status: string, notes?: string) {
    return onboardingRepository.updateClearance(id, status, notes);
  }
}

export const onboardingService = new OnboardingService();
