import type { MessagePage, MessageSeenView, MessageView } from '@hospital-chat/shared';
import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { AuthUser } from '../auth/auth-user';
import { Clock } from '../common/clock';
import { Role } from '../users/role';
import { decodeCursor, encodeCursor } from './message-cursor';
import { validateNewMessage } from './message-rules';
import { MessageSeen } from './message-seen.entity';
import { Message, MessagePriority } from './message.entity';

interface MessageRow {
  id: string;
  department_id: string;
  body: string;
  priority: MessagePriority;
  created_at: Date;
  author_id: string;
  author_name: string;
  author_role: Role;
  /** created_at como texto de Postgres: conserva los microsegundos para el cursor. */
  created_at_exact: string;
  seen_by_me: boolean;
  seen_count: number;
}

/**
 * Consulta base de MessageView. `readerParam` es el parámetro ($n) con el id
 * de quien lee: con él se calcula si ya marcó "Lo vi". Las dos subconsultas
 * usan la llave primaria de message_seen (empieza por message_id), sin
 * escanear la tabla.
 */
const selectView = (readerParam: string) => `
  SELECT m.id, m.department_id, m.body, m.priority, m.created_at, m.created_at::text AS created_at_exact,
         u.id AS author_id, u.full_name AS author_name, u.role AS author_role,
         EXISTS (
           SELECT 1 FROM message_seen s WHERE s.message_id = m.id AND s.user_id = ${readerParam}
         ) AS seen_by_me,
         -- ::int porque count() es bigint y el driver lo entrega como texto.
         (SELECT count(*)::int FROM message_seen s WHERE s.message_id = m.id) AS seen_count
    FROM messages m
    JOIN users u ON u.id = m.author_id`;

@Injectable()
export class MessagesService {
  constructor(
    @InjectRepository(Message) private readonly messages: Repository<Message>,
    @InjectRepository(MessageSeen) private readonly seen: Repository<MessageSeen>,
    private readonly dataSource: DataSource,
    private readonly clock: Clock,
  ) {}

  /**
   * Devuelve el mismo MessageView que la lectura y que el evento del socket:
   * el cliente pinta igual un mensaje venga de donde venga.
   */
  async send(
    author: AuthUser,
    departmentId: string,
    input: { body: string; priority?: MessagePriority },
  ): Promise<MessageView> {
    // R1 antes que nada: quien no pertenece al área no sabe ni si su mensaje era válido.
    await this.ensureMember(author.id, departmentId);

    const { body, priority } = validateNewMessage({
      body: input.body,
      priority: input.priority ?? MessagePriority.NORMAL,
      authorRole: author.role,
    });

    const saved = await this.messages.save(
      this.messages.create({
        departmentId,
        authorId: author.id, // siempre del token, nunca del body
        body,
        priority,
        createdAt: this.clock.now(), // R4: la fecha la pone el servidor
      }),
    );

    const [view] = await this.queryViews(`${selectView('$2')} WHERE m.id = $1`, [
      saved.id,
      author.id,
    ]);
    return view;
  }

  /**
   * Una página del canal, del más reciente al más antiguo, con el autor en la
   * misma consulta (sin N+1). Sin `before`, la página más reciente; con
   * `before`, la anterior a ese cursor. Usa el índice
   * messages(department_id, created_at DESC, id DESC): lee solo las filas de
   * la página, sin importar qué tan atrás esté.
   */
  async page(
    readerId: string,
    departmentId: string,
    limit: number,
    before?: string,
  ): Promise<MessagePage> {
    const cursor = before ? decodeCursor(before) : null;
    await this.ensureMember(readerId, departmentId);

    // Se pide uno de más para saber si hay página anterior sin otra consulta.
    const rows = cursor
      ? await this.dataSource.query<MessageRow[]>(
          `${selectView('$5')}
            WHERE m.department_id = $1
              AND (m.created_at, m.id) < ($2::timestamptz, $3::uuid)
            ORDER BY m.created_at DESC, m.id DESC
            LIMIT $4`,
          [departmentId, cursor.createdAt, cursor.id, limit + 1, readerId],
        )
      : await this.dataSource.query<MessageRow[]>(
          `${selectView('$3')}
            WHERE m.department_id = $1
            ORDER BY m.created_at DESC, m.id DESC
            LIMIT $2`,
          [departmentId, limit + 1, readerId],
        );

    const hasMore = rows.length > limit;
    const pageRows = rows.slice(0, limit);
    const last = pageRows.at(-1);
    return {
      items: pageRows.map(toView),
      nextCursor:
        hasMore && last ? encodeCursor({ createdAt: last.created_at_exact, id: last.id }) : null,
    };
  }

  /**
   * "Lo vi": solo en mensajes de supervisor del área, y no el propio autor.
   * Idempotente: si ya lo había confirmado, devuelve la confirmación original.
   */
  async markSeen(
    user: AuthUser,
    departmentId: string,
    messageId: string,
  ): Promise<MessageSeenView> {
    await this.ensureMember(user.id, departmentId);

    // El mensaje debe ser de esta área: así no se confirman mensajes de otra.
    const [message] = await this.dataSource.query<{ author_id: string; author_role: Role }[]>(
      `SELECT m.author_id, u.role AS author_role
         FROM messages m
         JOIN users u ON u.id = m.author_id
        WHERE m.id = $1 AND m.department_id = $2`,
      [messageId, departmentId],
    );
    if (!message) {
      throw new NotFoundException('El mensaje no existe en esta área');
    }
    if (message.author_role !== Role.SUPERVISOR || message.author_id === user.id) {
      throw new ForbiddenException('Este mensaje no se puede confirmar');
    }

    // ON CONFLICT DO NOTHING: dos clics seguidos no chocan con la llave primaria.
    await this.seen
      .createQueryBuilder()
      .insert()
      .values({ messageId, userId: user.id, seenAt: this.clock.now() })
      .orIgnore()
      .execute();

    const saved = await this.seen.findOneByOrFail({ messageId, userId: user.id });
    return { messageId, userId: user.id, seenAt: saved.seenAt.toISOString() };
  }

  /**
   * R1: solo quien pertenece a un área activa lee, escribe o se une a su sala
   * de socket. Mismo error si el área no existe, está inactiva o es ajena.
   */
  async ensureMember(userId: string, departmentId: string): Promise<void> {
    const rows = await this.dataSource.query<unknown[]>(
      `SELECT 1
         FROM department_members dm
         JOIN departments d ON d.id = dm.department_id
        WHERE dm.user_id = $1 AND dm.department_id = $2 AND d.is_active`,
      [userId, departmentId],
    );
    if (rows.length === 0) {
      throw new ForbiddenException('No tienes acceso a esta área');
    }
  }

  private async queryViews(sql: string, params: unknown[]): Promise<MessageView[]> {
    const rows = await this.dataSource.query<MessageRow[]>(sql, params);
    return rows.map(toView);
  }
}

function toView(row: MessageRow): MessageView {
  return {
    id: row.id,
    departmentId: row.department_id,
    body: row.body,
    priority: row.priority,
    createdAt: row.created_at.toISOString(),
    author: { id: row.author_id, fullName: row.author_name, role: row.author_role },
    seenByMe: row.seen_by_me,
    seenCount: row.seen_count,
  };
}
