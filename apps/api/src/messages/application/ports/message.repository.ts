import { Message } from '../../domain/message';

/**
 * Puerto de escritura. El caso de uso depende de esta clase abstracta; la
 * implementación (TypeORM, en memoria) se elige al armar el módulo.
 * Se usa una clase abstracta y no una interface porque sirve como token de
 * inyección en NestJS sin strings mágicos.
 */
export abstract class MessageRepository {
  abstract save(message: Message): Promise<void>;
}
