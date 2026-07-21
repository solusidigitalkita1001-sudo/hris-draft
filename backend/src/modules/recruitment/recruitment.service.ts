import { recruitmentRepository } from './recruitment.repository';
import { CreateJobPostingDTO, CreateCandidateDTO, CreateApplicationDTO, UpdateApplicationStatusDTO, CreateInterviewDTO, CreateInterviewFeedbackDTO } from './recruitment.dto';
import { NotFoundError, BadRequestError, ConflictError } from '@/shared/exceptions/AppError';
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
    if (data.minSalary !== undefined && data.maxSalary !== undefined && data.maxSalary < data.minSalary) {
      throw new BadRequestError('Maximum salary must be greater than or equal to minimum salary');
    }

    if (data.departmentId) {
      const department = await recruitmentRepository.findDepartmentScoped(data.departmentId, data.companyId);
      if (!department) {
        throw new BadRequestError('Department does not belong to the selected company');
      }
    }

    if (data.positionId) {
      const position = await recruitmentRepository.findPositionScoped(data.positionId, data.companyId);
      if (!position) {
        throw new BadRequestError('Position does not belong to the selected company');
      }
    }

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
    const [posting, candidate, existing] = await Promise.all([
      recruitmentRepository.findJobPostingScoped(data.jobPostingId, data.companyId),
      recruitmentRepository.findCandidateScoped(data.candidateId, data.companyId),
      recruitmentRepository.findApplicationByPostingAndCandidate(data.companyId, data.jobPostingId, data.candidateId),
    ]);

    if (!posting) {
      throw new NotFoundError('Job posting not found');
    }

    if (!candidate) {
      throw new NotFoundError('Candidate not found');
    }

    if (!['PUBLISHED', 'ON_HOLD'].includes(posting.status)) {
      throw new BadRequestError('Application can only be created for published or on-hold job postings');
    }

    if (existing) {
      throw new ConflictError('Candidate has already applied to this job posting');
    }

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
