import { prisma } from '@/shared/database/prisma';
import { CreateChecklistDTO, UpdateChecklistDTO, CreateResignationDTO, CreateClearanceDTO } from './onboarding.dto';

export class OnboardingRepository {
  async findChecklistsByEmployee(employeeId: string) {
    return prisma.onboardingChecklist.findMany({
      where: { employeeId },
      include: { pic: { select: { id: true, fullName: true } } },
      orderBy: { createdAt: 'asc' },
    });
  }

  async createChecklist(data: CreateChecklistDTO) {
    return prisma.onboardingChecklist.create({
      data: { ...data, dueDate: data.dueDate ? new Date(data.dueDate) : undefined },
      include: { pic: { select: { id: true, fullName: true } } },
    });
  }

  async updateChecklist(id: string, data: UpdateChecklistDTO) {
    const update: any = {};
    if (data.status) update.status = data.status;
    if (data.notes) update.notes = data.notes;
    if (data.status === 'DONE') update.completedAt = new Date();
    return prisma.onboardingChecklist.update({ where: { id }, data: update });
  }

  // Resignations
  async findAllResignations(companyId: string, status?: string) {
    const where: any = { companyId };
    if (status) where.status = status;
    return prisma.resignation.findMany({
      where,
      include: {
        employee: { select: { id: true, fullName: true, employeeNumber: true, department: { select: { name: true } } } },
        clearances: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findResignationById(id: string) {
    return prisma.resignation.findFirst({
      where: { id },
      include: {
        employee: { select: { id: true, fullName: true, employeeNumber: true, department: { select: { name: true } }, position: { select: { name: true } } } },
        clearances: { include: { pic: { select: { id: true, fullName: true } } } },
      },
    });
  }

  async createResignation(data: CreateResignationDTO) {
    return prisma.resignation.create({
      data: { ...data, resignDate: new Date(data.resignDate), lastWorkingDate: new Date(data.lastWorkingDate) },
      include: { employee: { select: { id: true, fullName: true, employeeNumber: true } } },
    });
  }

  async updateResignationStatus(id: string, status: string, approvedBy?: string) {
    const update: any = { status };
    if (status === 'APPROVED') { update.approvedBy = approvedBy; update.approvedAt = new Date(); }
    return prisma.resignation.update({ where: { id }, data: update });
  }

  // Exit Clearances
  async createClearance(data: CreateClearanceDTO) {
    return prisma.exitClearance.create({
      data,
      include: { pic: { select: { id: true, fullName: true } } },
    });
  }

  async updateClearance(id: string, status: string, notes?: string) {
    const update: any = { status };
    if (notes) update.notes = notes;
    if (status === 'CLEARED') update.clearedAt = new Date();
    return prisma.exitClearance.update({ where: { id }, data: update });
  }

  async generateClearances(resignationId: string, employeeId: string) {
    const defaults = [
      { department: 'IT', checklistItem: 'Return laptop & accessories' },
      { department: 'IT', checklistItem: 'Deactivate system accounts & email' },
      { department: 'GA', checklistItem: 'Return ID card & access card' },
      { department: 'Finance', checklistItem: 'Settlement of outstanding loans' },
      { department: 'Finance', checklistItem: 'Final salary & benefit calculation' },
      { department: 'HR', checklistItem: 'Exit interview' },
      { department: 'HR', checklistItem: 'Certificate of employment' },
      { department: 'HR', checklistItem: 'BPJS transfer letter' },
    ];
    return prisma.exitClearance.createMany({
      data: defaults.map((d) => ({ resignationId, department: d.department, checklistItem: d.checklistItem })),
    });
  }
}

export const onboardingRepository = new OnboardingRepository();
