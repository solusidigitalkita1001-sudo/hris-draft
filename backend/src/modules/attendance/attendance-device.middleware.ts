import type { NextFunction, Request, Response } from 'express';
import { AuthError } from '@/shared/exceptions/AppError';
import { attendanceDeviceService, type AuthenticatedDevice } from './attendance-device.service';

export interface DeviceRequest extends Request {
  device?: AuthenticatedDevice;
}

const SCHEME = 'device ';

/**
 * Authenticate clock-in hardware, not a person.
 *
 * A terminal has no session, no cookies and no user: it presents the credential
 * minted when it was registered. This runs instead of `authenticate`, never
 * alongside it — a route behind this middleware carries a device, and the
 * company it may touch is the device's own, never one named in the request.
 */
export async function authenticateDevice(req: DeviceRequest, _res: Response, next: NextFunction): Promise<void> {
  try {
    const header = req.get('authorization');
    if (!header || !header.toLowerCase().startsWith(SCHEME)) {
      throw new AuthError('Device credential required');
    }

    req.device = await attendanceDeviceService.authenticate(header.slice(SCHEME.length).trim());
    next();
  } catch (error) {
    next(error);
  }
}
