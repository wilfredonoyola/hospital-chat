import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/user.entity';

export type LoginCandidate = Pick<
  User,
  'id' | 'fullName' | 'role' | 'isActive' | 'failedLoginAttempts' | 'lockedUntil' | 'tokenVersion'
> & { secretHash: string };

export type SessionState = Pick<User, 'id' | 'role' | 'isActive' | 'tokenVersion'>;

const LOGIN_FIELDS = {
  id: true,
  fullName: true,
  role: true,
  isActive: true,
  failedLoginAttempts: true,
  lockedUntil: true,
  tokenVersion: true,
} as const;

/** Acceso a datos del login y de la sesión. Aislado para que AuthService se pruebe sin base. */
@Injectable()
export class UserCredentialsRepository {
  constructor(@InjectRepository(User) private readonly users: Repository<User>) {}

  async findStaffByCode(staffCode: string): Promise<LoginCandidate | null> {
    const user = await this.users.findOne({
      where: { staffCode },
      select: { ...LOGIN_FIELDS, pinHash: true },
    });
    return user?.pinHash ? { ...user, secretHash: user.pinHash } : null;
  }

  async findAdminByEmail(email: string): Promise<LoginCandidate | null> {
    const user = await this.users.findOne({
      where: { email },
      select: { ...LOGIN_FIELDS, passwordHash: true },
    });
    return user?.passwordHash ? { ...user, secretHash: user.passwordHash } : null;
  }

  /**
   * Suma un intento fallido en una sola sentencia: dos intentos simultáneos no
   * pueden leer el mismo contador y perder uno (lost update). Al llegar al
   * máximo bloquea la cuenta y reinicia el contador para el siguiente ciclo.
   * Devuelve true si este intento bloqueó la cuenta.
   */
  async registerFailedLogin(
    userId: string,
    maxAttempts: number,
    lockUntil: Date,
  ): Promise<boolean> {
    const rows: Array<{ locked: boolean }> = await this.users.query(
      `UPDATE users
          SET failed_login_attempts = CASE
                WHEN failed_login_attempts + 1 >= $2 THEN 0
                ELSE failed_login_attempts + 1 END,
              locked_until = CASE
                WHEN failed_login_attempts + 1 >= $2 THEN $3
                ELSE locked_until END
        WHERE id = $1
        RETURNING locked_until = $3 AS locked`,
      [userId, maxAttempts, lockUntil],
    );
    // En Postgres, query() de un UPDATE ... RETURNING devuelve [filas, filasAfectadas].
    const [result] = Array.isArray(rows[0]) ? (rows[0] as typeof rows) : rows;
    return result?.locked === true;
  }

  async resetFailedLogins(userId: string): Promise<void> {
    await this.users.update(userId, { failedLoginAttempts: 0, lockedUntil: null });
  }

  findSessionState(userId: string): Promise<SessionState | null> {
    return this.users.findOne({
      where: { id: userId },
      select: { id: true, role: true, isActive: true, tokenVersion: true },
    });
  }

  async revokeSessions(userId: string): Promise<void> {
    await this.users.increment({ id: userId }, 'tokenVersion', 1);
  }
}
