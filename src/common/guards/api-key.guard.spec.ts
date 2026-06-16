import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiKeyGuard } from './api-key.guard';

const VALID_KEY = 'super-secret-key';

function buildContext(headers: Record<string, string | undefined>): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ headers }),
    }),
  } as unknown as ExecutionContext;
}

function makeGuard(apiKey = VALID_KEY): ApiKeyGuard {
  const config = {
    getOrThrow: jest.fn().mockReturnValue(apiKey),
  } as unknown as ConfigService;
  return new ApiKeyGuard(config);
}

describe('ApiKeyGuard', () => {
  describe('canActivate', () => {
    it('returns true when x-api-key matches the configured key', () => {
      const guard = makeGuard();
      const ctx = buildContext({ 'x-api-key': VALID_KEY });
      expect(guard.canActivate(ctx)).toBe(true);
    });

    it('throws UnauthorizedException when x-api-key header is absent', () => {
      const guard = makeGuard();
      const ctx = buildContext({});
      expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException when x-api-key is an empty string', () => {
      const guard = makeGuard();
      const ctx = buildContext({ 'x-api-key': '' });
      expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException when x-api-key does not match', () => {
      const guard = makeGuard();
      const ctx = buildContext({ 'x-api-key': 'wrong-key' });
      expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
    });

    it('is case-sensitive: wrong case throws UnauthorizedException', () => {
      const guard = makeGuard();
      const ctx = buildContext({ 'x-api-key': VALID_KEY.toUpperCase() });
      expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException with a descriptive message', () => {
      const guard = makeGuard();
      const ctx = buildContext({});
      expect(() => guard.canActivate(ctx)).toThrow('Invalid or missing API key');
    });

    it('reads the key from ConfigService on every invocation', () => {
      const getOrThrow = jest.fn().mockReturnValue(VALID_KEY);
      const config = { getOrThrow } as unknown as ConfigService;
      const guard = new ApiKeyGuard(config);

      guard.canActivate(buildContext({ 'x-api-key': VALID_KEY }));
      guard.canActivate(buildContext({ 'x-api-key': VALID_KEY }));

      expect(getOrThrow).toHaveBeenCalledTimes(2);
      expect(getOrThrow).toHaveBeenCalledWith('API_KEY');
    });
  });
});
