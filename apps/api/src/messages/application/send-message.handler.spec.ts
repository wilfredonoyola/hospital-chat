import { Role } from '../../users/role';
import { DepartmentAccessDeniedError, UrgentNotAllowedError } from '../domain/errors';
import { MessagePriority } from '../domain/message-priority';
import { FakeClock, InMemoryDepartmentAccess, InMemoryMessageStore } from '../testing/in-memory';
import { SendMessageCommand, SendMessageHandler } from './send-message.command';

const NOW = new Date('2026-11-12T08:00:00Z');
const ANA = { id: 'ana', role: Role.STAFF };
const CARLA = { id: 'carla', role: Role.SUPERVISOR };

describe('SendMessageHandler (sin base ni NestJS)', () => {
  let store: InMemoryMessageStore;
  let access: InMemoryDepartmentAccess;
  let handler: SendMessageHandler;

  beforeEach(() => {
    store = new InMemoryMessageStore();
    access = new InMemoryDepartmentAccess();
    access.grant('ana', 'emergencias');
    access.grant('carla', 'emergencias');
    handler = new SendMessageHandler(access, store, new FakeClock(NOW));
  });

  it('guarda el mensaje de un miembro y lo devuelve con id y fecha del servidor', async () => {
    const result = await handler.execute(
      new SendMessageCommand(ANA, 'emergencias', 'Cama 4 lista'),
    );

    expect(result).toMatchObject({
      departmentId: 'emergencias',
      authorId: 'ana',
      body: 'Cama 4 lista',
      priority: 'NORMAL',
      createdAt: NOW,
    });
    expect(result.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(store.saved).toEqual([result]);
  });

  it('R1: rechaza a quien no pertenece al área y no guarda nada', async () => {
    await expect(handler.execute(new SendMessageCommand(ANA, 'uci', 'Hola UCI'))).rejects.toThrow(
      DepartmentAccessDeniedError,
    );
    expect(store.saved).toHaveLength(0);
  });

  it('R1 va antes que las reglas del mensaje: un no miembro no sabe si su mensaje era válido', async () => {
    await expect(
      handler.execute(new SendMessageCommand(ANA, 'uci', '', MessagePriority.URGENT)),
    ).rejects.toThrow(DepartmentAccessDeniedError);
  });

  it('R2: el personal no puede enviar urgentes; el supervisor sí', async () => {
    await expect(
      handler.execute(
        new SendMessageCommand(ANA, 'emergencias', 'Código azul', MessagePriority.URGENT),
      ),
    ).rejects.toThrow(UrgentNotAllowedError);

    const urgent = await handler.execute(
      new SendMessageCommand(CARLA, 'emergencias', 'Código azul', MessagePriority.URGENT),
    );
    expect(urgent.priority).toBe('URGENT');
    expect(store.saved).toHaveLength(1);
  });
});
