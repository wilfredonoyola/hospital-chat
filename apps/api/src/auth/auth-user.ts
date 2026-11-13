import { Role } from '../users/role';

/** Usuario autenticado de la petición actual. El rol se lee de la base, no del token. */
export interface AuthUser {
  id: string;
  role: Role;
}

export interface JwtPayload {
  sub: string;
  /** Versión de sesión: si no coincide con la de la base, el token está revocado. */
  ver: number;
  /** Vencimiento en segundos desde epoch; lo agrega jsonwebtoken al firmar. */
  exp?: number;
}
