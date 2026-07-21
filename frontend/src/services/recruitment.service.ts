import api from './api';

export interface JobPosting {
  id: string; title: string; code: string; employmentType: string; location?: string; vacancies: number; status: string;
  minSalary?: number; maxSalary?: number; description?: string; requirements?: string;
  department?: { id: string; name: string };
  position?: { id: string; name: string };
  postedAt?: string; closedAt?: string; createdAt: string;
  _count?: { applications: number };
}

export interface Candidate {
  id: string; firstName: string; lastName: string; email?: string; phone?: string; currentCompany?: string;
  currentPosition?: string; source?: string; status: string;
}

export interface JobApplication {
  id: string; jobPostingId: string; candidateId: string; status: string; appliedAt: string;
  candidate?: { id: string; firstName: string; lastName: string; email: string };
  jobPosting?: { id: string; title: string; code: string };
}

export interface Interview {
  id: string; title: string; type: string; scheduledAt: string; status: string; location?: string; meetingLink?: string;
  durationMinutes?: number;
  candidate?: { id: string; firstName: string; lastName: string };
  application?: { id: string; jobPosting?: { title: string } };
}

export interface InterviewPayload {
  applicationId: string;
  candidateId: string;
  interviewerId?: string;
  companyId: string;
  type: string;
  title: string;
  scheduledAt: string;
  durationMinutes?: number;
  location?: string;
  meetingLink?: string;
  notes?: string;
}

export interface JobPostingPayload {
  companyId: string;
  departmentId?: string;
  positionId?: string;
  title: string;
  code: string;
  employmentType: string;
  location?: string;
  minSalary?: number;
  maxSalary?: number;
  currency?: string;
  description?: string;
  requirements?: string;
  responsibilities?: string;
  vacancies: number;
}

export interface CandidatePayload {
  companyId: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  currentCompany?: string;
  currentPosition?: string;
  source?: string;
  notes?: string;
}

export interface JobApplicationPayload {
  jobPostingId: string;
  candidateId: string;
  companyId: string;
  coverLetter?: string;
  expectedSalary?: number;
  notes?: string;
}

class RecruitmentService {
  async getJobPostings(companyId: string, status?: string): Promise<JobPosting[]> {
    const r = await api.get('/recruitment/job-postings', { params: { companyId, status } }); return r.data.data;
  }
  async getJobPosting(id: string): Promise<JobPosting> {
    const r = await api.get(`/recruitment/job-postings/${id}`); return r.data.data;
  }
  async createJobPosting(data: JobPostingPayload): Promise<JobPosting> {
    const r = await api.post('/recruitment/job-postings', data); return r.data.data;
  }
  async approveJobPosting(id: string): Promise<JobPosting> {
    const r = await api.patch(`/recruitment/job-postings/${id}/approve`); return r.data.data;
  }
  async closeJobPosting(id: string): Promise<JobPosting> {
    const r = await api.patch(`/recruitment/job-postings/${id}/close`); return r.data.data;
  }
  async getCandidates(companyId: string): Promise<Candidate[]> {
    const r = await api.get('/recruitment/candidates', { params: { companyId } }); return r.data.data;
  }
  async getCandidate(id: string): Promise<Candidate> {
    const r = await api.get(`/recruitment/candidates/${id}`); return r.data.data;
  }
  async createCandidate(data: CandidatePayload): Promise<Candidate> {
    const r = await api.post('/recruitment/candidates', data); return r.data.data;
  }
  async getApplications(companyId: string, jobPostingId?: string): Promise<JobApplication[]> {
    const r = await api.get('/recruitment/applications', { params: { companyId, jobPostingId } }); return r.data.data;
  }
  async createApplication(data: JobApplicationPayload): Promise<JobApplication> {
    const r = await api.post('/recruitment/applications', data); return r.data.data;
  }
  async updateApplicationStatus(id: string, status: string, notes?: string): Promise<JobApplication> {
    const r = await api.patch(`/recruitment/applications/${id}/status`, { status, notes }); return r.data.data;
  }
  async getInterviews(companyId: string): Promise<Interview[]> {
    const r = await api.get('/recruitment/interviews', { params: { companyId } }); return r.data.data;
  }
  async createInterview(data: InterviewPayload): Promise<Interview> {
    const r = await api.post('/recruitment/interviews', data); return r.data.data;
  }
}

export const recruitmentService = new RecruitmentService();
