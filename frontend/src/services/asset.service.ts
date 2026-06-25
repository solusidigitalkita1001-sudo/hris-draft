import api from './api';

export interface Asset {
  id: string; companyId: string; assetCode: string; name: string;
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

class AssetService {
  async getAll(companyId: string, status?: string): Promise<Asset[]> {
    const r = await api.get('/assets', { params: { companyId, status } }); return r.data.data;
  }
  async get(id: string): Promise<Asset> {
    const r = await api.get(`/assets/${id}`); return r.data.data;
  }
  async create(data: any): Promise<Asset> {
    const r = await api.post('/assets', data); return r.data.data;
  }
  async assign(id: string, data: any): Promise<AssetAssignment> {
    const r = await api.post(`/assets/${id}/assign`, data); return r.data.data;
  }
  async returnAsset(id: string, assignmentId: string, data: any): Promise<Asset> {
    const r = await api.post(`/assets/${id}/return`, { assignmentId, ...data }); return r.data.data;
  }
}
export const assetService = new AssetService();
