import { recruitmentRepository } from './recruitment.repository';
import { CreateJobPostingDTO, CreateCandidateDTO, CreateApplicationDTO, UpdateApplicationStatusDTO, CreateInterviewDTO, CreateInterviewFeedbackDTO } from './recruitment.dto';
import { NotFoundError, BadRequestError, ConflictError } from '@/shared/exceptions/AppError';
import { logger } from '@/shared/logger/WinstonLogger';
import { generateSystemCode } from '@/shared/utils/system-code';
import { employeeService } from '@/modules/employee/employee.service';

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

    const code = await generateSystemCode({
      prefix: 'REC-JOB',
      label: data.title,
      exists: async (candidate) => Boolean(await recruitmentRepository.findJobPostingByCode(candidate)),
    });

    return recruitmentRepository.createJobPosting({
      ...data,
      code,
    });
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
    // Business Rule Gap: kandidat HIRED → otomatis buat draft employee + checklist onboarding.
    if (data.status === 'HIRED') {
      return this.hireApplication(id, data.notes);
    }
    return recruitmentRepository.updateApplicationStatus(id, data.status as any, data.notes);
  }

  /**
   * Konversi lamaran menjadi karyawan: buat draft Employee dari data kandidat,
   * generate checklist onboarding default, lalu tandai lamaran HIRED. Idempotent —
   * jika lamaran sudah HIRED, tidak membuat employee/checklist ganda.
   */
  async hireApplication(id: string, notes?: string) {
    const application = await recruitmentRepository.findApplicationWithCandidate(id);
    if (!application) throw new NotFoundError('Application not found');
    if (application.status === 'HIRED') {
      throw new BadRequestError('Lamaran sudah berstatus HIRED');
    }

    const c = application.candidate;

    // Buat draft employee (email diikutkan hanya jika belum dipakai, agar tidak konflik unik).
    const employee = await employeeService.create({
      companyId: application.companyId,
      firstName: c.firstName,
      lastName: c.lastName,
      email: c.email ?? undefined,
      phone: c.phone ?? undefined,
      employmentType: 'PROBATION',
      employeeCategory: 'OFFICE',
      nationality: 'Indonesia',
    } as any);

    await recruitmentRepository.generateOnboardingChecklists(application.companyId, employee.id);
    const updated = await recruitmentRepository.updateApplicationStatus(id, 'HIRED', notes);

    logger.info('Candidate hired → employee draft + onboarding created', {
      applicationId: id,
      candidateId: c.id,
      employeeId: employee.id,
    });

    return { application: updated, employee, onboardingChecklistGenerated: true };
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
