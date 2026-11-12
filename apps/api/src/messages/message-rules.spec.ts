import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { Role } from '../users/role';
import { MAX_BODY_LENGTH, validateNewMessage } from './message-rules';
import { MessagePriority } from './message.entity';

const valid = {
  body: 'Paciente de la cama 4 pide analgesia',
  priority: MessagePriority.NORMAL,
  authorRole: Role.STAFF,
};

describe('validateNewMessage', () => {
  it('recorta el texto y conserva la prioridad', () => {
    expect(validateNewMessage({ ...valid, body: '  Cama 4 lista  ' })).toEqual({
      body: 'Cama 4 lista',
      priority: 'NORMAL',
    });
  });

  it('R2: un supervisor puede enviar urgentes', () => {
    const result = validateNewMessage({
      ...valid,
      priority: MessagePriority.URGENT,
      authorRole: Role.SUPERVISOR,
    });

    expect(result.priority).toBe('URGENT');
  });

  it.each([Role.STAFF, Role.ADMIN])('R2: un %s no puede enviar urgentes', (authorRole) => {
    expect(() =>
      validateNewMessage({ ...valid, priority: MessagePriority.URGENT, authorRole }),
    ).toThrow(ForbiddenException);
  });

  it.each(['', '   ', '\n\t'])('R3: rechaza un texto vacío (%j)', (body) => {
    expect(() => validateNewMessage({ ...valid, body })).toThrow(BadRequestException);
  });

  it('R3: acepta el máximo y rechaza un carácter más', () => {
    expect(() => validateNewMessage({ ...valid, body: 'a'.repeat(MAX_BODY_LENGTH) })).not.toThrow();
    expect(() => validateNewMessage({ ...valid, body: 'a'.repeat(MAX_BODY_LENGTH + 1) })).toThrow(
      /2000 caracteres/,
    );
  });

  it('rechaza una prioridad que no existe aunque llegue saltándose el DTO', () => {
    expect(() => validateNewMessage({ ...valid, priority: 'CRITICAL' as MessagePriority })).toThrow(
      BadRequestException,
    );
  });
});
