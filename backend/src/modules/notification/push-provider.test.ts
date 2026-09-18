import { sendApns, sendFcm } from './push-provider';

const payload = {
  title: 'Approval baru',
  body: 'Ada pengajuan yang perlu ditinjau',
  notificationId: '11111111-1111-4111-8111-111111111111',
  resource: 'workflow',
  action: 'OPEN',
  referenceId: '22222222-2222-4222-8222-222222222222',
};

describe('native push providers', () => {
  it('fails closed without FCM credentials and does not call the network', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch');
    await expect(sendFcm('device-token', payload)).resolves.toEqual({
      kind: 'config-missing',
      reason: 'FCM credentials are incomplete',
    });
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it('fails closed without APNs credentials', async () => {
    await expect(sendApns('device-token', payload)).resolves.toEqual({
      kind: 'config-missing',
      reason: 'APNs credentials are incomplete',
    });
  });
});
