import { IQueryHandler, Query, QueryHandler } from '@nestjs/cqrs';
import { DepartmentAccessDeniedError } from '../domain/errors';
import { DepartmentAccess } from './ports/department-access';
import { MessageReadModel, MessageView } from './ports/message-read-model';

export class GetMessagesQuery extends Query<MessageView[]> {
  constructor(
    readonly readerId: string,
    readonly departmentId: string,
    readonly limit: number,
  ) {
    super();
  }
}

@QueryHandler(GetMessagesQuery)
export class GetMessagesHandler implements IQueryHandler<GetMessagesQuery> {
  constructor(
    private readonly access: DepartmentAccess,
    private readonly readModel: MessageReadModel,
  ) {}

  async execute(query: GetMessagesQuery): Promise<MessageView[]> {
    // Leer también exige pertenecer al área: es la amenaza del empleado curioso.
    if (!(await this.access.canAccess(query.readerId, query.departmentId))) {
      throw new DepartmentAccessDeniedError();
    }
    return this.readModel.latestInDepartment(query.departmentId, query.limit);
  }
}
