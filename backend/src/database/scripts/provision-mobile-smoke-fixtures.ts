import 'dotenv/config';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const APPLY_ACK = 'staging-synthetic-only';
const DEFAULT_WORK_DAYS = {
  mon: { enabled: true, workStart: '09:00', workEnd: '18:00' },
  tue: { enabled: true, workStart: '09:00', workEnd: '18:00' },
  wed: { enabled: true, workStart: '09:00', workEnd: '18:00' },
  thu: { enabled: true, workStart: '09:00', workEnd: '18:00' },
  fri: { enabled: true, workStart: '09:00', workEnd: '18:00' },
  sat: { enabled: false, workStart: null, workEnd: null },
  sun: { enabled: false, workStart: null, workEnd: null },
};

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function optionalNumber(name: string): number | undefined {
  const raw = process.env[name]?.trim();
  if (!raw) return undefined;
  const value = Number(raw);
  if (!Number.isFinite(value)) throw new Error(`${name} must be a finite number`);
  return value;
}

function enabled(name: string): boolean {
  return process.env[name]?.trim().toLowerCase() === 'true';
}

function stableUuid(input: string): string {
  const hex = createHash('sha256').update(input).digest('hex').slice(0, 32).split('');
  hex[12] = '4';
  hex[16] = ['8', '9', 'a', 'b'][Number.parseInt(hex[16], 16) % 4];
  const value = hex.join('');
  return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20)}`;
}

function dateAtUtcNoon(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
}

async function enrollFaceProfile(options: {
  imagePath: string;
  employeeId: string;
  companyId: string;
}) {
  const [{ extractFaceVectorFromImage }, { encryptFaceEmbedding }] = await Promise.all([
    import('../../shared/attendance/face-extractor'),
    import('../../shared/security/biometric-crypto'),
  ]);
  const photo = await readFile(options.imagePath);
  if (photo.byteLength > 5 * 1024 * 1024) {
    photo.fill(0);
    throw new Error('MOBILE_FIXTURE_FACE_IMAGE_PATH exceeds the 5 MB enrollment limit');
  }
  try {
    const extraction = await extractFaceVectorFromImage(photo);
    const encryptedEmbedding = encryptFaceEmbedding(extraction.vector, {
      companyId: options.companyId,
      employeeId: options.employeeId,
      modelVersion: extraction.modelVersion,
    });
    const enrolledAt = new Date();

    await prisma.$transaction([
      prisma.employeeFaceProfile.upsert({
        where: { employeeId: options.employeeId },
        create: {
          employeeId: options.employeeId,
          companyId: options.companyId,
          encryptedEmbedding,
          modelVersion: extraction.modelVersion,
          embeddingDimensions: extraction.vector.length,
          enrollmentConfidence: extraction.faceConfidence,
          enrolledAt,
        },
        update: {
          companyId: options.companyId,
          encryptedEmbedding,
          modelVersion: extraction.modelVersion,
          embeddingDimensions: extraction.vector.length,
          enrollmentConfidence: extraction.faceConfidence,
          enrolledAt,
        },
      }),
      prisma.employee.update({
        where: { id: options.employeeId },
        data: { referencePhotoUrl: null, referencePhotoUpdatedAt: enrolledAt },
      }),
    ]);

    return {
      enrolled: true,
      modelVersion: extraction.modelVersion,
      embeddingDimensions: extraction.vector.length,
    };
  } finally {
    // The source photo is read only for extraction and is never copied to uploads or the database.
    photo.fill(0);
  }
}

async function main() {
  const email = required('MOBILE_FIXTURE_EMPLOYEE_EMAIL').toLowerCase();
  const apply = process.env.MOBILE_FIXTURE_APPLY === APPLY_ACK;
  const year = Number(process.env.MOBILE_FIXTURE_YEAR ?? new Date().getUTCFullYear());
  if (!Number.isInteger(year) || year < 2020 || year > 2100) {
    throw new Error('MOBILE_FIXTURE_YEAR must be an integer between 2020 and 2100');
  }

  if (apply && process.env.NODE_ENV === 'production' && !enabled('MOBILE_FIXTURE_ALLOW_PRODUCTION')) {
    throw new Error('Refusing production. Use staging, or explicitly set MOBILE_FIXTURE_ALLOW_PRODUCTION=true.');
  }

  const user = await prisma.user.findFirst({
    where: { email, deletedAt: null, status: 'ACTIVE' },
    include: {
      employee: {
        include: {
          company: { select: { id: true, name: true, timezone: true } },
          faceProfile: { select: { id: true, enrolledAt: true } },
        },
      },
    },
  });
  if (!user?.employee) throw new Error('Active user with a linked employee was not found');

  const employee = user.employee;
  const existingCalendar = await prisma.workCalendar.findFirst({
    where: {
      companyId: employee.companyId,
      year,
      isActive: true,
      deletedAt: null,
      OR: [
        ...(employee.departmentId ? [{ departmentId: employee.departmentId }] : []),
        ...(employee.branchId ? [{ branchId: employee.branchId, departmentId: null }] : []),
        { branchId: null, departmentId: null },
      ],
    },
    orderBy: [{ departmentId: 'desc' }, { branchId: 'desc' }],
  });
  const leaveType = await prisma.leaveType.findFirst({
    where: { companyId: employee.companyId, requiresAttachment: false, deletedAt: null },
    orderBy: [{ isAnnual: 'desc' }, { sortOrder: 'asc' }],
  });
  const existingPolicy = await prisma.branchAttendancePolicy.findFirst({
    where: {
      companyId: employee.companyId,
      branchId: employee.branchId ?? null,
      deletedAt: null,
      isActive: true,
    },
  });
  const activeEmployeesInBranch = employee.branchId
    ? await prisma.employee.count({
        where: {
          companyId: employee.companyId,
          branchId: employee.branchId,
          status: 'ACTIVE',
          deletedAt: null,
        },
      })
    : 0;

  const plan = {
    mode: apply ? 'apply' : 'dry-run',
    target: {
      email,
      companyId: employee.companyId,
      company: employee.company.name,
      employeeId: employee.id,
      branchId: employee.branchId,
      employeeCategory: employee.employeeCategory,
      hasBranch: Boolean(employee.branchId),
      hasDepartment: Boolean(employee.departmentId),
      activeEmployeesInBranch,
    },
    calendar: existingCalendar ? 'ready' : 'create',
    leave: leaveType ? 'create-request' : 'blocked-no-leave-type',
    notification: 'upsert-unread',
    attendancePolicy: existingPolicy
      ? {
          status: 'present',
          method: existingPolicy.attendanceMethod,
          hasGps: existingPolicy.gpsLatitude !== null && existingPolicy.gpsLongitude !== null,
          requiresLocation: existingPolicy.requiresLocation,
          requiresSelfie: existingPolicy.requiresSelfie,
        }
      : { status: 'missing' },
    faceProfile: employee.faceProfile ? 'ready' : 'enrollment-required',
  };

  if (!apply) {
    console.log(JSON.stringify(plan, null, 2));
    console.log(`Dry run only. Set MOBILE_FIXTURE_APPLY=${APPLY_ACK} to apply the fixture plan.`);
    return;
  }
  const expectedCompanyId = required('MOBILE_FIXTURE_EXPECT_COMPANY_ID');
  if (expectedCompanyId !== employee.companyId) {
    throw new Error('MOBILE_FIXTURE_EXPECT_COMPANY_ID does not match the resolved employee company');
  }
  if (!leaveType) throw new Error('No non-attachment leave type exists for the target company');

  const fixtureNamespace = `mobile-smoke:${employee.companyId}:${employee.id}:${year}`;
  const leaveRequestId = stableUuid(`${fixtureNamespace}:leave`);
  const notificationId = stableUuid(`${fixtureNamespace}:notification`);
  const createdBy = user.id;

  let gpsConfig: { latitude: number; longitude: number; radius: number } | null = null;
  if (enabled('MOBILE_FIXTURE_CONFIGURE_GPS')) {
    if (!employee.branchId) {
      throw new Error('GPS fixture requires a dedicated employee branch; company-wide policy changes are refused');
    }
    const expectedBranchId = required('MOBILE_FIXTURE_EXPECT_BRANCH_ID');
    if (expectedBranchId !== employee.branchId) {
      throw new Error('MOBILE_FIXTURE_EXPECT_BRANCH_ID does not match the resolved employee branch');
    }
    if (activeEmployeesInBranch > 1 && !enabled('MOBILE_FIXTURE_ALLOW_SHARED_BRANCH')) {
      throw new Error(
        `GPS policy would affect ${activeEmployeesInBranch} active employees; use a dedicated branch or explicitly set MOBILE_FIXTURE_ALLOW_SHARED_BRANCH=true`,
      );
    }
    const latitude = optionalNumber('MOBILE_FIXTURE_GPS_LATITUDE');
    const longitude = optionalNumber('MOBILE_FIXTURE_GPS_LONGITUDE');
    const radius = optionalNumber('MOBILE_FIXTURE_GPS_RADIUS_METERS') ?? 150;
    if (latitude === undefined || latitude < -90 || latitude > 90) {
      throw new Error('MOBILE_FIXTURE_GPS_LATITUDE must be between -90 and 90');
    }
    if (longitude === undefined || longitude < -180 || longitude > 180) {
      throw new Error('MOBILE_FIXTURE_GPS_LONGITUDE must be between -180 and 180');
    }
    if (!Number.isInteger(radius) || radius < 10 || radius > 10_000) {
      throw new Error('MOBILE_FIXTURE_GPS_RADIUS_METERS must be an integer from 10 to 10000');
    }
    gpsConfig = { latitude, longitude, radius };
  }

  const output = await prisma.$transaction(async (tx) => {
    let calendar = existingCalendar;
    if (!calendar) {
      calendar = await tx.workCalendar.create({
        data: {
          companyId: employee.companyId,
          branchId: employee.departmentId ? null : employee.branchId,
          departmentId: employee.departmentId,
          name: `Mobile Smoke ${year}`,
          year,
          workDays: DEFAULT_WORK_DAYS,
          isActive: true,
          description: 'Synthetic staging fixture for mobile API acceptance testing.',
          createdBy,
        },
      });
    }

    const leaveRequest = await tx.leaveRequest.upsert({
      where: { id: leaveRequestId },
      create: {
        id: leaveRequestId,
        employeeId: employee.id,
        companyId: employee.companyId,
        leaveTypeId: leaveType.id,
        startDate: dateAtUtcNoon(year, 1, 8),
        endDate: dateAtUtcNoon(year, 1, 8),
        totalDays: 1,
        reason: 'Synthetic mobile smoke fixture',
        status: 'APPROVED',
        approvedBy: createdBy,
        approvedAt: new Date(),
      },
      update: {
        employeeId: employee.id,
        companyId: employee.companyId,
        leaveTypeId: leaveType.id,
        deletedAt: null,
      },
    });

    const notification = await tx.notification.upsert({
      where: { id: notificationId },
      create: {
        id: notificationId,
        companyId: employee.companyId,
        userId: user.id,
        title: 'Mobile smoke test notification',
        message: 'Synthetic notification used to verify mark-as-read behavior.',
        type: 'INFO',
        resource: 'mobile-smoke',
        action: 'OPEN',
        referenceId: leaveRequest.id,
        isRead: false,
      },
      update: {
        companyId: employee.companyId,
        userId: user.id,
        referenceId: leaveRequest.id,
        isRead: false,
        readAt: null,
      },
    });

    return { calendarId: calendar.id, leaveRequestId: leaveRequest.id, notificationId: notification.id };
  });

  let attendancePolicy = existingPolicy;
  if (gpsConfig) {
    const data = {
      attendanceMethod: 'BOTH' as const,
      gpsLatitude: gpsConfig.latitude,
      gpsLongitude: gpsConfig.longitude,
      gpsRadiusMeters: gpsConfig.radius,
      allowOutsideRadius: false,
      outsideRadiusAction: 'REJECT' as const,
      requiresLocation: true,
      requiresSelfie: enabled('MOBILE_FIXTURE_REQUIRE_SELFIE'),
      isActive: true,
      deletedAt: null,
      notes: 'Synthetic staging policy for mobile real-device acceptance.',
    };
    attendancePolicy = existingPolicy
      ? await prisma.branchAttendancePolicy.update({ where: { id: existingPolicy.id }, data })
      : await prisma.branchAttendancePolicy.create({
          data: {
            companyId: employee.companyId,
            branchId: employee.branchId,
            ...data,
          },
        });
  }

  let faceProfile: {
    enrolled: boolean;
    source: string;
    modelVersion?: string;
    embeddingDimensions?: number;
  } = employee.faceProfile
    ? { enrolled: true, source: 'existing' }
    : { enrolled: false, source: 'not-provided' };
  const faceImagePath = process.env.MOBILE_FIXTURE_FACE_IMAGE_PATH?.trim();
  if (faceImagePath) {
    faceProfile = {
      ...(await enrollFaceProfile({
        imagePath: faceImagePath,
        employeeId: employee.id,
        companyId: employee.companyId,
      })),
      source: 'enrolled-now',
    };
  }

  console.log(JSON.stringify({
    ...plan,
    mode: 'applied',
    fixtures: output,
    attendancePolicy: attendancePolicy
      ? {
          status: 'present',
          method: attendancePolicy.attendanceMethod,
          hasGps: attendancePolicy.gpsLatitude !== null && attendancePolicy.gpsLongitude !== null,
          requiresLocation: attendancePolicy.requiresLocation,
          requiresSelfie: attendancePolicy.requiresSelfie,
        }
      : { status: 'missing' },
    faceProfile,
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
