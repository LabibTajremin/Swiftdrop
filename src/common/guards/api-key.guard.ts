import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FastifyRequest } from 'fastify';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const provided = request.headers['x-api-key'];
    const expected = this.config.getOrThrow<string>('API_KEY');

    if (!provided || provided !== expected) {
      throw new UnauthorizedException('Invalid or missing API key');
    }

    return true;
  }
}
