import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsString, Length, MaxLength } from 'class-validator';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class CreateDepartmentDto {
  @Transform(trim)
  @IsString()
  @Length(2, 80)
  name: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(255)
  description?: string;
}

export class UpdateDepartmentDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @Length(2, 80)
  name?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(255)
  description?: string;

  /** Un área no se borra: se desactiva y deja de aparecer en el chat. */
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
