import api from './api';

export interface ReviewCycle {
  id: string; name: string; code: string; type: string; startDate: string; endDate: string; status: string; _count?: { reviews: number };
}

export interface PerformanceReview {
  id: string; cycleId: string; employeeId: string; title: string; type: string; status: string; overallScore?: number;
  submittedAt?: string; createdAt: string;
  employee?: { id: string; fullName: string; employeeNumber: string };
  cycle?: { id: string; name: string };
}

export interface Goal {
  id: string; employeeId: string; title: string; type: string; progress: number; status: string; priority: string;
  startDate: string; endDate?: string; employee?: { id: string; fullName: string };
}

class PerformanceService {
  async getReviewCycles(companyId: string): Promise<ReviewCycle[]> {
    const r = await api.get('/performance/review-cycles', { params: { companyId } }); return r.data.data;
  }
  async getReviews(companyId: string, params?: Record<string, string>): Promise<PerformanceReview[]> {
    const r = await api.get('/performance/reviews', { params: { companyId, ...params } }); return r.data.data;
  }
  async getReview(id: string): Promise<PerformanceReview> {
    const r = await api.get(`/performance/reviews/${id}`); return r.data.data;
  }
  async createReview(data: any): Promise<PerformanceReview> {
    const r = await api.post('/performance/reviews', data); return r.data.data;
  }
  async submitReview(id: string): Promise<PerformanceReview> {
    const r = await api.patch(`/performance/reviews/${id}/submit`); return r.data.data;
  }
  async approveReview(id: string): Promise<PerformanceReview> {
    const r = await api.patch(`/performance/reviews/${id}/approve`); return r.data.data;
  }
  async getGoals(companyId: string, employeeId?: string): Promise<Goal[]> {
    const r = await api.get('/performance/goals', { params: { companyId, employeeId } }); return r.data.data;
  }
  async createGoal(data: any): Promise<Goal> {
    const r = await api.post('/performance/goals', data); return r.data.data;
  }
  async updateGoalProgress(id: string, data: { progress: number; note?: string }): Promise<any> {
    const r = await api.patch(`/performance/goals/${id}/progress`, data); return r.data.data;
  }
}

export const performanceService = new PerformanceService();
