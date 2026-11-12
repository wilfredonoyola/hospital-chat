import { Role } from '../../users/role';
import { InvalidMessageError, UrgentNotAllowedError } from './errors';
import { MAX_BODY_LENGTH, Message, NewMessage } from './message';
import { MessagePriority } from './message-priority';

const NOW = new Date('2026-11-12T08:00:00Z');

function input(overrides: Partial<NewMessage> = {}): NewMessage {
  return {
    id: 'msg-1',
    departmentId: 'dep-1',
    author: { id: 'user-1', role: Role.STAFF },
    body: 'Paciente de la cama 4 pide analgesia',
    priority: MessagePriority.NORMAL,
    now: NOW,
    ...overrides,
  };
}

describe('Message', () => {
  it('crea un mensaje normal con la fecha del servidor y el texto recortado', () => {
    const message = Message.create(input({ body: '  Cama 4 lista  ' }));

    expect(message.toSnapshot()).toEqual({
      id: 'msg-1',
      departmentId: 'dep-1',
      authorId: 'user-1',
      body: 'Cama 4 lista',
      priority: 'NORMAL',
      createdAt: NOW,
    });
    expect(message.isUrgent).toBe(false);
  });

  it('R2: un supervisor puede enviar un urgente', () => {
    const message = Message.create(
      input({
        author: { id: 'sup-1', role: Role.SUPERVISOR },
        priority: MessagePriority.URGENT,
      }),
    );

    expect(message.isUrgent).toBe(true);
  });

  it.each([Role.STAFF, Role.ADMIN])('R2: un %s no puede enviar urgentes', (role) => {
    expect(() =>
      Message.create(input({ author: { id: 'u', role }, priority: MessagePriority.URGENT })),
    ).toThrow(UrgentNotAllowedError);
  });

  it.each(['', '   ', '\n\t'])('R3: rechaza un texto vacío (%j)', (body) => {
    expect(() => Message.create(input({ body }))).toThrow(InvalidMessageError);
  });

  it('R3: acepta el máximo y rechaza un carácter más', () => {
    expect(() => Message.create(input({ body: 'a'.repeat(MAX_BODY_LENGTH) }))).not.toThrow();
    expect(() => Message.create(input({ body: 'a'.repeat(MAX_BODY_LENGTH + 1) }))).toThrow(
      /2000 caracteres/,
    );
  });

  it('rechaza una prioridad que no existe aunque llegue saltándose el DTO', () => {
    expect(() => Message.create(input({ priority: 'CRITICAL' as MessagePriority }))).toThrow(
      InvalidMessageError,
    );
  });

  it('el snapshot es una copia: modificarla no cambia el mensaje', () => {
    const message = Message.create(input());
    const snapshot = message.toSnapshot();

    snapshot.body = 'alterado';

    expect(message.toSnapshot().body).toBe('Paciente de la cama 4 pide analgesia');
  });
});
