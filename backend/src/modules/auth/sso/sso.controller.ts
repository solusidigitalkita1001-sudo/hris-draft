import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '@/shared/middleware/Authenticate';
import { Result } from '@/shared/core/Result';
import { BadRequestError } from '@/shared/exceptions/AppError';
import { ssoService } from './sso.service';
import type { RegisterSsoProviderDTO, UpdateSsoProviderDTO } from './sso.dto';

function activeCompany(req: AuthenticatedRequest): string {
  const companyId = req.user?.companyId;
  if (!companyId) throw new BadRequestError('Akun ini tidak tertaut ke perusahaan aktif');
  return companyId;
}

export class SsoProviderController {
  async register(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const provider = await ssoService.register(activeCompany(req), req.body as RegisterSsoProviderDTO);
      res.status(201).json(
        Result.success(
          provider,
          'Penyedia SSO terdaftar. Daftarkan redirectUri di atas pada konfigurasi penyedia identitas.',
        ),
      );
    } catch (error) { next(error); }
  }

  async list(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      res.json(Result.success(await ssoService.list(activeCompany(req))));
    } catch (error) { next(error); }
  }

  async update(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      res.json(Result.success(
        await ssoService.update(activeCompany(req), String(req.params.id), req.body as UpdateSsoProviderDTO),
      ));
    } catch (error) { next(error); }
  }

  async remove(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      res.json(Result.success(await ssoService.remove(activeCompany(req), String(req.params.id))));
    } catch (error) { next(error); }
  }
}

export const ssoProviderController = new SsoProviderController();
