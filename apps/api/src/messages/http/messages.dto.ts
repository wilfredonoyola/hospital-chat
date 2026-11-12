import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { MESSAGE_PRIORITIES, MessagePriority } from '../domain/message-priority';

/**
 * El DTO valida la forma (tipo, campos permitidos, tamaño máximo para no
 * procesar textos gigantes). Las reglas de negocio (vacío tras recortar,
 * quién puede enviar urgentes) las decide el dominio.
 */
export class SendMessageDto {
  @IsString()
  @MaxLength(4000)
  body: string;

  @IsOptional()
  @IsIn(MESSAGE_PRIORITIES)
  priority?: MessagePriority;
}

export class ListMessagesQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 50;
}
