import { Router, Request, Response, NextFunction } from 'express';
import { rateLimit } from 'express-rate-limit';
import { validate } from '@/shared/middleware/RequestValidator';
import { applySchema, companyCodeParamSchema } from './careers.dto';
import { careersService } from './careers.service';
import { Result } from '@/shared/core/Result';

/**
 * PUBLIK — satu-satunya router tanpa `authenticate` selain auth itu sendiri.
 * Pelamar luar tidak punya akun. Pagarnya: rate limit per IP, validasi ketat,
 * halaman hanya hidup bila tenant menyalakannya, dan service hanya menyentuh
 * tiga model recruitment dengan filter companyId eksplisit.
 */
const readLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 300, standardHeaders: true, legacyHeaders: false });
// Melamar menulis ke database; jauh lebih ketat daripada membaca.
const applyLimiter = rateLimit({ windowMs: 60 * 60 * 1000, limit: 10, standardHeaders: true, legacyHeaders: false });

const router = Router();

router.get('/:companyCode/postings', readLimiter, validate(companyCodeParamSchema, 'params'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(Result.success(await careersService.listPostings(String(req.params.companyCode))));
  } catch (error) { next(error); }
});

router.get('/:companyCode/postings/:postingCode', readLimiter, validate(companyCodeParamSchema, 'params'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(Result.success(await careersService.getPosting(
      String(req.params.companyCode), String(req.params.postingCode))));
  } catch (error) { next(error); }
});

router.post('/:companyCode/postings/:postingCode/apply', applyLimiter, validate(companyCodeParamSchema, 'params'), validate(applySchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const receipt = await careersService.apply(
        String(req.params.companyCode), String(req.params.postingCode), req.body);
      res.status(201).json(Result.success(receipt, 'Lamaran diterima'));
    } catch (error) { next(error); }
  });

export default router;
