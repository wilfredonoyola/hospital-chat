import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
} from 'class-validator';
import { STAFF_ROLES, type StaffRole } from './role';
import { IsSecurePin } from './pin-policy';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const upper = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toUpperCase() : value;

export class CreateUserDto {
  @Transform(trim)
  @IsString()
  @Length(2, 120)
  fullName: string;

  /** Solo SUPERVISOR o STAFF: la API no crea administradores. */
  @IsIn(STAFF_ROLES, { message: 'El rol debe ser SUPERVISOR o STAFF' })
  role: StaffRole;

  @Transform(upper)
  @IsString()
  @Matches(/^[A-Z0-9]{3,12}$/, { message: 'El código debe tener de 3 a 12 letras o números' })
  staffCode: string;

  @IsSecurePin()
  pin: string;

  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(20)
  @IsUUID('all', { each: true })
  departmentIds: string[];
}

export class UpdateUserDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @Length(2, 120)
  fullName?: string;

  @IsOptional()
  @IsIn(STAFF_ROLES, { message: 'El rol debe ser SUPERVISOR o STAFF' })
  role?: StaffRole;

  /** false desactiva la cuenta y cierra todas sus sesiones al instante. */
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  /** Reemplaza las áreas actuales por estas. */
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(20)
  @IsUUID('all', { each: true })
  departmentIds?: string[];
}

export class ResetPinDto {
  @IsSecurePin()
  pin: string;
}
