import { recruitmentRepository } from './recruitment.repository';
import { CreateJobPostingDTO, CreateCandidateDTO, CreateApplicationDTO, UpdateApplicationStatusDTO, CreateInterviewDTO, CreateInterviewFeedbackDTO } from './recruitment.dto';
import { NotFoundError, BadRequestError } from '@/shared/exceptions/AppError';
import { logger } from '@/shared/logger/WinstonLogger';

export class RecruitmentService {
  async findAllJobPostings(companyId: string, status?: string) {
    return recruitmentRepository.findAllJobPostings(companyId, status);
  }

  async findJobPostingById(id: string) {
    const posting = await recruitmentRepository.findJobPostingById(id);
    if (!posting) throw new NotFoundError('Job posting not found');
    return posting;
  }

  async createJobPosting(data: CreateJobPostingDTO) {
    return recruitmentRepository.createJobPosting(data);
  }

  async approveJobPosting(id: string) {
    await this.findJobPostingById(id);
    return recruitmentRepository.updateJobPosting(id, { status: 'PUBLISHED' as any, postedAt: new Date() });
  }

  async closeJobPosting(id: string) {
    await this.findJobPostingById(id);
    return recruitmentRepository.updateJobPosting(id, { status: 'CLOSED' as any, closedAt: new Date() });
  }

  async findAllCandidates(companyId: string) {
    return recruitmentRepository.findAllCandidates(companyId);
  }

  async findCandidateById(id: string) {
    const candidate = await recruitmentRepository.findCandidateById(id);
    if (!candidate) throw new NotFoundError('Candidate not found');
    return candidate;
  }

  async createCandidate(data: CreateCandidateDTO) {
    return recruitmentRepository.createCandidate(data);
  }

  async findAllApplications(companyId: string, jobPostingId?: string) {
    return recruitmentRepository.findAllApplications(companyId, jobPostingId);
  }

  async createApplication(data: CreateApplicationDTO) {
    return recruitmentRepository.createApplication(data);
  }

  async updateApplicationStatus(id: string, data: UpdateApplicationStatusDTO) {
    return recruitmentRepository.updateApplicationStatus(id, data.status as any, data.notes);
  }

  async findAllInterviews(companyId: string) {
    return recruitmentRepository.findAllInterviews(companyId);
  }

  async createInterview(data: CreateInterviewDTO) {
    return recruitmentRepository.createInterview(data);
  }

  async submitFeedback(interviewId: string, data: CreateInterviewFeedbackDTO) {
    return recruitmentRepository.createInterviewFeedback(interviewId, data);
  }
}

export const recruitmentService = new RecruitmentService();
