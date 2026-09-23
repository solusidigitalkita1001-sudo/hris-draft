import { EmployeeController } from './employee.controller';
import { employeeService } from './employee.service';
import { requireCompanyAccess } from '@/shared/middleware/CompanyScope';
import { ForbiddenError } from '@/shared/exceptions/AppError';

function response() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    setHeader: jest.fn(),
    send: jest.fn(),
  } as any;
}

describe('employee export/import tenant boundary', () => {
  const controller = new EmployeeController();

  afterEach(() => jest.restoreAllMocks());

  it('blocks a cross-company export before the export service can read rows', async () => {
    const exportSpy = jest.spyOn(employeeService, 'exportCsv').mockResolvedValue('' as never);
    const req = {
      user: { id: 'u', email: 'u@example.com', companyId: 'A', companyScope: ['A'], roles: ['HR_STAFF'] },
      params: {},
      query: { companyId: 'B' },
      body: {},
      originalUrl: '/api/v1/employees/export?companyId=B',
    } as any;
    const next = jest.fn();

    await requireCompanyAccess()(req, response(), next);

    expect(next).toHaveBeenCalledWith(expect.any(ForbiddenError));
    expect(exportSpy).not.toHaveBeenCalled();
  });

  it('rejects a foreign company in a multipart import body before parsing rows', async () => {
    const importSpy = jest.spyOn(employeeService, 'importCsv').mockResolvedValue({} as never);
    const req = {
      user: { id: 'u', email: 'u@example.com', companyId: 'A', companyScope: ['A'], roles: ['HR_STAFF'] },
      body: { companyId: 'B' },
      file: { buffer: Buffer.from('employeeNumber,firstName\nE-1,A') },
    } as any;
    const res = response();
    const next = jest.fn();

    await controller.importCsv(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(importSpy).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });
});
