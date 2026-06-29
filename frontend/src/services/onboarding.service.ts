import api from './api';

export interface Resignation {
  id: string; employeeId: string; companyId: string;
  resignDate: string; lastWorkingDate: string; reason?: string;
  status: string; approvedBy?: string; approvedAt?: string; createdAt: string;
  employee?: { id: string; fullName: string; employeeNumber: string; department?: { name: string }; position?: { name: string } };
  clearances?: ExitClearance[];
}

export interface ExitClearance {
  id: string; resignationId: string; department: string; checklistItem: string;
  status: string; notes?: string; clearedAt?: string;
  pic?: { id: string; fullName: string };
}

class OnboardingService {
  async getResignations(companyId: string, status?: string): Promise<Resignation[]> {
    const r = await api.get('/onboarding/resignations', { params: { companyId, status } }); return r.data.data;
  }
  async getResignation(id: string): Promise<Resignation> {
    const r = await api.get(`/onboarding/resignations/${id}`); return r.data.data;
  }
  async createResignation(data: any): Promise<Resignation> {
    const r = await api.post('/onboarding/resignations', data); return r.data.data;
  }
  async approveResignation(id: string): Promise<Resignation> {
    const r = await api.patch(`/onboarding/resignations/${id}/approve`); return r.data.data;
  }
  async rejectResignation(id: string): Promise<Resignation> {
    const r = await api.patch(`/onboarding/resignations/${id}/reject`); return r.data.data;
  }
  async completeResignation(id: string): Promise<Resignation> {
    const r = await api.patch(`/onboarding/resignations/${id}/complete`); return r.data.data;
  }
  async updateClearance(id: string, status: string, notes?: string): Promise<ExitClearance> {
    const r = await api.patch(`/onboarding/clearances/${id}`, { status, notes }); return r.data.data;
  }
}
export const onboardingService = new OnboardingService();
