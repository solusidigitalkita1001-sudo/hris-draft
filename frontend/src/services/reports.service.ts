import api from './api';

// ─── Types ──────────────────────────────────────────────
export interface HeadcountReport {
  total: number;
  byDepartment: { departmentId: string; departmentName: string; count: number }[];
  byStatus: { status: string; count: number }[];
  byGender: { gender: string; count: number }[];
}

export interface AttendanceReport {
  total: number;
  byStatus: { status: string; count: number }[];
  lateCount: number;
  lateRate: number;
}

export interface LeaveReport {
  totalRequests: number;
  totalDays: number;
  byType: { leaveTypeId: string; leaveTypeName: string; count: number; totalDays: number }[];
  byDepartmentCount: number;
}

export interface PayrollReport {
  summary: {
    totalEarnings: number;
    totalDeductions: number;
    totalNetPay: number;
    totalEmployees: number;
  };
  runs: {
    id: string;
    name: string;
    totalEmployees: number;
    totalEarnings: string;
    totalDeductions: string;
    totalNetPay: string;
    status: string;
    createdAt: string;
  }[];
}

export interface TurnoverReport {
  totalActive: number;
  newHires: number;
  resignations: number;
  turnoverRate: number;
  monthly: { year: number; month: number; hires: number; resigns: number }[];
}

export interface RecruitmentReport {
  totalApplications: number;
  totalPostings: number;
  totalCandidates: number;
  byStage: { stage: string; count: number }[];
}

// ─── Service ────────────────────────────────────────────
class ReportsService {
  async getHeadcount(companyId: string, departmentId?: string): Promise<HeadcountReport> {
    const r = await api.get('/reports/headcount', { params: { companyId, departmentId } });
    return r.data.data;
  }

  async getAttendance(companyId: string, startDate: string, endDate: string): Promise<AttendanceReport> {
    const r = await api.get('/reports/attendance', { params: { companyId, startDate, endDate } });
    return r.data.data;
  }

  async getLeave(companyId: string, startDate: string, endDate: string): Promise<LeaveReport> {
    const r = await api.get('/reports/leave', { params: { companyId, startDate, endDate } });
    return r.data.data;
  }

  async getPayroll(companyId: string, periodId?: string): Promise<PayrollReport> {
    const r = await api.get('/reports/payroll', { params: { companyId, periodId } });
    return r.data.data;
  }

  async getTurnover(companyId: string, startDate: string, endDate: string): Promise<TurnoverReport> {
    const r = await api.get('/reports/turnover', { params: { companyId, startDate, endDate } });
    return r.data.data;
  }

  async getRecruitment(companyId: string, startDate: string, endDate: string): Promise<RecruitmentReport> {
    const r = await api.get('/reports/recruitment', { params: { companyId, startDate, endDate } });
    return r.data.data;
  }
}

export const reportsService = new ReportsService();
