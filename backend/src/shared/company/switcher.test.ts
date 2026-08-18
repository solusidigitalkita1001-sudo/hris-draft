import {
  listSwitchableCompanies,
  validateCompanySwitchTarget,
  resolveDefaultActiveCompany,
  isSuperAdmin,
  isCompanySwitchable,
} from './switcher';

const COMPANY_A = 'COMP-A'; // PT A — PRIMARY
const COMPANY_B = 'COMP-B'; // PT B
const COMPANY_C = 'COMP-C'; // PT C — INACTIVE
const COMPANY_D = 'COMP-D'; // PT D TRIAL

const baseList = [
  { companyId: COMPANY_A, accessScope: 'SINGLE_COMPANY' as const, isPrimary: true,  rankPriority: 1, companyName: 'PT Aneka Rukun', companyOperationalStatus: 'ACTIVE' as const },
  { companyId: COMPANY_B, accessScope: 'SINGLE_COMPANY' as const, isPrimary: false, rankPriority: 2, companyName: 'PT Berkah Selalu', companyOperationalStatus: 'ACTIVE' as const },
  { companyId: COMPANY_C, accessScope: 'SINGLE_COMPANY' as const, isPrimary: false, rankPriority: 3, companyName: 'PT Cacat Ditutup', companyOperationalStatus: 'INACTIVE' as const },
  { companyId: COMPANY_D, accessScope: 'SINGLE_COMPANY' as const, isPrimary: false, rankPriority: 4, companyName: 'PT D Daftar Trial', companyOperationalStatus: 'TRIAL' as const },
];

const ROLE_HR = ['HR_ADMIN'];
const ROLE_SUPER = ['SUPER_ADMIN'];

describe('D.4 Company Switcher pure functions', () => {
  it('D.4 CASE1: HR user memiliki akses 2 COMPANY ACTIVE (A,B) + TRIAL (D) — COMPANY_C INACTIVE filter hilang. List size = 3. Primary A = urutan pertama.', () => {
    const list = listSwitchableCompanies(baseList, { currentRoles: ROLE_HR });
    expect(list.map(c => c.companyId)).toEqual([COMPANY_A, COMPANY_B, COMPANY_D]);
    expect(list[0].isPrimary).toBe(true);
  });

  it('D.4 CASE2: Target company XXXX beda access list → NOT ALLOWED reason "Anda tidak memiliki akses switch ke company".', () => {
    const r = validateCompanySwitchTarget('COMP-XXXX', baseList, { currentRoles: ROLE_HR });
    expect(r.allowed).toBe(false);
    expect(r.reason).toMatch(/tidak memiliki akses/);
  });

  it('D.4 CASE3: SUPER_ADMIN boleh switch ke semua company KECUALI status INACTIVE. SUPER → COMP-B (ACTIVE) → allowed. SUPER → COMP-C (INACTIVE) → not allowed reason company INACTIVE.', () => {
    const ok = validateCompanySwitchTarget(COMPANY_B, baseList, { currentRoles: ROLE_SUPER });
    expect(ok.allowed).toBe(true);
    const no = validateCompanySwitchTarget(COMPANY_C, baseList, { currentRoles: ROLE_SUPER });
    expect(no.allowed).toBe(false);
    expect(no.reason).toMatch(/INACTIVE/);
    expect(isSuperAdmin(ROLE_SUPER)).toBe(true);
    expect(isSuperAdmin(ROLE_HR)).toBe(false);
  });

  it('D.4 CASE4: resolveDefaultActiveCompany — isPrimary flag COMPANY_A → defaultCompanyId=COMPANY_A, nama "PT Aneka Rukun", eligibleCount=3.', () => {
    const d = resolveDefaultActiveCompany(baseList, { currentRoles: ROLE_HR });
    expect(d.defaultCompanyId).toBe(COMPANY_A);
    expect(d.defaultCompanyName).toBe('PT Aneka Rukun');
    expect(d.eligibleCount).toBe(3);
    expect(d.reason).toMatch(/Primary/);
  });

  it('D.4 CASE5: Status company INACTIVE → isCompanySwitchable false. SUSPENDED → false. ACTIVE/TRIAL/PENDING_ONBOARDING → true. Target switch ke current company → allowed + flag isSwitchBackToCurrent = true.', () => {
    expect(isCompanySwitchable('INACTIVE')).toBe(false);
    expect(isCompanySwitchable('SUSPENDED')).toBe(false);
    expect(isCompanySwitchable('ACTIVE')).toBe(true);
    expect(isCompanySwitchable('TRIAL')).toBe(true);
    expect(isCompanySwitchable('PENDING_ONBOARDING')).toBe(true);
    // Switch currentCompanyId=COMPANY_A target=COMPANY_A → bypass flag
    const same = validateCompanySwitchTarget(COMPANY_A, baseList, { currentRoles: ROLE_HR, currentCompanyId: COMPANY_A });
    expect(same.allowed).toBe(true);
    expect(same.isSwitchBackToCurrent).toBe(true);
    // Empty list → resolveDefault return null + reason
    const empty = resolveDefaultActiveCompany([], { currentRoles: ROLE_HR });
    expect(empty.defaultCompanyId).toBeNull();
    expect(empty.eligibleCount).toBe(0);
    expect(empty.reason).toMatch(/tidak ada company/i);
  });
});
