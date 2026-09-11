import { recruitmentRepository } from './recruitment.repository';
import { CreateJobPostingDTO, CreateCandidateDTO, CreateApplicationDTO, UpdateApplicationStatusDTO, CreateInterviewDTO, CreateInterviewFeedbackDTO } from './recruitment.dto';
import { NotFoundError, BadRequestError, ConflictError } from '@/shared/exceptions/AppError';
import { logger } from '@/shared/logger/WinstonLogger';
import { generateSystemCode } from '@/shared/utils/system-code';
import { employeeService } from '@/modules/employee/employee.service';
import prisma from '@/shared/database/prisma';
import { withDatabaseAdvisoryLock } from '@/shared/database/advisory-lock';

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
    // Normalize identity fields and block obvious duplicates (checklist §25).
    if (data.email) {
      data.email = data.email.trim().toLowerCase();
      const duplicate = await prisma.candidate.findFirst({
        where: { companyId: data.companyId, email: data.email, deletedAt: null },
        select: { id: true, status: true },
      });
      if (duplicate) {
        throw new ConflictError('Kandidat dengan email ini sudah terdaftar');
      }
    }
    if (data.phone) data.phone = data.phone.replace(/[\s-]/g, '');
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

  /** State machine (checklist §24): allowed transitions per current status. */
  private static readonly APPLICATION_TRANSITIONS: Record<string, string[]> = {
    NEW: ['SCREENING', 'REJECTED', 'WITHDRAWN'],
    SCREENING: ['INTERVIEW', 'REJECTED', 'WITHDRAWN'],
    INTERVIEW: ['OFFER', 'REJECTED', 'WITHDRAWN'],
    OFFER: ['HIRED', 'REJECTED', 'WITHDRAWN'],
    REJECTED: ['SCREENING'], // reopen — requires a reason
    WITHDRAWN: [],
    HIRED: [],
  };

  async updateApplicationStatus(id: string, data: UpdateApplicationStatusDTO) {
    const application = await recruitmentRepository.findApplicationWithCandidate(id);
    if (!application) throw new NotFoundError('Application not found');

    const allowed = RecruitmentService.APPLICATION_TRANSITIONS[application.status] ?? [];
    if (!allowed.includes(data.status)) {
      throw new BadRequestError(`Transisi status ${application.status} -> ${data.status} tidak diizinkan`);
    }
    if (application.status === 'REJECTED' && !data.notes?.trim()) {
      throw new BadRequestError('Membuka kembali lamaran yang ditolak wajib menyertakan alasan');
    }

    if (data.status === 'HIRED') {
      return this.hireApplication(id, data.notes);
    }
    return recruitmentRepository.updateApplicationStatus(id, data.status as any, data.notes, [application.status]);
  }

  /**
   * Hire transaction (checklist §28). Serialized per application by an
   * advisory lock; retry-safe via hiredEmployeeId; carries the posting's
   * department/position/employment type instead of hardcoding them; the
   * employee is deleted (compensation) when any later step fails.
   */
  async hireApplication(id: string, notes?: string) {
    return withDatabaseAdvisoryLock('hire-application', id, async () => {
      const application = await recruitmentRepository.findApplicationWithCandidate(id);
      if (!application) throw new NotFoundError('Application not found');
      if (application.status === 'HIRED' || application.hiredEmployeeId) {
        throw new ConflictError('Lamaran sudah berstatus HIRED');
      }
      if (application.status !== 'OFFER') {
        throw new BadRequestError('Hanya lamaran berstatus OFFER yang dapat di-hire (checklist state machine)');
      }

      const c = application.candidate;
      const posting = application.jobPosting;

      const employee = await employeeService.create({
        companyId: application.companyId,
        firstName: c.firstName,
        lastName: c.lastName,
        email: c.email ?? undefined,
        phone: c.phone ?? undefined,
        departmentId: posting?.departmentId ?? undefined,
        positionId: posting?.positionId ?? undefined,
        joinDate: new Date().toISOString(),
        employmentType: 'PROBATION',
        // ponytail: postings carry no employee category; OFFICE is the safe
        // default because FACTORY requires a shift formula the posting lacks.
        employeeCategory: 'OFFICE',
        nationality: 'Indonesia',
      } as any);

      try {
        await recruitmentRepository.generateOnboardingChecklists(application.companyId, employee.id);
        const updated = await prisma.jobApplication.updateMany({
          where: { id, status: 'OFFER', hiredEmployeeId: null },
          data: {
            status: 'HIRED',
            hiredEmployeeId: employee.id,
            ...(notes ? { notes } : {}),
          },
        });
        if (updated.count !== 1) {
          throw new ConflictError('Application status changed during hire; rolled back');
        }
      } catch (err) {
        // Compensation: an employee without a HIRED application is a duplicate
        // waiting to happen on retry — remove it and surface the error.
        await prisma.onboardingChecklist.deleteMany({ where: { employeeId: employee.id } }).catch(() => undefined);
        await prisma.employee.delete({ where: { id: employee.id } }).catch(() => undefined);
        throw err;
      }

      logger.info('Candidate hired → employee + onboarding created', {
        applicationId: id,
        candidateId: c.id,
        employeeId: employee.id,
      });

      const refreshed = await recruitmentRepository.findApplicationWithCandidate(id);
      return { application: refreshed, employee, onboardingChecklistGenerated: true };
    });
  }

  async findAllInterviews(companyId: string) {
    return recruitmentRepository.findAllInterviews(companyId);
  }

  async createInterview(data: CreateInterviewDTO) {
    // The application must be in an interviewable state and the candidate
    // must actually belong to it (both ids arrive separately from the body).
    const application = await recruitmentRepository.findApplicationWithCandidate(data.applicationId);
    if (!application) throw new NotFoundError('Application not found');
    if (!['SCREENING', 'INTERVIEW'].includes(application.status)) {
      throw new BadRequestError(`Interview tidak dapat dijadwalkan untuk lamaran berstatus ${application.status}`);
    }
    if (application.candidateId !== data.candidateId) {
      throw new BadRequestError('Kandidat tidak sesuai dengan lamaran ini');
    }
    return recruitmentRepository.createInterview(data);
  }

  async submitFeedback(interviewId: string, data: CreateInterviewFeedbackDTO) {
    // Interview is tenant-scoped by the Prisma middleware; a foreign
    // interview id resolves to null so feedback cannot cross tenants.
    const interview = await recruitmentRepository.findInterviewById(interviewId);
    if (!interview) throw new NotFoundError('Interview not found');
    return recruitmentRepository.createInterviewFeedback(interviewId, data);
  }
}

export const recruitmentService = new RecruitmentService();
