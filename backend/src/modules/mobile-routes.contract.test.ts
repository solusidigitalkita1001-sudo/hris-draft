import attendanceRoutes from './attendance/attendance.routes';
import attendanceCorrectionRoutes from './attendance/attendance-correction.routes';
import leaveRoutes from './leave/leave.routes';
import notificationRoutes from './notification/notification.routes';
import payrollRoutes from './payroll/payroll.routes';
import workflowEngineRoutes from './workflow-engine/workflow-engine.routes';
import announcementRoutes from './announcement/announcement.routes';
import employeeRoutes from './employee/employee.routes';
import workCalendarRoutes from './work-calendar/work-calendar.routes';
import assetRoutes from './asset/asset.routes';

function paths(router: unknown): string[] {
  return ((router as { stack: Array<{ route?: { path: string } }> }).stack)
    .flatMap((layer) => layer.route ? [layer.route.path] : []);
}

describe('mobile route contract and ordering', () => {
  it('exposes attendance self-service before the generic id route', () => {
    const registered = paths(attendanceRoutes);
    expect(registered).toEqual(expect.arrayContaining([
      '/me/today', '/me', '/me/check-in', '/me/check-out', '/overtime',
    ]));
    expect(registered.indexOf('/me/today')).toBeLessThan(registered.indexOf('/:id'));
    expect(registered.indexOf('/overtime')).toBeLessThan(registered.indexOf('/:id'));
  });

  it('keeps static leave balances reachable before /:id', () => {
    const registered = paths(leaveRoutes);
    expect(registered.indexOf('/balances/employee')).toBeLessThan(registered.indexOf('/:id'));
  });

  it('exposes correction history, push token, and approval queue routes', () => {
    expect(paths(attendanceCorrectionRoutes)).toEqual(expect.arrayContaining(['/my', '/my/:id']));
    expect(paths(notificationRoutes)).toEqual(expect.arrayContaining(['/device-tokens']));
    expect(paths(workflowEngineRoutes)).toContain('/instances/my-approvals');
  });

  it('exposes announcement inbox, unread count, detail, and read state', () => {
    expect(paths(announcementRoutes)).toEqual(expect.arrayContaining([
      '/', '/unread-count', '/:id', '/:id/read',
    ]));
  });

  it('keeps the self reporting-line route reachable before employee detail', () => {
    const registered = paths(employeeRoutes);
    expect(registered.indexOf('/me/reporting-line')).toBeLessThan(registered.indexOf('/:id'));
  });

  it('exposes a next-shift resolver that crosses calendar months', () => {
    expect(paths(workCalendarRoutes)).toContain('/me/next-shift');
  });

  it('keeps the employee asset inbox reachable before asset detail', () => {
    const registered = paths(assetRoutes);
    expect(registered.indexOf('/my')).toBeLessThan(registered.indexOf('/:id'));
  });

  it('keeps payroll unlock, lock, and PDF routes reachable before payslip detail', () => {
    const registered = paths(payrollRoutes);
    const detailIndex = registered.indexOf('/payslips/:id');

    expect(registered).toEqual(expect.arrayContaining([
      '/payslips/unlock', '/payslips/lock', '/payslips/:id/pdf', '/payslips/:id',
    ]));
    expect(registered.indexOf('/payslips/unlock')).toBeLessThan(detailIndex);
    expect(registered.indexOf('/payslips/lock')).toBeLessThan(detailIndex);
    expect(registered.indexOf('/payslips/:id/pdf')).toBeLessThan(detailIndex);
  });
});
