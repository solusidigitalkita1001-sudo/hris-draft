import {
  calcMonthlyHeadcountByDepartment,
  rollingAttritionRate90Days,
  getFteToContractRatio,
  EmploymentStatus,
  HeadcountEmployee,
} from './headcount-aggregates';

const EMPLOYEE_POOL: HeadcountEmployee[] = [
  { employeeId: 'E1', departmentId: 'ENGINEERING', joinedAt: '2023-01-10', employmentStatus: EmploymentStatus.FTE, monthlySalaryIDR: 15_000_000 },
  { employeeId: 'E2', departmentId: 'ENGINEERING', joinedAt: '2023-04-20', employmentStatus: EmploymentStatus.PKWTT, monthlySalaryIDR: 11_000_000 },
  { employeeId: 'E3', departmentId: 'ENGINEERING', joinedAt: '2024-08-01', employmentStatus: EmploymentStatus.FTE, monthlySalaryIDR: 13_500_000 },
  { employeeId: 'E4', departmentId: 'ENGINEERING', joinedAt: '2026-08-15', employmentStatus: EmploymentStatus.INTERN, monthlySalaryIDR: 4_000_000 },
  { employeeId: 'E5', departmentId: 'HR', joinedAt: '2022-06-01', employmentStatus: EmploymentStatus.FTE, monthlySalaryIDR: 16_000_000 },
  { employeeId: 'E6', departmentId: 'HR', joinedAt: '2026-06-01', resignedAt: '2026-08-29', employmentStatus: EmploymentStatus.PKWTT, monthlySalaryIDR: 9_500_000 },
  { employeeId: 'E7', departmentId: 'FINANCE', joinedAt: '2025-11-01', employmentStatus: EmploymentStatus.FTE, monthlySalaryIDR: 14_200_000 },
  { employeeId: 'E8', departmentId: 'FINANCE', joinedAt: '2024-01-15', employmentStatus: EmploymentStatus.PKWTT, monthlySalaryIDR: 9_000_000 },
  { employeeId: 'E9', departmentId: 'FINANCE', joinedAt: '2026-06-01', employmentStatus: EmploymentStatus.PKWTT, monthlySalaryIDR: 10_000_000 },
  { employeeId: 'E10', departmentId: 'OPERATION', joinedAt: '2025-04-05', resignedAt: '2026-09-14', employmentStatus: EmploymentStatus.PKWTT, monthlySalaryIDR: 8_500_000 },
  { employeeId: 'E11', departmentId: 'OPERATION', joinedAt: '2024-09-18', employmentStatus: EmploymentStatus.FTE, monthlySalaryIDR: 12_800_000 },
  { employeeId: 'E12', departmentId: 'OPERATION', joinedAt: '2026-09-01', employmentStatus: EmploymentStatus.PROJECT, monthlySalaryIDR: 11_500_000 },
  { employeeId: 'E13', departmentId: 'ENGINEERING', joinedAt: '2026-09-03', employmentStatus: EmploymentStatus.PKWTT, monthlySalaryIDR: 12_000_000 },
];

describe('E.3 Reporting Aggregates Pure (6 Jest pure)', () => {
  test('CASE1 Monthly headcount reference 2026-09: ENGINEERING 5 orang total, OPERATION join+resign bulan 9 keduanya = 1, salaryBill >= 135jt', () => {
    const r = calcMonthlyHeadcountByDepartment(EMPLOYEE_POOL, '2026-09-15');
    expect(r.totalHeadcount).toBeGreaterThanOrEqual(12);
    expect(r.overall.totalHeadcount).toBeGreaterThanOrEqual(12);
    expect(r.overall.fteCount + r.overall.contractCount + r.overall.internCount + r.overall.projectCount).toBeGreaterThanOrEqual(12);
    expect(r.byDepartment['ENGINEERING'].totalHeadcount).toBe(5);
    expect(r.overall.salaryBillMonthlyIDR).toBeGreaterThanOrEqual(135_000_000);
    expect(r.byDepartment['HR'].resignedThisMonth).toBe(0);
    expect(r.byDepartment['OPERATION'].joinThisMonth).toBe(1);
    expect(r.byDepartment['OPERATION'].resignedThisMonth).toBe(1);
  });

  test('CASE2 Oktober 2026: E10 resign 14 Sept = keluar bulan 9, Oktober total = 11 employee, E6 (resign 29Aug) NOT counted di Okt', () => {
    const okt = calcMonthlyHeadcountByDepartment(EMPLOYEE_POOL, '2026-10-05');
    expect(okt.overall.totalHeadcount).toBe(11);
    const hrOkt = okt.byDepartment['HR'];
    expect(hrOkt.totalHeadcount).toBe(1);
    expect(okt.byDepartment['OPERATION'].resignedThisMonth).toBe(0);
    expect(okt.byDepartment['OPERATION'].totalHeadcount).toBe(2);
  });

  test('CASE3 Attrition rolling 90 hari sampai 2026-09-30: E10 + E6 resign = 2 orang, avgHeadcount >= 10, attrition <= 25%', () => {
    const r = rollingAttritionRate90Days(EMPLOYEE_POOL, '2026-09-30');
    expect(r.resignsInWindow).toBe(2);
    expect(r.denominatorAverageHeadcount).toBeGreaterThanOrEqual(10);
    expect(r.attritionRateDecimal).toBeLessThanOrEqual(0.25);
    expect(r.hiresInWindow).toBeGreaterThanOrEqual(3);
  });

  test('CASE4 Rolling attrition Desember 2026 tidak ada resign baru => attritionRate 0 karena window 90 berakhir di 31Des 2026', () => {
    const r = rollingAttritionRate90Days(EMPLOYEE_POOL, '2026-12-31');
    expect(r.resignsInWindow).toBe(0);
    expect(r.attritionRateDecimal).toBe(0);
    expect(r.endHeadcount).toBe(11);
  });

  test('CASE5 FTE to Contract ratio Oktober 2026: overall ratio >= 1, HR = FTE_HEAVY, imbalanceDepartments >= 3 dept', () => {
    const okt = calcMonthlyHeadcountByDepartment(EMPLOYEE_POOL, '2026-10-05');
    const ratio = getFteToContractRatio(okt.byDepartment, 1.0);
    expect(ratio.totalFte + ratio.totalContract).toBeGreaterThanOrEqual(10);
    expect(ratio.overallRatio).toBeGreaterThanOrEqual(1);
    const hr = ratio.allDepartments.find((d) => d.departmentId === 'HR');
    expect(hr?.imbalanceFlag).toBe('FTE_HEAVY');
    expect(ratio.imbalanceDepartments.length).toBeGreaterThanOrEqual(3);
  });

  test('CASE6 Headcount invalid employee tanpa join / tanpa department: issues array terisi, total headcount hanya yang valid', () => {
    const dataset: HeadcountEmployee[] = [
      ...EMPLOYEE_POOL,
      { employeeId: 'BAD1', departmentId: '', joinedAt: '2026-10-01', employmentStatus: EmploymentStatus.FTE },
      { employeeId: 'BAD2', departmentId: 'OPERATION', joinedAt: 'TANGGAL_SALAH' as any, employmentStatus: EmploymentStatus.PKWTT },
    ];
    const r = calcMonthlyHeadcountByDepartment(dataset, '2026-10-15');
    expect(r.issues.length).toBeGreaterThanOrEqual(2);
    expect(r.overall.totalHeadcount).toBe(11);
    const oktTenureMedian = r.byDepartment['ENGINEERING'].medianTenureDays;
    expect(oktTenureMedian).toBeGreaterThan(100);
  });
});
