import type { MessagePage, MessageSeenView, MessageView } from '@hospital-chat/shared';
import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiForbiddenResponse, ApiNotFoundResponse, ApiTags } from '@nestjs/swagger';
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
  ): Promise<MessagePage> {
    return this.messages.page(user.id, departmentId, query.limit, query.before);
  }

  /**
   * "Lo vi": el usuario del token confirma que leyó un mensaje de un supervisor.
   * Sin body: quién lo vio sale del token y la hora la pone el servidor.
   */
  @Post(':messageId/seen')
  @ApiNotFoundResponse({ description: 'El mensaje no existe en esta área' })
  markSeen(
    @Param('departmentId', ParseUUIDPipe) departmentId: string,
    @Param('messageId', ParseUUIDPipe) messageId: string,
    @CurrentUser() user: AuthUser,
  ): Promise<MessageSeenView> {
    return this.messages.markSeen(user, departmentId, messageId);
  }
}
