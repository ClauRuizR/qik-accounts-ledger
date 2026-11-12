import { type ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { FakeTokenService } from '../../../test-support/fakes.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';

function httpContext(headers: Record<string, string>) {
  const request: { headers: Record<string, string>; user?: unknown } = {
    headers,
  };
  const context = {
    getType: () => 'http',
    getHandler: () => function handler() {},
    getClass: () => class Resolver {},
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
  return { context, request };
}

describe('JwtAuthGuard', () => {
  const reflector = new Reflector();
  const guard = new JwtAuthGuard(reflector, new FakeTokenService());

  afterEach(() => vi.restoreAllMocks());

  it('allows @Public() handlers without a token', async () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(true);
    await expect(guard.canActivate(httpContext({}).context)).resolves.toBe(
      true,
    );
  });

  it('rejects requests without a bearer token', async () => {
    await expect(
      guard.canActivate(httpContext({}).context),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(
      guard.canActivate(httpContext({ authorization: 'Basic abc' }).context),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects invalid tokens', async () => {
    await expect(
      guard.canActivate(
        httpContext({ authorization: 'Bearer forged' }).context,
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('attaches the user for valid tokens', async () => {
    const { context, request } = httpContext({
      authorization: 'Bearer token-for:u1',
    });
    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.user).toEqual({ id: 'u1', email: 'u1@test.local' });
  });
});
