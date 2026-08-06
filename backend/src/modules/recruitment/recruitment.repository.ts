import { prisma } from '@/shared/database/prisma';
import { Prisma } from '@prisma/client';
import { CreateJobPostingDTO, CreateCandidateDTO, CreateApplicationDTO, CreateInterviewDTO } from './recruitment.dto';

export class RecruitmentRepository {
  async findAllJobPostings(companyId: string, status?: string) {
    const where: Prisma.JobPostingWhereInput = { companyId, deletedAt: null };
    if (status) where.status = status as any;
    return prisma.jobPosting.findMany({ where, include: { department: { select: { id: true, name: true } }, position: { select: { id: true, name: true } }, _count: { select: { applications: true } } }, orderBy: { createdAt: 'desc' } });
  }

  async findJobPostingById(id: string) {
    return prisma.jobPosting.findFirst({ where: { id, deletedAt: null }, include: { department: true, position: true, applications: { include: { candidate: { select: { id: true, firstName: true, lastName: true, email: true, currentPosition: true } }, interviews: { include: { feedback: true } } } } } });
  }

  async findJobPostingByCode(code: string) {
    return prisma.jobPosting.findUnique({ where: { code } });
  }

  async findJobPostingScoped(id: string, companyId: string) {
    return prisma.jobPosting.findFirst({
      where: { id, companyId, deletedAt: null },
    });
  }

  async createJobPosting(data: CreateJobPostingDTO & { code: string }) {
    return prisma.jobPosting.create({ data: { ...data, minSalary: data.minSalary, maxSalary: data.maxSalary } });
  }

  async updateJobPosting(id: string, data: Prisma.JobPostingUpdateInput) {
    return prisma.jobPosting.update({ where: { id }, data });
  }

  async findAllCandidates(companyId: string) {
    return prisma.candidate.findMany({ where: { companyId, deletedAt: null }, include: { _count: { select: { applications: true, interviews: true } } }, orderBy: { createdAt: 'desc' } });
  }

  async findCandidateById(id: string) {
    return prisma.candidate.findFirst({ where: { id, deletedAt: null }, include: { applications: { include: { jobPosting: { select: { id: true, title: true } }, interviews: { include: { feedback: true } } } } } });
  }

  async findCandidateScoped(id: string, companyId: string) {
    return prisma.candidate.findFirst({
      where: { id, companyId, deletedAt: null },
    });
  }

  async findDepartmentScoped(id: string, companyId: string) {
    return prisma.department.findFirst({
      where: { id, companyId, deletedAt: null },
      select: { id: true },
    });
  }

  async findPositionScoped(id: string, companyId: string) {
    return prisma.position.findFirst({
      where: { id, companyId, deletedAt: null },
      select: { id: true },
    });
  }

  async createCandidate(data: CreateCandidateDTO) {
    return prisma.candidate.create({ data });
  }

  async findAllApplications(companyId: string, jobPostingId?: string) {
    const where: Prisma.JobApplicationWhereInput = { companyId, deletedAt: null };
    if (jobPostingId) where.jobPostingId = jobPostingId;
    return prisma.jobApplication.findMany({ where, include: { candidate: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } }, jobPosting: { select: { id: true, title: true, code: true } }, interviews: { orderBy: { scheduledAt: 'desc' } } }, orderBy: { appliedAt: 'desc' } });
  }

  async createApplication(data: CreateApplicationDTO) {
    return prisma.jobApplication.create({ data });
  }

  async findApplicationByPostingAndCandidate(companyId: string, jobPostingId: string, candidateId: string) {
    return prisma.jobApplication.findFirst({
      where: {
        companyId,
        jobPostingId,
        candidateId,
        deletedAt: null,
      },
      select: { id: true },
    });
  }

  async updateApplicationStatus(id: string, status: any, notes?: string) {
    const data: Prisma.JobApplicationUpdateInput = { status: status as any };
    if (notes) data.notes = notes;
    return prisma.jobApplication.update({ where: { id }, data });
  }

  async findAllInterviews(companyId: string) {
    return prisma.interview.findMany({ where: { companyId, deletedAt: null }, include: { candidate: { select: { id: true, firstName: true, lastName: true } }, application: { select: { id: true, jobPosting: { select: { title: true } } } }, feedback: true }, orderBy: { scheduledAt: 'desc' } });
  }

  async createInterview(data: CreateInterviewDTO) {
    return prisma.interview.create({ data: { ...data, scheduledAt: new Date(data.scheduledAt) } });
  }

  async createInterviewFeedback(interviewId: string, data: { rating?: number; strengths?: string; weaknesses?: string; decision?: string; notes?: string }) {
    return prisma.interviewFeedback.create({ data: { ...data, interviewId } });
  }
}

export const recruitmentRepository = new RecruitmentRepository();
