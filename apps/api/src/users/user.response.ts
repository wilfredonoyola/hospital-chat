import type { UserProfile } from '@hospital-chat/shared';
import { User } from './user.entity';

/**
 * Lo que sale por la API es el contrato de packages/shared: si este archivo
 * deja de cumplirlo, la API no compila. Nunca se devuelve la entidad: así un
 * campo nuevo (un hash, un dato interno) no se expone por accidente.
 */
export type UserResponse = UserProfile;

export function toUserResponse(user: User): UserResponse {
  return {
    id: user.id,
    fullName: user.fullName,
    role: user.role,
    staffCode: user.staffCode,
    email: user.email,
    isActive: user.isActive,
    departments: (user.departments ?? [])
      .map(({ id, name }) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name, 'es')),
  };
}
