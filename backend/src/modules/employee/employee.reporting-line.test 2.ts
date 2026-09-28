import { employeeRepository } from './employee.repository';
import { employeeService } from './employee.service';

describe('employee self reporting line', () => {
  afterEach(() => jest.restoreAllMocks());

  it('returns a deterministic primary and all alternate position holders', async () => {
    const value = {
      source: 'POSITION_REPORTS_TO' as const,
      employee: { id: 'employee-1', employeeNumber: 'E001', fullName: 'Employee', position: null },
      reportsToPosition: { id: 'position-manager', name: 'Manager' },
      primarySupervisor: { id: 'manager-1', employeeNumber: 'M001', fullName: 'Manager One' },
      alternateSupervisors: [{ id: 'manager-2', employeeNumber: 'M002', fullName: 'Manager Two' }],
    };
    jest.spyOn(employeeRepository, 'findMyReportingLine').mockResolvedValue(value as never);

    await expect(employeeService.getMyReportingLine('employee-1', 'company-a')).resolves.toEqual(value);
    expect(employeeRepository.findMyReportingLine).toHaveBeenCalledWith('employee-1', 'company-a');
  });

  it('fails closed without an employee/company session', async () => {
    const lookup = jest.spyOn(employeeRepository, 'findMyReportingLine');
    await expect(employeeService.getMyReportingLine(undefined, 'company-a'))
      .rejects.toMatchObject({ statusCode: 404 });
    expect(lookup).not.toHaveBeenCalled();
  });
});
