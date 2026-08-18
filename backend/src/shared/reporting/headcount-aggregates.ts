export enum EmploymentStatus {
  FTE = 'FTE',
  PKWTT = 'PKWTT',
  INTERN = 'INTERN',
  PROJECT = 'PROJECT',
}

export interface HeadcountEmployee {
  employeeId: string;
  departmentId: string;
  joinedAt: string | Date;
  resignedAt?: string | Date | null;
  employmentStatus: EmploymentStatus | string;
  isActive?: boolean;
  monthlySalaryIDR?: number | null;
}

export interface DepartmentHeadcountResult {
  departmentId: string;
  monthReferenceISO: string;
  totalHeadcount: number;
  fteCount: number;
  contractCount: number;
  internCount: number;
  projectCount: number;
  avgTenureDays: number;
  medianTenureDays: number;
  joinThisMonth: number;
  resignedThisMonth: number;
  attritionThisMonthDecimal: number;
  salaryBillMonthlyIDR: number;
}

export interface RollingAttrition90Result {
  rollingEndDateISO: string;
  rollingStartDateISO: string;
  numeratorResignCount: number;
  denominatorAverageHeadcount: number;
  attritionRateDecimal: number;
  startHeadcount: number;
  endHeadcount: number;
  hiresInWindow: number;
  resignsInWindow: number;
}

export interface FTEContractRatioDept {
  departmentId: string;
  ratioFtePerContract: number;
  fteCount: number;
  contractCount: number;
  imbalanceFlag: 'OK' | 'FTE_HEAVY' | 'CONTRACT_HEAVY';
}

export interface FTERatioResult {
  overallRatio: number;
  totalFte: number;
  totalContract: number;
  totalIntern: number;
  totalProject: number;
  imbalanceDepartments: FTEContractRatioDept[];
  allDepartments: FTEContractRatioDept[];
}

function toDate(d: Date | string | null | undefined): Date | null {
  if (!d) return null;
  if (d instanceof Date) return d;
  const parsed = new Date(d);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function startOfMonth(date: Date): Date {
  const y = date.getFullYear();
  const m = date.getMonth();
  return new Date(Date.UTC(y, m, 1, 0, 0, 0));
}
function endOfMonth(date: Date): Date {
  const y = date.getFullYear();
  const m = date.getMonth();
  return new Date(Date.UTC(y, m + 1, 0, 23, 59, 59, 999));
}
function addDays(d: Date, days: number): Date {
  return new Date(d.getTime() + days * 86_400_000);
}
function daysBetween(a: Date, b: Date): number {
  const MS = 86_400_000;
  return Math.round((b.getTime() - a.getTime()) / MS);
}
function median(nums: number[]): number {
  if (!nums.length) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  if (s.length % 2 === 0) return (s[mid - 1] + s[mid]) / 2;
  return s[mid];
}
function classifyStatus(s: string | EmploymentStatus): EmploymentStatus {
  if (!s) return EmploymentStatus.PKWTT;
  const upper = String(s).toUpperCase().trim();
  switch (upper) {
    case 'FTE':
    case 'PERMANENT':
    case 'TETAP':
    case 'PKWTT':
      return EmploymentStatus.FTE;
    case 'CONTRACT':
    case 'PKWT':
    case 'KONTRAK':
      return EmploymentStatus.PKWTT;
    case 'INTERN':
    case 'MAGANG':
    case 'APPRENTICE':
      return EmploymentStatus.INTERN;
    case 'PROJECT':
    case 'PROYEK':
    case 'OUTSOURCE':
      return EmploymentStatus.PROJECT;
    default:
      return EmploymentStatus.PKWTT;
  }
}

function countStatus(employees: HeadcountEmployee[]): Record<EmploymentStatus, number> {
  const r = { [EmploymentStatus.FTE]: 0, [EmploymentStatus.PKWTT]: 0, [EmploymentStatus.INTERN]: 0, [EmploymentStatus.PROJECT]: 0 };
  for (const e of employees) {
    r[classifyStatus(e.employmentStatus)]++;
  }
  return r;
}

function employeeActiveInMonth(e: HeadcountEmployee, refMonthStart: Date, refMonthEnd: Date): boolean {
  const join = toDate(e.joinedAt);
  if (!join) return false;
  const resign = toDate(e.resignedAt);
  if (e.isActive === false && resign && resign.getTime() < refMonthStart.getTime()) return false;
  if (join.getTime() > refMonthEnd.getTime()) return false;
  if (resign && resign.getTime() < refMonthStart.getTime()) return false;
  return true;
}

function effectiveJoinInMonth(e: HeadcountEmployee, start: Date, end: Date): boolean {
  const j = toDate(e.joinedAt);
  if (!j) return false;
  return j.getTime() >= start.getTime() && j.getTime() <= end.getTime();
}
function effectiveResignInMonth(e: HeadcountEmployee, start: Date, end: Date): boolean {
  const r = toDate(e.resignedAt);
  if (!r) return false;
  return r.getTime() >= start.getTime() && r.getTime() <= end.getTime();
}

export function calcMonthlyHeadcountByDepartment(
  employees: HeadcountEmployee[],
  referenceMonthOrDate: string | Date = new Date(),
): {
  overall: DepartmentHeadcountResult;
  byDepartment: Record<string, DepartmentHeadcountResult>;
  monthReferenceISO: string;
  totalHeadcount: number;
  issues: string[];
} {
  const ref = toDate(referenceMonthOrDate) ?? new Date();
  const monthStart = startOfMonth(ref);
  const monthEnd = endOfMonth(ref);
  const monthReferenceISO = monthStart.toISOString().slice(0, 7);

  const byDept = new Map<string, HeadcountEmployee[]>();
  const overallActive: HeadcountEmployee[] = [];
  const issues: string[] = [];

  for (const e of employees) {
    if (!e.departmentId) {
      issues.push(`Employee ${e.employeeId || '?'} tanpa departmentId dikeluarkan dari kalkulasi headcount.`);
      continue;
    }
    if (!toDate(e.joinedAt)) {
      issues.push(`Employee ${e.employeeId || '?'} tanpa joinedAt valid dikeluarkan.`);
      continue;
    }
    if (!employeeActiveInMonth(e, monthStart, monthEnd)) continue;
    overallActive.push(e);
    if (!byDept.has(e.departmentId)) byDept.set(e.departmentId, []);
    byDept.get(e.departmentId)!.push(e);
  }

  function buildForGroup(list: HeadcountEmployee[], departmentId: string): DepartmentHeadcountResult {
    const c = countStatus(list);
    const tenuresDays = list.map((e) => {
      const join = toDate(e.joinedAt)!;
      const refEnd = (toDate(e.resignedAt) && toDate(e.resignedAt)!.getTime() < monthEnd.getTime())
        ? toDate(e.resignedAt)!
        : monthEnd;
      return Math.max(0, daysBetween(join, refEnd));
    });
    const fte = c[EmploymentStatus.FTE];
    const contract = c[EmploymentStatus.PKWTT] + c[EmploymentStatus.PROJECT];
    const attrition = fte + contract > 0
      ? list.filter((e) => effectiveResignInMonth(e, monthStart, monthEnd) && classifyStatus(e.employmentStatus) !== EmploymentStatus.INTERN).length / (fte + contract)
      : 0;
    const sal = list.reduce((sum, e) => sum + (Number(e.monthlySalaryIDR) || 0), 0);
    const avg = tenuresDays.length ? Math.round(tenuresDays.reduce((a, b) => a + b, 0) / tenuresDays.length) : 0;
    return {
      departmentId,
      monthReferenceISO,
      totalHeadcount: list.length,
      fteCount: fte,
      contractCount: contract,
      internCount: c[EmploymentStatus.INTERN],
      projectCount: c[EmploymentStatus.PROJECT],
      avgTenureDays: avg,
      medianTenureDays: median(tenuresDays),
      joinThisMonth: list.filter((e) => effectiveJoinInMonth(e, monthStart, monthEnd)).length,
      resignedThisMonth: list.filter((e) => effectiveResignInMonth(e, monthStart, monthEnd)).length,
      attritionThisMonthDecimal: Math.max(0, Math.round(attrition * 10_000) / 10_000),
      salaryBillMonthlyIDR: sal,
    };
  }

  const overall = buildForGroup(overallActive, '*');
  const byDepartment: Record<string, DepartmentHeadcountResult> = {};
  for (const [dept, list] of byDept.entries()) {
    byDepartment[dept] = buildForGroup(list, dept);
  }
  return {
    overall,
    byDepartment,
    monthReferenceISO,
    totalHeadcount: overall.totalHeadcount,
    issues,
  };
}

export function rollingAttritionRate90Days(
  allEmployees: HeadcountEmployee[],
  rollingEndDate: string | Date = new Date(),
): RollingAttrition90Result {
  const end = endOfMonth(toDate(rollingEndDate) ?? new Date());
  const start = addDays(startOfMonth(end), -89);
  const startOfRolling = startOfMonth(start);
  const startDay90 = addDays(end, -89);
  const hiresInWindow: HeadcountEmployee[] = [];
  const resignsInWindow: HeadcountEmployee[] = [];
  for (const e of allEmployees) {
    const j = toDate(e.joinedAt);
    if (j && j.getTime() >= startDay90.getTime() && j.getTime() <= end.getTime()) hiresInWindow.push(e);
    const r = toDate(e.resignedAt);
    if (r && r.getTime() >= startDay90.getTime() && r.getTime() <= end.getTime()) resignsInWindow.push(e);
  }

  function headcountAt(d: Date): number {
    let count = 0;
    for (const e of allEmployees) {
      const join = toDate(e.joinedAt);
      if (!join || join.getTime() > d.getTime()) continue;
      const resign = toDate(e.resignedAt);
      if (resign && resign.getTime() < d.getTime()) continue;
      count++;
    }
    return count;
  }
  const startHC = headcountAt(startDay90);
  const endHC = headcountAt(end);
  const avgHC = Math.round((startHC + endHC) / 2) || (startHC + endHC || 1);
  const rate = avgHC > 0 ? Math.round((resignsInWindow.length / avgHC) * 10_000) / 10_000 : 0;
  return {
    rollingEndDateISO: end.toISOString().slice(0, 10),
    rollingStartDateISO: startDay90.toISOString().slice(0, 10),
    numeratorResignCount: resignsInWindow.length,
    denominatorAverageHeadcount: avgHC,
    attritionRateDecimal: rate,
    startHeadcount: startHC,
    endHeadcount: endHC,
    hiresInWindow: hiresInWindow.length,
    resignsInWindow: resignsInWindow.length,
  };
}

export function getFteToContractRatio(
  breakdown: Record<string, DepartmentHeadcountResult> | DepartmentHeadcountResult[],
  imbalanceThreshold: number = 1.0,
): FTERatioResult {
  const list: DepartmentHeadcountResult[] = Array.isArray(breakdown)
    ? breakdown
    : Object.values(breakdown);

  const all: FTEContractRatioDept[] = [];
  let totalFte = 0;
  let totalContract = 0;
  let totalIntern = 0;
  let totalProject = 0;
  const imbalance: FTEContractRatioDept[] = [];
  for (const dept of list) {
    const f = dept.fteCount || 0;
    const c = dept.contractCount || 0;
    totalFte += f;
    totalContract += c;
    totalIntern += dept.internCount || 0;
    totalProject += dept.projectCount || 0;
    const ratio = c === 0 ? (f === 0 ? 0 : 99) : Math.round((f / c) * 100) / 100;
    let flag: FTEContractRatioDept['imbalanceFlag'] = 'OK';
    if (f === 0 && c > 0) flag = 'CONTRACT_HEAVY';
    else if (c === 0 && f > 0) flag = 'FTE_HEAVY';
    else if (ratio < imbalanceThreshold) flag = 'CONTRACT_HEAVY';
    else if (ratio > imbalanceThreshold * 5) flag = 'FTE_HEAVY';
    const row = { departmentId: dept.departmentId, ratioFtePerContract: ratio, fteCount: f, contractCount: c, imbalanceFlag: flag };
    all.push(row);
    if (flag !== 'OK') imbalance.push(row);
  }
  const overallRatio = totalContract === 0
    ? (totalFte === 0 ? 0 : 99)
    : Math.round((totalFte / totalContract) * 100) / 100;

  return {
    overallRatio,
    totalFte,
    totalContract,
    totalIntern,
    totalProject,
    imbalanceDepartments: imbalance,
    allDepartments: all,
  };
}
