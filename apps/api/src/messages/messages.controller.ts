import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiForbiddenResponse, ApiTags } from '@nestjs/swagger';
import { AuthUser } from '../auth/auth-user';
import { CurrentUser } from '../auth/decorators';
import { Message } from './message.entity';
import { ListMessagesQueryDto, SendMessageDto } from './messages.dto';
import { MessagesService, MessageView } from './messages.service';

@ApiTags('messages')
@ApiBearerAuth()
@ApiForbiddenResponse({ description: 'No perteneces al área, o no puedes enviar urgentes' })
@Controller('departments/:departmentId/messages')
export class MessagesController {
  constructor(private readonly messages: MessagesService) {}

  @Post()
  send(
    @Param('departmentId', ParseUUIDPipe) departmentId: string,
    @Body() dto: SendMessageDto,
    @CurrentUser() user: AuthUser,
  ): Promise<Message> {
    return this.messages.send(user, departmentId, dto);
  }

  @Get()
  list(
    @Param('departmentId', ParseUUIDPipe) departmentId: string,
    @Query() query: ListMessagesQueryDto,
    @CurrentUser() user: AuthUser,
  ): Promise<MessageView[]> {
    return this.messages.latest(user.id, departmentId, query.limit);
  }
}
