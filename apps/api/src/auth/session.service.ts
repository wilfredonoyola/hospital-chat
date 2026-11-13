import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthUser, JwtPayload } from './auth-user';
import { UserCredentialsRepository } from './user-credentials.repository';

export interface AuthSession {
  user: AuthUser;
  /** Versión de sesión con la que se emitió el token. */
  version: number;
  expiresAt: Date;
}

/**
 * Valida un token de acceso. La usan el guard HTTP y el gateway de Socket.IO:
 * una sola implementación, así ningún canal queda con reglas más débiles.
 */
@Injectable()
export class SessionService {
  constructor(
    private readonly jwt: JwtService,
    private readonly credentials: UserCredentialsRepository,
  ) {}

  async authenticate(token: string): Promise<AuthSession> {
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

    return {
      user: { id: session.id, role: session.role },
      version: payload.ver,
      expiresAt: new Date((payload.exp ?? 0) * 1000),
    };
  }

  /** ¿Sigue vigente una sesión ya autenticada? (logout, desactivación, reset de PIN) */
  async isStillValid(userId: string, version: number): Promise<boolean> {
    const session = await this.credentials.findSessionState(userId);
    return !!session && session.isActive && session.tokenVersion === version;
  }
}
