import { Role } from './role';
import { User } from './user.entity';

export interface DepartmentSummary {
  id: string;
  name: string;
}

/**
 * Lo que sale por la API. Nunca se devuelve la entidad: así un campo nuevo
 * (un hash, un dato interno) no se expone por accidente al agregarlo.
 */
export interface UserResponse {
  id: string;
  fullName: string;
  role: Role;
  staffCode: string | null;
  email: string | null;
  isActive: boolean;
  departments: DepartmentSummary[];
}

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
