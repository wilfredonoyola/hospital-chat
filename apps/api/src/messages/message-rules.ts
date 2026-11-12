import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { Role } from '../users/role';
import { MESSAGE_PRIORITIES, MessagePriority } from './message.entity';

export const MAX_BODY_LENGTH = 2000;

/**
 * Reglas de un mensaje nuevo, en una función pura: se prueban sin base de
 * datos ni NestJS levantado. Es lo único que se extrae del service; el resto
 * del módulo sigue la estructura estándar de NestJS (ver ADR 0004).
 */
export function validateNewMessage(input: {
  body: string;
  priority: MessagePriority;
  authorRole: Role;
}): { body: string; priority: MessagePriority } {
  const body = input.body.trim();

  if (body.length === 0) {
    throw new BadRequestException('El mensaje no puede estar vacío');
  }
  if (body.length > MAX_BODY_LENGTH) {
    throw new BadRequestException(`El mensaje no puede tener más de ${MAX_BODY_LENGTH} caracteres`);
  }
  if (!MESSAGE_PRIORITIES.includes(input.priority)) {
    throw new BadRequestException('Prioridad inválida');
  }
  if (input.priority === MessagePriority.URGENT && input.authorRole !== Role.SUPERVISOR) {
    throw new ForbiddenException('Solo un supervisor puede enviar mensajes urgentes');
  }

  return { body, priority: input.priority };
}
