import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GetMessagesHandler } from './application/get-messages.query';
import { DepartmentAccess } from './application/ports/department-access';
import { MessageReadModel } from './application/ports/message-read-model';
import { MessageRepository } from './application/ports/message.repository';
import { SendMessageHandler } from './application/send-message.command';
import { MessagesController } from './http/messages.controller';
import { MessageRecord } from './infrastructure/message-record.entity';
import { TypeOrmDepartmentAccess } from './infrastructure/typeorm-department-access';
import { TypeOrmMessageReadModel } from './infrastructure/typeorm-message.read-model';
import { TypeOrmMessageRepository } from './infrastructure/typeorm-message.repository';

/**
 * Aquí se conectan los puertos con sus adaptadores. Es el único archivo que
 * cambia si mañana los mensajes se guardan en otro lado.
 */
@Module({
  imports: [CqrsModule.forRoot(), TypeOrmModule.forFeature([MessageRecord])],
  controllers: [MessagesController],
  providers: [
    SendMessageHandler,
    GetMessagesHandler,
    { provide: MessageRepository, useClass: TypeOrmMessageRepository },
    { provide: MessageReadModel, useClass: TypeOrmMessageReadModel },
    { provide: DepartmentAccess, useClass: TypeOrmDepartmentAccess },
  ],
})
export class MessagesModule {}
