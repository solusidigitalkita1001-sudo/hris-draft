import api from './api';

export interface DocumentCategory {
  id: string;
  name: string;
  code: string;
  description?: string;
  companyId?: string | null;
  groupId?: string | null;
}

export interface ManagedDocument {
  id: string;
  title: string;
  description?: string | null;
  fileName: string;
  mimeType: string;
  fileSize: number;
  status: string;
  visibility: string;
  version: number;
  expiresAt?: string | null;
  createdAt: string;
  category: DocumentCategory;
  employee?: {
    id: string;
    fullName: string;
    employeeNumber: string;
  } | null;
  uploader?: {
    id: string;
    email: string;
  } | null;
}

class DocumentManagementService {
  async getCategories(companyId?: string) {
    const response = await api.get('/documents/categories', {
      params: companyId ? { companyId } : undefined,
    });
    return response.data.data as DocumentCategory[];
  }

  async getDocuments(params: { companyId?: string; search?: string; categoryId?: string }) {
    const response = await api.get('/documents', { params });
    return response.data.data as ManagedDocument[];
  }

  async upload(data: {
    companyId: string;
    categoryId: string;
    ownerType: 'EMPLOYEE' | 'COMPANY' | 'GROUP';
    employeeId?: string;
    title: string;
    description?: string;
    visibility: 'INTERNAL' | 'RESTRICTED' | 'PUBLIC';
    expiresAt?: string;
    file: File;
  }) {
    const formData = new FormData();
    formData.append('companyId', data.companyId);
    formData.append('categoryId', data.categoryId);
    formData.append('ownerType', data.ownerType);
    formData.append('title', data.title);
    formData.append('visibility', data.visibility);
    formData.append('file', data.file);

    if (data.employeeId) formData.append('employeeId', data.employeeId);
    if (data.description) formData.append('description', data.description);
    if (data.expiresAt) formData.append('expiresAt', data.expiresAt);

    const response = await api.post('/documents', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data.data as ManagedDocument;
  }

  async download(documentId: string, fileName: string) {
    const response = await api.get(`/documents/${documentId}/download`, {
      responseType: 'blob',
    });
    const blobUrl = window.URL.createObjectURL(new Blob([response.data]));
    const link = window.document.createElement('a');
    link.href = blobUrl;
    link.download = fileName;
    window.document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(blobUrl);
  }
}

export const documentManagementService = new DocumentManagementService();
