import type { Request, Response, NextFunction } from 'express';
import { ewaController } from './ewa.controller';
import { ewaService } from './ewa.service';
import { BadRequestError } from '@/shared/exceptions/AppError';

/**
 * ════════════════════════════════════════════════════════════════════════
 * EWA Controller GUARD — UNIT TEST (no DB / no service mock needed!)
 * (Re-Review #5 Rekomendasi user explicit Priority #1 Scenario a)
 * ════════════════════════════════════════════════════════════════════════
 *
 * Scenario: client masih coba-coba kirim earnedGross / periodStart / periodEnd
 * via request body (POST /ewa) atau query param (GET /ewa/my-limit) padahal
 * field ini SUDAH DILARANG (zero-trust architecture — server hitung sendiri).
 *
 * Test hanya fokus di GUARD LAYER di controller (sebelum masuk ke service
 * createRequest / getMyLimitServer). Jadi TIDAK PERLU mock Prisma / repositories
 * sama sekali → pure unit test, cepat & ringan.
 */

type PlainRequest = Partial<Pick<Request, 'body' | 'query' | 'params'>>;
type NextMock = NextFunction & jest.Mock;

function createNextMock(): NextMock {
  return jest.fn() as NextMock;
}

/** Response mock TIDAK BOLEH terpanggil jika guard throw → kita expect status/json TIDAK dipanggil. */
function createResMockFailIfCalled(): any {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe('EWA :: Controller Guards (Zero-Trust earnedGross + periodStart/periodEnd) — Re-Review #5 Coverage', () => {
  beforeEach(() => jest.clearAllMocks());
  afterEach(() => jest.restoreAllMocks());

  describe('POST /ewa createRequest — body guard (reject explicit field terlarang)', () => {
    it('EWA-GUARD CASE1: body mengandung earnedGross → next(BadRequestError) TIDAK masuk service; message WAJIB sebut TIDAK BOLEH dikirim client', async () => {
      const req: PlainRequest = {
        body: {
          earnedGross: 50_000_000, // ✨ SPOOF 50M earnedGross palsu!
          amountRequested: 25_000_000,
          reason: 'keperluan darurat',
        },
      };
      const res = createResMockFailIfCalled();
      const next = createNextMock();

      await ewaController.createRequest(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledTimes(1);
      const err = next.mock.calls[0][0] as any;
      expect(err).toBeInstanceOf(Error);
      expect(err).toBeInstanceOf(BadRequestError);
      // Pesan harus jelas Indonesia + menyebut nama field (sesuai rule user: error message informatif!)
      expect(String(err?.message)).toMatch(/earnedGross/i);
      expect(String(err?.message)).toMatch(/TIDAK BOLEH/i);
      expect(String(err?.message)).toMatch(/menghitung sendiri|server/i);

      // Response TIDAK BOLEH terpanggil (guard reject via next(error), bukan res.send)
      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
    });

    it('EWA-GUARD CASE2: body mengandung periodStart / periodEnd (client coba inject tanggal spoof) → BadRequestError ditolak', async () => {
      const req: PlainRequest = {
        body: {
          amountRequested: 2_000_000,
          reason: 'pengeluaran sekolah',
          periodStart: '2099-01-01T00:00:00.000Z', // SPOOF tanggal depan untuk inflate
          periodEnd: '2099-01-31T23:59:59.999Z',
        },
      };
      const res = createResMockFailIfCalled();
      const next = createNextMock();

      await ewaController.createRequest(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledTimes(1);
      const err = next.mock.calls[0][0];
      expect(err).toBeInstanceOf(BadRequestError);
      expect(String((err as any).message)).toMatch(/periodStart|periodEnd/i);
      expect(String((err as any).message)).toMatch(/TIDAK BOLEH/i);
      expect(String((err as any).message)).toMatch(/payrollPeriodId|auto-detect|bulan ini/i);
    });

    it('EWA-GUARD CASE3: body bersih diteruskan ke service dan menghasilkan response 201', async () => {
      const req: PlainRequest = {
        body: {
          amountRequested: 1_500_000,
          reason: 'izin keluarga',
          adminFee: 0,
        },
      };
      const res = createResMockFailIfCalled();
      const next = createNextMock();
      const created = { id: 'ewa-test-id', requestCode: 'EWA-TEST' };
      const createSpy = jest.spyOn(ewaService, 'createRequest').mockResolvedValue(created as any);

      await ewaController.createRequest(req as Request, res as Response, next);

      expect(createSpy).toHaveBeenCalledTimes(1);
      expect(createSpy).toHaveBeenCalledWith(req.body);
      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true, data: created }));
    });
  });

  describe('GET /ewa/my-limit getMyLimit — query param guard', () => {
    it('EWA-GUARD CASE4: query ?earnedGross=50000000 masih dikirim client → reject BadRequestError (double defense POST+GET)', async () => {
      const req: PlainRequest = {
        query: { earnedGross: '50000000', percent: '60' },
      };
      const res = createResMockFailIfCalled();
      const next = createNextMock();

      await ewaController.getMyLimit(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledTimes(1);
      const err = next.mock.calls[0][0];
      expect(err).toBeInstanceOf(BadRequestError);
      expect(String((err as any).message)).toMatch(/earnedGross/i);
      expect(String((err as any).message)).toMatch(/TIDAK BOLEH|Hapus query/i);

      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
    });
  });
});
