import api from './api';

export interface Employee {
  id: string;
  companyId: string;
  branchId?: string;
  departmentId?: string;
  subDepartmentId?: string;
  positionId?: string;
  employeeNumber: string;
  firstName: string;
  lastName: string;
  fullName: string;
  email?: string;
  phone?: string;
  idNumber?: string;
  gender?: string;
  religion?: string;
  maritalStatus?: string;
  address?: string;
  avatar?: string;
  joinDate?: string;
  employmentStatus: string;
  employmentType: string;
  employeeCategory: 'OFFICE' | 'FACTORY' | 'FIELD' | 'REMOTE';
  shiftFormulaId?: string | null;
  shiftStartDate?: string | null;
  bankName?: string;
  bankAccount?: string;
  bankAccountHolder?: string;
  taxId?: string;
  status: string;
  department?: { id: string; name: string };
  position?: { id: string; name: string };
  branch?: { id: string; name: string };
  shiftFormula?: { id: string; code: string; name: string } | null;
  bpjsKetenagakerjaan?: string;
  bpjsKesehatan?: string;
  createdAt: string;
  careerTransactions?: CareerTransaction[];
}

export interface CareerTransaction {
  id: string;
  employeeId: string;
  companyId: string;
  transactionType: 'PROMOTION' | 'DEMOTION' | 'MUTATION' | 'TRANSFER' | 'ROTATION' | 'ACTING_ASSIGNMENT' | 'STATUS_CHANGE';
  effectiveDate: string;
  fromBranchId?: string | null;
  toBranchId?: string | null;
  fromDepartmentId?: string | null;
  toDepartmentId?: string | null;
  fromPositionId?: string | null;
  toPositionId?: string | null;
  fromEmploymentType?: string | null;
  toEmploymentType?: string | null;
  referenceNumber?: string | null;
  reason?: string | null;
  notes?: string | null;
  createdBy?: string | null;
  createdAt: string;
  fromBranch?: { id: string; name: string } | null;
  toBranch?: { id: string; name: string } | null;
  fromDepartment?: { id: string; name: string } | null;
  toDepartment?: { id: string; name: string } | null;
  fromPosition?: { id: string; name: string } | null;
  toPosition?: { id: string; name: string } | null;
  creator?: { id: string; email: string } | null;
}

// ============================================================
// Employee Detail Sub-Entities
// ============================================================

export interface EmployeeFamily {
  id: string;
  employeeId: string;
  fullName: string;
  relationship: string;
  idNumber?: string;
  placeOfBirth?: string;
  dateOfBirth?: string;
  gender?: string;
  religion?: string;
  occupation?: string;
  phone?: string;
  address?: string;
  isEmergencyContact?: boolean;
  isDependent?: boolean;
  maritalStatus?: string;
  educationLevel?: string;
  orderSequence?: number;
  createdAt: string;
  updatedAt: string;
}

export interface EmployeeEducation {
  id: string;
  employeeId: string;
  level: string;
  institutionName: string;
  major?: string;
  degree?: string;
  startDate?: string;
  endDate?: string;
  isGraduated?: boolean;
  gpa?: number;
  city?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface EmployeeEmergencyContact {
  id: string;
  employeeId: string;
  fullName: string;
  relationship: string;
  phone: string;
  alternativePhone?: string;
  address?: string;
  isPrimary?: boolean;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface EmployeeTraining {
  id: string;
  employeeId: string;
  trainingName: string;
  organizer?: string;
  startDate?: string;
  endDate?: string;
  duration?: string;
  trainingType?: string;
  description?: string;
  certificateUrl?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface EmployeeSkill {
  id: string;
  employeeId: string;
  skillName: string;
  category?: string;
  proficiencyLevel?: string;
  yearsOfExperience?: number;
  lastUsedDate?: string;
  isCertified?: boolean;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface EmployeeExperience {
  id: string;
  employeeId: string;
  companyName: string;
  position: string;
  startDate: string;
  endDate?: string;
  isCurrentPosition?: boolean;
  jobDescription?: string;
  achievements?: string;
  industry?: string;
  city?: string;
  reasonForLeaving?: string;
  referenceName?: string;
  referencePhone?: string;
  createdAt: string;
  updatedAt: string;
}

export interface EmployeeAttachment {
  id: string;
  employeeId: string;
  category: string;
  fileName: string;
  fileUrl: string;
  originalName?: string;
  fileSize?: number;
  mimeType?: string;
  description?: string;
  uploadedBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface EmployeeQueryResult {
  data: Employee[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ImportCsvResult {
  imported: number;
  skipped: number;
  errors: string[];
}

class EmployeeService {
  async getEmployees(params: {
    companyId: string;
    departmentId?: string;
    positionId?: string;
    status?: string;
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<EmployeeQueryResult> {
    const response = await api.get('/employees', { params });
    return {
      data: response.data.data,
      total: response.data.meta?.total || 0,
      page: response.data.meta?.page || 1,
      limit: response.data.meta?.limit || 20,
      totalPages: response.data.meta?.totalPages || 0,
    };
  }

  async getEmployee(id: string): Promise<Employee> {
    const response = await api.get(`/employees/${id}`);
    return response.data.data;
  }

  async createEmployee(data: Partial<Employee>): Promise<Employee> {
    const response = await api.post('/employees', data);
    return response.data.data;
  }

  async updateEmployee(id: string, data: Partial<Employee>): Promise<Employee> {
    const response = await api.put(`/employees/${id}`, data);
    return response.data.data;
  }

  async deleteEmployee(id: string): Promise<void> {
    await api.delete(`/employees/${id}`);
  }

  async updateEmployeeStatus(id: string, status: string): Promise<Employee> {
    const response = await api.patch(`/employees/${id}/status`, { status });
    return response.data.data;
  }

  async getCareerTransactions(id: string): Promise<CareerTransaction[]> {
    const response = await api.get(`/employees/${id}/career-transactions`);
    return response.data.data;
  }

  async createCareerTransaction(
    id: string,
    data: {
      effectiveDate: string;
      transactionType: CareerTransaction['transactionType'];
      toBranchId?: string | null;
      toDepartmentId?: string | null;
      toPositionId?: string | null;
      toEmploymentType?: string | null;
      referenceNumber?: string;
      reason?: string;
      notes?: string;
    }
  ): Promise<CareerTransaction> {
    const response = await api.post(`/employees/${id}/career-transactions`, data);
    return response.data.data;
  }

  /**
   * Import employees from a CSV file.
   * @param formData - FormData containing the CSV file under the key "file"
   * @param companyId - Company ID to associate the import with
   */
  async importCsv(formData: FormData, companyId: string): Promise<ImportCsvResult> {
    formData.append('companyId', companyId);
    const response = await api.post('/employees/import', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data.data;
  }

  /**
   * Export employees to a CSV file (blob download).
   * @param params - Filter parameters to narrow the export
   */
  async exportCsv(params: {
    companyId: string;
    departmentId?: string;
    positionId?: string;
    status?: string;
  }): Promise<Blob> {
    const response = await api.get('/employees/export', {
      params,
      responseType: 'blob',
    });
    return response.data;
  }

  // ============================================================
  // Employee Family
  // ============================================================
  async getFamilies(employeeId: string): Promise<EmployeeFamily[]> {
    const response = await api.get(`/employees/${employeeId}/families`);
    return response.data.data;
  }

  async createFamily(employeeId: string, data: Partial<EmployeeFamily>): Promise<EmployeeFamily> {
    const response = await api.post(`/employees/${employeeId}/families`, data);
    return response.data.data;
  }

  async updateFamily(employeeId: string, familyId: string, data: Partial<EmployeeFamily>): Promise<EmployeeFamily> {
    const response = await api.put(`/employees/${employeeId}/families/${familyId}`, data);
    return response.data.data;
  }

  async deleteFamily(employeeId: string, familyId: string): Promise<void> {
    await api.delete(`/employees/${employeeId}/families/${familyId}`);
  }

  // ============================================================
  // Employee Education
  // ============================================================
  async getEducations(employeeId: string): Promise<EmployeeEducation[]> {
    const response = await api.get(`/employees/${employeeId}/educations`);
    return response.data.data;
  }

  async createEducation(employeeId: string, data: Partial<EmployeeEducation>): Promise<EmployeeEducation> {
    const response = await api.post(`/employees/${employeeId}/educations`, data);
    return response.data.data;
  }

  async updateEducation(employeeId: string, educationId: string, data: Partial<EmployeeEducation>): Promise<EmployeeEducation> {
    const response = await api.put(`/employees/${employeeId}/educations/${educationId}`, data);
    return response.data.data;
  }

  async deleteEducation(employeeId: string, educationId: string): Promise<void> {
    await api.delete(`/employees/${employeeId}/educations/${educationId}`);
  }

  // ============================================================
  // Employee Emergency Contact
  // ============================================================
  async getEmergencyContacts(employeeId: string): Promise<EmployeeEmergencyContact[]> {
    const response = await api.get(`/employees/${employeeId}/emergency-contacts`);
    return response.data.data;
  }

  async createEmergencyContact(employeeId: string, data: Partial<EmployeeEmergencyContact>): Promise<EmployeeEmergencyContact> {
    const response = await api.post(`/employees/${employeeId}/emergency-contacts`, data);
    return response.data.data;
  }

  async updateEmergencyContact(employeeId: string, emergencyId: string, data: Partial<EmployeeEmergencyContact>): Promise<EmployeeEmergencyContact> {
    const response = await api.put(`/employees/${employeeId}/emergency-contacts/${emergencyId}`, data);
    return response.data.data;
  }

  async deleteEmergencyContact(employeeId: string, emergencyId: string): Promise<void> {
    await api.delete(`/employees/${employeeId}/emergency-contacts/${emergencyId}`);
  }

  // ============================================================
  // Employee Training
  // ============================================================
  async getTrainings(employeeId: string): Promise<EmployeeTraining[]> {
    const response = await api.get(`/employees/${employeeId}/trainings`);
    return response.data.data;
  }

  async createTraining(employeeId: string, data: Partial<EmployeeTraining>): Promise<EmployeeTraining> {
    const response = await api.post(`/employees/${employeeId}/trainings`, data);
    return response.data.data;
  }

  async updateTraining(employeeId: string, trainingId: string, data: Partial<EmployeeTraining>): Promise<EmployeeTraining> {
    const response = await api.put(`/employees/${employeeId}/trainings/${trainingId}`, data);
    return response.data.data;
  }

  async deleteTraining(employeeId: string, trainingId: string): Promise<void> {
    await api.delete(`/employees/${employeeId}/trainings/${trainingId}`);
  }

  // ============================================================
  // Employee Skill
  // ============================================================
  async getSkills(employeeId: string): Promise<EmployeeSkill[]> {
    const response = await api.get(`/employees/${employeeId}/skills`);
    return response.data.data;
  }

  async createSkill(employeeId: string, data: Partial<EmployeeSkill>): Promise<EmployeeSkill> {
    const response = await api.post(`/employees/${employeeId}/skills`, data);
    return response.data.data;
  }

  async updateSkill(employeeId: string, skillId: string, data: Partial<EmployeeSkill>): Promise<EmployeeSkill> {
    const response = await api.put(`/employees/${employeeId}/skills/${skillId}`, data);
    return response.data.data;
  }

  async deleteSkill(employeeId: string, skillId: string): Promise<void> {
    await api.delete(`/employees/${employeeId}/skills/${skillId}`);
  }

  // ============================================================
  // Employee Experience
  // ============================================================
  async getExperiences(employeeId: string): Promise<EmployeeExperience[]> {
    const response = await api.get(`/employees/${employeeId}/experiences`);
    return response.data.data;
  }

  async createExperience(employeeId: string, data: Partial<EmployeeExperience>): Promise<EmployeeExperience> {
    const response = await api.post(`/employees/${employeeId}/experiences`, data);
    return response.data.data;
  }

  async updateExperience(employeeId: string, experienceId: string, data: Partial<EmployeeExperience>): Promise<EmployeeExperience> {
    const response = await api.put(`/employees/${employeeId}/experiences/${experienceId}`, data);
    return response.data.data;
  }

  async deleteExperience(employeeId: string, experienceId: string): Promise<void> {
    await api.delete(`/employees/${employeeId}/experiences/${experienceId}`);
  }

  // ============================================================
  // Employee Attachment
  // ============================================================
  async getAttachments(employeeId: string, category?: string): Promise<EmployeeAttachment[]> {
    const params = category ? { category } : {};
    const response = await api.get(`/employees/${employeeId}/attachments`, { params });
    return response.data.data;
  }

  async createAttachment(employeeId: string, data: Partial<EmployeeAttachment>): Promise<EmployeeAttachment> {
    const response = await api.post(`/employees/${employeeId}/attachments`, data);
    return response.data.data;
  }

  async updateAttachment(employeeId: string, attachmentId: string, data: Partial<EmployeeAttachment>): Promise<EmployeeAttachment> {
    const response = await api.put(`/employees/${employeeId}/attachments/${attachmentId}`, data);
    return response.data.data;
  }

  async deleteAttachment(employeeId: string, attachmentId: string): Promise<void> {
    await api.delete(`/employees/${employeeId}/attachments/${attachmentId}`);
  }
}

export const employeeService = new EmployeeService();
