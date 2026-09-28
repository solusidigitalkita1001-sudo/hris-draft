const mockModel = () => ({
  findMany: jest.fn().mockResolvedValue([]),
  createMany: jest.fn().mockResolvedValue({ count: 0 }),
  update: jest.fn().mockResolvedValue({}),
  updateMany: jest.fn().mockResolvedValue({ count: 1 }),
});
const mockClient: any = {
  notification: mockModel(),
  mobileDeviceRegistration: mockModel(),
  pushNotificationDelivery: mockModel(),
  $transaction: jest.fn(async (operations: Promise<unknown>[]) => Promise.all(operations)),
};
jest.mock('@/shared/database/prisma', () => ({ __esModule: true, default: mockClient, prisma: mockClient }));
jest.mock('@/shared/logger/WinstonLogger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));
jest.mock('./push-provider', () => ({ sendFcm: jest.fn(), sendApns: jest.fn() }));

import { sendFcm } from './push-provider';
import { PushDeliveryService } from './push-delivery.service';

describe('PushDeliveryService', () => {
  beforeEach(() => jest.clearAllMocks());

  it('deactivates an invalid provider token and records a terminal delivery result', async () => {
    const now = new Date();
    mockClient.pushNotificationDelivery.findMany.mockResolvedValueOnce([{
      id: 'delivery-1',
      companyId: 'company-1',
      userId: 'user-1',
      registrationId: 'registration-1',
      provider: 'FCM',
      status: 'PENDING',
      attempts: 0,
      updatedAt: now,
      notification: {
        id: 'notification-1',
        title: 'Approval baru',
        message: 'Buka approval center',
        resource: 'workflow',
        action: 'OPEN',
        referenceId: 'instance-1',
      },
      registration: { id: 'registration-1', token: 'legacy-plaintext-token', isActive: true },
    }]);
    jest.mocked(sendFcm).mockResolvedValueOnce({ kind: 'invalid-token', reason: 'UNREGISTERED' });

    const result = await new PushDeliveryService().sweep();

    expect(result.invalidTokens).toBe(1);
    expect(mockClient.mobileDeviceRegistration.update).toHaveBeenCalledWith({
      where: { id: 'registration-1' },
      data: { isActive: false },
    });
    expect(mockClient.pushNotificationDelivery.update).toHaveBeenCalledWith({
      where: { id: 'delivery-1' },
      data: { status: 'INVALID_TOKEN', attempts: { increment: 1 }, lastError: 'UNREGISTERED' },
    });
  });
});
