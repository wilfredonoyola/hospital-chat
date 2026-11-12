import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Clock } from '../common/clock';
import { PasswordHasher } from '../common/password-hasher';
import { Env } from '../config/env';
import { Role } from '../users/role';
import { AuthService, INVALID_CREDENTIALS } from './auth.service';
import { LoginCandidate, UserCredentialsRepository } from './user-credentials.repository';

class FakeClock extends Clock {
  constructor(private current: Date) {
    super();
  }
  now() {
    return this.current;
  }
  advanceMinutes(minutes: number) {
    this.current = new Date(this.current.getTime() + minutes * 60_000);
  }
}

/** Hasher falso: el "hash" es el texto con prefijo. Rápido y determinista. */
class FakeHasher extends PasswordHasher {
  verifyDummy = jest.fn(() => Promise.resolve(false as const));
  hash = (plain: string) => Promise.resolve(`hashed:${plain}`);
  verify = jest.fn((hash: string, plain: string) => Promise.resolve(hash === `hashed:${plain}`));
}

const NOW = new Date('2026-11-12T08:00:00Z');
const CONFIG = { LOGIN_MAX_ATTEMPTS: 5, LOGIN_LOCK_MINUTES: 15, JWT_TTL_SECONDS: 1800 };

function candidate(overrides: Partial<LoginCandidate> = {}): LoginCandidate {
  return {
    id: 'user-1',
    fullName: 'Ana Martínez',
    role: Role.STAFF,
    isActive: true,
    failedLoginAttempts: 0,
    lockedUntil: null,
    tokenVersion: 3,
    secretHash: 'hashed:2580',
    ...overrides,
  };
}

describe('AuthService', () => {
  let service: AuthService;
  let credentials: jest.Mocked<UserCredentialsRepository>;
  let hasher: FakeHasher;
  let clock: FakeClock;
  let jwt: { signAsync: jest.Mock };

  beforeEach(() => {
    credentials = {
      findStaffByCode: jest.fn(),
      findAdminByEmail: jest.fn(),
      registerFailedLogin: jest.fn().mockResolvedValue(false),
      resetFailedLogins: jest.fn(),
      findSessionState: jest.fn(),
      revokeSessions: jest.fn(),
    } as unknown as jest.Mocked<UserCredentialsRepository>;
    hasher = new FakeHasher();
    clock = new FakeClock(NOW);
    jwt = { signAsync: jest.fn().mockResolvedValue('signed.jwt.token') };
    const config = { get: (key: keyof typeof CONFIG) => CONFIG[key] };

    service = new AuthService(
      credentials,
      hasher,
      jwt as unknown as JwtService,
      clock,
      config as unknown as ConfigService<Env, true>,
    );
  });

  describe('login del personal', () => {
    it('emite un token con el id y la versión de sesión', async () => {
      credentials.findStaffByCode.mockResolvedValue(candidate());

      const result = await service.loginStaff('enf001', '2580');

      expect(credentials.findStaffByCode).toHaveBeenCalledWith('ENF001');
      expect(jwt.signAsync).toHaveBeenCalledWith({ sub: 'user-1', ver: 3 }, { expiresIn: 1800 });
      expect(result).toEqual({
        accessToken: 'signed.jwt.token',
        tokenType: 'Bearer',
        expiresIn: 1800,
        user: { id: 'user-1', fullName: 'Ana Martínez', role: Role.STAFF },
      });
    });

    it.each([
      ['el código no existe', null],
      ['la cuenta está inactiva', candidate({ isActive: false })],
      ['la cuenta está bloqueada', candidate({ lockedUntil: new Date(NOW.getTime() + 60_000) })],
    ])(
      'si %s responde el mismo error y calcula un hash falso para igualar el tiempo',
      async (_case, found) => {
        credentials.findStaffByCode.mockResolvedValue(found);

        await expect(service.loginStaff('ENF001', '2580')).rejects.toThrow(
          new UnauthorizedException(INVALID_CREDENTIALS),
        );
        expect(hasher.verifyDummy).toHaveBeenCalledWith('2580');
        expect(credentials.registerFailedLogin).not.toHaveBeenCalled();
      },
    );

    it('con PIN incorrecto responde el mismo error y registra el intento fallido', async () => {
      credentials.findStaffByCode.mockResolvedValue(candidate());

      await expect(service.loginStaff('ENF001', '9999')).rejects.toThrow(INVALID_CREDENTIALS);

      const lockUntil = new Date(NOW.getTime() + 15 * 60_000);
      expect(credentials.registerFailedLogin).toHaveBeenCalledWith('user-1', 5, lockUntil);
    });

    it('permite entrar cuando el bloqueo ya venció y reinicia el contador', async () => {
      credentials.findStaffByCode.mockResolvedValue(
        candidate({ lockedUntil: new Date(NOW.getTime() + 15 * 60_000) }),
      );
      await expect(service.loginStaff('ENF001', '2580')).rejects.toThrow(INVALID_CREDENTIALS);

      clock.advanceMinutes(16);
      await service.loginStaff('ENF001', '2580');

      expect(credentials.resetFailedLogins).toHaveBeenCalledWith('user-1');
    });

    it('no escribe en la base en un login correcto sin intentos previos', async () => {
      credentials.findStaffByCode.mockResolvedValue(candidate());

      await service.loginStaff('ENF001', '2580');

      expect(credentials.resetFailedLogins).not.toHaveBeenCalled();
    });
  });

  describe('login del admin', () => {
    it('normaliza el email a minúsculas antes de buscar', async () => {
      credentials.findAdminByEmail.mockResolvedValue(
        candidate({ role: Role.ADMIN, secretHash: 'hashed:una-contrasena-larga' }),
      );

      const result = await service.loginAdmin('Admin@Hospital.Local', 'una-contrasena-larga');

      expect(credentials.findAdminByEmail).toHaveBeenCalledWith('admin@hospital.local');
      expect(result.user.role).toBe(Role.ADMIN);
    });
  });

  it('logout revoca todas las sesiones del usuario', async () => {
    await service.logout('user-1');

    expect(credentials.revokeSessions).toHaveBeenCalledWith('user-1');
  });
});
