import api from './api';

export interface AuditLogEntry {
  id: string;
  companyId?: string;
  userId?: string;
  action: string;
  entity: string;
  entityId?: string;
  oldValue?: string;
  newValue?: string;
  ipAddress?: string;
  userAgent?: string;
  createdAt: string;
  user?: { id: string; email: string };
}

export interface PaginatedResult<T> {
  data: T[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

class AuditLogService {
  async getAll(params: {
    companyId: string;
    action?: string;
    entity?: string;
    page?: number;
    limit?: number;
  }): Promise<PaginatedResult<AuditLogEntry>> {
    const r = await api.get('/audit-logs', { params });
    return { data: r.data.data, meta: r.data.meta };
  }

  async get(id: string): Promise<AuditLogEntry> {
    const r = await api.get(`/audit-logs/${id}`);
    return r.data.data;
  }
}

export const auditLogService = new AuditLogService();
