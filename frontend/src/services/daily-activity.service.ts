import api from './api';

export type DailyActivityType = 'WORK' | 'SITE_VISIT' | 'SITE_INSPECTION' | 'MEETING' | 'OTHER';

export const DAILY_ACTIVITY_TYPE_LABELS: Record<DailyActivityType, string> = {
  WORK: 'Kerja Rutin',
  SITE_VISIT: 'Kunjungan Site',
  SITE_INSPECTION: 'Inspeksi Site',
  MEETING: 'Rapat',
  OTHER: 'Lainnya',
};

export const DAILY_ACTIVITY_TYPE_CLASSNAMES: Record<DailyActivityType, string> = {
  WORK: 'bg-blue-100 text-blue-800 border-blue-200',
  SITE_VISIT: 'bg-purple-100 text-purple-800 border-purple-200',
  SITE_INSPECTION: 'bg-orange-100 text-orange-800 border-orange-200',
  MEETING: 'bg-cyan-100 text-cyan-800 border-cyan-200',
  OTHER: 'bg-gray-100 text-gray-800 border-gray-200',
};

export interface DailyActivity {
  id: string;
  companyId: string;
  employeeId: string;
  branchId?: string | null;
  activityDate: string;
  activityType: DailyActivityType;
  title: string;
  description?: string | null;
  photoUrl?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  geoAccuracyMeters?: number | null;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  isOutsideRadius: boolean;
  distanceFromBranchMeters?: number | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  employee?: {
    id: string;
    fullName: string;
    employeeNumber: string;
    branchId?: string | null;
    departmentId?: string | null;
  };
  branch?: {
    id: string;
    name: string;
    code: string;
  };
}

export interface CreateDailyActivityPayload {
  employeeId?: string;
  branchId: string;
  activityDate: string;
  activityType: DailyActivityType;
  title: string;
  description?: string;
  photoUrl?: string;
  latitude: number;
  longitude: number;
  geoAccuracyMeters?: number;
  startTime: string;
  endTime: string;
  notes?: string;
}

class DailyActivityService {
  async getMyActivities(filters?: { startDate?: string; endDate?: string }): Promise<DailyActivity[]> {
    const params: Record<string, string> = {};
    if (filters?.startDate) params.startDate = filters.startDate;
    if (filters?.endDate) params.endDate = filters.endDate;
    const r = await api.get('/daily-activities/my', { params });
    return r.data.data as DailyActivity[];
  }

  async findAll(
    companyId: string,
    filters?: {
      employeeId?: string;
      branchId?: string;
      activityType?: DailyActivityType;
      startDate?: string;
      endDate?: string;
    },
  ): Promise<DailyActivity[]> {
    const params: Record<string, string> = { companyId };
    if (filters?.employeeId) params.employeeId = filters.employeeId;
    if (filters?.branchId) params.branchId = filters.branchId;
    if (filters?.activityType) params.activityType = filters.activityType;
    if (filters?.startDate) params.startDate = filters.startDate;
    if (filters?.endDate) params.endDate = filters.endDate;
    const r = await api.get('/daily-activities', { params });
    return r.data.data as DailyActivity[];
  }

  async findById(id: string): Promise<DailyActivity> {
    const r = await api.get(`/daily-activities/${id}`);
    return r.data.data as DailyActivity;
  }

  async createRequest(data: CreateDailyActivityPayload): Promise<DailyActivity> {
    const r = await api.post('/daily-activities', data);
    return r.data.data as DailyActivity;
  }

  async updateRequest(id: string, data: {
    title?: string;
    description?: string;
    photoUrl?: string;
    notes?: string;
    startTime?: string;
    endTime?: string;
  }): Promise<DailyActivity> {
    const r = await api.put(`/daily-activities/${id}`, data);
    return r.data.data as DailyActivity;
  }

  async completeRequest(id: string, data?: { actualEndTime?: string; notes?: string }): Promise<DailyActivity> {
    const r = await api.post(`/daily-activities/${id}/complete`, data ?? {});
    return r.data.data as DailyActivity;
  }

  async deleteRequest(id: string): Promise<{ success: boolean }> {
    const r = await api.delete(`/daily-activities/${id}`);
    return r.data.data as { success: boolean };
  }
}

export const dailyActivityService = new DailyActivityService();
