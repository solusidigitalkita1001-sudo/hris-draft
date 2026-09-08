jest.mock('./employee-loan.service', () => ({ employeeLoanService: { findMyLoans: jest.fn().mockResolvedValue([]), createLoan: jest.fn().mockResolvedValue({ id: 'loan' }), approveLoan: jest.fn().mockResolvedValue({}) } }));
import { Response } from 'express';
import { AuthenticatedRequest } from '@/shared/middleware/Authenticate';
import { EmployeeLoanController } from './employee-loan.controller';
import { employeeLoanService } from './employee-loan.service';
import { createLoanSchema } from './employee-loan.dto';
const controller = new EmployeeLoanController();
const res = { json: jest.fn(), status: jest.fn().mockReturnThis() } as unknown as Response;
const body = { loanTypeId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', amount: 1000, totalInstallments: 2, installmentAmount: 500, reason: 'Need' };
describe('loan actor contract', () => {
  beforeEach(() => jest.clearAllMocks());
  it('ignores a forged employeeId on the self-service list', async () => {
    const next = jest.fn();
    await controller.findMyLoans({ user: { employeeId: 'self' }, query: { employeeId: 'other', status: 'PENDING' } } as unknown as AuthenticatedRequest, res, next);
    expect(employeeLoanService.findMyLoans).toHaveBeenCalledWith('self', 'PENDING');
    expect(next).not.toHaveBeenCalled();
  });
  it('derives create actor identifiers from the authenticated session after validation', async () => {
    const parsed = createLoanSchema.parse({ ...body, companyId: 'foreign', employeeId: 'other' });
    await controller.create({ user: { companyId: 'A', employeeId: 'self' }, body: parsed } as unknown as AuthenticatedRequest, res, jest.fn());
    expect(employeeLoanService.createLoan).toHaveBeenCalledWith({ ...body, companyId: 'A', employeeId: 'self', remainingBalance: 1000 });
  });
  it('preserves approval notes for the workflow audit trail', async () => {
    await controller.approve({ user: { id: 'actor', employeeId: 'self' }, params: { id: 'loan' }, body: { notes: 'Reviewed' } } as unknown as AuthenticatedRequest, res, jest.fn());
    expect(employeeLoanService.approveLoan).toHaveBeenCalledWith('loan', 'actor', 'self', 'Reviewed');
  });
});
