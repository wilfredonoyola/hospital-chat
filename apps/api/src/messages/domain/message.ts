import { Role } from '../../users/role';
import { InvalidMessageError, UrgentNotAllowedError } from './errors';
import { MESSAGE_PRIORITIES, MessagePriority } from './message-priority';

export const MAX_BODY_LENGTH = 2000;

export interface MessageSnapshot {
  id: string;
  departmentId: string;
  authorId: string;
  body: string;
  priority: MessagePriority;
  createdAt: Date;
}

export interface NewMessage {
  id: string;
  departmentId: string;
  author: { id: string; role: Role };
  body: string;
  priority: MessagePriority;
  now: Date;
}

/**
 * Un mensaje en el canal de un área. Las reglas que dependen solo del mensaje
 * y de quién lo escribe viven aquí; la pertenencia al área necesita datos
 * externos y la comprueba el caso de uso.
 *
 * Inmutable: en un contexto clínico lo dicho queda dicho.
 */
export class Message {
  private constructor(private readonly props: MessageSnapshot) {}

  static create(input: NewMessage): Message {
    const body = input.body.trim();
    if (body.length === 0) {
      throw new InvalidMessageError('El mensaje no puede estar vacío');
    }
    if (body.length > MAX_BODY_LENGTH) {
      throw new InvalidMessageError(
        `El mensaje no puede tener más de ${MAX_BODY_LENGTH} caracteres`,
      );
    }
    if (!MESSAGE_PRIORITIES.includes(input.priority)) {
      throw new InvalidMessageError('Prioridad inválida');
    }
    if (input.priority === MessagePriority.URGENT && input.author.role !== Role.SUPERVISOR) {
      throw new UrgentNotAllowedError();
    }

    return new Message({
      id: input.id,
      departmentId: input.departmentId,
      authorId: input.author.id,
      body,
      priority: input.priority,
      // La fecha la pone el servidor: un cliente con el reloj mal no desordena el canal.
      createdAt: input.now,
    });
  }

  get id(): string {
    return this.props.id;
  }

  get isUrgent(): boolean {
    return this.props.priority === MessagePriority.URGENT;
  }

  toSnapshot(): MessageSnapshot {
    return { ...this.props };
  }
}
