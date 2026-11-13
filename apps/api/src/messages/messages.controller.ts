import type { MessageView } from '@hospital-chat/shared';
import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiForbiddenResponse, ApiTags } from '@nestjs/swagger';
import { AuthUser } from '../auth/auth-user';
import { CurrentUser } from '../auth/decorators';
import { ChatGateway } from './chat.gateway';
import { ListMessagesQueryDto, SendMessageDto } from './messages.dto';
import { MessagesService } from './messages.service';

@ApiTags('messages')
@ApiBearerAuth()
@ApiForbiddenResponse({ description: 'No perteneces al área, o no puedes enviar urgentes' })
@Controller('departments/:departmentId/messages')
export class MessagesController {
  constructor(
    private readonly messages: MessagesService,
    private readonly chat: ChatGateway,
  ) {}

  @Post()
  async send(
    @Param('departmentId', ParseUUIDPipe) departmentId: string,
    @Body() dto: SendMessageDto,
    @CurrentUser() user: AuthUser,
  ): Promise<MessageView> {
    const message = await this.messages.send(user, departmentId, dto);
    // Se emite después de guardar: nadie recibe por socket un mensaje que no existe.
    this.chat.broadcastNewMessage(message);
    return message;
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
