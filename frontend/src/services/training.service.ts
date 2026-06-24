import api from './api';

export interface TrainingCategory {
  id: string; name: string; code: string; description?: string; isActive: boolean;
}

export interface TrainingCourse {
  id: string; title: string; code: string; description?: string; duration?: number; durationUnit?: string;
  provider?: string; isMandatory: boolean; isActive: boolean;
  category?: { id: string; name: string };
  materials?: TrainingMaterial[];
  sessions?: TrainingSession[];
  enrollments?: TrainingEnrollment[];
  _count?: { enrollments: number; sessions: number };
  createdAt: string;
}

export interface TrainingMaterial {
  id: string; title: string; type: string; url?: string; filePath?: string; sortOrder: number;
}

export interface TrainingSession {
  id: string; courseId: string; trainer?: string; location?: string; startDate: string; endDate?: string;
  maxParticipants?: number; status: string;
  course?: { id: string; title: string; code: string };
  _count?: { attendances: number };
}

export interface TrainingEnrollment {
  id: string; courseId: string; employeeId: string; status: string; progress: number; completedAt?: string;
  score?: number; notes?: string;
  course?: { id: string; title: string; code: string };
  employee?: { id: string; fullName: string; employeeNumber: string };
  createdAt: string;
}

class TrainingService {
  // Categories
  async getCategories(companyId: string): Promise<TrainingCategory[]> {
    const r = await api.get('/training/categories', { params: { companyId } }); return r.data.data;
  }
  async createCategory(data: any): Promise<TrainingCategory> {
    const r = await api.post('/training/categories', data); return r.data.data;
  }

  // Courses
  async getCourses(companyId: string, categoryId?: string): Promise<TrainingCourse[]> {
    const r = await api.get('/training/courses', { params: { companyId, categoryId } }); return r.data.data;
  }
  async getCourse(id: string): Promise<TrainingCourse> {
    const r = await api.get(`/training/courses/${id}`); return r.data.data;
  }
  async createCourse(data: any): Promise<TrainingCourse> {
    const r = await api.post('/training/courses', data); return r.data.data;
  }
  async updateCourse(id: string, data: any): Promise<TrainingCourse> {
    const r = await api.patch(`/training/courses/${id}`, data); return r.data.data;
  }

  // Sessions
  async getSessions(courseId?: string): Promise<TrainingSession[]> {
    const r = await api.get('/training/sessions', { params: { courseId } }); return r.data.data;
  }
  async createSession(data: any): Promise<TrainingSession> {
    const r = await api.post('/training/sessions', data); return r.data.data;
  }

  // Enrollments
  async getEnrollments(companyId: string, employeeId?: string): Promise<TrainingEnrollment[]> {
    const r = await api.get('/training/enrollments', { params: { companyId, employeeId } }); return r.data.data;
  }
  async createEnrollment(data: any): Promise<TrainingEnrollment> {
    const r = await api.post('/training/enrollments', data); return r.data.data;
  }
  async completeEnrollment(id: string): Promise<TrainingEnrollment> {
    const r = await api.patch(`/training/enrollments/${id}/complete`); return r.data.data;
  }
}

export const trainingService = new TrainingService();
