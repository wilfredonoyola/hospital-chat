import { Column, Entity, PrimaryColumn } from 'typeorm';
import { MESSAGE_PRIORITIES, MessagePriority } from '../domain/message-priority';

/**
 * Forma de la fila en Postgres. No es el dominio: el dominio (Message) no
 * sabe que existe esta clase, y el adaptador traduce entre los dos.
 */
@Entity('messages')
export class MessageRecord {
  @PrimaryColumn('uuid')
  id: string;

  @Column({ name: 'department_id', type: 'uuid' })
  departmentId: string;

  @Column({ name: 'author_id', type: 'uuid' })
  authorId: string;

  @Column({ type: 'text' })
  body: string;

  @Column({ type: 'enum', enum: MESSAGE_PRIORITIES, enumName: 'message_priority' })
  priority: MessagePriority;

  @Column({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
