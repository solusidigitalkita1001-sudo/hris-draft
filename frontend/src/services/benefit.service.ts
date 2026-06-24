import api from './api';

export interface BenefitPlan {
  id: string;
  companyId: string;
  name: string;
  code: string;
  type: string;
  description?: string;
  provider?: string;
  isTaxable: boolean;
  employeeContribution: number;
  employerContribution: number;
  maxAmount?: number;
  isActive: boolean;
  effectiveDate?: string;
  expiryDate?: string;
  _count?: { enrollments: number };
  enrollments?: BenefitEnrollment[];
  createdAt: string;
}

export interface BenefitEnrollment {
  id: string;
  benefitPlanId: string;
  employeeId: string;
  companyId: string;
  enrollmentDate: string;
  effectiveDate: string;
  expiryDate?: string;
  status: string;
  coverageDetails?: string;
  benefitPlan?: { id: string; name: string; type: string; code: string };
  employee?: { id: string; fullName: string; employeeNumber: string };
  createdAt: string;
}

class BenefitService {
  // Plans
  async getPlans(companyId: string): Promise<BenefitPlan[]> {
    const response = await api.get('/benefits/plans', { params: { companyId } });
    return response.data.data;
  }

  async getPlan(id: string): Promise<BenefitPlan> {
    const response = await api.get(`/benefits/plans/${id}`);
    return response.data.data;
  }

  async createPlan(data: Partial<BenefitPlan>): Promise<BenefitPlan> {
    const response = await api.post('/benefits/plans', data);
    return response.data.data;
  }

  async updatePlan(id: string, data: Partial<BenefitPlan>): Promise<BenefitPlan> {
    const response = await api.patch(`/benefits/plans/${id}`, data);
    return response.data.data;
  }

  async deletePlan(id: string): Promise<void> {
    await api.delete(`/benefits/plans/${id}`);
  }

  // Enrollments
  async getEnrollments(companyId: string, employeeId?: string): Promise<BenefitEnrollment[]> {
    const params: Record<string, string> = { companyId };
    if (employeeId) params.employeeId = employeeId;
    const response = await api.get('/benefits/enrollments', { params });
    return response.data.data;
  }

  async createEnrollment(data: Partial<BenefitEnrollment>): Promise<BenefitEnrollment> {
    const response = await api.post('/benefits/enrollments', data);
    return response.data.data;
  }

  async updateEnrollment(id: string, data: Partial<BenefitEnrollment>): Promise<BenefitEnrollment> {
    const response = await api.patch(`/benefits/enrollments/${id}`, data);
    return response.data.data;
  }

  async cancelEnrollment(id: string): Promise<void> {
    await api.delete(`/benefits/enrollments/${id}`);
  }
}

export const benefitService = new BenefitService();
