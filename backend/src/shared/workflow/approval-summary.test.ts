import {
  buildApprovalSummary,
  buildSummaryLines,
  buildSummaryTitle,
  formatSummaryCurrency,
  formatSummaryDate,
  formatSummaryNumber,
  formatSummaryPeriod,
  formatSummaryTime,
  humanizeCode,
  isSummarizableReferenceType,
  normalizeReferenceType,
  resolveSummaryRequester,
  truncateSummaryText,
  SUMMARY_TEXT_MAX_LENGTH,
} from './approval-summary';

/** Nilai Decimal Prisma sampai ke pemetaan sebagai objek dengan `toString()`. */
function decimal(value: string) {
  return { toString: () => value } as unknown as number;
}

const employee = { fullName: 'Maya Anggraini', employeeNumber: 'EMP-0007' };

function labelsOf(lines: Array<{ label: string; value: string }>) {
  return lines.map((line) => line.label);
}

function valueOf(lines: Array<{ label: string; value: string }>, label: string) {
  return lines.find((line) => line.label === label)?.value;
}

describe('approval summary — formatter', () => {
  it('memformat tanggal dd/MM/yyyy dari komponen UTC (tidak bergeser oleh timezone proses)', () => {
    expect(formatSummaryDate(new Date(Date.UTC(2026, 0, 5)))).toBe('05/01/2026');
    expect(formatSummaryDate(new Date(Date.UTC(2026, 11, 31, 23, 59)))).toBe('31/12/2026');
    expect(formatSummaryDate(null)).toBeNull();
  });

  it('memformat jam HH:mm', () => {
    expect(formatSummaryTime(new Date(Date.UTC(2026, 0, 5, 9, 5)))).toBe('09:05');
    expect(formatSummaryTime(null)).toBeNull();
  });

  it('meringkas periode: tanggal sama menjadi satu tanggal, satu sisi kosong tetap terbaca', () => {
    const start = new Date(Date.UTC(2026, 1, 2));
    const end = new Date(Date.UTC(2026, 1, 4));
    expect(formatSummaryPeriod(start, end)).toBe('02/02/2026 – 04/02/2026');
    expect(formatSummaryPeriod(start, start)).toBe('02/02/2026');
    expect(formatSummaryPeriod(start, null)).toBe('02/02/2026');
    expect(formatSummaryPeriod(null, end)).toBe('04/02/2026');
    expect(formatSummaryPeriod(null, null)).toBeNull();
  });

  it('memformat angka dengan notasi Indonesia dan membuang desimal nol', () => {
    expect(formatSummaryNumber(1500000)).toBe('1.500.000');
    expect(formatSummaryNumber(1.5)).toBe('1,5');
    expect(formatSummaryNumber(3)).toBe('3');
    expect(formatSummaryNumber(-2500.25)).toBe('-2.500,25');
    expect(formatSummaryNumber(null)).toBeNull();
  });

  it('memformat rupiah dengan prefiks Rp', () => {
    expect(formatSummaryCurrency(5000000)).toBe('Rp 5.000.000');
    expect(formatSummaryCurrency(null)).toBeNull();
  });

  it('memotong teks bebas di batas kata dan menormalkan spasi', () => {
    expect(truncateSummaryText('  Keperluan   keluarga  ')).toBe('Keperluan keluarga');
    expect(truncateSummaryText(null)).toBeNull();
    expect(truncateSummaryText('   ')).toBeNull();

    const long = 'Menghadiri acara keluarga besar di kampung halaman bersama orang tua dan saudara selama beberapa hari penuh tanpa gangguan';
    const truncated = truncateSummaryText(long) as string;
    expect(truncated.endsWith('…')).toBe(true);
    expect(truncated.length).toBeLessThanOrEqual(SUMMARY_TEXT_MAX_LENGTH + 1);
    expect(long.startsWith(truncated.slice(0, -1))).toBe(true);
  });

  it('memanusiakan kode enum/referensi', () => {
    expect(humanizeCode('LEAVE_APPROVAL')).toBe('Leave Approval');
    expect(humanizeCode('PROMOTION')).toBe('Promotion');
  });
});

describe('approval summary — judul & tipe yang dikenal', () => {
  it('memberi judul bahasa Indonesia untuk setiap tipe dokumen yang dipakai modul', () => {
    expect(buildSummaryTitle('LEAVE_REQUEST')).toBe('Pengajuan Cuti');
    expect(buildSummaryTitle('LOAN_REQUEST')).toBe('Pengajuan Pinjaman');
    expect(buildSummaryTitle('BUSINESS_TRIP')).toBe('Pengajuan Perjalanan Dinas');
    expect(buildSummaryTitle('EXPENSE_CLAIM')).toBe('Pengajuan Klaim Biaya');
    expect(buildSummaryTitle('SHIFT_SWAP_REQUEST')).toBe('Pengajuan Tukar Shift');
    expect(buildSummaryTitle('OVERTIME_REQUEST')).toBe('Pengajuan Lembur');
    expect(buildSummaryTitle('CAREER_MOVEMENT')).toBe('Pengajuan Perubahan Karier');
    expect(buildSummaryTitle('PERMISSION_REQUEST')).toBe('Pengajuan Izin');
    expect(buildSummaryTitle('ATTENDANCE_CORRECTION')).toBe('Pengajuan Koreksi Absensi');
  });

  it('tipe tak dikenal tetap dapat judul generik yang terbaca, bukan UUID', () => {
    expect(buildSummaryTitle('LEAVE_APPROVAL')).toBe('Pengajuan Leave Approval');
    expect(buildSummaryTitle('')).toBe('Pengajuan');
  });

  it('menandai hanya tipe dengan pemetaan ringkasan sebagai summarizable', () => {
    expect(isSummarizableReferenceType('LEAVE_REQUEST')).toBe(true);
    expect(isSummarizableReferenceType('LEAVE_APPROVAL')).toBe(false);
    expect(isSummarizableReferenceType('toString')).toBe(false);
  });

  it('menormalkan tipe referensi: data lama bertipe lowercase tetap dikenali', () => {
    // MySQL membandingkan reference_type case-insensitive, jadi instance seed
    // lama bisa menyimpan `leave_request` untuk dokumen yang sama.
    expect(normalizeReferenceType('  leave_request ')).toBe('LEAVE_REQUEST');
    expect(isSummarizableReferenceType('leave_request')).toBe(true);
    expect(buildSummaryTitle('leave_request')).toBe('Pengajuan Cuti');
    expect(buildSummaryLines('leave_request', { totalDays: 2 })).toEqual([{ label: 'Durasi', value: '2 hari' }]);
  });
});

describe('buildSummaryLines — per tipe dokumen', () => {
  it('LEAVE_REQUEST: jenis cuti, periode, durasi, alasan', () => {
    const lines = buildSummaryLines('LEAVE_REQUEST', {
      employee,
      leaveType: { name: 'Cuti Tahunan' },
      startDate: new Date(Date.UTC(2026, 9, 1)),
      endDate: new Date(Date.UTC(2026, 9, 3)),
      totalDays: 3,
      reason: 'Acara keluarga',
    });
    expect(labelsOf(lines)).toEqual(['Jenis cuti', 'Periode', 'Durasi', 'Alasan']);
    expect(valueOf(lines, 'Jenis cuti')).toBe('Cuti Tahunan');
    expect(valueOf(lines, 'Periode')).toBe('01/10/2026 – 03/10/2026');
    expect(valueOf(lines, 'Durasi')).toBe('3 hari');
    expect(valueOf(lines, 'Alasan')).toBe('Acara keluarga');
  });

  it('LOAN_REQUEST: jumlah dari Decimal, tenor + angsuran, tujuan', () => {
    const lines = buildSummaryLines('LOAN_REQUEST', {
      employee,
      loanType: { name: 'Pinjaman Darurat' },
      amount: decimal('12000000.00'),
      totalInstallments: 12,
      installmentAmount: decimal('1000000.00'),
      reason: 'Biaya pengobatan',
    });
    expect(valueOf(lines, 'Jenis pinjaman')).toBe('Pinjaman Darurat');
    expect(valueOf(lines, 'Jumlah')).toBe('Rp 12.000.000');
    expect(valueOf(lines, 'Tenor')).toBe('12 x angsuran Rp 1.000.000');
    expect(valueOf(lines, 'Tujuan')).toBe('Biaya pengobatan');
  });

  it('BUSINESS_TRIP: tujuan, periode, estimasi biaya, keperluan', () => {
    const lines = buildSummaryLines('BUSINESS_TRIP', {
      employee,
      destination: 'Surabaya',
      purpose: 'Audit cabang',
      startDate: new Date(Date.UTC(2026, 2, 10)),
      endDate: new Date(Date.UTC(2026, 2, 12)),
      estimatedCost: decimal('4500000'),
    });
    expect(valueOf(lines, 'Tujuan')).toBe('Surabaya');
    expect(valueOf(lines, 'Periode')).toBe('10/03/2026 – 12/03/2026');
    expect(valueOf(lines, 'Estimasi biaya')).toBe('Rp 4.500.000');
    expect(valueOf(lines, 'Keperluan')).toBe('Audit cabang');
  });

  it('EXPENSE_CLAIM: kategori berlabel Indonesia, nominal, tanggal', () => {
    const lines = buildSummaryLines('EXPENSE_CLAIM', {
      employee,
      category: 'TRANSPORTATION',
      amount: decimal('250000'),
      expenseDate: new Date(Date.UTC(2026, 3, 7)),
      description: 'Taksi bandara',
      trip: { destination: 'Medan' },
    });
    expect(valueOf(lines, 'Kategori')).toBe('Transportasi');
    expect(valueOf(lines, 'Nominal')).toBe('Rp 250.000');
    expect(valueOf(lines, 'Tanggal pengeluaran')).toBe('07/04/2026');
    expect(valueOf(lines, 'Perjalanan dinas')).toBe('Medan');
    expect(valueOf(lines, 'Keterangan')).toBe('Taksi bandara');
  });

  it('SHIFT_SWAP_REQUEST: tanggal shift dan rekan tujuan tukar', () => {
    const lines = buildSummaryLines('SHIFT_SWAP_REQUEST', {
      requesterEmployee: employee,
      targetEmployee: { fullName: 'Budi Santoso', employeeNumber: 'EMP-0012' },
      shiftDate: new Date(Date.UTC(2026, 4, 18)),
      reason: 'Ada keperluan keluarga',
    });
    expect(valueOf(lines, 'Tanggal shift')).toBe('18/05/2026');
    expect(valueOf(lines, 'Tukar dengan')).toBe('Budi Santoso (EMP-0012)');
  });

  it('OVERTIME_REQUEST: tanggal, durasi jam desimal, rentang jam', () => {
    const lines = buildSummaryLines('OVERTIME_REQUEST', {
      employee,
      date: new Date(Date.UTC(2026, 5, 2)),
      startTime: new Date(Date.UTC(2026, 5, 2, 17, 0)),
      endTime: new Date(Date.UTC(2026, 5, 2, 19, 30)),
      durationHours: decimal('2.50'),
      reason: 'Closing laporan bulanan',
    });
    expect(valueOf(lines, 'Tanggal')).toBe('02/06/2026');
    expect(valueOf(lines, 'Durasi')).toBe('2,5 jam');
    expect(valueOf(lines, 'Jam')).toBe('17:00 – 19:30');
  });

  it('CAREER_MOVEMENT: jenis transaksi, posisi tujuan, tanggal efektif', () => {
    const lines = buildSummaryLines('CAREER_MOVEMENT', {
      employee,
      transactionType: 'PROMOTION',
      fromPosition: { name: 'Staff HR' },
      toPosition: { name: 'Supervisor HR' },
      toDepartment: { name: 'Human Capital' },
      effectiveDate: new Date(Date.UTC(2026, 6, 1)),
    });
    expect(valueOf(lines, 'Jenis transaksi')).toBe('Promosi');
    expect(valueOf(lines, 'Posisi tujuan')).toBe('Staff HR → Supervisor HR');
    expect(valueOf(lines, 'Departemen tujuan')).toBe('Human Capital');
    expect(valueOf(lines, 'Tanggal efektif')).toBe('01/07/2026');
  });

  it('PERMISSION_REQUEST: jenis izin berlabel, periode, durasi jam', () => {
    const lines = buildSummaryLines('PERMISSION_REQUEST', {
      employee,
      type: 'WORK_FROM_HOME',
      startDate: new Date(Date.UTC(2026, 7, 11)),
      endDate: new Date(Date.UTC(2026, 7, 11)),
      duration: 4,
      reason: 'Menunggu teknisi internet',
    });
    expect(valueOf(lines, 'Jenis izin')).toBe('Kerja dari Rumah');
    expect(valueOf(lines, 'Periode')).toBe('11/08/2026');
    expect(valueOf(lines, 'Durasi')).toBe('4 jam');
  });

  it('ATTENDANCE_CORRECTION: tanggal dan jam yang diajukan', () => {
    const lines = buildSummaryLines('ATTENDANCE_CORRECTION', {
      employee,
      date: new Date(Date.UTC(2026, 8, 9)),
      requestedCheckIn: new Date(Date.UTC(2026, 8, 9, 8, 2)),
      requestedCheckOut: null,
      reason: 'Lupa absen masuk',
    });
    expect(valueOf(lines, 'Tanggal absensi')).toBe('09/09/2026');
    expect(valueOf(lines, 'Jam masuk diajukan')).toBe('08:02');
    expect(labelsOf(lines)).not.toContain('Jam keluar diajukan');
  });

  it('melewati baris yang datanya kosong alih-alih menampilkan nilai palsu', () => {
    const lines = buildSummaryLines('LEAVE_REQUEST', {
      employee,
      leaveType: null,
      startDate: new Date(Date.UTC(2026, 9, 1)),
      endDate: new Date(Date.UTC(2026, 9, 1)),
      totalDays: null,
      reason: '   ',
    });
    expect(labelsOf(lines)).toEqual(['Periode']);
  });

  it('tipe tak dikenal dan dokumen terhapus menghasilkan lines kosong tanpa melempar error', () => {
    expect(buildSummaryLines('LEAVE_APPROVAL', { employee })).toEqual([]);
    expect(buildSummaryLines('LEAVE_REQUEST', null)).toEqual([]);
    expect(buildSummaryLines('LEAVE_REQUEST', undefined)).toEqual([]);
  });
});

describe('resolveSummaryRequester', () => {
  it('membaca relasi employee, atau requesterEmployee untuk tukar shift', () => {
    expect(resolveSummaryRequester({ employee })).toEqual({
      requesterName: 'Maya Anggraini',
      requesterNumber: 'EMP-0007',
    });
    expect(resolveSummaryRequester({ requesterEmployee: employee }).requesterName).toBe('Maya Anggraini');
  });

  it('mengembalikan null saat pengaju tidak dapat diketahui', () => {
    expect(resolveSummaryRequester(null)).toEqual({ requesterName: null, requesterNumber: null });
    expect(resolveSummaryRequester({ employee: {} })).toEqual({ requesterName: null, requesterNumber: null });
  });
});

describe('buildApprovalSummary', () => {
  it('menyusun kontrak seragam: judul, identitas pengaju, dan lines', () => {
    expect(
      buildApprovalSummary('LEAVE_REQUEST', {
        employee,
        leaveType: { name: 'Cuti Tahunan' },
        startDate: new Date(Date.UTC(2026, 9, 1)),
        endDate: new Date(Date.UTC(2026, 9, 1)),
        totalDays: 1,
        reason: 'Kontrol kesehatan',
      }),
    ).toEqual({
      title: 'Pengajuan Cuti',
      requesterName: 'Maya Anggraini',
      requesterNumber: 'EMP-0007',
      lines: [
        { label: 'Jenis cuti', value: 'Cuti Tahunan' },
        { label: 'Periode', value: '01/10/2026' },
        { label: 'Durasi', value: '1 hari' },
        { label: 'Alasan', value: 'Kontrol kesehatan' },
      ],
    });
  });

  it('instance lama bertipe tak dikenal tetap punya ringkasan (judul generik, lines kosong)', () => {
    expect(buildApprovalSummary('LEAVE_APPROVAL', null)).toEqual({
      title: 'Pengajuan Leave Approval',
      requesterName: null,
      requesterNumber: null,
      lines: [],
    });
  });
});
