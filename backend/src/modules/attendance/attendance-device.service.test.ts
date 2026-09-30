import crypto from 'node:crypto';
import { AttendanceDevicePunchStatus } from '@prisma/client';

type Row = Record<string, unknown>;

const devices: Row[] = [];
const employees: Row[] = [];
const attendances: Row[] = [];
const punches: Row[] = [];

function matches(row: Row, where: Row): boolean {
  return Object.entries(where).every(([key, value]) => {
    if (value === null) return row[key] === null || row[key] === undefined;
    if (value instanceof Date) return (row[key] as Date | undefined)?.getTime() === value.getTime();
    return row[key] === value;
  });
}

const createdAttendance: Row[] = [];
const checkedOut: string[] = [];

jest.mock('@/shared/database/prisma', () => {
  const client = {
    attendanceDevice: {
      findFirst: jest.fn(async ({ where }: { where: Row }) => devices.find((row) => matches(row, where)) ?? null),
      findMany: jest.fn(async ({ where }: { where: Row }) => devices.filter((row) => matches(row, where))),
      create: jest.fn(async ({ data }: { data: Row }) => {
        const row = { id: `device-${devices.length + 1}`, isActive: true, deletedAt: null, ...data };
        devices.push(row);
        return row;
      }),
      update: jest.fn(async ({ where, data }: { where: Row; data: Row }) => {
        const row = devices.find((candidate) => candidate.id === where.id);
        if (!row) throw new Error(`Device ${String(where.id)} not in the fixture`);
        Object.assign(row, data);
        return row;
      }),
    },
    branch: { findFirst: jest.fn(async () => ({ id: 'branch-1' })) },
    employee: {
      findFirst: jest.fn(async ({ where }: { where: Row }) => employees.find((row) => matches(row, where)) ?? null),
    },
    attendance: {
      findFirst: jest.fn(async ({ where }: { where: Row }) => attendances.find((row) => matches(row, where)) ?? null),
    },
    attendanceDevicePunch: {
      findFirst: jest.fn(async ({ where }: { where: Row }) => punches.find((row) => matches(row, where)) ?? null),
      findMany: jest.fn(async ({ where }: { where: Row }) => punches.filter((row) => matches(row, where))),
      create: jest.fn(async ({ data }: { data: Row }) => {
        const row = { id: `punch-${punches.length + 1}`, ...data };
        punches.push(row);
        return row;
      }),
    },
  };
  return { __esModule: true, default: client, prisma: client };
});

jest.mock('@/shared/logger/WinstonLogger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

jest.mock('./attendance.service', () => ({
  attendanceService: {
    create: jest.fn(async (data: Row) => {
      createdAttendance.push(data);
      const row = {
        id: `attendance-${createdAttendance.length}`,
        employeeId: data.employeeId,
        companyId: data.companyId,
        date: new Date(data.date as string),
        checkIn: new Date(data.checkIn as string),
        checkOut: null,
        deletedAt: null,
      };
      attendances.push(row);
      return row;
    }),
    checkOut: jest.fn(async (id: string) => {
      checkedOut.push(id);
      const row = attendances.find((candidate) => candidate.id === id);
      if (!row) throw new Error(`Attendance ${id} not in the fixture`);
      row.checkOut = new Date();
      return row;
    }),
  },
  FINGERPRINT_NOT_ATTESTED: 'method:FINGERPRINT_NOT_DEVICE_ATTESTED',
}));

import { attendanceDeviceService } from './attendance-device.service';
import { attendanceService } from './attendance.service';

const COMPANY = 'company-a';
const OTHER_COMPANY = 'company-b';

function reset() {
  devices.length = 0;
  employees.length = 0;
  attendances.length = 0;
  punches.length = 0;
  createdAttendance.length = 0;
  checkedOut.length = 0;
  jest.clearAllMocks();
}

async function registerDevice() {
  const { device, token } = await attendanceDeviceService.register(COMPANY, {
    name: 'Terminal Lobi',
    serialNumber: 'ZK-0001',
  });
  return { device, token };
}

describe('attendance device credentials', () => {
  beforeEach(reset);

  it('stores only a hash, and the secret is never recoverable from the row', async () => {
    const { device, token } = await registerDevice();
    const secret = token.slice(token.indexOf('.') + 1);

    expect(token.startsWith(`${device.id}.`)).toBe(true);
    expect(device.secretHash).toBe(crypto.createHash('sha256').update(secret).digest('hex'));
    expect(device.secretHash).not.toContain(secret);
  });

  it('accepts the minted credential', async () => {
    const { device, token } = await registerDevice();
    await expect(attendanceDeviceService.authenticate(token)).resolves.toMatchObject({
      id: device.id,
      companyId: COMPANY,
      serialNumber: 'ZK-0001',
    });
  });

  it.each([
    ['a wrong secret', (id: string) => `${id}.not-the-secret`],
    ['an unknown device id', () => 'device-404.whatever'],
    ['no separator at all', () => 'garbage'],
  ])('refuses %s with one indistinguishable message', async (_label, build) => {
    const { device } = await registerDevice();
    await expect(attendanceDeviceService.authenticate(build(device.id as string))).rejects.toThrow(
      'Invalid device credential',
    );
  });

  it('refuses a deactivated terminal even with the right secret', async () => {
    const { device, token } = await registerDevice();
    await attendanceDeviceService.update(COMPANY, device.id as string, { isActive: false });
    await expect(attendanceDeviceService.authenticate(token)).rejects.toThrow('deactivated');
  });

  it('refuses a second terminal with the same serial number', async () => {
    await registerDevice();
    await expect(registerDevice()).rejects.toThrow(/already registered/i);
  });
});

describe('attendance device punch ingestion', () => {
  beforeEach(reset);

  const punch = (over: Partial<Record<string, unknown>> = {}) => ({
    employeeCode: 'EMP001',
    externalId: 'p-1',
    punchedAt: '2026-09-30T01:00:00.000Z',
    direction: 'AUTO' as const,
    ...over,
  });

  async function deviceContext() {
    const { device, token } = await registerDevice();
    void device;
    return attendanceDeviceService.authenticate(token);
  }

  it('opens attendance for the first punch of the day, attested to the terminal', async () => {
    employees.push({ id: 'employee-1', employeeNumber: 'EMP001', companyId: COMPANY, deletedAt: null });
    const device = await deviceContext();

    const [outcome] = await attendanceDeviceService.ingest(device, [punch()]);

    expect(outcome.status).toBe(AttendanceDevicePunchStatus.APPLIED);
    expect(createdAttendance[0]).toMatchObject({
      employeeId: 'employee-1',
      companyId: COMPANY,
      method: 'FINGERPRINT',
      source: 'DEVICE:ZK-0001',
      deviceAttestation: { deviceId: device.id, serialNumber: 'ZK-0001' },
    });
  });

  it('closes the open record on the next AUTO punch instead of opening a second one', async () => {
    employees.push({ id: 'employee-1', employeeNumber: 'EMP001', companyId: COMPANY, deletedAt: null });
    const device = await deviceContext();

    await attendanceDeviceService.ingest(device, [punch()]);
    const [outcome] = await attendanceDeviceService.ingest(device, [
      punch({ externalId: 'p-2', punchedAt: '2026-09-30T10:00:00.000Z' }),
    ]);

    expect(outcome.status).toBe(AttendanceDevicePunchStatus.APPLIED);
    expect(checkedOut).toEqual(['attendance-1']);
    expect(attendanceService.create).toHaveBeenCalledTimes(1);
  });

  it('treats a re-sent punch as a duplicate without touching attendance again', async () => {
    employees.push({ id: 'employee-1', employeeNumber: 'EMP001', companyId: COMPANY, deletedAt: null });
    const device = await deviceContext();

    await attendanceDeviceService.ingest(device, [punch()]);
    const [outcome] = await attendanceDeviceService.ingest(device, [punch()]);

    expect(outcome.status).toBe(AttendanceDevicePunchStatus.DUPLICATE);
    expect(attendanceService.create).toHaveBeenCalledTimes(1);
    expect(checkedOut).toEqual([]);
  });

  /**
   * The isolation that matters. This path runs in system context, so the tenant
   * middleware is not doing the filtering — the explicit companyId in the
   * employee lookup is. A terminal must never reach an employee of another
   * tenant, even when the code matches exactly.
   */
  it('will not reach an employee of another company whose code matches', async () => {
    employees.push({ id: 'employee-b', employeeNumber: 'EMP001', companyId: OTHER_COMPANY, deletedAt: null });
    const device = await deviceContext();

    const [outcome] = await attendanceDeviceService.ingest(device, [punch()]);

    expect(outcome.status).toBe(AttendanceDevicePunchStatus.UNMATCHED_EMPLOYEE);
    expect(attendanceService.create).not.toHaveBeenCalled();
    expect(punches[0]).toMatchObject({ employeeId: null, employeeCode: 'EMP001', companyId: COMPANY });
  });

  it('records an unmatched code rather than dropping it, so it can be investigated', async () => {
    const device = await deviceContext();

    const [outcome] = await attendanceDeviceService.ingest(device, [punch({ employeeCode: 'GHOST' })]);

    expect(outcome.status).toBe(AttendanceDevicePunchStatus.UNMATCHED_EMPLOYEE);
    expect(punches).toHaveLength(1);
    expect(punches[0]).toMatchObject({ employeeCode: 'GHOST', status: AttendanceDevicePunchStatus.UNMATCHED_EMPLOYEE });
  });

  /**
   * A terminal reconnecting after a week posts its whole backlog. If one punch
   * lands on a closed payroll period and that failed the request, the other
   * hundreds would be lost with it.
   */
  it('keeps processing the batch when one punch is refused', async () => {
    employees.push({ id: 'employee-1', employeeNumber: 'EMP001', companyId: COMPANY, deletedAt: null });
    employees.push({ id: 'employee-2', employeeNumber: 'EMP002', companyId: COMPANY, deletedAt: null });
    const device = await deviceContext();

    jest.mocked(attendanceService.create).mockImplementationOnce(async () => {
      throw new Error('Payroll period is closed for this date');
    });

    const outcomes = await attendanceDeviceService.ingest(device, [
      punch({ employeeCode: 'EMP001', externalId: 'p-1' }),
      punch({ employeeCode: 'EMP002', externalId: 'p-2' }),
    ]);

    expect(outcomes.map((outcome) => outcome.status)).toEqual([
      AttendanceDevicePunchStatus.REJECTED,
      AttendanceDevicePunchStatus.APPLIED,
    ]);
    expect(outcomes[0].reason).toMatch(/Payroll period is closed/);
    expect(punches[0]).toMatchObject({ status: AttendanceDevicePunchStatus.REJECTED, employeeId: 'employee-1' });
  });

  it('refuses an explicit OUT punch when nothing is open for that date', async () => {
    employees.push({ id: 'employee-1', employeeNumber: 'EMP001', companyId: COMPANY, deletedAt: null });
    const device = await deviceContext();

    const [outcome] = await attendanceDeviceService.ingest(device, [punch({ direction: 'OUT' })]);

    expect(outcome.status).toBe(AttendanceDevicePunchStatus.REJECTED);
    expect(outcome.reason).toMatch(/No attendance record to close/);
  });

  it('marks the terminal as seen even when every punch was refused', async () => {
    const device = await deviceContext();
    await attendanceDeviceService.ingest(device, [punch({ employeeCode: 'GHOST' })]);

    expect(devices[0].lastSeenAt).toBeInstanceOf(Date);
  });
});
