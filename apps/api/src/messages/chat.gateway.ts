import type {
  ClientToServerEvents,
  JoinResult,
  MessageView,
  ServerToClientEvents,
} from '@hospital-chat/shared';
import { Logger } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { isUUID } from 'class-validator';
import type { Namespace, Socket } from 'socket.io';
import { AuthSession, SessionService } from '../auth/session.service';
import { MessagesService } from './messages.service';

interface SocketData {
  session: AuthSession;
  expiryTimer: NodeJS.Timeout;
}

type ChatSocket = Socket<ClientToServerEvents, ServerToClientEvents, never, SocketData>;
type ChatNamespace = Namespace<ClientToServerEvents, ServerToClientEvents, never, SocketData>;

const room = (departmentId: string) => `department:${departmentId}`;

/**
 * Canal de empuje del chat. Solo notifica: los mensajes se escriben por HTTP,
 * así hay un solo camino de escritura con validación y códigos de error
 * claros. Si un evento se pierde, la lectura por HTTP es la fuente de verdad.
 */
@WebSocketGateway({ namespace: '/chat' })
export class ChatGateway implements OnGatewayInit, OnGatewayDisconnect {
  private readonly logger = new Logger(ChatGateway.name);

  @WebSocketServer()
  private readonly server: ChatNamespace;

  constructor(
    private readonly sessions: SessionService,
    private readonly messages: MessagesService,
  ) {}

  /**
   * La autenticación va en un middleware de Socket.IO, no en handleConnection:
   * el middleware corre antes de aceptar la conexión, así ningún evento del
   * cliente se procesa sin sesión. Si falla, el cliente recibe connect_error.
   */
  afterInit(namespace: ChatNamespace): void {
    namespace.use((socket, next) => {
      const token: unknown = socket.handshake.auth?.token;
      if (typeof token !== 'string') {
        return next(new Error('Falta el token'));
      }
      this.sessions.authenticate(token).then(
        (session) => {
          socket.data.session = session;
          // Al vencer el token se corta la conexión: el socket no vive más que la sesión.
          // setTimeout admite como máximo ~24,8 días; se acota por si el TTL se configura muy largo.
          const msLeft = Math.min(
            Math.max(session.expiresAt.getTime() - Date.now(), 0),
            2 ** 31 - 1,
          );
          socket.data.expiryTimer = setTimeout(() => this.reject(socket, 'Sesión vencida'), msLeft);
          next();
        },
        () => next(new Error('Sesión inválida')),
      );
    });
  }

  handleDisconnect(socket: ChatSocket): void {
    clearTimeout(socket.data.expiryTimer);
  }

  @SubscribeMessage('department:join')
  async join(
    @ConnectedSocket() socket: ChatSocket,
    @MessageBody() data: { departmentId?: unknown },
  ): Promise<JoinResult> {
    const { session } = socket.data;
    const departmentId = data?.departmentId;
    if (typeof departmentId !== 'string' || !isUUID(departmentId)) {
      return { ok: false, message: 'Área inválida' };
    }

    // Se revalida la sesión: un token revocado (logout, desactivado) no entra a salas nuevas.
    if (!(await this.sessions.isStillValid(session.user.id, session.version))) {
      this.reject(socket, 'La sesión ya no es válida');
      return { ok: false, message: 'La sesión ya no es válida' };
    }

    try {
      await this.messages.ensureMember(session.user.id, departmentId);
    } catch {
      return { ok: false, message: 'No tienes acceso a esta área' };
    }

    await socket.join(room(departmentId));
    return { ok: true };
  }

  @SubscribeMessage('department:leave')
  async leave(
    @ConnectedSocket() socket: ChatSocket,
    @MessageBody() data: { departmentId?: unknown },
  ): Promise<JoinResult> {
    if (typeof data?.departmentId === 'string') {
      await socket.leave(room(data.departmentId));
    }
    return { ok: true };
  }

  broadcastNewMessage(message: MessageView): void {
    this.server.to(room(message.departmentId)).emit('message:new', message);
  }

  private reject(socket: ChatSocket, reason: string): void {
    this.logger.debug(`Socket ${socket.id} desconectado: ${reason}`);
    socket.emit('session:invalid', reason);
    socket.disconnect(true);
  }
}
