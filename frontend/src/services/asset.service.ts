import api from './api';

export interface Asset {
  id: string; companyId: string; assetCode: string; name: string;
  categoryId?: string | null;
  serialNumber?: string; purchaseDate?: string; purchaseValue?: number; currentValue?: number;
  status: string; notes?: string; createdAt: string;
  assignments?: AssetAssignment[];
}

export interface AssetAssignment {
  id: string; assetId: string; employeeId: string;
  assignedAt: string; conditionAtAssign: string;
  returnedAt?: string; conditionAtReturn?: string;
  employee?: { id: string; fullName: string; employeeNumber: string };
}

export interface AssetCategory {
  id: string; name: string; depreciationMethod: string; usefulLifeMonths?: number | null;
}

class AssetService {
  async getAll(companyId: string, status?: string): Promise<Asset[]> {
    const r = await api.get('/assets', { params: { companyId, status } }); return r.data.data;
  }
  async get(id: string): Promise<Asset> {
    const r = await api.get(`/assets/${id}`); return r.data.data;
  }
  async create(data: Record<string, unknown>): Promise<Asset> {
    const r = await api.post('/assets', data); return r.data.data;
  }
  async update(id: string, data: Record<string, unknown>): Promise<Asset> {
    const r = await api.put(`/assets/${id}`, data); return r.data.data;
  }
  async delete(id: string): Promise<void> {
    await api.delete(`/assets/${id}`);
  }
  async assign(id: string, data: Record<string, unknown>): Promise<AssetAssignment> {
    const r = await api.post(`/assets/${id}/assign`, data); return r.data.data;
  }
  async returnAsset(id: string, assignmentId: string, data: Record<string, unknown>): Promise<Asset> {
    const r = await api.post(`/assets/${id}/return`, { assignmentId, ...data }); return r.data.data;
  }
  async transfer(id: string, data: Record<string, unknown>): Promise<AssetAssignment> {
    const r = await api.post(`/assets/${id}/transfer`, data); return r.data.data;
  }
  async getCategories(): Promise<AssetCategory[]> {
    const r = await api.get('/assets/categories'); return r.data.data;
  }
  async createCategory(data: Record<string, unknown>): Promise<AssetCategory> {
    const r = await api.post('/assets/categories', data); return r.data.data;
  }
  async updateCategory(id: string, data: Record<string, unknown>): Promise<AssetCategory> {
    const r = await api.put(`/assets/categories/${id}`, data); return r.data.data;
  }
  async deleteCategory(id: string): Promise<void> {
    await api.delete(`/assets/categories/${id}`);
  }
}
export const assetService = new AssetService();
