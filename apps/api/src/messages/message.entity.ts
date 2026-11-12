import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

export const MessagePriority = {
  NORMAL: 'NORMAL',
  URGENT: 'URGENT',
} as const;

export type MessagePriority = (typeof MessagePriority)[keyof typeof MessagePriority];

export const MESSAGE_PRIORITIES = Object.values(MessagePriority);

@Entity('messages')
export class Message {
  @PrimaryGeneratedColumn('uuid')
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
