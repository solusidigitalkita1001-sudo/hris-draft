import jwt from 'jsonwebtoken';
import config from '@/config';
import { jwtHandler } from './JWTHandler';

describe('JWTHandler access session version', () => {
  it('round-trips the session version in a new access token', () => {
    const token = jwtHandler.generateAccessToken({
      sub: 'user-1',
      email: 'user@example.test',
      sessionVersion: 4,
    });

    expect(jwtHandler.verifyAccessToken(token)).toMatchObject({
      sub: 'user-1',
      sessionVersion: 4,
    });
  });

  it('rejects an access token issued before session-version support', () => {
    const legacyToken = jwt.sign(
      { sub: 'user-1', email: 'user@example.test', type: 'access', jti: 'legacy-token' },
      config.jwt.accessSecret,
      {
        expiresIn: '15m',
        issuer: config.jwt.issuer,
        audience: 'hrms-api',
      },
    );

    expect(() => jwtHandler.verifyAccessToken(legacyToken)).toThrow(/obsolete/);
  });
});
