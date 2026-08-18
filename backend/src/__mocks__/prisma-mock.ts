const COMPANY_SCOPED_MODELS = [
  'workflowTemplate',
  'workflowInstance',
  'workflowInstanceStep',
  'workflowInstanceLog',
  'leaveRequest',
  'leaveBalance',
  'loan',
  'businessTrip',
  'expenseClaim',
  'expenseApproval',
  'shiftSwapRequest',
  'overtimeRequest',
  'role',
  'permission',
  'rolePermission',
  'userRole',
  'leaveType',
  'loanType',
  'employee',
];

function makeMockModel(name: string) {
  return {
    findUnique: jest.fn().mockResolvedValue(null),
    findFirst: jest.fn().mockResolvedValue(null),
    findMany: jest.fn().mockResolvedValue([]),
    create: jest.fn().mockResolvedValue({}),
    createMany: jest.fn().mockResolvedValue({ count: 0 }),
    update: jest.fn().mockResolvedValue({}),
    updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    delete: jest.fn().mockResolvedValue({}),
    deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
    upsert: jest.fn().mockResolvedValue({}),
    count: jest.fn().mockResolvedValue(0),
    aggregate: jest.fn().mockResolvedValue({}),
    groupBy: jest.fn().mockResolvedValue([]),
  };
}

const mockPrismaClient: any = {};
for (const model of COMPANY_SCOPED_MODELS) {
  mockPrismaClient[model] = makeMockModel(model);
}
mockPrismaClient.$use = jest.fn();
mockPrismaClient.$on = jest.fn();
mockPrismaClient.$connect = jest.fn().mockResolvedValue(true);
mockPrismaClient.$disconnect = jest.fn().mockResolvedValue(true);
mockPrismaClient.$transaction = jest
  .fn()
  .mockImplementation(async (cb: any) => cb(mockPrismaClient));
mockPrismaClient.$queryRaw = jest.fn().mockResolvedValue([]);
mockPrismaClient.$executeRaw = jest.fn().mockResolvedValue(0);

export const prisma = mockPrismaClient;
export const prismaRead = mockPrismaClient;
export default mockPrismaClient;

export function testDatabaseConnection() {
  return Promise.resolve(true);
}
export function disconnectDatabase() {
  return Promise.resolve();
}
