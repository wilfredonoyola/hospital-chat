import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { AuthUser } from '../auth-user';
import { IS_PUBLIC_KEY } from '../decorators';
import { SessionService } from '../session.service';

/**
 * Guard global de autenticación. Sin Passport: para un JWT propio son unas
 * pocas líneas y se ve exactamente qué se valida (ver ADR 0003).
 *
 * La validación vive en SessionService (firma, usuario activo y versión de
 * sesión) y es la misma que usa el socket del chat.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly sessions: SessionService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Los APP_GUARD también corren en eventos de WebSocket. El socket del chat
    // se autentica una vez, en el middleware de conexión de ChatGateway.
    if (context.getType() !== 'http') {
      return true;
    }

    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request & { user?: AuthUser }>();
    const token = this.extractBearerToken(request);
    if (!token) {
      throw new UnauthorizedException('Falta el token de acceso');
    }

    request.user = (await this.sessions.authenticate(token)).user;
    return true;
  }

  private extractBearerToken(request: Request): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' && token ? token : undefined;
  }
}
