import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { FastifyReply, FastifyRequest } from 'fastify';
import { ConstraintViolationError } from '../exceptions/constraint-violation.error';
import { InvalidStatusTransitionError } from '../exceptions/invalid-status-transition.error';
import { ResourceNotFoundError } from '../exceptions/resource-not-found.error';

const STATUS_TEXTS: Record<number, string> = {
  400: 'Bad Request',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not Found',
  409: 'Conflict',
  500: 'Internal Server Error',
};

interface ErrorBody {
  statusCode: number;
  error: string;
  message: string;
  timestamp: string;
  path: string;
}

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const reply = ctx.getResponse<FastifyReply>();
    const request = ctx.getRequest<FastifyRequest>();

    const { statusCode, message } = this.resolve(exception);

    const body: ErrorBody = {
      statusCode,
      error: STATUS_TEXTS[statusCode] ?? 'Error',
      message,
      timestamp: new Date().toISOString(),
      path: request.url,
    };

    reply.code(statusCode).send(body);
  }

  private resolve(exception: unknown): { statusCode: number; message: string } {
    if (exception instanceof HttpException) {
      return this.resolveHttp(exception);
    }

    if (exception instanceof ResourceNotFoundError) {
      return { statusCode: HttpStatus.NOT_FOUND, message: exception.message };
    }

    if (exception instanceof InvalidStatusTransitionError) {
      return { statusCode: HttpStatus.BAD_REQUEST, message: exception.message };
    }

    if (exception instanceof ConstraintViolationError) {
      return { statusCode: HttpStatus.CONFLICT, message: exception.message };
    }

    if (this.isPgError(exception)) {
      return this.resolvePg(exception.code);
    }

    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Internal server error',
    };
  }

  private resolveHttp(exception: HttpException): { statusCode: number; message: string } {
    const statusCode = exception.getStatus();
    const response = exception.getResponse();

    let message: string;
    if (typeof response === 'string') {
      message = response;
    }
    else if (typeof response === 'object' && response !== null) {
      const r = response as { message?: string | string[] };
      if (Array.isArray(r.message)) {
        message = r.message.join(', ');
      } else {
        message = r.message ?? exception.message;
      }
    } else {
      message = exception.message;
    }

    return { statusCode, message };
  }

  private resolvePg(code: string): { statusCode: number; message: string } {
    if (code === '23505') {
      return { statusCode: HttpStatus.CONFLICT, message: 'A record with that value already exists' };
    }
    if (code === '23503') {
      return { statusCode: HttpStatus.CONFLICT, message: 'Referenced resource does not exist' };
    }
    return { statusCode: HttpStatus.INTERNAL_SERVER_ERROR, message: 'Internal server error' };
  }

  private isPgError(error: unknown): error is { code: string } {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      typeof (error as Record<string, unknown>).code === 'string'
    );
  }
}
