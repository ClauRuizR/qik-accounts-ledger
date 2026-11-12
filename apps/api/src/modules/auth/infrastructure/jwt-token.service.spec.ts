import { JwtService } from '@nestjs/jwt';
import { JwtTokenService } from './jwt-token.service.js';

const SECRET = 'unit-test-secret-at-least-32-characters!!';
const user = { id: '7f1e9d44-0b5e-4d1c-9a63-8f7b2b0e2c11', email: 'a@qik.do' };

const makeService = (expiresIn = 60, secret = SECRET) =>
  new JwtTokenService(
    new JwtService({
      secret,
      signOptions: { algorithm: 'HS256', expiresIn },
      verifyOptions: { algorithms: ['HS256'] },
    }),
  );

describe('JwtTokenService', () => {
  it('round-trips the user identity', async () => {
    const service = makeService();
    const token = await service.issue(user);
    await expect(service.verify(token)).resolves.toEqual(user);
  });

  it('rejects a token signed with another secret', async () => {
    const token = await makeService(
      60,
      'another-secret-that-is-also-32-chars-long',
    ).issue(user);
    await expect(makeService().verify(token)).resolves.toBeNull();
  });

  it('rejects a tampered token', async () => {
    const token = await makeService().issue(user);
    const [header, , signature] = token.split('.');
    const forgedPayload = Buffer.from(
      JSON.stringify({ sub: 'attacker', email: 'x@y.z' }),
    ).toString('base64url');
    await expect(
      makeService().verify(`${header}.${forgedPayload}.${signature}`),
    ).resolves.toBeNull();
  });

  it('rejects an expired token', async () => {
    vi.useFakeTimers();
    try {
      const service = makeService(1);
      const token = await service.issue(user);
      vi.setSystemTime(Date.now() + 5_000);
      await expect(service.verify(token)).resolves.toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it('rejects garbage', async () => {
    await expect(makeService().verify('not-a-jwt')).resolves.toBeNull();
  });
});
