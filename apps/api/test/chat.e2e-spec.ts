import type {
  ClientToServerEvents,
  MessageView,
  ServerToClientEvents,
} from '@hospital-chat/shared';
import { io, Socket } from 'socket.io-client';
import {
  createDepartment,
  createStaff,
  createTestApp,
  loginStaff,
  resetDatabase,
  TestContext,
} from './helpers';

type ChatClient = Socket<ServerToClientEvents, ClientToServerEvents>;

describe('Chat en tiempo real por Socket.IO (e2e)', () => {
  let ctx: TestContext;
  let emergencias: string;
  let uci: string;
  let ana: string;
  let carla: string;
  let luis: string;
  const clients: ChatClient[] = [];

  /** Conecta y resuelve al conectar; rechaza con el motivo si el servidor no lo acepta. */
  function connect(token?: string): Promise<ChatClient> {
    const client: ChatClient = io(`${ctx.url}/chat`, {
      auth: token ? { token } : {},
      transports: ['websocket'],
      reconnection: false,
      forceNew: true,
    });
    clients.push(client);
    return new Promise((resolve, reject) => {
      client.once('connect', () => resolve(client));
      client.once('connect_error', (error) => reject(error));
    });
  }

  const join = (client: ChatClient, departmentId: string) =>
    client.emitWithAck('department:join', { departmentId });

  const nextMessage = (client: ChatClient) =>
    new Promise<MessageView>((resolve) => client.once('message:new', resolve));

  /** Espera un rato y devuelve los mensajes recibidos: para probar que algo NO llega. */
  function collectFor(client: ChatClient, ms: number): Promise<MessageView[]> {
    const received: MessageView[] = [];
    client.on('message:new', (message) => received.push(message));
    return new Promise((resolve) => setTimeout(() => resolve(received), ms));
  }

  const post = (token: string, departmentId: string, body: string, priority?: string) =>
    ctx
      .http()
      .post(`/departments/${departmentId}/messages`)
      .set('Authorization', `Bearer ${token}`)
      .send({ body, priority })
      .expect(201);

  beforeAll(async () => {
    ctx = await createTestApp({ listen: true });
  });

  beforeEach(async () => {
    await resetDatabase(ctx.db);
    emergencias = await createDepartment(ctx.db, 'Emergencias');
    uci = await createDepartment(ctx.db, 'UCI');
    await createStaff(ctx.db, { code: 'ENF001', pin: '2580', departmentIds: [emergencias] });
    await createStaff(ctx.db, {
      code: 'SUP001',
      pin: '7391',
      role: 'SUPERVISOR',
      departmentIds: [emergencias],
    });
    await createStaff(ctx.db, { code: 'ENF002', pin: '4826', departmentIds: [uci] });
    [ana, carla, luis] = await Promise.all([
      loginStaff(ctx, 'ENF001', '2580'),
      loginStaff(ctx, 'SUP001', '7391'),
      loginStaff(ctx, 'ENF002', '4826'),
    ]);
  });

  afterEach(() => {
    clients.splice(0).forEach((client) => client.disconnect());
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  describe('criterio 1: autenticación del socket', () => {
    it('rechaza la conexión sin token', async () => {
      await expect(connect()).rejects.toThrow('Falta el token');
    });

    it('rechaza un token inválido', async () => {
      await expect(connect('no.es.un-token')).rejects.toThrow('Sesión inválida');
    });

    it('rechaza un token revocado por logout', async () => {
      await ctx.http().post('/auth/logout').set('Authorization', `Bearer ${ana}`).expect(204);

      await expect(connect(ana)).rejects.toThrow('Sesión inválida');
    });

    it('si la sesión se revoca con el socket abierto, al intentar unirse a un área lo desconecta', async () => {
      const client = await connect(ana);
      const notice = new Promise<string>((resolve) => client.once('session:invalid', resolve));
      const disconnected = new Promise((resolve) => client.once('disconnect', resolve));
      await ctx.http().post('/auth/logout').set('Authorization', `Bearer ${ana}`).expect(204);

      await expect(join(client, emergencias)).rejects.toThrow('socket has been disconnected');
      expect(await notice).toBe('La sesión ya no es válida');
      await disconnected;
    });
  });

  it('criterio 2 y 4: un miembro recibe en tiempo real lo que otro envía por HTTP, con la misma forma', async () => {
    const client = await connect(ana);
    await expect(join(client, emergencias)).resolves.toEqual({ ok: true });
    const incoming = nextMessage(client);

    const response = await post(carla, emergencias, 'Código azul en sala 3', 'URGENT');

    const received = await incoming;
    expect(received).toEqual(response.body);
    expect(received).toMatchObject({
      body: 'Código azul en sala 3',
      priority: 'URGENT',
      author: { fullName: 'Persona SUP001', role: 'SUPERVISOR' },
    });
  });

  it('criterio 3: no puede unirse a un área ajena ni recibe sus mensajes', async () => {
    const client = await connect(ana);
    await expect(join(client, uci)).resolves.toEqual({
      ok: false,
      message: 'No tienes acceso a esta área',
    });

    const received = collectFor(client, 300);
    await post(luis, uci, 'dato clínico de UCI');

    expect(await received).toEqual([]);
  });

  it('rechaza un id de área mal formado sin consultar la base', async () => {
    const client = await connect(ana);

    await expect(join(client, 'no-es-uuid')).resolves.toEqual({
      ok: false,
      message: 'Área inválida',
    });
  });

  it('al salir de la sala deja de recibir mensajes', async () => {
    const client = await connect(ana);
    await join(client, emergencias);
    await client.emitWithAck('department:leave', { departmentId: emergencias });

    const received = collectFor(client, 300);
    await post(carla, emergencias, 'ya no deberías verlo');

    expect(await received).toEqual([]);
  });
});
