import { Clock } from '../../common/clock';
import { Role } from '../../users/role';
import { DepartmentAccess } from '../application/ports/department-access';
import { MessageReadModel, MessageView } from '../application/ports/message-read-model';
import { MessageRepository } from '../application/ports/message.repository';
import { Message, MessageSnapshot } from '../domain/message';

/**
 * Adaptadores en memoria para probar los casos de uso sin base ni NestJS.
 * Son implementaciones reales de los puertos, no mocks: si un puerto cambia,
 * TypeScript obliga a actualizarlos.
 */
export class InMemoryMessageStore extends MessageRepository implements MessageReadModel {
  readonly saved: MessageSnapshot[] = [];
  private readonly authors = new Map<string, { fullName: string; role: Role }>();

  registerAuthor(id: string, fullName: string, role: Role): void {
    this.authors.set(id, { fullName, role });
  }

  save(message: Message): Promise<void> {
    this.saved.push(message.toSnapshot());
    return Promise.resolve();
  }

  latestInDepartment(departmentId: string, limit: number): Promise<MessageView[]> {
    const views = this.saved
      .filter((message) => message.departmentId === departmentId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit)
      .map(({ authorId, ...message }) => ({
        id: message.id,
        departmentId: message.departmentId,
        body: message.body,
        priority: message.priority,
        createdAt: message.createdAt,
        author: {
          id: authorId,
          ...(this.authors.get(authorId) ?? { fullName: '?', role: Role.STAFF }),
        },
      }));
    return Promise.resolve(views);
  }
}

export class InMemoryDepartmentAccess extends DepartmentAccess {
  private readonly members = new Set<string>();

  grant(userId: string, departmentId: string): void {
    this.members.add(`${userId}:${departmentId}`);
  }

  canAccess(userId: string, departmentId: string): Promise<boolean> {
    return Promise.resolve(this.members.has(`${userId}:${departmentId}`));
  }
}

export class FakeClock extends Clock {
  constructor(private current: Date) {
    super();
  }

  now(): Date {
    return this.current;
  }

  advanceSeconds(seconds: number): void {
    this.current = new Date(this.current.getTime() + seconds * 1000);
  }
}
