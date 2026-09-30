import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '@/shared/middleware/Authenticate';
import { Result } from '@/shared/core/Result';
import { BadRequestError } from '@/shared/exceptions/AppError';
import { AttendanceDevicePunchStatus } from '@prisma/client';
import { attendanceDeviceService } from './attendance-device.service';
import type { DeviceRequest } from './attendance-device.middleware';
import type {
  AttendanceDevicePunchBatchDTO,
  AttendanceDevicePunchQueryDTO,
  RegisterAttendanceDeviceDTO,
  UpdateAttendanceDeviceDTO,
} from './attendance-device.dto';

function activeCompany(req: AuthenticatedRequest): string {
  const companyId = req.user?.companyId;
  if (!companyId) throw new BadRequestError('Akun ini tidak tertaut ke perusahaan aktif');
  return companyId;
}

export class AttendanceDeviceController {
  async register(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { device, token } = await attendanceDeviceService.register(
        activeCompany(req),
        req.body as RegisterAttendanceDeviceDTO,
      );
      // The secret appears here and nowhere else, ever. Say so in the response
      // so whoever configures the terminal does not assume they can look it up.
      res.status(201).json(
        Result.success(
          {
            id: device.id,
            name: device.name,
            serialNumber: device.serialNumber,
            branchId: device.branchId,
            isActive: device.isActive,
            token,
          },
          'Device registered. Store the token now — it is not retrievable later.',
        ),
      );
    } catch (error) { next(error); }
  }

  async list(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const query = req.query as unknown as { isActive?: 'true' | 'false' };
      res.json(Result.success(await attendanceDeviceService.list(activeCompany(req), query)));
    } catch (error) { next(error); }
  }

  async update(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const device = await attendanceDeviceService.update(
        activeCompany(req),
        String(req.params.id),
        req.body as UpdateAttendanceDeviceDTO,
      );
      res.json(Result.success({ id: device.id, name: device.name, isActive: device.isActive, branchId: device.branchId }));
    } catch (error) { next(error); }
  }

  async punchLog(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const query = req.query as unknown as AttendanceDevicePunchQueryDTO;
      res.json(Result.success(await attendanceDeviceService.punchLog(activeCompany(req), String(req.params.id), query)));
    } catch (error) { next(error); }
  }

  /**
   * The terminal-facing endpoint. Answers 200 with a per-punch report even when
   * some punches were refused: the terminal needs to know which of its records
   * the server accepted so it can stop resending them, and a blanket failure
   * would make it retry the whole batch forever.
   */
  async ingest(req: DeviceRequest, res: Response, next: NextFunction) {
    try {
      if (!req.device) throw new BadRequestError('Device context is missing');
      const { punches } = req.body as AttendanceDevicePunchBatchDTO;
      const outcomes = await attendanceDeviceService.ingest(req.device, punches);

      const tally = outcomes.reduce<Record<string, number>>((acc, outcome) => {
        acc[outcome.status] = (acc[outcome.status] ?? 0) + 1;
        return acc;
      }, {});

      res.json(
        Result.success(
          {
            received: outcomes.length,
            applied: tally[AttendanceDevicePunchStatus.APPLIED] ?? 0,
            duplicate: tally[AttendanceDevicePunchStatus.DUPLICATE] ?? 0,
            unmatched: tally[AttendanceDevicePunchStatus.UNMATCHED_EMPLOYEE] ?? 0,
            rejected: tally[AttendanceDevicePunchStatus.REJECTED] ?? 0,
            outcomes,
          },
          'Punches processed',
        ),
      );
    } catch (error) { next(error); }
  }
}

export const attendanceDeviceController = new AttendanceDeviceController();
