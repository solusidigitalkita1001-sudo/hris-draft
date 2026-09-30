type Row = Record<string, unknown>;

const state: {
  payslips: Row[];
  users: Row[];
  setting: { value: string } | null;
  notifications: Row[][];
  mailSent: string[];
  mailFails: boolean;
} = { payslips: [], users: [], setting: null, notifications: [], mailSent: [], mailFails: false };

jest.mock('@/shared/database/prisma', () => {
  const client = {
    payslip: { findMany: jest.fn(async () => state.payslips) },
    user: {
      findMany: jest.fn(async ({ select }: { select?: Row }) =>
        select && 'email' in select
          ? state.users.filter((user) => user.email)
          : state.users),
    },
    companySetting: { findUnique: jest.fn(async () => state.setting) },
    notification: { createMany: jest.fn(async ({ data }: { data: Row[] }) => { state.notifications.push(data); return { count: data.length }; }) },
  };
  return { __esModule: true, default: client, prisma: client };
});
const warn = jest.fn();
const info = jest.fn();
jest.mock('@/shared/logger/WinstonLogger', () => ({ logger: { info, warn, error: jest.fn(), debug: jest.fn() } }));
jest.mock('@/shared/mail/MailService', () => ({
  mailService: {
    sendPayslipAvailable: jest.fn(async (recipient: string) => {
      if (state.mailFails) throw new Error('SMTP unreachable');
      state.mailSent.push(recipient);
      return true;
    }),
  },
}));

import { PayrollService } from './payroll.service';

/** The private notifier, reached the way the approval path reaches it. */
const notify = (service: PayrollService) =>
  (service as unknown as {
    notifyPayslipsAvailable: (runId: string, companyId: string, periodName: string | null) => Promise<void>;
  }).notifyPayslipsAvailable('run-1', 'company-a', 'September 2026');

describe('payslip availability dispatch', () => {
  let service: PayrollService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new PayrollService();
    state.payslips = [{ id: 'payslip-1', employeeId: 'employee-1' }];
    state.users = [{ id: 'user-1', employeeId: 'employee-1', email: 'maya@example.test' }];
    state.setting = null;
    state.notifications = [];
    state.mailSent = [];
    state.mailFails = false;
  });

  it('always writes the in-app notification, and never puts a figure in it', async () => {
    await notify(service);

    const [rows] = state.notifications;
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ userId: 'user-1', action: 'PAYSLIP_PUBLISHED', referenceId: 'payslip-1' });
    expect(String(rows[0].message)).not.toMatch(/\d[\d.,]{4,}/);
  });

  /**
   * Sending payslip mail to an entire workforce changes what leaves the system,
   * so it is a tenant decision and off until asked for — the same discipline as
   * every other setting of that kind.
   */
  it('sends no email until the company opts in', async () => {
    await notify(service);
    expect(state.mailSent).toEqual([]);
  });

  it('emails the employees once the company has opted in', async () => {
    state.setting = { value: 'true' };
    await notify(service);
    expect(state.mailSent).toEqual(['maya@example.test']);
  });

  it.each([['false'], ['TRUE'], ['1'], ['']])('treats %p as not opted in', async (value) => {
    state.setting = { value };
    await notify(service);
    expect(state.mailSent).toEqual([]);
  });

  /**
   * The run is already approved and the payslips are already visible. A mail
   * server being down must not undo that — it must only be recorded.
   */
  it('survives a mail server failure, and says so in the log', async () => {
    state.setting = { value: 'true' };
    state.mailFails = true;

    await expect(notify(service)).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalledWith(
      'Some payslip availability emails could not be delivered',
      expect.objectContaining({ failed: 1 }),
    );
  });

  it('skips an employee with no active account, in-app and by email alike', async () => {
    state.payslips = [{ id: 'payslip-1', employeeId: 'employee-1' }, { id: 'payslip-2', employeeId: 'employee-2' }];
    state.setting = { value: 'true' };

    await notify(service);

    expect(state.notifications[0]).toHaveLength(1);
    expect(state.mailSent).toEqual(['maya@example.test']);
  });

  it('does nothing at all when the run produced no payslips', async () => {
    state.payslips = [];
    state.setting = { value: 'true' };

    await notify(service);

    expect(state.notifications).toEqual([]);
    expect(state.mailSent).toEqual([]);
  });
});
