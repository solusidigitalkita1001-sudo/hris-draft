import { refreshTokenSchema } from './auth.dto';

describe('refreshTokenSchema cookie migration', () => {
  it('accepts an empty/null body for an httpOnly refresh cookie', () => {
    expect(refreshTokenSchema.parse(undefined)).toEqual({});
    expect(refreshTokenSchema.parse(null)).toEqual({});
  });

  it('still validates the legacy native-client body token', () => {
    expect(refreshTokenSchema.parse({ refreshToken: 'legacy-token' })).toEqual({ refreshToken: 'legacy-token' });
    expect(() => refreshTokenSchema.parse({ refreshToken: '' })).toThrow();
  });
});
