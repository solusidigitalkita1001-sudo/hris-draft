import { registerMobileDeviceSchema } from './mobile-device.dto';

describe('mobile device registration contract', () => {
  const base = {
    installationId: 'installation-123456',
    token: 'provider-token-with-sufficient-length',
  };

  it('accepts FCM for Android and iOS', () => {
    expect(registerMobileDeviceSchema.parse({ ...base, platform: 'ANDROID', provider: 'FCM' }).provider)
      .toBe('FCM');
    expect(registerMobileDeviceSchema.parse({ ...base, platform: 'IOS', provider: 'FCM' }).provider)
      .toBe('FCM');
  });

  it('rejects APNS on Android', () => {
    expect(() => registerMobileDeviceSchema.parse({ ...base, platform: 'ANDROID', provider: 'APNS' }))
      .toThrow(/APNS/);
  });
});
