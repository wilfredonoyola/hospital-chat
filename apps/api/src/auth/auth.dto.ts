import { Transform } from 'class-transformer';
import { IsEmail, IsString, Matches, MaxLength } from 'class-validator';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class StaffLoginDto {
  /** Código del gafete, p. ej. ENF001 */
  @Transform(trim)
  @IsString()
  @Matches(/^[A-Za-z0-9]{3,12}$/, { message: 'Código inválido' })
  staffCode: string;

  // En el login solo se valida el formato: la política de PINs seguros se
  // aplica al crearlos. Rechazar aquí un PIN débil delataría la política.
  /** PIN de 4 a 6 dígitos */
  @IsString()
  @Matches(/^\d{4,6}$/, { message: 'El PIN debe tener de 4 a 6 dígitos' })
  pin: string;
}

export class AdminLoginDto {
  @Transform(trim)
  @IsEmail({}, { message: 'Email inválido' })
  @MaxLength(254)
  email: string;

  @IsString()
  @MaxLength(200)
  password: string;
}
