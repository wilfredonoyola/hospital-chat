import { randomBytes } from 'node:crypto';
import * as argon2 from 'argon2';

export abstract class PasswordHasher {
  abstract hash(plain: string): Promise<string>;
  abstract verify(hash: string, plain: string): Promise<boolean>;
  /**
   * Verifica contra un hash que nunca coincide. Se usa cuando el usuario no
   * existe, para que la respuesta tarde lo mismo que con un usuario real y el
   * tiempo no delate qué códigos existen (docs/amenazas.md, A2).
   */
  abstract verifyDummy(plain: string): Promise<false>;
}

/**
 * argon2id con los parámetros mínimos recomendados por OWASP (19 MiB, 2
 * iteraciones). Los valores por defecto de la librería usan 64 MiB por hash:
 * diez logins simultáneos serían 640 MiB de RAM en una instancia pequeña.
 */
const ARGON2_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 19 * 1024,
  timeCost: 2,
  parallelism: 1,
} as const;

export class Argon2PasswordHasher extends PasswordHasher {
  private dummyHash?: Promise<string>;

  hash(plain: string): Promise<string> {
    return argon2.hash(plain, ARGON2_OPTIONS);
  }

  async verify(hash: string, plain: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, plain);
    } catch {
      return false;
    }
  }

  async verifyDummy(plain: string): Promise<false> {
    this.dummyHash ??= this.hash(randomBytes(32).toString('hex'));
    await this.verify(await this.dummyHash, plain);
    return false;
  }
}
