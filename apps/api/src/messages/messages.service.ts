import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { AuthUser } from '../auth/auth-user';
import { Clock } from '../common/clock';
import { Role } from '../users/role';
import { validateNewMessage } from './message-rules';
import { Message, MessagePriority } from './message.entity';

export interface MessageView {
  id: string;
  departmentId: string;
  body: string;
  priority: MessagePriority;
  createdAt: Date;
  author: { id: string; fullName: string; role: Role };
}

interface MessageRow {
  id: string;
  department_id: string;
  body: string;
  priority: MessagePriority;
  created_at: Date;
  author_id: string;
  author_name: string;
  author_role: Role;
}

@Injectable()
export class MessagesService {
  constructor(
    @InjectRepository(Message) private readonly messages: Repository<Message>,
    private readonly dataSource: DataSource,
    private readonly clock: Clock,
  ) {}

  async send(
    author: AuthUser,
    departmentId: string,
    input: { body: string; priority?: MessagePriority },
  ): Promise<Message> {
    // R1 antes que nada: quien no pertenece al área no sabe ni si su mensaje era válido.
    await this.assertMember(author.id, departmentId);

    const { body, priority } = validateNewMessage({
      body: input.body,
      priority: input.priority ?? MessagePriority.NORMAL,
      authorRole: author.role,
    });

    return this.messages.save(
      this.messages.create({
        departmentId,
        authorId: author.id, // siempre del token, nunca del body
        body,
        priority,
        createdAt: this.clock.now(), // R4: la fecha la pone el servidor
      }),
    );
  }

  /** Últimos mensajes del área, el más reciente primero, con el autor en la misma consulta (sin N+1). */
  async latest(readerId: string, departmentId: string, limit: number): Promise<MessageView[]> {
    await this.assertMember(readerId, departmentId);

    const rows = await this.dataSource.query<MessageRow[]>(
      `SELECT m.id, m.department_id, m.body, m.priority, m.created_at,
              u.id AS author_id, u.full_name AS author_name, u.role AS author_role
         FROM messages m
         JOIN users u ON u.id = m.author_id
        WHERE m.department_id = $1
        ORDER BY m.created_at DESC, m.id DESC
        LIMIT $2`,
      [departmentId, limit],
    );

    return rows.map((row) => ({
      id: row.id,
      departmentId: row.department_id,
      body: row.body,
      priority: row.priority,
      createdAt: row.created_at,
      author: { id: row.author_id, fullName: row.author_name, role: row.author_role },
    }));
  }

  /**
   * R1: solo quien pertenece a un área activa lee o escribe en ella. Vive en
   * el service, no en el controller, para que el socket de la fase 4 la use
   * igual. Mismo error si el área no existe, está inactiva o es ajena.
   */
  private async assertMember(userId: string, departmentId: string): Promise<void> {
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
}
