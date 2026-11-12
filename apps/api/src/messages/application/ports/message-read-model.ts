import { Role } from '../../../users/role';
import { MessagePriority } from '../../domain/message-priority';

/** Lo que la pantalla del chat necesita, ya armado. No es una entidad de dominio. */
export interface MessageView {
  id: string;
  departmentId: string;
  body: string;
  priority: MessagePriority;
  createdAt: Date;
  author: { id: string; fullName: string; role: Role };
}

/**
 * Puerto de lectura (lado Query de CQRS). No pasa por el dominio: la lectura
 * no cambia nada, así que no hay reglas que proteger, solo datos que mostrar
 * rápido. Se optimiza por su cuenta (índices, cursor, réplica) en la fase 5.
 */
export abstract class MessageReadModel {
  abstract latestInDepartment(departmentId: string, limit: number): Promise<MessageView[]>;
}
