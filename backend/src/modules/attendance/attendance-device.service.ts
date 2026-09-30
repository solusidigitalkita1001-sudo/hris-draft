import crypto from 'node:crypto';
import { AttendanceDevicePunchStatus, Prisma } from '@prisma/client';
import prisma from '@/shared/database/prisma';
import { runInSystemContext } from '@/shared/context/RequestContext';
import { AuthError, BadRequestError, NotFoundError } from '@/shared/exceptions/AppError';
import { logger } from '@/shared/logger/WinstonLogger';
import { attendanceService } from './attendance.service';
import type {
  AttendanceDevicePunchDTO,
  AttendanceDevicePunchQueryDTO,
  RegisterAttendanceDeviceDTO,
  UpdateAttendanceDeviceDTO,
} from './attendance-device.dto';

/** What a terminal presents: `<deviceId>.<secret>`. */
const TOKEN_SEPARATOR = '.';

function hashSecret(secret: string): string {
  return crypto.createHash('sha256').update(secret).digest('hex');
}

function secretsMatch(presented: string, storedHash: string): boolean {
  const a = Buffer.from(hashSecret(presented), 'hex');
  const b = Buffer.from(storedHash, 'hex');
  // Equal length is guaranteed for two SHA-256 digests, but a corrupted row
  // would otherwise make timingSafeEqual throw instead of simply refusing.
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/** The UTC calendar day a punch belongs to; attendance.date is a DATE column. */
function punchDate(punchedAt: Date): Date {
  return new Date(Date.UTC(punchedAt.getUTCFullYear(), punchedAt.getUTCMonth(), punchedAt.getUTCDate()));
}

export interface PunchOutcome {
  externalId: string;
  employeeCode: string;
  status: AttendanceDevicePunchStatus;
  reason?: string;
  attendanceId?: string;
}

export interface AuthenticatedDevice {
  id: string;
  companyId: string;
  branchId: string | null;
  serialNumber: string;
  name: string;
}

export class AttendanceDeviceService {
  /**
   * Register a terminal and mint its credential. The secret is returned exactly
   * once — only its SHA-256 is stored, so neither a database dump nor an admin
   * reading this table can impersonate the terminal afterwards.
   */
  async register(companyId: string, dto: RegisterAttendanceDeviceDTO) {
    if (dto.branchId) {
      const branch = await prisma.branch.findFirst({ where: { id: dto.branchId, companyId }, select: { id: true } });
      if (!branch) throw new BadRequestError('Branch does not belong to the active company');
    }

    const existing = await prisma.attendanceDevice.findFirst({
      where: { companyId, serialNumber: dto.serialNumber, deletedAt: null },
      select: { id: true },
    });
    if (existing) throw new BadRequestError('A device with this serial number is already registered');

    const secret = crypto.randomBytes(32).toString('base64url');
    const device = await prisma.attendanceDevice.create({
      data: {
        companyId,
        branchId: dto.branchId ?? null,
        name: dto.name,
        serialNumber: dto.serialNumber,
        secretHash: hashSecret(secret),
      },
    });

    logger.info('Attendance device registered', { deviceId: device.id, companyId, serialNumber: device.serialNumber });
    return { device, token: `${device.id}${TOKEN_SEPARATOR}${secret}` };
  }

  async list(companyId: string, filters: { isActive?: 'true' | 'false' } = {}) {
    return prisma.attendanceDevice.findMany({
      where: {
        companyId,
        deletedAt: null,
        ...(filters.isActive ? { isActive: filters.isActive === 'true' } : {}),
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        serialNumber: true,
        branchId: true,
        isActive: true,
        lastSeenAt: true,
        createdAt: true,
      },
    });
  }

  async update(companyId: string, id: string, dto: UpdateAttendanceDeviceDTO) {
    const device = await prisma.attendanceDevice.findFirst({ where: { id, companyId, deletedAt: null } });
    if (!device) throw new NotFoundError('Attendance device not found');

    if (dto.branchId) {
      const branch = await prisma.branch.findFirst({ where: { id: dto.branchId, companyId }, select: { id: true } });
      if (!branch) throw new BadRequestError('Branch does not belong to the active company');
    }

    return prisma.attendanceDevice.update({
      where: { id: device.id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.branchId !== undefined ? { branchId: dto.branchId } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
    });
  }

  /**
   * Verify a terminal's credential. Runs in system context because there is no
   * user session on this path and the device row is company-scoped: the lookup
   * cannot know its tenant until it has read the row. Everything the caller
   * does afterwards is confined to the companyId this returns.
   */
  async authenticate(token: string): Promise<AuthenticatedDevice> {
    const separator = token.indexOf(TOKEN_SEPARATOR);
    if (separator <= 0) throw new AuthError('Invalid device credential');

    const deviceId = token.slice(0, separator);
    const secret = token.slice(separator + 1);
    if (!secret) throw new AuthError('Invalid device credential');

    const device = await runInSystemContext('attendance-device-authentication', async () =>
      prisma.attendanceDevice.findFirst({
        where: { id: deviceId, deletedAt: null },
        select: { id: true, companyId: true, branchId: true, serialNumber: true, name: true, secretHash: true, isActive: true },
      }),
    );

    // One message for every failure: an unknown id and a wrong secret must not
    // be distinguishable, or the endpoint becomes a device-id oracle.
    if (!device || !secretsMatch(secret, device.secretHash)) throw new AuthError('Invalid device credential');
    if (!device.isActive) throw new AuthError('Attendance device is deactivated');

    return {
      id: device.id,
      companyId: device.companyId,
      branchId: device.branchId,
      serialNumber: device.serialNumber,
      name: device.name,
    };
  }

  /**
   * Store every punch verbatim, then derive attendance from it.
   *
   * One punch failing must not cost the batch: a terminal that reconnects after
   * a week posts hundreds of punches, and a single one landing on a closed
   * payroll period would otherwise discard the rest. Each punch therefore
   * records its own outcome and the caller gets a per-punch report.
   */
  async ingest(device: AuthenticatedDevice, punches: AttendanceDevicePunchDTO[]): Promise<PunchOutcome[]> {
    return runInSystemContext('attendance-device-punch-ingest', async () => {
      const outcomes: PunchOutcome[] = [];

      for (const punch of punches) {
        outcomes.push(await this.ingestOne(device, punch));
      }

      await prisma.attendanceDevice.update({ where: { id: device.id }, data: { lastSeenAt: new Date() } });
      return outcomes;
    });
  }

  private async ingestOne(device: AuthenticatedDevice, punch: AttendanceDevicePunchDTO): Promise<PunchOutcome> {
    const seen = await prisma.attendanceDevicePunch.findFirst({
      where: { deviceId: device.id, externalId: punch.externalId },
      select: { id: true, status: true, attendanceId: true },
    });
    if (seen) {
      return {
        externalId: punch.externalId,
        employeeCode: punch.employeeCode,
        status: AttendanceDevicePunchStatus.DUPLICATE,
        reason: `Already received (recorded as ${seen.status})`,
        ...(seen.attendanceId ? { attendanceId: seen.attendanceId } : {}),
      };
    }

    const punchedAt = new Date(punch.punchedAt);

    // System context bypasses the tenant middleware, so the company filter here
    // is the isolation: a code enrolled on a terminal of another tenant must
    // resolve to nothing, not to that tenant's employee.
    const employee = await prisma.employee.findFirst({
      where: { employeeNumber: punch.employeeCode, companyId: device.companyId, deletedAt: null },
      select: { id: true },
    });

    const base = {
      deviceId: device.id,
      companyId: device.companyId,
      employeeCode: punch.employeeCode,
      externalId: punch.externalId,
      punchedAt,
      direction: punch.direction,
    };

    if (!employee) {
      await prisma.attendanceDevicePunch.create({
        data: {
          ...base,
          employeeId: null,
          status: AttendanceDevicePunchStatus.UNMATCHED_EMPLOYEE,
          rejectionReason: 'No employee with this code in the device company',
        },
      });
      return {
        externalId: punch.externalId,
        employeeCode: punch.employeeCode,
        status: AttendanceDevicePunchStatus.UNMATCHED_EMPLOYEE,
        reason: 'No employee with this code in the device company',
      };
    }

    try {
      const attendanceId = await this.applyPunch(device, employee.id, punchedAt, punch.direction);
      await prisma.attendanceDevicePunch.create({
        data: { ...base, employeeId: employee.id, status: AttendanceDevicePunchStatus.APPLIED, attendanceId },
      });
      return { externalId: punch.externalId, employeeCode: punch.employeeCode, status: AttendanceDevicePunchStatus.APPLIED, attendanceId };
    } catch (error) {
      const reason = error instanceof Error ? error.message.slice(0, 255) : 'Punch rejected';
      await prisma.attendanceDevicePunch.create({
        data: { ...base, employeeId: employee.id, status: AttendanceDevicePunchStatus.REJECTED, rejectionReason: reason },
      });
      logger.warn('Attendance device punch rejected', { deviceId: device.id, employeeCode: punch.employeeCode, reason });
      return { externalId: punch.externalId, employeeCode: punch.employeeCode, status: AttendanceDevicePunchStatus.REJECTED, reason };
    }
  }

  /**
   * Open or close the day's attendance. AUTO — what a terminal without an
   * in/out button sends — reads the employee's current state: no record yet
   * opens one, an open record closes it. An explicit IN or OUT is obeyed, so a
   * terminal that does know the direction is not second-guessed.
   */
  private async applyPunch(
    device: AuthenticatedDevice,
    employeeId: string,
    punchedAt: Date,
    direction: AttendanceDevicePunchDTO['direction'],
  ): Promise<string> {
    const date = punchDate(punchedAt);
    const existing = await prisma.attendance.findFirst({
      where: { employeeId, companyId: device.companyId, date, deletedAt: null },
      select: { id: true, checkIn: true, checkOut: true },
    });

    const attestation = { deviceId: device.id, serialNumber: device.serialNumber };
    const wantsCheckOut = direction === 'OUT' || (direction === 'AUTO' && Boolean(existing?.checkIn));

    if (wantsCheckOut) {
      if (!existing) throw new BadRequestError('No attendance record to close for this date');
      if (existing.checkOut) throw new BadRequestError('Attendance record has already been checked out');
      const record = await attendanceService.checkOut(existing.id, {
        checkOut: punchedAt.toISOString(),
        method: 'FINGERPRINT',
        notes: `Device ${device.serialNumber}`,
      });
      return record.id;
    }

    if (existing) throw new BadRequestError('Attendance record already exists for this date');

    const record = await attendanceService.create({
      employeeId,
      companyId: device.companyId,
      date: date.toISOString(),
      checkIn: punchedAt.toISOString(),
      method: 'FINGERPRINT',
      status: 'PRESENT',
      source: `DEVICE:${device.serialNumber}`.slice(0, 50),
      deviceAttestation: attestation,
    });
    return record.id;
  }

  /** Raw punch log, including punches that matched no employee. */
  async punchLog(companyId: string, deviceId: string, query: AttendanceDevicePunchQueryDTO) {
    const device = await prisma.attendanceDevice.findFirst({
      where: { id: deviceId, companyId, deletedAt: null },
      select: { id: true },
    });
    if (!device) throw new NotFoundError('Attendance device not found');

    const where: Prisma.AttendanceDevicePunchWhereInput = {
      deviceId: device.id,
      companyId,
      ...(query.status ? { status: query.status } : {}),
      ...(query.from || query.to
        ? {
            punchedAt: {
              ...(query.from ? { gte: new Date(query.from) } : {}),
              ...(query.to ? { lte: new Date(query.to) } : {}),
            },
          }
        : {}),
    };

    return prisma.attendanceDevicePunch.findMany({
      where,
      orderBy: { punchedAt: 'desc' },
      take: query.limit,
    });
  }
}

export const attendanceDeviceService = new AttendanceDeviceService();
