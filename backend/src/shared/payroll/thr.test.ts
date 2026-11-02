import { calculateThr, tenureMonths, THR_MIN_MONTHS_FULL, THR_PKWTT_GRACE_DAYS, thrEmploymentEligibility } from './thr';

describe('THR calculator — Permenaker 6/2016 (hardening Business Rule Gap Payroll)', () => {
  describe('tenureMonths', () => {
    it('menghitung bulan penuh (floor)', () => {
      expect(tenureMonths(new Date(Date.UTC(2023, 0, 1)), new Date(Date.UTC(2024, 0, 1)))).toBe(12);
      expect(tenureMonths(new Date(Date.UTC(2023, 5, 15)), new Date(Date.UTC(2024, 3, 1)))).toBe(9); // 15 Jun 2023 → 1 Apr 2024 = 9 bln penuh
      expect(tenureMonths(new Date(Date.UTC(2024, 0, 20)), new Date(Date.UTC(2024, 0, 25)))).toBe(0);
    });
  });

  describe('kelayakan & nominal', () => {
    const wage = 6_000_000;
    const raya = new Date(Date.UTC(2024, 3, 3)); // contoh H-7 Idulfitri

    it('masa kerja ≥ 12 bulan → THR penuh 1× upah', () => {
      const r = calculateThr({ monthlyWage: wage, joinDate: new Date(Date.UTC(2020, 0, 1)), referenceDate: raya });
      expect(r.eligible).toBe(true);
      expect(r.isProrated).toBe(false);
      expect(r.amount).toBe(6_000_000);
    });

    it('masa kerja 6 bulan → prorata (6/12 × upah)', () => {
      const r = calculateThr({ monthlyWage: wage, joinDate: new Date(Date.UTC(2023, 9, 3)), referenceDate: raya }); // 3 Okt 2023 → 3 Apr 2024 = 6 bln
      expect(r.tenureMonths).toBe(6);
      expect(r.isProrated).toBe(true);
      expect(r.amount).toBe(Math.round((6 / THR_MIN_MONTHS_FULL) * wage)); // 3.000.000
      expect(r.amount).toBe(3_000_000);
    });

    it('masa kerja < 1 bulan → tidak berhak', () => {
      const r = calculateThr({ monthlyWage: wage, joinDate: new Date(Date.UTC(2024, 2, 20)), referenceDate: raya });
      expect(r.eligible).toBe(false);
      expect(r.amount).toBe(0);
    });

    it('tepat 1 bulan → prorata 1/12', () => {
      const r = calculateThr({ monthlyWage: wage, joinDate: new Date(Date.UTC(2024, 2, 3)), referenceDate: raya }); // 3 Mar → 3 Apr = 1 bln
      expect(r.tenureMonths).toBe(1);
      expect(r.amount).toBe(Math.round((1 / 12) * wage)); // 500.000
    });

    // ---------------- EXTEND BATCH B.2 ----------------
    it('EDGE 1 — tepat 12 bulan boundary (3 Apr 2023 → 3 Apr 2024) → FULL THR, bukan prorata', () => {
      const join = new Date(Date.UTC(2023, 3, 3));
      const r = calculateThr({ monthlyWage: wage, joinDate: join, referenceDate: raya });
      expect(r.tenureMonths).toBe(12);
      expect(r.isProrated).toBe(false);
      expect(r.amount).toBe(wage);
    });
    it('EDGE 2 — 11 bulan 29 hari (tepat sebelum genap 12 bln) → PRORATA 11/12', () => {
      // join 4 Apr 2023 → reference 3 Apr 2024 = 11 bulan + 30 hari (belum 12 penuh)
      const join = new Date(Date.UTC(2023, 3, 4));
      const r = calculateThr({ monthlyWage: wage, joinDate: join, referenceDate: raya });
      expect(r.tenureMonths).toBe(11);
      expect(r.isProrated).toBe(true);
      expect(r.amount).toBe(Math.round((11 / 12) * wage));
      expect(r.amount).toBe(5_500_000);
    });
    it('EDGE 3 — joinDate = referenceDate, hari SAMA → tenure 0 bulan → TIDAK BERHAK', () => {
      const r = calculateThr({ monthlyWage: wage, joinDate: raya, referenceDate: raya });
      expect(r.tenureMonths).toBe(0);
      expect(r.eligible).toBe(false);
    });
    it('EDGE 4 — wage NEGATIVE atau 0 → amount 0, eligible false (safe guard)', () => {
      const rNeg = calculateThr({ monthlyWage: -500_000, joinDate: new Date(Date.UTC(2020, 0, 1)), referenceDate: raya });
      const rZero = calculateThr({ monthlyWage: 0, joinDate: new Date(Date.UTC(2020, 0, 1)), referenceDate: raya });
      expect(rNeg.amount).toBe(0); expect(rNeg.eligible).toBe(false);
      expect(rZero.amount).toBe(0);
    });
    it('EDGE 5 — karyawan resign end year masa kerja 8 bln 15 hari → prorata 8/12 (acceptance B.2)', () => {
      // Acceptance Criteria B.2: "Karyawan masa kerja 8 bulan → THR = 8/12 x gaji"
      const resignRaya = new Date(Date.UTC(2024, 11, 15)); // THR Natal/akhir tahun
      const join = new Date(Date.UTC(2024, 3, 1)); // join 1 Apr → 15 Des = 8 bln penuh (Apr→Des inclusive bulan count floor 15<1 bln → Des = 8)
      const r = calculateThr({ monthlyWage: wage, joinDate: join, referenceDate: resignRaya });
      expect(r.tenureMonths).toBe(8);
      expect(r.isProrated).toBe(true);
      expect(r.amount).toBe(Math.round((8 / 12) * wage)); // 4.000.000
      expect(r.amount).toBe(4_000_000);
    });
  });

  /**
   * P-C3 — SIAPA yang berhak, bukan BERAPA.
   *
   * `calculateThr` di atas hanya mengukur masa kerja: ia akan menghitung
   * prorata dengan rapi untuk orang yang berhenti dua tahun lalu. Yang
   * memutuskan dia masuk daftar bayar atau tidak adalah fungsi ini.
   *
   * Permenaker 6/2016 Pasal 2-3: THR wajib untuk pekerja yang masih punya
   * hubungan kerja pada hari raya, DITAMBAH pekerja PKWTT yang hubungan
   * kerjanya berakhir dalam 30 hari sebelum hari raya. PKWT yang jangka
   * waktunya sudah berakhir tidak berhak, sedekat apa pun jaraknya.
   */
  describe('kelayakan berdasarkan hubungan kerja (Permenaker 6/2016 Pasal 2-3)', () => {
    const raya = new Date(Date.UTC(2026, 3, 21)); // 21 Apr 2026
    const minus = (days: number) => new Date(raya.getTime() - days * 86_400_000);

    it('masih bekerja pada hari raya → berhak, PKWT maupun PKWTT', () => {
      for (const employmentType of ['PERMANENT', 'CONTRACT', 'PROBATION', 'FREELANCE']) {
        expect(thrEmploymentEligibility({
          employmentType, employmentStatus: 'ACTIVE', status: 'ACTIVE', lastWorkingDate: null, holidayDate: raya,
        })).toEqual({ entitled: true, reason: 'employed-on-holiday' });
      }
    });

    it('masa percobaan tetap karyawan → berhak (jumlahnya diurus prorata)', () => {
      expect(thrEmploymentEligibility({
        employmentType: 'PROBATION', employmentStatus: 'PROBATION', status: 'ACTIVE', lastWorkingDate: null, holidayDate: raya,
      }).entitled).toBe(true);
    });

    it('hari kerja terakhir PADA atau SETELAH hari raya → masih punya hubungan kerja', () => {
      // Resign sudah di-approve, tapi berlakunya belum lewat: pada hari raya
      // orang ini masih pekerja, dan jenis kontraknya tidak relevan.
      for (const lastWorkingDate of [raya, new Date(raya.getTime() + 86_400_000)]) {
        expect(thrEmploymentEligibility({
          employmentType: 'CONTRACT', employmentStatus: 'RESIGNED', status: 'INACTIVE', lastWorkingDate, holidayDate: raya,
        })).toEqual({ entitled: true, reason: 'employed-on-holiday' });
      }
    });

    it('PKWTT berakhir di dalam 30 hari sebelum hari raya → berhak', () => {
      for (const days of [1, 20, THR_PKWTT_GRACE_DAYS]) {
        expect(thrEmploymentEligibility({
          employmentType: 'PERMANENT', employmentStatus: 'RESIGNED', status: 'INACTIVE',
          lastWorkingDate: minus(days), holidayDate: raya,
        })).toEqual({ entitled: true, reason: 'pkwtt-within-grace' });
      }
    });

    it('PKWTT berakhir lebih dari 30 hari sebelum hari raya → tidak berhak', () => {
      for (const days of [THR_PKWTT_GRACE_DAYS + 1, 40, 400]) {
        expect(thrEmploymentEligibility({
          employmentType: 'PERMANENT', employmentStatus: 'RESIGNED', status: 'INACTIVE',
          lastWorkingDate: minus(days), holidayDate: raya,
        })).toEqual({ entitled: false, reason: 'pkwtt-beyond-grace' });
      }
    });

    it('PHK PKWTT diperlakukan sama dengan resign: tenggang 30 hari tetap berlaku', () => {
      // Permenaker tidak membedakan alasan berakhirnya hubungan kerja PKWTT.
      expect(thrEmploymentEligibility({
        employmentType: 'PERMANENT', employmentStatus: 'TERMINATED', status: 'INACTIVE',
        lastWorkingDate: minus(10), holidayDate: raya,
      })).toEqual({ entitled: true, reason: 'pkwtt-within-grace' });
    });

    it('PKWT yang sudah berakhir → tidak berhak, sedekat apa pun', () => {
      for (const employmentType of ['CONTRACT', 'INTERN', 'PROBATION', 'FREELANCE', 'OUTSOURCING']) {
        expect(thrEmploymentEligibility({
          employmentType, employmentStatus: 'CONTRACT_END', status: 'INACTIVE',
          lastWorkingDate: minus(1), holidayDate: raya,
        })).toEqual({ entitled: false, reason: 'pkwt-relationship-ended' });
      }
    });

    it('tenggang dihitung per hari kalender, bukan per jam', () => {
      // Jam pada kolom DateTime tidak boleh memindahkan orang keluar dari
      // tenggang: hari ke-30 jam 23:00 tetap hari ke-30.
      const lateInTheDay = new Date(minus(THR_PKWTT_GRACE_DAYS).getTime() + 23 * 3_600_000);
      expect(thrEmploymentEligibility({
        employmentType: 'PERMANENT', employmentStatus: 'RESIGNED', status: 'INACTIVE',
        lastWorkingDate: lateInTheDay, holidayDate: new Date(raya.getTime() + 3_600_000),
      }).entitled).toBe(true);
    });

    it('sudah berakhir tapi tanggalnya tidak diketahui → tidak dibayar, bukan ditebak', () => {
      // Tanpa lastWorkingDate tidak ada cara membuktikan orang ini masih di
      // dalam tenggang 30 hari. Menebak berarti membayar sebagian orang yang
      // tidak berhak; tidak membayar bisa diperbaiki dengan mengisi datanya.
      for (const employmentStatus of ['RESIGNED', 'TERMINATED', 'CONTRACT_END']) {
        expect(thrEmploymentEligibility({
          employmentType: 'PERMANENT', employmentStatus, status: 'INACTIVE', lastWorkingDate: null, holidayDate: raya,
        })).toEqual({ entitled: false, reason: 'relationship-ended-without-last-working-date' });
      }
    });

    it('nonaktif tanpa jejak berakhirnya hubungan kerja → tidak dibayar', () => {
      // Data yang saling bertentangan: statusnya nonaktif tapi employmentStatus
      // masih ACTIVE dan tidak ada resignation. Membayar berarti menebak.
      expect(thrEmploymentEligibility({
        employmentType: 'PERMANENT', employmentStatus: 'ACTIVE', status: 'INACTIVE', lastWorkingDate: null, holidayDate: raya,
      })).toEqual({ entitled: false, reason: 'inactive-without-last-working-date' });
      expect(thrEmploymentEligibility({
        employmentType: 'PERMANENT', employmentStatus: 'ACTIVE', status: 'ARCHIVED', lastWorkingDate: null, holidayDate: raya,
      }).entitled).toBe(false);
    });
  });
});
