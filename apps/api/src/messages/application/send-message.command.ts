import { randomUUID } from 'node:crypto';
import { Command, CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Clock } from '../../common/clock';
import { Role } from '../../users/role';
import { DepartmentAccessDeniedError } from '../domain/errors';
import { Message, MessageSnapshot } from '../domain/message';
import { MessagePriority } from '../domain/message-priority';
import { DepartmentAccess } from './ports/department-access';
import { MessageRepository } from './ports/message.repository';

export class SendMessageCommand extends Command<MessageSnapshot> {
  constructor(
    readonly sender: { id: string; role: Role },
    readonly departmentId: string,
    readonly body: string,
    readonly priority: MessagePriority = MessagePriority.NORMAL,
  ) {
    super();
  }
}

/**
 * Caso de uso: enviar un mensaje. Orquesta, no decide: la pertenencia la
 * responde el puerto, las reglas del mensaje las aplica el dominio y el
 * guardado lo hace el repositorio.
 */
@CommandHandler(SendMessageCommand)
export class SendMessageHandler implements ICommandHandler<SendMessageCommand> {
  constructor(
    private readonly access: DepartmentAccess,
    private readonly messages: MessageRepository,
    private readonly clock: Clock,
  ) {}

  async execute(command: SendMessageCommand): Promise<MessageSnapshot> {
    // R1 primero: a quien no pertenece al área no se le dice nada más,
    // ni siquiera si su mensaje habría sido válido.
    if (!(await this.access.canAccess(command.sender.id, command.departmentId))) {
      throw new DepartmentAccessDeniedError();
    }

    const message = Message.create({
      id: randomUUID(),
      departmentId: command.departmentId,
      author: command.sender,
      body: command.body,
      priority: command.priority,
      now: this.clock.now(),
    });

    await this.messages.save(message);
    return message.toSnapshot();
  }
}
