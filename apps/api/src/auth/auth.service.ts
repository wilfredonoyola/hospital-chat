import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Clock } from '../common/clock';
import { PasswordHasher } from '../common/password-hasher';
import { Env } from '../config/env';
import { JwtPayload } from './auth-user';
import { LoginCandidate, UserCredentialsRepository } from './user-credentials.repository';

export interface LoginResult {
  accessToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
  user: Pick<LoginCandidate, 'id' | 'fullName' | 'role'>;
}

/**
 * Un solo mensaje para todo fallo de login: código inexistente, cuenta
 * inactiva, cuenta bloqueada o PIN incorrecto. Distinguirlos le dice a un
 * atacante qué códigos existen (docs/amenazas.md, A2).
 */
export const INVALID_CREDENTIALS = 'Credenciales inválidas';

type LoginFailureReason = 'unknown_identifier' | 'inactive' | 'locked' | 'wrong_secret';

interface LoginAttempt {
  method: 'staff' | 'admin';
  /** Código de personal o email. No es secreto; el PIN y la contraseña sí, y nunca se registran. */
  identifier: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly credentials: UserCredentialsRepository,
    private readonly hasher: PasswordHasher,
    private readonly jwt: JwtService,
    private readonly clock: Clock,
    private readonly config: ConfigService<Env, true>,
  ) {}

  async loginStaff(staffCode: string, pin: string): Promise<LoginResult> {
    const code = staffCode.toUpperCase();
    const candidate = await this.credentials.findStaffByCode(code);
    return this.login(candidate, pin, { method: 'staff', identifier: code });
  }

  async loginAdmin(email: string, password: string): Promise<LoginResult> {
    const normalized = email.toLowerCase();
    const candidate = await this.credentials.findAdminByEmail(normalized);
    return this.login(candidate, password, { method: 'admin', identifier: normalized });
  }

  async logout(userId: string): Promise<void> {
    await this.credentials.revokeSessions(userId);
    this.logger.log({ event: 'auth.logout', userId });
  }

  private async login(
    candidate: LoginCandidate | null,
    secret: string,
    attempt: LoginAttempt,
  ): Promise<LoginResult> {
    // Usuario inexistente, inactivo o bloqueado: igual se calcula un hash para
    // que el tiempo de respuesta sea el mismo que con un PIN incorrecto.
    if (!candidate || !candidate.isActive || this.isLocked(candidate)) {
      await this.hasher.verifyDummy(secret);
      const reason = !candidate
        ? 'unknown_identifier'
        : !candidate.isActive
          ? 'inactive'
          : 'locked';
      this.logFailure(attempt, reason, candidate?.id);
      throw new UnauthorizedException(INVALID_CREDENTIALS);
    }

    if (!(await this.hasher.verify(candidate.secretHash, secret))) {
      this.logFailure(attempt, 'wrong_secret', candidate.id);
      await this.registerFailure(candidate.id);
      throw new UnauthorizedException(INVALID_CREDENTIALS);
    }

    if (candidate.failedLoginAttempts > 0 || candidate.lockedUntil) {
      await this.credentials.resetFailedLogins(candidate.id);
    }

    this.logger.log({
      event: 'auth.login_succeeded',
      method: attempt.method,
      userId: candidate.id,
    });
    return this.issueToken(candidate);
  }

  /**
   * El motivo real queda en el log interno (para detectar fuerza bruta o una
   * cuenta atacada); la respuesta al cliente es siempre el mismo 401 (A2).
   * Nunca se registra el PIN ni la contraseña.
   */
  private logFailure(attempt: LoginAttempt, reason: LoginFailureReason, userId?: string): void {
    this.logger.warn({ event: 'auth.login_failed', ...attempt, reason, userId });
  }

  private isLocked(candidate: LoginCandidate): boolean {
    return candidate.lockedUntil !== null && candidate.lockedUntil > this.clock.now();
  }

  private async registerFailure(userId: string): Promise<void> {
    const maxAttempts = this.config.get('LOGIN_MAX_ATTEMPTS', { infer: true });
    const lockMinutes = this.config.get('LOGIN_LOCK_MINUTES', { infer: true });
    const lockUntil = new Date(this.clock.now().getTime() + lockMinutes * 60_000);

    const locked = await this.credentials.registerFailedLogin(userId, maxAttempts, lockUntil);
    if (locked) {
      // Evento para alertas: varias cuentas bloqueadas en pocos minutos es un ataque (M1).
      this.logger.warn({
        event: 'auth.account_locked',
        userId,
        lockedUntil: lockUntil.toISOString(),
      });
    }
  }

  private async issueToken(candidate: LoginCandidate): Promise<LoginResult> {
    const expiresIn = this.config.get('JWT_TTL_SECONDS', { infer: true });
    const payload: JwtPayload = { sub: candidate.id, ver: candidate.tokenVersion };

    return {
      accessToken: await this.jwt.signAsync(payload, { expiresIn }),
      tokenType: 'Bearer',
      expiresIn,
      user: { id: candidate.id, fullName: candidate.fullName, role: candidate.role },
    };
  }
}
