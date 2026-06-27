import { prisma } from '@/shared/database/prisma';
import { Prisma } from '@prisma/client';
import type { CreatePermissionDTO, ApprovePermissionDTO } from './permission-request.dto';

export class PermissionRequestRepository {
  // Employee sees their own requests
  async findMyRequests(employeeId: string, status?: string) {
    const where: Prisma.PermissionRequestWhereInput = { employeeId };
    if (status) where.status = status as any;

    return prisma.permissionRequest.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        employee: { select: { fullName: true, employeeNumber: true } },
      },
    });
  }

  // Manager/admin sees requests in their company
  async findAll(companyId: string, status?: string) {
    const where: Prisma.PermissionRequestWhereInput = { companyId };
    if (status) where.status = status as any;

    return prisma.permissionRequest.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        employee: { select: { fullName: true, employeeNumber: true } },
      },
    });
  }

  async findById(id: string) {
    return prisma.permissionRequest.findUnique({
      where: { id },
      include: {
        employee: { select: { fullName: true, employeeNumber: true, departmentId: true } },
      },
    });
  }

  async create(data: CreatePermissionDTO & { companyId: string; employeeId: string }) {
    return prisma.permissionRequest.create({
      data: {
        ...data,
        startDate: new Date(data.startDate),
        endDate: new Date(data.endDate),
      } as any,
    });
  }

  async cancel(id: string, employeeId: string) {
    return prisma.permissionRequest.updateMany({
      where: { id, employeeId, status: 'PENDING' },
      data: { status: 'CANCELLED' },
    });
  }

  async approve(id: string, approverId: string, data?: ApprovePermissionDTO) {
    return prisma.permissionRequest.update({
      where: { id },
      data: {
        status: 'APPROVED',
        approverId,
        approvedAt: new Date(),
        notes: data?.notes,
      },
    });
  }

  async reject(id: string, approverId: string, data?: ApprovePermissionDTO) {
    return prisma.permissionRequest.update({
      where: { id },
      data: {
        status: 'REJECTED',
        approverId,
        approvedAt: new Date(),
        notes: data?.notes,
      },
    });
  }
}

export const permissionRequestRepository = new PermissionRequestRepository();
