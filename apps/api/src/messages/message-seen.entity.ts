import { Column, Entity, PrimaryColumn } from 'typeorm';

/**
 * Confirmación de lectura: el usuario `userId` marcó "Lo vi" en el mensaje
 * `messageId`. La llave primaria es la pareja, así que cada persona confirma
 * un mensaje una sola vez. Las llaves foráneas viven en la migración, como en
 * el resto del proyecto.
 */
@Entity('message_seen')
export class MessageSeen {
  @PrimaryColumn({ name: 'message_id', type: 'uuid' })
  messageId: string;

  @PrimaryColumn({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ name: 'seen_at', type: 'timestamptz' })
  seenAt: Date;
}
