import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import fs from 'fs/promises';
import path from 'path';

const prisma = new PrismaClient();

function addDays(baseDate: Date, days: number) {
  const result = new Date(baseDate);
  result.setDate(result.getDate() + days);
  return result;
}

function padNumber(value: number, size: number) {
  return value.toString().padStart(size, '0');
}

function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

const DAY_KEYS_BY_INDEX = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;

function buildCalendarDaysForYear(
  calendarId: string,
  year: number,
  workDaysConfig: Record<string, { enabled: boolean; workStart: string | null; workEnd: string | null }>,
  overrides: Array<{
    date: Date;
    dayType: string;
    name?: string;
    notes?: string;
    workStart?: string | null;
    workEnd?: string | null;
    isMandatory?: boolean;
  }> = []
) {
  const overrideMap = new Map(overrides.map((item) => [toDateKey(item.date), item]));
  const entries: Array<{
    calendarId: string;
    date: Date;
    dayType: string;
    name?: string | null;
    notes?: string | null;
    workStart?: string | null;
    workEnd?: string | null;
    isMandatory?: boolean;
  }> = [];

  for (let current = new Date(year, 0, 1); current <= new Date(year, 11, 31); current.setDate(current.getDate() + 1)) {
    const date = new Date(current);
    const override = overrideMap.get(toDateKey(date));
    if (override) {
      entries.push({
        calendarId,
        date,
        dayType: override.dayType,
        name: override.name ?? null,
        notes: override.notes ?? null,
        workStart: override.workStart ?? null,
        workEnd: override.workEnd ?? null,
        isMandatory: override.isMandatory ?? false,
      });
      continue;
    }

    const rule = workDaysConfig[DAY_KEYS_BY_INDEX[date.getDay()]];
    entries.push({
      calendarId,
      date,
      dayType: rule?.enabled ? 'WD' : 'WE',
      workStart: rule?.enabled ? rule.workStart : null,
      workEnd: rule?.enabled ? rule.workEnd : null,
      isMandatory: false,
    });
  }

  return entries;
}

export async function seedTestData(): Promise<void> {
  console.log('\n--- Seeding test data ---\n');
  const companyStartedAt = new Date('2024-07-01T09:00:00+07:00');

  const ensureUserRole = async (params: {
    email: string;
    roleCode: string;
    scopeType?: 'GLOBAL' | 'GROUP' | 'COMPANY';
    companyId?: string;
    groupId?: string;
  }) => {
    const user = await prisma.user.findUnique({ where: { email: params.email } });
    const role = await prisma.role.findUnique({ where: { code: params.roleCode } });

    if (!user || !role) return null;

    const existing = await prisma.userRole.findFirst({
      where: {
        userId: user.id,
        roleId: role.id,
      },
    });

    if (existing) return existing;

    return prisma.userRole.create({
      data: {
        userId: user.id,
        roleId: role.id,
        companyId: params.companyId,
        groupId: params.groupId,
        scopeType: params.scopeType || 'COMPANY',
      },
    });
  };

  // ===================================================
  // 1. COMPANY GROUP & COMPANY
  // ===================================================
  console.log('  Creating organization structure...');

  const group = await prisma.companyGroup.upsert({
    where: { code: 'HOLDING' },
    update: {
      name: 'PT Holding Utama',
      taxId: '01.234.567.8-901.000',
      status: 'ACTIVE',
      createdAt: companyStartedAt,
      deletedAt: null,
    },
    create: {
      name: 'PT Holding Utama',
      code: 'HOLDING',
      taxId: '01.234.567.8-901.000',
      status: 'ACTIVE',
      createdAt: companyStartedAt,
    },
  });

  const company = await prisma.company.upsert({
    where: { code: 'TECH' },
    update: {
      groupId: group.id,
      name: 'PT Teknologi Maju',
      taxId: '02.345.678.9-012.000',
      timezone: 'Asia/Jakarta',
      currency: 'IDR',
      status: 'ACTIVE',
      address: 'Gedung Inovasi Nusantara, Jl. Jenderal Sudirman Kav. 52-53, Jakarta Selatan',
      phone: '+62 21 5550 1200',
      email: 'hello@tech.com',
      website: 'https://tech.example.com',
      createdAt: companyStartedAt,
      deletedAt: null,
    },
    create: {
      groupId: group.id,
      name: 'PT Teknologi Maju',
      code: 'TECH',
      taxId: '02.345.678.9-012.000',
      timezone: 'Asia/Jakarta',
      currency: 'IDR',
      status: 'ACTIVE',
      address: 'Gedung Inovasi Nusantara, Jl. Jenderal Sudirman Kav. 52-53, Jakarta Selatan',
      phone: '+62 21 5550 1200',
      email: 'hello@tech.com',
      website: 'https://tech.example.com',
      createdAt: companyStartedAt,
    },
  });

  // ===================================================
  // 2. BRANCHES & DIVISIONS
  // ===================================================
  const branch = await prisma.branch.upsert({
    where: { code: 'HQ' },
    update: {
      companyId: company.id,
      name: 'Head Office Jakarta',
      address: 'Jl. Jenderal Sudirman Kav. 52-53, Jakarta Selatan',
      phone: '+62 21 5550 1201',
      email: 'hq@tech.com',
      timezone: 'Asia/Jakarta',
      latitude: -6.21462,
      longitude: 106.84513,
      status: 'ACTIVE',
      createdAt: companyStartedAt,
      deletedAt: null,
    },
    create: {
      companyId: company.id,
      name: 'Head Office Jakarta',
      code: 'HQ',
      address: 'Jl. Jenderal Sudirman Kav. 52-53, Jakarta Selatan',
      phone: '+62 21 5550 1201',
      email: 'hq@tech.com',
      timezone: 'Asia/Jakarta',
      latitude: -6.21462,
      longitude: 106.84513,
      status: 'ACTIVE',
      createdAt: companyStartedAt,
    },
  });

  const branch2 = await prisma.branch.upsert({
    where: { code: 'BDG' },
    update: {
      companyId: company.id,
      name: 'Bandung Branch',
      address: 'Jl. Asia Afrika No. 88, Bandung',
      phone: '+62 22 5550 881',
      email: 'bandung@tech.com',
      timezone: 'Asia/Jakarta',
      latitude: -6.91746,
      longitude: 107.61912,
      status: 'ACTIVE',
      createdAt: addDays(companyStartedAt, 45),
      deletedAt: null,
    },
    create: {
      companyId: company.id,
      name: 'Bandung Branch',
      code: 'BDG',
      address: 'Jl. Asia Afrika No. 88, Bandung',
      phone: '+62 22 5550 881',
      email: 'bandung@tech.com',
      timezone: 'Asia/Jakarta',
      latitude: -6.91746,
      longitude: 107.61912,
      status: 'ACTIVE',
      createdAt: addDays(companyStartedAt, 45),
    },
  });

  const branch3 = await prisma.branch.upsert({
    where: { code: 'SBY' },
    update: {
      companyId: company.id,
      name: 'Surabaya Branch',
      address: 'Jl. Basuki Rahmat No. 16-18, Surabaya',
      phone: '+62 31 5550 118',
      email: 'surabaya@tech.com',
      timezone: 'Asia/Jakarta',
      latitude: -7.25747,
      longitude: 112.75209,
      status: 'ACTIVE',
      createdAt: addDays(companyStartedAt, 120),
      deletedAt: null,
    },
    create: {
      companyId: company.id,
      name: 'Surabaya Branch',
      code: 'SBY',
      address: 'Jl. Basuki Rahmat No. 16-18, Surabaya',
      phone: '+62 31 5550 118',
      email: 'surabaya@tech.com',
      timezone: 'Asia/Jakarta',
      latitude: -7.25747,
      longitude: 112.75209,
      status: 'ACTIVE',
      createdAt: addDays(companyStartedAt, 120),
    },
  });

  const division = await prisma.division.upsert({
    where: { code: 'OPS' },
    update: {},
    create: {
      companyId: company.id,
      name: 'Operations',
      code: 'OPS',
      status: 'ACTIVE',
      createdAt: companyStartedAt,
    },
  });

  // ===================================================
  // 3. DEPARTMENTS & POSITIONS
  // ===================================================
  const deptIT = await prisma.department.upsert({
    where: { code: 'IT' },
    update: {}, create: { companyId: company.id, divisionId: division.id, name: 'Information Technology', code: 'IT', status: 'ACTIVE' },
  });

  const deptHR = await prisma.department.upsert({
    where: { code: 'HR' },
    update: {}, create: { companyId: company.id, name: 'Human Resources', code: 'HR', status: 'ACTIVE' },
  });

  const deptFinance = await prisma.department.upsert({
    where: { code: 'FIN' },
    update: {}, create: { companyId: company.id, name: 'Finance & Accounting', code: 'FIN', status: 'ACTIVE' },
  });

  const deptMarketing = await prisma.department.upsert({
    where: { code: 'MKT' },
    update: {}, create: { companyId: company.id, name: 'Marketing', code: 'MKT', status: 'ACTIVE' },
  });

  const deptOps = await prisma.department.upsert({
    where: { code: 'OPSD' },
    update: {},
    create: {
      companyId: company.id,
      divisionId: division.id,
      name: 'Branch Operations',
      code: 'OPSD',
      status: 'ACTIVE',
    },
  });

  const posManager = await prisma.position.upsert({
    where: { code: 'MGR' },
    update: {}, create: { companyId: company.id, departmentId: deptIT.id, name: 'Manager', code: 'MGR', gradeLevel: 5, status: 'ACTIVE' },
  });

  const posDev = await prisma.position.upsert({
    where: { code: 'DEV' },
    update: {}, create: { companyId: company.id, departmentId: deptIT.id, name: 'Software Developer', code: 'DEV', gradeLevel: 3, status: 'ACTIVE' },
  });

  const posHR = await prisma.position.upsert({
    where: { code: 'HRSP' },
    update: {}, create: { companyId: company.id, departmentId: deptHR.id, name: 'HR Specialist', code: 'HRSP', gradeLevel: 3, status: 'ACTIVE' },
  });

  const posAcc = await prisma.position.upsert({
    where: { code: 'ACC' },
    update: {}, create: { companyId: company.id, departmentId: deptFinance.id, name: 'Accountant', code: 'ACC', gradeLevel: 3, status: 'ACTIVE' },
  });

  const posMkt = await prisma.position.upsert({
    where: { code: 'MKTS' },
    update: {}, create: { companyId: company.id, departmentId: deptMarketing.id, name: 'Marketing Staff', code: 'MKTS', gradeLevel: 2, status: 'ACTIVE' },
  });

  const posOps = await prisma.position.upsert({
    where: { code: 'OPSF' },
    update: {},
    create: {
      companyId: company.id,
      departmentId: deptOps.id,
      name: 'Branch Operations Staff',
      code: 'OPSF',
      gradeLevel: 2,
      status: 'ACTIVE',
    },
  });

  const posOpsLead = await prisma.position.upsert({
    where: { code: 'OPSL' },
    update: {},
    create: {
      companyId: company.id,
      departmentId: deptOps.id,
      name: 'Branch Operations Lead',
      code: 'OPSL',
      gradeLevel: 4,
      status: 'ACTIVE',
    },
  });

  await (prisma as any).branchAttendancePolicy.upsert({
    where: { branchId: branch.id },
    update: {
      attendanceMethod: 'FINGERPRINT',
      lateToleranceMinutes: 10,
      earlyCheckoutToleranceMinutes: 10,
      allowHolidayAttendance: false,
      allowWeekendAttendance: false,
      autoAbsentEnabled: true,
      autoCheckoutEnabled: false,
      requiresSelfie: false,
      requiresLocation: false,
      isActive: true,
      notes: 'Head office menggunakan fingerprint only untuk seluruh karyawan onsite.',
      deletedAt: null,
    },
    create: {
      companyId: company.id,
      branchId: branch.id,
      attendanceMethod: 'FINGERPRINT',
      lateToleranceMinutes: 10,
      earlyCheckoutToleranceMinutes: 10,
      allowHolidayAttendance: false,
      allowWeekendAttendance: false,
      autoAbsentEnabled: true,
      autoCheckoutEnabled: false,
      requiresSelfie: false,
      requiresLocation: false,
      isActive: true,
      notes: 'Head office menggunakan fingerprint only untuk seluruh karyawan onsite.',
    },
  });

  const shiftFormulaThreeGroup = await (prisma as any).shiftFormula.upsert({
    where: {
      companyId_code: {
        companyId: company.id,
        code: 'SHIFT-3REGU',
      },
    },
    update: {
      name: '3 Regu Rotasi 8 Hari',
      description: '2 shift pagi, 2 shift sore, 2 shift malam, 2 hari libur untuk operator pabrik.',
      cycleLength: 8,
      isActive: true,
      deletedAt: null,
      days: {
        deleteMany: {},
        create: [
          { sequence: 1, label: 'Pagi A', dayType: 'WS', workStart: '07:00', workEnd: '15:00', crossesMidnight: false },
          { sequence: 2, label: 'Pagi B', dayType: 'WS', workStart: '07:00', workEnd: '15:00', crossesMidnight: false },
          { sequence: 3, label: 'Sore A', dayType: 'WS', workStart: '15:00', workEnd: '23:00', crossesMidnight: false },
          { sequence: 4, label: 'Sore B', dayType: 'WS', workStart: '15:00', workEnd: '23:00', crossesMidnight: false },
          { sequence: 5, label: 'Malam A', dayType: 'WS', workStart: '23:00', workEnd: '07:00', crossesMidnight: true },
          { sequence: 6, label: 'Malam B', dayType: 'WS', workStart: '23:00', workEnd: '07:00', crossesMidnight: true },
          { sequence: 7, label: 'Off 1', dayType: 'WE', workStart: null, workEnd: null, crossesMidnight: false },
          { sequence: 8, label: 'Off 2', dayType: 'WE', workStart: null, workEnd: null, crossesMidnight: false },
        ],
      },
    },
    create: {
      companyId: company.id,
      code: 'SHIFT-3REGU',
      name: '3 Regu Rotasi 8 Hari',
      description: '2 shift pagi, 2 shift sore, 2 shift malam, 2 hari libur untuk operator pabrik.',
      cycleLength: 8,
      createdBy: 'system-seed',
      isActive: true,
      days: {
        create: [
          { sequence: 1, label: 'Pagi A', dayType: 'WS', workStart: '07:00', workEnd: '15:00', crossesMidnight: false },
          { sequence: 2, label: 'Pagi B', dayType: 'WS', workStart: '07:00', workEnd: '15:00', crossesMidnight: false },
          { sequence: 3, label: 'Sore A', dayType: 'WS', workStart: '15:00', workEnd: '23:00', crossesMidnight: false },
          { sequence: 4, label: 'Sore B', dayType: 'WS', workStart: '15:00', workEnd: '23:00', crossesMidnight: false },
          { sequence: 5, label: 'Malam A', dayType: 'WS', workStart: '23:00', workEnd: '07:00', crossesMidnight: true },
          { sequence: 6, label: 'Malam B', dayType: 'WS', workStart: '23:00', workEnd: '07:00', crossesMidnight: true },
          { sequence: 7, label: 'Off 1', dayType: 'WE', workStart: null, workEnd: null, crossesMidnight: false },
          { sequence: 8, label: 'Off 2', dayType: 'WE', workStart: null, workEnd: null, crossesMidnight: false },
        ],
      },
    },
    include: {
      days: true,
    },
  });

  const shiftFormulaWeekend = await (prisma as any).shiftFormula.upsert({
    where: {
      companyId_code: {
        companyId: company.id,
        code: 'SHIFT-2-2-2',
      },
    },
    update: {
      name: '2-2-2 Weekend Coverage',
      description: 'Pola 2 pagi, 2 sore, 2 libur untuk supervisor pabrik.',
      cycleLength: 6,
      isActive: true,
      deletedAt: null,
      days: {
        deleteMany: {},
        create: [
          { sequence: 1, label: 'Pagi 1', dayType: 'WS', workStart: '06:00', workEnd: '14:00', crossesMidnight: false },
          { sequence: 2, label: 'Pagi 2', dayType: 'WS', workStart: '06:00', workEnd: '14:00', crossesMidnight: false },
          { sequence: 3, label: 'Sore 1', dayType: 'WS', workStart: '14:00', workEnd: '22:00', crossesMidnight: false },
          { sequence: 4, label: 'Sore 2', dayType: 'WS', workStart: '14:00', workEnd: '22:00', crossesMidnight: false },
          { sequence: 5, label: 'Off 1', dayType: 'WE', workStart: null, workEnd: null, crossesMidnight: false },
          { sequence: 6, label: 'Off 2', dayType: 'WE', workStart: null, workEnd: null, crossesMidnight: false },
        ],
      },
    },
    create: {
      companyId: company.id,
      code: 'SHIFT-2-2-2',
      name: '2-2-2 Weekend Coverage',
      description: 'Pola 2 pagi, 2 sore, 2 libur untuk supervisor pabrik.',
      cycleLength: 6,
      createdBy: 'system-seed',
      isActive: true,
      days: {
        create: [
          { sequence: 1, label: 'Pagi 1', dayType: 'WS', workStart: '06:00', workEnd: '14:00', crossesMidnight: false },
          { sequence: 2, label: 'Pagi 2', dayType: 'WS', workStart: '06:00', workEnd: '14:00', crossesMidnight: false },
          { sequence: 3, label: 'Sore 1', dayType: 'WS', workStart: '14:00', workEnd: '22:00', crossesMidnight: false },
          { sequence: 4, label: 'Sore 2', dayType: 'WS', workStart: '14:00', workEnd: '22:00', crossesMidnight: false },
          { sequence: 5, label: 'Off 1', dayType: 'WE', workStart: null, workEnd: null, crossesMidnight: false },
          { sequence: 6, label: 'Off 2', dayType: 'WE', workStart: null, workEnd: null, crossesMidnight: false },
        ],
      },
    },
    include: {
      days: true,
    },
  });

  await (prisma as any).branchAttendancePolicy.upsert({
    where: { branchId: branch2.id },
    update: {
      attendanceMethod: 'MOBILE_GPS',
      gpsLatitude: branch2.latitude,
      gpsLongitude: branch2.longitude,
      gpsRadiusMeters: 150,
      allowOutsideRadius: false,
      outsideRadiusAction: 'REJECT',
      lateToleranceMinutes: 5,
      earlyCheckoutToleranceMinutes: 10,
      allowHolidayAttendance: false,
      allowWeekendAttendance: true,
      autoAbsentEnabled: true,
      autoCheckoutEnabled: false,
      requiresSelfie: true,
      requiresLocation: true,
      isActive: true,
      notes: 'Bandung branch menggunakan mobile GPS dengan radius ketat.',
      deletedAt: null,
    },
    create: {
      companyId: company.id,
      branchId: branch2.id,
      attendanceMethod: 'MOBILE_GPS',
      gpsLatitude: branch2.latitude,
      gpsLongitude: branch2.longitude,
      gpsRadiusMeters: 150,
      allowOutsideRadius: false,
      outsideRadiusAction: 'REJECT',
      lateToleranceMinutes: 5,
      earlyCheckoutToleranceMinutes: 10,
      allowHolidayAttendance: false,
      allowWeekendAttendance: true,
      autoAbsentEnabled: true,
      autoCheckoutEnabled: false,
      requiresSelfie: true,
      requiresLocation: true,
      isActive: true,
      notes: 'Bandung branch menggunakan mobile GPS dengan radius ketat.',
    },
  });

  await (prisma as any).branchAttendancePolicy.upsert({
    where: { branchId: branch3.id },
    update: {
      attendanceMethod: 'BOTH',
      gpsLatitude: branch3.latitude,
      gpsLongitude: branch3.longitude,
      gpsRadiusMeters: 250,
      allowOutsideRadius: true,
      outsideRadiusAction: 'REVIEW',
      lateToleranceMinutes: 15,
      earlyCheckoutToleranceMinutes: 15,
      allowHolidayAttendance: false,
      allowWeekendAttendance: false,
      autoAbsentEnabled: true,
      autoCheckoutEnabled: true,
      requiresSelfie: false,
      requiresLocation: false,
      isActive: true,
      notes: 'Surabaya branch mengizinkan fingerprint atau mobile GPS untuk tim hybrid.',
      deletedAt: null,
    },
    create: {
      companyId: company.id,
      branchId: branch3.id,
      attendanceMethod: 'BOTH',
      gpsLatitude: branch3.latitude,
      gpsLongitude: branch3.longitude,
      gpsRadiusMeters: 250,
      allowOutsideRadius: true,
      outsideRadiusAction: 'REVIEW',
      lateToleranceMinutes: 15,
      earlyCheckoutToleranceMinutes: 15,
      allowHolidayAttendance: false,
      allowWeekendAttendance: false,
      autoAbsentEnabled: true,
      autoCheckoutEnabled: true,
      requiresSelfie: false,
      requiresLocation: false,
      isActive: true,
      notes: 'Surabaya branch mengizinkan fingerprint atau mobile GPS untuk tim hybrid.',
    },
  });

  // ===================================================
  // 4. EMPLOYEES
  // ===================================================
  console.log('  Creating employees...');
  const passwordHash = await bcrypt.hash('Employee123!', 12);
  const baseEmployees = [
    {
      employeeNumber: 'EMP001',
      firstName: 'Bambang',
      lastName: 'Supriyadi',
      email: 'bambang@tech.com',
      phone: '08123456789',
      gender: 'MALE',
      position: posManager,
      dept: deptIT,
      branch,
      employmentType: 'PERMANENT',
      employmentStatus: 'ACTIVE',
      joinDate: addDays(companyStartedAt, 14),
      religion: 'ISLAM',
      maritalStatus: 'MARRIED',
      placeOfBirth: 'Jakarta',
    },
    {
      employeeNumber: 'EMP002',
      firstName: 'Siti',
      lastName: 'Rahmawati',
      email: 'siti@tech.com',
      phone: '08123456790',
      gender: 'FEMALE',
      position: posDev,
      dept: deptIT,
      branch,
      employmentType: 'PERMANENT',
      employmentStatus: 'ACTIVE',
      joinDate: addDays(companyStartedAt, 30),
      religion: 'ISLAM',
      maritalStatus: 'SINGLE',
      placeOfBirth: 'Bandung',
    },
    {
      employeeNumber: 'EMP003',
      firstName: 'Ahmad',
      lastName: 'Fauzi',
      email: 'ahmad@tech.com',
      phone: '08123456791',
      gender: 'MALE',
      position: posDev,
      dept: deptIT,
      branch: branch2,
      employmentType: 'CONTRACT',
      employmentStatus: 'ACTIVE',
      joinDate: addDays(companyStartedAt, 75),
      religion: 'ISLAM',
      maritalStatus: 'MARRIED',
      placeOfBirth: 'Cirebon',
    },
    {
      employeeNumber: 'EMP004',
      firstName: 'Dewi',
      lastName: 'Kusuma',
      email: 'dewi@tech.com',
      phone: '08123456792',
      gender: 'FEMALE',
      position: posHR,
      dept: deptHR,
      branch,
      employmentType: 'PERMANENT',
      employmentStatus: 'ACTIVE',
      joinDate: addDays(companyStartedAt, 20),
      religion: 'ISLAM',
      maritalStatus: 'MARRIED',
      placeOfBirth: 'Yogyakarta',
    },
    {
      employeeNumber: 'EMP005',
      firstName: 'Rudi',
      lastName: 'Hartono',
      email: 'rudi@tech.com',
      phone: '08123456793',
      gender: 'MALE',
      position: posAcc,
      dept: deptFinance,
      branch,
      employmentType: 'PERMANENT',
      employmentStatus: 'ACTIVE',
      joinDate: addDays(companyStartedAt, 18),
      religion: 'KRISTEN_PROTESTAN',
      maritalStatus: 'MARRIED',
      placeOfBirth: 'Semarang',
    },
    {
      employeeNumber: 'EMP006',
      firstName: 'Maya',
      lastName: 'Anggraini',
      email: 'maya@tech.com',
      phone: '08123456794',
      gender: 'FEMALE',
      position: posMkt,
      dept: deptMarketing,
      branch: branch3,
      employmentType: 'PERMANENT',
      employmentStatus: 'ACTIVE',
      joinDate: addDays(companyStartedAt, 150),
      religion: 'ISLAM',
      maritalStatus: 'MARRIED',
      placeOfBirth: 'Malang',
    },
    {
      employeeNumber: 'EMP007',
      firstName: 'Agus',
      lastName: 'Prasetyo',
      email: 'agus@tech.com',
      phone: '08123456795',
      gender: 'MALE',
      position: posDev,
      dept: deptIT,
      branch: branch2,
      employmentType: 'PROBATION',
      employmentStatus: 'PROBATION',
      joinDate: addDays(companyStartedAt, 660),
      religion: 'ISLAM',
      maritalStatus: 'SINGLE',
      placeOfBirth: 'Solo',
    },
    {
      employeeNumber: 'EMP008',
      firstName: 'Rina',
      lastName: 'Safitri',
      email: 'rina@tech.com',
      phone: '08123456796',
      gender: 'FEMALE',
      position: posHR,
      dept: deptHR,
      branch,
      employmentType: 'INTERN',
      employmentStatus: 'ACTIVE',
      joinDate: addDays(companyStartedAt, 690),
      religion: 'ISLAM',
      maritalStatus: 'SINGLE',
      placeOfBirth: 'Bogor',
    },
  ].map((employee) => ({
    employeeCategory: 'OFFICE',
    shiftFormulaId: null,
    shiftStartDate: null,
    ...employee,
  }));

  const maleFirstNames = ['Arif', 'Dimas', 'Farhan', 'Galih', 'Hendra', 'Iqbal', 'Joko', 'Kevin', 'Lukman', 'Rizky', 'Teguh', 'Yusuf'];
  const femaleFirstNames = ['Alya', 'Citra', 'Fitri', 'Gita', 'Intan', 'Laras', 'Nadia', 'Putri', 'Salsa', 'Tania', 'Vina', 'Wulan'];
  const lastNames = ['Wijaya', 'Saputra', 'Permata', 'Nugroho', 'Mahendra', 'Lestari', 'Purnama', 'Hidayat', 'Sembiring', 'Utami', 'Wardani', 'Kirana'];
  const cities = ['Jakarta', 'Bandung', 'Surabaya', 'Semarang', 'Yogyakarta', 'Malang', 'Bogor', 'Bekasi'];
  const religions = ['ISLAM', 'KRISTEN_PROTESTAN', 'KRISTEN_KATOLIK', 'HINDU', 'BUDDHA'];
  const workforceTemplates = [
    { branch, dept: deptIT, position: posDev, employmentType: 'PERMANENT', employmentStatus: 'ACTIVE' },
    { branch, dept: deptFinance, position: posAcc, employmentType: 'PERMANENT', employmentStatus: 'ACTIVE' },
    { branch, dept: deptHR, position: posHR, employmentType: 'PERMANENT', employmentStatus: 'ACTIVE' },
    { branch: branch2, dept: deptOps, position: posOps, employmentType: 'CONTRACT', employmentStatus: 'ACTIVE' },
    { branch: branch2, dept: deptMarketing, position: posMkt, employmentType: 'PERMANENT', employmentStatus: 'ACTIVE' },
    { branch: branch3, dept: deptOps, position: posOpsLead, employmentType: 'PERMANENT', employmentStatus: 'ACTIVE' },
    { branch: branch3, dept: deptIT, position: posDev, employmentType: 'PERMANENT', employmentStatus: 'ACTIVE' },
  ];

  const generatedEmployees = Array.from({ length: 42 }, (_, index) => {
    const employeeSequence = index + 9;
    const template = workforceTemplates[index % workforceTemplates.length];
    const isFemale = employeeSequence % 2 === 0;
    const firstName = isFemale
      ? femaleFirstNames[index % femaleFirstNames.length]
      : maleFirstNames[index % maleFirstNames.length];
    const lastName = lastNames[(index * 3) % lastNames.length];
    const joinDate = addDays(companyStartedAt, 20 + (index * 17) % 700);

    return {
      employeeNumber: `EMP${padNumber(employeeSequence, 3)}`,
      firstName,
      lastName,
      email: `employee${padNumber(employeeSequence, 3)}@tech.com`,
      phone: `08123${padNumber(60000 + employeeSequence, 5)}`,
      gender: isFemale ? 'FEMALE' : 'MALE',
      position: template.position,
      dept: template.dept,
      branch: template.branch,
      employmentType: employeeSequence % 11 === 0 ? 'CONTRACT' : template.employmentType,
      employmentStatus: employeeSequence % 13 === 0 ? 'PROBATION' : template.employmentStatus,
      employeeCategory: template.dept.id === deptOps.id ? 'FACTORY' : 'OFFICE',
      shiftFormulaId: template.dept.id === deptOps.id
        ? template.position.id === posOpsLead.id
          ? shiftFormulaWeekend.id
          : shiftFormulaThreeGroup.id
        : null,
      joinDate,
      shiftStartDate: template.dept.id === deptOps.id ? joinDate : null,
      religion: religions[index % religions.length],
      maritalStatus: employeeSequence % 4 === 0 ? 'MARRIED' : 'SINGLE',
      placeOfBirth: cities[index % cities.length],
    };
  });

  const employees = [...baseEmployees, ...generatedEmployees];
  const createdEmployees: any[] = [];

  for (const [employeeIndex, emp] of employees.entries()) {
    const fullName = `${emp.firstName} ${emp.lastName}`;
    const joinDate = emp.joinDate;
    const dateOfBirth = addDays(joinDate, -1 * (365 * (23 + (employeeIndex % 12))));
    const branchRecord = emp.branch ?? branch;

    const created = await (prisma as any).employee.upsert({
      where: { employeeNumber: emp.employeeNumber },
      update: {
        companyId: company.id,
        branchId: branchRecord.id,
        departmentId: emp.dept.id,
        positionId: emp.position.id,
        firstName: emp.firstName,
        lastName: emp.lastName,
        fullName,
        email: emp.email,
        phone: emp.phone,
        gender: emp.gender,
        placeOfBirth: emp.placeOfBirth,
        dateOfBirth,
        religion: emp.religion,
        maritalStatus: emp.maritalStatus,
        address: `${branchRecord.name}, ${emp.placeOfBirth}`,
        joinDate,
        employmentType: emp.employmentType as any,
        employmentStatus: emp.employmentStatus as any,
        employeeCategory: (emp.employeeCategory ?? 'OFFICE') as any,
        shiftFormulaId: emp.shiftFormulaId ?? null,
        shiftStartDate: emp.shiftStartDate ?? null,
        bankName: employeeIndex % 3 === 0 ? 'BCA' : employeeIndex % 3 === 1 ? 'Mandiri' : 'BNI',
        bankAccount: `88${padNumber(employeeIndex + 1, 8)}`,
        bankAccountHolder: fullName,
        taxId: `09.${padNumber(employeeIndex + 1, 3)}.${padNumber(employeeIndex + 11, 3)}.${padNumber(employeeIndex + 21, 1)}-${padNumber(employeeIndex + 31, 3)}.000`,
        bpjsKetenagakerjaan: `BPJSTK${padNumber(employeeIndex + 1, 6)}`,
        bpjsKesehatan: `BPJSKS${padNumber(employeeIndex + 1, 6)}`,
        status: 'ACTIVE',
        deletedAt: null,
      } as any,
      create: {
        companyId: company.id,
        branchId: branchRecord.id,
        departmentId: emp.dept.id,
        positionId: emp.position.id,
        employeeNumber: emp.employeeNumber,
        firstName: emp.firstName,
        lastName: emp.lastName,
        fullName,
        email: emp.email,
        phone: emp.phone,
        idNumber: `3174${padNumber(employeeIndex + 100001, 12)}`,
        placeOfBirth: emp.placeOfBirth,
        dateOfBirth,
        gender: emp.gender,
        religion: emp.religion,
        maritalStatus: emp.maritalStatus,
        address: `${branchRecord.name}, ${emp.placeOfBirth}`,
        joinDate,
        employmentType: emp.employmentType as any,
        employmentStatus: emp.employmentStatus as any,
        employeeCategory: (emp.employeeCategory ?? 'OFFICE') as any,
        shiftFormulaId: emp.shiftFormulaId ?? null,
        shiftStartDate: emp.shiftStartDate ?? null,
        bankName: employeeIndex % 3 === 0 ? 'BCA' : employeeIndex % 3 === 1 ? 'Mandiri' : 'BNI',
        bankAccount: `88${padNumber(employeeIndex + 1, 8)}`,
        bankAccountHolder: fullName,
        taxId: `09.${padNumber(employeeIndex + 1, 3)}.${padNumber(employeeIndex + 11, 3)}.${padNumber(employeeIndex + 21, 1)}-${padNumber(employeeIndex + 31, 3)}.000`,
        bpjsKetenagakerjaan: `BPJSTK${padNumber(employeeIndex + 1, 6)}`,
        bpjsKesehatan: `BPJSKS${padNumber(employeeIndex + 1, 6)}`,
        createdAt: joinDate,
      } as any,
    });
    createdEmployees.push(created);

    if (emp.email) {
      await prisma.user.upsert({
        where: { email: emp.email },
        update: {
          passwordHash,
          status: 'ACTIVE',
          mustChangePassword: false,
          employeeId: created.id,
          deletedAt: null,
        },
        create: {
          email: emp.email,
          passwordHash,
          status: 'ACTIVE',
          mustChangePassword: false,
          employeeId: created.id,
          createdAt: joinDate,
        },
      });

      await ensureUserRole({
        email: emp.email,
        roleCode: 'EMPLOYEE',
        companyId: company.id,
      });
    }
  }
  console.log(`  ✓ ${createdEmployees.length} employees created`);

  // ===================================================
  // 4B. USER ROLE ASSIGNMENTS FOR SIMULATION
  // ===================================================
  console.log('  Assigning operational roles...');
  await ensureUserRole({ email: 'bambang@tech.com', roleCode: 'MANAGER', companyId: company.id });
  await ensureUserRole({ email: 'dewi@tech.com', roleCode: 'HR_MANAGER', companyId: company.id });
  await ensureUserRole({ email: 'rina@tech.com', roleCode: 'HR_STAFF', companyId: company.id });
  await ensureUserRole({ email: 'rudi@tech.com', roleCode: 'COMPANY_ADMIN', companyId: company.id });
  console.log('  ✓ Role simulation assigned');

  const employeeMap = new Map(createdEmployees.map((employee) => [employee.employeeNumber, employee]));
  const bambang = employeeMap.get('EMP001');
  const siti = employeeMap.get('EMP002');
  const ahmad = employeeMap.get('EMP003');
  const dewi = employeeMap.get('EMP004');
  const rudi = employeeMap.get('EMP005');
  const maya = employeeMap.get('EMP006');
  const agus = employeeMap.get('EMP007');
  const rina = employeeMap.get('EMP008');

  const users = await prisma.user.findMany({
    where: { email: { in: employees.map((employee) => employee.email) } },
  });
  const userByEmail = new Map(users.map((user) => [user.email, user]));
  const bambangUser = userByEmail.get('bambang@tech.com');
  const sitiUser = userByEmail.get('siti@tech.com');
  const dewiUser = userByEmail.get('dewi@tech.com');
  const rudiUser = userByEmail.get('rudi@tech.com');
  const rinaUser = userByEmail.get('rina@tech.com');

  // ===================================================
  // 4C. DOCUMENT MANAGEMENT
  // ===================================================
  console.log('  Creating document management data...');
  const uploadDir = path.resolve(process.cwd(), 'uploads/documents');
  await fs.mkdir(uploadDir, { recursive: true });

  const employeeIdCategory = await prisma.documentCategory.upsert({
    where: { code: 'TECH-EMP-ID' },
    update: {},
    create: {
      companyId: company.id,
      groupId: group.id,
      name: 'Employee Identity',
      code: 'TECH-EMP-ID',
      description: 'Dokumen identitas karyawan',
    },
  });

  const contractCategory = await prisma.documentCategory.upsert({
    where: { code: 'TECH-CONTRACT' },
    update: {},
    create: {
      companyId: company.id,
      groupId: group.id,
      name: 'Employment Contract',
      code: 'TECH-CONTRACT',
      description: 'Kontrak kerja karyawan',
    },
  });

  const policyCategory = await prisma.documentCategory.upsert({
    where: { code: 'TECH-POLICY' },
    update: {},
    create: {
      companyId: company.id,
      groupId: group.id,
      name: 'Company Policy',
      code: 'TECH-POLICY',
      description: 'Policy dan SOP perusahaan',
    },
  });

  const demoFiles = [
    {
      id: 'doc-emp002-contract',
      fileName: 'contract-emp002.txt',
      title: 'Kontrak Kerja Siti Rahmawati',
      content: 'Kontrak kerja demonstrasi untuk Siti Rahmawati.',
      categoryId: contractCategory.id,
      employeeId: siti?.id,
      ownerType: 'EMPLOYEE' as const,
      uploadedBy: dewiUser?.id,
      visibility: 'RESTRICTED' as const,
    },
    {
      id: 'doc-emp004-identity',
      fileName: 'ktp-emp004.txt',
      title: 'KTP Dewi Kusuma',
      content: 'Dokumen identitas demonstrasi untuk Dewi Kusuma.',
      categoryId: employeeIdCategory.id,
      employeeId: dewi?.id,
      ownerType: 'EMPLOYEE' as const,
      uploadedBy: rinaUser?.id,
      visibility: 'RESTRICTED' as const,
    },
    {
      id: 'doc-company-policy',
      fileName: 'policy-remote-work.txt',
      title: 'Kebijakan Kerja Fleksibel',
      content: 'Policy kerja fleksibel untuk simulasi DMS.',
      categoryId: policyCategory.id,
      employeeId: null,
      ownerType: 'COMPANY' as const,
      uploadedBy: rudiUser?.id,
      visibility: 'INTERNAL' as const,
    },
  ];

  for (const demoFile of demoFiles) {
    if (!demoFile.uploadedBy) continue;
    if (demoFile.ownerType === 'EMPLOYEE' && !demoFile.employeeId) continue;

    const filePath = path.join(uploadDir, demoFile.fileName);
    await fs.writeFile(filePath, demoFile.content, 'utf8');

    await prisma.document.upsert({
      where: { id: demoFile.id },
      update: {
        title: demoFile.title,
        fileName: demoFile.fileName,
        filePath,
        mimeType: 'text/plain',
        fileSize: Buffer.byteLength(demoFile.content),
      },
      create: {
        id: demoFile.id,
        companyId: company.id,
        groupId: group.id,
        categoryId: demoFile.categoryId,
        employeeId: demoFile.employeeId,
        ownerType: demoFile.ownerType,
        title: demoFile.title,
        fileName: demoFile.fileName,
        filePath,
        mimeType: 'text/plain',
        fileSize: Buffer.byteLength(demoFile.content),
        uploadedBy: demoFile.uploadedBy,
        visibility: demoFile.visibility,
        expiresAt: demoFile.ownerType === 'COMPANY' ? new Date('2027-12-31') : null,
      },
    });
  }
  console.log(`  ✓ ${demoFiles.length} documents prepared`);

  // ===================================================
  // 5. SALARY COMPONENTS
  // ===================================================
  console.log('  Creating salary components...');
  const salaryComponents = [
    { name: 'Gaji Pokok', code: 'GP', type: 'ALLOWANCE', calcMethod: 'FIXED', isTaxable: true },
    { name: 'Tunjangan Makan', code: 'TM', type: 'ALLOWANCE', calcMethod: 'FIXED', amount: 1500000, isTaxable: false },
    { name: 'Tunjangan Transport', code: 'TT', type: 'ALLOWANCE', calcMethod: 'FIXED', amount: 1000000, isTaxable: false },
    { name: 'Tunjangan Jabatan', code: 'TJ', type: 'ALLOWANCE', calcMethod: 'PERCENTAGE', rate: 10, isTaxable: true },
    { name: 'BPJS Kesehatan', code: 'BPJS-KES', type: 'DEDUCTION', calcMethod: 'PERCENTAGE', rate: 1, isTaxable: false },
    { name: 'BPJS Ketenagakerjaan', code: 'BPJS-TK', type: 'DEDUCTION', calcMethod: 'PERCENTAGE', rate: 2, isTaxable: false },
    { name: 'PPh 21', code: 'PPH21', type: 'DEDUCTION', calcMethod: 'PERCENTAGE', rate: 5, isTaxable: false },
  ];

  const createdComponents: any[] = [];
  for (const sc of salaryComponents) {
    const created = await prisma.salaryComponent.upsert({
      where: { code: sc.code },
      update: {},
      create: {
        companyId: company.id, name: sc.name, code: sc.code,
        type: sc.type as any, calculationMethod: sc.calcMethod,
        amount: (sc as any).amount, ratePercent: (sc as any).rate,
        isTaxable: sc.isTaxable, isActive: true, sortOrder: salaryComponents.indexOf(sc),
      },
    });
    createdComponents.push(created);
  }
  console.log(`  ✓ ${createdComponents.length} salary components created`);

  // ===================================================
  // 6. EMPLOYEE SALARIES
  // ===================================================
  console.log('  Creating employee salaries...');
  for (const emp of createdEmployees) {
    const baseSalary = emp.employeeNumber === 'EMP001' ? 25000000 :
      emp.positionId === posOpsLead.id ? 18500000 :
      emp.employmentType === 'INTERN' ? 5000000 :
      emp.employmentType === 'PROBATION' ? 8000000 : 12000000;
    const salaryId = `sal-${emp.employeeNumber}`;

    const salary = await prisma.employeeSalary.upsert({
      where: { id: salaryId },
      update: {},
      create: {
        id: salaryId, employeeId: emp.id, companyId: company.id,
        effectiveDate: emp.joinDate || companyStartedAt, baseSalary, isActive: true,
      },
    });

    // Assign components
    for (const comp of createdComponents) {
      let amount = 0;
      if (comp.calculationMethod === 'FIXED') amount = Number(comp.amount) || 0;
      else if (comp.calculationMethod === 'PERCENTAGE') amount = baseSalary * (Number(comp.ratePercent) / 100);

      if (amount > 0) {
        await prisma.employeeSalaryComponent.upsert({
          where: { employeeSalaryId_salaryComponentId: { employeeSalaryId: salary.id, salaryComponentId: comp.id } },
          update: { amount },
          create: { employeeSalaryId: salary.id, salaryComponentId: comp.id, amount },
        });
      }
    }
  }
  console.log(`  ✓ Salaries created for ${createdEmployees.length} employees`);

  // ===================================================
  // 7. LEAVE TYPES
  // ===================================================
  console.log('  Creating leave types...');
  const leaveTypes = [
    { name: 'Annual Leave', code: 'ANNUAL', isPaid: true, isAnnual: true, maxDays: 12, requiresAttachment: false },
    { name: 'Sick Leave', code: 'SICK', isPaid: true, isAnnual: false, maxDays: 14, requiresAttachment: false },
    { name: 'Maternity Leave', code: 'MATERNITY', isPaid: true, isAnnual: false, maxDays: 90, requiresAttachment: true },
    { name: 'Paternity Leave', code: 'PATERNITY', isPaid: true, isAnnual: false, maxDays: 3, requiresAttachment: false },
    { name: 'Marriage Leave', code: 'MARRIAGE', isPaid: true, isAnnual: false, maxDays: 3, requiresAttachment: true },
    { name: 'Bereavement Leave', code: 'BEREAVEMENT', isPaid: true, isAnnual: false, maxDays: 3, requiresAttachment: false },
    { name: 'Unpaid Leave', code: 'UNPAID', isPaid: false, isAnnual: false, maxDays: 30, requiresAttachment: false },
  ];

  const createdLeaveTypes: any[] = [];
  for (const lt of leaveTypes) {
    const created = await prisma.leaveType.upsert({
      where: { code: lt.code },
      update: {}, create: { ...lt, companyId: company.id, sortOrder: leaveTypes.indexOf(lt) },
    });
    createdLeaveTypes.push(created);
  }
  console.log(`  ✓ ${createdLeaveTypes.length} leave types created`);

  // ===================================================
  // 8. LEAVE BALANCES & REQUESTS
  // ===================================================
  console.log('  Creating leave balances...');
  for (const emp of createdEmployees) {
    for (const lt of createdLeaveTypes.filter((l) => l.isAnnual)) {
      await prisma.leaveBalance.upsert({
        where: { employeeId_leaveTypeId_year: { employeeId: emp.id, leaveTypeId: lt.id, year: 2026 } },
        update: {}, create: { employeeId: emp.id, companyId: company.id, leaveTypeId: lt.id, year: 2026, totalDays: lt.maxDays, usedDays: 0, remainingDays: lt.maxDays },
      });
    }
  }
  console.log(`  ✓ Leave balances created`);

  // Sample leave requests
  const annualLeave = createdLeaveTypes.find((l) => l.code === 'ANNUAL');
  const sickLeave = createdLeaveTypes.find((l) => l.code === 'SICK');
  if (annualLeave && sickLeave && createdEmployees.length >= 2) {
    await prisma.leaveRequest.upsert({
      where: { id: 'leave-001' },
      update: {
        employeeId: createdEmployees[1].id,
        companyId: company.id,
        leaveTypeId: annualLeave.id,
        startDate: new Date('2026-07-10T23:00:00+07:00'),
        endDate: new Date('2026-07-12T23:00:00+07:00'),
        totalDays: 3,
        reason: 'Acara keluarga',
        status: 'PENDING',
        approvedAt: null,
        approvedBy: null,
      },
      create: {
        id: 'leave-001',
        employeeId: createdEmployees[1].id, companyId: company.id, leaveTypeId: annualLeave.id,
        startDate: new Date('2026-07-10T23:00:00+07:00'), endDate: new Date('2026-07-12T23:00:00+07:00'), totalDays: 3,
        reason: 'Acara keluarga', status: 'PENDING',
      },
    });
    await prisma.leaveRequest.upsert({
      where: { id: 'leave-002' },
      update: {
        employeeId: createdEmployees[2].id,
        companyId: company.id,
        leaveTypeId: sickLeave.id,
        startDate: new Date('2026-06-20T23:00:00+07:00'),
        endDate: new Date('2026-06-21T23:00:00+07:00'),
        totalDays: 2,
        reason: 'Kurang enak badan',
        status: 'APPROVED',
        approvedAt: new Date(),
      },
      create: {
        id: 'leave-002',
        employeeId: createdEmployees[2].id, companyId: company.id, leaveTypeId: sickLeave.id,
        startDate: new Date('2026-06-20T23:00:00+07:00'), endDate: new Date('2026-06-21T23:00:00+07:00'), totalDays: 2,
        reason: 'Kurang enak badan', status: 'APPROVED', approvedAt: new Date(),
      },
    });

    if (bambang?.id) {
      await prisma.leaveRequest.upsert({
        where: { id: 'leave-003' },
        update: {
          employeeId: bambang.id,
          companyId: company.id,
          leaveTypeId: annualLeave.id,
          startDate: new Date('2026-07-15T23:00:00+07:00'),
          endDate: new Date('2026-07-16T23:00:00+07:00'),
          totalDays: 2,
          reason: 'Libur keluarga yang sudah disetujui',
          status: 'APPROVED',
          approvedBy: dewiUser?.id || rudiUser?.id || null,
          approvedAt: new Date('2026-07-01T10:00:00+07:00'),
        },
        create: {
          id: 'leave-003',
          employeeId: bambang.id,
          companyId: company.id,
          leaveTypeId: annualLeave.id,
          startDate: new Date('2026-07-15T23:00:00+07:00'),
          endDate: new Date('2026-07-16T23:00:00+07:00'),
          totalDays: 2,
          reason: 'Libur keluarga yang sudah disetujui',
          status: 'APPROVED',
          approvedBy: dewiUser?.id || rudiUser?.id || null,
          approvedAt: new Date('2026-07-01T10:00:00+07:00'),
        },
      });
    }
  }

  // ===================================================
  // 9. BENEFIT PLANS
  // ===================================================
  console.log('  Creating benefit plans...');
  const benefitPlans = [
    { name: 'BPJS Kesehatan', code: 'BPJS-KES', type: 'BPJS', provider: 'BPJS', employeeContribution: 1, employerContribution: 4 },
    { name: 'BPJS Ketenagakerjaan', code: 'BPJS-TK', type: 'BPJS', provider: 'BPJS', employeeContribution: 2, employerContribution: 4.24 },
    { name: 'Private Health Insurance', code: 'PRIV-INS', type: 'INSURANCE', provider: 'AXA Mandiri', employeeContribution: 0, employerContribution: 100 },
    { name: 'THR', code: 'THR', type: 'ALLOWANCE', provider: 'Company', employeeContribution: 0, employerContribution: 100 },
  ];

  for (const bp of benefitPlans) {
    await prisma.benefitPlan.upsert({
      where: { code: bp.code }, update: {}, create: { ...bp, companyId: company.id, isActive: true },
    });
  }
  console.log(`  ✓ ${benefitPlans.length} benefit plans created`);

  const bpjsKes = await prisma.benefitPlan.findUnique({ where: { code: 'BPJS-KES' } });
  const bpjsTk = await prisma.benefitPlan.findUnique({ where: { code: 'BPJS-TK' } });
  const privateInsurance = await prisma.benefitPlan.findUnique({ where: { code: 'PRIV-INS' } });

  // Benefit enrollments
  if (bpjsKes && bpjsTk && privateInsurance) {
    const benefitEnrollments = [
      { id: 'ben-emp001-kes', employeeId: bambang?.id, planId: bpjsKes.id, details: 'Kelas 1, keluarga inti' },
      { id: 'ben-emp002-kes', employeeId: siti?.id, planId: bpjsKes.id, details: 'Kelas 1, peserta aktif' },
      { id: 'ben-emp004-priv', employeeId: dewi?.id, planId: privateInsurance.id, details: 'Executive inpatient plan' },
      { id: 'ben-emp005-tk', employeeId: rudi?.id, planId: bpjsTk.id, details: 'Program JHT + JP aktif' },
    ];

    for (const enrollment of benefitEnrollments) {
      if (!enrollment.employeeId) continue;
      await prisma.benefitEnrollment.upsert({
        where: { id: enrollment.id },
        update: {},
        create: {
          id: enrollment.id,
          benefitPlanId: enrollment.planId,
          employeeId: enrollment.employeeId,
          companyId: company.id,
          effectiveDate: new Date('2026-01-01'),
          status: 'ACTIVE',
          coverageDetails: enrollment.details,
        },
      });
    }
    console.log('  ✓ Benefit enrollments created');
  }

  // ===================================================
  // 10. TRAINING CATEGORIES & COURSES
  // ===================================================
  console.log('  Creating training data...');
  const trainingCat = await prisma.trainingCategory.upsert({
    where: { code: 'TECH' }, update: {}, create: { companyId: company.id, name: 'Technical Skills', code: 'TECH' },
  });
  const trainingCat2 = await prisma.trainingCategory.upsert({
    where: { code: 'SOFT' }, update: {}, create: { companyId: company.id, name: 'Soft Skills', code: 'SOFT' },
  });

  const courses = [
    { title: 'Advanced TypeScript', code: 'TS-101', categoryId: trainingCat.id, duration: 16, durationUnit: 'hours', provider: 'Internal', isMandatory: false },
    { title: 'React Enterprise', code: 'REACT-201', categoryId: trainingCat.id, duration: 24, durationUnit: 'hours', provider: 'Online Course', isMandatory: false },
    { title: 'Leadership Training', code: 'LEAD-101', categoryId: trainingCat2.id, duration: 2, durationUnit: 'days', provider: 'External Consultant', isMandatory: true },
    { title: 'Safety Induction', code: 'SAFE-001', categoryId: trainingCat2.id, duration: 4, durationUnit: 'hours', provider: 'Company', isMandatory: true },
  ];

  for (const course of courses) {
    await prisma.trainingCourse.upsert({
      where: { code: course.code }, update: {}, create: { ...course, companyId: company.id },
    });
  }
  console.log(`  ✓ ${courses.length} courses created`);

  const tsCourse = await prisma.trainingCourse.findUnique({ where: { code: 'TS-101' } });
  const leadershipCourse = await prisma.trainingCourse.findUnique({ where: { code: 'LEAD-101' } });
  if (tsCourse && leadershipCourse) {
    const leadershipSession = await prisma.trainingSession.upsert({
      where: { id: 'session-lead-2026-01' },
      update: {},
      create: {
        id: 'session-lead-2026-01',
        courseId: leadershipCourse.id,
        trainer: 'PT People Growth Advisory',
        location: 'Jakarta Training Center',
        startDate: new Date('2026-07-15T09:00:00+07:00'),
        endDate: new Date('2026-07-16T17:00:00+07:00'),
        maxParticipants: 20,
        status: 'SCHEDULED',
      },
    });

    const enrollments = [
      { id: 'tenroll-emp001-ts101', courseId: tsCourse.id, employeeId: bambang?.id, progress: 100, status: 'COMPLETED', completedAt: new Date('2026-03-14') },
      { id: 'tenroll-emp002-ts101', courseId: tsCourse.id, employeeId: siti?.id, progress: 70, status: 'IN_PROGRESS' },
      { id: 'tenroll-emp004-lead', courseId: leadershipCourse.id, employeeId: dewi?.id, progress: 0, status: 'ENROLLED' },
    ];

    for (const enrollment of enrollments) {
      if (!enrollment.employeeId) continue;
      await prisma.trainingEnrollment.upsert({
        where: { id: enrollment.id },
        update: {},
        create: {
          id: enrollment.id,
          courseId: enrollment.courseId,
          employeeId: enrollment.employeeId,
          companyId: company.id,
          status: enrollment.status as any,
          progress: enrollment.progress,
          completedAt: enrollment.completedAt,
        },
      });
    }

    if (dewi?.id) {
      await prisma.trainingAttendance.upsert({
        where: { sessionId_employeeId: { sessionId: leadershipSession.id, employeeId: dewi.id } },
        update: {},
        create: {
          sessionId: leadershipSession.id,
          employeeId: dewi.id,
          status: 'PRESENT',
        },
      });
    }
    console.log('  ✓ Training enrollments created');
  }

  // ===================================================
  // 11. PAYROLL PERIOD
  // ===================================================
  console.log('  Creating payroll period...');
  await prisma.payrollPeriod.upsert({
    where: { code: 'P202606' },
    update: {},
    create: {
      companyId: company.id, name: 'June 2026', code: 'P202606', frequency: 'MONTHLY',
      startDate: new Date('2026-06-01'), endDate: new Date('2026-06-30'), payDate: new Date('2026-07-05'), status: 'ACTIVE',
    },
  });

  const payrollPeriod = await prisma.payrollPeriod.findUnique({ where: { code: 'P202606' } });
  if (payrollPeriod) {
    const employeeSalaries = await prisma.employeeSalary.findMany({
      where: { companyId: company.id, isActive: true },
      include: {
        employee: true,
        components: {
          include: {
            salaryComponent: true,
          },
        },
      },
    });

    const payrollRun = await prisma.payrollRun.upsert({
      where: { id: 'prun-202606-main' },
      update: {},
      create: {
        id: 'prun-202606-main',
        periodId: payrollPeriod.id,
        companyId: company.id,
        name: 'Payroll Run June 2026',
        runNumber: 1,
        totalEmployees: employeeSalaries.length,
        totalEarnings: 102500000,
        totalDeductions: 11750000,
        totalNetPay: 90750000,
        status: 'APPROVED',
        approvedBy: rudiUser?.id,
        approvedAt: new Date('2026-07-03T10:00:00+07:00'),
      },
    });

    for (const salary of employeeSalaries) {
      const totalEarnings = salary.components
        .filter((component) => component.salaryComponent.type === 'ALLOWANCE')
        .reduce((sum, component) => sum + Number(component.amount), Number(salary.baseSalary));
      const totalDeductions = salary.components
        .filter((component) => component.salaryComponent.type === 'DEDUCTION')
        .reduce((sum, component) => sum + Number(component.amount), 0);
      const netPay = totalEarnings - totalDeductions;

      const payslipId = `ps-${salary.employee.employeeNumber}-2606`;
      await prisma.payslip.upsert({
        where: { id: payslipId },
        update: {},
        create: {
          id: payslipId,
          payrollRunId: payrollRun.id,
          employeeId: salary.employeeId,
          companyId: company.id,
          employeeSalaryId: salary.id,
          baseSalary: salary.baseSalary,
          totalEarnings,
          totalDeductions,
          netPay,
          workDays: 22,
          presentDays: 21,
          leaveDays: salary.employee.employeeNumber === 'EMP003' ? 1 : 0,
          absentDays: 0,
          overtimeHours: salary.employee.employeeNumber === 'EMP002' ? 6 : 2,
          status: 'FINAL',
        },
      });

      for (const component of salary.components) {
        const componentId = `psc-${salary.employee.employeeNumber}-${component.salaryComponent.code}`.slice(0, 36);
        await prisma.payslipComponent.upsert({
          where: { id: componentId },
          update: {},
          create: {
            id: componentId,
            payslipId,
            salaryComponentId: component.salaryComponentId,
            name: component.salaryComponent.name,
            type: component.salaryComponent.type,
            amount: component.amount,
            isTaxable: component.salaryComponent.isTaxable,
          },
        });
      }
    }
    console.log('  ✓ Payroll run and payslips created');
  }

  // ===================================================
  // 12. PERFORMANCE REVIEW CYCLE
  // ===================================================
  console.log('  Creating performance review...');
  const cycle = await prisma.reviewCycle.upsert({
    where: { code: 'Q2-2026' }, update: {},
    create: {
      companyId: company.id, name: 'Q2 2026 Performance Review', code: 'Q2-2026',
      type: 'QUARTERLY', startDate: new Date('2026-04-01'), endDate: new Date('2026-06-30'),
      reviewDeadline: new Date('2026-07-15'), status: 'ACTIVE',
    },
  });

  // Create a sample review
  if (createdEmployees.length >= 2) {
    const reviewId = `rev-${createdEmployees[1].employeeNumber}`;
    await prisma.performanceReview.upsert({
      where: { id: reviewId },
      update: {}, create: {
        id: reviewId, cycleId: cycle.id, employeeId: createdEmployees[1].id,
        companyId: company.id, title: `Q2 Review - ${createdEmployees[1].fullName}`,
        type: 'MANAGER', status: 'DRAFT',
      },
    });
  }

  // ===================================================
  // 13. GOALS
  // ===================================================
  console.log('  Creating goals...');
  const goals = [
    { employeeId: createdEmployees[1]?.id, title: 'Complete API Migration', type: 'PERSONAL', priority: 'HIGH', progress: 75 },
    { employeeId: createdEmployees[1]?.id, title: 'Reduce Bug Count by 30%', type: 'PERSONAL', priority: 'CRITICAL', progress: 50 },
    { employeeId: createdEmployees[3]?.id, title: 'Interview 20 Candidates', type: 'PERSONAL', priority: 'HIGH', progress: 60 },
    { employeeId: createdEmployees[3]?.id, title: 'Update Employee Handbook', type: 'PERSONAL', priority: 'MEDIUM', progress: 100 },
  ];

  for (const [goalIndex, goal] of goals.entries()) {
    if (!goal.employeeId) continue;
    await prisma.goal.upsert({
      where: { id: `goal-00${goalIndex + 1}` },
      update: {},
      create: {
        id: `goal-00${goalIndex + 1}`,
        employeeId: goal.employeeId, companyId: company.id, title: goal.title,
        type: goal.type as any, startDate: new Date('2026-01-01'), endDate: new Date('2026-12-31'),
        progress: goal.progress, status: 'IN_PROGRESS', priority: goal.priority as any,
      },
    });
  }
  console.log(`  ✓ ${goals.length} goals created`);

  // ===================================================
  // 14. RECRUITMENT
  // ===================================================
  console.log('  Creating recruitment data...');
  const jobPosting = await prisma.jobPosting.upsert({
    where: { code: 'SR-DEV-2026' },
    update: {},
    create: {
      companyId: company.id, departmentId: deptIT.id, positionId: posDev.id,
      title: 'Senior Software Developer', code: 'SR-DEV-2026',
      employmentType: 'FULL_TIME', location: 'Jakarta',
      minSalary: 25000000, maxSalary: 40000000,
      description: 'Kami mencari Senior Software Developer berpengalaman untuk bergabung dengan tim engineering kami.',
      requirements: '- Minimal 5 tahun pengalaman\n- Menguasai TypeScript, Node.js, React\n- Pengalaman dengan microservices\n- SQL & NoSQL databases',
      vacancies: 2, status: 'PUBLISHED', postedAt: new Date(),
    },
  });

  const candidate = await prisma.candidate.upsert({
    where: { id: 'cand-001' },
    update: {},
    create: {
      id: 'cand-001', companyId: company.id, firstName: 'Farhan', lastName: 'Kurniawan',
      email: 'farhan@email.com', phone: '08111111111', currentCompany: 'PT Digital Solusi',
      currentPosition: 'Software Engineer', source: 'LinkedIn', status: 'ACTIVE',
    },
  });

  await prisma.jobApplication.upsert({
    where: { id: 'app-001' },
    update: {}, create: {
      id: 'app-001', jobPostingId: jobPosting.id, candidateId: candidate.id, companyId: company.id,
      status: 'INTERVIEW', coverLetter: 'Saya tertarik bergabung...', expectedSalary: 30000000,
    },
  });

  // ===================================================
  // 15. ATTENDANCE RECORDS (last 7 days)
  // ===================================================
  console.log('  Creating attendance records...');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const attendanceStartDate = new Date(today);
  attendanceStartDate.setDate(attendanceStartDate.getDate() - 7);
  await prisma.attendance.deleteMany({
    where: {
      employeeId: { in: createdEmployees.map((employee) => employee.id) },
      date: {
        gte: attendanceStartDate,
        lte: today,
      },
    },
  });
  let attendanceCount = 0;

  const branchPolicies = new Map([
    [branch.id, { method: 'FINGERPRINT', latitude: branch.latitude, longitude: branch.longitude, radius: null }],
    [branch2.id, { method: 'MOBILE_GPS', latitude: branch2.latitude, longitude: branch2.longitude, radius: 150 }],
    [branch3.id, { method: 'BOTH', latitude: branch3.latitude, longitude: branch3.longitude, radius: 250 }],
  ]);

  for (const emp of createdEmployees) {
    for (let i = 1; i <= 7; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      d.setHours(0, 0, 0, 0);
      if (d.getDay() === 0 || d.getDay() === 6) continue; // Skip weekends

      const nineAM = new Date(d); nineAM.setHours(9, 0, 0, 0);
      const checkIn = new Date(nineAM);
      checkIn.setMinutes(checkIn.getMinutes() + (emp.employeeNumber === 'EMP002' ? 15 : 0)); // EMP002 always late
      const checkOut = new Date(d); checkOut.setHours(17, 0, 0, 0);
      const status = emp.employeeNumber === 'EMP002' ? 'LATE' : 'PRESENT';
      const branchPolicy = branchPolicies.get(emp.branchId || branch.id) || branchPolicies.get(branch.id)!;
      const usesMobileGps = branchPolicy.method === 'MOBILE_GPS' || (branchPolicy.method === 'BOTH' && i % 2 === 0);

      await prisma.attendance.create({
        data: {
          employeeId: emp.id,
          companyId: company.id,
          branchId: emp.branchId,
          date: d,
          checkIn,
          checkOut,
          method: usesMobileGps ? 'MOBILE_GPS' : branchPolicy.method === 'FINGERPRINT' ? 'FINGERPRINT' : 'MANUAL',
          source: usesMobileGps ? 'seed-mobile-web' : 'seed-fingerprint-device',
          checkInLatitude: usesMobileGps && branchPolicy.latitude ? branchPolicy.latitude + 0.0001 : null,
          checkInLongitude: usesMobileGps && branchPolicy.longitude ? branchPolicy.longitude + 0.0001 : null,
          checkOutLatitude: usesMobileGps && branchPolicy.latitude ? branchPolicy.latitude + 0.00008 : null,
          checkOutLongitude: usesMobileGps && branchPolicy.longitude ? branchPolicy.longitude + 0.00008 : null,
          distanceMeters: usesMobileGps && branchPolicy.radius ? Math.round(branchPolicy.radius * 0.6) : null,
          isWithinRadius: usesMobileGps ? true : null,
          status: status as any,
          workDuration: 480,
          lateMinutes: status === 'LATE' ? 15 : 0,
          scheduledWorkStart: emp.branchId === branch2.id ? '08:30' : '09:00',
          scheduledWorkEnd: emp.branchId === branch2.id ? '17:30' : '17:00',
          policySnapshot: {
            branchId: emp.branchId,
            policyMethod: branchPolicy.method,
            seeded: true,
          },
        } as any,
      });
      attendanceCount++;
    }
  }
  console.log(`  ✓ ${attendanceCount} attendance records created`);

  // ===================================================
  // 16. WORK CALENDAR & HOLIDAYS
  // ===================================================
  console.log('  Creating work calendar...');
  const defaultOfficeWorkDays = {
    mon: { enabled: true, workStart: '09:00', workEnd: '18:00' },
    tue: { enabled: true, workStart: '09:00', workEnd: '18:00' },
    wed: { enabled: true, workStart: '09:00', workEnd: '18:00' },
    thu: { enabled: true, workStart: '09:00', workEnd: '18:00' },
    fri: { enabled: true, workStart: '09:00', workEnd: '18:00' },
    sat: { enabled: false, workStart: null, workEnd: null },
    sun: { enabled: false, workStart: null, workEnd: null },
  };
  const bandungWorkDays = {
    mon: { enabled: true, workStart: '08:30', workEnd: '17:30' },
    tue: { enabled: true, workStart: '08:30', workEnd: '17:30' },
    wed: { enabled: true, workStart: '08:30', workEnd: '17:30' },
    thu: { enabled: true, workStart: '08:30', workEnd: '17:30' },
    fri: { enabled: true, workStart: '08:30', workEnd: '17:30' },
    sat: { enabled: true, workStart: '08:00', workEnd: '13:00' },
    sun: { enabled: false, workStart: null, workEnd: null },
  };
  const surabayaWorkDays = {
    mon: { enabled: true, workStart: '09:00', workEnd: '17:00' },
    tue: { enabled: true, workStart: '09:00', workEnd: '17:00' },
    wed: { enabled: true, workStart: '09:00', workEnd: '17:00' },
    thu: { enabled: true, workStart: '09:00', workEnd: '17:00' },
    fri: { enabled: true, workStart: '09:00', workEnd: '17:00' },
    sat: { enabled: false, workStart: null, workEnd: null },
    sun: { enabled: false, workStart: null, workEnd: null },
  };
  const existingCalendar = await prisma.workCalendar.findFirst({
    where: { companyId: company.id, year: 2026, branchId: null, departmentId: null },
  });
  const calendar = existingCalendar
    ? await prisma.workCalendar.update({
        where: { id: existingCalendar.id },
        data: {
          name: 'Kalender Kerja 2026',
          workDays: defaultOfficeWorkDays,
          isActive: true,
          description: 'Kalender kerja utama perusahaan untuk tahun 2026',
          deletedAt: null,
        },
      })
    : await prisma.workCalendar.create({
        data: {
          companyId: company.id,
          name: 'Kalender Kerja 2026',
          year: 2026,
          workDays: defaultOfficeWorkDays,
          isActive: true,
          description: 'Kalender kerja utama perusahaan untuk tahun 2026',
          createdBy: rudiUser?.id || bambangUser?.id || 'system-seed',
        },
      });

  const existingBandungCalendar = await prisma.workCalendar.findFirst({
    where: {
      companyId: company.id,
      branchId: branch2.id,
      departmentId: null,
      year: 2026,
    },
  });
  const branchCalendarBandung = existingBandungCalendar
    ? await prisma.workCalendar.update({
        where: { id: existingBandungCalendar.id },
        data: {
          name: 'Kalender Branch Bandung 2026',
          workDays: bandungWorkDays,
          isActive: true,
          description: 'Bandung branch beroperasi 6 hari kerja dengan jam masuk lebih pagi.',
          deletedAt: null,
        },
      })
    : await prisma.workCalendar.create({
        data: {
          companyId: company.id,
          branchId: branch2.id,
          name: 'Kalender Branch Bandung 2026',
          year: 2026,
          workDays: bandungWorkDays,
          isActive: true,
          description: 'Bandung branch beroperasi 6 hari kerja dengan jam masuk lebih pagi.',
          createdBy: rudiUser?.id || bambangUser?.id || 'system-seed',
        },
      });

  const existingSurabayaCalendar = await prisma.workCalendar.findFirst({
    where: {
      companyId: company.id,
      branchId: branch3.id,
      departmentId: null,
      year: 2026,
    },
  });
  const branchCalendarSurabaya = existingSurabayaCalendar
    ? await prisma.workCalendar.update({
        where: { id: existingSurabayaCalendar.id },
        data: {
          name: 'Kalender Branch Surabaya 2026',
          workDays: surabayaWorkDays,
          isActive: true,
          description: 'Surabaya branch hybrid dengan opsi checkout otomatis.',
          deletedAt: null,
        },
      })
    : await prisma.workCalendar.create({
        data: {
          companyId: company.id,
          branchId: branch3.id,
          name: 'Kalender Branch Surabaya 2026',
          year: 2026,
          workDays: surabayaWorkDays,
          isActive: true,
          description: 'Surabaya branch hybrid dengan opsi checkout otomatis.',
          createdBy: rudiUser?.id || bambangUser?.id || 'system-seed',
        },
      });

  const holidays = [
    { id: 'nat-holiday-2601', date: new Date(2026, 0, 1), name: 'Tahun Baru 2026', type: 'H' },
    { id: 'nat-holiday-2602', date: new Date(2026, 7, 17), name: 'Hari Kemerdekaan RI', type: 'H' },
    { id: 'nat-holiday-2603', date: new Date(2026, 11, 25), name: 'Hari Natal', type: 'H' },
  ];
  for (const holiday of holidays) {
    await prisma.nationalHoliday.upsert({
      where: { id: holiday.id },
      update: {},
      create: {
        id: holiday.id,
        companyId: company.id,
        countryCode: 'ID',
        date: holiday.date,
        name: holiday.name,
        type: holiday.type,
        year: 2026,
        source: 'seed',
      },
    });
  }

  const specialDays = [
    { id: 'wcday-2601', date: new Date(2026, 0, 1), dayType: 'NH', name: 'Tahun Baru 2026' },
    { id: 'wcday-2602', date: new Date(2026, 7, 17), dayType: 'NH', name: 'Hari Kemerdekaan RI' },
    { id: 'wcday-2603', date: new Date(2026, 11, 25), dayType: 'NH', name: 'Hari Natal' },
  ];
  await prisma.workCalendarDay.deleteMany({
    where: {
      calendarId: {
        in: [calendar.id, branchCalendarBandung.id, branchCalendarSurabaya.id],
      },
    },
  });

  await prisma.workCalendarDay.createMany({
    data: buildCalendarDaysForYear(calendar.id, 2026, defaultOfficeWorkDays, specialDays),
  });

  await prisma.workCalendarDay.createMany({
    data: buildCalendarDaysForYear(branchCalendarBandung.id, 2026, bandungWorkDays, [
      ...specialDays,
      {
        date: new Date(2026, 6, 6),
        dayType: 'WD',
        name: 'Bandung Early Shift',
        workStart: '08:30',
        workEnd: '17:30',
        isMandatory: true,
      },
    ]),
  });

  await prisma.workCalendarDay.createMany({
    data: buildCalendarDaysForYear(branchCalendarSurabaya.id, 2026, surabayaWorkDays, [
      ...specialDays,
      {
        date: new Date(2026, 6, 11),
        dayType: 'WS',
        name: 'Surabaya Team Offsite',
        workStart: '09:00',
        workEnd: '13:00',
        isMandatory: false,
      },
    ]),
  });
  console.log('  ✓ Work calendar and holidays created');

  // ===================================================
  // 17. COMPANY / GROUP SETTINGS & POLICY
  // ===================================================
  await prisma.groupSetting.upsert({
    where: { groupId_key: { groupId: group.id, key: 'default_timezone' } },
    update: { value: 'Asia/Jakarta' },
    create: { groupId: group.id, key: 'default_timezone', value: 'Asia/Jakarta' },
  });
  await prisma.companySetting.upsert({
    where: { companyId_key: { companyId: company.id, key: 'attendance_tolerance_minutes' } },
    update: { value: '15' },
    create: { companyId: company.id, key: 'attendance_tolerance_minutes', value: '15' },
  });
  await prisma.groupPolicy.upsert({
    where: { code: 'WFH-2026' },
    update: {},
    create: {
      groupId: group.id,
      name: 'Kebijakan Work From Home 2026',
      code: 'WFH-2026',
      type: 'HR_POLICY',
      content: 'Karyawan diperbolehkan WFH maksimal 4 kali per bulan dengan persetujuan atasan.',
      status: 'ACTIVE',
    },
  });
  console.log('  ✓ Settings and policies created');

  // ===================================================
  // 18. ASSET MANAGEMENT
  // ===================================================
  console.log('  Creating assets...');
  const laptopCategory = await prisma.assetCategory.upsert({
    where: { id: 'assetcat-laptop' },
    update: {},
    create: {
      id: 'assetcat-laptop',
      companyId: company.id,
      groupId: group.id,
      name: 'Laptop',
      depreciationMethod: 'STRAIGHT_LINE',
      usefulLifeMonths: 36,
    },
  });
  const phoneCategory = await prisma.assetCategory.upsert({
    where: { id: 'assetcat-phone' },
    update: {},
    create: {
      id: 'assetcat-phone',
      companyId: company.id,
      groupId: group.id,
      name: 'Handphone',
      depreciationMethod: 'STRAIGHT_LINE',
      usefulLifeMonths: 24,
    },
  });

  const assets = [
    { code: 'AST-LAP-001', name: 'MacBook Pro 14', categoryId: laptopCategory.id, serialNumber: 'MBP-001', value: 32000000, status: 'ASSIGNED' },
    { code: 'AST-LAP-002', name: 'Lenovo ThinkPad T14', categoryId: laptopCategory.id, serialNumber: 'THP-002', value: 21000000, status: 'AVAILABLE' },
    { code: 'AST-PHN-001', name: 'iPhone 15', categoryId: phoneCategory.id, serialNumber: 'IPH-001', value: 18500000, status: 'ASSIGNED' },
  ];
  for (const asset of assets) {
    await prisma.asset.upsert({
      where: { assetCode: asset.code },
      update: {},
      create: {
        companyId: company.id,
        categoryId: asset.categoryId,
        assetCode: asset.code,
        name: asset.name,
        serialNumber: asset.serialNumber,
        purchaseDate: new Date('2026-01-10'),
        purchaseValue: asset.value,
        currentValue: asset.value * 0.85,
        status: asset.status,
        branchId: branch.id,
      },
    });
  }

  const macbook = await prisma.asset.findUnique({ where: { assetCode: 'AST-LAP-001' } });
  const iphone = await prisma.asset.findUnique({ where: { assetCode: 'AST-PHN-001' } });
  if (macbook && siti && dewiUser) {
    await prisma.assetAssignment.upsert({
      where: { id: 'assign-asset-001' },
      update: {},
      create: {
        id: 'assign-asset-001',
        assetId: macbook.id,
        employeeId: siti.id,
        assignedAt: new Date('2026-02-01'),
        conditionAtAssign: 'GOOD',
        createdBy: dewiUser.id,
      },
    });
  }
  if (iphone && bambang && dewiUser) {
    await prisma.assetAssignment.upsert({
      where: { id: 'assign-asset-002' },
      update: {},
      create: {
        id: 'assign-asset-002',
        assetId: iphone.id,
        employeeId: bambang.id,
        assignedAt: new Date('2026-02-10'),
        conditionAtAssign: 'GOOD',
        createdBy: dewiUser.id,
      },
    });
  }
  console.log('  ✓ Assets and assignments created');

  // ===================================================
  // 19. ONBOARDING / OFFBOARDING
  // ===================================================
  console.log('  Creating onboarding and offboarding data...');
  if (agus?.id && rina?.id) {
    await prisma.onboardingChecklist.upsert({
      where: { id: 'onb-001' },
      update: {},
      create: {
        id: 'onb-001',
        companyId: company.id,
        employeeId: agus.id,
        itemName: 'Laptop & akun email',
        category: 'Equipment',
        picId: rina.id,
        dueDate: new Date('2026-07-02'),
        status: 'COMPLETED',
        completedAt: new Date('2026-07-01'),
      },
    });
    await prisma.onboardingChecklist.upsert({
      where: { id: 'onb-002' },
      update: {},
      create: {
        id: 'onb-002',
        companyId: company.id,
        employeeId: agus.id,
        itemName: 'Orientation HR Policy',
        category: 'Administration',
        picId: dewi?.id,
        dueDate: new Date('2026-07-03'),
        status: 'PENDING',
      },
    });
  }

  if (maya?.id && dewi?.id && rudi?.id) {
    await prisma.resignation.upsert({
      where: { id: 'resign-001' },
      update: {},
      create: {
        id: 'resign-001',
        companyId: company.id,
        employeeId: maya.id,
        resignDate: new Date('2026-07-01'),
        lastWorkingDate: new Date('2026-07-31'),
        reason: 'Melanjutkan karier di industri FMCG',
        noticePeriodDays: 30,
        status: 'SUBMITTED',
      },
    });
    await prisma.exitClearance.upsert({
      where: { id: 'clearance-001' },
      update: {},
      create: {
        id: 'clearance-001',
        resignationId: 'resign-001',
        department: 'IT',
        checklistItem: 'Pengembalian akses laptop & akun',
        picId: rudi.id,
        status: 'PENDING',
      },
    });
  }
  console.log('  ✓ Onboarding and offboarding created');

  // ===================================================
  // 20. NOTIFICATIONS
  // ===================================================
  console.log('  Creating notifications...');
  const notifications = [
    { id: 'notif-001', userId: bambangUser?.id, title: 'Reminder approval overtime', message: 'Terdapat 2 lembur menunggu approval hari ini.', type: 'WARNING', resource: 'attendance', action: 'approve' },
    { id: 'notif-002', userId: dewiUser?.id, title: 'Employee onboarding pending', message: 'Checklist onboarding Agus Prasetyo masih belum lengkap.', type: 'INFO', resource: 'onboarding', action: 'read' },
    { id: 'notif-003', userId: sitiUser?.id, title: 'Payslip June 2026 tersedia', message: 'Payslip periode Juni 2026 sudah dapat diunduh.', type: 'SUCCESS', resource: 'payroll', action: 'read' },
    { id: 'notif-004', userId: rinaUser?.id, title: 'Request izin baru', message: 'Ada pengajuan izin personal yang perlu diproses.', type: 'WARNING', resource: 'self-service', action: 'read' },
  ];
  for (const notification of notifications) {
    if (!notification.userId) continue;
    await prisma.notification.upsert({
      where: { id: notification.id },
      update: {},
      create: {
        id: notification.id,
        companyId: company.id,
        userId: notification.userId,
        title: notification.title,
        message: notification.message,
        type: notification.type as any,
        resource: notification.resource,
        action: notification.action,
      },
    });
  }
  console.log('  ✓ Notifications created');

  // ===================================================
  // 21. SELF SERVICE / PERMISSION REQUESTS
  // ===================================================
  console.log('  Creating self-service requests...');
  if (siti?.id && bambang?.id && agus?.id) {
    await prisma.permissionRequest.upsert({
      where: { id: 'perm-001' },
      update: {
        companyId: company.id,
        employeeId: siti.id,
        type: 'WORK_FROM_HOME',
        startDate: new Date('2026-06-26T09:00:00+07:00'),
        endDate: new Date('2026-06-26T17:00:00+07:00'),
        duration: 1,
        reason: 'Menunggu teknisi internet di rumah',
        status: 'APPROVED',
        approverId: bambang.id,
        approvedAt: new Date('2026-06-25T16:00:00+07:00'),
      },
      create: {
        id: 'perm-001',
        companyId: company.id,
        employeeId: siti.id,
        type: 'WORK_FROM_HOME',
        startDate: new Date('2026-06-26T09:00:00+07:00'),
        endDate: new Date('2026-06-26T17:00:00+07:00'),
        duration: 1,
        reason: 'Menunggu teknisi internet di rumah',
        status: 'APPROVED',
        approverId: bambang.id,
        approvedAt: new Date('2026-06-25T16:00:00+07:00'),
      },
    });
    await prisma.permissionRequest.upsert({
      where: { id: 'perm-002' },
      update: {
        companyId: company.id,
        employeeId: agus.id,
        type: 'PERSONAL',
        startDate: new Date('2026-06-28T13:00:00+07:00'),
        endDate: new Date('2026-06-28T17:00:00+07:00'),
        duration: 0.5,
        reason: 'Keperluan administrasi keluarga',
        status: 'PENDING',
        approverId: null,
        approvedAt: null,
      },
      create: {
        id: 'perm-002',
        companyId: company.id,
        employeeId: agus.id,
        type: 'PERSONAL',
        startDate: new Date('2026-06-28T13:00:00+07:00'),
        endDate: new Date('2026-06-28T17:00:00+07:00'),
        duration: 0.5,
        reason: 'Keperluan administrasi keluarga',
        status: 'PENDING',
      },
    });

    await prisma.permissionRequest.upsert({
      where: { id: 'perm-003' },
      update: {
        companyId: company.id,
        employeeId: bambang.id,
        type: 'SICK',
        startDate: new Date('2026-07-07T08:00:00+07:00'),
        endDate: new Date('2026-07-07T17:00:00+07:00'),
        duration: 1,
        reason: 'Demam dan istirahat di rumah',
        status: 'APPROVED',
        approverId: dewiUser?.id || rudiUser?.id || null,
        approvedAt: new Date('2026-07-06T16:00:00+07:00'),
      },
      create: {
        id: 'perm-003',
        companyId: company.id,
        employeeId: bambang.id,
        type: 'SICK',
        startDate: new Date('2026-07-07T08:00:00+07:00'),
        endDate: new Date('2026-07-07T17:00:00+07:00'),
        duration: 1,
        reason: 'Demam dan istirahat di rumah',
        status: 'APPROVED',
        approverId: dewiUser?.id || rudiUser?.id || null,
        approvedAt: new Date('2026-07-06T16:00:00+07:00'),
      },
    });

    await prisma.permissionRequest.upsert({
      where: { id: 'perm-004' },
      update: {
        companyId: company.id,
        employeeId: bambang.id,
        type: 'PERSONAL',
        startDate: new Date('2026-07-22T13:00:00+07:00'),
        endDate: new Date('2026-07-22T17:00:00+07:00'),
        duration: 0.5,
        reason: 'Keperluan keluarga di siang hari',
        status: 'APPROVED',
        approverId: dewiUser?.id || rudiUser?.id || null,
        approvedAt: new Date('2026-07-20T11:00:00+07:00'),
      },
      create: {
        id: 'perm-004',
        companyId: company.id,
        employeeId: bambang.id,
        type: 'PERSONAL',
        startDate: new Date('2026-07-22T13:00:00+07:00'),
        endDate: new Date('2026-07-22T17:00:00+07:00'),
        duration: 0.5,
        reason: 'Keperluan keluarga di siang hari',
        status: 'APPROVED',
        approverId: dewiUser?.id || rudiUser?.id || null,
        approvedAt: new Date('2026-07-20T11:00:00+07:00'),
      },
    });
  }
  console.log('  ✓ Self-service requests created');

  // ===================================================
  // 22. LOAN DATA
  // ===================================================
  console.log('  Creating loan data...');
  const loanTypes = [
    { name: 'Pinjaman Karyawan', amount: 15000000, installments: 12, rate: 0 },
    { name: 'Pinjaman Darurat', amount: 5000000, installments: 6, rate: 0 },
  ];
  for (const [index, loanType] of loanTypes.entries()) {
    await prisma.loanType.upsert({
      where: { id: `loan-type-00${index + 1}` },
      update: {},
      create: {
        id: `loan-type-00${index + 1}`,
        companyId: company.id,
        name: loanType.name,
        maxAmount: loanType.amount,
        maxInstallments: loanType.installments,
        interestRate: loanType.rate,
        description: `Produk ${loanType.name} untuk kebutuhan karyawan`,
        status: 'ACTIVE',
      },
    });
  }

  const employeeLoanType = await prisma.loanType.findUnique({ where: { id: 'loan-type-001' } });
  const emergencyLoanType = await prisma.loanType.findUnique({ where: { id: 'loan-type-002' } });
  if (employeeLoanType && emergencyLoanType && siti?.id && dewi?.id && ahmad?.id) {
    await prisma.loan.upsert({
      where: { id: 'loan-001' },
      update: {},
      create: {
        id: 'loan-001',
        companyId: company.id,
        employeeId: siti.id,
        loanTypeId: employeeLoanType.id,
        amount: 12000000,
        totalInstallments: 12,
        installmentAmount: 1000000,
        remainingBalance: 7000000,
        reason: 'Renovasi rumah',
        status: 'ACTIVE',
        approverId: dewi.id,
        approvedAt: new Date('2026-01-10'),
      },
    });
    await prisma.loan.upsert({
      where: { id: 'loan-002' },
      update: {},
      create: {
        id: 'loan-002',
        companyId: company.id,
        employeeId: ahmad.id,
        loanTypeId: emergencyLoanType.id,
        amount: 3000000,
        totalInstallments: 6,
        installmentAmount: 500000,
        remainingBalance: 3000000,
        reason: 'Biaya kesehatan keluarga',
        status: 'PENDING',
      },
    });

    for (let month = 1; month <= 12; month++) {
      await prisma.loanInstallment.upsert({
        where: { id: `loaninst-001-${month}` },
        update: {},
        create: {
          id: `loaninst-001-${month}`,
          loanId: 'loan-001',
          amount: 1000000,
          dueDate: new Date(`2026-${String(month).padStart(2, '0')}-25`),
          paidDate: month <= 5 ? new Date(`2026-${String(month).padStart(2, '0')}-25`) : undefined,
          status: month <= 5 ? 'PAID' : month === 6 ? 'OVERDUE' : 'PENDING',
        },
      });
    }
  }
  console.log('  ✓ Loan data created');

  // ===================================================
  // 23. TRAVEL & EXPENSE
  // ===================================================
  console.log('  Creating travel & expense data...');
  if (siti?.id && dewi?.id && bambang?.id) {
    await prisma.businessTrip.upsert({
      where: { id: 'trip-001' },
      update: {},
      create: {
        id: 'trip-001',
        companyId: company.id,
        employeeId: siti.id,
        destination: 'Bandung',
        purpose: 'Koordinasi implementasi sistem attendance cabang Bandung',
        startDate: new Date('2026-06-18'),
        endDate: new Date('2026-06-20'),
        estimatedCost: 4500000,
        status: 'APPROVED',
        approvedBy: bambang.id,
        approvedAt: new Date('2026-06-15'),
      },
    });
    await prisma.travelAdvance.upsert({
      where: { id: 'advance-001' },
      update: {},
      create: {
        id: 'advance-001',
        tripId: 'trip-001',
        companyId: company.id,
        amount: 2500000,
        disbursedAt: new Date('2026-06-17'),
        reconciled: false,
      },
    });
    await prisma.expenseClaim.upsert({
      where: { id: 'claim-001' },
      update: {},
      create: {
        id: 'claim-001',
        companyId: company.id,
        employeeId: siti.id,
        tripId: 'trip-001',
        category: 'HOTEL',
        amount: 1850000,
        description: 'Hotel 2 malam untuk perjalanan dinas Bandung',
        expenseDate: new Date('2026-06-19'),
        receiptFilePath: 'https://example.com/receipts/hotel-bandung.pdf',
        ocrExtractedAmount: 1850000,
        status: 'REIMBURSED',
        notes: 'Sudah diverifikasi finance',
      },
    });
    await prisma.expenseApproval.upsert({
      where: { id: 'claimapp-001' },
      update: {},
      create: {
        id: 'claimapp-001',
        claimId: 'claim-001',
        approverId: dewi.id,
        level: 1,
        status: 'APPROVED',
        notes: 'Claim valid sesuai receipt',
        approvedAt: new Date('2026-06-22'),
      },
    });
    await prisma.reimbursement.upsert({
      where: { id: 'reimburse-001' },
      update: {},
      create: {
        id: 'reimburse-001',
        claimId: 'claim-001',
        companyId: company.id,
        method: 'TRANSFER',
        amount: 1850000,
        processedBy: rudiUser?.id,
        processedAt: new Date('2026-06-24'),
        notes: 'Ditransfer ke rekening payroll',
      },
    });
  }
  console.log('  ✓ Travel & expense data created');

  // ===================================================
  // 24. WORKFLOW ENGINE
  // ===================================================
  console.log('  Creating workflow engine data...');
  const workflowTemplate = await prisma.workflowTemplate.upsert({
    where: { id: 'wf-template-001' },
    update: {},
    create: {
      id: 'wf-template-001',
      companyId: company.id,
      name: 'Leave Request Approval',
      approvalType: 'LEAVE_APPROVAL',
      resource: 'leave',
      description: 'Approval cuti dua level: manager lalu HR manager',
      isActive: true,
    },
  });

  await prisma.workflowStage.upsert({
    where: { id: 'wf-stage-001' },
    update: {},
    create: {
      id: 'wf-stage-001',
      templateId: workflowTemplate.id,
      name: 'Manager Approval',
      level: 1,
      approverType: 'ROLE',
      approverRoleCode: 'MANAGER',
      slaHours: 24,
      allowEscalation: true,
    },
  });
  await prisma.workflowStage.upsert({
    where: { id: 'wf-stage-002' },
    update: {},
    create: {
      id: 'wf-stage-002',
      templateId: workflowTemplate.id,
      name: 'HR Approval',
      level: 2,
      approverType: 'ROLE',
      approverRoleCode: 'HR_MANAGER',
      backupApproverRoleCode: 'COMPANY_ADMIN',
      slaHours: 24,
      allowEscalation: true,
    },
  });
  await prisma.workflowConditionRule.upsert({
    where: { id: 'wf-rule-001' },
    update: {},
    create: {
      id: 'wf-rule-001',
      stageId: 'wf-stage-002',
      field: 'days',
      operator: 'GTE',
      value: '2',
    },
  });

  if (annualLeave && sitiUser) {
    await prisma.workflowInstance.upsert({
      where: { id: 'wf-inst-001' },
      update: {},
      create: {
        id: 'wf-inst-001',
        templateId: workflowTemplate.id,
        companyId: company.id,
        approvalType: 'LEAVE_APPROVAL',
        referenceType: 'leave_request',
        referenceId: annualLeave.id,
        requesterId: sitiUser.id,
        payload: { days: 3, employeeNumber: 'EMP002', leaveType: 'ANNUAL' },
        status: 'PENDING',
        currentLevel: 1,
      },
    });
    await prisma.workflowInstanceStep.upsert({
      where: { id: 'wf-step-001' },
      update: {},
      create: {
        id: 'wf-step-001',
        instanceId: 'wf-inst-001',
        stageId: 'wf-stage-001',
        name: 'Manager Approval',
        level: 1,
        approverType: 'ROLE',
        approverRoleCode: 'MANAGER',
        status: 'PENDING',
        isCurrent: true,
      },
    });
    await prisma.workflowInstanceStep.upsert({
      where: { id: 'wf-step-002' },
      update: {},
      create: {
        id: 'wf-step-002',
        instanceId: 'wf-inst-001',
        stageId: 'wf-stage-002',
        name: 'HR Approval',
        level: 2,
        approverType: 'ROLE',
        approverRoleCode: 'HR_MANAGER',
        backupApproverRoleCode: 'COMPANY_ADMIN',
        status: 'PENDING',
        isCurrent: false,
      },
    });
    await prisma.workflowInstanceLog.upsert({
      where: { id: 'wf-log-001' },
      update: {},
      create: {
        id: 'wf-log-001',
        instanceId: 'wf-inst-001',
        action: 'STARTED',
        actorId: sitiUser.id,
        comment: 'Workflow dimulai dari pengajuan cuti tahunan',
      },
    });
  }
  console.log('  ✓ Workflow data created');

  // ===================================================
  // 25. AUDIT LOGS
  // ===================================================
  console.log('  Creating audit logs...');
  const auditLogs = [
    { id: 'audit-001', userId: rudiUser?.id, action: 'CREATE', entity: 'employee', entityId: agus?.id, newValue: '{"employeeNumber":"EMP007","status":"ACTIVE"}' },
    { id: 'audit-002', userId: dewiUser?.id, action: 'APPROVE', entity: 'leave_request', entityId: 'perm-001', newValue: '{"status":"APPROVED"}' },
    { id: 'audit-003', userId: bambangUser?.id, action: 'APPROVE', entity: 'business_trip', entityId: 'trip-001', newValue: '{"status":"APPROVED"}' },
  ];
  for (const log of auditLogs) {
    await prisma.auditLog.upsert({
      where: { id: log.id },
      update: {},
      create: {
        id: log.id,
        companyId: company.id,
        userId: log.userId,
        action: log.action,
        entity: log.entity,
        entityId: log.entityId,
        newValue: log.newValue,
        ipAddress: '127.0.0.1',
        userAgent: 'seed-script',
      },
    });
  }
  console.log('  ✓ Audit logs created');

  console.log('\n  ✓ Test data seeding completed!');
  console.log('  ─────────────────────────────────────────');
  console.log('  Login credentials:');
  console.log('  Super Admin: admin@hrms.com / Admin123!');
  console.log('  Employee:     bambang@tech.com / Employee123!');
  console.log('  Employee:     siti@tech.com / Employee123!');
  console.log('  HR Manager:   dewi@tech.com / Employee123!');
  console.log('  HR Staff:     rina@tech.com / Employee123!');
  console.log('  Company Admin:rudi@tech.com / Employee123!');
}
