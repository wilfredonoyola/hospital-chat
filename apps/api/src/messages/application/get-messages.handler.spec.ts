import { Role } from '../../users/role';
import { DepartmentAccessDeniedError } from '../domain/errors';
import { FakeClock, InMemoryDepartmentAccess, InMemoryMessageStore } from '../testing/in-memory';
import { GetMessagesHandler, GetMessagesQuery } from './get-messages.query';
import { SendMessageCommand, SendMessageHandler } from './send-message.command';

describe('GetMessagesHandler (sin base ni NestJS)', () => {
  let store: InMemoryMessageStore;
  let access: InMemoryDepartmentAccess;
  let clock: FakeClock;
  let send: SendMessageHandler;
  let get: GetMessagesHandler;

  beforeEach(() => {
    store = new InMemoryMessageStore();
    store.registerAuthor('ana', 'Ana Martínez', Role.STAFF);
    access = new InMemoryDepartmentAccess();
    access.grant('ana', 'emergencias');
    clock = new FakeClock(new Date('2026-11-12T08:00:00Z'));
    send = new SendMessageHandler(access, store, clock);
    get = new GetMessagesHandler(access, store);
  });

  async function sendMany(...bodies: string[]) {
    for (const body of bodies) {
      await send.execute(
        new SendMessageCommand({ id: 'ana', role: Role.STAFF }, 'emergencias', body),
      );
      clock.advanceSeconds(1);
    }
  }

  it('devuelve los últimos mensajes del más reciente al más antiguo, con su autor', async () => {
    await sendMany('primero', 'segundo', 'tercero');

    const messages = await get.execute(new GetMessagesQuery('ana', 'emergencias', 2));

    expect(messages.map((message) => message.body)).toEqual(['tercero', 'segundo']);
    expect(messages[0].author).toEqual({ id: 'ana', fullName: 'Ana Martínez', role: 'STAFF' });
  });

  it('R1: el empleado curioso no puede leer un área ajena', async () => {
    await sendMany('dato clínico');

    await expect(get.execute(new GetMessagesQuery('luis', 'emergencias', 50))).rejects.toThrow(
      DepartmentAccessDeniedError,
    );
  });
});
