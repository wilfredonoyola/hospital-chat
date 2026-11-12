import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseFilters,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiForbiddenResponse, ApiTags } from '@nestjs/swagger';
import { AuthUser } from '../../auth/auth-user';
import { CurrentUser } from '../../auth/decorators';
import { GetMessagesQuery } from '../application/get-messages.query';
import { MessageView } from '../application/ports/message-read-model';
import { SendMessageCommand } from '../application/send-message.command';
import { MessageSnapshot } from '../domain/message';
import { DomainExceptionFilter } from './domain-exception.filter';
import { ListMessagesQueryDto, SendMessageDto } from './messages.dto';

/**
 * Controller delgado: traduce HTTP a comandos y consultas, y nada más. No
 * sabe de TypeORM ni de reglas de negocio.
 */
@ApiTags('messages')
@ApiBearerAuth()
@ApiForbiddenResponse({ description: 'No perteneces al área, o no puedes enviar urgentes' })
@UseFilters(DomainExceptionFilter)
@Controller('departments/:departmentId/messages')
export class MessagesController {
  constructor(
    private readonly commands: CommandBus,
    private readonly queries: QueryBus,
  ) {}

  @Post()
  send(
    @Param('departmentId', ParseUUIDPipe) departmentId: string,
    @Body() dto: SendMessageDto,
    @CurrentUser() user: AuthUser,
  ): Promise<MessageSnapshot> {
    return this.commands.execute(
      new SendMessageCommand(user, departmentId, dto.body, dto.priority),
    );
  }

  @Get()
  list(
    @Param('departmentId', ParseUUIDPipe) departmentId: string,
    @Query() query: ListMessagesQueryDto,
    @CurrentUser() user: AuthUser,
  ): Promise<MessageView[]> {
    return this.queries.execute(new GetMessagesQuery(user.id, departmentId, query.limit));
  }
}
