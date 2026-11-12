import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { AuthUser, JwtPayload } from '../auth-user';
import { IS_PUBLIC_KEY } from '../decorators';
import { UserCredentialsRepository } from '../user-credentials.repository';

/**
 * Guard global de autenticación. Sin Passport: para un JWT propio son unas
 * pocas líneas y se ve exactamente qué se valida (ver ADR 0003).
 *
 * Además de la firma, consulta la base en cada petición: así desactivar a
 * alguien o hacer logout corta el acceso al instante, y el rol vigente es el
 * de la base, no el que tenía cuando se emitió el token.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly credentials: UserCredentialsRepository,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
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

    let payload: JwtPayload;
    try {
      payload = await this.jwt.verifyAsync<JwtPayload>(token);
    } catch {
      throw new UnauthorizedException('Token inválido o vencido');
    }

    const session = await this.credentials.findSessionState(payload.sub);
    if (!session || !session.isActive || session.tokenVersion !== payload.ver) {
      throw new UnauthorizedException('La sesión ya no es válida');
    }

    request.user = { id: session.id, role: session.role };
    return true;
  }

  private extractBearerToken(request: Request): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' && token ? token : undefined;
  }
}
