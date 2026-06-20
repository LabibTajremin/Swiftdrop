import { ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { ConstraintViolationError } from '../exceptions/constraint-violation.error';
import { InvalidStatusTransitionError } from '../exceptions/invalid-status-transition.error';
import { ResourceNotFoundError } from '../exceptions/resource-not-found.error';
import { GlobalExceptionFilter } from './global-exception.filter';

function buildHost(url = '/test/path') {
  const send = jest.fn();
  const code = jest.fn().mockReturnValue({ send });
  const reply = { code };
  const request = { url };

  const host = {
    switchToHttp: () => ({
      getResponse: () => reply,
      getRequest: () => request,
    }),
  } as unknown as ArgumentsHost;

  return { host, code, send };
}

function lastBody(send: jest.Mock) {
  return send.mock.calls[send.mock.calls.length - 1][0] as Record<string, unknown>;
}

describe('GlobalExceptionFilter', () => {
  let filter: GlobalExceptionFilter;

  beforeEach(() => {
    filter = new GlobalExceptionFilter();
  });

  describe('response shape', () => {
    it('always includes statusCode, error, message, timestamp, path', () => {
      const { host, send } = buildHost('/api/parcels');
      filter.catch(new ResourceNotFoundError('Parcel', '123'), host);
      const body = lastBody(send);
      expect(body).toHaveProperty('statusCode');
      expect(body).toHaveProperty('error');
      expect(body).toHaveProperty('message');
      expect(body).toHaveProperty('timestamp');
      expect(body).toHaveProperty('path', '/api/parcels');
    });

    it('never leaks a stack trace', () => {
      const { host, send } = buildHost();
      filter.catch(new Error('boom'), host);
      const body = lastBody(send);
      expect(body).not.toHaveProperty('stack');
    });

    it('timestamp is a valid ISO string', () => {
      const { host, send } = buildHost();
      filter.catch(new ResourceNotFoundError('Parcel', '1'), host);
      const { timestamp } = lastBody(send) as { timestamp: string };
      expect(() => new Date(timestamp)).not.toThrow();
      expect(new Date(timestamp).toISOString()).toBe(timestamp);
    });
  });

  describe('HttpException pass-through', () => {
    it('preserves the status code', () => {
      const { host, code } = buildHost();
      filter.catch(new HttpException('forbidden', HttpStatus.FORBIDDEN), host);
      expect(code).toHaveBeenCalledWith(HttpStatus.FORBIDDEN);
    });

    it('uses string response as message', () => {
      const { host, send } = buildHost();
      filter.catch(new HttpException('custom message', HttpStatus.BAD_REQUEST), host);
      expect(lastBody(send).message).toBe('custom message');
    });

    it('extracts message from object response', () => {
      const { host, send } = buildHost();
      filter.catch(new HttpException({ message: 'object message' }, HttpStatus.BAD_REQUEST), host);
      expect(lastBody(send).message).toBe('object message');
    });

    it('joins array messages from object response', () => {
      const { host, send } = buildHost();
      filter.catch(
        new HttpException({ message: ['field is required', 'field must be string'] }, HttpStatus.BAD_REQUEST),
        host,
      );
      expect(lastBody(send).message).toBe('field is required, field must be string');
    });
  });

  describe('domain exception mapping', () => {
    it('maps ResourceNotFoundError → 404 Not Found', () => {
      const { host, code, send } = buildHost();
      filter.catch(new ResourceNotFoundError('Parcel', 'abc-123'), host);
      expect(code).toHaveBeenCalledWith(404);
      expect(lastBody(send)).toMatchObject({
        statusCode: 404,
        error: 'Not Found',
        message: "Parcel with id 'abc-123' not found",
      });
    });

    it('maps InvalidStatusTransitionError → 422 Unprocessable Entity', () => {
      const { host, code, send } = buildHost();
      filter.catch(new InvalidStatusTransitionError('registered', 'delivered'), host);
      expect(code).toHaveBeenCalledWith(422);
      expect(lastBody(send)).toMatchObject({
        statusCode: 422,
        error: 'Unprocessable Entity',
        message: 'Invalid status transition: registered -> delivered',
      });
    });

    it('maps ConstraintViolationError → 409 Conflict', () => {
      const { host, code, send } = buildHost();
      filter.catch(new ConstraintViolationError('tracking number already exists'), host);
      expect(code).toHaveBeenCalledWith(409);
      expect(lastBody(send)).toMatchObject({
        statusCode: 409,
        error: 'Conflict',
        message: 'tracking number already exists',
      });
    });
  });

  describe('Postgres error mapping', () => {
    it('maps pg code 23505 (unique violation) → 409', () => {
      const { host, code, send } = buildHost();
      filter.catch({ code: '23505' }, host);
      expect(code).toHaveBeenCalledWith(409);
      expect(lastBody(send).statusCode).toBe(409);
    });

    it('maps pg code 23503 (fk violation) → 409', () => {
      const { host, code, send } = buildHost();
      filter.catch({ code: '23503' }, host);
      expect(code).toHaveBeenCalledWith(409);
      expect(lastBody(send).statusCode).toBe(409);
    });

    it('maps unknown pg code → 500', () => {
      const { host, code } = buildHost();
      filter.catch({ code: '99999' }, host);
      expect(code).toHaveBeenCalledWith(500);
    });
  });

  describe('catch-all → 500', () => {
    it('maps a plain Error → 500', () => {
      const { host, code, send } = buildHost();
      filter.catch(new Error('unexpected'), host);
      expect(code).toHaveBeenCalledWith(500);
      expect(lastBody(send)).toMatchObject({
        statusCode: 500,
        error: 'Internal Server Error',
        message: 'Internal server error',
      });
    });

    it('maps a thrown string → 500', () => {
      const { host, code } = buildHost();
      filter.catch('something went wrong', host);
      expect(code).toHaveBeenCalledWith(500);
    });

    it('maps null → 500', () => {
      const { host, code } = buildHost();
      filter.catch(null, host);
      expect(code).toHaveBeenCalledWith(500);
    });
  });
});
